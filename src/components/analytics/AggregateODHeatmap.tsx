import { useEffect, useMemo, useState } from 'react';
import { ACTIVE_DATASET_PROFILE } from '../../constants/datasetProfiles';
import { getTopAggregateODFlowsForFilters } from '../../utils/duckdb';
import type { DemographicFilters, GeographyLevel } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AggregateODHeatmapProps {
  demographicFilters?: DemographicFilters;
  geographyLevel?: GeographyLevel;
  includeInternalFlows?: boolean;
  initialTopN?: number;
}

interface MatrixArea {
  code: string;
  name: string;
}

function truncate(value: string, max = 12): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function getHeatColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '#F1F5F9';
  const ratio = value / max;
  if (ratio >= 0.8) return MAP_COLORS.analytics.heatmap.veryHigh;
  if (ratio >= 0.6) return MAP_COLORS.analytics.heatmap.high;
  if (ratio >= 0.4) return MAP_COLORS.analytics.heatmap.medium;
  if (ratio >= 0.2) return MAP_COLORS.analytics.heatmap.low;
  return MAP_COLORS.analytics.heatmap.min;
}

export function AggregateODHeatmap({
  demographicFilters = {},
  geographyLevel = 'aggregate',
  includeInternalFlows = false,
  initialTopN = 10,
}: AggregateODHeatmapProps) {
  const [topN, setTopN] = useState<number>(initialTopN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrixData, setMatrixData] = useState<Map<string, Map<string, number>>>(new Map());
  const [areas, setAreas] = useState<MatrixArea[]>([]);
  const activeUnitPlural =
    geographyLevel === 'aggregate'
      ? ACTIVE_DATASET_PROFILE.labels.aggregate.plural
      : ACTIVE_DATASET_PROFILE.labels.base.plural;

  useEffect(() => {
    let cancelled = false;

    async function loadHeatmap() {
      setLoading(true);
      setError(null);

      try {
        const flows = await getTopAggregateODFlowsForFilters(
          demographicFilters,
          topN,
          includeInternalFlows,
          geographyLevel
        );
        const areaMap = new Map<string, string>();
        const matrix = new Map<string, Map<string, number>>();

        flows.forEach((flow) => {
          areaMap.set(flow.origin_aggregate_area_code, flow.origin_aggregate_area_name);
          areaMap.set(flow.dest_aggregate_area_code, flow.dest_aggregate_area_name);

          if (!matrix.has(flow.origin_aggregate_area_code)) {
            matrix.set(flow.origin_aggregate_area_code, new Map());
          }
          matrix.get(flow.origin_aggregate_area_code)?.set(flow.dest_aggregate_area_code, flow.count);
        });

        const areaTotals = new Map<string, number>();
        flows.forEach((flow) => {
          areaTotals.set(
            flow.origin_aggregate_area_code,
            (areaTotals.get(flow.origin_aggregate_area_code) || 0) + flow.count
          );
          areaTotals.set(
            flow.dest_aggregate_area_code,
            (areaTotals.get(flow.dest_aggregate_area_code) || 0) + flow.count
          );
        });

        const sortedAreas = Array.from(areaMap.entries())
          .sort((a, b) => (areaTotals.get(b[0]) || 0) - (areaTotals.get(a[0]) || 0))
          .slice(0, topN)
          .map(([code, name]) => ({ code, name }));

        if (!cancelled) {
          setMatrixData(matrix);
          setAreas(sortedAreas);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getAnalyticsErrorMessage(loadError));
          setMatrixData(new Map());
          setAreas([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHeatmap();

    return () => {
      cancelled = true;
    };
  }, [demographicFilters, topN, includeInternalFlows, geographyLevel]);

  const maxValue = useMemo(() => {
    let currentMax = 0;
    matrixData.forEach((destMap) => {
      destMap.forEach((count) => {
        if (count > currentMax) currentMax = count;
      });
    });
    return currentMax;
  }, [matrixData]);

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="flex h-72 items-center justify-center text-sm text-red-600">{error}</div>;
  }

  if (areas.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center p-4 text-center text-gray-500">
        <p className="font-semibold">Sem dados OD para heatmap</p>
        <p className="mt-1 text-sm">Ajuste filtros demograficos ou top N</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-col gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-slate-500">Matriz origem x destino para padroes de fluxo</p>
            <ChartObjectiveHelp
              objective={`Evidenciar padroes de fluxo origem-destino que nao ficam claros apenas no mapa, focando nas ${activeUnitPlural.toLowerCase()} de maior atividade.`}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTopN(8)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              topN === 8 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Top 8
          </button>
          <button
            type="button"
            onClick={() => setTopN(10)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              topN === 10 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Top 10
          </button>
          <button
            type="button"
            onClick={() => setTopN(12)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              topN === 12 ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Top 12
          </button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="sticky left-0 z-10 bg-slate-50 px-2 py-2 text-left">Origem / Destino</th>
              {areas.map((area) => (
                <th key={area.code} className="min-w-[92px] px-2 py-2 text-center" title={area.name}>
                  {truncate(area.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((origin) => (
              <tr key={origin.code} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 bg-white px-2 py-2 font-medium text-slate-700" title={origin.name}>
                  {truncate(origin.name)}
                </td>
                {areas.map((dest) => {
                  const value = matrixData.get(origin.code)?.get(dest.code) || 0;
                  const color = getHeatColor(value, maxValue);
                  const textColor = value > maxValue * 0.6 ? '#FFFFFF' : '#0F172A';

                  return (
                    <td
                      key={`${origin.code}-${dest.code}`}
                      className="px-2 py-2 text-center"
                      style={{ backgroundColor: color, color: textColor }}
                      title={`${origin.name} -> ${dest.name}: ${value.toLocaleString('pt-BR')}`}
                    >
                      {value > 0 ? value.toLocaleString('pt-BR') : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
        <span>Escala:</span>
        <div className="h-3 w-16 rounded" style={{ backgroundColor: MAP_COLORS.analytics.heatmap.min }}></div>
        <span>baixo</span>
        <div className="h-3 w-16 rounded" style={{ backgroundColor: MAP_COLORS.analytics.heatmap.high }}></div>
        <span>alto</span>
      </div>
    </div>
  );
}
