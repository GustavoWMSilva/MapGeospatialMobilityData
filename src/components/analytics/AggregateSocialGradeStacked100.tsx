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
import type {
  DemographicDimensionConfig,
  DemographicDimensionOption,
  DemographicFilters,
  GeographyLevel,
} from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AggregateSocialGradeStacked100Props {
  dimension: DemographicDimensionConfig;
  demographicFilters?: DemographicFilters;
  geographyLevel?: GeographyLevel;
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
  initialTopN?: 12 | 20;
  onSelectArea?: (areaCode: string, areaName: string) => void;
}

interface AggregateStackedDatum {
  aggregateAreaCode: string;
  aggregateAreaName: string;
  aggregateAreaLabel: string;
  aggregateAreaTotal: number;
  [categoryValue: string]: string | number;
}

interface StackedClickPayload {
  payload?: AggregateStackedDatum;
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

function normalizeDimensionText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findCategoryOption(
  value: string,
  options: DemographicDimensionOption[]
): DemographicDimensionOption | undefined {
  const normalizedValue = normalizeDimensionText(value);
  const valueTokens = ` ${normalizedValue.replace(/[^a-z0-9]+/g, ' ')} `;

  return options.find((option) => {
    const optionValue = normalizeDimensionText(option.value);
    const optionLabel = normalizeDimensionText(option.label);

    if (normalizedValue === optionValue || normalizedValue === optionLabel) {
      return true;
    }

    if (optionLabel.includes(normalizedValue) || normalizedValue.includes(optionLabel)) {
      return true;
    }

    return optionValue.length <= 3 && valueTokens.includes(` ${optionValue} `);
  });
}

function normalizeCategoryValue(value: string, dimension: DemographicDimensionConfig): string {
  const match = findCategoryOption(value, dimension.options);
  return match?.value || value;
}

export function AggregateSocialGradeStacked100({
  dimension,
  demographicFilters = {},
  geographyLevel = 'aggregate',
  direction = 'incoming',
  includeInternalFlows = false,
  initialTopN = 12,
  onSelectArea,
}: AggregateSocialGradeStacked100Props) {
  const [selectedTopN, setSelectedTopN] = useState<12 | 20>(initialTopN);
  const [orderBy, setOrderBy] = useState<string>('total');
  const [rows, setRows] = useState<AggregateStackedDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeUnitLabel =
    geographyLevel === 'aggregate'
      ? ACTIVE_DATASET_PROFILE.labels.aggregate.singular
      : ACTIVE_DATASET_PROFILE.labels.base.singular;
  const activeUnitPluralLabel =
    geographyLevel === 'aggregate'
      ? ACTIVE_DATASET_PROFILE.labels.aggregate.plural
      : ACTIVE_DATASET_PROFILE.labels.base.plural;

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
          includeInternalFlows,
          geographyLevel
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

          const categoryKey = normalizeCategoryValue(row.category_value, dimension);
          target[categoryKey] = Number(target[categoryKey] || 0) + row.percentage;
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
  }, [dimension, demographicFilters, direction, includeInternalFlows, geographyLevel]);

  const visibleRows = useMemo(() => {
    const sorted = [...rows];

    sorted.sort((a, b) => {
      if (orderBy !== 'total') return Number(b[orderBy] || 0) - Number(a[orderBy] || 0);
      return b.aggregateAreaTotal - a.aggregateAreaTotal;
    });

    return sorted.slice(0, selectedTopN);
  }, [rows, orderBy, selectedTopN]);

  const chartHeight = useMemo(() => Math.max(300, visibleRows.length * 24 + 80), [visibleRows.length]);
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
        <p className="font-semibold">Sem dados de {dimension.label.toLowerCase()} para {activeUnitLabel}</p>
        <p className="mt-2 text-sm">Verifique a disponibilidade do dataset demografico</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-slate-500">
            Comparativo proporcional por area ({direction === 'incoming' ? 'entrada' : 'saida'})
            {onSelectArea ? '. Clique em uma barra para selecionar a area.' : ''}
          </p>
          <ChartObjectiveHelp
            objective={`Comparar proporcionalmente ${dimension.label.toLowerCase()} entre ${activeUnitPluralLabel.toLowerCase()}, independentemente do volume absoluto.`}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedTopN(12)}
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
            selectedTopN === 12
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Top 12
        </button>
        <button
          type="button"
          onClick={() => setSelectedTopN(20)}
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
            selectedTopN === 20
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Top 20
        </button>
        <button
          type="button"
          onClick={() => setOrderBy('total')}
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
            orderBy === 'total'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Ordem: Total
        </button>
        {categories.slice(0, 3).map((category) => (
          <button
            key={category.value}
            type="button"
            onClick={() => setOrderBy(category.value)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              orderBy === category.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Ordem: {category.label}%
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={visibleRows} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
          <XAxis type="number" domain={[0, 100]} tickFormatter={(value: number) => `${Number(value)}%`} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <YAxis
            dataKey="aggregateAreaLabel"
            type="category"
            interval={0}
            width={120}
            tick={{ fontSize: 10, fill: '#475569' }}
            axisLine={false}
            tickLine={false}
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
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {categories.map((category, index) => (
            <Bar
              key={category.value}
              dataKey={category.value}
              name={category.label}
              stackId="category"
              fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
              cursor={onSelectArea ? 'pointer' : undefined}
              onClick={(entry: unknown) => {
                const row = (entry as StackedClickPayload).payload;
                if (!row || !onSelectArea) return;
                onSelectArea(row.aggregateAreaCode, row.aggregateAreaName);
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
