import type { ChangeEvent } from 'react';
import { getActiveDemographicBadges, getDemographicFilterValue } from '../../constants/datasetProfiles';
import type { DatasetProfile, DemographicFilters } from '../../types';
import { debugLog } from './analyticsUtils';

interface AnalyticsFiltersProps {
  datasetProfile: DatasetProfile;
  filters: DemographicFilters;
  onFiltersChange: (filters: DemographicFilters) => void;
  onDirectionChange: (direction: 'incoming' | 'outgoing') => void;
  direction?: 'incoming' | 'outgoing';
  compact?: boolean;
}

export function AnalyticsFilters({
  datasetProfile,
  filters,
  onFiltersChange,
  onDirectionChange,
  direction = 'incoming',
  compact = false,
}: AnalyticsFiltersProps) {
  const activeBadges = getActiveDemographicBadges(datasetProfile, filters);

  const handleDirectionChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextDirection = e.target.value as 'incoming' | 'outgoing';
    debugLog(`[AnalyticsFilters] direction ${direction} -> ${nextDirection}`);
    onDirectionChange(nextDirection);
  };

  const handleDimensionChange = (dimensionKey: string, value: string) => {
    onFiltersChange({
      ...filters,
      [dimensionKey]: value,
    });
  };

  return (
    <div className={`rounded-xl border bg-white ${
      compact ? 'border-slate-200 p-3 shadow-none' : 'border-purple-100 p-6 shadow-sm'
    }`}>
      <h2 className={`${compact ? 'mb-3 text-xs uppercase tracking-wide text-slate-500' : 'mb-4 text-xl text-purple-900'} font-bold`}>
        Filtros analiticos
      </h2>

      <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'gap-4 md:grid-cols-2 xl:grid-cols-3'}`}>
        <div>
          <label htmlFor="direction" className={`block font-medium ${compact ? 'mb-1.5 text-xs text-slate-600' : 'mb-2 text-sm text-purple-900'}`}>
            Direcao do fluxo
          </label>
          <select
            id="direction"
            value={direction}
            onChange={handleDirectionChange}
            className={`w-full rounded-lg border bg-white focus:outline-none focus:ring-2 ${
              compact
                ? 'border-slate-200 px-2.5 py-2 text-sm text-slate-800 focus:border-slate-400 focus:ring-slate-200'
                : 'border-purple-200 px-3 py-2 shadow-sm focus:border-purple-400 focus:ring-purple-300'
            }`}
          >
            <option value="incoming">{datasetProfile.dashboard.directionValues.incoming} (para a area selecionada)</option>
            <option value="outgoing">{datasetProfile.dashboard.directionValues.outgoing} (a partir da area selecionada)</option>
          </select>
        </div>

        {datasetProfile.demographicDimensions.map((dimension) => (
          <div key={dimension.key}>
            <label
              htmlFor={`dimension-${dimension.key}`}
              className={`block font-medium ${compact ? 'mb-1.5 text-xs text-slate-600' : 'mb-2 text-sm text-purple-900'}`}
            >
              {dimension.label}
            </label>
            <select
              id={`dimension-${dimension.key}`}
              value={getDemographicFilterValue(filters, dimension.key)}
              onChange={(event) => handleDimensionChange(dimension.key, event.target.value)}
              className={`w-full rounded-lg border bg-white focus:outline-none focus:ring-2 ${
                compact
                  ? 'border-slate-200 px-2.5 py-2 text-sm text-slate-800 focus:border-slate-400 focus:ring-slate-200'
                  : 'border-purple-200 px-3 py-2 shadow-sm focus:border-purple-400 focus:ring-purple-300'
              }`}
            >
              <option value="all">{dimension.allLabel || `Todos - ${dimension.label}`}</option>
              {dimension.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {!compact && (
              <p className="mt-1 text-xs text-purple-600">
                {dimension.options.find((option) => option.value === getDemographicFilterValue(filters, dimension.key))?.description ||
                  `Filtre por ${dimension.label.toLowerCase()}.`}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={`${compact ? 'mt-3 pt-3 border-slate-200' : 'mt-4 pt-4 border-purple-100'} border-t`}>
        <div className="flex flex-wrap gap-2">
          <span className={`${compact ? 'w-full text-[11px] text-slate-500' : 'text-sm text-purple-900'} font-medium`}>Filtros ativos:</span>
          <span className={`inline-flex items-center rounded-full font-medium ${
            compact ? 'bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700' : 'bg-purple-100 px-2.5 py-0.5 text-xs text-purple-800'
          }`}>
            {direction === 'incoming'
              ? datasetProfile.dashboard.directionValues.incoming
              : datasetProfile.dashboard.directionValues.outgoing}
          </span>
          {activeBadges.length === 0 && (
            <span className={`inline-flex items-center rounded-full bg-slate-100 font-medium text-slate-700 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
              Nenhum filtro demografico
            </span>
          )}
          {activeBadges.map((badge) => (
            <span
              key={badge.key}
              className={`inline-flex items-center rounded-full font-medium ${
                compact ? 'bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700' : 'bg-violet-100 px-2.5 py-0.5 text-xs text-violet-800'
              }`}
            >
              {badge.label}: {badge.valueLabel}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
