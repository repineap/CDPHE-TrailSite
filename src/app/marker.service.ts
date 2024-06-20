import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PopupService } from './popup.service';
import * as L from 'leaflet';

@Injectable({
  providedIn: 'root'
})
export class MarkerService {
  capitals: string = '/assets/data/usa-capitals.geojson';

  constructor(private _http: HttpClient, private _popupService: PopupService) { }

  makeCapitalMarkers(map: L.Map): void {
    this._http.get(this.capitals).subscribe((resp: any) => {
      for (const c of resp.features) {
        const lon = c.geometry.coordinates[0];
        const lat = c.geometry.coordinates[1];
        const marker = L.marker([lat, lon]);

        marker.addTo(map);
      }
    })
  }

  static scaledRadius(val: number, maxVal: number): number {
    return 20 * (val / maxVal);
  }

  makeCapitalCircleMarkers(map: L.Map) {
    this._http.get(this.capitals).subscribe((resp: any) => {
      const maxPop = Math.max(...resp.features.map((x: any) => x.properties.population), 0);
      for (const c of resp.features) {
        const lon = c.geometry.coordinates[0];
        const lat = c.geometry.coordinates[1];
        const circle = L.circleMarker([lat, lon], { radius: MarkerService.scaledRadius(c.properties.population, maxPop) });

        circle.bindPopup(this._popupService.makeCapitalPopup(c.properties));

        circle.addTo(map);
      }
    });
  }
}
