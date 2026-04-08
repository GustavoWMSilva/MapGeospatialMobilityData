import React, { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { MAP_COLORS } from '../constants/mapColors';
import { getAggregateCentroidsPath } from '../constants/datasetProfiles';

interface AggregateAreaCentroid {
  code: string;
  name: string;
  lat: number;
  lon: number;
  base_count: number;
}

interface AggregateAreaPointsProps {
  isVisible?: boolean;
  pointColor?: string;
  pointSize?: number;
  selectedAggregateAreaCode?: string | null;
}

export const AggregateAreaPoints: React.FC<AggregateAreaPointsProps> = ({
  isVisible = true,
  pointColor = MAP_COLORS.points.ltla,
  pointSize = 5,
  selectedAggregateAreaCode = null,
}) => {
  const [aggregateAreaGeoJSON, setAggregateAreaGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    fetch(getAggregateCentroidsPath())
      .then((response) => response.text())
      .then((csvText) => {
        const lines = csvText.split('\n');

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let insideQuotes = false;

          for (let i = 0; i < line.length; i += 1) {
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

        const data: AggregateAreaCentroid[] = lines
          .slice(1)
          .filter((line) => line.trim())
          .map((line) => {
            const values = parseCSVLine(line);
            return {
              code: values[0] || '',
              name: values[1] || '',
              lat: parseFloat(values[2] || '0'),
              lon: parseFloat(values[3] || '0'),
              base_count: parseInt(values[4] || '0', 10),
            };
          })
          .filter((row) => row.code && row.lat && row.lon && row.lat !== 0 && row.lon !== 0);

        const features = data.map((aggregateArea) => ({
          type: 'Feature' as const,
          properties: {
            code: aggregateArea.code,
            name: aggregateArea.name,
            base_count: aggregateArea.base_count,
            isSelected: aggregateArea.code === selectedAggregateAreaCode,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [aggregateArea.lon, aggregateArea.lat],
          },
        }));

        setAggregateAreaGeoJSON({
          type: 'FeatureCollection',
          features,
        });
        setLoading(false);
        console.log('Pontos agregados carregados:', features.length);
      })
      .catch((error) => {
        console.error('Erro ao carregar areas agregadas:', error);
        setLoading(false);
      });
  }, [selectedAggregateAreaCode]);

  if (loading || !aggregateAreaGeoJSON || !isVisible) {
    return null;
  }

  return (
    <Source id="aggregate-area-points" type="geojson" data={aggregateAreaGeoJSON}>
      <Layer
        id="aggregate-area-points-layer"
        type="circle"
        paint={{
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'base_count'],
            0,
            pointSize * 0.8,
            50,
            pointSize,
            100,
            pointSize * 1.3,
            200,
            pointSize * 1.6,
          ],
          'circle-color': pointColor,
          'circle-opacity': MAP_COLORS.points.ltlaOpacity,
          'circle-stroke-width': MAP_COLORS.points.strokeWidth,
          'circle-stroke-color': MAP_COLORS.points.stroke,
          'circle-stroke-opacity': MAP_COLORS.points.strokeOpacity,
        }}
      />

      <Layer
        id="aggregate-area-labels"
        type="symbol"
        minzoom={8}
        layout={{
          'text-field': ['get', 'name'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            10,
            12,
            14,
          ],
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-max-width': 10,
        }}
        paint={{
          'text-color': '#1F2937',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 2,
        }}
      />
    </Source>
  );
};
