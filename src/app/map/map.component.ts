import { Component, AfterViewInit, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';

import * as L from 'leaflet';
import * as turf from '@turf/turf';
import 'skmeans';

import { ShapeService } from '../shape.service';
import { GeoStylingService } from '../geo-styling.service';
import skmeans from 'skmeans';
import { forkJoin } from 'rxjs';
import { Facility, FacilityProperties, TrailheadProperties } from '../geojson-typing';

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

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit, OnChanges {
  private map!: L.Map;
  private trails: any;
  private todayAqiData: any;
  private todayColoradoAqiData: any
  private tomorrowAqiData: any;
  private tomorrowColoradoAqiData: any
  private tomorrowAqiLayer!: L.GeoJSON;
  private trailheadData: any;
  private trailheadCoordinates: any;
  private facilityData: any;
  private fishingCoordinates: any;
  private campingCoordinates: any;
  private facilityCoordinates: any;

  private aqiPane!: HTMLElement;
  private trailPane!: HTMLElement;
  private locationPane!: HTMLElement;
  private customMarkerPane!: HTMLElement;
  private layerControl!: L.Control.Layers;
  private selectedLocationMarker!: L.Marker

  @Input() trailheadSelected: [number, number] = [0, 0];
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();

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
    this.layerControl = L.control.layers();
    this.layerControl.addTo(this.map);

    this.selectedLocationMarker = L.marker([39, -105.7821]);
  }

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService) { }

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

    this.map.on('moveend', () => {
      this.mapBoundsChange.emit(this.map.getBounds());
    });

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
      pane: 'AQIPane',
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl)),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(feature.properties.description);
      }
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
      pane: 'AQIPane',
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl)),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(feature.properties.description);
      }
    });

    this.layerControl.addBaseLayer(this.tomorrowAqiLayer, "Tomorrow's AQI Levels");
  }

  private initAQILegend() {
    var legend = L.control.layers(undefined, undefined, { position: "bottomleft" });

    const aqiLevels = [
      {
        styleUrl: '#Good',
        name: 'Good',
        style: {} as any
      },
      {
        styleUrl: '#Moderate',
        name: 'Moderate',
        style: {} as any
      },
      {
        styleUrl: '#UnhealthySG',
        name: 'Unhealthy for Sensitive Groups',
        style: {} as any
      },
      {
        styleUrl: '#Unhealthy',
        name: 'Unhealthy',
        style: {} as any
      },
      {
        styleUrl: '#VeryUnhealthy',
        name: 'Very Unhealthy',
        style: {} as any
      },
      {
        styleUrl: '#Hazardous',
        name: 'Hazardous',
        style: {} as any
      }
    ];

    aqiLevels.forEach((aqi) => {
      aqi.style = this._styleService.getStyleForAQI(aqi.styleUrl);
    });

    legend.onAdd = function (map) {
      var div = L.DomUtil.create("div", "legend");
      div.innerHTML += "<h4><a href=\"https://www.airnow.gov/aqi/aqi-basics/\" target=\"_blank\">AQI Levels<a></h4>";

      aqiLevels.forEach((aqi) => {
        div.innerHTML += `<i style="background: ${aqi.style.color + 'dd'}"></i><span>${aqi.name}</span><br>`
      })

      return div;
    };

    this.map.addControl(legend);
  }

  private initTrailheadLayer() {
    const markers: L.Marker[] = [];

    const trailheadLayer = L.geoJSON(this.trailheadData, {
      pointToLayer: (feature, latlng) => {
        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane'
        });
        markers.push(m);
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
      },
    });


    this.map.on('zoomend', () => {
      const mapZoom = this.map.getZoom();
      if (mapZoom < 13) {
        trailheadLayer.removeFrom(this.map);
      } else {
        trailheadLayer.addTo(this.map);
      }
    });

    this.map.on('baselayerchange', () => {
      markers.forEach((marker) => {
        marker.options.icon = createCustomIcon(-1, this.getClusterColor(marker.getLatLng()), 'Trailhead');
      });
    });

    markers.forEach((marker) => {
      marker.options.icon = createCustomIcon(-1, this.getClusterColor(marker.getLatLng()), 'Trailhead');
    });

    this.layerControl.addOverlay(trailheadLayer, 'Trailheads');
  }

  private initFacilityLayer() {

    const fishingMarkers: L.Marker[] = [];
    const campingMarkers: L.Marker[] = [];
    const fishingFacilities = ['Boat Ramp', 'Boating', 'Fishing', 'Fishing - ADA Accessible', 'Marina'];
    const campingFacilities = ['Cabin', 'Campground', 'Campsite', 'Group Campground', 'RV Campground, Yurt'];

    const fishingLayer = L.geoJSON(this.facilityData, {
      pane: 'LocationPane',
      filter: (feature) => {
        return feature.properties && fishingFacilities.includes((feature.properties as FacilityProperties).d_FAC_TYPE);
      },
      pointToLayer: (feature, latlng) => {
        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane'
        });
        fishingMarkers.push(m);
        return m
      },
      onEachFeature: (feature, layer) => {
        const properties = feature.properties;

        const popupContent = `
        <div class="popup">
          <img src="assets/data/fishing-rod-icon.svg" alt="Fishing Rod Icon">
          <p>${properties.FAC_NAME}</p>
        </div>
        `;

        layer.bindPopup(popupContent);
      },
    });

    const campingLayer = L.geoJSON(this.facilityData, {
      pane: 'LocationPane',
      filter: (feature) => {
        return feature.properties && campingFacilities.includes((feature.properties as FacilityProperties).d_FAC_TYPE);
      },
      pointToLayer: (feature, latlng) => {
        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane'
        });
        campingMarkers.push(m);
        return m
      },
      onEachFeature: (feature, layer) => {
        const properties = feature.properties;

        const popupContent = `
        <div class="popup">
          <img src="assets/data/tent-icon.svg" alt="Tent Icon">
          <p>${properties.FAC_NAME}</p>
        </div>
        `;

        layer.bindPopup(popupContent);
      },
    });

    this.layerControl.addOverlay(fishingLayer, "Fishing Facilities");
    this.layerControl.addOverlay(campingLayer, "Camping Facilities");

    this.map.on('zoomend', () => {
      if (this.map.getZoom() < 13) {
        this.map.removeLayer(fishingLayer);
        this.map.removeLayer(campingLayer);
      } else {
        this.map.addLayer(fishingLayer);
        this.map.addLayer(campingLayer);
      }
    });

    this.map.on('baselayerchange', () => {
      campingMarkers.forEach((marker) => {
        marker.options.icon = createCustomIcon(-1, this.getClusterColor(marker.getLatLng()), 'Camping')
      });

      if (this.map.hasLayer(campingLayer)) {
        campingLayer.removeFrom(this.map);
        campingLayer.addTo(this.map);
      }
  
      fishingMarkers.forEach((marker) => {
        marker.options.icon = createCustomIcon(-1, this.getClusterColor(marker.getLatLng()), 'Fishing')
      });

      if (this.map.hasLayer(fishingLayer)) {
        fishingLayer.removeFrom(this.map);
        fishingLayer.addTo(this.map);
      }
    });

    campingMarkers.forEach((marker) => {
      marker.options.icon = createCustomIcon(-1, this.getClusterColor(marker.getLatLng()), 'Camping')
    });

    fishingMarkers.forEach((marker) => {
      marker.options.icon = createCustomIcon(-1, this.getClusterColor(marker.getLatLng()), 'Fishing')
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

    const centroidKCounts = [25, 50, 100, 200, 300];
    const centroidLayers: L.GeoJSON[] = [];
    const centroidCounts: number[] = [];
    const centroidShapes: string[] = [];
    const markers = [] as L.Marker[];

    for (const k of centroidKCounts) {
      const centroidPoints = skmeans([...trailheadCoordinates, ...fishingCoordinates, ...campingCoordinates], k, 'kmpp');

      console.log(centroidPoints);

      const points = Array(k);

      for (let i = 0; i < k; i++) {
        points[i] = {
          count: 0,
          trailhead: false,
          camping: false,
          fishing: false
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

      const featureList = Array(k);

      for (let i = 0; i < k; i++) {
        featureList[i] = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: centroidPoints.centroids[i]
          },
          properties: points[i]
        }
      }

      const centroidGeoJSON = {
        type: 'FeatureCollection',
        features: featureList
      };

      const centroidLayer = L.geoJSON(centroidGeoJSON as any, {
        pointToLayer(feature, latlng) {
          //TODO: Mark the popup with red or green icons showing which things are in the cluster
          const popupContent = `<p>${feature.properties.count} locations in this area</p>`;

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

      centroidLayers.push(centroidLayer);

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

    // this.map.on('baselayerchange', () => {
    //   markers.forEach((marker, i) => {
    //     marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), centroidShapes[i])
    //   });

    //   if (this.map.hasLayer(centroidGroup)) {
    //     centroidGroup.removeFrom(this.map);
    //     this.map.addLayer(centroidGroup);
    //   }
    // });

    markers.forEach((marker, i) => {
      marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), centroidShapes[i])
    });

    this.map.addLayer(centroidGroup);
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
    this._shapeService.getCotrexShapes().subscribe(trails => {
      this.trails = trails;
      this.initTrailsLayer(false);
    });
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
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trailheadSelected'] && changes['trailheadSelected'].currentValue) {
      console.log(changes['trailheadSelected'].currentValue);
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
