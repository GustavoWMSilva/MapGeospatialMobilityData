import React, { useEffect } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';

interface AnimatedLinesProps {
  mapRef: React.RefObject<MapRef | null>;
  linesGeoJSON: GeoJSON.FeatureCollection;
  animatedPointsGeoJSON: GeoJSON.FeatureCollection;
}

export const AnimatedLines: React.FC<AnimatedLinesProps> = ({
  mapRef,
  linesGeoJSON,
  animatedPointsGeoJSON
}) => {
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Configurar estilo de linha tracejada
    const updateLineDash = () => {
      if (map.getLayer('animated-lines')) {
        const dashOffset = (Date.now() / 100) % 10;
        map.setPaintProperty('animated-lines', 'line-dasharray', [2, 3]);
        map.setPaintProperty('animated-lines', 'line-dash-offset', dashOffset);
      }
    };

    const interval = setInterval(updateLineDash, 100);
    
    return () => clearInterval(interval);
  }, [mapRef]);

  return (
    <>
      {/* Linhas animadas */}
      <Source
        id="lines-source"
        type="geojson"
        data={linesGeoJSON}
      >
        <Layer
          id="animated-lines"
          type="line"
          paint={{
            'line-color': '#ff6b6b',
            'line-width': 3,
            'line-opacity': 0.8,
            'line-dasharray': [2, 3]
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round'
          }}
        />
      </Source>

      {/* Pontos que se movem ao longo das linhas */}
      <Source
        id="animated-points-source"
        type="geojson"
        data={animatedPointsGeoJSON}
      >
        <Layer
          id="animated-points"
          type="circle"
          paint={{
            'circle-color': '#ff6b6b',
            'circle-radius': 6,
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }}
        />
      </Source>
    </>
  );
};