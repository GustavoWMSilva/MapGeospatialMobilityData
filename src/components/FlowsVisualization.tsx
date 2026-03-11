import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { FlowFilters } from './FlowFilters';
import { loadFlows, loadFlowsFiltered } from '../utils/dataService';

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
  isFullscreen?: boolean;
  flowDirection?: 'incoming' | 'outgoing';
  dataSource: 'ltla' | 'msoa';
  socialGrade?: string;
  ageGroup?: string;
  showInternal?: boolean;
  onShowInternalChange?: (value: boolean) => void;
  onActiveConnectionsChange?: (codes: string[]) => void;
}

export const FlowsVisualization: React.FC<FlowsVisualizationProps> = ({
  selectedCode,
  isVisible = true,
  isFullscreen = false,
  flowDirection = 'incoming',
  dataSource,
  socialGrade = 'all',
  ageGroup = 'all',
  showInternal = false,
  // onShowInternalChange,
  onActiveConnectionsChange
}) => {
  const [flowsData, setFlowsData] = useState<FlowFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIntensityMinimized, setIsIntensityMinimized] = useState(true);
  const [isStatsMinimized, setIsStatsMinimized] = useState(false);
  const [isFiltersMinimized, setIsFiltersMinimized] = useState(false);
  
  // Estados dos filtros - valores padrão dependem do tipo de dados
  const [maxFlows, setMaxFlows] = useState(dataSource === 'ltla' ? 200 : 500);
  const [minCount, setMinCount] = useState(dataSource === 'ltla' ? 50 : 10);

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
    const loadKey = `${dataSource}|${selectedCode}|${flowDirection}|${socialGrade}|${ageGroup}`;
    
    // Evitar carregamentos duplicados
    if (loadingRef.current && currentLoadRef.current === loadKey) {
      return;
    }

    console.log(`FlowsVisualization useEffect disparado - dataSource: ${dataSource}, selectedCode: ${selectedCode}, filters: SocialGrade=${socialGrade}, Age=${ageGroup}`);
    
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
        
        // Usar loadFlowsFiltered se há filtros demográficos
        const hasFilters = socialGrade !== 'all' || ageGroup !== 'all';
        const data = hasFilters
          ? await loadFlowsFiltered(selectedCode, flowDirection, 50000, dataSource, socialGrade, ageGroup)
          : await loadFlows(selectedCode, flowDirection, 50000, dataSource);
        
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
  }, [dataSource, selectedCode, flowDirection, socialGrade, ageGroup]);

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

  useEffect(() => {
    if (!onActiveConnectionsChange || !selectedCode || !flowsGeoJSON) {
      onActiveConnectionsChange?.([]);
      return;
    }

    const connectedCodes = Array.from(
      new Set(
        flowsGeoJSON.features
          .map((feature) =>
            flowDirection === 'incoming'
              ? feature.properties.origin_code
              : feature.properties.dest_code
          )
          .filter((code) => code && code !== selectedCode)
      )
    );

    onActiveConnectionsChange(connectedCodes);
  }, [onActiveConnectionsChange, selectedCode, flowDirection, flowsGeoJSON]);

  if (loading || !isVisible || !selectedCode) {
    return null;
  }

  // Se não houver dados após os filtros, não renderizar
  if (!flowsGeoJSON || !stats) {
    return null;
  }

  // Calcular intervalos dinâmicos baseados nos dados
  const intervals = [
    { value: 0, label: '0', color: '#F5F3FF' },
    { value: Math.round(stats.max * 0.01), label: Math.round(stats.max * 0.01).toLocaleString(), color: '#EDE9FE' },
    { value: Math.round(stats.max * 0.05), label: Math.round(stats.max * 0.05).toLocaleString(), color: '#DDD6FE' },
    { value: Math.round(stats.max * 0.1), label: Math.round(stats.max * 0.1).toLocaleString(), color: '#C4B5FD' },
    { value: Math.round(stats.max * 0.2), label: Math.round(stats.max * 0.2).toLocaleString(), color: '#A78BFA' },
    { value: Math.round(stats.max * 0.5), label: Math.round(stats.max * 0.5).toLocaleString(), color: '#8B5CF6' },
    { value: stats.max, label: `${stats.max.toLocaleString()}+`, color: '#6D28D9' }
  ];

  const isCompactUI = !isFullscreen;
  const intensityWidth = isIntensityMinimized
    ? (isCompactUI ? '156px' : '200px')
    : (isCompactUI ? '180px' : '220px');
  const statsWidth = isStatsMinimized
    ? (isCompactUI ? '150px' : '180px')
    : (isCompactUI ? '170px' : '200px');

  return (
    <>
      {/* Filtros de Fluxos */}
      <FlowFilters
        maxFlows={maxFlows}
        onMaxFlowsChange={setMaxFlows}
        minCount={minCount}
        onMinCountChange={setMinCount}
        // showInternal={showInternal}
        // onShowInternalChange={onShowInternalChange}
        totalAvailable={totalAvailableFlows}
        totalFiltered={stats?.count || 0}
        maxPeopleCount={maxPeopleCount}
        isMinimized={isFiltersMinimized}
        onToggleMinimize={() => setIsFiltersMinimized(!isFiltersMinimized)}
        socialGrade={socialGrade}
        ageGroup={ageGroup}
        isCompact={isCompactUI}
      />

      {/* Legenda de Intensidade - Design Melhorado */}
      <div
        className={`absolute bg-white/98 backdrop-blur-md shadow-2xl border border-purple-200 z-10 ${
          isCompactUI ? 'bottom-6 right-2 rounded-lg p-2' : 'bottom-10 right-4 rounded-xl p-3'
        }`}
        style={{ width: intensityWidth }}
      >
        <div className="flex items-center gap-2">

          <h3 className={`${isCompactUI ? 'text-sm' : 'text-base'} font-bold text-purple-900 flex-1`}>
            Intensidade de Fluxo
                  {isFiltersMinimized.valueOf() ? ' (Filtros Minimizado)' : ''}

          </h3>
          <button
            onClick={() => setIsIntensityMinimized(!isIntensityMinimized)}
            className={`${isCompactUI ? 'w-6 h-6 text-xs rounded-md' : 'w-7 h-7 rounded-lg'} flex items-center justify-center bg-purple-100 hover:bg-purple-200 transition-colors text-purple-700 font-bold`}
            title={isIntensityMinimized ? "Expandir" : "Minimizar"}
          >
            {isIntensityMinimized ? '▾' : '▴'}
          </button>
        </div>
        
        {!isIntensityMinimized && (
          <>
            {/* Barra de Gradiente Contínuo */}
            <div className={isCompactUI ? 'mb-2.5' : 'mb-4'}>
              <div className="h-6 rounded-lg shadow-inner relative overflow-hidden" 
                   style={{ 
                     background: 'linear-gradient(to right, #F5F3FF 0%, #EDE9FE 14%, #DDD6FE 28%, #C4B5FD 42%, #A78BFA 57%, #8B5CF6 71%, #6D28D9 100%)'
                   }}>
                <div className="absolute inset-0 border-2 border-gray-300 rounded-lg pointer-events-none"></div>
              </div>
              <div className="flex justify-between mt-1 px-1">
                <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-600`}>0</span>
                <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-600`}>{stats.max.toLocaleString()}</span>
              </div>
            </div>

            {/* Lista de Faixas com Ícones Visuais - Dinâmico */}
            <div className={isCompactUI ? 'space-y-1.5' : 'space-y-2.5'}>
              {intervals.map((interval, index) => (
                <div key={index} className={`flex items-center group hover:bg-gray-50 rounded-lg transition-colors ${isCompactUI ? 'gap-2 p-1.5' : 'gap-3 p-2'}`}>
                  <div 
                    className={`${isCompactUI ? 'w-9 h-4' : 'w-12 h-5'} rounded shadow-sm ${index === 0 ? 'border-2 border-gray-300' : index === intervals.length - 1 ? 'shadow-lg border border-gray-700' : ''}`}
                    style={{ backgroundColor: interval.color }}
                  ></div>
                  <span className={`${isCompactUI ? 'text-[11px]' : 'text-sm'} ${index >= intervals.length - 2 ? 'font-bold text-gray-900' : index >= intervals.length - 4 ? 'font-semibold text-gray-800' : 'font-medium text-gray-700'}`}>
                    {index === 0 ? interval.label : `${intervals[index - 1]?.value || 0} - ${interval.label}`}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Estatísticas Compactas */}
      <div
        className={`absolute bg-white/98 backdrop-blur-md shadow-2xl border border-purple-200 z-10 ${
          isCompactUI ? 'bottom-2 left-2 rounded-lg p-2' : 'bottom-4 left-4 rounded-xl p-3'
        }`}
        style={{
          width: statsWidth,
          transform: isCompactUI ? 'scale(0.9)' : undefined,
          transformOrigin: 'bottom left',
        }}
      >
        <div className="flex items-center gap-2 ">

          <h3 className="text-sm font-bold text-purple-900 flex-1">
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
                <p className="text-xs text-gray-600 leading-relaxed">
                  Linhas mais grossas e roxas = maior volume
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
            // Cor: gradiente de roxo claro a roxo intenso
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, '#F5F3FF',
              100, '#EDE9FE',
              500, '#DDD6FE',
              1000, '#C4B5FD',
              2000, '#A78BFA',
              5000, '#8B5CF6',
              10000, '#6D28D9'
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
              0, '#EDE9FE',
              100, '#DDD6FE',
              500, '#C4B5FD',
              1000, '#A78BFA',
              2000, '#8B5CF6',
              5000, '#6D28D9'
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
