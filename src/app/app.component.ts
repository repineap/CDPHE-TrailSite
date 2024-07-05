import { AfterViewInit, Component, EventEmitter, HostListener, Output } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'; // Import FormsModule
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './map/map.component';
import { ShapeService } from './shape.service';
import { MarkerService } from './marker.service';
import { PopupService } from './popup.service';
import { HttpClientModule } from '@angular/common/http';
import {sideBarComponent} from './sideBar/sideBar.component'

import * as L from 'leaflet';
import { CityCenter, Trailhead } from './geojson-typing';
import { DescriptorCardComponent } from './descriptor-card/descriptor-card.component';

@Component({
    selector: 'app-root',
    standalone: true,
    providers: [ShapeService, MarkerService, PopupService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [RouterOutlet, MapComponent, HttpClientModule, sideBarComponent, DescriptorCardComponent, FormsModule, ReactiveFormsModule]
})

export class AppComponent {
  title = 'InternshipWebsite';
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();
  public currentMapBounds = L.latLngBounds(L.latLng(37.18657859524883, -109.52819824218751), L.latLng(40.76806170936614, -102.04101562500001));
  public currentSearchQuery = '';
  public selectedTrailhead!: Trailhead;
  public selectedTrailheadCoordinates!: [number, number];
  public searchControl = new FormControl('');

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
