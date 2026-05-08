import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACTIVE_DATASET_PROFILE } from '../../constants/datasetProfiles';
import { getAggregateDirectionalBalancesForFilters } from '../../utils/duckdb';
import type { DemographicFilters } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AggregateDirectionalBalanceChartProps {
  demographicFilters?: DemographicFilters;
  includeInternalFlows?: boolean;
  topN?: number;
}

interface AggregateDirectionalBalanceDatum {
  aggregateAreaCode: string;
  aggregateAreaName: string;
  incoming: number;
  outgoing: number;
  balance: number;
}

const POSITIVE_COLOR = MAP_COLORS.analytics.directional.positive;
const NEGATIVE_COLOR = MAP_COLORS.analytics.directional.negative;

export function AggregateDirectionalBalanceChart({
  demographicFilters = {},
  includeInternalFlows = false,
  topN = 15,
}: AggregateDirectionalBalanceChartProps) {
  const [rows, setRows] = useState<AggregateDirectionalBalanceDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const aggregateUnitLabel = ACTIVE_DATASET_PROFILE.labels.aggregate.singular;

  useEffect(() => {
    let cancelled = false;

    async function loadBalances() {
      setLoading(true);
      setError(null);

      try {
        const balances = await getAggregateDirectionalBalancesForFilters(
          demographicFilters,
          topN,
          includeInternalFlows
        );

        const normalized = balances.map((row) => ({
          aggregateAreaCode: row.aggregate_area_code,
          aggregateAreaName: row.aggregate_area_name || row.aggregate_area_code,
          incoming: row.incoming_total,
          outgoing: row.outgoing_total,
          balance: row.balance,
        }));

        if (!cancelled) {
          setRows(normalized);
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

    void loadBalances();

    return () => {
      cancelled = true;
    };
  }, [demographicFilters, topN, includeInternalFlows]);

  const chartHeight = useMemo(() => Math.max(360, rows.length * 34 + 110), [rows.length]);
  const maxAbsBalance = useMemo(
    () => Math.max(1, ...rows.map((row) => Math.abs(row.balance))),
    [rows]
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

  if (rows.length === 0) {
    return (
      <div className="flex h-80 flex-col items-center justify-center p-4 text-center text-gray-500">
        <p className="font-semibold">Sem dados para saldo direcional por {aggregateUnitLabel}</p>
        <p className="mt-2 text-sm">Ajuste os filtros demograficos para tentar novamente</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-800">
            Saldo Direcional por {aggregateUnitLabel}
          </h3>
          <ChartObjectiveHelp
            objective={`Identificar areas atratoras e emissoras com o saldo liquido (incoming - outgoing) por ${aggregateUnitLabel}.`}
          />
        </div>
        <p className="text-sm text-gray-600">Saldo = entrada - saida (positivo = area atratora)</p>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 28, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[-maxAbsBalance, maxAbsBalance]}
            tickFormatter={(value: number) => Number(value).toLocaleString('pt-BR')}
          />
          <YAxis
            type="category"
            dataKey="aggregateAreaName"
            width={250}
            interval={0}
            tick={{ fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke="#374151" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined, name) => [
              Number(value ?? 0).toLocaleString('pt-BR'),
              name === 'balance' ? 'Saldo' : String(name ?? 'Valor'),
            ]}
            labelFormatter={(label, payload) => {
              const row =
                payload && payload.length > 0
                  ? (payload[0]?.payload as AggregateDirectionalBalanceDatum | undefined)
                  : undefined;
              if (!row) return String(label);
              return `${row.aggregateAreaName} (${row.aggregateAreaCode})`;
            }}
          />
          <Bar dataKey="balance" name="saldo" radius={[4, 4, 4, 4]}>
            {rows.map((row) => (
              <Cell
                key={row.aggregateAreaCode}
                fill={row.balance >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: POSITIVE_COLOR }}></span>
          Atratora (saldo positivo)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: NEGATIVE_COLOR }}></span>
          Emissora (saldo negativo)
        </span>
      </div>
    </div>
  );
}
