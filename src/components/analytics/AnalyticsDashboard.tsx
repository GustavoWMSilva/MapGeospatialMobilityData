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
  hasActiveDemographicFilters,
} from '../../constants/datasetProfiles';
import type {
  DatasetChartId,
  DatasetProfile,
  DemographicFilters,
  GeographyLevel,
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
  className = 'rounded-xl border border-slate-200 bg-white p-3 shadow-none',
}: {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold leading-5 text-slate-950">{title}</h3>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
        >
          {isCollapsed ? 'Abrir' : 'Fechar'}
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
  const [collapsedCharts, setCollapsedCharts] = useState<Record<DatasetChartId, boolean>>(() =>
    Object.fromEntries(
      datasetProfile.dashboard.chartOrder.map((chartId) => [
        chartId,
        getDashboardChartConfig(datasetProfile, chartId).defaultCollapsed ?? false,
      ])
    ) as Record<DatasetChartId, boolean>
  );
  const getChartDimension = (chartId: DatasetChartId) => {
    const dimensionKey = getDashboardChartConfig(datasetProfile, chartId).params?.dimensionKey;
    return (
      datasetProfile.demographicDimensions.find((dimension) => dimension.key === dimensionKey) ||
      datasetProfile.demographicDimensions.find((dimension) => dimension.analyticsRole === 'socialGrade') ||
      datasetProfile.demographicDimensions.find((dimension) => dimension.analyticsRole !== 'age') ||
      datasetProfile.demographicDimensions[0]
    );
  };
  const getBarDimension = (chartId: DatasetChartId) => {
    const dimensionKey = getDashboardChartConfig(datasetProfile, chartId).params?.dimensionKey;
    return (
      datasetProfile.demographicDimensions.find((dimension) => dimension.key === dimensionKey) ||
      datasetProfile.demographicDimensions.find((dimension) => dimension.analyticsRole === 'age') ||
      datasetProfile.demographicDimensions[0]
    );
  };
  const hasGenericFilters = hasActiveDemographicFilters(
    demographicFilters,
    datasetProfile.demographicDimensions
  );
  const supportsLegacyAnalytics = datasetProfile.analyticsMode === 'uk-legacy';
  const activeLevelLabels = getDataSourceUnitLabels(geographyLevel, datasetProfile);
  const activeUnitLabel = activeLevelLabels.singular;
  const getLevelAwareChartTitle = (title: string) => {
    if (geographyLevel === 'aggregate') {
      return title;
    }

    return title
      .split(datasetProfile.labels.aggregate.plural).join(datasetProfile.labels.base.plural)
      .split(datasetProfile.labels.aggregate.singular).join(datasetProfile.labels.base.singular);
  };

  const canRenderChart = (chartId: DatasetChartId) => {
    const chartConfig = getDashboardChartConfig(datasetProfile, chartId);

    if (chartConfig.enabled === false) {
      return false;
    }

    if (chartId === 'topFlows') {
      return true;
    }

    if (chartId === 'socialPie') {
      return Boolean(getChartDimension(chartId));
    }

    if (chartId === 'ageBar') {
      return Boolean(getBarDimension(chartId));
    }

    if (chartId === 'performance') {
      return true;
    }

    if (chartId === 'odHeatmap' || chartId === 'directionalBalance') {
      return true;
    }

    if (chartId === 'socialMultiples' || chartId === 'aggregateStacked') {
      return Boolean(getChartDimension(chartId));
    }

    if (chartId === 'aggregationScatter') {
      return geographyLevel === 'aggregate' && (supportsLegacyAnalytics || Boolean(chartConfig.params?.referencePath));
    }

    return supportsLegacyAnalytics && geographyLevel === 'aggregate';
  };

  const mainChartIds = datasetProfile.dashboard.chartOrder.filter((chartId) => {
    const section = getDashboardChartConfig(datasetProfile, chartId).section ?? 'main';
    return section === 'main' && canRenderChart(chartId);
  });

  const advancedChartIds = datasetProfile.dashboard.chartOrder.filter((chartId) => {
    const section = getDashboardChartConfig(datasetProfile, chartId).section ?? 'main';
    return section === 'advanced' && canRenderChart(chartId);
  });

  const renderChart = (chartId: DatasetChartId) => {
    const chartConfig = getDashboardChartConfig(datasetProfile, chartId);
    const params = chartConfig.params ?? {};
    const areaCode = selectedArea ?? '';
    const stackedTopN = params.initialTopN === 20 || params.topN === 20 ? 20 : 12;
    const isCollapsed = collapsedCharts[chartId] ?? chartConfig.defaultCollapsed ?? false;
    const defaultClassName = 'rounded-xl border border-slate-200 bg-white p-3 shadow-none';
    const chartTitle = getLevelAwareChartTitle(chartConfig.title);

    switch (chartId) {
      case 'socialPie': {
        const pieDimension = getChartDimension(chartId);
        if (!pieDimension) return null;

        return (
          <ChartCard
            key={chartId}
            title={chartTitle}
            isCollapsed={isCollapsed}
            onToggle={() => toggleChart(chartId)}
            className={defaultClassName}
          >
            <SocialGradePieChart
              key={`social-${selectedArea}`}
              areaCode={areaCode}
              dimension={pieDimension}
              direction={direction}
              includeInternalFlows={includeInternalFlows}
              selectedValue={demographicFilters[pieDimension.key] ?? 'all'}
              onSelectValue={(value) =>
                onDemographicFiltersChange?.({
                  ...demographicFilters,
                  [pieDimension.key]: value,
                })
              }
            />
          </ChartCard>
        );
      }
      case 'ageBar': {
        const barDimension = getBarDimension(chartId);
        if (!barDimension) return null;

        return (
          <ChartCard
            key={chartId}
            title={chartTitle}
            isCollapsed={isCollapsed}
            onToggle={() => toggleChart(chartId)}
            className={defaultClassName}
          >
            <AgeBarChart
              key={`age-${selectedArea}`}
              areaCode={areaCode}
              dimension={barDimension}
              direction={direction}
              includeInternalFlows={includeInternalFlows}
              selectedValue={demographicFilters[barDimension.key] ?? 'all'}
              onSelectValue={(value) =>
                onDemographicFiltersChange?.({
                  ...demographicFilters,
                  [barDimension.key]: value,
                })
              }
            />
          </ChartCard>
        );
      }
      case 'topFlows':
        return (
          <ChartCard
            key={chartId}
            title={chartTitle}
            isCollapsed={isCollapsed}
            onToggle={() => toggleChart(chartId)}
            className={defaultClassName}
          >
            <TopFlowsRankingChart
              areaCode={areaCode}
              geographyLevel={geographyLevel}
              direction={direction}
              demographicFilters={demographicFilters}
              includeInternalFlows={includeInternalFlows}
              topN={params.topN ?? 10}
            />
          </ChartCard>
        );
      case 'performance':
        return (
          <ChartCard key={chartId} title={chartTitle} isCollapsed={isCollapsed} onToggle={() => toggleChart(chartId)}>
            <PerformanceLatencyPanel />
          </ChartCard>
        );
      case 'odHeatmap':
        return (
          <ChartCard key={chartId} title={chartTitle} isCollapsed={isCollapsed} onToggle={() => toggleChart(chartId)}>
            <AggregateODHeatmap
              demographicFilters={demographicFilters}
              geographyLevel={geographyLevel}
              includeInternalFlows={includeInternalFlows}
              initialTopN={params.initialTopN ?? params.topN ?? 10}
            />
          </ChartCard>
        );
      case 'socialMultiples': {
        const multiplesDimension = getChartDimension(chartId);
        if (!multiplesDimension) return null;

        return (
          <ChartCard key={chartId} title={chartTitle} isCollapsed={isCollapsed} onToggle={() => toggleChart(chartId)}>
            <SocialGradeSmallMultiples
              dimension={multiplesDimension}
              demographicFilters={demographicFilters}
              geographyLevel={geographyLevel}
              includeInternalFlows={includeInternalFlows}
              topN={params.topN ?? 6}
            />
          </ChartCard>
        );
      }
      case 'aggregateStacked': {
        const stackedDimension = getChartDimension(chartId);
        if (!stackedDimension) return null;

        return (
          <ChartCard key={chartId} title={chartTitle} isCollapsed={isCollapsed} onToggle={() => toggleChart(chartId)}>
            <AggregateSocialGradeStacked100
              dimension={stackedDimension}
              demographicFilters={demographicFilters}
              geographyLevel={geographyLevel}
              direction={direction}
              includeInternalFlows={includeInternalFlows}
              initialTopN={stackedTopN}
            />
          </ChartCard>
        );
      }
      case 'aggregationScatter':
        return (
          <ChartCard key={chartId} title={chartTitle} isCollapsed={isCollapsed} onToggle={() => toggleChart(chartId)}>
            <AggregationValidationScatter
              direction={direction}
              includeInternalFlows={includeInternalFlows}
              referencePath={params.referencePath}
              aggregateCodePattern={params.aggregateCodePattern}
            />
          </ChartCard>
        );
      case 'directionalBalance':
        return (
          <ChartCard
            key={chartId}
            title={chartTitle || `Saldo direcional por ${activeUnitLabel}`}
            isCollapsed={isCollapsed}
            onToggle={() => toggleChart(chartId)}
          >
            <AggregateDirectionalBalanceChart
              demographicFilters={demographicFilters}
              geographyLevel={geographyLevel}
              includeInternalFlows={includeInternalFlows}
              topN={params.topN ?? 15}
            />
          </ChartCard>
        );
      default:
        return null;
    }
  };

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
    <div className="space-y-3">
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-950">{datasetProfile.dashboard.mainChartsTitle}</p>
            <p className="text-xs text-slate-500">{datasetProfile.dashboard.mainChartsSubtitle}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-medium text-slate-600">
              {datasetProfile.labels.areaChipLabel}: {areaName || selectedArea}
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-medium text-slate-600">
              {datasetProfile.labels.levelChipLabel}: {activeLevelLabels.singular}
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-medium text-slate-600">
              {datasetProfile.dashboard.directionLabel}: {direction === 'incoming'
                ? datasetProfile.dashboard.directionValues.incoming
                : datasetProfile.dashboard.directionValues.outgoing}
            </span>
          </div>
        </div>
      </div>

      {mainChartIds.length > 0 ? (
        <div className="space-y-3">{mainChartIds.map(renderChart)}</div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {datasetProfile.dashboard.genericAnalyticsHint}
        </div>
      )}

      {advancedChartIds.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-2.5">
          <button
            type="button"
            onClick={() => setShowResearchCharts((prev) => !prev)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            {showResearchCharts
              ? datasetProfile.dashboard.advancedChartsHideLabel
              : datasetProfile.dashboard.advancedChartsShowLabel}
          </button>
        </div>
      )}

      {showResearchCharts && <div className="space-y-3">{advancedChartIds.map(renderChart)}</div>}
    </div>
  );
}


