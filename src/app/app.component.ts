import { Component, EventEmitter, Output } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'; // Import FormsModule
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './map/map.component';
import { ShapeService } from './shape.service';
import { MarkerService } from './marker.service';
import { PopupService } from './popup.service';
import { HttpClientModule } from '@angular/common/http';
import { sideBarComponent } from './sideBar/sideBar.component';

import * as L from 'leaflet';
import { Trailhead } from './geojson-typing';
import { DescriptorCardComponent } from './descriptor-card/descriptor-card.component';
import { RecommendationSidebarComponent } from "./recommendation-sidebar/recommendation-sidebar.component";
import { CommonModule } from '@angular/common';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-root',
  standalone: true,
  providers: [ShapeService, MarkerService, PopupService],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  imports: [CommonModule, RouterOutlet, MapComponent, HttpClientModule, sideBarComponent, DescriptorCardComponent, FormsModule, ReactiveFormsModule, RecommendationSidebarComponent],
  animations: [
    trigger('slideInOut', [
      state('in', style({
        transform: 'translateX(0)'
      })),
      state('out', style({
        transform: 'translateX(-100%)'
      })),
      transition('in => out', animate('300ms ease-in-out')),
      transition('out => in', animate('300ms ease-in-out'))
    ])
  ]
})

export class AppComponent {
  title = 'InternshipWebsite';
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();
  public currentMapBounds = L.latLngBounds(L.latLng(37.18657859524883, -109.52819824218751), L.latLng(40.76806170936614, -102.04101562500001));
  public currentSearchQuery = '';
  public selectedTrailhead!: Trailhead;
  public selectedTrailheadCoordinates!: [number, number];
  public searchControl = new FormControl('');
  public recommendedTrailheads!: Trailhead[];
  public recommendationsOpen: boolean = false;

  constructor() {
    this.searchControl.valueChanges.subscribe(value => {
      if (value) {
        this.currentSearchQuery = value;
      } else {
        this.currentSearchQuery = 'EMPTY_SEARCH';
      }
    })
  }

  public notifySidebar($event: L.LatLngBounds) {
    this.currentMapBounds = $event;
  }

  public notifyRecommendations($event: Trailhead[]) {
    this.recommendedTrailheads = $event;
    this.recommendationsOpen = true;
  }

  public closeRecommendations($event: boolean) {
    this.recommendationsOpen = false;
  }

  searchQuery: string = '';

  filterTrails(query: string): void {
    if (query === '') {
      this.currentSearchQuery = 'DEFAULT_SEARCH';
    }
    this.currentSearchQuery = query;
  }

  onSubmit(): void {
    this.filterTrails(this.searchQuery);
  }

  zoomToTrailhead($event: Trailhead) {
    this.selectedTrailhead = $event;
    this.selectedTrailheadCoordinates = $event.geometry.coordinates;
  }
}
