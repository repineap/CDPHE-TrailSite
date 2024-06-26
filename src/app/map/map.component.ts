import { Component, AfterViewInit } from '@angular/core';

import * as L from 'leaflet';

import { ShapeService } from '../shape.service';
import { GeoStylingService } from '../geo-styling.service';

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
  private trailheadData: any;
  private centroidData: any;
  private facilityData: any;
  private facilityCentroidData: any;

  private aqiPane!: HTMLElement;
  private trailPane!: HTMLElement;
  private locationPane!: HTMLElement;
  private layerControl!: L.Control.Layers;
  private layerStatus: { [key: string]: boolean } = {};
  private dynamicLayers: { [key: string]: L.Layer } = {};

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
      pane: 'BaseMapPane',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | AQI Data Provided by <a href="https://www.airnow.gov/">AirNow.gov</a>'
    });

    const mapPane = this.map.createPane('BaseMapPane');
    mapPane.style.zIndex = '200';

    //TODO: Figure out why the layering isn't working with z-indices above 400
    this.aqiPane = this.map.createPane('AQIPane');
    this.aqiPane.style.zIndex = '398';

    this.trailPane = this.map.createPane('TrailPane');
    this.trailPane.style.zIndex = '402';

    this.locationPane = this.map.createPane('LocationPane');
    this.locationPane.style.zIndex = '403';

    // Default_OSM.addTo(this.map);
    // Stadia_StamenWatercolor.addTo(this.map);
    OpenStreetMap_Mapnik.addTo(this.map);
    this.layerControl = L.control.layers();
    this.layerControl.addTo(this.map);

    this.map.on('overlayadd', (event: L.LayersControlEvent) => {
      this.layerStatus[event.name] = true;
      console.log(this.layerStatus); // Debugging: Log the layer status
    });

    this.map.on('overlayremove', (event: L.LayersControlEvent) => {
      this.layerStatus[event.name] = false;
      console.log(this.layerStatus); // Debugging: Log the layer status
    });
  }

  addDynamicLayer(name: string, layer: L.Layer) {
    this.dynamicLayers[name] = layer;
    this.layerControl.addOverlay(layer, name);
    this.layerStatus[name] = this.map.hasLayer(layer);
  }

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService) { }

  //TODO: Fix this highlighting functionality
  private highlightTrail(e: L.LeafletMouseEvent, length_mi_: number) {
    const layer = e.target;

    layer.setStyle({
      weight: 10,
      opacity: 1,
      color: 'black'
    });
  }

  private initTrailsLayer(combineByPlaceID: boolean) {
  if (combineByPlaceID) {
    this.trails = this.groupTrails(this.trails);
  }
  const trailLayer = L.geoJSON(this.trails, {
      pane: 'TrailPane',
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
        layer.on({
          //TODO: Fix the trail highlighting functionality to make it work on clicking on and clicking off
          mousedown: (e) => this.highlightTrail(e, feature.properties.length_mi_)
        })
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
      }});

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
      }});

    this.layerControl.addBaseLayer(aqiLayer, "Tomorrow's AQI Levels");
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

    const k15_Centroids = L.geoJSON(this.centroidData, {
      filter: (feature) => {
        return feature.properties.kmeans == 15;
      },
      pointToLayer(feature, latlng) {
        return L.marker(latlng, {
          icon: createCustomIcon(feature.properties.count, 'maroon')
        })
      },
    });

    const k50_Centroids = L.geoJSON(this.centroidData, {
      filter: (feature) => {
        return feature.properties.kmeans == 50;
      },
      pointToLayer(feature, latlng) {
        return L.marker(latlng, {
          icon: createCustomIcon(feature.properties.count, 'maroon')
        })
      },
    });

    const k100_Centroids = L.geoJSON(this.centroidData, {
      filter: (feature) => {
        return feature.properties.kmeans == 100;
      },
      pointToLayer(feature, latlng) {
        return L.marker(latlng, {
          icon: createCustomIcon(feature.properties.count, 'maroon')
        })
      },
    });

    const k200_Centroids = L.geoJSON(this.centroidData, {
      filter: (feature) => {
        return feature.properties.kmeans == 200;
      },
      pointToLayer(feature, latlng) {
        return L.marker(latlng, {
          icon: createCustomIcon(feature.properties.count, 'maroon')
        })
      },
    });

    const k300_Centroids = L.geoJSON(this.centroidData, {
      filter: (feature) => {
        return feature.properties.kmeans == 300;
      },
      pointToLayer(feature, latlng) {
        return L.marker(latlng, {
          icon: createCustomIcon(feature.properties.count, 'maroon')
        })
      },
    });
    
    k15_Centroids.addTo(this.map);

    const layerList = [k15_Centroids, k50_Centroids, k100_Centroids, k200_Centroids, k300_Centroids, trailheadLayer];

    this.addDynamicLayer('Trailheads', trailheadLayer);

    this.map.on('zoomend', () => {
      console.log(this.map.getZoom())
      const mapZoom = this.map.getZoom();
      if (mapZoom <= 8) {
        layerList.forEach((layer) => layer.removeFrom(this.map));
        k15_Centroids.addTo(this.map);
      } else if (mapZoom <= 9) {
        layerList.forEach((layer) => layer.removeFrom(this.map));
        k50_Centroids.addTo(this.map);
      } else if (mapZoom <= 10) {
        layerList.forEach((layer) => layer.removeFrom(this.map));
        k100_Centroids.addTo(this.map);
      } else if (mapZoom <= 11) {
        layerList.forEach((layer) => layer.removeFrom(this.map));
        k200_Centroids.addTo(this.map);
      } else if (mapZoom <= 12) {
        layerList.forEach((layer) => layer.removeFrom(this.map));
        k300_Centroids.addTo(this.map);
      } else {
        layerList.forEach((layer) => layer.removeFrom(this.map));
        trailheadLayer.addTo(this.map);
      }
    });
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
        iconSize: [8, 8]
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
        iconSize: [10, 10]
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

  const centroid_layer = L.geoJSON(this.facilityCentroidData, {
    filter: (feature) => {
      return feature.properties.kmeans == 50;
    },
    pointToLayer(feature, latlng) {
      return L.marker(latlng, {
        icon: createCustomIcon(feature.properties.count, '#8B8000')
      })
    },
  });

  centroid_layer.addTo(this.map);

  this.layerControl.addOverlay(fishingLayer, "Fishing Facilities");
  this.layerControl.addOverlay(campingLayer, "Camping Facilities");

  this.map.on('zoomend', () => {
    const mapZoom = this.map.getZoom();
    if (mapZoom < 10) {
      fishingLayer.removeFrom(this.map);
      campingLayer.removeFrom(this.map);
      centroid_layer.addTo(this.map);
    } else {
      centroid_layer.removeFrom(this.map);
      fishingLayer.addTo(this.map);
      campingLayer.addTo(this.map);
    }
  });
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
    // this._shapeService.getCotrexShapes().subscribe(trails => {
    //   this.trails = trails;
    //   this.initTrailsLayer(false);
    // });
    this._shapeService.getTrailheadCentroids().subscribe(centroidData => {
      this.centroidData = centroidData;
    });
    this._shapeService.getFacilityCentroids().subscribe(facilityCentroidData => {
      this.facilityCentroidData = facilityCentroidData;
    });
    this._shapeService.getTodayAQIShapes().subscribe(aqiData => {
      this.todayAqiData = aqiData;
      this.initTodayAQILayer();
    });
    this._shapeService.getTomorrowAQIShapes().subscribe(aqiData => {
      this.tomorrowAqiData = aqiData;
      this.initTomorrowAQILayer();
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

function createCustomIcon(count: number, color: string) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="trailhead-centroid" style="background-color: ${color}">${count}</div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });
}
