import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

function shortenRouteLabel(label: string, maxLength = 44): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}…`;
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
            routeLabel: shortenRouteLabel(getRouteLabel(feature.properties)),
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

  const chartHeight = useMemo(() => Math.max(300, rows.length * 32 + 80), [rows.length]);

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
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">Top 10 Fluxos</h3>
          <ChartObjectiveHelp objective="Mostrar os 10 maiores fluxos e como os filtros demográficos alteram o ranking entre origem e destino." />
        </div>
        <p className="text-xs text-gray-600">
          Ranking por volume ({direction === 'incoming' ? 'incoming' : 'outgoing'}) com filtros ativos
        </p>
      </div>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 28, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="routeLabel"
            width={210}
            interval={0}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined) => [
              Number(value ?? 0).toLocaleString(),
              'Commuters',
            ]}
            labelFormatter={(_label, payload) => {
              const row = payload && payload.length > 0 ? payload[0]?.payload as RankingDatum | undefined : undefined;
              return row?.fullRouteLabel || '';
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {rows.map((entry, index) => (
              <Cell key={`${entry.fullRouteLabel}-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
