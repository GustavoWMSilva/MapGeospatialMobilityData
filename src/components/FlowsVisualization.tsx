import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { FlowFilters } from './FlowFilters';
import { loadFlows } from '../utils/dataService';

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
  const [isFiltersMinimized, setIsFiltersMinimized] = useState(false);
  
  // Estados dos filtros - valores padrão dependem do tipo de dados
  const [maxFlows, setMaxFlows] = useState(dataSource === 'ltla' ? 200 : 500);
  const [minCount, setMinCount] = useState(dataSource === 'ltla' ? 50 : 10);
  const [showInternal, setShowInternal] = useState(false);

  // Usar useRef para evitar re-execuções duplicadas
  const loadingRef = useRef(false);
  const currentLoadRef = useRef<string>('');
  const previousSelectedCode = useRef<string | null>(null);

  // Resetar minCount quando mudar de área selecionada (ANTES de carregar dados)
  useEffect(() => {
    if (selectedCode !== previousSelectedCode.current) {
      console.log(`Nova área selecionada (${previousSelectedCode.current} → ${selectedCode}), resetando minCount para 0`);
      setMinCount(0); // Sempre resetar para 0 ao mudar de área
      previousSelectedCode.current = selectedCode;
    }
  }, [selectedCode]);

  // Carregar dados usando dataService (DuckDB-WASM ou API)
  useEffect(() => {
    const loadKey = `${dataSource}|${selectedCode}|${flowDirection}`;
    
    // Evitar carregamentos duplicados
    if (loadingRef.current && currentLoadRef.current === loadKey) {
      return;
    }

    console.log(`FlowsVisualization useEffect disparado - dataSource: ${dataSource}, selectedCode: ${selectedCode}`);
    
    if (!selectedCode) {
      setFlowsData([]);
      setLoading(false);
      return;
    }
    
    loadingRef.current = true;
    currentLoadRef.current = loadKey;
    setLoading(true);
    
    const loadData = async () => {
      try {
        console.log(`Carregando flows para ${selectedCode} (${dataSource})...`);
        
        // dataService escolhe automaticamente a melhor fonte
        const data = await loadFlows(
          selectedCode,
          flowDirection,
          50000,
          dataSource
        );
        
        console.log(`Fluxos carregados:`, data.features?.length || 0);
        setFlowsData(data.features as FlowFeature[] || []);
        
        // Debug: mostrar alguns códigos de exemplo
        if (data.features?.length > 0) {
          const sampleCodes = new Set<string>();
          (data.features as FlowFeature[]).slice(0, 50).forEach((f) => {
            sampleCodes.add(f.properties.origin_code);
            sampleCodes.add(f.properties.dest_code);
          });
          console.log('Exemplos de códigos nos dados:', Array.from(sampleCodes).slice(0, 10));
        }
      } catch (error) {
        console.error(`Erro ao carregar flows:`, error);
        setFlowsData([]);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };
    
    loadData();
  }, [dataSource, selectedCode, flowDirection]);

  // Filtrar fluxos baseado na direção e calcular estatísticas
  const { flowsGeoJSON, stats } = useMemo(() => {
    console.log(`useMemo disparado - selectedCode: ${selectedCode}, flowsData.length: ${flowsData.length}, dataSource: ${dataSource}`);
    
    if (!selectedCode || flowsData.length === 0) {
      console.log(`Retornando null - selectedCode: ${selectedCode}, flowsData.length: ${flowsData.length}`);
      return { flowsGeoJSON: null, stats: null };
    }

    // Debug: mostrar alguns códigos dos primeiros fluxos
    if (flowsData.length > 0) {
      console.log(`Primeiros 5 fluxos:`, flowsData.slice(0, 5).map(f => ({
        origin: f.properties.origin_code,
        dest: f.properties.dest_code,
        count: f.properties.count
      })));
    }

    // Filtrar fluxos baseado na direção
    let filteredFlows = flowsData.filter(feature => {
      if (flowDirection === 'incoming') {
        // Fluxos que CHEGAM no código selecionado
        return feature.properties.dest_code === selectedCode;
      } else {
        // Fluxos que SAEM do código selecionado
        return feature.properties.origin_code === selectedCode;
      }
    });

    console.log(`Após filtrar por ${flowDirection} em ${selectedCode}: ${filteredFlows.length} fluxos encontrados`);
    
    // Calcular o máximo real de pessoas nos flows filtrados
    const maxCountInFiltered = filteredFlows.length > 0 
      ? Math.max(...filteredFlows.map(f => f.properties.count))
      : 0;
    
    // Aplicar filtros adicionais
    // 1. Filtro de fluxos internos
    if (!showInternal) {
      filteredFlows = filteredFlows.filter(f => 
        f.properties.origin_code !== f.properties.dest_code
      );
    }
    
    // 2. Filtro de mínimo de pessoas (ignorar se estiver no valor máximo)
    // Considera "no máximo" se for >= 95% do valor máximo real
    const isAtMaximum = minCount >= (maxCountInFiltered * 0.95);
    if (minCount > 0 && !isAtMaximum) {
      filteredFlows = filteredFlows.filter(f => f.properties.count >= minCount);
    }
    
    // 3. Ordenar por contagem e limitar quantidade
    filteredFlows = filteredFlows
      .sort((a, b) => b.properties.count - a.properties.count)
      .slice(0, maxFlows);
    
    console.log(`Após aplicar filtros (min: ${minCount}${isAtMaximum ? ' [no máximo, ignorado]' : ''}, max: ${maxFlows}, internal: ${showInternal}): ${filteredFlows.length} fluxos`);

    if (filteredFlows.length === 0) {
      console.warn(`Nenhum fluxo encontrado ${flowDirection === 'incoming' ? 'chegando em' : 'saindo de'}:`, selectedCode);
      console.warn(`Verificando se o código existe nos dados...`);
      
      // Debug: verificar se o código existe em QUALQUER fluxo
      const existsAsOrigin = flowsData.some(f => f.properties.origin_code === selectedCode);
      const existsAsDest = flowsData.some(f => f.properties.dest_code === selectedCode);
      console.log(`Código ${selectedCode} - Existe como origem: ${existsAsOrigin}, como destino: ${existsAsDest}`);
      
      return { flowsGeoJSON: null, stats: null, connectedPointsGeoJSON: null };
    }

    const counts = filteredFlows.map(f => f.properties.count);
    const totalFlow = counts.reduce((sum, c) => sum + c, 0);
    const maxFlow = Math.max(...counts);
    const minFlow = Math.min(...counts);
    const avgFlow = totalFlow / counts.length;
    
    const directionText = flowDirection === 'incoming' ? 'chegando em' : 'saindo de';
    console.log(`${filteredFlows.length} fluxos ${directionText} ${selectedCode} (${dataSource.toUpperCase()})`);
    console.log(`Total de pessoas: ${totalFlow.toLocaleString()}`);
    console.log(`Fluxo máximo: ${maxFlow.toLocaleString()}`);
    console.log(`Fluxo mínimo: ${minFlow.toLocaleString()}`);

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
  }, [selectedCode, flowsData, flowDirection, dataSource, maxFlows, minCount, showInternal]);

  // Contar total de flows disponíveis e máximo de pessoas (APÓS aplicar filtros)
  const { totalAvailableFlows, maxPeopleCount } = useMemo(() => {
    if (!selectedCode || flowsData.length === 0) return { totalAvailableFlows: 0, maxPeopleCount: 0 };
    
    let relevantFlows = flowsData.filter(feature => {
      if (flowDirection === 'incoming') {
        return feature.properties.dest_code === selectedCode;
      } else {
        return feature.properties.origin_code === selectedCode;
      }
    });
    
    // Total ANTES dos filtros
    const totalBeforeFilters = relevantFlows.length;
    
    // Aplicar filtro de fluxos internos (igual ao useMemo principal)
    if (!showInternal) {
      relevantFlows = relevantFlows.filter(f => 
        f.properties.origin_code !== f.properties.dest_code
      );
    }
    
    // Ordenar e limitar pela quantidade máxima (igual ao useMemo principal)
    const topFlows = relevantFlows
      .sort((a, b) => b.properties.count - a.properties.count)
      .slice(0, maxFlows);
    
    // Pegar o MAIOR valor de count nos fluxos QUE REALMENTE SERÃO EXIBIDOS
    const maxCount = topFlows.length > 0 
      ? Math.max(...topFlows.map(f => f.properties.count))
      : 0;
    
    console.log(`maxPeopleCount calculado para ${selectedCode}: ${maxCount} pessoas (maior fluxo após filtros)`);
    console.log(`Total antes dos filtros: ${totalBeforeFilters}, após filtros: ${topFlows.length}`);
    
    return {
      totalAvailableFlows: totalBeforeFilters,
      maxPeopleCount: maxCount
    };
  }, [selectedCode, flowsData, flowDirection, showInternal, maxFlows]);

  if (loading || !isVisible || !selectedCode) {
    return null;
  }

  // Se não houver dados após os filtros, não renderizar
  if (!flowsGeoJSON || !stats) {
    return null;
  }

  // Calcular intervalos dinâmicos baseados nos dados
  const intervals = [
    { value: 0, label: '0', color: '#FFFFFF' },
    { value: Math.round(stats.max * 0.01), label: Math.round(stats.max * 0.01).toLocaleString(), color: '#FEF3C7' },
    { value: Math.round(stats.max * 0.05), label: Math.round(stats.max * 0.05).toLocaleString(), color: '#FDE68A' },
    { value: Math.round(stats.max * 0.1), label: Math.round(stats.max * 0.1).toLocaleString(), color: '#FCD34D' },
    { value: Math.round(stats.max * 0.2), label: Math.round(stats.max * 0.2).toLocaleString(), color: '#FBBF24' },
    { value: Math.round(stats.max * 0.5), label: Math.round(stats.max * 0.5).toLocaleString(), color: '#F59E0B' },
    { value: stats.max, label: `${stats.max.toLocaleString()}+`, color: '#D97706' }
  ];

  return (
    <>
      {/* Filtros de Fluxos */}
      <FlowFilters
        maxFlows={maxFlows}
        onMaxFlowsChange={setMaxFlows}
        minCount={minCount}
        onMinCountChange={setMinCount}
        showInternal={showInternal}
        onShowInternalChange={setShowInternal}
        totalAvailable={totalAvailableFlows}
        totalFiltered={stats?.count || 0}
        maxPeopleCount={maxPeopleCount}
        isMinimized={isFiltersMinimized}
        onToggleMinimize={() => setIsFiltersMinimized(!isFiltersMinimized)}
      />

      {/* Legenda de Intensidade - Design Melhorado */}
      <div className="absolute bottom-10 right-4 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-3 z-10" style={{ width: isIntensityMinimized ? '200px' : '220px' }}>
        <div className="flex items-center gap-2">

          <h3 className="text-base font-bold text-gray-800 flex-1">
            Intensidade de Fluxo
                  {isFiltersMinimized.valueOf() ? ' (Filtros Minimizado)' : ''}

          </h3>
          <button
            onClick={() => setIsIntensityMinimized(!isIntensityMinimized)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-yellow-100 hover:bg-yellow-200 transition-colors text-amber-700 font-bold"
            title={isIntensityMinimized ? "Expandir" : "Minimizar"}
          >
            {isIntensityMinimized ? '▾' : '▴'}
          </button>
        </div>
        
        {!isIntensityMinimized && (
          <>
            {/* Barra de Gradiente Contínuo */}
            <div className="mb-4">
              <div className="h-6 rounded-lg shadow-inner relative overflow-hidden" 
                   style={{ 
                     background: 'linear-gradient(to right, #FFFFFF 0%, #FEF3C7 14%, #FDE68A 28%, #FCD34D 42%, #FBBF24 57%, #F59E0B 71%, #D97706 100%)'
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

          <h3 className="text-sm font-bold text-gray-800 flex-1">
            Estatísticas de Fluxo
          </h3>
          <button
            onClick={() => setIsStatsMinimized(!isStatsMinimized)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors text-purple-700 font-bold"
            title={isStatsMinimized ? "Expandir" : "Minimizar"}
          >
            {isStatsMinimized ? '▾' : '▴'}
          </button>
        </div>
        
        {!isStatsMinimized && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-purple-50 p-2 rounded-lg">
                <span className="text-xs font-medium text-gray-700">Total de fluxos:</span>
                <span className="text-sm font-bold text-purple-700">{stats.count -1}</span>
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
                <p className="text-xs text-gray-600 leading-relaxed">
                  Linhas mais grossas e amarelas = maior volume
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
            // Cor: gradiente de branco a amarelo/laranja escuro
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, '#FFFFFF',      // Branco - fluxos muito baixos
              100, '#FEF3C7',    // Amarelo muito claro
              500, '#FDE68A',    // Amarelo claro
              1000, '#FCD34D',   // Amarelo médio
              2000, '#FBBF24',   // Amarelo intenso
              5000, '#F59E0B',   // Âmbar
              10000, '#D97706'   // Âmbar escuro
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
              0, '#FEF3C7',
              100, '#FDE68A',
              500, '#FCD34D',
              1000, '#FBBF24',
              2000, '#F59E0B',
              5000, '#D97706'
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
