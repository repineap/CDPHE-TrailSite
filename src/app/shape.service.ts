import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ShapeService {

  constructor(private _http: HttpClient) { }

  getCotrexShapes() {
    return this._http.get('/assets/data/COTREX-geo.json');
  }

  getTodayAQIShapes() {
    return this._http.get('/assets/data/today_aqi.geojson');
  }

  getTomorrowAQIShapes() {
    return this._http.get('/assets/data/tomorrow_aqi.geojson');
  }

  getTrailheadShapes() {
    return this._http.get('/assets/data/Trailheads_COTREX.json');
  }

  getFacilityShapes() {
    return this._http.get('/assets/data/CPWFacilities.json');
  }
}
