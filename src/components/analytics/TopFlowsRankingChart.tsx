import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { loadFlowsFiltered } from '../../utils/dataService';
import type { DemographicFilters, GeographyLevel } from '../../types';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface TopFlowsRankingChartProps {
  areaCode: string;
  geographyLevel: GeographyLevel;
  direction?: 'incoming' | 'outgoing';
  demographicFilters?: DemographicFilters;
  includeInternalFlows?: boolean;
  topN?: number;
}

interface FlowFeatureProperties {
  origin_code: string;
  origin_name?: string;
  dest_code: string;
  dest_name?: string;
  count: number;
}

interface FlowFeature {
  properties: FlowFeatureProperties;
}

interface RankingDatum {
  routeLabel: string;
  fullRouteLabel: string;
  counterpartLabel: string;
  count: number;
}

const BAR_COLORS = MAP_COLORS.analytics.topFlowsBar;

function isFlowFeature(value: unknown): value is FlowFeature {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { properties?: Partial<FlowFeatureProperties> };
  if (!candidate.properties || typeof candidate.properties !== 'object') return false;

  return (
    typeof candidate.properties.origin_code === 'string' &&
    typeof candidate.properties.dest_code === 'string' &&
    typeof candidate.properties.count === 'number'
  );
}

function getRouteLabel(properties: FlowFeatureProperties): string {
  const origin = properties.origin_name || properties.origin_code;
  const destination = properties.dest_name || properties.dest_code;
  return `${origin} -> ${destination}`;
}

function getCounterpartLabel(properties: FlowFeatureProperties, direction: 'incoming' | 'outgoing'): string {
  return direction === 'incoming'
    ? (properties.origin_name || properties.origin_code)
    : (properties.dest_name || properties.dest_code);
}

function shortenRouteLabel(label: string, maxLength = 30): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}…`;
}

function renderSingleLineLabel(props: any) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const height = Number(props.height ?? 0);

  return (
    <text
      x={x + 6}
      y={y + height / 2}
      fill="#111827"
      fontSize={10}
      fontWeight={600}
      dominantBaseline="middle"
      textAnchor="start"
      style={{ whiteSpace: 'nowrap', pointerEvents: 'none' }}
    >
      {String(props.value ?? '')}
    </text>
  );
}

export function TopFlowsRankingChart({
  areaCode,
  geographyLevel,
  direction = 'incoming',
  demographicFilters = {},
  includeInternalFlows = false,
  topN = 10,
}: TopFlowsRankingChartProps) {
  const [rows, setRows] = useState<RankingDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRanking() {
      setLoading(true);
      setError(null);

      try {
        const result = await loadFlowsFiltered(
          areaCode,
          direction,
          50000,
          geographyLevel,
          demographicFilters
        );

        const features = result.features.filter(isFlowFeature);
        const directional = features.filter((feature) =>
          direction === 'incoming'
            ? feature.properties.dest_code === areaCode
            : feature.properties.origin_code === areaCode
        );
        const withoutInternal = includeInternalFlows
          ? directional
          : directional.filter((feature) => feature.properties.origin_code !== feature.properties.dest_code);

        const ranking = withoutInternal
          .map((feature) => ({
            fullRouteLabel: getRouteLabel(feature.properties),
            counterpartLabel: getCounterpartLabel(feature.properties, direction),
            routeLabel: shortenRouteLabel(getCounterpartLabel(feature.properties, direction)),
            count: feature.properties.count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, topN);

        if (!cancelled) {
          setRows(ranking);
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

    void loadRanking();

    return () => {
      cancelled = true;
    };
  }, [areaCode, geographyLevel, direction, demographicFilters, includeInternalFlows, topN]);

  const chartHeight = useMemo(() => Math.max(240, rows.length * 26 + 58), [rows.length]);

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
        <p className="font-semibold">Nenhum fluxo encontrado para os filtros atuais</p>
        <p className="text-sm mt-2">Altere direção ou filtros demográficos para comparar os principais fluxos</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-500">
            {direction === 'incoming' ? 'Principais origens' : 'Principais destinos'} por volume, com filtros ativos
          </p>
          <ChartObjectiveHelp objective="Mostrar os 10 maiores fluxos e como os filtros demográficos alteram o ranking entre origem e destino." />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 0, left: 0, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
          <XAxis
            type="number"
            tickFormatter={(value) => Number(value).toLocaleString('pt-BR')}
            tick={{ fill: '#64748B', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#CBD5E1' }}
            label={{
              value: 'Pessoas',
              position: 'insideBottom',
              offset: -18,
              fill: '#475569',
              fontSize: 12,
              fontWeight: 600,
            }}
          />
          <YAxis
            type="category"
            dataKey="routeLabel"
            width={0}
            interval={0}
            tick={false}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined) => [
              Number(value ?? 0).toLocaleString('pt-BR'),
              'Pessoas',
            ]}
            labelFormatter={(_label, payload) => {
              const row = payload && payload.length > 0 ? payload[0]?.payload as RankingDatum | undefined : undefined;
              return row?.fullRouteLabel || '';
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
            <LabelList
              dataKey="routeLabel"
              content={renderSingleLineLabel}
            />
            {rows.map((entry, index) => (
              <Cell key={`${entry.fullRouteLabel}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
