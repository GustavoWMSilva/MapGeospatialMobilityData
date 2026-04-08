import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  clearLatencySamples,
  getLatencySamples,
  isLatencyBenchmarkEnabled,
  setLatencyBenchmarkEnabled,
  subscribeLatencySamples,
  type LatencySample,
  type LatencyScenario,
} from '../../utils/performanceMetrics';
import { ACTIVE_DATASET_PROFILE } from '../../constants/datasetProfiles';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';

interface ScenarioStats {
  scenario: LatencyScenario;
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function computeScenarioStats(samples: LatencySample[], scenario: LatencyScenario, label: string): ScenarioStats | null {
  const values = samples
    .filter((s) => s.scenario === scenario)
    .map((s) => s.latencyMs)
    .sort((a, b) => a - b);

  if (values.length === 0) return null;

  return {
    scenario,
    label,
    min: values[0],
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    max: values[values.length - 1],
    count: values.length,
  };
}

function renderBoxplot(stats: ScenarioStats, globalMax: number) {
  const toPct = (value: number): number => (globalMax > 0 ? (value / globalMax) * 100 : 0);

  return (
    <div key={stats.scenario} className="rounded-lg border border-purple-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-800">{stats.label}</div>
        <div className="text-xs text-gray-500">n={stats.count}</div>
      </div>
      <div className="relative h-8">
        <div className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded bg-gray-300" style={{ left: `${toPct(stats.min)}%`, width: `${Math.max(1, toPct(stats.max) - toPct(stats.min))}%` }} />
        <div className="absolute top-1/2 h-4 -translate-y-1/2 rounded border border-purple-400 bg-purple-100" style={{ left: `${toPct(stats.q1)}%`, width: `${Math.max(2, toPct(stats.q3) - toPct(stats.q1))}%` }} />
        <div className="absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-purple-800" style={{ left: `${toPct(stats.median)}%` }} />
      </div>
      <div className="mt-1 grid grid-cols-5 text-[11px] text-gray-600">
        <span>{stats.min.toFixed(1)}</span>
        <span className="text-center">{stats.q1.toFixed(1)}</span>
        <span className="text-center font-semibold text-purple-800">{stats.median.toFixed(1)}</span>
        <span className="text-center">{stats.q3.toFixed(1)}</span>
        <span className="text-right">{stats.max.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function PerformanceLatencyPanel() {
  const [benchmarkEnabled, setBenchmarkEnabledState] = useState<boolean>(isLatencyBenchmarkEnabled());
  const [samples, setSamples] = useState<LatencySample[]>(getLatencySamples());
  const aggregatePluralLabel = ACTIVE_DATASET_PROFILE.labels.aggregate.plural;

  useEffect(() => {
    const unsubscribe = subscribeLatencySamples(() => {
      setBenchmarkEnabledState(isLatencyBenchmarkEnabled());
      setSamples(getLatencySamples());
    });
    return unsubscribe;
  }, []);

  const scenarioStats = useMemo(() => {
    const stats = [
      computeScenarioStats(samples, 'api', 'API Flask'),
      computeScenarioStats(samples, 'duckdb', 'DuckDB-WASM'),
      computeScenarioStats(samples, 'duckdb_cache', 'DuckDB + Cache'),
    ].filter((item): item is ScenarioStats => item !== null);

    return stats;
  }, [samples]);

  const globalMax = useMemo(
    () => Math.max(1, ...scenarioStats.map((s) => s.max)),
    [scenarioStats]
  );

  const timeSeriesRows = useMemo(() => {
    const warmCold = samples
      .filter((sample) => sample.scenario === 'duckdb_cache')
      .slice(-120);

    return warmCold.map((sample, index) => ({
      idx: index + 1,
      cold: sample.cacheState === 'cold' ? sample.latencyMs : null,
      warm: sample.cacheState === 'warm' ? sample.latencyMs : null,
      latency: sample.latencyMs,
      cacheState: sample.cacheState,
    }));
  }, [samples]);

  return (
    <div className="rounded-xl border border-purple-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800">Performance de Latência</h3>
            <ChartObjectiveHelp objective="Demonstrar ganho arquitetural comparando distribuição de latência por cenário e evolução temporal entre cache cold e warm." />
          </div>
          <p className="text-xs text-gray-600">Boxplot por cenário + série temporal cold/warm cache</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLatencyBenchmarkEnabled(!benchmarkEnabled)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
              benchmarkEnabled
                ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
            }`}
          >
            {benchmarkEnabled ? 'Benchmark ativo' : 'Ativar benchmark'}
          </button>
          <button
            type="button"
            onClick={() => clearLatencySamples()}
            className="rounded-md border border-purple-200 bg-white px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
          >
            Limpar amostras
          </button>
        </div>
      </div>

      {!benchmarkEnabled && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Coleta desativada para evitar impacto no mapa. Ative apenas durante medições de benchmark.
        </div>
      )}

      {samples.length === 0 && (
        <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">
          Sem amostras ainda. Interaja com o mapa (troque área/direção/modo) para coletar latências.
        </div>
      )}

      {benchmarkEnabled && samples.length > 0 && (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Distribuição por cenário (ms)</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {scenarioStats.map((stats) => renderBoxplot(stats, globalMax))}
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              Linha fina = min/max, caixa = Q1-Q3, traço central = mediana.
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Série temporal (DuckDB+Cache: cold vs warm)</h4>
            {timeSeriesRows.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                Ainda nao ha amostras de cache agregado. Selecione {aggregatePluralLabel.toLowerCase()} repetidamente para gerar cold/warm.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timeSeriesRows} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${Number(v).toFixed(0)}`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number | string | Array<number | string> | undefined, name) => [
                      `${Number(value ?? 0).toFixed(2)} ms`,
                      String(name ?? ''),
                    ]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="cold" name="Cold cache" connectNulls={false} stroke="#DC2626" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="warm" name="Warm cache" connectNulls={false} stroke="#059669" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
