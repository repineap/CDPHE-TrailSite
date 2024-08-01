import { Component, AfterViewInit, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';

import * as L from 'leaflet';
import * as CL from '../custom-leaflet-shapes';
import * as turf from '@turf/turf';
import 'skmeans';

import { ShapeService } from '../shape.service';
import { GeoStylingService } from '../geo-styling.service';
import skmeans from 'skmeans';
import { forkJoin } from 'rxjs';
import { Trail, Trailhead, WeatherAlert } from '../geojson-typing';
import { NgIf } from '@angular/common';
import { PopupService } from '../popup.service';

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

const alertCategories = ["None", "Smoke/Dust", "Ozone/PM", "Multiple"];

interface AlertStructure {
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
  private trailData: any;
  private todayAqiData: any;
  private tomorrowAqiData: any;
  private tomorrowAqiLayer!: L.GeoJSON;
  private trailheadData: any;
  private countyData: any;
  public alertData: any;

  private aqiPane!: HTMLElement;
  private locationPane!: HTMLElement;
  private customMarkerPane!: HTMLElement;
  private layerControl!: L.Control.Layers;
  private userLocationMarker!: L.Marker;

  private alertLayerStructure: AlertStructure[] = [];

  @Input() trailheadSelected!: Trailhead;
  @Output() trailheadSelectedChange = new EventEmitter<Trailhead>();
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService, private _popupService: PopupService) { }

  private initMap() {
    //Intializes the map to the center of Colorado with a zoom of 8
    this.map = L.map('map', {
      center: [39, -105.7821],
      zoom: END_GROUPING_ZOOM - 5,
      preferCanvas: true,
      doubleClickZoom: false
    });

    //The base map for the background, taken from OSM
    const OpenStreetMap_Mapnik = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | AQI Data Provided by <a href="https://www.airnow.gov/">AirNow.gov</a>'
    });

    this.aqiPane = this.map.createPane('AQIPane');
    this.aqiPane.style.zIndex = '504';

    // this.trailPane = this.map.createPane('TrailPane');
    // this.trailPane.style.zIndex = '504';

    this.locationPane = this.map.createPane('LocationPane');
    this.locationPane.style.zIndex = '-10';

    this.customMarkerPane = this.map.createPane('CustomMarkerPane');
    this.customMarkerPane.style.zIndex = '600';

    const centroidPane = this.map.createPane('CentroidMarkerPane');
    centroidPane.style.zIndex = '610';

    const userLocationPane = this.map.createPane('UserLocation');
    userLocationPane.style.zIndex = '620';

    const alertPane = this.map.createPane('NWSAlert');
    alertPane.style.zIndex = '503';

    OpenStreetMap_Mapnik.addTo(this.map);
    const layerOrder = ['Today\'s Aqi Forecast', 'Tomorrow\'s Aqi Forecast', 'Camping Facilities', 'Grouping Markers', 'Trailheads', 'Trails']
    this.layerControl = L.control.layers(undefined, undefined, {
      sortLayers: true,
      sortFunction: (layerA, layerB, nameA, nameB) => {
        return layerOrder.indexOf(nameA) - layerOrder.indexOf(nameB);
      },
    });
    this.layerControl.addTo(this.map);

    // this.selectedLocationMarker = CL.marker6Points([39, -105.7821], {
    //   radius: 15,
    //   pane: 'TrailPane',
    //   color: 'blue',
    //   weight: 4,
    //   opacity: 1,
    //   fillColor: 'gray',
    //   fillOpacity: 0.5,
    // });

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

  private initTrailsLayer(combineByPlaceID: boolean) {
    if (combineByPlaceID) {
      this.trailData = this.groupTrails(this.trailData);
    }

    const trailLayer = L.geoJSON(this.trailData, {
      filter: (feature) => {
        return feature.properties && feature.properties.name !== '' && feature.properties.type !== 'Road';
      },
      pane: 'CustomMarkerPane',
      style: (feature) => ({
        weight: 6,
        opacity: 0.75,
        color: 'black'
      }),
      onEachFeature: (feature, layer) => {
        const popupContent = this._popupService.createTrailPopup(feature as Trail, )
        layer.bindPopup(popupContent, {
          className: 'rounded shadow-lg alert-card',
          minWidth: 175
        });
      }
    });

    const activateTrailsLegend = L.control.layers(undefined, undefined, { position: "topright" });

    activateTrailsLegend.onAdd = (map) => {
      var div = L.DomUtil.create("div", "trail-legend legend flex");

      const checkboxContainer = L.DomUtil.create('div', 'flex items-center me-4 legend-checkbox', div);
      const checkbox = L.DomUtil.create('input', 'legend-icon bg-gray-100 border-gray-300 rounded focus:ring-black dark:focus:ring-white dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600', checkboxContainer);
      checkbox.type = 'checkbox';
      checkbox.style.accentColor = 'black'
      checkbox.style.border = '1px solid black';
      checkbox.checked = false;
      checkbox.value = 'trailsActivated';
      checkbox.id = 'trail-checkbox'
      checkbox.addEventListener('click', () => {
        if (checkbox.checked) {
          this.map.addLayer(trailLayer);
        } else {
          this.map.removeLayer(trailLayer);
        }
      });
  
      const label = L.DomUtil.create('label', 'ms-1 text-base text-center font-bold text-gray-700 dark:text-gray-300 align-center', checkboxContainer);
      label.htmlFor = checkbox.id;
      label.textContent = 'View Trails';

      return div;
    }

    activateTrailsLegend.addTo(this.map);
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
    const aqiLayer = L.geoJSON(this.todayAqiData, {
      interactive: false,
      pane: 'AQIPane',
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl))
    });


    this.layerControl.addOverlay(aqiLayer, "Today's AQI Forecast");
  }

  private initTomorrowAQILayer() {
    this.tomorrowAqiLayer = L.geoJSON(this.tomorrowAqiData, {
      interactive: false,
      pane: 'AQIPane',
      style: (feature) => (this._styleService.getStyleForAQI(feature?.properties.styleUrl)),
    });

    this.layerControl.addOverlay(this.tomorrowAqiLayer, "Tomorrow's AQI Forecast");
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

    legend.onAdd = (map) => {
      var div = L.DomUtil.create("div", "legend");
      div.innerHTML += `
        <div class="flex justify-between items-center align-middle">
          <h4><a href=\"https://www.airnow.gov/aqi/aqi-basics/\" target=\"_blank\">AQI Legend<a></h4>
          <button id="toggle-aqi-legend" class="text-lg text-black">&#9650;</button>
        </div>`;

      const legendBody = L.DomUtil.create('div', 'mt-2 hidden legend', div);

      aqiLevels.forEach((aqi) => {
        legendBody.innerHTML += `<i style="background: ${aqi.style.color + 'dd'}; border: 1px solid black"></i><span>${aqi.name}</span><br>`
      });

      const toggleButton = div.querySelector('#toggle-aqi-legend') as Element;
      toggleButton.addEventListener('click', () => {
        if (legendBody.classList.contains('hidden')) {
          legendBody.classList.remove('hidden');
          toggleButton.innerHTML = '&#9660;'; // Down arrow
        } else {
          legendBody.classList.add('hidden');
          toggleButton.innerHTML = '&#9650;'; // Up arrow
        }
      });

      return div;
    };

    this.map.addControl(legend);
  }

  private initAlertLegend() {
    var legend = L.control.layers(undefined, undefined, { position: "bottomleft" });

    const alertLevels = [
      {
        category: 'None',
        name: 'No Alerts',
        styleIndex: 0,
        style: {} as any
      },
      {
        category: 'Smoke/Dust',
        name: 'Wildfire Smoke/Blowing Dust',
        styleIndex: 1,
        style: {} as any
      },
      {
        category: 'Ozone/PM',
        name: 'Ozone/Paticulate Matter',
        styleIndex: 2,
        style: {} as any
      },
      {
        category: 'Multiple',
        name: 'Multiple Pollutants',
        styleIndex: 3,
        style: {} as any
      },
    ];

    alertLevels.forEach((alert) => {
      alert.style = this._styleService.getStyleForAlert(alert.category);
    });

    legend.onAdd = (map) => {
      const div = L.DomUtil.create("div", "legend");
      div.innerHTML += `
        <div class="flex justify-between items-center align-middle">
          <h4 class="text-lg">Alert Legend</h4>
          <button id="toggle-alert-legend" class="text-lg">&#9650;</button>
        </div>
      `;

      const legendBody = L.DomUtil.create('div', 'mt-2 hidden legend', div);
      legendBody.id = 'legend-body'
    
      alertLevels.forEach((alert) => {
        const checkboxContainer = L.DomUtil.create('div', 'flex items-center me-4 legend-checkbox', legendBody);
        const checkbox = L.DomUtil.create('input', 'legend-icon bg-gray-100 border-gray-300 rounded focus:ring-black dark:focus:ring-white dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600', checkboxContainer);
        checkbox.type = 'checkbox';
        checkbox.style.accentColor = alert.style.fillColor;
        checkbox.style.border = '1px solid black';
        checkbox.checked = true;
        checkbox.value = alert.category;
        checkbox.id = alert.category;
        checkbox.addEventListener('click', () => this.alertCheckboxClicked(alert.styleIndex, checkbox.checked));
    
        const label = L.DomUtil.create('label', 'ms-1 text-sm font-medium text-gray-900 dark:text-gray-300', checkboxContainer);
        label.htmlFor = checkbox.id;
        label.textContent = alert.name;
      });
    
      // Toggle functionality
      const toggleButton = div.querySelector('#toggle-alert-legend') as Element;
      toggleButton.addEventListener('click', () => {
        if (legendBody.classList.contains('hidden')) {
          legendBody.classList.remove('hidden');
          toggleButton.innerHTML = '&#9660;'; // Down arrow
        } else {
          legendBody.classList.add('hidden');
          toggleButton.innerHTML = '&#9650;'; // Up arrow
        }
      });
    
      return div;
    };

    this.map.addControl(legend);
  }

  private alertCheckboxClicked(styleIndex: number, checked: boolean) {
    this.alertLayerStructure.forEach((structure) => {
      if (checked) {
        structure.layerGroup.addLayer(structure.layers[styleIndex]);
      } else {
        structure.layerGroup.removeLayer(structure.layers[styleIndex]);
      }
    });
  }

  private initShapeLegend() {
    var legend = L.control.layers(undefined, undefined, { position: "bottomleft" });

    legend.onAdd = (map) => {
      var div = L.DomUtil.create('div', 'legend');

      div.innerHTML += `
        <div class="flex justify-between items-center align-middle">
          <h4 class="text-lg">Shape Legend</h4>
          <button id="toggle-shape-legend" class="text-lg">&#9650;</button>
        </div>
      `;

      const legendBody = L.DomUtil.create('div', 'legend hidden', div);

      legendBody.innerHTML += '<i style="background-color: #999999; border-radius: 50%; border: 2px solid black"></i><span>Trailhead Cluster</span><br>';
      legendBody.innerHTML += '<i style="background-color: #999999; border: 2px solid black"></i><span>Hiking Trailhead</span><br>';

      // Toggle functionality
      const toggleButton = div.querySelector('#toggle-shape-legend') as Element;
      toggleButton.addEventListener('click', () => {
        if (legendBody.classList.contains('hidden')) {
          legendBody.classList.remove('hidden');
          toggleButton.innerHTML = '&#9660;'; // Down arrow
        } else {
          legendBody.classList.add('hidden');
          toggleButton.innerHTML = '&#9650;'; // Up arrow
        }
      });

      return div
    }

    this.map.addControl(legend);
  }

  private styleTrailheadData() {
    this.trailheadData.features.forEach((th: any) => {
      th.properties.alertStyle = this.getAlertColor(th.geometry.coordinates)
    });
  }

  private initTrailheadLayer() {

    if (!this.trailheadData.features[this.trailheadData.features.length - 1].properties.alertStyle) {
      this.styleTrailheadData();
    }

    const alertLayers: L.Layer[] = [];
    alertCategories.forEach((category) => {
      alertLayers.push(
        L.geoJSON(this.trailheadData, {
          filter: (feature) => {
            return feature.properties.alertStyle.category === category;
          },
          pointToLayer: (feature, latlng) => {
            const m = CL.squareMarker(latlng, {
              pane: 'CustomMarkerPane',
              radius: 7,
              fillColor: feature.properties.alertStyle.color,
              fillOpacity: 1,
              color: 'black',
              weight: 2,
              opacity: 1
            });
            m.on('click', () => {
              this.trailheadSelected = feature as Trailhead;
              this.trailheadSelectedChange.emit(feature as Trailhead);
            });
            return m;
          },
          // onEachFeature: (feature, layer) => {
          //   const properties = feature.properties as TrailheadProperties;

          //   const popupContent = `
          //   <div class="popup">
          //     <img src="assets/data/hiker-icon.svg" alt="Hiker Icon">
          //     <p>${properties.name}</p>
          //   </div>
          //   `;

          //   layer.bindPopup(popupContent);
          // }
        })
      );
    });
    const trailheadAlertLayerGroup = L.layerGroup(alertLayers, { pane: 'Locationpane' });
    this.alertLayerStructure.push({ layerGroup: trailheadAlertLayerGroup, layers: alertLayers });

    let autoToggle = true;

    this.map.on('zoomend', () => {
      if (!autoToggle) {
        return;
      }
      const mapZoom = this.map.getZoom();
      if (mapZoom < END_GROUPING_ZOOM) {
        trailheadAlertLayerGroup.removeFrom(this.map);
      } else {
        trailheadAlertLayerGroup.addTo(this.map);
      }
    });

    trailheadAlertLayerGroup.on('add', () => {
      if (this.map.getZoom() < END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    trailheadAlertLayerGroup.on('remove', () => {
      if (this.map.getZoom() >= END_GROUPING_ZOOM) {
        autoToggle = false;
      } else {
        autoToggle = true;
      }
    });

    this.layerControl.addOverlay(trailheadAlertLayerGroup, 'Trailheads');
  }

  private styleAlertData() {
    let alerts = this.alertData.features as WeatherAlert[];
    alerts = alerts.filter(alert => {return alert.properties.event === "Air Quality Alert"})
    alerts.sort((alertA, alertB) => {
      const alertAEffective = new Date(alertA.properties.effective).getTime();
      const alertBEffective = new Date(alertB.properties.effective).getTime();
      return Number(alertAEffective < alertBEffective);
    });
    const activeAlerts: { [key: string]: number } = {};

    alerts.forEach((alert, i) => {
      alert.properties.geocode.SAME.forEach((geocode) => {
        if (!activeAlerts[geocode.substring(1)]) {
          activeAlerts[geocode.substring(1)] = i;
        }
      });
    });

    this.countyData.features.forEach((county: any) => {
      const activeAlert = activeAlerts[county.properties.US_FIPS];
      if (activeAlert) {
        try {
          county.properties.activeAlert = alerts[activeAlert];
          county.properties.alertStyle = this._styleService.getStyleForAlert(alerts[activeAlert].properties.parameters.NWSheadline[0]);
        } catch (error) {
          county.properties.activeAlert = undefined;
          county.properties.alertStyle = this._styleService.getStyleForAlert('none');
        }
      } else {
        county.properties.activeAlert = undefined;
        county.properties.alertStyle = this._styleService.getStyleForAlert('none');
      }
    });
  }

  private initAlertLayer() {

    if (!this.countyData.features[this.countyData.features.length - 1].properties.alertStyle) {
      this.styleAlertData();
    }


    const countyLayer = L.geoJSON(this.countyData, {
      pane: 'CustomMarkerPane',
      style: (feature) => {
        return feature?.properties.alertStyle;
      },
      onEachFeature: (feature, layer) => {
        const featureAlert = feature.properties.activeAlert as WeatherAlert;
        if (featureAlert) {
          //TODO: Build a pop-up for the nws alerts
          const descriptionData = this._popupService.parseNWSAlertDescription(featureAlert.properties.description);
          const alertPopup = this._popupService.generateAlertPopup(descriptionData, feature.properties.FULL);
          layer.bindPopup(alertPopup, {
            className: 'rounded shadow-lg alert-card',
          });
        } else {
          const goodPopup = `<div><h1 class="text-center font-bold text-black">${feature.properties.FULL}</h1><h1 class="text-gray-700 text-center">No alerts for this area.</h1></div>`
          layer.bindPopup(goodPopup, {
            className: 'rounded shadow-lg alert-card',
            autoPanPaddingTopLeft: new L.Point(100, 0)
          })
        }
      },
    });
    this.map.addLayer(countyLayer);

    // this.layerControl.addOverlay(countyLayer, 'Today\'s NWS Alerts');
  }

  private initCentroidLayer() {
    const trailheadCoordinates = this.trailheadData.features.map((feature: any) => feature.geometry.coordinates);

    const centroidKCounts = [25, 50, 150, 250, 400];
    const alertCentroidLayers: L.Layer[] = [];

    for (const k of centroidKCounts) {
      const centroidPoints = skmeans(trailheadCoordinates, k, 'kmpp');

      const points = Array(k);

      for (let i = 0; i < k; i++) {
        const coordinates = centroidPoints.centroids[i] as [number, number];
        points[i] = {
          count: 0,
          alertColor: this.getAlertColor(coordinates)
        };
      };

      centroidPoints.idxs.forEach((idx, i) => {
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

      const alertKCentroidLayers: L.Layer[] = [];

      alertCategories.forEach((category) => {
        const alertKCentroidLayer = L.geoJSON(todayCentroidGeoJSON as any, {
          filter: (feature) => {
            return feature.properties.alertColor.category === category;
          },
          pointToLayer(feature, latlng) {
            //TODO: Upgrade the pop-up, maybe
            // const popupContent = `
            // <div class="grid grid-cols-3 gap-2 w-[90px] h-[30px]">
            //   <p>${feature.properties.count}</p>
            // </div>
            // `;
            const centroidShape = 'Multiple'
            const m = L.marker(latlng, {
              pane: 'CentroidMarkerPane',
              icon: createCustomIcon(feature.properties.count, feature.properties.alertColor.color, centroidShape)
            });
            return m;
          },
          onEachFeature: (feature, layer) => {
            layer.on('click', () => {
              const coordinates = (feature.geometry as any).coordinates;
              this.map.flyTo([coordinates[1], coordinates[0]], this.map.getZoom() + 1, {
                duration: 0.25
              });
            });
          },
        });

        alertKCentroidLayers.push(alertKCentroidLayer);


      });

      const alertKLayerGroup = L.layerGroup(alertKCentroidLayers, { pane: 'LocationPane' });
      this.alertLayerStructure.push({ layerGroup: alertKLayerGroup, layers: alertKCentroidLayers });

      alertCentroidLayers.push(alertKLayerGroup);
    }

    const zoomStart = END_GROUPING_ZOOM - 5;

    const alertCentroidGroup = L.layerGroup([alertCentroidLayers[0]], { pane: 'LocationPane' });

    this.map.on('zoomend', () => {
      if (this.map.getZoom() <= zoomStart) {
        alertCentroidGroup.clearLayers();
        alertCentroidGroup.addLayer(alertCentroidLayers[0]);
      }
      if (this.map.getZoom() >= END_GROUPING_ZOOM) {
        alertCentroidGroup.clearLayers();
      }
    })

    for (let i = zoomStart + 1; i < END_GROUPING_ZOOM; i++) {
      this.map.on('zoomend', () => {
        if (this.map.getZoom() == i) {
          alertCentroidGroup.clearLayers();
          alertCentroidGroup.addLayer(alertCentroidLayers[i - zoomStart]);
        }
      });
    }

    this.map.addLayer(alertCentroidGroup);

    this.layerControl.addOverlay(alertCentroidGroup, 'Grouping Markers');
  }

  private getAlertColor(coordinates: [number, number]) {
    for (let feature of this.countyData.features) {
      const originalPolygon = feature.geometry;
      if (turf.booleanIntersects(originalPolygon, turf.point(coordinates))) {
        return {
          color: feature.properties.alertStyle.fillColor + '88',
          category: feature.properties.alertStyle.category
        };
      }
    }
    return {
      color: 'black',
      category: 'N/A'
    };
  }

  ngAfterViewInit(): void {
    this.initMap();
    this._shapeService.getTodayAQIShapes().subscribe(todayAQIData => {
      this.todayAqiData = todayAQIData;
      this.initTodayAQILayer();
    });
    this._shapeService.getTomorrowAQIShapes().subscribe(tomorrowAQIData => {
      this.tomorrowAqiData = tomorrowAQIData;
      this.initTomorrowAQILayer();
    });
    this._shapeService.getCotrexShapes().subscribe(trailData => {
      this.trailData = trailData;
      this.initTrailsLayer(false);
    });
    forkJoin({
      trailheadData: this._shapeService.getTrailheadShapes(),
      counties: this._shapeService.getCountyShapes(),
      alerts: this._shapeService.getNWSAlerts()
    }).subscribe({
      next: ({ trailheadData, counties, alerts }) => {
        this.trailheadData = trailheadData;
        this.countyData = counties;
        this.alertData = alerts;
        
        this.initAlertLayer();
        this.initTrailheadLayer();
        this.initCentroidLayer();
      }
    });
    this.initAQILegend();
    this.initAlertLegend();
    this.initShapeLegend();
    this.initLocationSelector();
  }

  ngOnChanges(changes: SimpleChanges): void {
    //Fires when a trailhead (or anything from the sidebar) is selected
    if (changes['trailheadSelected'] && changes['trailheadSelected'].currentValue) {
      const coordinates = this.trailheadSelected.geometry.coordinates;
      this.map.flyTo([coordinates[1], coordinates[0]], END_GROUPING_ZOOM, {
        duration: 0.5
      });
      // this.selectedLocationMarker.setLatLng([coordinates[1], coordinates[0]]);
      // this.selectedLocationMarker.addTo(this.map);
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

