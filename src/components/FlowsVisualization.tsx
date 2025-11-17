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
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

interface FlowsVisualizationProps {
  selectedCode: string | null;
  isVisible?: boolean;
  flowDirection?: 'incoming' | 'outgoing';
  dataSource: 'ltla' | 'msoa';
}

export const FlowsVisualization: React.FC<FlowsVisualizationProps> = ({
  selectedCode,
  isVisible = true,
  flowDirection = 'incoming',
  dataSource
}) => {
  const [flowsData, setFlowsData] = useState<FlowFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIntensityMinimized, setIsIntensityMinimized] = useState(false);
  const [isStatsMinimized, setIsStatsMinimized] = useState(false);

  // Carregar dados baseado no tipo (LTLA ou MSOA)
  useEffect(() => {
    setLoading(true);
    const fileName = dataSource === 'ltla' ? '/ltla_flows.geojson' : '/flows-all.geojson';
    
    fetch(fileName)
      .then(response => response.json())
      .then(data => {
        setFlowsData(data.features || []);
        setLoading(false);
        console.log(`✅ Fluxos ${dataSource.toUpperCase()} carregados:`, data.features?.length || 0);
      })
      .catch(err => {
        console.error(`❌ Erro ao carregar fluxos ${dataSource.toUpperCase()}:`, err);
        setLoading(false);
      });
  }, [dataSource]);

  // Filtrar fluxos baseado na direção e calcular estatísticas
  const { flowsGeoJSON, stats } = useMemo(() => {
    if (!selectedCode || flowsData.length === 0) {
      return { flowsGeoJSON: null, stats: null };
    }

    // Filtrar fluxos baseado na direção
    const filteredFlows = flowsData.filter(feature => {
      if (flowDirection === 'incoming') {
        // Fluxos que CHEGAM no código selecionado
        return feature.properties.dest_code === selectedCode;
      } else {
        // Fluxos que SAEM do código selecionado
        return feature.properties.origin_code === selectedCode;
      }
    });

    if (filteredFlows.length === 0) {
      console.warn(`⚠️ Nenhum fluxo encontrado ${flowDirection === 'incoming' ? 'chegando em' : 'saindo de'}:`, selectedCode);
      return { flowsGeoJSON: null, stats: null };
    }

    const counts = filteredFlows.map(f => f.properties.count);
    const totalFlow = counts.reduce((sum, c) => sum + c, 0);
    const maxFlow = Math.max(...counts);
    const minFlow = Math.min(...counts);
    const avgFlow = totalFlow / counts.length;
    
    const directionText = flowDirection === 'incoming' ? 'chegando em' : 'saindo de';
    console.log(`✅ ${filteredFlows.length} fluxos ${directionText} ${selectedCode} (${dataSource.toUpperCase()})`);
    console.log(`📊 Total de pessoas: ${totalFlow.toLocaleString()}`);
    console.log(`📈 Fluxo máximo: ${maxFlow.toLocaleString()}`);
    console.log(`📉 Fluxo mínimo: ${minFlow.toLocaleString()}`);

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
  }, [selectedCode, flowsData, flowDirection, dataSource]);

  if (loading || !flowsGeoJSON || !stats || !isVisible || !selectedCode) {
    return null;
  }

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
      <div className="absolute bottom-10 right-4 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-3 z-10" style={{ width: isIntensityMinimized ? '200px' : '220px' }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🔥</span>
          </div>
          <h3 className="text-base font-bold text-gray-800 flex-1">
            Intensidade de Fluxo
          </h3>
          <button
            onClick={() => setIsIntensityMinimized(!isIntensityMinimized)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-100 hover:bg-red-200 transition-colors text-red-700 font-bold"
            title={isIntensityMinimized ? "Expandir" : "Minimizar"}
          >
            {isIntensityMinimized ? '▼' : '▲'}
          </button>
        </div>
        
        {!isIntensityMinimized && (
          <>
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
          </>
        )}
      </div>

      {/* Estatísticas Compactas */}
      <div className="absolute bottom-4 left-4 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-purple-200 p-3 z-10" style={{ width: isStatsMinimized ? '180px' : '200px' }}>
        <div className="flex items-center gap-2 ">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg flex items-center justify-center">
            <span className="text-white text-base">📊</span>
          </div>
          <h3 className="text-sm font-bold text-gray-800 flex-1">
            Estatísticas de Fluxo
          </h3>
          <button
            onClick={() => setIsStatsMinimized(!isStatsMinimized)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors text-purple-700 font-bold"
            title={isStatsMinimized ? "Expandir" : "Minimizar"}
          >
            {isStatsMinimized ? '▼' : '▲'}
          </button>
        </div>
        
        {!isStatsMinimized && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-purple-50 p-2 rounded-lg">
                <span className="text-xs font-medium text-gray-700">Total de fluxos:</span>
                <span className="text-sm font-bold text-purple-700">{stats.count}</span>
              </div>
              <div className="flex justify-between items-center bg-purple-50 p-2 rounded-lg">
                <span className="text-xs font-medium text-gray-700">Total de pessoas:</span>
                <span className="text-sm font-bold text-purple-700">{stats.total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center bg-purple-50 p-2 rounded-lg">
                <span className="text-xs font-medium text-gray-700">Média por fluxo:</span>
                <span className="text-sm font-bold text-purple-700">{Math.round(stats.avg).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-start gap-2">
                <span className="text-purple-600 text-sm">💡</span>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Linhas mais grossas e vermelhas = maior volume
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Camada de linhas com cores baseadas no volume de fluxo */}
      <Source
        id={`${dataSource}-flows`}
        type="geojson"
        data={flowsGeoJSON}
      >
        {/* Linhas principais - cor baseada no volume */}
        <Layer
          id={`${dataSource}-flow-lines`}
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
          id={`${dataSource}-flow-glow`}
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
