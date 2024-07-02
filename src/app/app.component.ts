import { Component, EventEmitter, Output } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './map/map.component';
import { ShapeService } from './shape.service';
import { MarkerService } from './marker.service';
import { PopupService } from './popup.service';
import { HttpClientModule } from '@angular/common/http';
import { AutocompleteLibModule } from 'angular-ng-autocomplete';
import {sideBarComponent} from './sideBar/sideBar.component'

import * as L from 'leaflet';

@Component({
    selector: 'app-root',
    standalone: true,
    providers: [ShapeService, MarkerService, PopupService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [RouterOutlet, MapComponent, HttpClientModule, AutocompleteLibModule, sideBarComponent]
})

export class AppComponent {
  title = 'InternshipWebsite';
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();
  public currentMapBounds = L.latLngBounds(L.latLng(37.18657859524883, -109.52819824218751), L.latLng(40.76806170936614, -102.04101562500001));

  data = [
    {
      id: 1,
      name: 'Georgia'
    },
     {
       id: 2,
       name: 'Usa'
     },
     {
       id: 3,
       name: 'England'
     },
     {
      id: 1,
      name: 'Georgia'
    },
     {
       id: 2,
       name: 'Usa'
     },
     {
       id: 3,
       name: 'England'
     }
  ];
  keyword = 'name';

  selectEvent($event: any) {
    console.log($event);
  }

  notifySidebar($event: L.LatLngBounds) {
    this.currentMapBounds = $event;
  }
}
