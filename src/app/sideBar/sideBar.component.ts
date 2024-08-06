import { Component, AfterViewInit, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { JsonPipe, NgFor, NgIf, SlicePipe } from '@angular/common';

import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { ShapeService } from '../shape.service';
import { filter, forkJoin } from 'rxjs';

import { Trailhead, CityCenter, Geometry, WeatherAlert } from '../geojson-typing';
import { GeoStylingService } from '../geo-styling.service';

interface ClosestCityCenter {
  minDist: number,
  minCityCenter: CityCenter
}

@Component({
  selector: 'app-sideBar',
  standalone: true,
  imports: [NgFor, NgIf, JsonPipe],
  templateUrl: './sideBar.component.html',
  styleUrl: './sideBar.component.css'
})
export class sideBarComponent implements OnChanges, AfterViewInit {
  private trailheadData: any;
  private cityCenters: any;
  private countyData: any;
  private alertData: any;
  public closestCityCenter: { [key: string]: ClosestCityCenter } = {};
  public activeTrailheads!: Trailhead[];
  @Input() mapBounds = L.latLngBounds(L.latLng(37.18657859524883, -109.52819824218751), L.latLng(40.76806170936614, -102.04101562500001));
  @Input() searchQuery = '';
  @Output() trailheadSelected = new EventEmitter<Trailhead>();
  @Output() openModal = new EventEmitter<Trailhead>();

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService) { }

  ngAfterViewInit() {
    forkJoin({
      countyData: this._shapeService.getCountyShapes(),
      cityCenters: this._shapeService.getCityShapes(),
      trailheadData: this._shapeService.getTrailheadShapes(),
      alertData: this._shapeService.getNWSAlerts()
    }).subscribe({
      next: ({ countyData, cityCenters, trailheadData, alertData }) => {
        this.countyData = countyData;
        this.cityCenters = cityCenters;
        this.trailheadData = trailheadData;
        this.alertData = alertData;

        if (!this.countyData.features[this.countyData.features.length - 1].properties.alertStyle) {
          this.styleAlertData();
        }

        if (!this.trailheadData.features[this.trailheadData.features.length - 1].properties.alertStyle) {
          this.styleTrailheadData();
        }

        this.activeTrailheads = this.trailheadData.features.filter((th: any) => { return th.properties.name !== '' });
        const mapCenter = this.mapBounds.getCenter();
        this.activeTrailheads.sort((a, b) => {
          const aDistance = turf.distance([mapCenter.lat, mapCenter.lng], [a.geometry.coordinates[1], a.geometry.coordinates[0]]);
          const bDistance = turf.distance([mapCenter.lat, mapCenter.lng], [b.geometry.coordinates[1], b.geometry.coordinates[0]]);
          // if (a.properties.name < b.properties.name) {
          //   return -1;
          // } else {
          //   return 1;
          // }
          if (aDistance < bDistance) {
            return -1;
          } else {
            return 1;
          }
        });

        this.activeTrailheads.forEach((th: Trailhead) => {
          const feature_id = th.properties.feature_id;

          this.closestCityCenter[feature_id] = this.getClosestCityCenter(th.geometry);
        });

      }
    });
  }

  private styleAlertData() {
    let alerts = this.alertData.features as WeatherAlert[];
    alerts = alerts.filter(alert => { return alert.properties.event === "Air Quality Alert" })
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

  private styleTrailheadData() {
    this.trailheadData.features.forEach((th: any) => {
      th.properties.alertStyle = this.getAlertColor(th.geometry.coordinates)
    });
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

  getClosestCityCenter(geometry: Geometry): ClosestCityCenter {
    const latlng = geometry.coordinates;
    const cityCenterFeatures: CityCenter[] = this.cityCenters.features;
    let minDist = turf.distance(latlng, cityCenterFeatures[0].geometry.coordinates, { units: 'miles' });
    let minCityCenter = cityCenterFeatures[0]
    cityCenterFeatures.forEach((cc) => {
      const dist = turf.distance(latlng, cc.geometry.coordinates, { units: 'miles' });
      if (dist < minDist) {
        minDist = dist;
        minCityCenter = cc;
      }
    });
    return ({
      "minDist": Math.round(minDist * 100) / 100.0,
      "minCityCenter": minCityCenter
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mapBounds'] && changes['mapBounds'].currentValue) {

      this.handleBoundsChange();
    }
    if (changes['searchQuery'] && changes['searchQuery'].currentValue) {
      this.handleQueryChange();
    }
  }

  private handleBoundsChange() {
    if (this.trailheadData == undefined) {
      return;
    }
    this.activeTrailheads = this.trailheadData.features.filter((th: Trailhead) => {
      const coordinates = th.geometry.coordinates;
      const closestCityCenter = this.closestCityCenter[th.properties.feature_id];
      const filterString = `${th.properties.name}${th.properties.manager}${closestCityCenter !== undefined ? `${closestCityCenter.minCityCenter.properties.name}, ${closestCityCenter.minCityCenter.properties.county} County, CO ${closestCityCenter.minCityCenter.properties.name}, CO` : ''}`
      return th.properties.name !== '' && this.mapBounds.contains(L.latLng(coordinates[1], coordinates[0])) && filterString.toLowerCase().includes(this.searchQuery.toLowerCase());
    });
    const mapCenter = this.mapBounds.getCenter();
    this.activeTrailheads.sort((a, b) => {
      const aDistance = turf.distance([mapCenter.lat, mapCenter.lng], [a.geometry.coordinates[1], a.geometry.coordinates[0]]);
      const bDistance = turf.distance([mapCenter.lat, mapCenter.lng], [b.geometry.coordinates[1], b.geometry.coordinates[0]]);
      // if (a.properties.name < b.properties.name) {
      //   return -1;
      // } else {
      //   return 1;
      // }
      if (aDistance < bDistance) {
        return -1;
      } else {
        return 1;
      }
    });
  }

  private handleQueryChange() {
    if (this.trailheadData == undefined) {
      return;
    }

    if (this.searchQuery === 'EMPTY_SEARCH') {
      this.searchQuery = '';
      this.handleBoundsChange();
      return;
    }
    this.activeTrailheads = this.trailheadData.features.filter((th: Trailhead) => {
      const closestCityCenter = this.closestCityCenter[th.properties.feature_id];
      const filterString = `${th.properties.name}${th.properties.manager}${closestCityCenter !== undefined ? `${closestCityCenter.minCityCenter.properties.name}, ${closestCityCenter.minCityCenter.properties.county} County, CO ${closestCityCenter.minCityCenter.properties.name}, CO` : ''}`
      return th.properties.name !== '' && filterString.toLowerCase().includes(this.searchQuery.toLowerCase());
    });
    const mapCenter = this.mapBounds.getCenter();
    this.activeTrailheads.sort((a, b) => {
      const aDistance = turf.distance([mapCenter.lat, mapCenter.lng], [a.geometry.coordinates[1], a.geometry.coordinates[0]]);
      const bDistance = turf.distance([mapCenter.lat, mapCenter.lng], [b.geometry.coordinates[1], b.geometry.coordinates[0]]);
      // if (a.properties.name < b.properties.name) {
      //   return -1;
      // } else {
      //   return 1;
      // }
      if (aDistance < bDistance) {
        return -1;
      } else {
        return 1;
      }
    });
  }

  update(trailHead: Trailhead) {
    this.trailheadSelected.emit(trailHead);
  }

}