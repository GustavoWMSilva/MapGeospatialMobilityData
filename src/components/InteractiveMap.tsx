import React, { useMemo } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import maplibregl from 'maplibre-gl';
import type { Point, ViewState } from '../types';
import { AnimatedLines } from './AnimatedLines';

interface InteractiveMapProps {
  mapRef: React.RefObject<MapRef | null>;
  viewState: ViewState;
  points: Point[];
  markerRef: React.RefObject<maplibregl.Marker | null>;
  popup: maplibregl.Popup;
  onMove: (params: { viewState: ViewState }) => void;
  onClick: (event: { lngLat: { lng: number; lat: number } }) => void;
  onFlyToPoint: (point: Point) => void;
  linesGeoJSON?: GeoJSON.FeatureCollection;
  animatedPointsGeoJSON?: GeoJSON.FeatureCollection;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  mapRef,
  viewState,
  points,
  markerRef,
  popup,
  onMove,
  onClick,
  onFlyToPoint,
  linesGeoJSON,
  animatedPointsGeoJSON
}) => {
  const markers = useMemo(
    () =>
      points.map((p, i) => (
        <Marker 
          key={i} 
          longitude={p.lng} 
          latitude={p.lat} 
          color="blue"
          onClick={() => onFlyToPoint(p)}
        />
      )),
    [points, onFlyToPoint]
  );

  return (
    <div className="h-[calc(100vh-8rem)] overflow-hidden shadow">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={onMove}
        onClick={onClick}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
      >
        <Marker 
          longitude={-122.4} 
          latitude={37.8} 
          color="red" 
          popup={popup} 
          ref={markerRef} 
        />
        {markers}
        
        {/* Linhas animadas */}
        {linesGeoJSON && animatedPointsGeoJSON && (
          <AnimatedLines
            mapRef={mapRef}
            linesGeoJSON={linesGeoJSON}
            animatedPointsGeoJSON={animatedPointsGeoJSON}
          />
        )}
      </Map>
    </div>
  );
};