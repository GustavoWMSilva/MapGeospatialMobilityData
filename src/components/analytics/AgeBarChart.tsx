import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDemographicDimensionStats } from '../../utils/duckdb';
import { debugLog, debugWarn, getAnalyticsErrorMessage } from './analyticsUtils';
import type { DemographicDimensionConfig } from '../../types';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AgeBarChartProps {
  areaCode: string;
  dimension: DemographicDimensionConfig;
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
  selectedValue?: string;
  onSelectValue?: (value: string) => void;
}

interface CategoryBarDatum {
  value: string;
  name: string;
  total: number;
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

export function AgeBarChart({
  areaCode,
  dimension,
  direction = 'incoming',
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

        const stats = await getDemographicDimensionStats(areaCode, dimension, direction, includeInternalFlows);
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
        <p className="font-semibold">Dados de {dimension.label.toLowerCase()} nao disponiveis</p>
        <p className="text-sm mt-2">Verifique o dataset configurado para esta dimensao</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">
            Distribuicao por {dimension.label.toLowerCase()}
          </h3>
          <ChartObjectiveHelp objective={`Evidenciar a distribuicao dos fluxos por ${dimension.label.toLowerCase()}.`} />
        </div>
        <p className="text-sm text-gray-600">
          {direction === 'incoming' ? 'Entrada' : 'Saida'} por {dimension.label.toLowerCase()}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
          <YAxis width={44} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined, _name: string | undefined, props: any) => [
              `${Number(value ?? 0).toLocaleString('pt-BR')} (${props.payload.percentage}%)`,
              'Pessoas',
            ]}
          />
          <Bar
            dataKey="total"
            fill="#8884d8"
            radius={[6, 6, 0, 0]}
            onClick={(entry: any) => {
              const clickedValue = entry?.value as string | undefined;
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

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
        {data.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelectValue?.(selectedValue === item.value ? 'all' : item.value)}
            className={`flex items-center gap-2 rounded px-2 py-1 text-left transition ${
              selectedValue === item.value ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'
            }`}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">
              {item.name}: <strong>{item.total.toLocaleString('pt-BR')}</strong>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
