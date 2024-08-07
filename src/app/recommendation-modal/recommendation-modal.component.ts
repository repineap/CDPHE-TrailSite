import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RecommendationQuery, Trailhead, WeatherAlert } from '../geojson-typing';
import { ShapeService } from '../shape.service';
import * as turf from '@turf/turf';
import { GeoStylingService } from '../geo-styling.service';
import { forkJoin } from 'rxjs';

const alertCategories = ["None", "Smoke/Dust", "Ozone/PM", "Multiple"];

@Component({
  selector: 'app-recommendation-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './recommendation-modal.component.html',
  styleUrl: './recommendation-modal.component.css'
})
export class RecommendationModalComponent implements OnInit, OnChanges {
  @Output() close = new EventEmitter<void>();
  @Output() search = new EventEmitter<RecommendationQuery>();
  private countyData: any;
  private alertData: any;
  private trailheadData: any;
  public trailheadRecommendationData: { [key: string]: Trailhead[]} = {
    none: [],
    dust: [],
    fine: [],
    ozone: [],
    multiple: []
  };
  @Input() recommendationTrailhead!: Trailhead;
  @Output() trailheadRecommendations = new EventEmitter<Trailhead[]>();

  constructor(private _shapeService: ShapeService, private _styleService: GeoStylingService) {}

  searchQuery: RecommendationQuery = {
    maxDistMi: 50,
    alertLevels: {
      "None": false,
      "Blowing Dust": false,
      "Fine Particulate": false,
      "Ozone": false,
      "Multiple": false
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  performSearch(): void {
    this.trailheadRecommendations.emit([
      this.recommendationTrailhead,
      ...(!this.searchQuery.alertLevels['None'] ? [] : this.trailheadRecommendationData['none']),
      ...(!this.searchQuery.alertLevels['Blowing Dust'] ? [] : this.trailheadRecommendationData['dust']),
      ...(!this.searchQuery.alertLevels['Fine Particulate'] ? [] : this.trailheadRecommendationData['fine']),
      ...(!this.searchQuery.alertLevels['Ozone'] ? [] : this.trailheadRecommendationData['ozone']),
      ...(!this.searchQuery.alertLevels['Multiple'] ? [] : this.trailheadRecommendationData['multiple'])
    ]);
    this.close.emit();
  }

  maxDistChanged() {
    this.updateRecommendedTrailheads();
  }

  ngOnInit(): void {
    forkJoin({
      trailheadData: this._shapeService.getTrailheadShapes(),
      counties: this._shapeService.getCountyShapes(),
      alerts: this._shapeService.getNWSAlerts()
    }).subscribe({
      next: ({ trailheadData, counties, alerts }) => {
        this.trailheadData = trailheadData;
        this.countyData = counties;
        this.alertData = alerts;
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recommendationTrailhead'] && changes['recommendationTrailhead'].currentValue) {
      const alertCategoryIdx = alertCategories.indexOf(this.recommendationTrailhead.properties.alertStyle?.category);
      this.searchQuery.alertLevels = {
        "None": true,
        "Blowing Dust": alertCategoryIdx > 1,
        "Fine Particulate": alertCategoryIdx > 2,
        "Ozone": alertCategoryIdx > 3,
        "Multiple": false
      }
      this.updateRecommendedTrailheads();
    }
  }

  private updateRecommendedTrailheads(): void {
    for (const level in this.trailheadRecommendationData) {
      this.trailheadRecommendationData[level] = [];
    }
    const selectedPoint = turf.point(this.recommendationTrailhead.geometry.coordinates);
    const MAX_DIST_MI = this.searchQuery.maxDistMi;

    let closestTrailheads = ([...this.trailheadData.features] as Trailhead[]);
    closestTrailheads.forEach((trailhead) => {
      const distance = turf.distance(selectedPoint, turf.point(trailhead.geometry.coordinates), { units: 'miles' });
      trailhead.properties.distanceFromSelectedMi = Math.round(distance * 100) / 100;
    });

    const alertIndicies: { [key: string]: number } = {};

    alertCategories.forEach((style, i) => {
      alertIndicies[style] = i;
    });

    closestTrailheads.sort((a, b) => {
      const aDist = a.properties.distanceFromSelectedMi;
      const aIndex = alertIndicies[a.properties.alertStyle?.category];
      const bDist = b.properties.distanceFromSelectedMi;
      const bIndex = alertIndicies[b.properties.alertStyle?.category];
      if (aDist == undefined || bDist == undefined || aIndex == undefined || bIndex == undefined) {
        return 0;
      }
      if (aDist == 0) {
        return -3;
      } else if (bDist == 0) {
        return 3;
      }
      if (aIndex < bIndex) {
        return -2;
      } else if (bIndex < aIndex) {
        return 2;
      } else if (aDist < bDist) {
        return -1;
      } else {
        return 1;
      }
    });

    closestTrailheads = closestTrailheads.slice(1);
    closestTrailheads = closestTrailheads.filter((a) => {
      if (a.properties.alertStyle == undefined || a.properties.distanceFromSelectedMi == undefined) return false;
      return a.properties.name !== '' && a.properties.distanceFromSelectedMi <= MAX_DIST_MI;
    });
    closestTrailheads.forEach(th => {
      const indexString = th.properties.alertStyle?.category.toLowerCase().replace('/', '');
      this.trailheadRecommendationData[indexString].push(th);
    });
  }
}
