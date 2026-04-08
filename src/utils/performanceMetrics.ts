import type { GeographyLevel } from '../types';

export type LatencyScenario = 'api' | 'duckdb' | 'duckdb_cache';
export type CacheState = 'cold' | 'warm' | 'n/a';

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
}

const MAX_SAMPLES = 600;
const samples: LatencySample[] = [];
const listeners = new Set<() => void>();
const STORAGE_KEY = 'latency-benchmark-enabled';
let benchmarkEnabled = false;

if (typeof window !== 'undefined') {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  benchmarkEnabled = stored === '1';
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function recordLatencySample(sample: Omit<LatencySample, 'id'>): void {
  if (!benchmarkEnabled) {
    return;
  }

  const entry: LatencySample = {
    ...sample,
    id: `${sample.timestampMs}-${Math.random().toString(36).slice(2, 8)}`,
  };

  samples.push(entry);

  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES);
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

export function clearLatencySamples(): void {
  samples.length = 0;
  notifyListeners();
}

export function subscribeLatencySamples(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
