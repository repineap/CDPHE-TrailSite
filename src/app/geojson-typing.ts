export interface Geometry {
  type: string;
  coordinates: [number, number];
}

export interface MultiGeometry {
  type: string;
  coordinates: number[][][]
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

export interface Facility {
  type: string;
  geometry: Geometry;
  properties: FacilityProperties;
}

export interface FacilityProperties {
  PROPNAME: string;
  PROP_TYPE: string;
  PARK_ID: string;
  FAC_ID: string;
  FAC_TYPE: number;
  TYPE_DETAI: string;
  HANDI_ACCE: string;
  FAC_NAME: string;
  CONDITION: string;
  SITE_COUNT: number;
  COUNT_TYPE: string;
  PHOTO: string;
  MGMT_AUTH: string;
  WINTER_STA: string;
  ST_ADDRESS: string;
  SOURCE: string;
  COMMENTS: string;
  EDIT_DATE: string;
  RuleID: number;
  RuleID_1: number;
  RuleID_2: number;
  RuleID_HC: number;
  SYM_CHAR: string;
  COLL_DATE: string;
  ORG_OID: number;
  TempDetail: number;
  Input_Date: string;
  GlobalID: string;
  d_PROP_TYP: string;
  d_FAC_TYPE: string;
  d_TYPE_DET: string;
  d_HANDI_AC: string;
  d_CONDITIO: string;
  d_MGMT_AUT: string;
  d_WINTER_S: string;
  d_SOURCE: string;
  d_SYM_CHAR: string;
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
}