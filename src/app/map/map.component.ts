import { Component, AfterViewInit, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';

import * as L from 'leaflet';
import * as turf from '@turf/turf';
import 'skmeans';

import { ShapeService } from '../shape.service';
import { GeoStylingService } from '../geo-styling.service';
import skmeans from 'skmeans';
import { forkJoin } from 'rxjs';
import { Facility, FacilityProperties, Trailhead, TrailheadProperties } from '../geojson-typing';
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

const aqiStyleUrls = ["#Unavailable", "#Invisible", "#Good", "#Moderate", "#UnhealthySG", "#Unhealthy", "#VeryUnhealthy", "#Hazardous"];

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
  private mapLayers: { [key: string]: L.Layer } = {};

  @Input() trailheadSelected: [number, number] = [0, 0];
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService) { }

  private initMap() {
    //Intializes the map to the center of Colorado with a zoom of 8
    this.map = L.map('map', {
      center: [39, -105.7821],
      zoom: 8,
      //Makes it much less laggy, not sure why
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

    OpenStreetMap_Mapnik.addTo(this.map);
    this.layerControl = L.control.layers(undefined, undefined, { collapsed: false });
    this.layerControl.addTo(this.map);

    this.selectedLocationMarker = L.marker([39, -105.7821]);

    this.map.on('moveend', () => {
      this.mapBoundsChange.emit(this.map.getBounds());
    });
  }

  private trackLayer(name: string, layer: L.Layer) {
    this.mapLayers[name] = layer;
  }

  private initTrailsLayer(combineByPlaceID: boolean) {
    if (combineByPlaceID) {
      this.trails = this.groupTrails(this.trails);
    }
    const trailLayer = L.geoJSON(this.trails, {
      //Works fine for now
      pane: 'AQIPane',
      style: (feature) => ({
        weight: 4,
        opacity: 0.75,
        color: 'black'
      }),
      filter: (feature) => {
        //TODO: Filter based on more things?
        return feature.properties && feature.properties.name !== '' && feature.properties.length_mi_ > 0;
      },
      onEachFeature: (feature, layer) => {
        //TODO: Fix popup to accurately display what we want it to
        const popupContent =
          `<p>${feature.properties.name}</p>
          <p>${feature.properties.length_mi_}</p>
          <p>Energy Miles: ${this.getTrailEnergyMiles(feature.properties)}</p>
          <p>Shenandoah Difficulty: ${this.getTrailShenandoahDifficulty(feature.properties)}</p>`;
        layer.bindPopup(popupContent);
      }
    });

    this.trackLayer('Trails', trailLayer);

    this.layerControl.addOverlay(trailLayer, "Trails");
  }

  // private getTrailColor(length_mi_: any): string {
  //   if (length_mi_ < 1) {
  //     return '#1eff00';
  //   } else if (length_mi_ < 3) {
  //     return '#e5ff00';
  //   } else if (length_mi_ < 5) {
  //     return '#ffb300';
  //   } else {
  //     return '#ff2f00';
  //   }
  // }

  /*
  Calculated based on https://www.pigeonforge.com/hike-difficulty/#:~:text=Petzoldt%20recommended%20adding%20two%20energy,formulas%20for%20calculating%20trail%20difficulty.
  */
  private getTrailEnergyMiles(trail: any): number {
    return trail.length_mi_ + ((trail.max_elevat - trail.min_elevat) * 3.280839895) / 500;
  }

  private getTrailShenandoahDifficulty(trail: any): number {
    return Math.sqrt(((trail.max_elevat - trail.min_elevat) * 3.280839895 * 2) * trail.length_mi_);
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

    this.trackLayer('TodayAQI', aqiLayer);

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

    this.trackLayer('TomorrowAQI', this.tomorrowAqiLayer);

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
    console.log(styleIndex);
    console.log(checked);
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
    const markers: L.Marker[] = [];

    //TODO: Index in and remove the layers that are deactivated on the checkboxes
    //Possibly store in a this. variable, but I would rather not do that
    const todayAQILayers: L.Layer[] = [];
    const tomorrowAQILayers: L.Layer[] = [];

    aqiStyleUrls.forEach((style) => {
      todayAQILayers.push(
        L.geoJSON(this.trailheadData, {
          filter: (feature) => {
            return feature.properties.todayAQI.styleUrl === style;
          },
          pointToLayer: (feature, latlng) => {
            const m = L.marker(latlng, {
              pane: 'CustomMarkerPane',
              icon: createCustomIcon(-1, feature.properties.todayAQI.color, 'Trailhead')
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
            const m = L.marker(latlng, {
              pane: 'CustomMarkerPane',
              icon: createCustomIcon(-1, feature.properties.tomorrowAQI.color, 'Trailhead')
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

    const todayTrailheadLayerGroup = L.layerGroup(todayAQILayers);
    const tomorrowTrailheadLayerGroup = L.layerGroup(tomorrowAQILayers);
    const trailheadLayer = L.layerGroup([todayTrailheadLayerGroup]);

    this.map.on('zoomend', () => {
      const mapZoom = this.map.getZoom();
      if (mapZoom < 13) {
        trailheadLayer.removeFrom(this.map);
      } else {
        trailheadLayer.addTo(this.map);
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

    markers.forEach((marker) => {
      marker.options.icon = createCustomIcon(-1, this.getClusterColor(marker.getLatLng()), 'Trailhead');
    });

    this.trackLayer('Trailheads', trailheadLayer);

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
            const m = L.marker(latlng, {
              pane: 'CustomMarkerPane',
              icon: createCustomIcon(-1, feature.properties.todayAQI.color, 'Fishing')
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
            const m = L.marker(latlng, {
              pane: 'CustomMarkerPane',
              icon: createCustomIcon(-1, feature.properties.tomorrowAQI.color, 'Fishing')
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

    const todayFishingLayerGroup = L.layerGroup(todayAQILayers);
    const tomorrowFishingLayerGroup = L.layerGroup(tomorrowAQILayers);
    const fishingLayer = L.layerGroup([todayFishingLayerGroup]);

    this.layerControl.addOverlay(fishingLayer, "Fishing Facilities");

    this.map.on('zoomend', () => {
      if (this.map.getZoom() < 13) {
        this.map.removeLayer(fishingLayer);
      } else {
        this.map.addLayer(fishingLayer);
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
            const m = L.marker(latlng, {
              pane: 'CustomMarkerPane',
              icon: createCustomIcon(-1, feature.properties.todayAQI.color, 'Camping')
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
            const m = L.marker(latlng, {
              pane: 'CustomMarkerPane',
              icon: createCustomIcon(-1, feature.properties.tomorrowAQI.color, 'Camping')
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

    const todayCampingLayerGroup = L.layerGroup(todayAQILayers);
    const tomorrowCampingLayerGroup = L.layerGroup(tomorrowAQILayers);
    const campingLayer = L.layerGroup([todayCampingLayerGroup]);

    this.layerControl.addOverlay(campingLayer, "Camping Facilities");

    this.map.on('zoomend', () => {
      if (this.map.getZoom() < 13) {
        this.map.removeLayer(campingLayer);
      } else {
        this.map.addLayer(campingLayer);
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
    const centroidLayers: L.GeoJSON[] = [];
    const centroidCounts: number[] = [];
    const centroidShapes: string[] = [];
    const markers = [] as L.Marker[];

    for (const k of centroidKCounts) {
      const centroidPoints = skmeans([...trailheadCoordinates, ...fishingCoordinates, ...campingCoordinates], k, 'kmpp');

      console.log(centroidPoints);

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

      const todayCentroidLayer = L.geoJSON(todayCentroidGeoJSON as any, {
        pointToLayer(feature, latlng) {
          const popupContent = `
          <div class="grid grid-cols-3 gap-2 w-[90px] h-[30px]">
            <img src="assets/data/hiker-${feature.properties.trailhead ? 'green' : 'red'}.svg" alt="Hiker Icon">
            <img src="assets/data/tent-${feature.properties.camping ? 'green' : 'red'}.svg" alt="Tent Icon">
            <img src="assets/data/fishing-rod-${feature.properties.fishing ? 'green' : 'red'}.svg" alt="Fishing Icon">
          </div>
          `;

          const m = L.marker(latlng, {
            pane: 'CustomMarkerPane',
          }).bindPopup(popupContent);
          markers.push(m);
          centroidCounts.push(feature.properties.count);
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
          centroidShapes.push(centroidShape);
          return m;
        }
      });

      centroidLayers.push(todayCentroidLayer);

    }

    const zoomStart = 8;
    const zoomEnd = 13;

    const centroidGroup = L.layerGroup([centroidLayers[0]]);
    // const centroidGroup = L.layerGroup(centroidLayers);

    this.map.on('zoomend', () => {
      if (this.map.getZoom() <= zoomStart) {
        centroidGroup.clearLayers();
        centroidGroup.addLayer(centroidLayers[0]);
      }
      if (this.map.getZoom() >= zoomEnd) {
        centroidGroup.clearLayers();
      }
    })

    for (let i = zoomStart + 1; i < zoomEnd; i++) {
      this.map.on('zoomend', () => {
        if (this.map.getZoom() == i) {
          centroidGroup.clearLayers();
          centroidGroup.addLayer(centroidLayers[i - zoomStart]);
        }
      });
    }

    this.map.on('baselayerchange', () => {
      markers.forEach((marker, i) => {
        marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), centroidShapes[i])
      });

      if (this.map.hasLayer(centroidGroup)) {
        centroidGroup.removeFrom(this.map);
        this.map.addLayer(centroidGroup);
      }
    });

    markers.forEach((marker, i) => {
      marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), centroidShapes[i])
    });

    this.map.addLayer(centroidGroup);
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

  ngAfterViewInit(): void {
    this.initMap();
    // this._shapeService.getCotrexShapes().subscribe(trails => {
    //   this.trails = trails;
    //   this.initTrailsLayer(false);
    // });
    forkJoin({
      todayAqiData: this._shapeService.getTodayAQIShapes(),
      tomorrowAqiData: this._shapeService.getTomorrowAQIShapes(),
      trailheadData: this._shapeService.getTrailheadShapes(),
      facilityData: this._shapeService.getFacilityShapes()
    }).subscribe({
      next: ({ todayAqiData, tomorrowAqiData, trailheadData, facilityData }) => {
        this.todayAqiData = todayAqiData;
        this.tomorrowAqiData = tomorrowAqiData;
        this.trailheadData = trailheadData;
        this.facilityData = facilityData;

        this.initTodayAQILayer();
        this.initTomorrowAQILayer();
        this.initTrailheadLayer();
        this.initFacilityLayer();
        this.initCentroidLayer();
        this.initAQILegend();
        this.initShapeLegend();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trailheadSelected'] && changes['trailheadSelected'].currentValue) {
      const coordinates = changes['trailheadSelected'].currentValue;
      this.map.setView([coordinates[1], coordinates[0]], 13);
      this.selectedLocationMarker.setLatLng([coordinates[1], coordinates[0]]);
      this.selectedLocationMarker.addTo(this.map);
    }
  }
}

function createCustomIcon(count: number, color: string, shape: string) {
  const iconSize = count == -1 ? 15 : 30;
  const iconAnchor = iconSize / 2.0;
  if (shape === 'Multiple') {
    //Circle
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; border-radius: 50%; height: ${iconSize}px; width: ${iconSize}px">
                  ${count == -1 ? '' : `<p class="centroid-text">${count}</p>`}</div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  } else if (shape === 'Trailhead') {
    //Square
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; height: ${iconSize}px; width: ${iconSize}px">
                  ${count == -1 ? '' : `<p class="centroid-text">${count}</p>`}</div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  } else if (shape === 'Camping') {
    //Diamond
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; rotate: 45deg; height: ${iconSize}px; width: ${iconSize}px">
                  ${count == -1 ? '' : `<p class="centroid-text" style="rotate: -45deg">${count}</p>`}</div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  } else {
    //Lemon
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="trailhead-centroid" style="background-color: ${color}; border-radius: 50% 0; height: ${iconSize}px; width: ${iconSize}px">
                  ${count == -1 ? '' : `<p class="centroid-text">${count}</p>`}</div>`,
      iconAnchor: [iconAnchor, iconAnchor]
    });
  }
}