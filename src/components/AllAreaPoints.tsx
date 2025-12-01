import React, { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';

interface AreaCentroid {
  code: string;
  name: string;
  lat: string;
  lon: string;
}

interface AllAreaPointsProps {
  isVisible?: boolean;
  pointColor?: string;
  pointSize?: number;
  onPointClick?: (areaCode: string) => void;
}

export const AllAreaPoints: React.FC<AllAreaPointsProps> = ({
  isVisible = true,
  pointColor = '#3B82F6',
  pointSize = 3
}) => {
  const [centroidsGeoJSON, setCentroidsGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/data/lookup/areas_centroids.csv')
      .then(response => response.text())
      .then(csvText => {
        // Função para fazer parsing correto de CSV com campos entre aspas
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

        // Parse CSV
        const lines = csvText.split('\n');
        const data: AreaCentroid[] = lines.slice(1).map(line => {
          const values = parseCSVLine(line);
          return {
            code: values[0]?.trim() || '',
            name: values[1]?.trim() || '',
            lat: values[2]?.trim() || '',
            lon: values[3]?.trim() || ''
          };
        }).filter(row => row.code && row.lat && row.lon);

        // Converter para GeoJSON
        const features = data.map(area => ({
          type: 'Feature' as const,
          properties: {
            code: area.code,
            name: area.name
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [parseFloat(area.lon), parseFloat(area.lat)]
          }
        }));

        const geojson: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features
        };

        setCentroidsGeoJSON(geojson);
        setLoading(false);
        console.log('✅ Pontos de áreas carregados:', features.length);
      })
      .catch(err => {
        console.error('❌ Erro ao carregar pontos:', err);
        setLoading(false);
      });
  }, []);

  if (loading || !centroidsGeoJSON || !isVisible) {
    return null;
  }

  return (
    <>
      <Source
        id="all-area-points"
        type="geojson"
        data={centroidsGeoJSON}
      >
        {/* Círculos representando os centróides */}
        <Layer
          id="all-area-points-layer"
          type="circle"
          paint={{
            'circle-radius': pointSize,
            'circle-color': pointColor,
            'circle-opacity': 0.6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-opacity': 0.8
          }}
        />
        
        {/* Labels para zoom próximo */}
        <Layer
          id="area-points-labels"
          type="symbol"
          minzoom={12} // Mostrar labels apenas em zoom próximo
          layout={{
            'text-field': ['get', 'code'],
            'text-size': 10,
            'text-offset': [0, 1.5],
            'text-anchor': 'top'
          }}
          paint={{
            'text-color': '#1F2937',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 1
          }}
        />
      </Source>
    </>
  );
};
