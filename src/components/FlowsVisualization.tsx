import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Source } from '@vis.gl/react-maplibre';
import type { ExpressionSpecification } from 'maplibre-gl';
import { FlowFilters } from './FlowFilters';
import { loadFlows, loadFlowsFiltered } from '../utils/dataService';
import { recordFlowRenderSample } from '../utils/performanceMetrics';
import { hasActiveDemographicFilters } from '../constants/datasetProfiles';
import { MAP_COLORS } from '../constants/mapColors';
import type {
  DatasetProfile,
  DemographicFilters,
  FlowConnectionFilter,
  GeographyLevel,
  MobilityIntensityMetric,
} from '../types';

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

interface FlowStats {
  total: number;
  max: number;
  min: number;
  avg: number;
  count: number;
}

const FLOW_COUNT_STOPS = [
  { count: 0, colorIndex: 0 },
  { count: 100, colorIndex: 1 },
  { count: 500, colorIndex: 2 },
  { count: 1000, colorIndex: 3 },
  { count: 2000, colorIndex: 4 },
  { count: 5000, colorIndex: 5 },
  { count: 10000, colorIndex: 6 },
] as const;

const FLOW_ALPHA_PROFILE = {
  center: 0.1,
  mid: 0.3,
  edge: 0.74,
  glowCenter: 0.015,
  glowMid: 0.06,
  glowEdge: 0.14,
} as const;

const FLOW_SEGMENT_COUNT = 7;
const FLOW_ALPHA_MIDPOINT = 0.45;
const FLOW_ARROW_SPACING = 72;
const FLOW_ARROW_MAX_FEATURES = 220;
const EMPTY_CONNECTION_FILTERS: FlowConnectionFilter[] = [];

function buildCountColorExpression(colors: readonly string[]): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['get', 'count'],
    ...FLOW_COUNT_STOPS.flatMap(({ count, colorIndex }) => [count, colors[colorIndex]]),
  ] as ExpressionSpecification;
}

function interpolateValue(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function getDirectionalOpacity(
  flowDirection: 'incoming' | 'outgoing',
  segmentMidpoint: number,
  alphaStops: { center: number; mid: number; edge: number }
): number {
  const distanceFromSelected = flowDirection === 'outgoing' ? segmentMidpoint : 1 - segmentMidpoint;

  if (distanceFromSelected <= FLOW_ALPHA_MIDPOINT) {
    return interpolateValue(
      alphaStops.center,
      alphaStops.mid,
      distanceFromSelected / FLOW_ALPHA_MIDPOINT
    );
  }

  return interpolateValue(
    alphaStops.mid,
    alphaStops.edge,
    (distanceFromSelected - FLOW_ALPHA_MIDPOINT) / (1 - FLOW_ALPHA_MIDPOINT)
  );
}

function interpolateCoordinate(
  start: [number, number],
  end: [number, number],
  progress: number
): [number, number] {
  return [
    interpolateValue(start[0], end[0], progress),
    interpolateValue(start[1], end[1], progress),
  ];
}

function buildSegmentedFlowFeatures(
  features: FlowFeature[],
  flowDirection: 'incoming' | 'outgoing'
): GeoJSON.Feature<GeoJSON.LineString>[] {
  return features.flatMap((feature) => {
    const start = feature.geometry.coordinates[0];
    const end = feature.geometry.coordinates[feature.geometry.coordinates.length - 1];

    if (!start || !end) {
      return [];
    }

    return Array.from({ length: FLOW_SEGMENT_COUNT }, (_, index) => {
      const segmentStartProgress = index / FLOW_SEGMENT_COUNT;
      const segmentEndProgress = (index + 1) / FLOW_SEGMENT_COUNT;
      const segmentMidpoint = (segmentStartProgress + segmentEndProgress) / 2;

      return {
        type: 'Feature',
        properties: {
          ...feature.properties,
          segment_opacity: getDirectionalOpacity(flowDirection, segmentMidpoint, {
            center: FLOW_ALPHA_PROFILE.center,
            mid: FLOW_ALPHA_PROFILE.mid,
            edge: FLOW_ALPHA_PROFILE.edge,
          }),
          segment_glow_opacity: getDirectionalOpacity(flowDirection, segmentMidpoint, {
            center: FLOW_ALPHA_PROFILE.glowCenter,
            mid: FLOW_ALPHA_PROFILE.glowMid,
            edge: FLOW_ALPHA_PROFILE.glowEdge,
          }),
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            interpolateCoordinate(start, end, segmentStartProgress),
            interpolateCoordinate(start, end, segmentEndProgress),
          ],
        },
      };
    });
  });
}

interface FlowsVisualizationProps {
  selectedCode: string | null;
  isVisible?: boolean;
  isFullscreen?: boolean;
  flowDirection?: 'incoming' | 'outgoing';
  geographyLevel: GeographyLevel;
  datasetProfile: DatasetProfile;
  demographicFilters?: DemographicFilters;
  connectionFilters?: FlowConnectionFilter[];
  showInternal?: boolean;
  showMobilityIntensity?: boolean;
  mobilityIntensityMetric?: MobilityIntensityMetric;
  onShowInternalChange?: (value: boolean) => void;
  onActiveConnectionsChange?: (codes: string[]) => void;
}

function getRelevantFlows(
  flows: FlowFeature[],
  selectedCode: string,
  flowDirection: 'incoming' | 'outgoing'
): FlowFeature[] {
  return flows.filter((feature) => {
    const { origin_code: originCode, dest_code: destCode } = feature.properties;
    return flowDirection === 'incoming' ? destCode === selectedCode : originCode === selectedCode;
  });
}

function getConnectedAreaCode(
  feature: FlowFeature,
  selectedCode: string,
  flowDirection: 'incoming' | 'outgoing'
): string | null {
  const { origin_code: originCode, dest_code: destCode } = feature.properties;
  const code = flowDirection === 'incoming' ? originCode : destCode;
  return code && code !== selectedCode ? code : null;
}

function buildConnectionColorExpression(
  connectionFilters: FlowConnectionFilter[],
  flowDirection: 'incoming' | 'outgoing',
  fallbackExpression: ExpressionSpecification
): ExpressionSpecification {
  if (connectionFilters.length === 0) {
    return fallbackExpression;
  }

  const codeProperty = flowDirection === 'incoming' ? 'origin_code' : 'dest_code';

  return ([
    'match',
    ['get', codeProperty],
    ...connectionFilters.flatMap((filter) => [filter.code, filter.color || MAP_COLORS.analytics.topFlowsBar[0]]),
    fallbackExpression,
  ] as unknown) as ExpressionSpecification;
}

export const FlowsVisualization: React.FC<FlowsVisualizationProps> = ({
  selectedCode,
  isVisible = true,
  isFullscreen = false,
  flowDirection = 'incoming',
  geographyLevel,
  datasetProfile,
  demographicFilters = {},
  connectionFilters = EMPTY_CONNECTION_FILTERS,
  showInternal = false,
  showMobilityIntensity = false,
  mobilityIntensityMetric = 'total',
  onActiveConnectionsChange,
}) => {
  const [flowsData, setFlowsData] = useState<FlowFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIntensityMinimized, setIsIntensityMinimized] = useState(true);
  const [isStatsMinimized, setIsStatsMinimized] = useState(false);
  const [isFiltersMinimized, setIsFiltersMinimized] = useState(false);
  const [maxFlows, setMaxFlows] = useState(geographyLevel === 'aggregate' ? 200 : 500);
  const [minCount, setMinCount] = useState(geographyLevel === 'aggregate' ? 50 : 10);

  const previousSelectedCode = useRef<string | null>(null);
  const latestRequestIdRef = useRef(0);
  const latestRenderMetricKeyRef = useRef<string | null>(null);

  const filtersActive = useMemo(
    () => hasActiveDemographicFilters(demographicFilters, datasetProfile.demographicDimensions),
    [demographicFilters, datasetProfile.demographicDimensions]
  );

  useEffect(() => {
    if (selectedCode !== previousSelectedCode.current) {
      setMinCount(0);
      previousSelectedCode.current = selectedCode;
    }
  }, [selectedCode]);

  useEffect(() => {
    const handleToggleFlowFilters = () => {
      setIsFiltersMinimized((current) => !current);
    };

    window.addEventListener('mobility:toggle-flow-filters', handleToggleFlowFilters);

    return () => {
      window.removeEventListener('mobility:toggle-flow-filters', handleToggleFlowFilters);
    };
  }, []);

  useEffect(() => {
    if (!selectedCode) {
      setFlowsData([]);
      setLoading(false);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    async function loadData() {
      const areaCode = selectedCode;
      if (!areaCode) return;

      setLoading(true);

      try {
        const data = filtersActive
          ? await loadFlowsFiltered(areaCode, flowDirection, 50000, geographyLevel, demographicFilters)
          : await loadFlows(areaCode, flowDirection, 50000, geographyLevel);

        if (latestRequestIdRef.current === requestId) {
          setFlowsData((data.features as FlowFeature[]) || []);
        }
      } catch (error) {
        console.error('Erro ao carregar fluxos:', error);
        if (latestRequestIdRef.current === requestId) {
          setFlowsData([]);
        }
      } finally {
        if (latestRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      if (latestRequestIdRef.current === requestId) {
        latestRequestIdRef.current += 1;
      }
    };
  }, [demographicFilters, filtersActive, flowDirection, geographyLevel, selectedCode]);

  const baseRelevantFlows = useMemo(() => {
    if (!selectedCode || flowsData.length === 0) return [];

    let relevantFlows = getRelevantFlows(flowsData, selectedCode, flowDirection);

    if (!showInternal) {
      relevantFlows = relevantFlows.filter(
        (feature) => feature.properties.origin_code !== feature.properties.dest_code
      );
    }

    return relevantFlows.sort((left, right) => right.properties.count - left.properties.count);
  }, [selectedCode, flowsData, flowDirection, showInternal]);

  const connectionFilteredFlows = useMemo(() => {
    if (!selectedCode || baseRelevantFlows.length === 0) return [];

    if (connectionFilters.length > 0) {
      const selectedConnectionCodes = new Set(connectionFilters.map((filter) => filter.code));
      return baseRelevantFlows.filter(
        (feature) => {
          const connectedCode = getConnectedAreaCode(feature, selectedCode, flowDirection);
          return connectedCode ? selectedConnectionCodes.has(connectedCode) : false;
        }
      );
    }

    return baseRelevantFlows;
  }, [baseRelevantFlows, connectionFilters, flowDirection, selectedCode]);

  const hasConnectionComparison = connectionFilters.length > 0;
  const totalAvailableFlows = connectionFilteredFlows.length;

  const filteredFlows = useMemo(() => {
    let nextFlows = connectionFilteredFlows;

    if (minCount > 0) {
      nextFlows = nextFlows.filter((feature) => feature.properties.count >= minCount);
    }

    return nextFlows.slice(0, maxFlows);
  }, [connectionFilteredFlows, maxFlows, minCount]);

  const stats = useMemo<FlowStats | null>(() => {
    if (filteredFlows.length === 0) return null;

    const counts = filteredFlows.map((feature) => feature.properties.count);
    const total = counts.reduce((sum, count) => sum + count, 0);

    return {
      total,
      max: Math.max(...counts),
      min: Math.min(...counts),
      avg: total / filteredFlows.length,
      count: filteredFlows.length,
    };
  }, [filteredFlows]);

  useEffect(() => {
    if (!selectedCode || loading) {
      return;
    }

    const renderedTotal = stats?.total ?? 0;
    const renderMetricKey = [
      selectedCode,
      geographyLevel,
      flowDirection,
      filtersActive ? 'filters' : 'nofilters',
      connectionFilters.map((filter) => filter.code).join(',') || 'all',
      minCount,
      maxFlows,
      totalAvailableFlows,
      filteredFlows.length,
      renderedTotal,
    ].join('|');

    if (latestRenderMetricKeyRef.current === renderMetricKey) {
      return;
    }

    latestRenderMetricKeyRef.current = renderMetricKey;

    recordFlowRenderSample({
      areaCode: selectedCode,
      dataSource: geographyLevel,
      direction: flowDirection,
      filtersActive,
      minCount,
      maxFlows,
      availableCount: totalAvailableFlows,
      renderedCount: filteredFlows.length,
      renderedTotal,
    });
  }, [
    filteredFlows.length,
    filtersActive,
    flowDirection,
    geographyLevel,
    loading,
    maxFlows,
    minCount,
    connectionFilters,
    selectedCode,
    stats,
    totalAvailableFlows,
  ]);

  const maxPeopleCount = useMemo(() => {
    const topFlows = connectionFilteredFlows.slice(0, maxFlows);
    return topFlows.length > 0
      ? Math.max(...topFlows.map((feature) => feature.properties.count))
      : 0;
  }, [connectionFilteredFlows, maxFlows]);

  const flowsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(() => {
    if (filteredFlows.length === 0) return null;

    return {
      type: 'FeatureCollection',
      features: buildSegmentedFlowFeatures(filteredFlows, flowDirection),
    };
  }, [filteredFlows, flowDirection]);

  const flowArrowsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(() => {
    if (filteredFlows.length === 0) return null;

    return {
      type: 'FeatureCollection',
      features: filteredFlows.slice(0, FLOW_ARROW_MAX_FEATURES),
    };
  }, [filteredFlows]);

  useEffect(() => {
    if (!onActiveConnectionsChange || !selectedCode || filteredFlows.length === 0) {
      onActiveConnectionsChange?.([]);
      return;
    }

    const connectedCodes = Array.from(
      new Set(
        filteredFlows
          .map((feature) => getConnectedAreaCode(feature, selectedCode, flowDirection))
          .filter((code): code is string => Boolean(code))
      )
    );

    onActiveConnectionsChange(connectedCodes);
  }, [filteredFlows, onActiveConnectionsChange, selectedCode, flowDirection]);

  const flowColors = MAP_COLORS.flows.legend;
  const lineColorExpression = useMemo(() => buildCountColorExpression(flowColors), [flowColors]);
  const glowColorExpression = useMemo(() => buildCountColorExpression(flowColors), [flowColors]);
  const displayLineColorExpression = useMemo(
    () => buildConnectionColorExpression(connectionFilters, flowDirection, lineColorExpression),
    [connectionFilters, flowDirection, lineColorExpression]
  );
  const displayGlowColorExpression = useMemo(
    () => buildConnectionColorExpression(connectionFilters, flowDirection, glowColorExpression),
    [connectionFilters, flowDirection, glowColorExpression]
  );
  const isCompactUI = !isFullscreen;
  const overlayPanelWidth = isCompactUI ? 240 : 280;
  const bottomOverlayContainerClass = isCompactUI
    ? 'pointer-events-none absolute bottom-4 left-3 right-3 z-10 flex items-end justify-between gap-2'
    : 'pointer-events-none absolute bottom-6 left-4 right-4 z-10 flex items-end justify-between gap-4';
  const mobilityMetricLabel =
    mobilityIntensityMetric === 'incoming'
      ? 'Entrada'
      : mobilityIntensityMetric === 'outgoing'
        ? 'Saida'
        : mobilityIntensityMetric === 'balance'
          ? 'Saldo'
          : 'Total';
  const intensityCardTitle = showMobilityIntensity ? 'Intensidades' : 'Intensidade';
  const visibleStats: FlowStats = stats ?? {
    total: 0,
    max: 0,
    min: 0,
    avg: 0,
    count: 0,
  };

  if (loading || !isVisible || !selectedCode) {
    return null;
  }

  return (
    <>
      <FlowFilters
        maxFlows={maxFlows}
        onMaxFlowsChange={setMaxFlows}
        minCount={minCount}
        onMinCountChange={setMinCount}
        totalAvailable={totalAvailableFlows}
        totalFiltered={visibleStats.count}
        maxPeopleCount={maxPeopleCount}
        isMinimized={isFiltersMinimized}
        onToggleMinimize={() => setIsFiltersMinimized(!isFiltersMinimized)}
        datasetProfile={datasetProfile}
        demographicFilters={demographicFilters}
        isCompact={isCompactUI}
        panelWidth={overlayPanelWidth}
      />

      <div className={bottomOverlayContainerClass}>
        <div
          className={`pointer-events-auto border border-slate-200 bg-white/92 shadow-lg shadow-slate-950/10 backdrop-blur-md ${
            isCompactUI ? 'rounded-lg p-2.5' : 'rounded-xl p-3'
          }`}
          style={{ width: overlayPanelWidth }}
        >
          <div className="flex items-center gap-2">
            <h3 className="flex-1 text-xs font-semibold text-slate-900">Resumo</h3>
            <button
              onClick={() => setIsStatsMinimized(!isStatsMinimized)}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100"
              title={isStatsMinimized ? 'Expandir' : 'Minimizar'}
              type="button"
            >
              {isStatsMinimized ? '+' : '-'}
            </button>
          </div>

          {!isStatsMinimized && (
            <>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <span className="block text-[10px] font-medium text-slate-500">Fluxos</span>
                  <span className="text-xs font-bold text-slate-950">{visibleStats.count.toLocaleString('pt-BR')}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <span className="block text-[10px] font-medium text-slate-500">Pessoas</span>
                  <span className="text-xs font-bold text-slate-950">{visibleStats.total.toLocaleString('pt-BR')}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <span className="block text-[10px] font-medium text-slate-500">Media</span>
                  <span className="text-xs font-bold text-slate-950">{Math.round(visibleStats.avg).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className="mt-2 border-t border-slate-200 pt-2">
                <p className="text-[10px] leading-relaxed text-slate-500">
                  {visibleStats.count > 0
                    ? hasConnectionComparison
                      ? 'Cores identificam os fluxos comparados; espessura indica volume.'
                      : 'Tamanho, cor e opacidade das setas indicam volume e direcao do fluxo.'
                    : 'Nenhum fluxo atende aos filtros atuais.'}
                </p>
              </div>

              {hasConnectionComparison && (
                <div className="mt-2 space-y-1 rounded-md bg-slate-50 px-2 py-1.5 text-[10px] leading-4 text-slate-600">
                  <span className="font-semibold text-slate-700">Comparacao:</span>
                  {connectionFilters.map((filter) => (
                    <div key={filter.code} className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: filter.color || MAP_COLORS.analytics.topFlowsBar[0] }}
                      />
                      <span className="truncate">
                        {flowDirection === 'incoming'
                          ? `${filter.name || filter.code} -> area selecionada`
                          : `area selecionada -> ${filter.name || filter.code}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div
          className={`pointer-events-auto border border-slate-200 bg-white/92 shadow-lg shadow-slate-950/10 backdrop-blur-md ${
            isCompactUI ? 'rounded-lg p-2.5' : 'ml-auto rounded-xl p-3'
          }`}
          style={{ width: overlayPanelWidth }}
        >
          <div className="flex items-center gap-2">
            <h3 className={`${isCompactUI ? 'text-xs' : 'text-sm'} flex-1 font-semibold text-slate-900`}>
              {intensityCardTitle}
            </h3>
            <button
              onClick={() => setIsIntensityMinimized(!isIntensityMinimized)}
              className={`${isCompactUI ? 'h-6 w-6 text-xs rounded-md' : 'h-7 w-7 rounded-lg'} flex items-center justify-center border border-slate-200 bg-white font-bold text-slate-500 transition-colors hover:bg-slate-100`}
              title={isIntensityMinimized ? 'Expandir' : 'Minimizar'}
              type="button"
            >
              {isIntensityMinimized ? '+' : '-'}
            </button>
          </div>

          {!isIntensityMinimized && (
            <>
              {hasConnectionComparison ? (
                <div className="mt-2 space-y-2">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Fluxos
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">Cor = rota</span>
                    </div>

                    <div className="space-y-1">
                      {connectionFilters.map((filter) => (
                        <div key={filter.code} className="flex min-w-0 items-center gap-2 text-[10px] text-slate-600">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: filter.color || MAP_COLORS.analytics.topFlowsBar[0] }}
                          />
                          <span className="truncate">{filter.name || filter.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Volume
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">Espessura</span>
                    </div>
                    <div className="flex h-8 items-center justify-between gap-2 rounded-md bg-slate-50 px-2">
                      {[1, 3, 5].map((height, index) => (
                        <div key={height} className="flex flex-1 flex-col gap-1">
                          <span
                            className="rounded-full bg-slate-700"
                            style={{ height, opacity: 0.35 + index * 0.25 }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between px-0.5">
                      <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>
                        Menor
                      </span>
                      <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>
                        {visibleStats.max.toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Fluxos
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">Volume</span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full border border-slate-200"
                    style={{
                      background: MAP_COLORS.gradients.flow,
                    }}
                  />
                  <div className="mt-1 flex justify-between px-0.5">
                    <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>0</span>
                    <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>
                      {visibleStats.max.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}

              {showMobilityIntensity && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Mobilidade
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">{mobilityMetricLabel}</span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full border border-slate-200"
                    style={{
                      background:
                        mobilityIntensityMetric === 'balance'
                          ? MAP_COLORS.gradients.mobilityBalance
                          : MAP_COLORS.gradients.mobilitySequential,
                    }}
                  />
                  <div className="mt-1 flex justify-between px-0.5">
                    <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>
                      {mobilityIntensityMetric === 'balance' ? 'Emissora' : 'Menor'}
                    </span>
                    <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>
                      {mobilityIntensityMetric === 'balance' ? 'Atratora' : 'Maior'}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {flowsGeoJSON && (
        <Source id={`${geographyLevel}-flows`} type="geojson" data={flowsGeoJSON}>
          <Layer
            id={`${geographyLevel}-flow-glow`}
            type="line"
            paint={{
              'line-color': displayGlowColorExpression,
              'line-width': [
                'interpolate',
                ['linear'],
                ['get', 'count'],
                0, 2,
                500, 3,
                1000, 4,
                2000, 6,
                5000, 8,
              ],
              'line-opacity': ['get', 'segment_glow_opacity'],
              'line-blur': 3.5,
            }}
          />

          <Layer
            id={`${geographyLevel}-flow-lines`}
            type="line"
            paint={{
              'line-color': displayLineColorExpression,
              'line-width': [
                'interpolate',
                ['linear'],
                ['get', 'count'],
                0, 0.8,
                500, 1.6,
                1000, 2.4,
                2000, 3.4,
                5000, 5,
              ],
              'line-opacity': ['get', 'segment_opacity'],
            }}
          />
        </Source>
      )}

      {flowArrowsGeoJSON && (
        <Source id={`${geographyLevel}-flow-arrows`} type="geojson" data={flowArrowsGeoJSON}>
          <Layer
            id={`${geographyLevel}-flow-arrowheads`}
            type="symbol"
            layout={{
              'symbol-placement': 'line',
              'symbol-spacing': FLOW_ARROW_SPACING,
              'text-field': '>',
              'text-size': [
                'interpolate',
                ['linear'],
                ['get', 'count'],
                0, 12,
                500, 14,
                1000, 17,
                2000, 21,
                5000, 26,
              ],
              'text-allow-overlap': true,
              'text-ignore-placement': true,
              'text-keep-upright': false,
              'text-pitch-alignment': 'map',
              'text-rotation-alignment': 'map',
            }}
            paint={{
              'text-color': displayLineColorExpression,
              'text-halo-color': '#FFFFFF',
              'text-halo-width': 1,
              'text-opacity': 0.72,
            }}
          />
        </Source>
      )}
    </>
  );
};
