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