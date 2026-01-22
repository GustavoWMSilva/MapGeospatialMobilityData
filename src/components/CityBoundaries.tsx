import React, { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { fetchWithCache } from '../utils/cacheService';

interface CityBoundariesProps {
  isVisible?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
  dataSource?: 'ltla' | 'msoa';  // Novo: tipo de boundary
}

export const CityBoundaries: React.FC<CityBoundariesProps> = ({
  isVisible = true,
  borderColor = '#FF6B6B',
  borderWidth = 5,
  fillColor = '#FF6B6B',
  fillOpacity = 0.1,
  dataSource = 'ltla'  // Padrão: LTLA
}) => {
  const [boundariesData, setBoundariesData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // Escolher arquivo baseado no dataSource
    const boundaryFile = dataSource === 'ltla' 
      ? '/data/lookup/ltla_boundaries.geojson'
      : '/data/lookup/boundaries.geojson';  // MSOA boundaries
    
    // Carregar com cache
    fetchWithCache(boundaryFile)
      .then(data => {
        setBoundariesData(data as GeoJSON.FeatureCollection);
        const geojson = data as GeoJSON.FeatureCollection;
        console.log(`Boundaries ${dataSource.toUpperCase()} carregadas:`, geojson.features?.length || 0, 'áreas');
        setLoading(false);
      })
      .catch(() => {
        // Falha silenciosa - boundaries são opcionais
        setLoading(false);
      });
  }, [dataSource]);  // Re-carregar quando dataSource mudar

  if (loading || !boundariesData || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Camada de boundaries das cidades */}
      <Source
        id={`${dataSource}-boundaries`}
        type="geojson"
        data={boundariesData}
      >
        {/* Preenchimento das áreas - CLICÁVEL */}
        <Layer
          id={`${dataSource}-boundaries-fill`}
          type="fill"
          paint={{
            'fill-color': fillColor,
            'fill-opacity': fillOpacity
          }}
        />
        
        {/* Camada invisível para capturar cliques */}
        <Layer
          id={`${dataSource}-boundaries-clickable`}
          type="fill"
          paint={{
            'fill-color': 'transparent',
            'fill-opacity': 0.01  // Quase invisível mas clicável
          }}
        />
        
        {/* Linhas de contorno */}
        <Layer
          id={`${dataSource}-boundaries-line`}
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
