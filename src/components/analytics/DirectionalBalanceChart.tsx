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
import { getLTLADirectionalBalances } from '../../utils/duckdb';
import type { AgeGroup, SocialGrade } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface DirectionalBalanceChartProps {
  socialGrade?: SocialGrade;
  ageGroup?: AgeGroup;
  includeInternalFlows?: boolean;
  topN?: number;
}

interface DirectionalBalanceDatum {
  ltlaCode: string;
  ltlaName: string;
  incoming: number;
  outgoing: number;
  balance: number;
}

const POSITIVE_COLOR = MAP_COLORS.analytics.directional.positive;
const NEGATIVE_COLOR = MAP_COLORS.analytics.directional.negative;

export function DirectionalBalanceChart({
  socialGrade = 'all',
  ageGroup = 'all',
  includeInternalFlows = false,
  topN = 15,
}: DirectionalBalanceChartProps) {
  const [rows, setRows] = useState<DirectionalBalanceDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBalances() {
      setLoading(true);
      setError(null);

      try {
        const balances = await getLTLADirectionalBalances(socialGrade, ageGroup, topN, includeInternalFlows);

        const normalized = balances.map((row) => ({
          ltlaCode: row.ltla_code,
          ltlaName: row.ltla_name || row.ltla_code,
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
  }, [socialGrade, ageGroup, topN, includeInternalFlows]);

  const chartHeight = useMemo(() => Math.max(360, rows.length * 34 + 110), [rows.length]);
  const maxAbsBalance = useMemo(
    () => Math.max(1, ...rows.map((row) => Math.abs(row.balance))),
    [rows]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-gray-500 p-4 text-center">
        <p className="font-semibold">Sem dados para saldo direcional LTLA</p>
        <p className="text-sm mt-2">Ajuste os filtros demográficos para tentar novamente</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-800">Saldo Direcional por LTLA</h3>
          <ChartObjectiveHelp objective="Identificar áreas atratoras e emissoras com o saldo líquido (incoming - outgoing) por LTLA." />
        </div>
        <p className="text-sm text-gray-600">Saldo = incoming - outgoing (positivo = área atratora)</p>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 28, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[-maxAbsBalance, maxAbsBalance]}
            tickFormatter={(value: number) => Number(value).toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="ltlaName"
            width={250}
            interval={0}
            tick={{ fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke="#374151" strokeDasharray="4 4" />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined, name) => [
              Number(value ?? 0).toLocaleString(),
              name === 'balance' ? 'Saldo' : String(name ?? 'Valor'),
            ]}
            labelFormatter={(label, payload) => {
              const row = payload && payload.length > 0 ? payload[0]?.payload as DirectionalBalanceDatum | undefined : undefined;
              if (!row) return String(label);
              return `${row.ltlaName} (${row.ltlaCode})`;
            }}
          />
          <Bar dataKey="balance" name="balance" radius={[4, 4, 4, 4]}>
            {rows.map((row) => (
              <Cell
                key={row.ltlaCode}
                fill={row.balance >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: POSITIVE_COLOR }}></span>
          Atratora (saldo positivo)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: NEGATIVE_COLOR }}></span>
          Emissora (saldo negativo)
        </span>
      </div>
    </div>
  );
}
