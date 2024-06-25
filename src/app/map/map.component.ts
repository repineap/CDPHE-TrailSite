import { Component, AfterViewInit } from '@angular/core';

import * as L from 'leaflet';
import * as turf from '@turf/turf';

import { MarkerService } from '../marker.service';
import { ShapeService } from '../shape.service';

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

const aqiStyles: { [key: string]: any} = {
  "#Unavailable": {
      "fillColor": "#cccccc",
      "fillOpacity": 0.4,
      "color": "#cccccc",
      "opacity": 0.0,
      "weight": 1
  },
  "#Invisible": {
      "fillColor": "#000000",
      "fillOpacity": 0.0,
      "color": "#000000",
      "opacity": 0.0,
      "weight": 1
  },
  "#Good": {
      "fillColor": "#00E400",
      "fillOpacity": 0.251,
      "color": "#00E400",
      "opacity": 0.0,
      "weight": 1
  },
  "#Moderate": {
      "fillColor": "#ffff00",
      "fillOpacity": 0.251,
      "color": "#ffff00",
      "opacity": 0.0,
      "weight": 1
  },
  "#UnhealthySG": {
      "fillColor": "#ff7e00",
      "fillOpacity": 0.251,
      "color": "#ff7e00",
      "opacity": 0.0,
      "weight": 1
  },
  "#Unhealthy": {
      "fillColor": "#ff0000",
      "fillOpacity": 0.251,
      "color": "#ff0000",
      "opacity": 0.0,
      "weight": 1
  },
  "#VeryUnhealthy": {
      "fillColor": "#99004c",
      "fillOpacity": 0.251,
      "color": "#99004c",
      "opacity": 0.0,
      "weight": 1
  },
  "#Hazardous": {
      "fillColor": "#7e0023",
      "fillOpacity": 0.251,
      "color": "#7e0023",
      "opacity": 0.0,
      "weight": 1
  }
}

// const tentIcon = L.icon({
//   iconUrl: 'assets/data/tent-icon.svg',
//   iconSize: [25, 25],
//   className: 'tent-icon'
// })

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
  private trailLayer!: L.GeoJSON;
  private todayAqiData: any;
  private tomorrowAqiData: any;
  private trailheadData: any;
  private facilityData: any;

  private aqiPane!: HTMLElement;
  private locationPane!: HTMLElement;
  private layerControl!: L.Control.Layers;

  private initMap() {
    this.map = L.map('map', {
      center: [ 39, -105.7821 ],
      zoom: 8
    }).on('moveend', () => {
      console.log(this.map.getBounds());
      // const zoomLevel = this.map.getZoom();
      // if (zoomLevel > 12 && this.trailLayer && !this.map.hasLayer(this.trailLayer)) {
      //   this.map.addLayer(this.trailLayer);
      // } else if (zoomLevel <= 12 && this.trailLayer && this.map.hasLayer(this.trailLayer)) {
      //   this.map.removeLayer(this.trailLayer);
      // }
    });

    const Default_OSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 3,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    const Stadia_StamenWatercolor = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', {
      minZoom: 1,
      maxZoom: 16,
      attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://www.stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });

    const Esri_WorldTopoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
      minZoom: 8,
      maxZoom: 18
    });

    const OpenStreetMap_Mapnik = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const Trail_Map = L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
      maxZoom: 18
    });

    this.aqiPane = this.map.createPane('AQIPane');
    this.aqiPane.style.zIndex = '399';

    this.locationPane = this.map.createPane('LocationPane');
    this.locationPane.style.zIndex = '405';
    

    // Default_OSM.addTo(this.map);
    // Stadia_StamenWatercolor.addTo(this.map);
    OpenStreetMap_Mapnik.addTo(this.map);
    this.layerControl = L.control.layers();
    this.layerControl.addTo(this.map);
  }

  constructor(private _shapeService: ShapeService) { }

  private highlightFeature(e: L.LeafletMouseEvent) {
    const layer = e.target;

    layer.setStyle({
      weight: 10,
      opacity: 1.0,
      color: '#DFA612',
      fillOpacity: 1.0,
      fillColor: '#FAE042'
  });
}

private resetFeature(e: L.LeafletMouseEvent) {
  const layer = e.target;

  layer.setStyle({
    weight: 3,
    opacity: 0.5,
    color: '#008f68',
    fillOpacity: 0.8,
    fillColor: '#6DB65B'
  });
}

//TODO: Fix this highlighting functionality
highlightTrail(e: L.LeafletMouseEvent, length_mi_: number) {
  const layer = e.target;

  layer.setStyle({
    weight: 10,
    opacity: 1,
    color: 'black'
  });
}

private initTrailsLayer() {
  this.trailLayer = L.geoJSON(this.trails, {
      pane: 'LocationPane',
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
          <p>${feature.properties.length_mi_}</p>`;
        layer.bindPopup(popupContent);
        layer.on({
          //TODO: Fix the trail highlighting functionality to make it work on clicking on and clicking off
          mousedown: (e) => this.highlightTrail(e, feature.properties.length_mi_)
        })
      }
    });

    this.layerControl.addOverlay(this.trailLayer, "Trails");
  }

  getTrailColor(length_mi_: any): string {
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

  private groupTrailsByName(geojson: any): any {
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
      filter: (feature) => {
        const coloradoBBox: [number, number, number, number] = [-109.05919619986199, 36.99275055519555, -102.04212644366443, 41.00198213121131];

        const coloradoPoly = turf.bboxPolygon(coloradoBBox);
        return turf.booleanIntersects(feature.geometry, coloradoPoly) && feature.properties.styleUrl !== "#Good";
      },
      style: (feature) => (this.getAQIStyle(feature?.properties.styleUrl)),
      onEachFeature: (feature, layer) => {
        //TODO: Fix popup to accurately display what we want it to
        layer.bindPopup(feature.properties.description);
      }});

    aqiLayer.addTo(this.map);

    this.layerControl.addBaseLayer(aqiLayer, "Today's AQI Levels")
  }

  private initTomorrowAQILayer() {
    const aqiLayer = L.geoJSON(this.tomorrowAqiData, {
      pane: 'AQIPane',
      filter: (feature) => {
        const coloradoBBox: [number, number, number, number] = [-109.05919619986199, 36.99275055519555, -102.04212644366443, 41.00198213121131];

        const coloradoPoly = turf.bboxPolygon(coloradoBBox);
        return turf.booleanIntersects(feature.geometry, coloradoPoly) && feature.properties.styleUrl !== "#Good";
      },
      style: (feature) => (this.getAQIStyle(feature?.properties.styleUrl)),
      onEachFeature: (feature, layer) => {
        //TODO: Fix popup to accurately display what we want it to
        layer.bindPopup(feature.properties.description);
      }});

    this.layerControl.addBaseLayer(aqiLayer, "Tomorrow's AQI Levels");
  }

  private getAQIStyle(styleUrl: string): any {
    return aqiStyles[styleUrl];
  }

  private initTrailheadLayer() {
    const trailheadLayer = L.geoJSON(this.trailheadData, {
      pane: 'LocationPane',
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 5,
          weight: 2,
          color: 'black',
          fillColor: 'maroon',
          opacity: 1,
          fillOpacity: 0.75
        });
      },
      onEachFeature: (feature, layer) => {
        const properties = feature.properties;

        const name = properties.name;

        const popupContent = `<p>${name}</p>`;

        layer.bindPopup(popupContent);
      },
    });
    
    trailheadLayer.addTo(this.map);

    this.layerControl.addOverlay(trailheadLayer, "Trailheads");
  }

private initFacilityLayer() {
  //TODO: Split fishing and camping into two separate layers
  const fishingLayer = L.geoJSON(this.facilityData, {
    pane: 'LocationPane',
    filter: (feature) => {
      return feature.properties && this.getFacilityColor(feature.properties.d_FAC_TYPE) === 'blue';
    },
    pointToLayer: (feature, latlng) => {
      const facilityColor = 'blue';

      const imageUrl = 'fishing-rod-icon.svg';

      const divIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="circle-marker" style="background-color: ${facilityColor}"></div><img src="assets/data/${imageUrl}" class="custom-icon">`,
        iconSize: [6, 6]
      });

      return L.marker(latlng, {
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
      const facilityColor = 'green'

      const imageUrl = 'tent-icon.svg';

      const divIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="circle-marker" style="background-color: ${facilityColor}"></div><img src="assets/data/${imageUrl}" class="custom-icon">`,
        iconSize: [6, 6]
      });

      return L.marker(latlng, {
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
  
  fishingLayer.addTo(this.map);
  campingLayer.addTo(this.map);

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
    this._shapeService.getCotrexShapes().subscribe(trails => {
      this.trails = this.groupTrailsByName(trails);
      this.initTrailsLayer();
    });
    this._shapeService.getTodayAQIShapes().subscribe(aqiData => {
      this.todayAqiData = aqiData;
      this.initTodayAQILayer()
    });
    this._shapeService.getTomorrowAQIShapes().subscribe(aqiData => {
      this.tomorrowAqiData = aqiData;
      this.initTomorrowAQILayer()
    });
    this._shapeService.getTrailheadShapes().subscribe(trailheadData => {
      this.trailheadData = trailheadData;
      this.initTrailheadLayer();
    });
    this._shapeService.getFacilityShapes().subscribe(facilityData => {
      this.facilityData = facilityData;
      this.initFacilityLayer();
    });
  }
}