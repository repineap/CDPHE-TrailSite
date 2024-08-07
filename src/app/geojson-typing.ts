export interface Geometry {
  type: string;
  coordinates: [number, number];
}

export interface MultiGeometry {
  type: string;
  coordinates: Array<Array<[number, number]>>
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
  alertStyle: alertStyle | undefined;
  distanceFromSelectedMi: number | undefined;
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
  alertStyle: alertStyle | undefined;
  distanceFromSelectedMi: number | undefined;
}

export interface CityCenter {
  type: string;
  properties: CityCenterProperties;
  geometry: Geometry;
}

export interface Trail {
  type: string,
  id: string,
  geometry: MultiGeometry,
  geometry_name: string,
  properties: TrailProperties
}

export interface TrailProperties {
  ogc_fid: number;
  feature_id: string;
  place_id: number;
  name: string;
  place_id_1: number;
  name_1: string;
  place_id_2: number;
  name_2: string;
  place_id_3: number;
  name_3: string;
  trail_num: string;
  surface: string;
  oneway: string;
  type: string;
  hiking: string;
  horse: string;
  bike: string;
  motorcycle: string;
  atv: string;
  ohv_gt_50: string;
  highway_ve: string;
  dogs: string;
  access: string;
  min_elevat: number;
  max_elevat: number;
  length_mi_: number;
  manager: string;
  SHAPE_STLe: number;
  alertStyle: alertStyle | undefined;
  distanceFromSelectedMi: number | undefined;
}

export interface alertStyle {
  color: string;
  category: any;
}

export interface RecommendationQuery {
  maxDistMi: number,
  alertLevels: AlertLevelStructure
}

export interface AlertLevelStructure {
  [key: string]: boolean
  "None": boolean,
  "Blowing Dust": boolean,
  "Fine Particulate": boolean,
  "Ozone": boolean,
  "Multiple": boolean
}

export interface WeatherAlertJSON {
  "@context": string[],
  features: WeatherAlert[],
  title: string,
  type: string,
  updated: string
}

export interface WeatherAlert {
  id: string;
  type: string;
  geometry: null;
  properties: WeatherAlertProperties;
}

export interface WeatherAlertProperties {
  "@id": string;
  "@type": string;
  id: string;
  areaDesc: string;
  geocode: Geocode;
  affectedZones: string[];
  references: any[];
  sent: string;
  effective: string;
  onset: string;
  expires: string;
  ends: null;
  status: string;
  messageType: string;
  category: string;
  severity: string;
  certainty: string;
  urgency: string;
  event: string;
  sender: string;
  senderName: string;
  headline: string;
  description: string;
  instruction: null;
  response: string;
  parameters: WeatherAlertParameters;
}

export interface Geocode {
  SAME: string[];
  UGC: string[];
}

export interface WeatherAlertParameters {
  AWIPSidentifier: string[];
  WMOidentifier: string[];
  NWSheadline: string[];
  BLOCKCHANNEL: string[];
}

export interface WeatherAlertDescription {
  issuer: string;
  what: string;
  where: string;
  when: string;
  impacts: string;
  healthInformation: string;
}