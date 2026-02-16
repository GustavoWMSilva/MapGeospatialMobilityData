import React, { useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';

interface FlowFiltersProps {
  maxFlows: number;
  onMaxFlowsChange: (value: number) => void;
  minCount: number;
  onMinCountChange: (value: number) => void;
  showInternal?: boolean;
  onShowInternalChange?: (value: boolean) => void;
  totalAvailable: number;
  totalFiltered: number;
  maxPeopleCount: number;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  socialGrade?: string;
  ageGroup?: string;
}

export const FlowFilters: React.FC<FlowFiltersProps> = ({
  maxFlows,
  onMaxFlowsChange,
  minCount,
  onMinCountChange,
  totalAvailable,
  totalFiltered,
  maxPeopleCount,
  isMinimized,
  onToggleMinimize,
  socialGrade = 'all',
  ageGroup = 'all'
}) => {
  const minCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousMaxPeopleCount = useRef<number>(maxPeopleCount);
  
  // Verificar se há filtros demográficos ativos
  const hasDemographicFilters = socialGrade !== 'all' || ageGroup !== 'all';
  
  // Cleanup do timeout quando o componente desmontar
  useEffect(() => {
    return () => {
      if (minCountTimeoutRef.current) {
        clearTimeout(minCountTimeoutRef.current);
      }
    };
  }, []);

  // Resetar minCount se o maxPeopleCount mudar drasticamente (nova área)
  useEffect(() => {
    console.log(`FlowFilters: maxPeopleCount = ${maxPeopleCount}, minCount = ${minCount}`);
    
    // Se o minCount atual for maior que o novo máximo, resetar para 0
    if (minCount > maxPeopleCount && maxPeopleCount > 0) {
      console.log(`FlowFilters: minCount (${minCount}) > maxPeopleCount (${maxPeopleCount}), resetando para 0`);
      onMinCountChange(0);
    }
    
    previousMaxPeopleCount.current = maxPeopleCount;
  }, [maxPeopleCount, minCount, onMinCountChange]);
  
  const handleMinCountChange = (value: number) => {
    // Validar e limitar valor
    const safeMax = Math.max(maxPeopleCount, 100);
    const safeValue = Math.max(0, Math.min(value, safeMax));
    
    console.log(`Slider minCount: ${value} → safeValue: ${safeValue} (max permitido: ${safeMax})`);
    
    // Atualizar imediatamente (sem debounce)
    onMinCountChange(safeValue);
  };

  return (
    <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg z-10 w-80">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
        onClick={onToggleMinimize}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-gray-800">Filtros de Fluxos</h3>
          {hasDemographicFilters && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              Demografia Ativa
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">
            {totalFiltered.toLocaleString()} / {totalAvailable.toLocaleString()}
          </span>
          {isMinimized ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-4 space-y-4">
          {/* Filtros Demográficos Ativos */}
          {hasDemographicFilters && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span className="text-xs font-semibold text-purple-800">Filtros Demográficos</span>
              </div>
              {socialGrade !== 'all' && (
                <div className="text-xs text-purple-700 flex items-center gap-1">
                  <strong>Social Grade:</strong> {socialGrade}
                  {socialGrade !== 'all' && ageGroup !== 'all' && (
                    <span className="text-green-600">✓ Ativo no mapa</span>
                  )}
                </div>
              )}
              {ageGroup !== 'all' && (
                <div className="text-xs text-purple-700 flex items-center gap-1">
                  <strong>Grupo Etário:</strong> {ageGroup}
                  {socialGrade === 'all' && (
                    <span className="text-green-600">✓ Ativo no mapa</span>
                  )}
                </div>
              )}
              {socialGrade !== 'all' && ageGroup !== 'all' && (
                <div className="bg-yellow-100 border border-yellow-300 rounded px-2 py-1 mt-2">
                  <div className="text-xs text-yellow-800 font-medium">
                    ⚠️ Ambos ativos: apenas Social Grade no mapa
                  </div>
                  <div className="text-xs text-yellow-700 mt-0.5">
                    Age usado apenas nos gráficos
                  </div>
                </div>
              )}
              <div className="text-xs text-purple-600 mt-1 italic">
                Use o Analytics Dashboard para alterar
              </div>
            </div>
          )}
          
          {/* Top N Flows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Quantidade Máxima
              </label>
              <span className="text-sm font-semibold text-blue-600">
                {maxFlows >= totalAvailable ? 'Todos' : maxFlows.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max={Math.max(totalAvailable, 10)}
              step="10"
              value={Math.max(10, Math.min(maxFlows, Math.max(totalAvailable, 10)))}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 10) {
                  onMaxFlowsChange(val);
                }
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>10</span>
              <span>{Math.round(totalAvailable * 0.33).toLocaleString()}</span>
              <span>{Math.round(totalAvailable * 0.67).toLocaleString()}</span>
              <span>{totalAvailable.toLocaleString()}</span>
            </div>
          </div>

          {/* Minimum Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Mínimo de Pessoas
              </label>
              <span className="text-sm font-semibold text-blue-600">
                {minCount === 0 ? 'Sem filtro' : `${minCount.toLocaleString()}+`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(maxPeopleCount, 100)}
              step={Math.max(1, Math.floor(Math.max(maxPeopleCount, 100) / 100))}
              value={Math.min(minCount, Math.max(maxPeopleCount, 100))}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0) {
                  handleMinCountChange(val);
                }
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0</span>
              <span>{Math.round(Math.max(maxPeopleCount, 0) * 0.33).toLocaleString()}</span>
              <span>{Math.round(Math.max(maxPeopleCount, 0) * 0.67).toLocaleString()}</span>
              <span>{Math.max(maxPeopleCount, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
