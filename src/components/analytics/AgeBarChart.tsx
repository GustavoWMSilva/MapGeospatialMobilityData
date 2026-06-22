import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDemographicDimensionStats } from '../../utils/duckdb';
import { debugLog, debugWarn, getAnalyticsErrorMessage } from './analyticsUtils';
import type { DemographicDimensionConfig, FlowConnectionFilter } from '../../types';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AgeBarChartProps {
  areaCode: string;
  dimension: DemographicDimensionConfig;
  direction?: 'incoming' | 'outgoing';
  connectionFilters?: FlowConnectionFilter[];
  includeInternalFlows?: boolean;
  selectedValue?: string;
  onSelectValue?: (value: string) => void;
}

interface CategoryBarDatum {
  value: string;
  name: string;
  shortName: string;
  total: number;
  percentage: number;
  color: string;
}

interface CategoryTooltipPayload {
  payload?: {
    percentage?: number;
  };
}

interface CategoryClickPayload {
  payload?: {
    value?: string;
  };
}

const CATEGORY_COLORS = [
  MAP_COLORS.analytics.palette.blue,
  MAP_COLORS.analytics.palette.teal,
  MAP_COLORS.analytics.palette.orange,
  MAP_COLORS.analytics.palette.rose,
  MAP_COLORS.analytics.palette.purple,
  '#64748B',
];
const EMPTY_CONNECTION_FILTERS: FlowConnectionFilter[] = [];

function getShortCategoryLabel(label: string, value: string): string {
  const ageRange = label.match(/\d+\s*[-–]\s*\d+/);
  if (ageRange) return ageRange[0].replace(/\s/g, '');

  const plusAge = label.match(/\d+\s*\+/);
  if (plusAge) return plusAge[0].replace(/\s/g, '');

  const agedRange = value.match(/aged\s+(\d+)\s+to\s+(\d+)/i);
  if (agedRange) return `${agedRange[1]}-${agedRange[2]}`;

  const agedPlus = value.match(/aged\s+(\d+)\s*(?:years)?\s*(?:and over|\+)/i);
  if (agedPlus) return `${agedPlus[1]}+`;

  const beforeParentheses = label.split('(')[0]?.trim();
  if (beforeParentheses && beforeParentheses.length <= 10) return beforeParentheses;

  return label.length > 10 ? `${label.slice(0, 9)}...` : label;
}

export function AgeBarChart({
  areaCode,
  dimension,
  direction = 'incoming',
  connectionFilters = EMPTY_CONNECTION_FILTERS,
  includeInternalFlows = false,
  selectedValue = 'all',
  onSelectValue,
}: AgeBarChartProps) {
  const [data, setData] = useState<CategoryBarDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugLog(`[AgeBarChart] useEffect areaCode=${areaCode} dimension=${dimension.key} direction=${direction}`);

    setData([]);
    setError(null);
    setLoading(true);

    async function loadStats() {
      if (!areaCode) {
        debugLog('[AgeBarChart] aguardando selecao de area');
        setLoading(false);
        return;
      }

      debugLog(`[AgeBarChart] carregando stats ${dimension.key} para ${areaCode} (${direction})`);

      try {
        setLoading(true);
        setError(null);

        const stats = await getDemographicDimensionStats(
          areaCode,
          dimension,
          direction,
          includeInternalFlows,
          connectionFilters.map((filter) => filter.code)
        );
        debugLog('[AgeBarChart] stats recebidas', stats);

        if (stats.length === 0) {
          debugWarn('[AgeBarChart] nenhum dado retornado');
          setData([]);
          setLoading(false);
          return;
        }

        const optionOrder = new Map(dimension.options.map((option, index) => [option.value, index]));
        const chartData = stats.map((stat, index) => ({
          value: stat.value,
          name: stat.label,
          shortName: getShortCategoryLabel(stat.label, stat.value),
          total: stat.total,
          percentage: stat.percentage,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        }));

        chartData.sort((left, right) => (optionOrder.get(left.value) ?? 999) - (optionOrder.get(right.value) ?? 999));

        debugLog(`[AgeBarChart] dados processados (${chartData.length} grupos)`);
        setData(chartData);
      } catch (err) {
        console.error('[AgeBarChart] erro ao carregar', err);
        setError(getAnalyticsErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void loadStats();

    return () => {
      debugLog(`[AgeBarChart] limpando dados de ${areaCode}`);
      setData([]);
    };
  }, [areaCode, dimension, direction, connectionFilters, includeInternalFlows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 p-4 text-center">
        <p className="font-semibold">Dados de {dimension.label.toLowerCase()} nao disponiveis</p>
        <p className="text-sm mt-2">Verifique o dataset configurado para esta dimensao</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-slate-500">
            {connectionFilters.length > 0
              ? `${connectionFilters.length} fluxo${connectionFilters.length > 1 ? 's' : ''} por ${dimension.label.toLowerCase()}`
              : `${direction === 'incoming' ? 'Entrada' : 'Saida'} por ${dimension.label.toLowerCase()}`}
          </p>
          <ChartObjectiveHelp objective={`Evidenciar a distribuicao dos fluxos por ${dimension.label.toLowerCase()}.`} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="shortName"
            interval={0}
            tick={{ fontSize: 10, fill: '#475569' }}
            tickMargin={6}
            height={26}
            axisLine={false}
            tickLine={false}
          />
          <YAxis width={38} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined, _name: string | undefined, props: unknown) => {
              const payload = (props as CategoryTooltipPayload).payload;
              return [
                `${Number(value ?? 0).toLocaleString('pt-BR')} (${payload?.percentage ?? 0}%)`,
                'Pessoas',
              ];
            }}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as CategoryBarDatum | undefined;
              return row?.name ?? '';
            }}
          />
          <Bar
            dataKey="total"
            fill="#8884d8"
            radius={[5, 5, 0, 0]}
            onClick={(entry: unknown) => {
              const clickedValue = (entry as CategoryClickPayload).payload?.value;
              if (!clickedValue || !onSelectValue) return;
              onSelectValue(selectedValue === clickedValue ? 'all' : clickedValue);
            }}
            cursor="pointer"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                fillOpacity={selectedValue === 'all' || selectedValue === entry.value ? 1 : 0.25}
                stroke={selectedValue === entry.value ? '#111827' : 'transparent'}
                strokeWidth={selectedValue === entry.value ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs">
        {data.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelectValue?.(selectedValue === item.value ? 'all' : item.value)}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition ${
              selectedValue === item.value ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-semibold text-slate-900">
              {item.total.toLocaleString('pt-BR')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
