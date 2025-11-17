import React, { useEffect } from 'react';
import { useMap } from '@vis.gl/react-maplibre';

interface LTLABoundariesProps {
  selectedLTLA?: string | null;
}

/**
 * Componente que renderiza as bordas das áreas LTLA usando o MapLibre.
 * Utiliza o vector tile source do OpenStreetMap para obter os boundaries administrativos.
 * Quando uma área é selecionada, suas bordas ficam destacadas em branco.
 */
export const LTLABoundaries: React.FC<LTLABoundariesProps> = ({ selectedLTLA }) => {
  const { current: mapInstance } = useMap();

  useEffect(() => {
    if (!mapInstance) return;
    
    const map = mapInstance.getMap();
    if (!map) return;

    // Aguardar o mapa carregar
    const onLoad = () => {
      // Adicionar source de boundaries administrativos do OpenStreetMap
      if (!map.getSource('ltla-boundaries')) {
        map.addSource('ltla-boundaries', {
          type: 'vector',
          url: 'https://tiles.stadiamaps.com/data/openmaptiles.json' // Vector tiles com boundaries
        });
      }

      // Layer de preenchimento (transparente, apenas para seleção)
      if (!map.getLayer('ltla-fill')) {
        map.addLayer({
          id: 'ltla-fill',
          type: 'fill',
          source: 'ltla-boundaries',
          'source-layer': 'boundary', // Layer de boundaries administrativos
          filter: ['==', 'admin_level', '6'], // Level 6 = Local Authority Districts no UK
          paint: {
            'fill-color': '#ffffff',
            'fill-opacity': 0.02
          }
        });
      }

      // Layer de bordas - todas as áreas (cinza claro)
      if (!map.getLayer('ltla-outline')) {
        map.addLayer({
          id: 'ltla-outline',
          type: 'line',
          source: 'ltla-boundaries',
          'source-layer': 'boundary',
          filter: ['==', 'admin_level', '6'],
          paint: {
            'line-color': '#94a3b8', // Cinza claro
            'line-width': 1,
            'line-opacity': 0.4
          }
        });
      }

      // Layer de borda destacada - área selecionada (branco brilhante)
      if (!map.getLayer('ltla-outline-selected')) {
        map.addLayer({
          id: 'ltla-outline-selected',
          type: 'line',
          source: 'ltla-boundaries',
          'source-layer': 'boundary',
          filter: selectedLTLA 
            ? ['all',
                ['==', 'admin_level', '6'],
                ['==', 'iso3166-2', selectedLTLA]
              ]
            : ['==', 'admin_level', ''], // Filtro impossível quando não há seleção
          paint: {
            'line-color': '#ffffff',
            'line-width': 3,
            'line-opacity': 0.9
          }
        });
      }
    };

    if (map.loaded()) {
      onLoad();
    } else {
      map.on('load', onLoad);
    }

    return () => {
      map.off('load', onLoad);
    };
  }, [mapInstance, selectedLTLA]);

  // Atualizar filtro quando a seleção mudar
  useEffect(() => {
    if (!mapInstance) return;
    
    const map = mapInstance.getMap();
    if (!map || !map.getLayer('ltla-outline-selected')) return;

    map.setFilter('ltla-outline-selected',
      selectedLTLA 
        ? ['all',
            ['==', 'admin_level', '6'],
            ['==', 'iso3166-2', selectedLTLA]
          ]
        : ['==', 'admin_level', ''] // Filtro impossível
    );
  }, [mapInstance, selectedLTLA]);

  return null; // Componente sem UI própria
};
