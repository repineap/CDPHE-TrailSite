import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ShapeService {

  constructor(private _http: HttpClient) { }

  getStateShapes() {
    return this._http.get('/assets/data/gz_2010_us_040_00_5m.json');
  }

  getCotrexShapes() {
    return this._http.get('/assets/data/COTREX-geo.json');
  }
}
