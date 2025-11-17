import React, { useEffect, useState, useMemo } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';

interface FlowFeature {
  type: 'Feature';
  properties: {
    origin_code: string;
    origin_name: string;
    dest_code: string;
    dest_name: string;
    count: number;
    count_bin: string;
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

interface SelectedAreaConnectionsProps {
  selectedAreaCode: string | null;
  isVisible?: boolean;
  lineColor?: string;
  lineWidth?: number;
  dataSource?: 'general' | 'london';
  flowDirection?: 'incoming' | 'outgoing';
}

export const SelectedAreaConnections: React.FC<SelectedAreaConnectionsProps> = ({
  selectedAreaCode,
  isVisible = true,
  dataSource = 'general',
  flowDirection = 'incoming'
}) => {
  const [flowsData, setFlowsData] = useState<FlowFeature[]>([]);
  const [loading, setLoading] = useState(true);

  console.log('🔍 SelectedAreaConnections renderizado:', { selectedAreaCode, isVisible, flowDirection, dataSource });

  // Carregar os dados de fluxos MSOA detalhados
  useEffect(() => {
    // Usar arquivo com TODOS os fluxos do Reino Unido do GitHub Releases
    const fileName = 'https://github.com/GustavoWMSilva/MapGeospatialMobilityData/releases/download/v1.0.0-data/flows-all.geojson';
    console.log(`📂 Carregando arquivo completo: ${fileName} (área: ${selectedAreaCode})`);
    
    setLoading(true);
    fetch(fileName)
      .then(response => response.json())
      .then(data => {
        setFlowsData(data.features || []);
        setLoading(false);
        console.log('✅ Dados de fluxos OD carregados:', data.features?.length || 0);
        
        // Debug: mostrar alguns códigos de exemplo
        if (data.features?.length > 0) {
          const uniqueCodes = new Set<string>();
          data.features.slice(0, 100).forEach((f: FlowFeature) => {
            uniqueCodes.add(f.properties.origin_code);
            uniqueCodes.add(f.properties.dest_code);
          });
          console.log('📋 Exemplos de códigos nos dados:', Array.from(uniqueCodes).slice(0, 20));
        }
      })
      .catch(err => {
        console.error('❌ Erro ao carregar fluxos OD:', err);
        setLoading(false);
      });
  }, [dataSource]);

  // Filtrar fluxos que CHEGAM ou SAEM da área MSOA selecionada e calcular estatísticas
  const { flowsGeoJSON, stats } = useMemo(() => {
    if (!selectedAreaCode || flowsData.length === 0) {
      return { flowsGeoJSON: null, stats: null };
    }

    // Filtrar fluxos baseado na direção usando o código MSOA
    const filteredFlows = flowsData.filter(feature => 
      flowDirection === 'incoming'
        ? feature.properties.dest_code === selectedAreaCode
        : feature.properties.origin_code === selectedAreaCode
    );

    if (filteredFlows.length === 0) {
      console.warn(`⚠️ Nenhum fluxo encontrado ${flowDirection === 'incoming' ? 'chegando em' : 'saindo de'}:`, selectedAreaCode);
      return { flowsGeoJSON: null, stats: null };
    }

    const counts = filteredFlows.map(f => f.properties.count);
    const totalFlow = counts.reduce((sum, c) => sum + c, 0);
    const maxFlow = Math.max(...counts);
    const minFlow = Math.min(...counts);
    const avgFlow = totalFlow / counts.length;
    
    console.log(`✅ ${filteredFlows.length} fluxos ${flowDirection === 'incoming' ? 'chegando em' : 'saindo de'} ${selectedAreaCode}`);
    console.log(`📊 Total de pessoas: ${totalFlow.toLocaleString()}`);
    console.log(`📈 Fluxo máximo: ${maxFlow.toLocaleString()}, mínimo: ${minFlow.toLocaleString()}, média: ${avgFlow.toFixed(0)}`);

    return {
      flowsGeoJSON: {
        type: 'FeatureCollection' as const,
        features: filteredFlows
      },
      stats: {
        total: totalFlow,
        max: maxFlow,
        min: minFlow,
        avg: avgFlow,
        count: filteredFlows.length
      }
    };
  }, [selectedAreaCode, flowsData, flowDirection]);

  if (loading || !flowsGeoJSON || !stats || !isVisible || !selectedAreaCode) {
    console.log('❌ SelectedAreaConnections não renderizado:', { loading, hasFlows: !!flowsGeoJSON, isVisible, selectedAreaCode });
    return null;
  }

  console.log('✅ SelectedAreaConnections renderizando linhas:', flowsGeoJSON.features.length);

  // Calcular intervalos dinâmicos baseados nos dados
  const intervals = [
    { value: 0, label: '0', color: '#FFFFFF' },
    { value: Math.round(stats.max * 0.01), label: Math.round(stats.max * 0.01).toLocaleString(), color: '#FEE2E2' },
    { value: Math.round(stats.max * 0.05), label: Math.round(stats.max * 0.05).toLocaleString(), color: '#FCA5A5' },
    { value: Math.round(stats.max * 0.1), label: Math.round(stats.max * 0.1).toLocaleString(), color: '#F87171' },
    { value: Math.round(stats.max * 0.2), label: Math.round(stats.max * 0.2).toLocaleString(), color: '#EF4444' },
    { value: Math.round(stats.max * 0.5), label: Math.round(stats.max * 0.5).toLocaleString(), color: '#DC2626' },
    { value: stats.max, label: `${stats.max.toLocaleString()}+`, color: '#991B1B' }
  ];

  return (
    <>
      {/* Legenda de Intensidade - Design Melhorado */}
      <div className="absolute top-20 right-4 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-5 z-10" style={{ width: '280px' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🔥</span>
          </div>
          <h3 className="text-base font-bold text-gray-800">
            Intensidade de Fluxo
          </h3>
        </div>
        
        {/* Barra de Gradiente Contínuo */}
        <div className="mb-4">
          <div className="h-6 rounded-lg shadow-inner relative overflow-hidden" 
               style={{ 
                 background: 'linear-gradient(to right, #FFFFFF 0%, #FEE2E2 14%, #FCA5A5 28%, #F87171 42%, #EF4444 57%, #DC2626 71%, #991B1B 100%)'
               }}>
            <div className="absolute inset-0 border-2 border-gray-300 rounded-lg pointer-events-none"></div>
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-xs font-semibold text-gray-600">0</span>
            <span className="text-xs font-semibold text-gray-600">{stats.max.toLocaleString()}</span>
          </div>
        </div>

        {/* Lista de Faixas com Ícones Visuais - Dinâmico */}
        <div className="space-y-2.5">
          {intervals.map((interval, index) => (
            <div key={index} className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <div 
                className={`w-12 h-5 rounded shadow-sm ${index === 0 ? 'border-2 border-gray-300' : index === intervals.length - 1 ? 'shadow-lg border border-gray-700' : ''}`}
                style={{ backgroundColor: interval.color }}
              ></div>
              <span className={`text-sm ${index >= intervals.length - 2 ? 'font-bold text-gray-900' : index >= intervals.length - 4 ? 'font-semibold text-gray-800' : 'font-medium text-gray-700'}`}>
                {index === 0 ? interval.label : `${intervals[index - 1]?.value || 0} - ${interval.label}`}
              </span>
            </div>
          ))}
        </div>
        
        {/* Estatísticas adicionais */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span className="font-medium">Total de fluxos:</span>
              <span className="font-bold text-purple-700">{stats.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Total de pessoas:</span>
              <span className="font-bold text-purple-700">{stats.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Média por fluxo:</span>
              <span className="font-bold text-purple-700">{Math.round(stats.avg).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t-2 border-gray-200">
          <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-lg border border-blue-200">
            <span className="text-blue-600 text-lg">💡</span>
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong>Dica:</strong> Linhas mais grossas = maior volume de pessoas
            </p>
          </div>
        </div>
      </div>

      {/* Camada de linhas com cores baseadas no volume de fluxo */}
      <Source
        id="selected-area-flows"
        type="geojson"
        data={flowsGeoJSON}
      >
        {/* Linhas principais - cor baseada no volume */}
        <Layer
          id="area-flow-lines"
          type="line"
          paint={{
            // Cor: gradiente de branco a vermelho escuro
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, '#FFFFFF',      // Branco - fluxos muito baixos
              100, '#FEE2E2',    // Vermelho muito claro
              500, '#FCA5A5',    // Vermelho claro
              1000, '#F87171',   // Vermelho médio-claro
              2000, '#EF4444',   // Vermelho
              5000, '#DC2626',   // Vermelho escuro
              10000, '#991B1B'   // Vermelho muito escuro
            ],
            // Espessura: proporcional ao volume
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, 1,
              500, 2,
              1000, 3,
              2000, 4,
              5000, 6
            ],
            'line-opacity': 0.8
          }}
        />
        
        {/* Camada de brilho para destacar linhas */}
        <Layer
          id="area-flow-glow"
          type="line"
          paint={{
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, '#FEE2E2',
              100, '#FCA5A5',
              500, '#F87171',
              1000, '#EF4444',
              2000, '#DC2626',
              5000, '#991B1B'
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, 3,
              500, 4,
              1000, 6,
              2000, 8,
              5000, 10
            ],
            'line-opacity': 0.3,
            'line-blur': 4
          }}
        />
      </Source>
    </>
  );
};
