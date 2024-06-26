import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeoStylingService {

  constructor() { }

  public getStyleForAQI(styleUrl: string): any {
    const aqiStyles: { [key: string]: any} = {
      "#Unavailable": {
          "fillColor": "#cccccc",
          "fillOpacity": 0.4,
          "color": "#cccccc",
          "opacity": 1,
          "weight": 2
      },
      "#Invisible": {
          "fillColor": "#000000",
          "fillOpacity": 0.0,
          "color": "#000000",
          "opacity": 1,
          "weight": 2
      },
      "#Good": {
          "fillColor": "#00E400",
          "fillOpacity": 0.151,
          "color": "#00E400",
          "opacity": 1,
          "weight": 2
      },
      "#Moderate": {
          "fillColor": "#ffff00",
          "fillOpacity": 0.201,
          "color": "#ffff00",
          "opacity": 1,
          "weight": 2
      },
      "#UnhealthySG": {
          "fillColor": "#ff7e00",
          "fillOpacity": 0.251,
          "color": "#ff7e00",
          "opacity": 1,
          "weight": 2
      },
      "#Unhealthy": {
          "fillColor": "#ff0000",
          "fillOpacity": 0.251,
          "color": "#ff0000",
          "opacity": 1,
          "weight": 2
      },
      "#VeryUnhealthy": {
          "fillColor": "#99004c",
          "fillOpacity": 0.251,
          "color": "#99004c",
          "opacity": 1,
          "weight": 2
      },
      "#Hazardous": {
          "fillColor": "#7e0023",
          "fillOpacity": 0.251,
          "color": "#7e0023",
          "opacity": 1,
          "weight": 2
      }
    }

    return aqiStyles[styleUrl];
  }
}
