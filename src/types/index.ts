export interface Location {
  name: string;
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface Point {
  lng: number;
  lat: number;
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// Flow Data Types
export interface FlowResult {
  origin_code: string;
  dest_code: string;
  count: number;
}

export interface SocialGradeFlowResult extends FlowResult {
  social_grade_code: number;
  social_grade: string;
}

export interface AgeFlowResult extends FlowResult {
  age_code: number;
  age_group: string;
}

export interface SocialGradeStats {
  grade: string;
  total: number;
  percentage: number;
}

export interface AgeStats {
  ageGroup: string;
  total: number;
  percentage: number;
}

export type SocialGrade = 'AB' | 'C1' | 'C2' | 'DE' | 'all';
export type AgeGroup = 
  | 'Aged 16 to 24 years'
  | 'Aged 25 to 34 years' 
  | 'Aged 35 to 44 years'
  | 'Aged 45 to 54 years'
  | 'Aged 55 to 64 years'
  | 'Aged 65 years and over'
  | 'all';