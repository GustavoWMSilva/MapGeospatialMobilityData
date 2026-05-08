import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Source } from '@vis.gl/react-maplibre';
import { FlowFilters } from './FlowFilters';
import { loadFlows, loadFlowsFiltered } from '../utils/dataService';
import { hasActiveDemographicFilters } from '../constants/datasetProfiles';
import type { DatasetProfile, DemographicFilters, GeographyLevel } from '../types';

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
  onActiveConnectionsChange,
}) => {
  const [flowsData, setFlowsData] = useState<FlowFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isIntensityMinimized, setIsIntensityMinimized] = useState(true);
  const [isStatsMinimized, setIsStatsMinimized] = useState(false);
  const [isFiltersMinimized, setIsFiltersMinimized] = useState(false);
  const [maxFlows, setMaxFlows] = useState(geographyLevel === 'aggregate' ? 200 : 500);
  const [minCount, setMinCount] = useState(geographyLevel === 'aggregate' ? 50 : 10);

  const loadingRef = useRef(false);
  const currentLoadRef = useRef('');
  const previousSelectedCode = useRef<string | null>(null);

  useEffect(() => {
    if (selectedCode !== previousSelectedCode.current) {
      setMinCount(0);
      previousSelectedCode.current = selectedCode;
    }
  }, [selectedCode]);

  useEffect(() => {
    const filtersKey = JSON.stringify(
      datasetProfile.demographicDimensions.map((dimension) => ({
        key: dimension.key,
        value: demographicFilters[dimension.key] || 'all',
      }))
    );
    const loadKey = `${geographyLevel}|${selectedCode}|${flowDirection}|${filtersKey}`;

    if (loadingRef.current && currentLoadRef.current === loadKey) {
      return;
    }

    if (!selectedCode) {
      setFlowsData([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadData() {
      const areaCode = selectedCode;
      if (!areaCode) return;

      loadingRef.current = true;
      currentLoadRef.current = loadKey;
      setLoading(true);

      try {
        const hasFilters = hasActiveDemographicFilters(
          demographicFilters,
          datasetProfile.demographicDimensions
        );
        const data = hasFilters
          ? await loadFlowsFiltered(areaCode, flowDirection, 50000, geographyLevel, demographicFilters)
          : await loadFlows(areaCode, flowDirection, 50000, geographyLevel);

        if (!cancelled) {
          setFlowsData((data.features as FlowFeature[]) || []);
        }
      } catch (error) {
        console.error('Erro ao carregar fluxos:', error);
        if (!cancelled) {
          setFlowsData([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
        loadingRef.current = false;
      }
    }

    void loadData();

    return () => {
      cancelled = true;
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
    return null;
  }

  const intervals = [
    { value: 0, label: '0', color: '#F8FAFC' },
    { value: Math.round(stats.max * 0.01), label: Math.round(stats.max * 0.01).toLocaleString('pt-BR'), color: '#EDE9FE' },
    { value: Math.round(stats.max * 0.05), label: Math.round(stats.max * 0.05).toLocaleString('pt-BR'), color: '#DDD6FE' },
    { value: Math.round(stats.max * 0.1), label: Math.round(stats.max * 0.1).toLocaleString('pt-BR'), color: '#C4B5FD' },
    { value: Math.round(stats.max * 0.2), label: Math.round(stats.max * 0.2).toLocaleString('pt-BR'), color: '#A78BFA' },
    { value: Math.round(stats.max * 0.5), label: Math.round(stats.max * 0.5).toLocaleString('pt-BR'), color: '#8B5CF6' },
    { value: stats.max, label: stats.max.toLocaleString('pt-BR'), color: '#6D28D9' },
  ];

  const isCompactUI = !isFullscreen;
  const intensityWidth = isIntensityMinimized
    ? (isCompactUI ? '132px' : '160px')
    : (isCompactUI ? '220px' : '260px');
  const statsWidth = isStatsMinimized
    ? (isCompactUI ? '128px' : '156px')
    : (isCompactUI ? '220px' : '250px');

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
      />

      <div
        className={`absolute z-10 border border-slate-200 bg-white/92 shadow-lg shadow-slate-950/10 backdrop-blur-md ${
          isCompactUI ? 'bottom-4 right-3 rounded-lg p-2.5' : 'bottom-6 right-4 rounded-xl p-3'
        }`}
        style={{ width: intensityWidth }}
      >
        <div className="flex items-center gap-2">
          <h3 className={`${isCompactUI ? 'text-xs' : 'text-sm'} flex-1 font-semibold text-slate-900`}>
            Intensidade
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
              <div
                className="h-2.5 overflow-hidden rounded-full border border-slate-200"
                style={{
                  background: 'linear-gradient(to right, #F8FAFC 0%, #EDE9FE 25%, #C4B5FD 55%, #8B5CF6 80%, #6D28D9 100%)',
                }}
              />
              <div className="mt-1 flex justify-between px-0.5">
                <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>0</span>
                <span className={`${isCompactUI ? 'text-[10px]' : 'text-xs'} font-medium text-slate-500`}>
                  {stats.max.toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {intervals.slice(1).map((interval, index) => (
                <div key={`${interval.value}-${index}`} className="flex items-center gap-1.5 rounded-md bg-slate-50 px-1.5 py-1">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: interval.color }} />
                  <span className="truncate text-[10px] font-medium text-slate-600">
                    {index === intervals.length - 2 ? `${interval.label}+` : interval.label}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div
        className={`absolute z-10 border border-slate-200 bg-white/92 shadow-lg shadow-slate-950/10 backdrop-blur-md ${
          isCompactUI ? 'bottom-4 left-3 rounded-lg p-2.5' : 'bottom-6 left-4 rounded-xl p-3'
        }`}
        style={{ width: statsWidth }}
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

      <Source id={`${geographyLevel}-flows`} type="geojson" data={flowsGeoJSON}>
        <Layer
          id={`${geographyLevel}-flow-lines`}
          type="line"
          paint={{
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'count'],
              0, '#F8FAFC',
              100, '#EDE9FE',
              500, '#DDD6FE',
              1000, '#C4B5FD',
              2000, '#A78BFA',
              5000, '#8B5CF6',
              10000, '#6D28D9',
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
            'line-opacity': 0.72,
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
              0, '#EDE9FE',
              500, '#C4B5FD',
              1000, '#A78BFA',
              2000, '#8B5CF6',
              5000, '#6D28D9',
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
            'line-opacity': 0.18,
            'line-blur': 5,
          }}
        />
      </Source>
    </>
  );
};
