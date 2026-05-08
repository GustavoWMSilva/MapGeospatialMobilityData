import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getAggregateDirectionalBalancesForFilters } from '../../utils/duckdb';
import type { DemographicDimensionConfig, DemographicFilters } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface SocialGradeSmallMultiplesProps {
  dimension: DemographicDimensionConfig;
  demographicFilters?: DemographicFilters;
  includeInternalFlows?: boolean;
  topN?: number;
}

interface MultipleRow {
  aggregateAreaCode: string;
  aggregateAreaName: string;
  balance: number;
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
  if (value.length <= 18) return value;
  return `${value.slice(0, 17)}...`;
}

export function SocialGradeSmallMultiples({
  dimension,
  demographicFilters = {},
  includeInternalFlows = false,
  topN = 6,
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
          ].slice(0, 4).map(async (config) => {
            const nextFilters =
              config.value === 'all'
                ? demographicFilters
                : { ...demographicFilters, [dimension.key]: config.value };
            const balances = await getAggregateDirectionalBalancesForFilters(nextFilters, topN, includeInternalFlows);
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
  }, [dimension, demographicFilters, topN, includeInternalFlows]);

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
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">Multiplos paineis por {dimension.label.toLowerCase()}</h3>
          <ChartObjectiveHelp objective={`Comparar rapidamente o mesmo indicador entre categorias de ${dimension.label.toLowerCase()} usando paineis padronizados.`} />
        </div>
        <p className="text-xs text-gray-600">Comparacao lado a lado com o mesmo eixo visual</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {charts.map((chart, index) => (
          <div key={chart.value} className="rounded-lg border border-purple-100 bg-white p-3">
            <div className="mb-2 text-sm font-semibold text-gray-800">{chart.title}</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart.rows} layout="vertical" margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(value: number) => Number(value).toLocaleString('pt-BR')} />
                <YAxis
                  type="category"
                  dataKey="aggregateAreaName"
                  tick={{ fontSize: 10 }}
                  width={88}
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
                <Bar dataKey="balance" fill={COLORS[index % COLORS.length]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
}
