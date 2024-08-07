import { Injectable } from '@angular/core';

const aqiStyles: { [key: string]: any} = {
  "#Unavailable": {
      "fillColor": "#cccccc",
      "fillOpacity": 0.149,
      "color": "#cccccc",
      "opacity": 1,
      "weight": 0
  },
  "#Invisible": {
      "fillColor": "#000000",
      "fillOpacity": 0.0,
      "color": "#000000",
      "opacity": 1,
      "weight": 0
  },
  "#Good": {
      "fillColor": "#00E400",
      "fillOpacity": 0.151,
      "color": "#00E400",
      "opacity": 1,
      "weight": 0
  },
  "#Moderate": {
      "fillColor": "#ffff00",
      "fillOpacity": 0.201,
      "color": "#ffff00",
      "opacity": 1,
      "weight": 0
  },
  "#UnhealthySG": {
      "fillColor": "#ff7e00",
      "fillOpacity": 0.251,
      "color": "#ff7e00",
      "opacity": 1,
      "weight": 0
  },
  "#Unhealthy": {
      "fillColor": "#ff0000",
      "fillOpacity": 0.251,
      "color": "#ff0000",
      "opacity": 1,
      "weight": 0
  },
  "#VeryUnhealthy": {
      "fillColor": "#99004c",
      "fillOpacity": 0.251,
      "color": "#99004c",
      "opacity": 1,
      "weight": 0
  },
  "#Hazardous": {
      "fillColor": "#7e0023",
      "fillOpacity": 0.251,
      "color": "#7e0023",
      "opacity": 1,
      "weight": 0
  }
}

const alertStyles: { [key: string]: any } = {
  "#OzoneActionDay": {
    "fillColor": "#ff4242",  // Red for Ozone Action Day Alerts
    "fillOpacity": 0.149,
    // "color": "#FFA500",
    "color": "black",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Ozone'
  },
  "#ParticulatesActionDay": {
    "fillColor": "#FFA500",  // Orange for particulate Action Day Alerts
    "fillOpacity": 0.149,
    // "color": "#FFA500",
    "color": "black",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Fine'
  },
  "#MultiplePollutantsActionDay": {
    "fillColor": "#8B295A",  // Purple Red for Multiple Pollutants Advisories
    "fillOpacity": 0.149,
    "color": "#8B0000",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Multiple'
  },
  "#WildfireSmokeAdvisory": {
    "fillColor": "#FFA500",  // Orange for particulate Action Day Alerts
    "fillOpacity": 0.149,
    // "color": "#636263",
    "color": "black",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Fine'
  },
  "#FineParticulatesAdvisory": {
    "fillColor": "#FFA500",  // Orange for particulate Action Day Alerts
    "fillOpacity": 0.149,
    // "color": "#FFA500",
    "color": "black",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Fine'
  },
  "#OzoneAdvisory": {
    "fillColor": "#ff4242",  // Red for Ozone Action Day Alerts
    "fillOpacity": 0.149,
    // "color": "#FFA500",
    "color": "black",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Ozone'
  },
  "#BlowingDustAdvisory": {
    "fillColor": "#fff200",  // Yellow for Dust Advisories
    "fillOpacity": 0.149,
    // "color": "#636263",
    "color": "black",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Dust'
  },
  "#MultiplePollutantsAdvisory": {
    "fillColor": "#8B295A",  // Purple Red for Multiple Pollutants Advisories
    "fillOpacity": 0.149,
    "color": "#8B0000",
    "opacity": 1,
    "weight": 1.5,
    "category": 'Multiple'
  },
  "#Default": {
    "fillColor": "#00E400",  // Should never be grabbed
    "fillOpacity": 0.149,
    "color": "black",
    "opacity": 1,
    "weight": 1.5,
    "category": 'None'
  }
};

@Injectable({
  providedIn: 'root'
})
export class GeoStylingService {

  constructor() { }

  public getStyleForAQI(styleUrl: string): any {
    return aqiStyles[styleUrl];
  }

  public getStyleForAlert(NWSheadline: string) {
    const query = NWSheadline.toLowerCase();
    if (query.toLowerCase().includes('action day')) {
      if (query.includes('ozone')) {
        return alertStyles['#OzoneActionDay'];
      } else if (query.includes('particulates')) {
        return alertStyles['#ParticulatesActionDay'];
      } else if (query.includes('multiple')) {
        return alertStyles['#MultiplePollutantsActionDay'];
      } else {
        return alertStyles['#Default'];
      }
    } else {
      if (query.includes('smoke')) {
        return alertStyles['#WildfireSmokeAdvisory'];
      } else if (query.includes('particulates')) {
        return alertStyles['#FineParticulatesAdvisory'];
      } else if (query.includes('ozone')) {
        return alertStyles['#OzoneAdvisory'];
      } else if (query.includes('dust')) {
        return alertStyles['#BlowingDustAdvisory'];
      } else if (query.includes('multiple')) {
        return alertStyles['#MultiplePollutantsAdvisory'];
      } else {
        return alertStyles['#Default'];
      }
    }
  }
}
