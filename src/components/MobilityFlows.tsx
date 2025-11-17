import { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';

interface MobilityFlowsProps {
  isVisible?: boolean;
  dataSource?: 'general' | 'london'; // Novo prop para escolher o dataset
}

export const MobilityFlows: React.FC<MobilityFlowsProps> = ({ 
  isVisible = true,
  dataSource = 'general'
}) => {
  const [flowsData, setFlowsData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Escolher o arquivo baseado no dataSource
    const fileName = dataSource === 'london' ? '/flows-london.geojson' : '/flows.geojson';
    
    setLoading(true);
    // Carregar o arquivo GeoJSON dos fluxos
    fetch(fileName)
      .then(response => {
        if (!response.ok) {
          throw new Error('Erro ao carregar dados de mobilidade');
        }
        return response.json();
      })
      .then(data => {
        // Filtrar apenas linhas que têm origem e destino diferentes
        const filteredFeatures = data.features.filter((feature: any) => {
          const coords = feature.geometry.coordinates;
          if (coords.length < 2) return false;
          const [start, end] = coords;
          // Verificar se origem e destino são diferentes
          return start[0] !== end[0] || start[1] !== end[1];
        });
        
        console.log('📊 Total de features:', data.features.length);
        console.log('📍 Features com origem≠destino:', filteredFeatures.length);
        console.log('🗑️ Features filtradas (mesmo local):', data.features.length - filteredFeatures.length);
        
        const filteredData = {
          ...data,
          features: filteredFeatures
        };
        
        setFlowsData(filteredData);
        setLoading(false);
        console.log('✅ Fluxos de mobilidade carregados:', filteredFeatures.length, 'linhas visíveis');
      })
      .catch(err => {
        console.error('❌ Erro ao carregar fluxos:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [dataSource]);

  if (loading || error || !flowsData || !isVisible) {
    if (loading) console.log('⏳ Carregando dados de mobilidade...');
    if (error) console.log('❌ Erro:', error);
    if (!flowsData) console.log('⚠️ Sem dados de fluxo');
    if (!isVisible) console.log('👁️ Camada invisível');
    return null;
  }


  return (
    <>
      {/* Camada de linhas de fluxo */}
      <Source
        id="mobility-flows"
        type="geojson"
        data={flowsData}
      >
        {/* Linhas principais dos fluxos */}
        <Layer
          id="flow-lines"
          type="line"
          paint={{
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, '#fee5d9',      // Rosa claro - baixo volume
              100, '#fcae91',    // Laranja claro
              500, '#fb6a4a',    // Laranja
              1000, '#de2d26',   // Vermelho
              5000, '#a50f15',   // Vermelho escuro
              10000, '#67000d'   // Vinho - alto volume
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, 2,
              100, 3,
              500, 4,
              1000, 5,
              5000, 6,
              10000, 8
            ],
            'line-opacity': 0.8
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round'
          }}
        />

        {/* Efeito de brilho nas linhas (opcional) */}
        <Layer
          id="flow-lines-glow"
          type="line"
          paint={{
            'line-color': '#ffffff',
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, 1,
              100, 2,
              500, 3,
              1000, 4,
              5000, 5,
              10000, 8
            ],
            'line-opacity': 0.2,
            'line-blur': 4
          }}
        />
      </Source>
    </>
  );
};
