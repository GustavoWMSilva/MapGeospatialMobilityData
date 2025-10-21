import { useState, useCallback } from 'react';
import type { Point, Location } from '../types';
import type { MapRef } from '@vis.gl/react-maplibre';

export const useMapNavigation = (mapRef: React.RefObject<MapRef | null>) => {
  const [points, setPoints] = useState<Point[]>([]);

  const addPoint = useCallback((lng: number, lat: number) => {
    setPoints(prev => [...prev, { lng, lat }]);
  }, []);

  const clearPoints = useCallback(() => {
    setPoints([]);
  }, []);

  const flyToLocation = useCallback((location: Location) => {
    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [location.longitude, location.latitude],
        zoom: location.zoom,
        duration: 2000,
        essential: true
      });
    }
  }, [mapRef]);

  const flyToPoint = useCallback((point: Point) => {
    const map = mapRef.current?.getMap();
    if (map) {
      map.flyTo({
        center: [point.lng, point.lat],
        zoom: 15,
        duration: 1500,
        essential: true
      });
    }
  }, [mapRef]);

  return {
    points,
    addPoint,
    clearPoints,
    flyToLocation,
    flyToPoint
  };
};