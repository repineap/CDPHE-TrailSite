import { Injectable } from '@angular/core';

const aqiStyles: { [key: string]: any} = {
  "#Unavailable": {
      "fillColor": "#cccccc",
      "fillOpacity": 0.81,
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
    "fillColor": "#FFA500",  // Orange for Ozone Action Day Alerts
    "fillOpacity": 0.81,
    // "color": "#FFA500",
    "color": "black",
    "opacity": 1,
    "weight": 1.5
  },
  "#ParticulatesActionDay": {
    "fillColor": "#FF4500",  // Red-Orange for Action Day for Particulates
    "fillOpacity": 0.81,
    // "color": "#FF4500",
    "color": "black",
    "opacity": 1,
    "weight": 0
  },
  "#MultiplePollutantsActionDay": {
    "fillColor": "#5c005c",  // Purple color for Action Day for Multiple Pollutants
    "fillOpacity": 0.81,
    // "color": "#5c005c",
    "color": "black",
    "opacity": 1,
    "weight": 1.5
  },
  "#WildfireSmokeAdvisory": {
    "fillColor": "#636263",  // Gray for Wildfire Smoke Advisories
    "fillOpacity": 0.81,
    // "color": "#636263",
    "color": "black",
    "opacity": 1,
    "weight": 1.5
  },
  "#FineParticulatesAdvisory": {
    "fillColor": "#708090",  // Slate gray for Fine Particulates Advisories
    "fillOpacity": 0.81,
    // "color": "#708090",
    "color": "black",
    "opacity": 1,
    "weight": 1.5
  },
  "#OzoneAdvisory": {
    "fillColor": "#4682B4",  // Steel blue for Ozone Advisories
    "fillOpacity": 0.81,
    // "color": "#4682B4",
    "color": "black",
    "opacity": 1,
    "weight": 1.5
  },
  "#BlowingDustAdvisory": {
    "fillColor": "#D2B48C",  // Tan for Blowing Dust Advisories
    "fillOpacity": 0.81,
    // "color": "#D2B48C",
    "color": "black",
    "opacity": 1,
    "weight": 1.5
  },
  "#MultiplePollutantsAdvisory": {
    // "fillColor": "#8B0000",  // Dark red for Multiple Pollutants Advisories
    // "fillOpacity": 0.81,
    // "color": "#8B0000",
    // "opacity": 1,
    // "weight": 1.5
    "fillColor": "#5c005c",  // Purple color for Action Day for Multiple Pollutants
    "fillOpacity": 0.81,
    // "color": "#5c005c",
    "color": "black",
    "opacity": 1,
    "weight": 1.5
  },
  "#Default": {
    "fillColor": "orange",  // Should never be grabbed
    "fillOpacity": 1,
    "color": "black",
    "opacity": 1,
    "weight": 20
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
