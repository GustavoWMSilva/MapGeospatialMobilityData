import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getDemographicDimensionStats } from '../../utils/duckdb';
import { debugLog, debugWarn, getAnalyticsErrorMessage } from './analyticsUtils';
import type { DemographicDimensionConfig } from '../../types';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface SocialGradePieChartProps {
  areaCode: string;
  dimension: DemographicDimensionConfig;
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
  selectedValue?: string;
  onSelectValue?: (value: string) => void;
}

interface CategoryChartDatum {
  code: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
}

const CATEGORY_COLORS = [
  MAP_COLORS.analytics.palette.blue,
  MAP_COLORS.analytics.palette.teal,
  MAP_COLORS.analytics.palette.orange,
  MAP_COLORS.analytics.palette.rose,
  MAP_COLORS.analytics.palette.purple,
  '#64748B',
];

export function SocialGradePieChart({
  areaCode,
  dimension,
  direction = 'incoming',
  includeInternalFlows = false,
  selectedValue = 'all',
  onSelectValue,
}: SocialGradePieChartProps) {
  const [data, setData] = useState<CategoryChartDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugLog(`[SocialGradePieChart] useEffect areaCode=${areaCode} dimension=${dimension.key} direction=${direction}`);

    setData([]);
    setError(null);
    setLoading(true);

    async function loadStats() {
      if (!areaCode) {
        debugLog('[SocialGradePieChart] aguardando selecao de area');
        setLoading(false);
        return;
      }

      debugLog(`[SocialGradePieChart] carregando stats ${dimension.key} para ${areaCode} (${direction})`);

      try {
        setLoading(true);
        setError(null);

        const stats = await getDemographicDimensionStats(areaCode, dimension, direction, includeInternalFlows);
        debugLog('[SocialGradePieChart] stats recebidas', stats);

        if (stats.length === 0) {
          debugWarn('[SocialGradePieChart] nenhum dado retornado');
          setData([]);
          setLoading(false);
          return;
        }

        const chartData = stats.map((stat, index) => {
          return {
            code: stat.value,
            name: stat.label,
            value: stat.total,
            percentage: stat.percentage,
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          };
        });

        debugLog(`[SocialGradePieChart] dados processados (${chartData.length} categorias)`);
        setData(chartData);
      } catch (err) {
        console.error('[SocialGradePieChart] erro ao carregar', err);
        setError(getAnalyticsErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void loadStats();

    return () => {
      debugLog(`[SocialGradePieChart] limpando dados de ${areaCode}`);
      setData([]);
    };
  }, [areaCode, dimension, direction, includeInternalFlows]);

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
        <p className="font-semibold">Dados de classe social nao disponiveis</p>
        <p className="text-sm mt-2">Verifique a configuracao de {dimension.label.toLowerCase()}</p>
      </div>
    );
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    if (percentage < 7) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="black"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="font-semibold text-sm"
      >
        {`${percentage.toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-2">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-slate-500">
            {direction === 'incoming' ? 'Entrada' : 'Saida'} por {dimension.label.toLowerCase()}
          </p>
          <ChartObjectiveHelp objective={`Mostrar a composicao dos fluxos por ${dimension.label.toLowerCase()} na area selecionada.`} />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomLabel}
            innerRadius={42}
            outerRadius={78}
            fill="#8884d8"
            dataKey="value"
            onClick={(_, index) => {
              if (index === undefined) return;
              const clicked = data[index];
              if (!clicked || !onSelectValue) return;
              onSelectValue(selectedValue === clicked.code ? 'all' : clicked.code);
            }}
            cursor="pointer"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                fillOpacity={selectedValue === 'all' || selectedValue === entry.code ? 1 : 0.25}
                stroke={selectedValue === entry.code ? '#111827' : '#ffffff'}
                strokeWidth={selectedValue === entry.code ? 3 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined, name: string | undefined, props: any) => [
              `${Number(value ?? 0).toLocaleString('pt-BR')} (${props.payload.percentage}%)`,
              name ?? 'Pessoas',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs">
        {data.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelectValue?.(selectedValue === item.code ? 'all' : item.code)}
            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition ${
              selectedValue === item.code ? 'bg-slate-100 ring-1 ring-slate-300' : 'hover:bg-slate-50'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-semibold text-slate-900">
              {item.value.toLocaleString('pt-BR')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
