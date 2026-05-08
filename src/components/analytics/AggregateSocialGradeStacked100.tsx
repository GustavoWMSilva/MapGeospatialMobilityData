import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACTIVE_DATASET_PROFILE } from '../../constants/datasetProfiles';
import { getAggregateDimensionShares } from '../../utils/duckdb';
import type { DemographicDimensionConfig, DemographicFilters } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AggregateSocialGradeStacked100Props {
  dimension: DemographicDimensionConfig;
  demographicFilters?: DemographicFilters;
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
  initialTopN?: 12 | 20;
}

interface AggregateStackedDatum {
  aggregateAreaCode: string;
  aggregateAreaName: string;
  aggregateAreaLabel: string;
  aggregateAreaTotal: number;
  [categoryValue: string]: string | number;
}

const CATEGORY_COLORS = [
  MAP_COLORS.analytics.palette.blue,
  MAP_COLORS.analytics.palette.teal,
  MAP_COLORS.analytics.palette.orange,
  MAP_COLORS.analytics.palette.rose,
  MAP_COLORS.analytics.palette.purple,
  '#64748B',
];

function truncateLabel(value: string, maxLength = 24): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}

export function AggregateSocialGradeStacked100({
  dimension,
  demographicFilters = {},
  direction = 'incoming',
  includeInternalFlows = false,
  initialTopN = 12,
}: AggregateSocialGradeStacked100Props) {
  const [selectedTopN, setSelectedTopN] = useState<12 | 20>(initialTopN);
  const [orderBy, setOrderBy] = useState<string>('total');
  const [rows, setRows] = useState<AggregateStackedDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aggregateUnitLabel = ACTIVE_DATASET_PROFILE.labels.aggregate.singular;
  const aggregateUnitPluralLabel = ACTIVE_DATASET_PROFILE.labels.aggregate.plural;

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await getAggregateDimensionShares(
          dimension,
          demographicFilters,
          direction,
          30,
          includeInternalFlows
        );
        const byAggregateArea = new Map<string, AggregateStackedDatum>();

        result.forEach((row) => {
          if (!byAggregateArea.has(row.aggregate_area_code)) {
            byAggregateArea.set(row.aggregate_area_code, {
              aggregateAreaCode: row.aggregate_area_code,
              aggregateAreaName: row.aggregate_area_name || row.aggregate_area_code,
              aggregateAreaLabel: truncateLabel(row.aggregate_area_name || row.aggregate_area_code),
              aggregateAreaTotal: row.aggregate_area_total,
            });
          }

          const target = byAggregateArea.get(row.aggregate_area_code);
          if (!target) return;

          target[row.category_value] = row.percentage;
        });

        if (!cancelled) {
          setRows(Array.from(byAggregateArea.values()));
        }
      } catch (loadError) {
        if (!cancelled) {
          setRows([]);
          setError(getAnalyticsErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [dimension, demographicFilters, direction, includeInternalFlows]);

  const visibleRows = useMemo(() => {
    const sorted = [...rows];

    sorted.sort((a, b) => {
      if (orderBy !== 'total') return Number(b[orderBy] || 0) - Number(a[orderBy] || 0);
      return b.aggregateAreaTotal - a.aggregateAreaTotal;
    });

    return sorted.slice(0, selectedTopN);
  }, [rows, orderBy, selectedTopN]);

  const chartHeight = useMemo(() => Math.max(380, visibleRows.length * 34 + 110), [visibleRows.length]);
  const categories = useMemo(
    () => dimension.options.filter((option) => option.value !== 'all'),
    [dimension.options]
  );

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="flex h-80 items-center justify-center text-sm text-red-600">{error}</div>;
  }

  if (visibleRows.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center p-4 text-center text-gray-500">
        <p className="font-semibold">Sem dados de {dimension.label.toLowerCase()} para {aggregateUnitLabel}</p>
        <p className="mt-2 text-sm">Verifique a disponibilidade do dataset demografico</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">
            {dimension.label} por {aggregateUnitLabel} (100%)
          </h3>
          <ChartObjectiveHelp
            objective={`Comparar proporcionalmente ${dimension.label.toLowerCase()} entre ${aggregateUnitPluralLabel.toLowerCase()}, independentemente do volume absoluto.`}
          />
        </div>
        <p className="text-xs text-gray-600">
          Comparativo proporcional por area ({direction === 'incoming' ? 'entrada' : 'saida'})
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedTopN(12)}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            selectedTopN === 12
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Top 12
        </button>
        <button
          type="button"
          onClick={() => setSelectedTopN(20)}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            selectedTopN === 20
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Top 20
        </button>
        <button
          type="button"
          onClick={() => setOrderBy('total')}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            orderBy === 'total'
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Ordem: Total
        </button>
        {categories.slice(0, 3).map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setOrderBy(category.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              orderBy === category.value
                ? 'border-purple-600 bg-purple-600 text-white'
                : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
            }`}
          >
            Ordem: {category.label}%
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={visibleRows} layout="vertical" margin={{ top: 4, right: 20, left: 24, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(value: number) => `${Number(value)}%`} />
          <YAxis
            dataKey="aggregateAreaLabel"
            type="category"
            interval={0}
            width={180}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined, name) => [
              `${Number(value ?? 0).toFixed(2)}%`,
              String(name ?? ''),
            ]}
            labelFormatter={(_label, payload) => {
              const row =
                payload && payload.length > 0
                  ? (payload[0]?.payload as AggregateStackedDatum | undefined)
                  : undefined;
              if (!row) return '';
              return `${row.aggregateAreaName} (${row.aggregateAreaCode})`;
            }}
          />
          <Legend />
          {categories.map((category, index) => (
            <Bar
              key={category.value}
              dataKey={category.value}
              name={category.label}
              stackId="category"
              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
