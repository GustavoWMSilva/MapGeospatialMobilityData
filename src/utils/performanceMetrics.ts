import type { GeographyLevel } from '../types';

export type LatencyScenario = 'api' | 'duckdb' | 'duckdb_cache';
export type CacheState = 'cold' | 'warm' | 'n/a';
export type QueryRunType = 'first' | 'repeat';

export interface LatencySample {
  id: string;
  timestampMs: number;
  latencyMs: number;
  scenario: LatencyScenario;
  cacheState: CacheState;
  areaCode: string;
  dataSource: GeographyLevel;
  direction: 'incoming' | 'outgoing';
  filtersActive: boolean;
  resultCount: number;
  queryKey: string;
  runType: QueryRunType;
  geographySwitchFrom?: GeographyLevel;
}

export interface FlowRenderSample {
  id: string;
  timestampMs: number;
  areaCode: string;
  dataSource: GeographyLevel;
  direction: 'incoming' | 'outgoing';
  filtersActive: boolean;
  minCount: number;
  maxFlows: number;
  availableCount: number;
  renderedCount: number;
  renderedTotal: number;
}

const MAX_SAMPLES = 600;
const samples: LatencySample[] = [];
const renderSamples: FlowRenderSample[] = [];
const listeners = new Set<() => void>();
const STORAGE_KEY = 'latency-benchmark-enabled';
let benchmarkEnabled = false;
const seenQueryKeys = new Set<string>();
let latestQueryContext: Pick<LatencySample, 'areaCode' | 'direction' | 'filtersActive' | 'dataSource'> | null = null;

if (typeof window !== 'undefined') {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  benchmarkEnabled = stored === '1';
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function recordLatencySample(
  sample: Omit<LatencySample, 'id' | 'queryKey' | 'runType' | 'geographySwitchFrom'>
): void {
  if (!benchmarkEnabled) {
    return;
  }

  const queryKey = buildQueryKey(sample);
  const runType: QueryRunType = seenQueryKeys.has(queryKey) ? 'repeat' : 'first';
  seenQueryKeys.add(queryKey);
  const scenario: LatencyScenario =
    sample.scenario === 'duckdb' && runType === 'repeat' ? 'duckdb_cache' : sample.scenario;
  const cacheState: CacheState =
    sample.scenario === 'duckdb' && runType === 'repeat' && sample.cacheState === 'n/a'
      ? 'warm'
      : sample.cacheState;

  const geographySwitchFrom =
    latestQueryContext &&
    latestQueryContext.dataSource !== sample.dataSource
      ? latestQueryContext.dataSource
      : undefined;

  const entry: LatencySample = {
    ...sample,
    scenario,
    cacheState,
    queryKey,
    runType,
    geographySwitchFrom,
    id: `${sample.timestampMs}-${Math.random().toString(36).slice(2, 8)}`,
  };

  samples.push(entry);
  latestQueryContext = {
    areaCode: sample.areaCode,
    direction: sample.direction,
    filtersActive: sample.filtersActive,
    dataSource: sample.dataSource,
  };

  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES);
  }

  notifyListeners();
}

function buildQueryKey(sample: Omit<LatencySample, 'id' | 'queryKey' | 'runType' | 'geographySwitchFrom'>): string {
  return [
    sample.scenario,
    sample.cacheState,
    sample.areaCode,
    sample.dataSource,
    sample.direction,
    sample.filtersActive ? 'filters' : 'nofilters',
  ].join('|');
}

export function recordFlowRenderSample(sample: Omit<FlowRenderSample, 'id' | 'timestampMs'>): void {
  if (!benchmarkEnabled) {
    return;
  }

  const timestampMs = Date.now();
  const entry: FlowRenderSample = {
    ...sample,
    timestampMs,
    id: `${timestampMs}-${Math.random().toString(36).slice(2, 8)}`,
  };

  renderSamples.push(entry);

  if (renderSamples.length > MAX_SAMPLES) {
    renderSamples.splice(0, renderSamples.length - MAX_SAMPLES);
  }

  notifyListeners();
}

export function isLatencyBenchmarkEnabled(): boolean {
  return benchmarkEnabled;
}

export function setLatencyBenchmarkEnabled(enabled: boolean): void {
  benchmarkEnabled = enabled;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  }
  notifyListeners();
}

export function getLatencySamples(): LatencySample[] {
  return [...samples];
}

export function getFlowRenderSamples(): FlowRenderSample[] {
  return [...renderSamples];
}

export function clearLatencySamples(): void {
  samples.length = 0;
  renderSamples.length = 0;
  seenQueryKeys.clear();
  latestQueryContext = null;
  notifyListeners();
}

export function subscribeLatencySamples(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
