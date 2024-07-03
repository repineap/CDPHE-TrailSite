import { AfterViewInit, Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './map/map.component';
import { ShapeService } from './shape.service';
import { MarkerService } from './marker.service';
import { PopupService } from './popup.service';
import { HttpClientModule } from '@angular/common/http';
import {sideBarComponent} from './sideBar/sideBar.component'

import * as L from 'leaflet';
import { CityCenter, Trailhead } from './geojson-typing';

@Component({
    selector: 'app-root',
    standalone: true,
    providers: [ShapeService, MarkerService, PopupService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [RouterOutlet, MapComponent, HttpClientModule, sideBarComponent, FormsModule]
})

export class AppComponent {
  title = 'InternshipWebsite';
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();
  public currentMapBounds = L.latLngBounds(L.latLng(37.18657859524883, -109.52819824218751), L.latLng(40.76806170936614, -102.04101562500001));
  public currentSearchQuery = '';

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
}
