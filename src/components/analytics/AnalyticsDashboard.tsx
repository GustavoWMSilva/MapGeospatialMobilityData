import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { SocialGradePieChart } from './SocialGradePieChart';
import { AgeBarChart } from './AgeBarChart';
import { AnalyticsFilters } from './AnalyticsFilters';
import { TopFlowsRankingChart } from './TopFlowsRankingChart';
import { AggregateDirectionalBalanceChart } from './AggregateDirectionalBalanceChart';
import { AggregateSocialGradeStacked100 } from './AggregateSocialGradeStacked100';
import { AggregationValidationScatter } from './AggregationValidationScatter';
import { PerformanceLatencyPanel } from './PerformanceLatencyPanel';
import { AggregateODHeatmap } from './AggregateODHeatmap';
import { SocialGradeSmallMultiples } from './SocialGradeSmallMultiples';
import { loadFlowsFiltered } from '../../utils/dataService';
import {
  getDataSourceUnitLabels,
  getDashboardChartConfig,
  getLegacyAnalyticsFilters,
  hasActiveDemographicFilters,
} from '../../constants/datasetProfiles';
import type {
  DatasetChartId,
  DatasetProfile,
  DemographicFilters,
  GeographyLevel,
  SocialGrade,
  AgeGroup,
} from '../../types';
import { debugLog, getAnalyticsErrorMessage } from './analyticsUtils';

interface AnalyticsDashboardProps {
  selectedArea?: string;
  areaName?: string;
  datasetProfile: DatasetProfile;
  demographicFilters?: DemographicFilters;
  direction?: 'incoming' | 'outgoing';
  geographyLevel?: GeographyLevel;
  includeInternalFlows?: boolean;
  showTopControls?: boolean;
  onDemographicFiltersChange?: (filters: DemographicFilters) => void;
  onDirectionChange?: (direction: 'incoming' | 'outgoing') => void;
  onIncludeInternalFlowsChange?: (value: boolean) => void;
}

function ChartCard({
  title,
  isCollapsed,
  onToggle,
  children,
  className = 'rounded-2xl border border-purple-100 bg-white p-4 shadow-sm',
}: {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-purple-950">{title}</h3>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-purple-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-purple-700 hover:bg-purple-50"
        >
          {isCollapsed ? 'Expandir' : 'Minimizar'}
        </button>
      </div>
      {!isCollapsed && children}
    </section>
  );
}

export function AnalyticsDashboard({
  selectedArea,
  areaName,
  datasetProfile,
  demographicFilters = {},
  direction = 'incoming',
  geographyLevel = 'base',
  includeInternalFlows = false,
  showTopControls = true,
  onDemographicFiltersChange,
  onDirectionChange,
  onIncludeInternalFlowsChange,
}: AnalyticsDashboardProps) {
  const [flowCountError, setFlowCountError] = useState<string | null>(null);
  const [showResearchCharts, setShowResearchCharts] = useState(false);
  const [collapsedCharts, setCollapsedCharts] = useState<Record<DatasetChartId, boolean>>(() => ({
    socialPie: getDashboardChartConfig(datasetProfile, 'socialPie').defaultCollapsed ?? false,
    ageBar: getDashboardChartConfig(datasetProfile, 'ageBar').defaultCollapsed ?? false,
    topFlows: getDashboardChartConfig(datasetProfile, 'topFlows').defaultCollapsed ?? false,
    performance: getDashboardChartConfig(datasetProfile, 'performance').defaultCollapsed ?? true,
    odHeatmap: getDashboardChartConfig(datasetProfile, 'odHeatmap').defaultCollapsed ?? true,
    socialMultiples: getDashboardChartConfig(datasetProfile, 'socialMultiples').defaultCollapsed ?? true,
    aggregateStacked: getDashboardChartConfig(datasetProfile, 'aggregateStacked').defaultCollapsed ?? true,
    aggregationScatter: getDashboardChartConfig(datasetProfile, 'aggregationScatter').defaultCollapsed ?? true,
    directionalBalance: getDashboardChartConfig(datasetProfile, 'directionalBalance').defaultCollapsed ?? true,
  }));
  const legacyFilters = getLegacyAnalyticsFilters(datasetProfile, demographicFilters);
  const socialGrade = legacyFilters.socialGrade as SocialGrade;
  const ageGroup = legacyFilters.ageGroup as AgeGroup;
  const hasGenericFilters = hasActiveDemographicFilters(
    demographicFilters,
    datasetProfile.demographicDimensions
  );
  const supportsLegacyAnalytics = datasetProfile.analyticsMode === 'uk-legacy';
  const showSocialPie = supportsLegacyAnalytics && getDashboardChartConfig(datasetProfile, 'socialPie').enabled !== false;
  const showAgeBar = supportsLegacyAnalytics && getDashboardChartConfig(datasetProfile, 'ageBar').enabled !== false;
  const activeLevelLabels = getDataSourceUnitLabels(geographyLevel, datasetProfile);
  const aggregateUnitLabel = datasetProfile.labels.aggregate.singular;

  const toggleChart = (key: DatasetChartId) => {
    setCollapsedCharts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  useEffect(() => {
    debugLog(`[AnalyticsDashboard] direction=${direction}`);
  }, [direction]);

  useEffect(() => {
    debugLog(`[AnalyticsDashboard] selectedArea=${selectedArea} areaName=${areaName}`);
  }, [selectedArea, areaName]);

  useEffect(() => {
    if (geographyLevel !== 'aggregate') {
      setShowResearchCharts(false);
    }
  }, [geographyLevel]);

  // Validate data availability for selected filters
  useEffect(() => {
    async function validateDataAvailability() {
      if (!selectedArea) {
        setFlowCountError(null);
        return;
      }

      setFlowCountError(null);
      try {
        if (hasGenericFilters) {
          await loadFlowsFiltered(selectedArea, direction, 5000, geographyLevel, demographicFilters);
        }
      } catch (error) {
        console.error('[AnalyticsDashboard] erro ao validar disponibilidade de dados', error);
        setFlowCountError(getAnalyticsErrorMessage(error));
      }
    }

    validateDataAvailability();
  }, [selectedArea, direction, geographyLevel, demographicFilters, hasGenericFilters]);

  if (!selectedArea) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">{datasetProfile.labels.analyticsEmptyTitle}</h3>
        <p className="text-sm text-gray-500">{datasetProfile.labels.analyticsEmptyHint}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-purple-100 bg-white/90 p-4 shadow-sm md:p-5">
      {showTopControls && (
        <div className="xl:sticky xl:top-0 xl:z-30">
          <div className="space-y-3 rounded-2xl border border-purple-100 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-2 rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-white p-3">
              <h2 className="text-base font-semibold text-purple-900">{datasetProfile.dashboard.panelTitle}</h2>
              <p className="text-xs text-purple-700">{datasetProfile.dashboard.panelSubtitle}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 font-medium text-purple-800">
                  {datasetProfile.labels.areaChipLabel}: {areaName || selectedArea}
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 font-medium text-purple-800">
                  {datasetProfile.labels.levelChipLabel}: {activeLevelLabels.singular}
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 font-medium text-purple-800">
                  {datasetProfile.dashboard.directionLabel}: {direction === 'incoming'
                    ? datasetProfile.dashboard.directionValues.incoming
                    : datasetProfile.dashboard.directionValues.outgoing}
                </span>
              </div>
            </div>

            <AnalyticsFilters
              datasetProfile={datasetProfile}
              filters={demographicFilters}
              direction={direction}
              onFiltersChange={onDemographicFiltersChange || (() => {})}
              onDirectionChange={onDirectionChange || (() => {})}
            />

            <div className="rounded-xl border border-purple-100 bg-white p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInternalFlows}
                  onChange={(e) => onIncludeInternalFlowsChange?.(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-purple-600"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{datasetProfile.dashboard.includeInternalFlowsLabel}</p>
                  <p className="text-xs text-gray-600">{datasetProfile.dashboard.includeInternalFlowsHint}</p>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {flowCountError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Erro no dashboard:</strong> {flowCountError}
        </div>
      )}

      <div className="rounded-xl border border-purple-100 bg-purple-50/70 p-3.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-purple-900">{datasetProfile.dashboard.mainChartsTitle}</p>
            <p className="text-xs text-purple-700">{datasetProfile.dashboard.mainChartsSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
              {datasetProfile.labels.areaChipLabel}: {areaName || selectedArea}
            </span>
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
              {datasetProfile.labels.levelChipLabel}: {activeLevelLabels.singular}
            </span>
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
              {datasetProfile.dashboard.directionLabel}: {direction === 'incoming'
                ? datasetProfile.dashboard.directionValues.incoming
                : datasetProfile.dashboard.directionValues.outgoing}
            </span>
          </div>
        </div>
      </div>

      {showSocialPie || showAgeBar ? (
        <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
          {showSocialPie && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'socialPie').title}
              isCollapsed={collapsedCharts.socialPie}
              onToggle={() => toggleChart('socialPie')}
              className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm"
            >
              <SocialGradePieChart
                key={`social-${selectedArea}`}
                areaCode={selectedArea}
                direction={direction}
                includeInternalFlows={includeInternalFlows}
                selectedGrade={socialGrade}
                onSelectGrade={(grade) =>
                  onDemographicFiltersChange?.({
                    ...demographicFilters,
                    socialGrade: grade,
                  })
                }
              />
            </ChartCard>
          )}

          {showAgeBar && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'ageBar').title}
              isCollapsed={collapsedCharts.ageBar}
              onToggle={() => toggleChart('ageBar')}
              className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm"
            >
              <AgeBarChart
                key={`age-${selectedArea}`}
                areaCode={selectedArea}
                direction={direction}
                includeInternalFlows={includeInternalFlows}
                selectedAgeGroup={ageGroup}
                onSelectAgeGroup={(age) =>
                  onDemographicFiltersChange?.({
                    ...demographicFilters,
                    age,
                  })
                }
              />
            </ChartCard>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {datasetProfile.dashboard.genericAnalyticsHint}
        </div>
      )}

      {getDashboardChartConfig(datasetProfile, 'topFlows').enabled !== false && (
        <ChartCard
          title={getDashboardChartConfig(datasetProfile, 'topFlows').title}
          isCollapsed={collapsedCharts.topFlows}
          onToggle={() => toggleChart('topFlows')}
          className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-white p-4 shadow-sm"
        >
          <TopFlowsRankingChart
            areaCode={selectedArea}
            geographyLevel={geographyLevel}
            direction={direction}
            demographicFilters={demographicFilters}
            includeInternalFlows={includeInternalFlows}
            topN={10}
          />
        </ChartCard>
      )}

      {supportsLegacyAnalytics && (
        <div className="rounded-xl border border-purple-100 bg-white p-3">
          <button
            type="button"
            onClick={() => setShowResearchCharts((prev) => !prev)}
            className="w-full rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-left text-sm font-semibold text-purple-900 hover:bg-purple-100"
          >
            {showResearchCharts
              ? datasetProfile.dashboard.advancedChartsHideLabel
              : datasetProfile.dashboard.advancedChartsShowLabel}
          </button>
        </div>
      )}

      {supportsLegacyAnalytics && showResearchCharts && (
        <div className="space-y-6">
          {getDashboardChartConfig(datasetProfile, 'performance').enabled !== false && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'performance').title}
              isCollapsed={collapsedCharts.performance}
              onToggle={() => toggleChart('performance')}
            >
              <PerformanceLatencyPanel />
            </ChartCard>
          )}

          {geographyLevel === 'aggregate' && getDashboardChartConfig(datasetProfile, 'odHeatmap').enabled !== false && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'odHeatmap').title}
              isCollapsed={collapsedCharts.odHeatmap}
              onToggle={() => toggleChart('odHeatmap')}
            >
              <AggregateODHeatmap
                socialGrade={socialGrade}
                ageGroup={ageGroup}
                includeInternalFlows={includeInternalFlows}
                initialTopN={10}
              />
            </ChartCard>
          )}

          {geographyLevel === 'aggregate' && getDashboardChartConfig(datasetProfile, 'socialMultiples').enabled !== false && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'socialMultiples').title}
              isCollapsed={collapsedCharts.socialMultiples}
              onToggle={() => toggleChart('socialMultiples')}
            >
              <SocialGradeSmallMultiples
                ageGroup={ageGroup}
                includeInternalFlows={includeInternalFlows}
                topN={6}
              />
            </ChartCard>
          )}

          {geographyLevel === 'aggregate' && getDashboardChartConfig(datasetProfile, 'aggregateStacked').enabled !== false && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'aggregateStacked').title}
              isCollapsed={collapsedCharts.aggregateStacked}
              onToggle={() => toggleChart('aggregateStacked')}
            >
              <AggregateSocialGradeStacked100
                direction={direction}
                includeInternalFlows={includeInternalFlows}
                initialTopN={12}
              />
            </ChartCard>
          )}

          {geographyLevel === 'aggregate' && getDashboardChartConfig(datasetProfile, 'aggregationScatter').enabled !== false && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'aggregationScatter').title}
              isCollapsed={collapsedCharts.aggregationScatter}
              onToggle={() => toggleChart('aggregationScatter')}
            >
              <AggregationValidationScatter direction={direction} includeInternalFlows={includeInternalFlows} />
            </ChartCard>
          )}

          {geographyLevel === 'aggregate' && getDashboardChartConfig(datasetProfile, 'directionalBalance').enabled !== false && (
            <ChartCard
              title={getDashboardChartConfig(datasetProfile, 'directionalBalance').title || `Saldo direcional por ${aggregateUnitLabel}`}
              isCollapsed={collapsedCharts.directionalBalance}
              onToggle={() => toggleChart('directionalBalance')}
            >
              <AggregateDirectionalBalanceChart
                socialGrade={socialGrade}
                ageGroup={ageGroup}
                includeInternalFlows={includeInternalFlows}
                topN={15}
              />
            </ChartCard>
          )}
        </div>
      )}
    </div>
  );
}


