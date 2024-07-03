import { AfterViewInit, Component, EventEmitter, Output } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MapComponent } from './map/map.component';
import { ShapeService } from './shape.service';
import { MarkerService } from './marker.service';
import { PopupService } from './popup.service';
import { HttpClientModule } from '@angular/common/http';
import { AutocompleteLibModule } from 'angular-ng-autocomplete';
import {sideBarComponent} from './sideBar/sideBar.component'

import * as L from 'leaflet';
import { CityCenter, Trailhead } from './geojson-typing';

@Component({
    selector: 'app-root',
    standalone: true,
    providers: [ShapeService, MarkerService, PopupService],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
    imports: [RouterOutlet, MapComponent, HttpClientModule, AutocompleteLibModule, sideBarComponent]
})

export class AppComponent implements AfterViewInit {
  title = 'InternshipWebsite';
  @Output() mapBoundsChange = new EventEmitter<L.LatLngBounds>();
  public currentMapBounds = L.latLngBounds(L.latLng(37.18657859524883, -109.52819824218751), L.latLng(40.76806170936614, -102.04101562500001));
  public currentSearchQuery = {};
  public searchData: any[] = [];

  constructor(private _shapeService: ShapeService) {}

  ngAfterViewInit(): void {
      this._shapeService.getCityShapes().subscribe((cityCenters: any) => {
        cityCenters.features.forEach((cc: CityCenter) => {
          if (cc.properties.name === '') return;
          const location = `${cc.properties.name}, ${cc.properties.county} County`;
          this.searchData.push({
            "location": location,
            "OBJECTID": cc.properties.OBJECTID
          });
        })
      });
  }

  searchKeyword = 'location';

  selectEvent($event: any) {
    console.log($event);
    this.currentSearchQuery = $event;
  }

  notifySidebar($event: L.LatLngBounds) {
    this.currentMapBounds = $event;
  }
}
