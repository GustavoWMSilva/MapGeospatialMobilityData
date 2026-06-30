import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAggregateDirectionalBalancesForFilters } from '../../utils/duckdb';
import type { DemographicDimensionConfig, DemographicFilters, GeographyLevel } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface SocialGradeSmallMultiplesProps {
  dimension: DemographicDimensionConfig;
  demographicFilters?: DemographicFilters;
  geographyLevel?: GeographyLevel;
  includeInternalFlows?: boolean;
  topN?: number;
  onSelectArea?: (areaCode: string, areaName: string) => void;
}

interface MultipleRow {
  aggregateAreaCode: string;
  aggregateAreaName: string;
  balance: number;
}

interface MultipleClickPayload {
  payload?: MultipleRow;
}

interface MultipleChart {
  value: string;
  title: string;
  rows: MultipleRow[];
}

const COLORS = [
  MAP_COLORS.analytics.palette.purple,
  MAP_COLORS.analytics.palette.blue,
  MAP_COLORS.analytics.palette.teal,
  MAP_COLORS.analytics.palette.orange,
  MAP_COLORS.analytics.palette.rose,
];

function shortName(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 11)}...`;
}

export function SocialGradeSmallMultiples({
  dimension,
  demographicFilters = {},
  geographyLevel = 'aggregate',
  includeInternalFlows = false,
  topN = 6,
  onSelectArea,
}: SocialGradeSmallMultiplesProps) {
  const [charts, setCharts] = useState<MultipleChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAllSegments() {
      setLoading(true);
      setError(null);

      try {
        const results = await Promise.all(
          [
            { value: 'all', label: 'Todos' },
            ...dimension.options.filter((option) => option.value !== 'all'),
          ].slice(0, 5).map(async (config) => {
            const nextFilters =
              config.value === 'all'
                ? demographicFilters
                : { ...demographicFilters, [dimension.key]: config.value };
            const balances = await getAggregateDirectionalBalancesForFilters(
              nextFilters,
              topN,
              includeInternalFlows,
              geographyLevel
            );
            const rows = balances.map((row) => ({
              aggregateAreaCode: row.aggregate_area_code,
              aggregateAreaName: row.aggregate_area_name || row.aggregate_area_code,
              balance: row.balance,
            }));

            return {
              value: config.value,
              title: config.label,
              rows,
            };
          })
        );

        if (!cancelled) {
          setCharts(results);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCharts([]);
          setError(getAnalyticsErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAllSegments();

    return () => {
      cancelled = true;
    };
  }, [dimension, demographicFilters, topN, includeInternalFlows, geographyLevel]);

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

  if (charts.length === 0 || charts.every((chart) => chart.rows.length === 0)) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-gray-500 text-center p-4">
        <p className="font-semibold">Sem dados para multiplos paineis</p>
        <p className="text-sm mt-1">Verifique filtros ou disponibilidade demografica</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-slate-500">
            Comparacao lado a lado com o mesmo eixo visual
            {onSelectArea ? '. Clique em uma barra para selecionar a area.' : ''}
          </p>
          <ChartObjectiveHelp objective={`Comparar rapidamente o mesmo indicador entre categorias de ${dimension.label.toLowerCase()} usando paineis padronizados.`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {charts.map((chart, index) => (
          <div key={chart.value} className="rounded-lg border border-slate-200 bg-white p-2.5">
            <div className="mb-2 text-xs font-bold text-slate-800">{chart.title}</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chart.rows} layout="vertical" margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="aggregateAreaName"
                  tick={{ fontSize: 10, fill: '#475569' }}
                  width={72}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: string) => shortName(value)}
                />
                <Tooltip
                  formatter={(value: number | string | Array<number | string> | undefined) => [
                    Number(value ?? 0).toLocaleString('pt-BR'),
                    'Saldo',
                  ]}
                  labelFormatter={(label, payload) => {
                    const row = payload && payload.length > 0 ? payload[0]?.payload as MultipleRow | undefined : undefined;
                    if (!row) return String(label);
                    return `${row.aggregateAreaName} (${row.aggregateAreaCode})`;
                  }}
                />
                <Bar
                  dataKey="balance"
                  fill={COLORS[index % COLORS.length]}
                  barSize={10}
                  radius={[0, 4, 4, 0]}
                  cursor={onSelectArea ? 'pointer' : undefined}
                  onClick={(entry: unknown) => {
                    const row = (entry as MultipleClickPayload).payload;
                    if (!row || !onSelectArea) return;
                    onSelectArea(row.aggregateAreaCode, row.aggregateAreaName);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
