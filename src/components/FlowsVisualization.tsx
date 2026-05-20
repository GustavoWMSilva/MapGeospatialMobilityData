import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Source } from '@vis.gl/react-maplibre';
import { FlowFilters } from './FlowFilters';
import { loadFlows, loadFlowsFiltered } from '../utils/dataService';
import { hasActiveDemographicFilters } from '../constants/datasetProfiles';
import { MAP_COLORS } from '../constants/mapColors';
import type { DatasetProfile, DemographicFilters, GeographyLevel, MobilityIntensityMetric } from '../types';

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

interface FlowsVisualizationProps {
  selectedCode: string | null;
  isVisible?: boolean;
  isFullscreen?: boolean;
  flowDirection?: 'incoming' | 'outgoing';
  geographyLevel: GeographyLevel;
  datasetProfile: DatasetProfile;
  demographicFilters?: DemographicFilters;
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

export const FlowsVisualization: React.FC<FlowsVisualizationProps> = ({
  selectedCode,
  isVisible = true,
  isFullscreen = false,
  flowDirection = 'incoming',
  geographyLevel,
  datasetProfile,
  demographicFilters = {},
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

  useEffect(() => {
    if (selectedCode !== previousSelectedCode.current) {
      setMinCount(0);
      previousSelectedCode.current = selectedCode;
    }
  }, [selectedCode]);

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
        const hasFilters = hasActiveDemographicFilters(
          demographicFilters,
          datasetProfile.demographicDimensions
        );
        const data = hasFilters
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
  }, [datasetProfile.demographicDimensions, demographicFilters, flowDirection, geographyLevel, selectedCode]);

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

  const totalAvailableFlows = baseRelevantFlows.length;

  const filteredFlows = useMemo(() => {
    let nextFlows = baseRelevantFlows;

    if (minCount > 0) {
      nextFlows = nextFlows.filter((feature) => feature.properties.count >= minCount);
    }

    return nextFlows.slice(0, maxFlows);
  }, [baseRelevantFlows, maxFlows, minCount]);

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

  const maxPeopleCount = useMemo(() => {
    const topFlows = baseRelevantFlows.slice(0, maxFlows);
    return topFlows.length > 0
      ? Math.max(...topFlows.map((feature) => feature.properties.count))
      : 0;
  }, [baseRelevantFlows, maxFlows]);

  const flowsGeoJSON = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(() => {
    if (filteredFlows.length === 0) return null;

    return {
      type: 'FeatureCollection',
      features: filteredFlows.map((feature) => ({
        type: 'Feature',
        properties: feature.properties,
        geometry: feature.geometry,
      })),
    };
  }, [filteredFlows]);

  useEffect(() => {
    if (!selectedCode) {
      return;
    }

    const zeroOrNegativeCount = baseRelevantFlows.filter((feature) => feature.properties.count <= 0).length;
    const invalidGeometryCount = filteredFlows.filter((feature) => {
      const [origin, dest] = feature.geometry.coordinates;

      return (
        !origin ||
        !dest ||
        !Number.isFinite(origin[0]) ||
        !Number.isFinite(origin[1]) ||
        !Number.isFinite(dest[0]) ||
        !Number.isFinite(dest[1])
      );
    }).length;

    console.log('[FlowsVisualization] Estado dos fluxos:', {
      geographyLevel,
      selectedCode,
      flowDirection,
      minCount,
      maxFlows,
      loading,
      flowsData: flowsData.length,
      baseRelevantFlows: baseRelevantFlows.length,
      filteredFlows: filteredFlows.length,
      statsCount: stats?.count ?? 0,
      statsMin: stats?.min ?? null,
      statsMax: stats?.max ?? null,
      zeroOrNegativeCount,
      invalidGeometryCount,
      hasGeoJSON: Boolean(flowsGeoJSON),
    });

    if (filteredFlows.length > 0) {
      console.log(
        '[FlowsVisualization] Primeiros flows visiveis:',
        filteredFlows.slice(0, 5).map((feature) => ({
          origin: feature.properties.origin_code,
          dest: feature.properties.dest_code,
          count: feature.properties.count,
          coordinates: feature.geometry.coordinates,
        }))
      );
    }
  }, [
    baseRelevantFlows,
    filteredFlows,
    flowDirection,
    flowsData,
    flowsGeoJSON,
    geographyLevel,
    loading,
    maxFlows,
    minCount,
    selectedCode,
    stats,
  ]);

  useEffect(() => {
    if (!onActiveConnectionsChange || !selectedCode || !flowsGeoJSON) {
      onActiveConnectionsChange?.([]);
      return;
    }

    const connectedCodes = Array.from(
      new Set(
        flowsGeoJSON.features
          .map((feature) => getConnectedAreaCode(feature as FlowFeature, selectedCode, flowDirection))
          .filter((code): code is string => Boolean(code))
      )
    );

    onActiveConnectionsChange(connectedCodes);
  }, [onActiveConnectionsChange, selectedCode, flowDirection, flowsGeoJSON]);

  if (loading || !isVisible || !selectedCode || !flowsGeoJSON || !stats) {
    if (selectedCode) {
      console.log('[FlowsVisualization] Render interrompido:', {
        selectedCode,
        loading,
        isVisible,
        hasGeoJSON: Boolean(flowsGeoJSON),
        hasStats: Boolean(stats),
        filteredFlows: filteredFlows.length,
      });
    }
    return null;
  }

  const flowColors = MAP_COLORS.flows.legend;
  const isCompactUI = !isFullscreen;
  const overlayPanelWidth = isCompactUI ? 240 : 280;
  const bottomOverlayContainerClass = isCompactUI
    ? 'absolute bottom-4 left-3 right-3 z-10 flex items-end justify-between gap-2'
    : 'absolute bottom-6 left-4 right-4 z-10 flex items-end justify-between gap-4';
  const mobilityMetricLabel =
    mobilityIntensityMetric === 'incoming'
      ? 'Entrada'
      : mobilityIntensityMetric === 'outgoing'
        ? 'Saida'
        : mobilityIntensityMetric === 'balance'
          ? 'Saldo'
          : 'Total';
  const intensityCardTitle = showMobilityIntensity ? 'Intensidades' : 'Intensidade';

  return (
    <>
      <FlowFilters
        maxFlows={maxFlows}
        onMaxFlowsChange={setMaxFlows}
        minCount={minCount}
        onMinCountChange={setMinCount}
        totalAvailable={totalAvailableFlows}
        totalFiltered={stats.count}
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
          className={`border border-slate-200 bg-white/92 shadow-lg shadow-slate-950/10 backdrop-blur-md ${
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
                  <span className="text-xs font-bold text-slate-950">{stats.count.toLocaleString('pt-BR')}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <span className="block text-[10px] font-medium text-slate-500">Pessoas</span>
                  <span className="text-xs font-bold text-slate-950">{stats.total.toLocaleString('pt-BR')}</span>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <span className="block text-[10px] font-medium text-slate-500">Media</span>
                  <span className="text-xs font-bold text-slate-950">{Math.round(stats.avg).toLocaleString('pt-BR')}</span>
                </div>
              </div>

              <div className="mt-2 border-t border-slate-200 pt-2">
                <p className="text-[10px] leading-relaxed text-slate-500">
                  Espessura e cor indicam maior volume de fluxo.
                </p>
              </div>
            </>
          )}
        </div>

        <div
          className={`border border-slate-200 bg-white/92 shadow-lg shadow-slate-950/10 backdrop-blur-md ${
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
                    {stats.max.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

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

      <Source id={`${geographyLevel}-flows`} type="geojson" data={flowsGeoJSON}>
        <Layer
          id={`${geographyLevel}-flow-lines`}
          type="line"
          paint={{
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, flowColors[0],
              100, flowColors[1],
              500, flowColors[2],
              1000, flowColors[3],
              2000, flowColors[4],
              5000, flowColors[5],
              10000, flowColors[6],
            ],
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
            'line-opacity': MAP_COLORS.flows.lineOpacity,
          }}
        />

        <Layer
          id={`${geographyLevel}-flow-glow`}
          type="line"
          paint={{
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, flowColors[1],
              500, flowColors[2],
              1000, flowColors[3],
              2000, flowColors[4],
              5000, flowColors[5],
            ],
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
            'line-opacity': MAP_COLORS.flows.glowOpacity,
            'line-blur': MAP_COLORS.flows.glowBlur,
          }}
        />
      </Source>
    </>
  );
};
