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
    return this._http.get('https://aarepinecdphe.pythonanywhere.com/todayAQI');
    // return this._http.get('/assets/data/today_aqi.geojson');
  }

  getTomorrowAQIShapes() {
    return this._http.get('https://aarepinecdphe.pythonanywhere.com/tomorrowAQI');
    // return this._http.get('/assets/data/tomorrow_aqi.geojson');
  }

  getTrailheadShapes() {
    return this._http.get('/assets/data/Trailheads_COTREX.json');
  }

  getFacilityShapes() {
    return this._http.get('/assets/data/CPWFacilities.json');
  }

  getCityShapes() {
    return this._http.get('/assets/data/Colorado_City_Point_Locations.geojson');
  }

  getCountyShapes() {
    return this._http.get('/assets/data/Colorado_County_Boundaries.geojson');
  }

  getNWSAlerts() {
    return this._http.get('https://api.weather.gov/alerts/active/area/CO');
  }
}
