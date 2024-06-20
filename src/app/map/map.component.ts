import { Component, AfterViewInit } from '@angular/core';
import * as L from 'leaflet';

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

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent implements AfterViewInit {
  private map!: L.Map;
  private states!: any;
  private trails!: any;

  private initMap() {
    this.map = L.map('map', {
      center: [ 39, -105.7821 ],
      zoom: 8
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
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
    });

    // Default_OSM.addTo(this.map);
    // Stadia_StamenWatercolor.addTo(this.map);
    Esri_WorldTopoMap.addTo(this.map);
  }

  constructor(private _markerService: MarkerService, private _shapeService: ShapeService) { }

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

  private initStatesLayer() {
    const stateLayer = L.geoJSON(this.states, {
      style: (feature) => ({
        weight: 3,
        opacity: 0.5,
        color: '#008f68',
        fillOpacity: 0.8,
        fillColor: '#6DB65B'
      }),
      onEachFeature: (feature, layer) => {
        layer.on({
          mouseover: (e) => (this.highlightFeature(e)),
          mouseout: (e) => (this.resetFeature(e)),
        })
      }
    });

    this.map.addLayer(stateLayer);
    stateLayer.bringToBack();
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
    const trailLayer = L.geoJSON(this.trails, {
      style: (feature) => ({
        weight: 5,
        opacity: 0.5,
        color: this.getTrailColor(feature?.properties.length_mi_)
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

    this.map.addLayer(trailLayer);
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

  ngAfterViewInit(): void {
    this.initMap();
    // this._markerService.makeCapitalMarkers(this.map);
    this._markerService.makeCapitalCircleMarkers(this.map);
    // this._shapeService.getStateShapes().subscribe(states => {
    //   this.states = states;
    //   this.initStatesLayer();
    // });
    this._shapeService.getCotrexShapes().subscribe(trails => {
      this.trails = this.groupTrailsByName(trails);
      this.initTrailsLayer()
    })
  }
}