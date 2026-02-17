import React, { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { MAP_COLORS } from '../constants/mapColors';

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
  pointColor = MAP_COLORS.points.ltla,
  pointSize = 5,
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
        
        // Função para fazer parse correto de CSV com campos quoted
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let insideQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };
        
        const data: LTLACentroid[] = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = parseCSVLine(line);
            return {
              code: values[0] || '',
              name: values[1] || '',
              lat: parseFloat(values[2] || '0'),
              lon: parseFloat(values[3] || '0'),
              msoa_count: parseInt(values[4] || '0')
            };
          })
          .filter(row => row.code && row.lat && row.lon && row.lat !== 0 && row.lon !== 0);

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
        console.log('📍 Exemplo de pontos:', features.slice(0, 3).map(f => ({ 
          code: f.properties.code, 
          coords: f.geometry.coordinates 
        })));
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
            'circle-opacity': MAP_COLORS.points.ltlaOpacity,
            'circle-stroke-width': MAP_COLORS.points.strokeWidth,
            'circle-stroke-color': MAP_COLORS.points.stroke,
            'circle-stroke-opacity': MAP_COLORS.points.strokeOpacity
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
        
      </Source>
    </>
  );
};
