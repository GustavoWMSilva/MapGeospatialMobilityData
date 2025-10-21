import type { Location } from '../types';

export const LOCATIONS: Location[] = [
  { name: "Nova York", longitude: -74.0060, latitude: 40.7128, zoom: 12 },
  { name: "São Paulo", longitude: -46.6333, latitude: -23.5505, zoom: 11 },
  { name: "Londres", longitude: -0.1276, latitude: 51.5074, zoom: 11 },
  { name: "Tóquio", longitude: 139.6917, latitude: 35.6895, zoom: 11 },
  { name: "Porto Alegre", longitude: -51.2177, latitude: -30.0346, zoom: 12 }
];

export const DEFAULT_VIEW_STATE = {
  longitude: -100,
  latitude: 40,
  zoom: 3.5
};