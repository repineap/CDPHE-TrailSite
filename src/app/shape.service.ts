import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, take, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ShapeService {
  private cotrexSubject = new BehaviorSubject<any>(null);
  private todayAQISubject = new BehaviorSubject<any>(null);
  private tomorrowAQISubject = new BehaviorSubject<any>(null);
  private trailheadSubject = new BehaviorSubject<any>(null);
  private facilitySubject = new BehaviorSubject<any>(null);
  private citySubject = new BehaviorSubject<any>(null);
  private countySubject = new BehaviorSubject<any>(null);
  private nwsAlertsSubject = new BehaviorSubject<any>(null);

  constructor(private _http: HttpClient) {
    this.fetchAllData();
  }

  private fetchAllData() {
    this.fetchCotrexShapes();
    this.fetchTodayAQIShapes();
    this.fetchTomorrowAQIShapes();
    this.fetchCountyShapes();
    this.fetchNWSAlerts();
    this.fetchTrailheadShapes();
    this.fetchFacilityShapes();
    this.fetchCityShapes();
  }

  // COTREX Shapes
  private fetchCotrexShapes() {
    try {
      this._http.get('/assets/data/COTREX-geo.json').pipe(
        tap(data => this.cotrexSubject.next(data))
      ).subscribe();
    } catch (error) {
      console.error("Error fetching COTREX data");
    }
  }

  getCotrexShapes(): Observable<any> {
    return this.cotrexSubject.asObservable().pipe(filter(data => data !== null), take(1));
  }

  // Today's AQI Shapes
  private fetchTodayAQIShapes() {
    this._http.get('https://aarepinecdphe.pythonanywhere.com/todayAQI').pipe(
      tap(data => this.todayAQISubject.next(data))
    ).subscribe();
  }

  getTodayAQIShapes(): Observable<any> {
    return this.todayAQISubject.asObservable().pipe(filter(data => data !== null), take(1));
  }

  // Tomorrow's AQI Shapes
  private fetchTomorrowAQIShapes() {
    this._http.get('https://aarepinecdphe.pythonanywhere.com/tomorrowAQI').pipe(
      tap(data => this.tomorrowAQISubject.next(data))
    ).subscribe();
  }

  getTomorrowAQIShapes(): Observable<any> {
    return this.tomorrowAQISubject.asObservable().pipe(filter(data => data !== null), take(1));
  }

  // Trailhead Shapes
  private fetchTrailheadShapes() {
    this._http.get('/assets/data/Trailheads_COTREX.json').pipe(
      tap(data => this.trailheadSubject.next(data))
    ).subscribe();
  }

  getTrailheadShapes(): Observable<any> {
    return this.trailheadSubject.asObservable().pipe(filter(data => data !== null), take(1));
  }

  // Facility Shapes
  private fetchFacilityShapes() {
    this._http.get('/assets/data/CPWFacilities.json').pipe(
      tap(data => this.facilitySubject.next(data))
    ).subscribe();
  }

  getFacilityShapes(): Observable<any> {
    return this.facilitySubject.asObservable().pipe(filter(data => data !== null), take(1));
  }

  // City Shapes
  private fetchCityShapes() {
    this._http.get('/assets/data/Colorado_City_Point_Locations.geojson').pipe(
      tap(data => this.citySubject.next(data))
    ).subscribe();
  }

  getCityShapes(): Observable<any> {
    return this.citySubject.asObservable().pipe(filter(data => data !== null), take(1));
  }

  // County Shapes
  private fetchCountyShapes() {
    this._http.get('/assets/data/Colorado_County_Boundaries.geojson').pipe(
      tap(data => this.countySubject.next(data))
    ).subscribe();
  }

  getCountyShapes(): Observable<any> {
    return this.countySubject.asObservable().pipe(filter(data => data !== null), take(1));
  }

  // NWS Alerts
  private fetchNWSAlerts() {
    this._http.get('https://api.weather.gov/alerts/active/area/CO').pipe(
      tap(data => this.nwsAlertsSubject.next(data))
    ).subscribe();
  }

  getNWSAlerts(): Observable<any> {
    return this.nwsAlertsSubject.asObservable().pipe(filter(data => data !== null), take(1));
  }
}

