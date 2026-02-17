import { useEffect, useMemo, useState } from 'react';
import { getTopLTLAODFlows } from '../../utils/duckdb';
import type { AgeGroup, SocialGrade } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface ODTopNHeatmapProps {
  socialGrade?: SocialGrade;
  ageGroup?: AgeGroup;
  includeInternalFlows?: boolean;
  initialTopN?: number;
}

interface MatrixArea {
  code: string;
  name: string;
}

function truncate(value: string, max = 18): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function getHeatColor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '#F8FAFC';
  const ratio = value / max;
  if (ratio >= 0.8) return MAP_COLORS.analytics.heatmap.veryHigh;
  if (ratio >= 0.6) return MAP_COLORS.analytics.heatmap.high;
  if (ratio >= 0.4) return MAP_COLORS.analytics.heatmap.medium;
  if (ratio >= 0.2) return MAP_COLORS.analytics.heatmap.low;
  return MAP_COLORS.analytics.heatmap.min;
}

export function ODTopNHeatmap({
  socialGrade = 'all',
  ageGroup = 'all',
  includeInternalFlows = false,
  initialTopN = 10,
}: ODTopNHeatmapProps) {
  const [topN, setTopN] = useState<number>(initialTopN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrixData, setMatrixData] = useState<Map<string, Map<string, number>>>(new Map());
  const [areas, setAreas] = useState<MatrixArea[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadHeatmap() {
      setLoading(true);
      setError(null);

      try {
        const flows = await getTopLTLAODFlows(socialGrade, ageGroup, topN, includeInternalFlows);
        const areaMap = new Map<string, string>();
        const matrix = new Map<string, Map<string, number>>();

        flows.forEach((flow) => {
          areaMap.set(flow.origin_ltla_code, flow.origin_ltla_name);
          areaMap.set(flow.dest_ltla_code, flow.dest_ltla_name);

          if (!matrix.has(flow.origin_ltla_code)) {
            matrix.set(flow.origin_ltla_code, new Map());
          }
          matrix.get(flow.origin_ltla_code)?.set(flow.dest_ltla_code, flow.count);
        });

        const areaTotals = new Map<string, number>();
        flows.forEach((flow) => {
          areaTotals.set(flow.origin_ltla_code, (areaTotals.get(flow.origin_ltla_code) || 0) + flow.count);
          areaTotals.set(flow.dest_ltla_code, (areaTotals.get(flow.dest_ltla_code) || 0) + flow.count);
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
  }, [socialGrade, ageGroup, topN, includeInternalFlows]);

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
      <div className="flex items-center justify-center h-72">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="h-72 flex items-center justify-center text-red-600 text-sm">{error}</div>;
  }

  if (areas.length === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-gray-500 text-center p-4">
        <p className="font-semibold">Sem dados OD para heatmap</p>
        <p className="text-sm mt-1">Ajuste filtros demográficos ou top N</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800">Heatmap OD (Top N LTLA)</h3>
            <ChartObjectiveHelp objective="Evidenciar padrões de fluxo origem-destino que não ficam claros apenas no mapa, focando nas áreas de maior atividade." />
          </div>
          <p className="text-xs text-gray-600">Matriz origem x destino para padrões de fluxo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTopN(8)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              topN === 8 ? 'border-purple-600 bg-purple-600 text-white' : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
            }`}
          >
            Top 8
          </button>
          <button
            type="button"
            onClick={() => setTopN(10)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              topN === 10 ? 'border-purple-600 bg-purple-600 text-white' : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
            }`}
          >
            Top 10
          </button>
          <button
            type="button"
            onClick={() => setTopN(12)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              topN === 12 ? 'border-purple-600 bg-purple-600 text-white' : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
            }`}
          >
            Top 12
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-purple-100">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-purple-50 text-purple-900">
              <th className="sticky left-0 z-10 bg-purple-50 px-2 py-2 text-left">Origem \ Destino</th>
              {areas.map((area) => (
                <th key={area.code} className="px-2 py-2 text-center min-w-[92px]" title={area.name}>
                  {truncate(area.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {areas.map((origin) => (
              <tr key={origin.code} className="border-t border-purple-50">
                <td className="sticky left-0 z-10 bg-white px-2 py-2 font-medium text-gray-800" title={origin.name}>
                  {truncate(origin.name)}
                </td>
                {areas.map((dest) => {
                  const value = matrixData.get(origin.code)?.get(dest.code) || 0;
                  const color = getHeatColor(value, maxValue);
                  const textColor = value > maxValue * 0.6 ? '#FFFFFF' : '#312E81';

                  return (
                    <td
                      key={`${origin.code}-${dest.code}`}
                      className="px-2 py-2 text-center"
                      style={{ backgroundColor: color, color: textColor }}
                      title={`${origin.name} → ${dest.name}: ${value.toLocaleString()}`}
                    >
                      {value > 0 ? value.toLocaleString() : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-600">
        <span>Escala:</span>
        <div className="h-3 w-16 rounded" style={{ backgroundColor: MAP_COLORS.analytics.heatmap.min }}></div>
        <span>baixo</span>
        <div className="h-3 w-16 rounded" style={{ backgroundColor: MAP_COLORS.analytics.heatmap.high }}></div>
        <span>alto</span>
      </div>
    </div>
  );
}
