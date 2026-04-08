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
    <div className={`rounded-xl border border-purple-100 bg-white ${compact ? 'p-3.5 shadow-none' : 'p-6 shadow-sm'}`}>
      <h2 className={`${compact ? 'mb-2 text-sm uppercase tracking-wide' : 'mb-4 text-xl'} font-bold text-purple-900`}>
        Analytics Filters
      </h2>

      <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 ${compact ? 'gap-2.5' : 'gap-4'}`}>
        <div>
          <label htmlFor="direction" className={`block font-medium text-purple-900 ${compact ? 'mb-1.5 text-xs' : 'mb-2 text-sm'}`}>
            Flow Direction
          </label>
          <select
            id="direction"
            value={direction}
            onChange={handleDirectionChange}
            className={`w-full rounded-lg border border-purple-200 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 ${compact ? 'px-2.5 py-2 text-sm' : 'px-3 py-2 shadow-sm'}`}
          >
            <option value="incoming">Incoming (to selected area)</option>
            <option value="outgoing">Outgoing (from selected area)</option>
          </select>
        </div>

        {datasetProfile.demographicDimensions.map((dimension) => (
          <div key={dimension.key}>
            <label
              htmlFor={`dimension-${dimension.key}`}
              className={`block font-medium text-purple-900 ${compact ? 'mb-1.5 text-xs' : 'mb-2 text-sm'}`}
            >
              {dimension.label}
            </label>
            <select
              id={`dimension-${dimension.key}`}
              value={getDemographicFilterValue(filters, dimension.key)}
              onChange={(event) => handleDimensionChange(dimension.key, event.target.value)}
              className={`w-full rounded-lg border border-purple-200 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 ${compact ? 'px-2.5 py-2 text-sm' : 'px-3 py-2 shadow-sm'}`}
            >
              <option value="all">{dimension.allLabel || `All ${dimension.label}`}</option>
              {dimension.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {!compact && (
              <p className="mt-1 text-xs text-purple-600">
                {dimension.options.find((option) => option.value === getDemographicFilterValue(filters, dimension.key))?.description ||
                  `Filter by ${dimension.label.toLowerCase()}.`}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={`${compact ? 'mt-2.5 pt-2.5' : 'mt-4 pt-4'} border-t border-purple-100`}>
        <div className="flex flex-wrap gap-2">
          <span className={`${compact ? 'text-[11px]' : 'text-sm'} font-medium text-purple-900`}>Active filters:</span>
          <span className={`inline-flex items-center rounded-full bg-purple-100 font-medium text-purple-800 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
            {direction === 'incoming' ? 'Incoming' : 'Outgoing'}
          </span>
          {activeBadges.length === 0 && (
            <span className={`inline-flex items-center rounded-full bg-slate-100 font-medium text-slate-700 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}>
              No demographic filter
            </span>
          )}
          {activeBadges.map((badge) => (
            <span
              key={badge.key}
              className={`inline-flex items-center rounded-full bg-violet-100 font-medium text-violet-800 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'}`}
            >
              {badge.label}: {badge.valueLabel}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
