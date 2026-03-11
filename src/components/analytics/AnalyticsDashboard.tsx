import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { SocialGradePieChart } from './SocialGradePieChart';
import { AgeBarChart } from './AgeBarChart';
import { AnalyticsFilters } from './AnalyticsFilters';
import { TopFlowsRankingChart } from './TopFlowsRankingChart';
import { DirectionalBalanceChart } from './DirectionalBalanceChart';
import { LTLASocialGradeStacked100 } from './LTLASocialGradeStacked100';
import { AggregationValidationScatter } from './AggregationValidationScatter';
import { PerformanceLatencyPanel } from './PerformanceLatencyPanel';
import { ODTopNHeatmap } from './ODTopNHeatmap';
import { SocialGradeSmallMultiples } from './SocialGradeSmallMultiples';
import { getMSOAFlowsBySocialGrade, getMSOAFlowsByAge, getMSOAFlowsBySocialGradeAndAge } from '../../utils/duckdb';
import type { SocialGrade, AgeGroup } from '../../types';
import { debugLog, getAnalyticsErrorMessage } from './analyticsUtils';

interface AnalyticsDashboardProps {
  selectedArea?: string;
  areaName?: string;
  socialGrade?: SocialGrade;
  ageGroup?: AgeGroup;
  direction?: 'incoming' | 'outgoing';
  dataSource?: 'msoa' | 'ltla';
  includeInternalFlows?: boolean;
  showTopControls?: boolean;
  onSocialGradeChange?: (grade: SocialGrade) => void;
  onAgeGroupChange?: (age: AgeGroup) => void;
  onDirectionChange?: (direction: 'incoming' | 'outgoing') => void;
  onIncludeInternalFlowsChange?: (value: boolean) => void;
}

type ChartKey =
  | 'socialPie'
  | 'ageBar'
  | 'topFlows'
  | 'performance'
  | 'odHeatmap'
  | 'socialMultiples'
  | 'ltlaStacked'
  | 'aggregationScatter'
  | 'directionalBalance';

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
  socialGrade = 'all',
  ageGroup = 'all',
  direction = 'incoming',
  dataSource = 'msoa',
  includeInternalFlows = false,
  showTopControls = true,
  onSocialGradeChange,
  onAgeGroupChange,
  onDirectionChange,
  onIncludeInternalFlowsChange,
}: AnalyticsDashboardProps) {
  const [flowCountError, setFlowCountError] = useState<string | null>(null);
  const [showResearchCharts, setShowResearchCharts] = useState(false);
  const [collapsedCharts, setCollapsedCharts] = useState<Record<ChartKey, boolean>>({
    socialPie: false,
    ageBar: false,
    topFlows: false,
    performance: true,
    odHeatmap: true,
    socialMultiples: true,
    ltlaStacked: true,
    aggregationScatter: true,
    directionalBalance: true,
  });

  const toggleChart = (key: ChartKey) => {
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
    if (dataSource !== 'ltla') {
      setShowResearchCharts(false);
    }
  }, [dataSource]);

  // Validate data availability for selected filters
  useEffect(() => {
    async function validateDataAvailability() {
      if (!selectedArea) {
        setFlowCountError(null);
        return;
      }

      setFlowCountError(null);
      try {
        if (socialGrade !== 'all' && ageGroup !== 'all') {
          await getMSOAFlowsBySocialGradeAndAge(selectedArea, socialGrade, ageGroup, direction, 5000, includeInternalFlows);
        } else if (socialGrade !== 'all') {
          await getMSOAFlowsBySocialGrade(selectedArea, socialGrade, direction, 5000, includeInternalFlows);
        } else if (ageGroup !== 'all') {
          await getMSOAFlowsByAge(selectedArea, ageGroup, direction, 5000, includeInternalFlows);
        }
      } catch (error) {
        console.error('[AnalyticsDashboard] erro ao validar disponibilidade de dados', error);
        setFlowCountError(getAnalyticsErrorMessage(error));
      }
    }

    validateDataAvailability();
  }, [selectedArea, socialGrade, ageGroup, direction, includeInternalFlows]);

  if (!selectedArea) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Select an Area to View Analytics</h3>
        <p className="text-sm text-gray-500">Click on the map or use the search to select a location</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-purple-100 bg-white/90 p-4 shadow-sm md:p-5">
      {showTopControls && (
        <div className="xl:sticky xl:top-0 xl:z-30">
          <div className="space-y-3 rounded-2xl border border-purple-100 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col gap-2 rounded-xl border border-purple-100 bg-gradient-to-r from-purple-50 to-white p-3">
              <h2 className="text-base font-semibold text-purple-900">Painel Analítico</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 font-medium text-purple-800">
                  Área: {areaName || selectedArea}
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 font-medium text-purple-800">
                  Nível: {dataSource.toUpperCase()}
                </span>
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 font-medium text-purple-800">
                  Direção: {direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                </span>
              </div>
            </div>

            <AnalyticsFilters
              socialGrade={socialGrade}
              ageGroup={ageGroup}
              direction={direction}
              onSocialGradeChange={onSocialGradeChange || (() => {})}
              onAgeGroupChange={onAgeGroupChange || (() => {})}
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
                  <p className="text-sm font-medium text-gray-800">Incluir fluxo interno (origem = destino)</p>
                  <p className="text-xs text-gray-600">Quando desativado, os gráficos ignoram fluxos dentro da mesma área.</p>
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
            <p className="text-base font-semibold text-purple-900">Visualização principal</p>
            <p className="text-xs text-purple-700">Gráficos principais para leitura rápida do fluxo</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
              Área: {areaName || selectedArea}
            </span>
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
              Nível: {dataSource.toUpperCase()}
            </span>
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
              Direção: {direction === 'incoming' ? 'Incoming' : 'Outgoing'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <ChartCard
          title="Distribuição por classe social"
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
            onSelectGrade={onSocialGradeChange || (() => {})}
          />
        </ChartCard>

        <ChartCard
          title="Distribuição por faixa etária"
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
            onSelectAgeGroup={onAgeGroupChange || (() => {})}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Ranking dos principais fluxos"
        isCollapsed={collapsedCharts.topFlows}
        onToggle={() => toggleChart('topFlows')}
        className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-white p-4 shadow-sm"
      >
        <TopFlowsRankingChart
          areaCode={selectedArea}
          dataSource={dataSource}
          direction={direction}
          socialGrade={socialGrade}
          ageGroup={ageGroup}
          includeInternalFlows={includeInternalFlows}
          topN={10}
        />
      </ChartCard>

      <div className="rounded-xl border border-purple-100 bg-white p-3">
        <button
          type="button"
          onClick={() => setShowResearchCharts((prev) => !prev)}
          className="w-full rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-left text-sm font-semibold text-purple-900 hover:bg-purple-100"
        >
          {showResearchCharts ? 'Ocultar gráficos avançados (TCC)' : 'Mostrar gráficos avançados (TCC)'}
        </button>
      </div>

      {showResearchCharts && (
        <div className="space-y-6">
          <ChartCard
            title="Performance e latência"
            isCollapsed={collapsedCharts.performance}
            onToggle={() => toggleChart('performance')}
          >
            <PerformanceLatencyPanel />
          </ChartCard>

          {dataSource === 'ltla' && (
            <ChartCard
              title="Heatmap OD Top N"
              isCollapsed={collapsedCharts.odHeatmap}
              onToggle={() => toggleChart('odHeatmap')}
            >
              <ODTopNHeatmap
                socialGrade={socialGrade}
                ageGroup={ageGroup}
                includeInternalFlows={includeInternalFlows}
                initialTopN={10}
              />
            </ChartCard>
          )}

          {dataSource === 'ltla' && (
            <ChartCard
              title="Small multiples por classe"
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

          {dataSource === 'ltla' && (
            <ChartCard
              title="Composição social empilhada 100%"
              isCollapsed={collapsedCharts.ltlaStacked}
              onToggle={() => toggleChart('ltlaStacked')}
            >
              <LTLASocialGradeStacked100
                direction={direction}
                includeInternalFlows={includeInternalFlows}
                initialTopN={12}
              />
            </ChartCard>
          )}

          {dataSource === 'ltla' && (
            <ChartCard
              title="Validação da agregação"
              isCollapsed={collapsedCharts.aggregationScatter}
              onToggle={() => toggleChart('aggregationScatter')}
            >
              <AggregationValidationScatter direction={direction} includeInternalFlows={includeInternalFlows} />
            </ChartCard>
          )}

          {dataSource === 'ltla' && (
            <ChartCard
              title="Saldo direcional LTLA"
              isCollapsed={collapsedCharts.directionalBalance}
              onToggle={() => toggleChart('directionalBalance')}
            >
              <DirectionalBalanceChart
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


