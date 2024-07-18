import { Component, AfterViewInit, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { JsonPipe, NgFor, NgIf, SlicePipe } from '@angular/common';

import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { ShapeService } from '../shape.service';
import { filter, forkJoin } from 'rxjs';

import { Trailhead, CityCenter, Geometry } from '../geojson-typing';

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
  trailheads: any;
  cityCenters: any;
  closestCityCenter: { [key: string]: ClosestCityCenter } = {};
  activeTrailheads!: Trailhead[];
  @Input() mapBounds = L.latLngBounds(L.latLng(37.18657859524883, -109.52819824218751), L.latLng(40.76806170936614, -102.04101562500001));
  @Input() searchQuery = '';
  @Output() trailheadSelected = new EventEmitter<Trailhead>;

  constructor(private _shapeService: ShapeService) { }

  ngAfterViewInit() {
    forkJoin({
      cityCenters: this._shapeService.getCityShapes(),
      trailheads: this._shapeService.getTrailheadShapes()
    }).subscribe({
      next: ({ cityCenters, trailheads }) => {
        this.cityCenters = cityCenters;
        this.trailheads = trailheads;

        this.activeTrailheads = this.trailheads.features.filter((th: any) => { return th.properties.name !== '' });
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
    if (this.trailheads == undefined) {
      return;
    }
    this.activeTrailheads = this.trailheads.features.filter((th: Trailhead) => {
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
    if (this.trailheads == undefined) {
      return;
    }

    if (this.searchQuery === 'EMPTY_SEARCH') {
      this.searchQuery = '';
      this.handleBoundsChange();
      return;
    }
    this.activeTrailheads = this.trailheads.features.filter((th: Trailhead) => {
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