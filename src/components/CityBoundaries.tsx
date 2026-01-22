import React, { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';

interface CityBoundariesProps {
  isVisible?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
}

export const CityBoundaries: React.FC<CityBoundariesProps> = ({
  isVisible = true,
  borderColor = '#FF6B6B',
  borderWidth = 2,
  fillColor = '#FF6B6B',
  fillOpacity = 0.1
}) => {
  const [boundariesData, setBoundariesData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Carregar o arquivo GeoJSON das boundaries
    fetch('/data/lookup/boundaries.geojson')
      .then(response => {
        if (!response.ok) {
          // Arquivo não existe, falhar silenciosamente
          setLoading(false);
          return null;
        }
        return response.json();
      })
      .then(data => {
        if (data) {
          setBoundariesData(data);
          console.log('✅ Boundaries carregadas:', data.features?.length || 0, 'áreas');
        }
        setLoading(false);
      })
      .catch(() => {
        // Falha silenciosa - boundaries são opcionais
        setLoading(false);
      });
  }, []);

  if (loading || error || !boundariesData || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Camada de boundaries das cidades */}
      <Source
        id="city-boundaries"
        type="geojson"
        data={boundariesData}
      >
        {/* Preenchimento das áreas */}
        <Layer
          id="city-boundaries-fill"
          type="fill"
          paint={{
            'fill-color': fillColor,
            'fill-opacity': fillOpacity
          }}
        />
        
        {/* Linhas de contorno */}
        <Layer
          id="city-boundaries-line"
          type="line"
          paint={{
            'line-color': borderColor,
            'line-width': borderWidth,
            'line-opacity': 0.8
          }}
        />
      </Source>
    </>
  );
};
