import React, { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';

interface LTLACentroid {
  code: string;
  name: string;
  lat: number;
  lon: number;
  msoa_count: number;
}

interface LTLAPointsProps {
  isVisible?: boolean;
  pointColor?: string;
  pointSize?: number;
  selectedLTLA?: string | null;
}

export const LTLAPoints: React.FC<LTLAPointsProps> = ({
  isVisible = true,
  pointColor = '#8B5CF6',
  pointSize = 6,
  selectedLTLA = null
}) => {
  const [ltlaGeoJSON, setLtlaGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/data/lookup/ltla_centroids.csv')
      .then(response => response.text())
      .then(csvText => {
        const lines = csvText.split('\n');
        
        const data: LTLACentroid[] = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',');
            return {
              code: values[0]?.trim() || '',
              name: values[1]?.trim() || '',
              lat: parseFloat(values[2]?.trim() || '0'),
              lon: parseFloat(values[3]?.trim() || '0'),
              msoa_count: parseInt(values[4]?.trim() || '0')
            };
          })
          .filter(row => row.code && row.lat && row.lon);

        // Converter para GeoJSON
        const features = data.map(ltla => ({
          type: 'Feature' as const,
          properties: {
            code: ltla.code,
            name: ltla.name,
            msoa_count: ltla.msoa_count,
            isSelected: ltla.code === selectedLTLA
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [ltla.lon, ltla.lat]
          }
        }));

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features
        };

        setLtlaGeoJSON(geojson);
        setLoading(false);
        console.log('✅ Pontos LTLA carregados:', features.length);
      })
      .catch(err => {
        console.error('❌ Erro ao carregar LTLAs:', err);
        setLoading(false);
      });
  }, [selectedLTLA]);

  if (loading || !ltlaGeoJSON || !isVisible) {
    return null;
  }

  return (
    <>
      <Source
        id="ltla-points"
        type="geojson"
        data={ltlaGeoJSON}
      >
        {/* Círculos para LTLAs não selecionados */}
        <Layer
          id="ltla-points-layer"
          type="circle"
          filter={['!', ['get', 'isSelected']]}
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'msoa_count'],
              0, pointSize * 0.8,
              50, pointSize,
              100, pointSize * 1.3,
              200, pointSize * 1.6
            ],
            'circle-color': pointColor,
            'circle-opacity': 0.7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': 0.9
          }}
        />
        
        {/* Círculo destacado para LTLA selecionado */}
        <Layer
          id="ltla-points-selected"
          type="circle"
          filter={['get', 'isSelected']}
          paint={{
            'circle-radius': pointSize * 2,
            'circle-color': '#EF4444',
            'circle-opacity': 0.9,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FFFFFF'
          }}
        />
        
        {/* Labels dos LTLAs */}
        <Layer
          id="ltla-labels"
          type="symbol"
          minzoom={8}
          layout={{
            'text-field': ['get', 'name'],
            'text-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 10,
              12, 14
            ],
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-max-width': 10
          }}
          paint={{
            'text-color': '#1F2937',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2
          }}
        />
        
        {/* Label destacado para selecionado */}
        <Layer
          id="ltla-selected-label"
          type="symbol"
          filter={['get', 'isSelected']}
          layout={{
            'text-field': ['get', 'name'],
            'text-size': 16,
            'text-offset': [0, 2],
            'text-anchor': 'top'
          }}
          paint={{
            'text-color': '#EF4444',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2
          }}
        />
      </Source>
    </>
  );
};
