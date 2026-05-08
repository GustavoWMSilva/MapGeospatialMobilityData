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
  totalFiltered,
  maxPeopleCount,
  isMinimized,
  onToggleMinimize,
  datasetProfile,
  demographicFilters = {},
  isCompact = false,
}) => {
  const minCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  }, [maxPeopleCount, minCount, onMinCountChange]);

  const handleMinCountChange = (value: number) => {
    const safeMax = Math.max(maxPeopleCount, 100);
    const safeValue = Math.max(0, Math.min(value, safeMax));
    onMinCountChange(safeValue);
  };

  const shellClass = isCompact
    ? 'absolute top-3 right-3 z-10 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white/92 shadow-lg shadow-slate-950/10 backdrop-blur-md'
    : 'absolute top-4 right-4 z-10 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white/92 shadow-xl shadow-slate-950/10 backdrop-blur-md';

  const headerClass = isCompact
    ? 'flex cursor-pointer items-center justify-between border-b border-slate-200 px-3 py-2 hover:bg-slate-50/80'
    : 'flex cursor-pointer items-center justify-between border-b border-slate-200 px-4 py-3 hover:bg-slate-50/80';

  return (
    <div className={shellClass}>
      <div className={headerClass} onClick={onToggleMinimize}>
        <div className="flex min-w-0 items-center gap-2">
          <h3 className={`font-semibold text-slate-900 ${isCompact ? 'text-xs' : 'text-sm'}`}>
            Fluxos
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {totalFiltered.toLocaleString('pt-BR')} visiveis
          </span>
          {hasDemographicFilters && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              filtros ativos
            </span>
          )}
        </div>
        <button
          className={`flex items-center justify-center border border-slate-200 bg-white font-bold text-slate-500 transition-colors hover:bg-slate-100 ${
            isCompact ? 'h-6 w-6 rounded-md text-xs' : 'h-7 w-7 rounded-lg'
          }`}
          title={isMinimized ? 'Expandir' : 'Minimizar'}
          type="button"
        >
          {isMinimized ? '+' : '-'}
        </button>
      </div>

      {!isMinimized && (
        <div className={isCompact ? 'space-y-3 p-3' : 'space-y-4 p-4'}>
          {hasDemographicFilters && (
            <div className={`space-y-1 rounded-lg border border-slate-200 bg-slate-50 ${isCompact ? 'p-2.5' : 'p-3'}`}>
              <div className={`${isCompact ? 'text-[11px]' : 'text-xs'} font-semibold text-slate-700`}>
                Demografia no mapa
              </div>

              {activeBadges.map((badge) => (
                <div key={badge.key} className={`${isCompact ? 'text-[11px]' : 'text-xs'} flex items-center gap-1 text-slate-600`}>
                  <strong>{badge.label}:</strong> {badge.valueLabel}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-slate-700`}>
                Quantidade maxima
              </label>
              <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-slate-950`}>
                {maxFlows >= totalAvailable ? 'Todos' : maxFlows.toLocaleString('pt-BR')}
              </span>
            </div>
            <input
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
              max={Math.max(totalAvailable, 1)}
              min="1"
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value) && value >= 1) onMaxFlowsChange(value);
              }}
              step="1"
              type="range"
              value={Math.max(1, Math.min(maxFlows, Math.max(totalAvailable, 1)))}
            />
            <div className={`flex justify-between text-slate-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              <span>1</span>
              <span>{Math.round(totalAvailable * 0.5).toLocaleString('pt-BR')}</span>
              <span>{totalAvailable.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className={`${isCompact ? 'text-xs' : 'text-sm'} font-medium text-slate-700`}>
                Minimo de pessoas
              </label>
              <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-slate-950`}>
                {minCount === 0 ? 'Sem filtro' : `${minCount.toLocaleString('pt-BR')}+`}
              </span>
            </div>
            <input
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900"
              max={Math.max(maxPeopleCount, 100)}
              min={0}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!Number.isNaN(value) && value >= 0) handleMinCountChange(value);
              }}
              step={Math.max(1, Math.floor(Math.max(maxPeopleCount, 100) / 100))}
              type="range"
              value={Math.min(minCount, Math.max(maxPeopleCount, 100))}
            />
            <div className={`flex justify-between text-slate-400 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              <span>0</span>
              <span>{Math.round(Math.max(maxPeopleCount, 0) * 0.5).toLocaleString('pt-BR')}</span>
              <span>{Math.max(maxPeopleCount, 0).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
