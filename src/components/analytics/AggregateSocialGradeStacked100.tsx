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
import { getAggregateSocialGradeShares } from '../../utils/duckdb';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AggregateSocialGradeStacked100Props {
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
  initialTopN?: 12 | 20;
}

interface AggregateStackedDatum {
  aggregateAreaCode: string;
  aggregateAreaName: string;
  aggregateAreaLabel: string;
  aggregateAreaTotal: number;
  AB: number;
  C1: number;
  C2: number;
  DE: number;
}

const GRADE_COLORS = MAP_COLORS.analytics.socialGrade;

function truncateLabel(value: string, maxLength = 24): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}

export function AggregateSocialGradeStacked100({
  direction = 'incoming',
  includeInternalFlows = false,
  initialTopN = 12,
}: AggregateSocialGradeStacked100Props) {
  const [selectedTopN, setSelectedTopN] = useState<12 | 20>(initialTopN);
  const [orderBy, setOrderBy] = useState<'total' | 'AB' | 'DE'>('total');
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
        const result = await getAggregateSocialGradeShares(direction, 30, includeInternalFlows);
        const byAggregateArea = new Map<string, AggregateStackedDatum>();

        result.forEach((row) => {
          if (!byAggregateArea.has(row.aggregate_area_code)) {
            byAggregateArea.set(row.aggregate_area_code, {
              aggregateAreaCode: row.aggregate_area_code,
              aggregateAreaName: row.aggregate_area_name || row.aggregate_area_code,
              aggregateAreaLabel: truncateLabel(row.aggregate_area_name || row.aggregate_area_code),
              aggregateAreaTotal: row.aggregate_area_total,
              AB: 0,
              C1: 0,
              C2: 0,
              DE: 0,
            });
          }

          const target = byAggregateArea.get(row.aggregate_area_code);
          if (!target) return;

          target[row.social_grade_group] = row.percentage;
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
  }, [direction, includeInternalFlows]);

  const visibleRows = useMemo(() => {
    const sorted = [...rows];

    sorted.sort((a, b) => {
      if (orderBy === 'AB') return b.AB - a.AB;
      if (orderBy === 'DE') return b.DE - a.DE;
      return b.aggregateAreaTotal - a.aggregateAreaTotal;
    });

    return sorted.slice(0, selectedTopN);
  }, [rows, orderBy, selectedTopN]);

  const chartHeight = useMemo(() => Math.max(380, visibleRows.length * 34 + 110), [visibleRows.length]);

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
        <p className="font-semibold">Sem dados de classe social para {aggregateUnitLabel}</p>
        <p className="mt-2 text-sm">Verifique a disponibilidade do dataset demografico</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">
            Classe social por {aggregateUnitLabel} (100%)
          </h3>
          <ChartObjectiveHelp
            objective={`Comparar proporcionalmente o perfil social (AB/C1/C2/DE) entre ${aggregateUnitPluralLabel.toLowerCase()}, independentemente do volume absoluto.`}
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
        <button
          type="button"
          onClick={() => setOrderBy('AB')}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            orderBy === 'AB'
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Ordem: AB%
        </button>
        <button
          type="button"
          onClick={() => setOrderBy('DE')}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            orderBy === 'DE'
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Ordem: DE%
        </button>
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
          <Bar dataKey="AB" stackId="grade" fill={GRADE_COLORS.AB} />
          <Bar dataKey="C1" stackId="grade" fill={GRADE_COLORS.C1} />
          <Bar dataKey="C2" stackId="grade" fill={GRADE_COLORS.C2} />
          <Bar dataKey="DE" stackId="grade" fill={GRADE_COLORS.DE} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
