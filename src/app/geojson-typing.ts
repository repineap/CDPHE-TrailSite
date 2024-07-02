export interface Geometry {
    type: string;
    coordinates: [number, number];
  }
  
  export interface TrailheadProperties {
    feature_id: number;
    place_id: number;
    name: string;
    alt_name: string;
    type: string;
    bathrooms: string;
    fee: string;
    water: string;
    manager: string;
    INPUT_DATE: string;
    EDIT_DATE: string;
    winter_act: string;
  }
  
  export interface Trailhead {
    type: string;
    geometry: Geometry;
    properties: TrailheadProperties;
  }
  
  export interface CityCenterProperties {
    OBJECTID: number;
    gaz_id: number;
    gaz_featur: string;
    fcode: number;
    name: string;
    county: string;
    state: string;
    Latitude: number;
    Longitude: number;
  }
  
  export interface CityCenter {
    type: string;
    properties: CityCenterProperties;
    geometry: Geometry;
  }