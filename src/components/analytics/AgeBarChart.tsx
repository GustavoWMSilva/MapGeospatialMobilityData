import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getAgeStats } from '../../utils/duckdb';
import { debugLog, debugWarn, getAnalyticsErrorMessage } from './analyticsUtils';
import type { AgeGroup } from '../../types';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AgeBarChartProps {
  areaCode: string;
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
  selectedAgeGroup?: AgeGroup;
  onSelectAgeGroup?: (age: AgeGroup) => void;
}

interface AgeChartDatum {
  name: string;
  fullName: AgeGroup;
  total: number;
  percentage: number;
  color: string;
}

const AGE_COLORS: Record<string, string> = MAP_COLORS.analytics.age;

function getAgeColor(ageGroup: string): string {
  if (ageGroup.includes('16 to 24')) return AGE_COLORS['16-24'];
  if (ageGroup.includes('25 to 34')) return AGE_COLORS['25-34'];
  if (ageGroup.includes('35 to 44')) return AGE_COLORS['35-44'];
  if (ageGroup.includes('45 to 54')) return AGE_COLORS['45-54'];
  if (ageGroup.includes('55 to 64')) return AGE_COLORS['55-64'];
  if (ageGroup.includes('65')) return AGE_COLORS['65+'];
  return '#666';
}

function simplifyAgeLabel(ageGroup: string): string {
  if (ageGroup.includes('16 to 24')) return '16-24';
  if (ageGroup.includes('25 to 34')) return '25-34';
  if (ageGroup.includes('35 to 44')) return '35-44';
  if (ageGroup.includes('45 to 54')) return '45-54';
  if (ageGroup.includes('55 to 64')) return '55-64';
  if (ageGroup.includes('65')) return '65+';
  return ageGroup;
}

export function AgeBarChart({
  areaCode,
  direction = 'incoming',
  includeInternalFlows = false,
  selectedAgeGroup = 'all',
  onSelectAgeGroup,
}: AgeBarChartProps) {
  const [data, setData] = useState<AgeChartDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugLog(`[AgeBarChart] useEffect areaCode=${areaCode} direction=${direction}`);

    setData([]);
    setError(null);
    setLoading(true);

    async function loadStats() {
      if (!areaCode) {
        debugLog('[AgeBarChart] aguardando selecao de area');
        setLoading(false);
        return;
      }

      debugLog(`[AgeBarChart] carregando stats para ${areaCode} (${direction})`);

      try {
        setLoading(true);
        setError(null);

        const stats = await getAgeStats(areaCode, direction, includeInternalFlows);
        debugLog('[AgeBarChart] stats recebidas', stats);

        if (stats.length === 0) {
          debugWarn('[AgeBarChart] nenhum dado retornado');
          setData([]);
          setLoading(false);
          return;
        }

        const chartData = stats.map((stat) => ({
          name: simplifyAgeLabel(stat.ageGroup),
          fullName: stat.ageGroup as AgeGroup,
          total: stat.total,
          percentage: stat.percentage,
          color: getAgeColor(stat.ageGroup),
        }));

        const ageOrder = ['16-24', '25-34', '35-44', '45-54', '55-64', '65+'];
        chartData.sort((left, right) => ageOrder.indexOf(left.name) - ageOrder.indexOf(right.name));

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
  }, [areaCode, direction, includeInternalFlows]);

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
        <p className="font-semibold">Dados de faixa etaria nao disponiveis</p>
        <p className="text-sm mt-2">Arquivo ODWP04EW_MSOA nao carregado</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">
            Distribuicao por faixa etaria
          </h3>
          <ChartObjectiveHelp objective="Evidenciar a distribuicao etaria dos fluxos para comparar perfis demograficos de mobilidade." />
        </div>
        <p className="text-sm text-gray-600">
          {direction === 'incoming' ? 'Entrada' : 'Saida'} de trabalhadores por faixa etaria
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
              const clickedAge = entry?.fullName as AgeGroup | undefined;
              if (!clickedAge || !onSelectAgeGroup) return;
              onSelectAgeGroup(selectedAgeGroup === clickedAge ? 'all' : clickedAge);
            }}
            cursor="pointer"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                fillOpacity={selectedAgeGroup === 'all' || selectedAgeGroup === entry.fullName ? 1 : 0.25}
                stroke={selectedAgeGroup === entry.fullName ? '#111827' : 'transparent'}
                strokeWidth={selectedAgeGroup === entry.fullName ? 2 : 0}
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
            onClick={() => onSelectAgeGroup?.(selectedAgeGroup === item.fullName ? 'all' : item.fullName)}
            className={`flex items-center gap-2 rounded px-2 py-1 text-left transition ${
              selectedAgeGroup === item.fullName ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'
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
