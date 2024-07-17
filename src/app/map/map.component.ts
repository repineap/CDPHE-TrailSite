import { Component, AfterViewInit, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';

import * as L from 'leaflet';
import * as CL from '../custom-leaflet-shapes';
import * as turf from '@turf/turf';
import 'skmeans';

import { ShapeService } from '../shape.service';
import { GeoStylingService } from '../geo-styling.service';
import skmeans from 'skmeans';
import { forkJoin } from 'rxjs';
import { Facility, FacilityProperties, MultiGeometry, Trail, TrailheadProperties, TrailProperties } from '../geojson-typing';
import { NgIf } from '@angular/common';

const iconRetinaUrl = 'assets/marker-icon-2x.png';
const iconUrl = 'assets/marker-icon.png';
const shadowUrl = 'assets/marker-shadow.png';
const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [27, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

const aqiStyleUrls = ["#Good", "#Moderate", "#UnhealthySG", "#Unhealthy", "#VeryUnhealthy", "#Hazardous"];

interface AQIStructure {
  layerGroup: L.LayerGroup
  layers: L.Layer[]
}

const END_GROUPING_ZOOM = 13;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [NgIf],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnChanges {
  private map!: L.Map;
  private trails: any;
  public todayAqiData: any;
  private todayColoradoAqiData: any
  private tomorrowAqiData: any;
  private tomorrowColoradoAqiData: any
  private tomorrowAqiLayer!: L.GeoJSON;
  private trailheadData: any;
  private facilityData: any;

  private aqiPane!: HTMLElement;
  private trailPane!: HTMLElement;
  private locationPane!: HTMLElement;
  private customMarkerPane!: HTMLElement;
  private layerControl!: L.Control.Layers;
  private selectedLocationMarker!: L.Marker;
  private userLocationMarker!: L.Marker;

  private AQILayerStructure: AQIStructure[] = [];

  @Input() trailheadSelected: [number, number] = [0, 0];
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService) { }

  private initMap() {
    //Intializes the map to the center of Colorado with a zoom of 8
    this.map = L.map('map', {
      center: [39, -105.7821],
      zoom: END_GROUPING_ZOOM - 5,
      preferCanvas: true
    });

    //The base map for the background, taken from OSM
    const OpenStreetMap_Mapnik = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | AQI Data Provided by <a href="https://www.airnow.gov/">AirNow.gov</a>'
    });

    this.aqiPane = this.map.createPane('AQIPane');
    this.aqiPane.style.zIndex = '502';

    this.trailPane = this.map.createPane('TrailPane');
    this.trailPane.style.zIndex = '504';

    this.locationPane = this.map.createPane('LocationPane');
    this.locationPane.style.zIndex = '-10';

    this.customMarkerPane = this.map.createPane('CustomMarkerPane');
    this.customMarkerPane.style.zIndex = '600';

    const centroidPane = this.map.createPane('CentroidMarkerPane');
    centroidPane.style.zIndex = '610';

    const userLocationPane = this.map.createPane('UserLocation');
    userLocationPane.style.zIndex = '620';

    OpenStreetMap_Mapnik.addTo(this.map);
    const layerOrder = ['Grouping Markers', 'Trailheads', 'Trails', 'Fishing Facilities', 'Camping Facilities']
    this.layerControl = L.control.layers(undefined, undefined, {
      collapsed: false,
      sortLayers: true,
      sortFunction: (layerA, layerB, nameA, nameB) => {
        return layerOrder.indexOf(nameA) - layerOrder.indexOf(nameB);
      },
    });
    this.layerControl.addTo(this.map);

    this.selectedLocationMarker = CL.marker6Points([39, -105.7821], {
      radius: 15,
      pane: 'TrailPane',
      color: 'blue',
      weight: 4,
      opacity: 1,
      fillColor: 'gray',
      fillOpacity: 0.5,
    });

    this.userLocationMarker = L.marker([39, -105.7821]);

    this.map.on('moveend', () => {
      this.mapBoundsChange.emit(this.map.getBounds());
    });
  }

  private initLocationSelector() {
    var legend = L.control.layers(undefined, undefined, { position: "topleft" });

    legend.onAdd = (map) => {
      var div = L.DomUtil.create("div", "location-selector");
      div.innerHTML += `
      <svg class="h-[20px] w-[20px] text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11" />
      </svg>`

      div.addEventListener('click', () => {
        this.setLocationMarker();
      });

      return div;
    };

    this.map.addControl(legend);
  }

  private setLocationMarker() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        this.userLocationMarker.setLatLng([latitude, longitude]);

        this.userLocationMarker.addTo(this.map);

        this.map.flyTo([latitude, longitude]);
      }, (error) => {
        console.error('Geolocation error:', error);
      });
    } else {
      console.error('Geolocation not supported by this browser.');
    }
  }

  private styleTrailData() {
    const features = this.trails.features as Trail[]
    // features.forEach((trail: any) => {
    //   trail.properties['todayAQI'] = this.getTrailTodayAQIColor(trail.geometry);
    //   trail.properties['tomorrowAQI'] = this.getTrailTomorrowAQIColor(trail.geometry);
    // });
    features.forEach((trail: any) => {
      trail.properties['todayAQI'] = this.getTodayAQIColor(trail.geometry.coordinates[0][0]);
      trail.properties['tomorrowAQI'] = this.getTomorrowAQIColor(trail.geometry.coordinates[0][0]);
    });
  }

  private initTrailsLayer(combineByPlaceID: boolean) {
    if (combineByPlaceID) {
      this.trails = this.groupTrails(this.trails);
    }

    // this.initTrailTrailheadLayer();

    this.styleTrailData();

    const todayTrailLayers: L.Layer[] = [];
    const tomorrowTrailLayers: L.Layer[] = [];

    aqiStyleUrls.forEach((style) => {
      todayTrailLayers.push(
        L.geoJSON(this.trails, {
          filter: (feature) => {
            return feature.properties.todayAQI.styleUrl === style && feature.properties && feature.properties.name !== '' && feature.properties.type !== 'Road';
          },
          pane: 'CustomMarkerPane',
          style: (feature) => ({
            weight: 6,
            opacity: 0.75,
            color: 'black'
          }),
          onEachFeature: (feature, layer) => {
            const popupContent = this.createTrailPopup(feature as Trail)
            layer.bindPopup(popupContent);
          }
        })
      );

      tomorrowTrailLayers.push(
        L.geoJSON(this.trails, {
          filter: (feature) => {
            return feature.properties.tomorrowAQI.styleUrl === style && feature.properties && feature.properties.name !== '' && feature.properties.type !== 'Road';
          },
          pane: 'CustomMarkerPane',
          style: (feature) => ({
            weight: 6,
            opacity: 0.75,
            color: 'black'
          }),
          onEachFeature: (feature, layer) => {
            const popupContent = this.createTrailPopup(feature as Trail)
            layer.bindPopup(popupContent);
          }
        })
      );
    });

    const todayTrailGroup = L.layerGroup(todayTrailLayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: todayTrailGroup, layers: todayTrailLayers });
    const tomorrowTrailGroup = L.layerGroup(tomorrowTrailLayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: tomorrowTrailGroup, layers: tomorrowTrailLayers });

    const trailLayer = L.layerGroup([todayTrailGroup], { pane: 'LocationPane' });

    let autoToggle = true;

    this.map.on('zoomend', () => {
      if (!autoToggle) {
        return;
      }
      const mapZoom = this.map.getZoom();
      if (mapZoom < END_GROUPING_ZOOM) {
        trailLayer.removeFrom(this.map);
      } else {
        trailLayer.addTo(this.map);
      }
    });

    trailLayer.on('add', () => {
      if (this.map.getZoom() < END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    trailLayer.on('remove', () => {
      if (this.map.getZoom() >= END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    this.map.on('baselayerchange', () => {
      if (trailLayer.hasLayer(todayTrailGroup)) {
        trailLayer.clearLayers();
        trailLayer.addLayer(tomorrowTrailGroup);
      } else {
        trailLayer.clearLayers();
        trailLayer.addLayer(todayTrailGroup);
      }
    });

    this.layerControl.addOverlay(trailLayer, "Trails");
  }

  private createTrailPopup(trail: Trail): string {
    const popupContent =
      `<p>Name: ${checkForEmpty(trail.properties.name)}</p>
    <p>Type: ${checkForEmpty(trail.properties.type)}</p>
    <p>${trail.properties.length_mi_} miles long</p>
    <p>Energy Miles: ${getTrailEnergyMiles(trail.properties)}</p>
    <p>Shenandoah Difficulty: ${getTrailShenandoahDifficulty(trail.properties)}</p>
    <p>Surface: ${checkForEmpty(trail.properties.surface)}</p>
    <p>Max Elevation: ${metersToFt(trail.properties.max_elevat)}</p>
    <p>Min Elevation: ${metersToFt(trail.properties.min_elevat)}</p>
    <p>Oneway: ${checkForEmpty(trail.properties.oneway)}</p>
    <p>ATV: ${checkForEmpty(trail.properties.atv)}</p>
    <p>Motorcycle: ${checkForEmpty(trail.properties.motorcycle)}</p>
    <p>Horse: ${checkForEmpty(trail.properties.horse)}</p>
    <p>Hiking: ${checkForEmpty(trail.properties.hiking)}</p>
    <p>Biking: ${checkForEmpty(trail.properties.bike)}</p>
    <p>Dogs: ${checkForEmpty(trail.properties.dogs)}</p>
    <p>Highway Vehicle: ${checkForEmpty(trail.properties.highway_ve)}</p>
    <p>Off-Highway Vehicle greater than 50 inches wide: ${checkForEmpty(trail.properties.ohv_gt_50)}</p>
    <p>Access: ${checkForEmpty(trail.properties.access)}</p>`;
    return popupContent;
  }

  private groupTrails(geojson: any): any {
    const trailsByName: { [key: string]: any } = {};

    geojson.features.forEach((feature: any) => {
      const name = feature.properties.place_id;
      if (name) {
        if (!trailsByName[name]) {
          trailsByName[name] = {
            type: 'Feature',
            properties: feature.properties,
            geometry: {
              type: 'MultiLineString',
              coordinates: []
            }
          };
        } else {
          //TODO: Update properties to accurately set the length, elevation, etc
        }

        if (feature.geometry.type === 'LineString') {
          trailsByName[name].geometry.coordinates.push(feature.geometry.coordinates);
        } else if (feature.geometry.type === 'MultiLineString') {
          trailsByName[name].geometry.coordinates.push(...feature.geometry.coordinates);
        }
      }
    });

    return {
      type: 'FeatureCollection',
      features: Object.values(trailsByName)
    };
  }

  private initTodayAQILayer() {
    const coloradoBBox: [number, number, number, number] = [-109.05919619986199, 36.99275055519555, -102.04212644366443, 41.00198213121131];
    const coloradoPoly = turf.bboxPolygon(coloradoBBox);
    this.todayColoradoAqiData = {
      "type": "FeatureCollection",
      "features": this.todayAqiData.features.filter((feature: any) => {
        return turf.booleanIntersects(feature.geometry, coloradoPoly);
      })
    }

    const aqiLayer = L.geoJSON(this.todayAqiData, {
      interactive: false,
      pane: 'AQIPane',
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl)),
      // onEachFeature: (feature, layer) => {
      //   layer.bindPopup(feature.properties.description);
      // },
    });

    aqiLayer.addTo(this.map);

    this.layerControl.addBaseLayer(aqiLayer, "Today's AQI Levels")
  }

  private initTomorrowAQILayer() {
    const coloradoBBox: [number, number, number, number] = [-109.05919619986199, 36.99275055519555, -102.04212644366443, 41.00198213121131];
    const coloradoPoly = turf.bboxPolygon(coloradoBBox);
    this.tomorrowColoradoAqiData = {
      "type": "FeatureCollection",
      "features": this.tomorrowAqiData.features.filter((feature: any) => {
        return turf.booleanIntersects(feature.geometry, coloradoPoly);
      })
    }

    this.tomorrowAqiLayer = L.geoJSON(this.tomorrowAqiData, {
      interactive: false,
      pane: 'AQIPane',
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl)),
      // onEachFeature: (feature, layer) => {
      //   layer.bindPopup(feature.properties.description);
      // }
    });

    this.layerControl.addBaseLayer(this.tomorrowAqiLayer, "Tomorrow's AQI Levels");
  }

  private initAQILegend() {
    var legend = L.control.layers(undefined, undefined, { position: "bottomleft" });

    const aqiLevels = [
      {
        styleUrl: '#Good',
        name: 'Good',
        styleIndex: 0,
        style: {} as any
      },
      {
        styleUrl: '#Moderate',
        name: 'Moderate',
        styleIndex: 1,
        style: {} as any
      },
      {
        styleUrl: '#UnhealthySG',
        name: 'Unhealthy for Sensitive Groups',
        styleIndex: 2,
        style: {} as any
      },
      {
        styleUrl: '#Unhealthy',
        name: 'Unhealthy',
        styleIndex: 3,
        style: {} as any
      },
      {
        styleUrl: '#VeryUnhealthy',
        name: 'Very Unhealthy',
        styleIndex: 4,
        style: {} as any
      },
      {
        styleUrl: '#Hazardous',
        name: 'Hazardous',
        styleIndex: 5,
        style: {} as any
      }
    ];

    aqiLevels.forEach((aqi) => {
      aqi.style = this._styleService.getStyleForAQI(aqi.styleUrl);
    });

    legend.onAdd = (map) => {
      var div = L.DomUtil.create("div", "legend");
      div.innerHTML += "<h4><a href=\"https://www.airnow.gov/aqi/aqi-basics/\" target=\"_blank\">AQI Information<a></h4>";

      aqiLevels.forEach((aqi) => {
        const checkboxContainer = L.DomUtil.create('div', 'flex items-center me-4 legend-checkbox', div);
        const checkbox = L.DomUtil.create('input', 'legend-icon bg-gray-100 border-gray-300 rounded focus:ring-black dark:focus:ring-white dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600', checkboxContainer);
        checkbox.type = 'checkbox';
        checkbox.style.accentColor = aqi.style.color;
        checkbox.style.border = '1px solid black';
        checkbox.checked = true;
        checkbox.value = aqi.styleUrl;
        checkbox.addEventListener('click', () => this.aqiCheckboxClicked(aqi.styleIndex, checkbox.checked));

        const label = L.DomUtil.create('label', 'ms-1 text-sm font-medium text-gray-900 dark:text-gray-300', checkboxContainer);
        label.htmlFor = checkbox.id;
        label.textContent = aqi.name;
      });

      return div;
    };

    this.map.addControl(legend);
  }

  private aqiCheckboxClicked(styleIndex: number, checked: boolean) {
    this.AQILayerStructure.forEach((structure) => {
      if (checked) {
        structure.layerGroup.addLayer(structure.layers[styleIndex]);
      } else {
        structure.layerGroup.removeLayer(structure.layers[styleIndex]);
      }
    });
  }

  private initShapeLegend() {
    var legend = L.control.layers(undefined, undefined, { position: "bottomright" });

    legend.onAdd = (map) => {
      var div = L.DomUtil.create('div', 'legend');

      div.innerHTML += "<h4>Shape Legend</h4>";

      div.innerHTML += '<i style="background-color: #999999; border-radius: 50%; border: 2px solid black"></i><span>Multiple Types</span><br>';
      div.innerHTML += '<i style="background-color: #999999; border: 2px solid black"></i><span>Hiking Only</span><br>';
      div.innerHTML += '<i style="background-color: #999999; rotate: 45deg; border: 2px solid black"></i><span>Camping Only</span><br>';
      div.innerHTML += '<i style="background-color: #999999; border-radius: 50% 0; border: 2px solid black"></i><span>Fishing Only</span><br>';

      return div
    }

    this.map.addControl(legend);
  }

  private styleTrailheadData() {
    this.trailheadData.features.forEach((th: any) => {
      th.properties['todayAQI'] = this.getTodayAQIColor(th.geometry.coordinates);
      th.properties['tomorrowAQI'] = this.getTomorrowAQIColor(th.geometry.coordinates);
    });
  }

  private initTrailheadLayer() {

    this.styleTrailheadData()

    const todayAQILayers: L.Layer[] = [];
    const tomorrowAQILayers: L.Layer[] = [];

    aqiStyleUrls.forEach((style) => {
      todayAQILayers.push(
        L.geoJSON(this.trailheadData, {
          filter: (feature) => {
            return feature.properties.todayAQI.styleUrl === style;
          },
          pointToLayer: (feature, latlng) => {
            const m = CL.squareMarker(latlng, {
              pane: 'CustomMarkerPane',
              radius: 7,
              fillColor: feature.properties.todayAQI.color,
              fillOpacity: 1,
              color: 'black',
              weight: 2,
              opacity: 1
            });
            return m;
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as TrailheadProperties;

            const popupContent = `
            <div class="popup">
              <img src="assets/data/hiker-icon.svg" alt="Hiker Icon">
              <p>${properties.name}</p>
            </div>
            `;

            layer.bindPopup(popupContent);
          }
        })
      );

      tomorrowAQILayers.push(
        L.geoJSON(this.trailheadData, {
          filter: (feature) => {
            return feature.properties.tomorrowAQI.styleUrl === style;
          },
          pointToLayer: (feature, latlng) => {
            const m = CL.squareMarker(latlng, {
              pane: 'CustomMarkerPane',
              radius: 7,
              fillColor: feature.properties.tomorrowAQI.color,
              fillOpacity: 1,
              color: 'black',
              weight: 2,
              opacity: 1
            });
            return m;
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as TrailheadProperties;

            const popupContent = `
            <div class="popup">
              <img src="assets/data/hiker-icon.svg" alt="Hiker Icon">
              <p>${properties.name}</p>
            </div>
            `;

            layer.bindPopup(popupContent);
          }
        })
      );
    });
    const todayTrailheadLayerGroup = L.layerGroup(todayAQILayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: todayTrailheadLayerGroup, layers: todayAQILayers });
    const tomorrowTrailheadLayerGroup = L.layerGroup(tomorrowAQILayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: tomorrowTrailheadLayerGroup, layers: tomorrowAQILayers });
    const trailheadLayer = L.layerGroup([todayTrailheadLayerGroup], { pane: 'LocationPane' });

    let autoToggle = true;

    this.map.on('zoomend', () => {
      if (!autoToggle) {
        return;
      }
      const mapZoom = this.map.getZoom();
      if (mapZoom < END_GROUPING_ZOOM) {
        trailheadLayer.removeFrom(this.map);
      } else {
        trailheadLayer.addTo(this.map);
      }
    });

    trailheadLayer.on('add', () => {
      if (this.map.getZoom() < END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    trailheadLayer.on('remove', () => {
      if (this.map.getZoom() >= END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    this.map.on('baselayerchange', () => {
      if (trailheadLayer.hasLayer(todayTrailheadLayerGroup)) {
        trailheadLayer.clearLayers();
        trailheadLayer.addLayer(tomorrowTrailheadLayerGroup);
      } else {
        trailheadLayer.clearLayers();
        trailheadLayer.addLayer(todayTrailheadLayerGroup);
      }
    });

    this.layerControl.addOverlay(trailheadLayer, 'Trailheads');
  }

  private styleFacilityData() {
    this.facilityData.features.forEach((fac: any) => {
      fac.properties['todayAQI'] = this.getTodayAQIColor(fac.geometry.coordinates);
      fac.properties['tomorrowAQI'] = this.getTomorrowAQIColor(fac.geometry.coordinates);
    });
  }

  private initFacilityLayer() {
    this.styleFacilityData();
    this.initCampingLayer();
    this.initFishingLayer();
  }

  private initFishingLayer() {
    const fishingFacilities = ['Boat Ramp', 'Boating', 'Fishing', 'Fishing - ADA Accessible', 'Marina'];

    const todayAQILayers: L.Layer[] = [];
    const tomorrowAQILayers: L.Layer[] = [];

    aqiStyleUrls.forEach((style) => {
      todayAQILayers.push(
        L.geoJSON(this.facilityData, {
          filter: (feature) => {
            return fishingFacilities.includes((feature.properties as FacilityProperties).d_FAC_TYPE) && feature.properties.todayAQI.styleUrl === style;
          },
          pointToLayer: (feature, latlng) => {
            const m = CL.lemonMarker(latlng, {
              pane: 'CustomMarkerPane',
              radius: 7,
              fillColor: feature.properties.todayAQI.color,
              fillOpacity: 1,
              color: 'black',
              weight: 2,
              opacity: 1
            });
            return m;
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as FacilityProperties;

            const popupContent = `
            <div class="popup">
              <img src="assets/data/fishing-rod-icon.svg" alt="Fishing Rod Icon">
              <p>${properties.FAC_NAME}</p>
            </div>
            `;

            layer.bindPopup(popupContent);
          }
        })
      );

      tomorrowAQILayers.push(
        L.geoJSON(this.facilityData, {
          filter: (feature) => {
            return fishingFacilities.includes((feature.properties as FacilityProperties).d_FAC_TYPE) && feature.properties.tomorrowAQI.styleUrl === style;
          },
          pointToLayer: (feature, latlng) => {
            const m = CL.lemonMarker(latlng, {
              pane: 'CustomMarkerPane',
              radius: 7,
              fillColor: feature.properties.tomorrowAQI.color,
              fillOpacity: 1,
              color: 'black',
              weight: 2,
              opacity: 1
            });
            return m;
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as FacilityProperties;

            const popupContent = `
            <div class="popup">
              <img src="assets/data/fishing-rod-icon.svg" alt="Fishing Rod Icon">
              <p>${properties.FAC_NAME}</p>
            </div>
            `;

            layer.bindPopup(popupContent);
          }
        })
      );
    });

    const todayFishingLayerGroup = L.layerGroup(todayAQILayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: todayFishingLayerGroup, layers: todayAQILayers });
    const tomorrowFishingLayerGroup = L.layerGroup(tomorrowAQILayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: tomorrowFishingLayerGroup, layers: tomorrowAQILayers });
    const fishingLayer = L.layerGroup([todayFishingLayerGroup], { pane: 'LocationPane' });

    this.layerControl.addOverlay(fishingLayer, "Fishing Facilities");

    let autoToggle = true;

    this.map.on('zoomend', () => {
      if (!autoToggle) {
        return;
      }
      if (this.map.getZoom() < END_GROUPING_ZOOM) {
        this.map.removeLayer(fishingLayer);
      } else {
        this.map.addLayer(fishingLayer);
      }
    });

    fishingLayer.on('add', () => {
      if (this.map.getZoom() < END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    fishingLayer.on('remove', () => {
      if (this.map.getZoom() >= END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    this.map.on('baselayerchange', () => {
      if (fishingLayer.hasLayer(todayFishingLayerGroup)) {
        fishingLayer.clearLayers();
        fishingLayer.addLayer(tomorrowFishingLayerGroup);
      } else {
        fishingLayer.clearLayers();
        fishingLayer.addLayer(todayFishingLayerGroup);
      }
    });
  }

  private initCampingLayer() {
    const campingFacilities = ['Cabin', 'Campground', 'Campsite', 'Group Campground', 'RV Campground, Yurt'];

    const todayAQILayers: L.Layer[] = [];
    const tomorrowAQILayers: L.Layer[] = [];

    aqiStyleUrls.forEach((style) => {
      todayAQILayers.push(
        L.geoJSON(this.facilityData, {
          filter: (feature) => {
            return campingFacilities.includes((feature.properties as FacilityProperties).d_FAC_TYPE) && feature.properties.todayAQI.styleUrl === style;
          },
          pointToLayer: (feature, latlng) => {
            const m = CL.diamondMarker(latlng, {
              pane: 'CustomMarkerPane',
              radius: 7,
              fillColor: feature.properties.todayAQI.color,
              fillOpacity: 1,
              color: 'black',
              weight: 2,
              opacity: 1
            });
            return m;
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as FacilityProperties;

            const popupContent = `
            <div class="popup">
              <img src="assets/data/tent-icon.svg" alt="Tent Icon">
              <p>${properties.FAC_NAME}</p>
            </div>
            `;

            layer.bindPopup(popupContent);
          }
        })
      );

      tomorrowAQILayers.push(
        L.geoJSON(this.facilityData, {
          filter: (feature) => {
            return campingFacilities.includes((feature.properties as FacilityProperties).d_FAC_TYPE) && feature.properties.tomorrowAQI.styleUrl === style;
          },
          pointToLayer: (feature, latlng) => {
            const m = CL.diamondMarker(latlng, {
              pane: 'CustomMarkerPane',
              radius: 7,
              fillColor: feature.properties.tomorrowAQI.color,
              fillOpacity: 1,
              color: 'black',
              weight: 2,
              opacity: 1
            });
            return m;
          },
          onEachFeature: (feature, layer) => {
            const properties = feature.properties as FacilityProperties;

            const popupContent = `
            <div class="popup">
              <img src="assets/data/tent-icon.svg" alt="Tent Icon">
              <p>${properties.FAC_NAME}</p>
            </div>
            `;

            layer.bindPopup(popupContent);
          }
        })
      );
    });

    const todayCampingLayerGroup = L.layerGroup(todayAQILayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: todayCampingLayerGroup, layers: todayAQILayers });
    const tomorrowCampingLayerGroup = L.layerGroup(tomorrowAQILayers, { pane: 'LocationPane' });
    this.AQILayerStructure.push({ layerGroup: tomorrowCampingLayerGroup, layers: tomorrowAQILayers });
    const campingLayer = L.layerGroup([todayCampingLayerGroup], { pane: 'LocationPane' });

    this.layerControl.addOverlay(campingLayer, "Camping Facilities");

    let autoToggle = true;

    this.map.on('zoomend', () => {
      if (!autoToggle) {
        return;
      }
      if (this.map.getZoom() < END_GROUPING_ZOOM) {
        this.map.removeLayer(campingLayer);
      } else {
        this.map.addLayer(campingLayer);
      }
    });

    campingLayer.on('add', () => {
      if (this.map.getZoom() < END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    campingLayer.on('remove', () => {
      if (this.map.getZoom() >= END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    this.map.on('baselayerchange', () => {
      if (campingLayer.hasLayer(todayCampingLayerGroup)) {
        campingLayer.clearLayers();
        campingLayer.addLayer(tomorrowCampingLayerGroup);
      } else {
        campingLayer.clearLayers();
        campingLayer.addLayer(todayCampingLayerGroup);
      }
    });
  }

  private initCentroidLayer() {
    const trailheadCoordinates = this.trailheadData.features.map((feature: any) => feature.geometry.coordinates);

    const fishingFacilities = ['Boat Ramp', 'Boating', 'Fishing', 'Fishing - ADA Accessible', 'Marina'];
    const campingFacilities = ['Cabin', 'Campground', 'Campsite', 'Group Campground', 'RV Campground, Yurt'];

    const fishingCoordinates = (this.facilityData.features as Facility[]).reduce((filtered, fac) => {
      if (fishingFacilities.includes(fac.properties.d_FAC_TYPE)) {
        filtered.push(fac.geometry.coordinates);
      }
      return filtered;
    }, [] as [number, number][]);

    const campingCoordinates = (this.facilityData.features as Facility[]).reduce((filtered, fac) => {
      if (campingFacilities.includes(fac.properties.d_FAC_TYPE)) {
        filtered.push(fac.geometry.coordinates);
      }
      return filtered;
    }, [] as [number, number][]);

    const trailheadEndIdx = trailheadCoordinates.length - 1;
    const campingStartIdx = trailheadEndIdx + 1;
    const campingEndIdx = campingStartIdx + campingCoordinates.length - 1;

    const centroidKCounts = [25, 50, 150, 250, 400];
    const todayCentroidLayers: L.Layer[] = [];
    const tomorrowCentroidLayers: L.Layer[] = [];

    for (const k of centroidKCounts) {
      const centroidPoints = skmeans([...trailheadCoordinates, ...fishingCoordinates, ...campingCoordinates], k, 'kmpp');

      const points = Array(k);

      for (let i = 0; i < k; i++) {
        const coordinates = centroidPoints.centroids[i];
        points[i] = {
          count: 0,
          trailhead: false,
          camping: false,
          fishing: false,
          todayAQI: this.getTodayAQIColor(coordinates),
          tomorrowAQI: this.getTomorrowAQIColor(coordinates)
        };
      };

      centroidPoints.idxs.forEach((idx, i) => {
        if (i <= trailheadEndIdx) {
          points[idx].trailhead = true;
        } else if (i <= campingEndIdx) {
          points[idx].camping = true;

        } else {
          points[idx].fishing = true;
        }
        points[idx].count += 1;
      });

      const todayFeatureList = Array(k);

      for (let i = 0; i < k; i++) {
        todayFeatureList[i] = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: centroidPoints.centroids[i]
          },
          properties: points[i]
        }
      }

      const todayCentroidGeoJSON = {
        type: 'FeatureCollection',
        features: todayFeatureList
      };

      const tomorrowFeatureList = Array(k);

      for (let i = 0; i < k; i++) {
        tomorrowFeatureList[i] = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: centroidPoints.centroids[i]
          },
          properties: points[i]
        }
      }

      const tomorrowCentroidGeoJSON = {
        type: 'FeatureCollection',
        features: tomorrowFeatureList
      };

      const todayKCentroidLayers: L.Layer[] = [];
      const tomorrowKCentroidLayers: L.Layer[] = [];

      aqiStyleUrls.forEach((style) => {
        const todayCentroidLayer = L.geoJSON(todayCentroidGeoJSON as any, {
          filter: (feature) => {
            return feature.properties.todayAQI.styleUrl === style
          },
          pointToLayer(feature, latlng) {
            const popupContent = `
            <div class="grid grid-cols-3 gap-2 w-[90px] h-[30px]">
              <img src="assets/data/hiker-${feature.properties.trailhead ? 'green' : 'red'}.svg" alt="Hiker Icon">
              <img src="assets/data/tent-${feature.properties.camping ? 'green' : 'red'}.svg" alt="Tent Icon">
              <img src="assets/data/fishing-rod-${feature.properties.fishing ? 'green' : 'red'}.svg" alt="Fishing Icon">
            </div>
            `;
            let centroidShape = '';
            if ((feature.properties.trailhead && feature.properties.camping) || (feature.properties.trailhead && feature.properties.fishing) || (feature.properties.fishing && feature.properties.camping)) {
              centroidShape = 'Multiple';
            } else if (feature.properties.trailhead) {
              centroidShape = 'Trailhead';
            } else if (feature.properties.camping) {
              centroidShape = 'Camping';
            } else {
              centroidShape = 'Fishing';
            }
            const m = L.marker(latlng, {
              pane: 'CentroidMarkerPane',
              icon: createCustomIcon(feature.properties.count, feature.properties.todayAQI.color, centroidShape)
            }).bindPopup(popupContent);
            return m;
          }
        });

        todayKCentroidLayers.push(todayCentroidLayer);

        const tomorrowCentroidLayer = L.geoJSON(tomorrowCentroidGeoJSON as any, {
          filter: (feature) => {
            return feature.properties.tomorrowAQI.styleUrl === style
          },
          pointToLayer(feature, latlng) {
            const popupContent = `
            <div class="grid grid-cols-3 gap-2 w-[90px] h-[30px]">
              <img src="assets/data/hiker-${feature.properties.trailhead ? 'green' : 'red'}.svg" alt="Hiker Icon">
              <img src="assets/data/tent-${feature.properties.camping ? 'green' : 'red'}.svg" alt="Tent Icon">
              <img src="assets/data/fishing-rod-${feature.properties.fishing ? 'green' : 'red'}.svg" alt="Fishing Icon">
            </div>
            `;
            let centroidShape = '';
            if ((feature.properties.trailhead && feature.properties.camping) || (feature.properties.trailhead && feature.properties.fishing) || (feature.properties.fishing && feature.properties.camping)) {
              centroidShape = 'Multiple';
            } else if (feature.properties.trailhead) {
              centroidShape = 'Trailhead';
            } else if (feature.properties.camping) {
              centroidShape = 'Camping';
            } else {
              centroidShape = 'Fishing';
            }
            const m = L.marker(latlng, {
              pane: 'CentroidMarkerPane',
              icon: createCustomIcon(feature.properties.count, feature.properties.tomorrowAQI.color, centroidShape)
            }).bindPopup(popupContent);
            return m;
          }
        });

        tomorrowKCentroidLayers.push(tomorrowCentroidLayer);
      });

      const todayKLayerGroup = L.layerGroup(todayKCentroidLayers, { pane: 'LocationPane' });
      this.AQILayerStructure.push({ layerGroup: todayKLayerGroup, layers: todayKCentroidLayers });
      const tomorrowKLayerGroup = L.layerGroup(tomorrowKCentroidLayers, { pane: 'LocationPane' });
      this.AQILayerStructure.push({ layerGroup: tomorrowKLayerGroup, layers: tomorrowKCentroidLayers });

      todayCentroidLayers.push(todayKLayerGroup);
      tomorrowCentroidLayers.push(tomorrowKLayerGroup);
    }

    const zoomStart = END_GROUPING_ZOOM - 5;

    const todayCentroidGroup = L.layerGroup([todayCentroidLayers[0]], { pane: 'LocationPane' });
    const tomorrowCentroidGroup = L.layerGroup([tomorrowCentroidLayers[0]], { pane: 'LocationPane' });

    const centroidGroup = L.layerGroup([todayCentroidGroup], { pane: 'LocationPane' })

    this.map.on('zoomend', () => {
      if (this.map.getZoom() <= zoomStart) {
        todayCentroidGroup.clearLayers();
        todayCentroidGroup.addLayer(todayCentroidLayers[0]);
        tomorrowCentroidGroup.clearLayers();
        tomorrowCentroidGroup.addLayer(tomorrowCentroidLayers[0]);
      }
      if (this.map.getZoom() >= END_GROUPING_ZOOM) {
        todayCentroidGroup.clearLayers();
        tomorrowCentroidGroup.clearLayers();
      }
    })

    for (let i = zoomStart + 1; i < END_GROUPING_ZOOM; i++) {
      this.map.on('zoomend', () => {
        if (this.map.getZoom() == i) {
          todayCentroidGroup.clearLayers();
          todayCentroidGroup.addLayer(todayCentroidLayers[i - zoomStart]);
          tomorrowCentroidGroup.clearLayers();
          tomorrowCentroidGroup.addLayer(tomorrowCentroidLayers[i - zoomStart]);
        }
      });
    }

    this.map.on('baselayerchange', () => {
      if (centroidGroup.hasLayer(todayCentroidGroup)) {
        centroidGroup.clearLayers();
        centroidGroup.addLayer(tomorrowCentroidGroup);
      } else {
        centroidGroup.clearLayers();
        centroidGroup.addLayer(todayCentroidGroup);
      }
    });

    this.map.addLayer(centroidGroup);

    this.layerControl.addOverlay(centroidGroup, 'Grouping Markers');
  }

  private getTodayAQIColor(coordinates: [number, number]) {
    for (let feature of this.todayColoradoAqiData.features) {
      const originalPolygon = feature.geometry;
      if (turf.booleanIntersects(originalPolygon, turf.point(coordinates))) {
        return {
          color: this._styleService.getStyleForAQI(feature.properties.styleUrl).color + '88',
          styleUrl: feature.properties.styleUrl
        };
      }
    }
    return {
      color: 'black',
      styleUrl: 'N/A'
    };
  }

  private getTomorrowAQIColor(coordinates: [number, number]) {
    for (let feature of this.tomorrowColoradoAqiData.features) {
      const originalPolygon = feature.geometry;
      if (turf.booleanIntersects(originalPolygon, turf.point(coordinates))) {
        return {
          color: this._styleService.getStyleForAQI(feature.properties.styleUrl).color + '88',
          styleUrl: feature.properties.styleUrl
        };
      }
    }
    return {
      color: 'black',
      styleUrl: 'N/A'
    };
  }

  private getClusterColor(latlng: L.LatLng): string {
    if (this.tomorrowAqiLayer && this.map.hasLayer(this.tomorrowAqiLayer)) {
      for (let feature of this.tomorrowColoradoAqiData.features) {
        const originalPolygon = feature.geometry;
        if (turf.booleanIntersects(originalPolygon, turf.point([latlng.lng, latlng.lat, 0.0]))) {
          return this._styleService.getStyleForAQI(feature.properties.styleUrl).color + '88';
        }
      }

    } else {
      for (let feature of this.todayColoradoAqiData.features) {
        const originalPolygon = feature.geometry;
        if (turf.booleanIntersects(originalPolygon, turf.point([latlng.lng, latlng.lat, 0.0]))) {
          return this._styleService.getStyleForAQI(feature.properties.styleUrl).color + '88';
        }
      }
    }
    return 'black';
  }

  private recommendTrails(selectedTrail: Trail) {
    //TODO: Trail recommendation tech
    const geometry = turf.multiLineString(selectedTrail.geometry.coordinates);
    const shenandoahDifficulty = getTrailShenandoahDifficulty(selectedTrail.properties);
  }

  ngAfterViewInit(): void {
    this.initMap();
    forkJoin({
      todayAqiData: this._shapeService.getTodayAQIShapes(),
      tomorrowAqiData: this._shapeService.getTomorrowAQIShapes(),
      trailheadData: this._shapeService.getTrailheadShapes(),
      facilityData: this._shapeService.getFacilityShapes(),
      trails: this._shapeService.getCotrexShapes()
    }).subscribe({
      next: ({ todayAqiData, tomorrowAqiData, trailheadData, facilityData, trails }) => {
        this.todayAqiData = todayAqiData;
        this.tomorrowAqiData = tomorrowAqiData;
        this.trailheadData = trailheadData;
        this.facilityData = facilityData;
        this.trails = trails;

        this.initTodayAQILayer();
        this.initTomorrowAQILayer();
        this.initTrailsLayer(false);
        this.initTrailheadLayer();
        this.initFacilityLayer();
        this.initCentroidLayer();
        this.initAQILegend();
        this.initShapeLegend();
        this.initLocationSelector();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    //Fires when a trailhead (or anything from the sidebar) is selected
    if (changes['trailheadSelected'] && changes['trailheadSelected'].currentValue) {
      const coordinates = changes['trailheadSelected'].currentValue;
      this.map.setView([coordinates[1], coordinates[0]], END_GROUPING_ZOOM);
      this.selectedLocationMarker.setLatLng([coordinates[1], coordinates[0]]);
      this.selectedLocationMarker.addTo(this.map);
    }
  }
}

function createCustomIcon(count: number, color: string, shape: string) {
  const iconSize = 30;
  const iconAnchor = iconSize / 2.0;
  if (shape === 'Multiple') {
    //Circle
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; border-radius: 50%; height: ${iconSize}px; width: ${iconSize}px">
                  <p class="centroid-text">${count}</p></div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  } else if (shape === 'Trailhead') {
    //Square
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; height: ${iconSize}px; width: ${iconSize}px">
                  <p class="centroid-text">${count}</p></div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  } else if (shape === 'Camping') {
    //Diamond
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; rotate: 45deg; height: ${iconSize}px; width: ${iconSize}px">
                  <p class="centroid-text" style="rotate: -45deg">${count}</p></div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  } else {
    //Lemon
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; border-radius: 50% 0; height: ${iconSize}px; width: ${iconSize}px">
                  <p class="centroid-text">${count}</p></div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  }
}

/*
  Calculated based on https://www.pigeonforge.com/hike-difficulty/#:~:text=Petzoldt%20recommended%20adding%20two%20energy,formulas%20for%20calculating%20trail%20difficulty.
*/
function getTrailEnergyMiles(trail: TrailProperties): number {
  return trail.length_mi_ + (metersToFt(trail.max_elevat - trail.min_elevat)) / 500;
}

function getTrailShenandoahDifficulty(trail: TrailProperties): number {
  return Math.sqrt((metersToFt(trail.max_elevat - trail.min_elevat) * 2) * trail.length_mi_);
}

function metersToFt(m: number): number {
  return m * 3.280839895;
}

function checkForEmpty(value: string): string {
  return value === '' ? 'N/A' : value;
}