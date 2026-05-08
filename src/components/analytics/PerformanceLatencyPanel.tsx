import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
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
import { ChartObjectiveHelp } from './ChartObjectiveHelp';

interface ScenarioStats {
  scenario: LatencyScenario;
  label: string;
  color: string;
  background: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  count: number;
}

const SCENARIO_META: Record<LatencyScenario, { label: string; color: string; background: string }> = {
  api: {
    label: 'API Flask',
    color: '#2563EB',
    background: 'bg-blue-500',
  },
  duckdb: {
    label: 'DuckDB-WASM',
    color: '#0F766E',
    background: 'bg-teal-600',
  },
  duckdb_cache: {
    label: 'DuckDB + cache',
    color: '#7C3AED',
    background: 'bg-violet-600',
  },
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1] ?? sorted[base];
  return sorted[base] + rest * (next - sorted[base]);
}

function formatMs(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })}s`;
  }

  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  })}ms`;
}

function computeScenarioStats(samples: LatencySample[], scenario: LatencyScenario): ScenarioStats | null {
  const values = samples
    .filter((sample) => sample.scenario === scenario)
    .map((sample) => sample.latencyMs)
    .sort((left, right) => left - right);

  if (values.length === 0) return null;
  const meta = SCENARIO_META[scenario];

  return {
    scenario,
    label: meta.label,
    color: meta.color,
    background: meta.background,
    min: values[0],
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    max: values[values.length - 1],
    count: values.length,
  };
}

function renderScenarioRow(stats: ScenarioStats, globalMax: number) {
  const medianPct = globalMax > 0 ? Math.max(3, (stats.median / globalMax) * 100) : 0;

  return (
    <div key={stats.scenario} className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-800">{stats.label}</div>
          <div className="text-[10px] text-slate-500">{stats.count} amostras</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-slate-900">{formatMs(stats.median)}</div>
          <div className="text-[10px] text-slate-500">mediana</div>
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${stats.background}`} style={{ width: `${medianPct}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-slate-500">
        <span>min {formatMs(stats.min)}</span>
        <span className="text-center">Q1-Q3 {formatMs(stats.q1)}-{formatMs(stats.q3)}</span>
        <span className="text-right">max {formatMs(stats.max)}</span>
      </div>
    </div>
  );
}

export function PerformanceLatencyPanel() {
  const [benchmarkEnabled, setBenchmarkEnabledState] = useState<boolean>(isLatencyBenchmarkEnabled());
  const [samples, setSamples] = useState<LatencySample[]>(getLatencySamples());

  useEffect(() => {
    const unsubscribe = subscribeLatencySamples(() => {
      setBenchmarkEnabledState(isLatencyBenchmarkEnabled());
      setSamples(getLatencySamples());
    });
    return unsubscribe;
  }, []);

  const scenarioStats = useMemo(() => {
    const stats = [
      computeScenarioStats(samples, 'api'),
      computeScenarioStats(samples, 'duckdb'),
      computeScenarioStats(samples, 'duckdb_cache'),
    ].filter((item): item is ScenarioStats => item !== null);

    return stats;
  }, [samples]);

  const globalMax = useMemo(
    () => Math.max(1, ...scenarioStats.map((scenario) => scenario.max)),
    [scenarioStats]
  );

  const summaryStats = useMemo(() => {
    if (samples.length === 0) return null;

    const values = samples.map((sample) => sample.latencyMs).sort((left, right) => left - right);
    const latest = samples[samples.length - 1];

    return {
      count: samples.length,
      best: values[0],
      median: quantile(values, 0.5),
      latest,
    };
  }, [samples]);

  const timeSeriesRows = useMemo(() => {
    return samples.slice(-80).map((sample, index) => ({
      idx: index + 1,
      latency: sample.latencyMs,
      scenario: SCENARIO_META[sample.scenario].label,
      cacheState: sample.cacheState,
      resultCount: sample.resultCount,
    }));
  }, [samples]);

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-col gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-slate-500">Resumo das consultas coletadas durante o benchmark.</p>
            <ChartObjectiveHelp objective="Acompanhar o tempo de resposta das consultas e identificar qual caminho de dados esta mais rapido nas interacoes recentes." />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLatencyBenchmarkEnabled(!benchmarkEnabled)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
              benchmarkEnabled
                ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {benchmarkEnabled ? 'Benchmark ativo' : 'Ativar benchmark'}
          </button>
          <button
            type="button"
            onClick={() => clearLatencySamples()}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Limpar amostras
          </button>
        </div>
      </div>

      {!benchmarkEnabled && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          Coleta pausada. Ative o benchmark e navegue pelo mapa para medir novas consultas.
        </div>
      )}

      {benchmarkEnabled && samples.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
          Nenhuma medicao ainda. Selecione areas, troque direcao ou altere filtros para gerar as primeiras amostras.
        </div>
      )}

      {benchmarkEnabled && samples.length > 0 && (
        <div className="space-y-3">
          {summaryStats && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mediana</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{formatMs(summaryStats.median)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ultima</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{formatMs(summaryStats.latest.latencyMs)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Melhor</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{formatMs(summaryStats.best)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Amostras</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{summaryStats.count}</div>
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-xs font-bold text-slate-700">Comparacao por caminho</h4>
            <div className="space-y-2">
              {scenarioStats.map((stats) => renderScenarioRow(stats, globalMax))}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-bold text-slate-700">Ultimas medicoes</h4>
            {timeSeriesRows.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Ainda nao ha amostras suficientes para montar a serie.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={timeSeriesRows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(value: number) => `${Number(value).toFixed(0)}`} tick={{ fontSize: 10, fill: '#64748B' }} width={34} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number | string | Array<number | string> | undefined) => [
                      formatMs(Number(value ?? 0)),
                      'Latencia',
                    ]}
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as
                        | {
                            scenario?: string;
                            cacheState?: string;
                            resultCount?: number;
                          }
                        | undefined;
                      if (!row) return '';
                      const cacheLabel = row.cacheState && row.cacheState !== 'n/a'
                        ? `, cache ${row.cacheState}`
                        : '';
                      return `${row.scenario ?? 'Consulta'}${cacheLabel}, ${row.resultCount ?? 0} linhas`;
                    }}
                  />
                  <Line type="monotone" dataKey="latency" name="Latencia" stroke="#2563EB" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
