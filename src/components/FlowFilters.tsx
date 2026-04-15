import { useEffect, useRef } from 'react';
import { getActiveDemographicBadges } from '../constants/datasetProfiles';
import type { DatasetProfile, DemographicFilters } from '../types';

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
  datasetProfile: DatasetProfile;
  demographicFilters?: DemographicFilters;
  isCompact?: boolean;
}

export const FlowFilters: React.FC<FlowFiltersProps> = ({
  maxFlows,
  onMaxFlowsChange,
  minCount,
  onMinCountChange,
  totalAvailable,
  maxPeopleCount,
  isMinimized,
  onToggleMinimize,
  datasetProfile,
  demographicFilters = {},
  isCompact = false,
}) => {
  const minCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousMaxPeopleCount = useRef<number>(maxPeopleCount);
  const activeBadges = getActiveDemographicBadges(datasetProfile, demographicFilters);
  const hasDemographicFilters = activeBadges.length > 0;

  useEffect(() => {
    return () => {
      if (minCountTimeoutRef.current) {
        clearTimeout(minCountTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (minCount > maxPeopleCount && maxPeopleCount > 0) {
      onMinCountChange(0);
    }
    previousMaxPeopleCount.current = maxPeopleCount;
  }, [maxPeopleCount, minCount, onMinCountChange]);

  const handleMinCountChange = (value: number) => {
    const safeMax = Math.max(maxPeopleCount, 100);
    const safeValue = Math.max(0, Math.min(value, safeMax));
    onMinCountChange(safeValue);
  };

  const shellClass = isCompact
    ? 'absolute top-2 right-2 z-10 w-64 rounded-md border border-purple-100 bg-white/95 shadow-lg backdrop-blur-sm'
    : 'absolute top-4 right-4 z-10 w-80 rounded-lg border border-purple-100 bg-white/95 shadow-lg backdrop-blur-sm';

  const headerClass = isCompact
    ? 'flex cursor-pointer items-center justify-between border-b border-purple-100 p-2 hover:bg-purple-50/50'
    : 'flex cursor-pointer items-center justify-between border-b border-purple-100 p-3 hover:bg-purple-50/50';

  return (
    <div className={shellClass}>
      <div className={headerClass} onClick={onToggleMinimize}>
        <div className="flex items-center gap-2">
          <h3 className={`font-semibold text-purple-900 ${isCompact ? 'text-xs' : 'text-sm'}`}>Filtros de Fluxos</h3>
          {hasDemographicFilters && (
            <span
              className={`rounded-full bg-purple-100 font-medium text-purple-700 ${
                isCompact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
              }`}
            >
              Demografia Ativa
            </span>
          )}
        </div>
        <button
          className={`flex items-center justify-center bg-purple-100 font-bold text-purple-700 transition-colors hover:bg-purple-200 ${
            isCompact ? 'h-6 w-6 rounded-md text-xs' : 'h-7 w-7 rounded-lg'
          }`}
          title={isMinimized ? 'Expandir' : 'Minimizar'}
          type="button"
        >
          {isMinimized ? '▾' : '▴'}
        </button>
      </div>

      {!isMinimized && (
        <div className={isCompact ? 'space-y-3 p-3' : 'space-y-4 p-4'}>
          {hasDemographicFilters && (
            <div className={`space-y-1 rounded-lg border border-purple-200 bg-purple-50 ${isCompact ? 'p-2.5' : 'p-3'}`}>
              <div className={`flex items-center gap-2 ${isCompact ? 'mb-1' : 'mb-2'}`}>
                <svg
                  className={`${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-purple-600`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
                <span className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-semibold text-purple-800`}>
                  Filtros Demograficos
                </span>
              </div>

              {activeBadges.map((badge) => (
                <div key={badge.key} className={`${isCompact ? 'text-[11px]' : 'text-xs'} flex items-center gap-1 text-purple-700`}>
                  <strong>{badge.label}:</strong> {badge.valueLabel}
                </div>
              ))}

              {activeBadges.length > 1 && (
                <div className={`rounded border border-purple-300 bg-purple-100 px-2 py-1 ${isCompact ? 'mt-1.5' : 'mt-2'}`}>
                  <div className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-medium text-purple-800`}>
                    Filtro combinado ativo no mapa
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>Quantidade Maxima</label>
              <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-purple-700`}>
                {maxFlows >= totalAvailable ? 'Todos' : maxFlows.toLocaleString('pt-BR')}
              </span>
            </div>
            <input
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-purple-100 accent-purple-600"
              max={Math.max(totalAvailable, 1)}
              min="1"
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1) onMaxFlowsChange(value);
              }}
              step="1"
              type="range"
              value={Math.max(1, Math.min(maxFlows, Math.max(totalAvailable, 1)))}
            />
            <div className={`flex justify-between text-gray-500 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              <span>10</span>
              <span>{Math.round(totalAvailable * 0.33).toLocaleString('pt-BR')}</span>
              <span>{Math.round(totalAvailable * 0.67).toLocaleString('pt-BR')}</span>
              <span>{totalAvailable.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>Minimo de Pessoas</label>
              <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-purple-700`}>
                {minCount === 0 ? 'Sem filtro' : `${minCount.toLocaleString('pt-BR')}+`}
              </span>
            </div>
            <input
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-purple-100 accent-purple-600"
              max={Math.max(maxPeopleCount, 100)}
              min={0}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 0) handleMinCountChange(value);
              }}
              step={Math.max(1, Math.floor(Math.max(maxPeopleCount, 100) / 100))}
              type="range"
              value={Math.min(minCount, Math.max(maxPeopleCount, 100))}
            />
            <div className={`flex justify-between text-gray-500 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              <span>0</span>
              <span>{Math.round(Math.max(maxPeopleCount, 0) * 0.33).toLocaleString('pt-BR')}</span>
              <span>{Math.round(Math.max(maxPeopleCount, 0) * 0.67).toLocaleString('pt-BR')}</span>
              <span>{Math.max(maxPeopleCount, 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
