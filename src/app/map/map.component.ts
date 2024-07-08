import { Component, AfterViewInit, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';

import * as L from 'leaflet';
import * as turf from '@turf/turf';
import 'skmeans';

import { ShapeService } from '../shape.service';
import { GeoStylingService } from '../geo-styling.service';
import skmeans from 'skmeans';
import { forkJoin } from 'rxjs';
import { TrailheadProperties } from '../geojson-typing';

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

    const cetroidColor = 'rgba(186, 0, 0, 0.7)'
    this.trailheadCoordinates = this.trailheadData.features.map((feature: any) => feature.geometry.coordinates);

    const centroidMarkers: L.Marker[] = [];
    const centroidCounts: number[] = [];
    const markers: L.CircleMarker[] = [];

    const trailheadLayer = L.geoJSON(this.trailheadData, {
      pointToLayer: (feature, latlng) => {
        const color = this.getClusterColor(latlng);
        const m = L.circleMarker(latlng, {
          //Odd, but works fine
          pane: 'AQIPane',
          radius: 8,
          weight: 2,
          color: 'black',
          fillColor: color,
          fillOpacity: 1,
          opacity: 1
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

    const k20_Centroids = L.geoJSON(this.generateTrailheadCentroidGeo(20), {
      filter: (feature) => {
        return feature.properties.kmeans == 20;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} trailheads in this area</p>`

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
        }).bindPopup(popupContent);
        centroidMarkers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const k50_Centroids = L.geoJSON(this.generateTrailheadCentroidGeo(50), {
      filter: (feature) => {
        return feature.properties.kmeans == 50;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} trailheads in this area</p>`

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
          icon: createCustomIcon(feature.properties.count, cetroidColor, true)
        }).bindPopup(popupContent);
        centroidMarkers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const k100_Centroids = L.geoJSON(this.generateTrailheadCentroidGeo(100), {
      filter: (feature) => {
        return feature.properties.kmeans == 100;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} trailheads in this area</p>`

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
          icon: createCustomIcon(feature.properties.count, cetroidColor, true)
        }).bindPopup(popupContent);
        centroidMarkers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const k200_Centroids = L.geoJSON(this.generateTrailheadCentroidGeo(200), {
      filter: (feature) => {
        return feature.properties.kmeans == 200;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} trailheads in this area</p>`

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
          icon: createCustomIcon(feature.properties.count, cetroidColor, true)
        }).bindPopup(popupContent);
        centroidMarkers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const k300_Centroids = L.geoJSON(this.generateTrailheadCentroidGeo(300), {
      filter: (feature) => {
        return feature.properties.kmeans == 300;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} trailheads in this area</p>`

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
        }).bindPopup(popupContent);
        centroidMarkers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const layerList = [k20_Centroids, k50_Centroids, k100_Centroids, k200_Centroids, k300_Centroids, trailheadLayer];

    const trailheadLayerGroup = L.layerGroup([k20_Centroids]);

    this.map.on('zoomend', () => {
      const mapZoom = this.map.getZoom();
      if (mapZoom <= 8) {
        layerList.forEach((layer) => trailheadLayerGroup.removeLayer(layer));
        trailheadLayerGroup.addLayer(k20_Centroids);
      } else if (mapZoom <= 9) {
        layerList.forEach((layer) => trailheadLayerGroup.removeLayer(layer));
        trailheadLayerGroup.addLayer(k50_Centroids);
      } else if (mapZoom <= 10) {
        layerList.forEach((layer) => trailheadLayerGroup.removeLayer(layer));
        trailheadLayerGroup.addLayer(k100_Centroids);
      } else if (mapZoom <= 11) {
        layerList.forEach((layer) => trailheadLayerGroup.removeLayer(layer));
        trailheadLayerGroup.addLayer(k200_Centroids);
      } else if (mapZoom <= 12) {
        layerList.forEach((layer) => trailheadLayerGroup.removeLayer(layer));
        trailheadLayerGroup.addLayer(k300_Centroids);
      } else {
        layerList.forEach((layer) => trailheadLayerGroup.removeLayer(layer));
        trailheadLayerGroup.addLayer(trailheadLayer);
      }
    });

    this.map.on('baselayerchange', () => {
      markers.forEach((marker) => {
        marker.options.fillColor = this.getClusterColor(marker.getLatLng());
      });

      centroidMarkers.forEach((marker, i) => {
        marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), true)
      });

      trailheadLayerGroup.removeFrom(this.map);
      this.map.addLayer(trailheadLayerGroup);
    })

    this.layerControl.addOverlay(trailheadLayerGroup, 'Trailheads');

    centroidMarkers.forEach((marker, i) => {
      marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), true)
    });

    trailheadLayerGroup.removeFrom(this.map);
    this.map.addLayer(trailheadLayerGroup);
  }

  private generateTrailheadCentroidGeo(k: number): any {
    const centroidPoints = skmeans(this.trailheadCoordinates, k);

    const counts = Array(k).fill(0);

    centroidPoints.idxs.forEach((i: number) => {
      counts[i] += 1
    });

    const featureList = Array(k);

    for (let i = 0; i < k; i++) {
      featureList[i] = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: centroidPoints.centroids[i]
        },
        properties: {
          'count': counts[i],
          'kmeans': k
        }
      }
    }

    const trailheadGeoJSON = {
      type: 'FeatureCollection',
      features: featureList
    };

    return trailheadGeoJSON;
  }

  private initFacilityLayer() {

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
          pane: 'CustomMarkerPane',
          icon: divIcon,
        });
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
          pane: 'CustomMarkerPane',
          icon: divIcon,
        });
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

    this.facilityCoordinates = this.facilityData.features.map((feature: any) => feature.geometry.coordinates);
    const markers: L.Marker[] = [];
    const centroidCounts: number[] = [];

    const centroid_k20 = L.geoJSON(this.generateFacilityCentroidGeo(20), {
      filter: (feature) => {
        return feature.properties.kmeans == 20;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} facilities in this area</p>`;

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
        }).bindPopup(popupContent);
        markers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const centroid_k50 = L.geoJSON(this.generateFacilityCentroidGeo(50), {
      filter: (feature) => {
        return feature.properties.kmeans == 50;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} facilities in this area</p>`;

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
        }).bindPopup(popupContent);
        markers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const centroid_k200 = L.geoJSON(this.generateFacilityCentroidGeo(200), {
      filter: (feature) => {
        return feature.properties.kmeans == 200;
      },
      pointToLayer(feature, latlng) {
        const popupContent = `<p>${feature.properties.count} facilities in this area</p>`;

        const m = L.marker(latlng, {
          pane: 'CustomMarkerPane',
        }).bindPopup(popupContent);
        markers.push(m);
        centroidCounts.push(feature.properties.count);
        return m;
      },
    });

    const centroid_group = L.layerGroup([centroid_k20]);

    this.layerControl.addOverlay(fishingLayer, "Fishing Facilities");
    this.layerControl.addOverlay(campingLayer, "Camping Facilities");

    this.map.on('zoomend', () => {
      const mapZoom = this.map.getZoom();
      if (mapZoom <= 9) {
        fishingLayer.removeFrom(this.map);
        campingLayer.removeFrom(this.map);
        centroid_k20.addTo(centroid_group);
        centroid_group.removeLayer(centroid_k50);
        centroid_group.removeLayer(centroid_k200);
        centroid_group.addTo(this.map);
      } else if (mapZoom <= 11) {
        centroid_group.removeLayer(centroid_k20);
        centroid_group.removeLayer(centroid_k200);
        centroid_k50.addTo(centroid_group);
        centroid_group.addTo(this.map);
        fishingLayer.removeFrom(this.map);
        campingLayer.removeFrom(this.map);
      } else if (mapZoom <= 12) {
        centroid_group.removeLayer(centroid_k20);
        centroid_group.removeLayer(centroid_k50);
        centroid_k200.addTo(centroid_group);
        centroid_group.addTo(this.map);
        fishingLayer.removeFrom(this.map);
        campingLayer.removeFrom(this.map);
      } else {
        centroid_group.removeFrom(this.map);
        fishingLayer.addTo(this.map);
        campingLayer.addTo(this.map);
      }
    });

    this.map.on('baselayerchange', () => {

      markers.forEach((marker, i) => {
        marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), false)
      });

      if (this.map.hasLayer(centroid_group)) {
        centroid_group.removeFrom(this.map);
        this.map.addLayer(centroid_group);
      }
    });

    markers.forEach((marker, i) => {
      marker.options.icon = createCustomIcon(centroidCounts[i], this.getClusterColor(marker.getLatLng()), false)
    });

    centroid_group.removeFrom(this.map);
    this.map.addLayer(centroid_group);
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

  private generateFacilityCentroidGeo(k: number): any {
    const centroidPoints = skmeans(this.facilityCoordinates, k, "kmpp");

    const counts = Array(k).fill(0);

    centroidPoints.idxs.forEach((i: number) => {
      counts[i] += 1
    });

    const featureList = Array(k);

    for (let i = 0; i < k; i++) {
      featureList[i] = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: centroidPoints.centroids[i]
        },
        properties: {
          'count': counts[i],
          'kmeans': k
        }
      }
    }

    const trailheadGeoJSON = {
      type: 'FeatureCollection',
      features: featureList
    };

    return trailheadGeoJSON;
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

function createCustomIcon(count: number, color: string, trailheads: boolean) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="trailhead-centroid" style="background-color: ${color}; border-radius: ${trailheads ? '50%' : '0'}">
            <p class="centroid-text">${count}</p></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}
