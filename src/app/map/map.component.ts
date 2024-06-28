import { Component, AfterViewInit } from '@angular/core';

import * as L from 'leaflet';
import 'leaflet.markercluster';
import * as turf from '@turf/turf';

import { ShapeService } from '../shape.service';
import { GeoStylingService } from '../geo-styling.service';
import { forkJoin } from 'rxjs';

const iconRetinaUrl = 'assets/marker-icon-2x.png';
const iconUrl = 'assets/marker-icon.png';
const shadowUrl = 'assets/marker-shadow.png';
const iconDefault = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
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
export class MapComponent implements AfterViewInit {
  private map!: L.Map;
  private trails: any;
  private todayAqiData: any;
  private tomorrowAqiData: any;
  private todayAqiActive: boolean = true;
  private trailheadData: any;
  private facilityData: any;

  private aqiPane!: HTMLElement;
  private trailPane!: HTMLElement;
  private locationPane!: HTMLElement;
  private customMarkerPane!: HTMLElement;
  private layerControl!: L.Control.Layers;
  private markerCluster!: L.MarkerClusterGroup;

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService) { }

  private initMap() {
    //Intializes the map to the center of Colorado with a zoom of 8
    this.map = L.map('map', {
      center: [ 39, -105.7821 ],
      zoom: 8,
      //Makes it much less laggy, not sure why
      preferCanvas: true
    });

    //The base map for the background, taken from OSM
    const OpenStreetMap_Mapnik = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | AQI Data Provided by <a href="https://www.airnow.gov/">AirNow.gov</a>'
    });

    //TODO: Reorder so that only the markers are on top of the AQI not the entire AQI 
    this.aqiPane = this.map.createPane('AQIPane');
    this.aqiPane.style.zIndex = '502';

    this.trailPane = this.map.createPane('TrailPane');
    this.trailPane.style.zIndex = '504';

    this.locationPane = this.map.createPane('LocationPane');
    this.locationPane.style.zIndex = '550';

    this.customMarkerPane = this.map.createPane('CustomMarkerPane');
    this.customMarkerPane.style.zIndex = '600';

    const fishingMarkerPane = this.map.createPane('FishingMarkerPane');
    fishingMarkerPane.style.zIndex = '600';

    const campingMarkerPane = this.map.createPane('CampingMarkerPane');
    campingMarkerPane.style.zIndex = '600';

    OpenStreetMap_Mapnik.addTo(this.map);
    this.layerControl = L.control.layers();
    this.layerControl.addTo(this.map);

    this.markerCluster = L.markerClusterGroup({
      iconCreateFunction: (cluster) => {
        let camping = false;
        let fishing = false;
        let hiking = false;
  
        cluster.getAllChildMarkers().forEach((marker) => {
          if (camping && fishing && hiking) {
            return;
          }
          if (marker.options.pane === 'CampingMarkerPane') {
            camping = true;
          } else if (marker.options.pane === 'FishingMarkerPane') {
            fishing = true;
          } else {
            hiking = true;
          }
        });
        const icon = createCustomIcon(cluster.getChildCount(), this.getClusterColor(cluster.getLatLng()), camping && hiking, camping && fishing);
        return icon;
      },
      disableClusteringAtZoom: 13,
        maxClusterRadius: (zoom) => {
          if (zoom <= 10) {
            return 150;
          } else if (zoom <= 12) {
            return 100;
          }
          return 50;
        },
        clusterPane: 'LocationPane'
    });

    this.map.on('baselayerchange', () => {
      this.todayAqiActive = !this.todayAqiActive;
      this.markerCluster.refreshClusters();
    });

    this.markerCluster.addTo(this.map);
  }

  private getClusterColor(latlng: L.LatLng): string {
    if (!this.todayAqiActive) {
      for (let feature of this.tomorrowAqiData.features) {
        const originalPolygon = feature.geometry;

        if (turf.booleanIntersects(originalPolygon, turf.point([latlng.lng, latlng.lat, 0.0]))) {
          return this._styleService.getStyleForAQI(feature.properties.styleUrl).color;
        }
      }
      
    } else {
      for (let feature of this.todayAqiData.features) {
        const originalPolygon = feature.geometry;

        if (turf.booleanIntersects(originalPolygon, turf.point([latlng.lng, latlng.lat, 0.0]))) {
          return this._styleService.getStyleForAQI(feature.properties.styleUrl).color;
        }
      }
    }
    return 'black';
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

    this.layerControl.addOverlay(trailLayer, "Trails");
  }

  private getTrailColor(length_mi_: any): string {
    //TODO: Have more complicated coloring options
    //TODO: Implement the NPS difficult and "Energy Miles" calculation
    if (length_mi_ < 1 ) {
      return '#1eff00';
    } else if (length_mi_ < 3) {
      return '#e5ff00';
    } else if (length_mi_ < 5) {
      return '#ffb300';
    } else {
      return '#ff2f00';
    }
  }

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
    const trailsByName: { [key: string]: any} = {};
    
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
    const aqiLayer = L.geoJSON(this.todayAqiData, {
      pane: 'AQIPane',
      // filter: (feature) => {
      //   const coloradoBBox: [number, number, number, number] = [-109.05919619986199, 36.99275055519555, -102.04212644366443, 41.00198213121131];

      //   const coloradoPoly = turf.bboxPolygon(coloradoBBox);
      //   return turf.booleanIntersects(feature.geometry, coloradoPoly);
      // },
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl)),
      onEachFeature: (feature, layer) => {
        //TODO: Fix popup to accurately display what we want it to
        layer.bindPopup(feature.properties.description);
      }
    });

    this.map.on('zoomend', () => {
      this.markerCluster.refreshClusters();
    });

    aqiLayer.addTo(this.map);

    this.layerControl.addBaseLayer(aqiLayer, "Today's AQI Levels")
  }

  private initTomorrowAQILayer() {
    const aqiLayer = L.geoJSON(this.tomorrowAqiData, {
      pane: 'AQIPane',
      // filter: (feature) => {
      //   const coloradoBBox: [number, number, number, number] = [-109.05919619986199, 36.99275055519555, -102.04212644366443, 41.00198213121131];

      //   const coloradoPoly = turf.bboxPolygon(coloradoBBox);
      //   return turf.booleanIntersects(feature.geometry, coloradoPoly);
      // },
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl)),
      onEachFeature: (feature, layer) => {
        //TODO: Fix popup to accurately display what we want it to
        layer.bindPopup(feature.properties.description);
      }
    });

    this.layerControl.addBaseLayer(aqiLayer, "Tomorrow's AQI Levels");

    this.map.on('zoomend', () => {
      this.markerCluster.refreshClusters();
    });
  }

  private initTrailheadLayer() {
    const markers: L.CircleMarker[] = [];

    const trailheadLayer = L.geoJSON(this.trailheadData, {
      pointToLayer: (feature, latlng) => {
        const m = L.circleMarker(latlng, {
          //Odd, but works fine
          pane: 'AQIPane',
          radius: 8,
          weight: 2,
          color: 'black',
          fillColor: this.getClusterColor(latlng),
          fillOpacity: 1,
          opacity: 1
        });
        markers.push(m);
        return m;
      },
      onEachFeature: (feature, layer) => {
        const properties = feature.properties;

        const name = properties.name;

        const popupContent = `<p>${name}</p>`;

        layer.bindPopup(popupContent);
      },
    });

    trailheadLayer.addTo(this.markerCluster);

    this.map.on("zoomend", () => {
      trailheadLayer.resetStyle();
      markers.forEach((marker) => {
        marker.options.fillColor = this.getClusterColor(marker.getLatLng());
      });
    });

    this.map.on('baselayerchange', () => {
      markers.forEach((marker) => {
        marker.options.fillColor = this.getClusterColor(marker.getLatLng());
      });
    });
  }

private initFacilityLayer() {
  const centroidColor = 'rgba(174, 154, 0, 0.7)';

  const fishingLayer = L.geoJSON(this.facilityData, {
    pane: 'LocationPane',
    filter: (feature) => {
      return feature.properties && this.getFacilityColor(feature.properties.d_FAC_TYPE) === 'blue';
    },
    pointToLayer: (feature, latlng) => {
      const facilityColor = 'rgba(0, 5, 151, 0.7)';

      const imageUrl = 'fishing-rod-icon.svg';

      const divIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="circle-marker" style="background-color: ${facilityColor}"></div><img src="assets/data/${imageUrl}" class="custom-icon">`,
        iconSize: [20, 20]
      });

      return L.marker(latlng, {
        pane: 'FishingMarkerPane',
        icon: divIcon,
      });
    },
    onEachFeature: (feature, layer) => {
      const properties = feature.properties;

      const name = properties.FAC_NAME;

      const popupContent = `<p>${name}</p>`;

      layer.bindPopup(popupContent);
    },
  });

  const campingLayer = L.geoJSON(this.facilityData, {
    pane: 'LocationPane',
    filter: (feature) => {
      return feature.properties && this.getFacilityColor(feature.properties.d_FAC_TYPE) === 'green';
    },
    pointToLayer: (feature, latlng) => {
      const facilityColor = 'rgba(2, 162, 0, 0.7)'

      const imageUrl = 'tent-icon.svg';

      const divIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="circle-marker" style="background-color: ${facilityColor}"></div><img src="assets/data/${imageUrl}" class="custom-icon">`,
        iconSize: [20, 20]
      });

      return L.marker(latlng, {
        pane: 'CampingMarkerPane',
        icon: divIcon,
      });
    },
    onEachFeature: (feature, layer) => {
      const properties = feature.properties;

      const name = properties.FAC_NAME;

      const popupContent = `<p>${name}</p>`;

      layer.bindPopup(popupContent);
    },
  });

  campingLayer.addTo(this.markerCluster);
  fishingLayer.addTo(this.markerCluster);

  this.layerControl.addOverlay(fishingLayer, "Fishing Facilities");
  this.layerControl.addOverlay(campingLayer, "Camping Facilities");
}

getFacilityColor(d_FAC_TYPE: any): string {
  const fishingFacilities = ['Boat Ramp', 'Boating', 'Fishing', 'Fishing - ADA Accessible', 'Marina'];
  const campingFacilities = ['Cabin', 'Campground', 'Campsite', 'Group Campground', 'RV Campground, Yurt'];

  if (fishingFacilities.includes(d_FAC_TYPE)) {
    return 'blue';
  } else if (campingFacilities.includes(d_FAC_TYPE)) {
    return 'green';
  } else {
    return 'orange';
  }
}

ngAfterViewInit(): void {
    this.initMap();
    forkJoin({
      trails: this._shapeService.getCotrexShapes(),
      todayAqiData: this._shapeService.getTodayAQIShapes(),
      tomorrowAqiData: this._shapeService.getTomorrowAQIShapes(),
      trailheadData: this._shapeService.getTrailheadShapes(),
      facilityData: this._shapeService.getFacilityShapes()
    }).subscribe({
      next: ({ trails, todayAqiData, tomorrowAqiData, trailheadData, facilityData }) => {
        this.trails = trails;
        this.todayAqiData = todayAqiData;
        this.tomorrowAqiData = tomorrowAqiData;
        this.trailheadData = trailheadData;
        this.facilityData = facilityData;
    
        // Initialize layers after all data is fetched
        this.initTrailsLayer(false);
        this.initTodayAQILayer();
        this.initTomorrowAQILayer();
        this.initTrailheadLayer();
        this.initFacilityLayer();
      },
      error: err => {
        console.error('Error fetching data', err);
      }
    });
  }
}

function createCustomIcon(count: number, color: string, circle: boolean, diamond: boolean) {
  let shapeRotate;
  let shapeRadius;
  if (circle) {
    shapeRadius = '50%';
  } else {
    shapeRadius = '0%';
  }

  if (diamond) {
    shapeRotate = '45deg';
  } else {
    shapeRotate = '0deg';
  }

  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="trailhead-centroid" style="background-color: ${color + "80"}; border-radius: ${shapeRadius}; rotate: ${shapeRotate}">
    <h1 class="centroid-text" style="rotate: ${'-' + shapeRotate}">${count}</h1></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}
