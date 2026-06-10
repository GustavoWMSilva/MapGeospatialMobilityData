/**
 * Serviço de dados que escolhe automaticamente a melhor fonte:
 * - Localhost: API Flask
 * - Produção: DuckDB-WASM + GitHub Releases
 */
import { getMSOAFlows, getMSOAFlowsByDemographicFilters } from './duckdb';
import {
  ACTIVE_DATASET_PROFILE,
  getAggregateCentroidsPath,
  getAggregateLookupPath,
  getBaseCentroidsPath,
  hasActiveDemographicFilters,
} from '../constants/datasetProfiles';
import { cacheService } from './cacheService';
import { recordLatencySample } from './performanceMetrics';
import type { DemographicFilters, FlowResult, GeographyLevel } from '../types';

interface Coordinates {
  [code: string]: {
    lat: number;
    lon: number;
    name?: string;
  };
}

// Cache de coordenadas
let coordinatesCache: Coordinates | null = null;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function recordLatency(params: {
  startMs: number;
  scenario: 'api' | 'duckdb' | 'duckdb_cache';
  cacheState: 'cold' | 'warm' | 'n/a';
  areaCode: string;
  geographyLevel: GeographyLevel;
  direction: 'incoming' | 'outgoing';
  filtersActive: boolean;
  resultCount: number;
}): void {
  const latencyMs = nowMs() - params.startMs;

  recordLatencySample({
    timestampMs: Date.now(),
    latencyMs,
    scenario: params.scenario,
    cacheState: params.cacheState,
    areaCode: params.areaCode,
    dataSource: params.geographyLevel,
    direction: params.direction,
    filtersActive: params.filtersActive,
    resultCount: params.resultCount,
  });
}

/**
 * Detectar se estamos em desenvolvimento
 */
function isDevelopment(): boolean {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Carregar coordenadas do CSV
 */
async function loadCoordinates(): Promise<Coordinates> {
  if (coordinatesCache) {
    return coordinatesCache;
  }

  try {
    // Centroides são pequenos e precisam ficar sincronizados com os pontos visíveis no mapa.
    // Evita usar IndexedDB aqui para não desenhar linhas com coordenadas antigas após regenerar datasets.
    const response = await fetch(getBaseCentroidsPath());
    const text = await response.text();
    const lines = text.split('\n');

    const coords: Coordinates = {};

    // Pular header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = parseCSVLine(line);
      if (parts.length >= 4) {
        const code = parts[0].replace(/"/g, '');
        const name = parts[1].replace(/"/g, '');
        const lat = parseFloat(parts[2]);
        const lon = parseFloat(parts[3]);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }

        coords[code] = { lat, lon, name };
      }
    }

    coordinatesCache = coords;
    return coords;
  } catch (error) {
    console.error('Erro ao carregar coordenadas:', error);
    throw error;
  }
}

/**
 * Carregar flows de uma área (escolhe fonte automaticamente)
 */
export async function loadFlows(
  areaCode: string,
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 2000,
  geographyLevel: GeographyLevel = 'base'
): Promise<{ type: string; features: unknown[] }> {
  if (geographyLevel === 'aggregate') {
    return loadLTLAFlowsAggregated(areaCode, direction, limit);
  }

  // MSOA: escolher fonte baseado no ambiente
  if (isDevelopment()) {
    return loadFlowsFromAPI(areaCode, direction, limit);
  } else {
    return loadFlowsFromDuckDB(areaCode, direction, limit);
  }
}

/**
 * Carregar flows com filtros demográficos aplicados
 */
export async function loadFlowsFiltered(
  areaCode: string,
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 2000,
  geographyLevel: GeographyLevel = 'base',
  filters: DemographicFilters = {}
): Promise<{ type: string; features: unknown[] }> {
  const requestStartMs = nowMs();

  // Se nenhum filtro está ativo, usar função normal
  if (!hasActiveDemographicFilters(filters, ACTIVE_DATASET_PROFILE.demographicDimensions)) {
    return loadFlows(areaCode, direction, limit, geographyLevel);
  }

  const flows: FlowResult[] = await getMSOAFlowsByDemographicFilters(areaCode, filters, direction, limit);

  if (geographyLevel === 'aggregate') {
    
    const lookup = await loadLTLALookup();
    const ltlaCoords = await loadLTLACoordinates();

    // Agregar flows por LTLA origin e dest
    const aggregation = new Map<string, number>();
    
    flows.forEach(flow => {
      const originLTLA = lookup.get(flow.origin_code);
      const destLTLA = lookup.get(flow.dest_code);
      
      if (!originLTLA || !destLTLA) return;
      
      const key = `${originLTLA}|${destLTLA}`;
      const currentCount = aggregation.get(key) || 0;
      aggregation.set(key, currentCount + flow.count);
    });

    // Converter agregação para features GeoJSON
    const features = Array.from(aggregation.entries())
      .map(([key, count]) => {
        const [originLTLA, destLTLA] = key.split('|');
        const originCoord = ltlaCoords[originLTLA];
        const destCoord = ltlaCoords[destLTLA];
        
        if (!originCoord || !destCoord) return null;
        
        return {
          type: 'Feature',
          properties: {
            origin_code: originLTLA,
            origin_name: originCoord.name || originLTLA,
            dest_code: destLTLA,
            dest_name: destCoord.name || destLTLA,
            count: count,
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [originCoord.lon, originCoord.lat],
              [destCoord.lon, destCoord.lat],
            ],
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .sort((a, b) => b.properties.count - a.properties.count)
      .slice(0, limit);

    recordLatency({
      startMs: requestStartMs,
      scenario: 'duckdb',
      cacheState: 'n/a',
      areaCode,
      geographyLevel,
      direction,
      filtersActive: true,
      resultCount: features.length,
    });
    
    return {
      type: 'FeatureCollection',
      features,
    };
  }

  // Se o nível for base, usar coordenadas da unidade base normalmente
  const coords = await loadCoordinates();

  const missingCoordinateSamples: Array<{ origin: string; dest: string; count: number }> = [];
  const validFlows = flows.filter(flow => {
    const originCoord = coords[flow.origin_code];
    const destCoord = coords[flow.dest_code];

    if (!originCoord || !destCoord) {
      if (missingCoordinateSamples.length < 5) {
        missingCoordinateSamples.push({
          origin: flow.origin_code,
          dest: flow.dest_code,
          count: flow.count,
        });
      }
      return false;
    }

    return true;
  });

  const features = validFlows
    .map(flow => {
      const originCoord = coords[flow.origin_code];
      const destCoord = coords[flow.dest_code];
      
      return {
        type: 'Feature',
        properties: {
          origin_code: flow.origin_code,
          origin_name: originCoord.name,
          dest_code: flow.dest_code,
          dest_name: destCoord.name,
          count: flow.count,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [originCoord.lon, originCoord.lat],
            [destCoord.lon, destCoord.lat],
          ],
        },
        };
      });
  if (missingCoordinateSamples.length > 0) {
    console.warn('[dataService] Exemplos de flows descartados (filtros):', missingCoordinateSamples);
  }

  recordLatency({
    startMs: requestStartMs,
    scenario: 'duckdb',
    cacheState: 'n/a',
    areaCode,
    geographyLevel,
    direction,
    filtersActive: true,
    resultCount: features.length,
  });
  
  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Carregar flows da API Flask (desenvolvimento)
 */
async function loadFlowsFromAPI(
  areaCode: string,
  direction: string,
  limit: number
): Promise<{ type: string; features: unknown[] }> {
  const requestStartMs = nowMs();

  try {
    const url = `http://localhost:5000/api/flows/${areaCode}?direction=${direction}&limit=${limit}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();

    recordLatency({
      startMs: requestStartMs,
      scenario: 'api',
      cacheState: 'n/a',
      areaCode,
      geographyLevel: 'base',
      direction: direction as 'incoming' | 'outgoing',
      filtersActive: false,
      resultCount: Array.isArray(data.features) ? data.features.length : 0,
    });

    return data;
  } catch (error) {
    console.error('Erro ao carregar da API:', error);
    // Fallback para DuckDB se API falhar
    return loadFlowsFromDuckDB(areaCode, direction as 'incoming' | 'outgoing', limit);
  }
}

/**
 * Carregar flows com DuckDB-WASM (produção)
 */
async function loadFlowsFromDuckDB(
  areaCode: string,
  direction: 'incoming' | 'outgoing',
  limit: number
): Promise<{ type: string; features: unknown[] }> {
  const requestStartMs = nowMs();

  try {
    
    // Carregar coordenadas
    const coords = await loadCoordinates();
    
    // Carregar flows do Parquet
    const flows = await getMSOAFlows(areaCode, direction, limit);

    const missingCoordinateSamples: Array<{ origin: string; dest: string; count: number }> = [];
    const validFlows = flows.filter(flow => {
      const originCoord = coords[flow.origin_code];
      const destCoord = coords[flow.dest_code];

      if (!originCoord || !destCoord) {
        if (missingCoordinateSamples.length < 5) {
          missingCoordinateSamples.push({
            origin: flow.origin_code,
            dest: flow.dest_code,
            count: flow.count,
          });
        }
        return false;
      }

      return true;
    });

    // Converter para GeoJSON
    const features = validFlows
      .map(flow => {
        const originCoord = coords[flow.origin_code];
        const destCoord = coords[flow.dest_code];
        
        return {
          type: 'Feature',
          properties: {
            origin_code: flow.origin_code,
            origin_name: originCoord.name,
            dest_code: flow.dest_code,
            dest_name: destCoord.name,
            count: flow.count,
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [originCoord.lon, originCoord.lat],
              [destCoord.lon, destCoord.lat],
            ],
          },
        };
      });

    if (missingCoordinateSamples.length > 0) {
      console.warn('[dataService] Exemplos de flows descartados (base):', missingCoordinateSamples);
    }

    recordLatency({
      startMs: requestStartMs,
      scenario: 'duckdb',
      cacheState: 'n/a',
      areaCode,
      geographyLevel: 'base',
      direction,
      filtersActive: false,
      resultCount: features.length,
    });
    
    return {
      type: 'FeatureCollection',
      features
    };
  } catch (error) {
    console.error('Erro ao carregar com DuckDB:', error);
    throw error;
  }
}

/**
 * Carregar e cachear o lookup MSOA->LTLA
 */
let ltlaLookupCache: Map<string, string> | null = null;

async function loadLTLALookup(): Promise<Map<string, string>> {
  if (ltlaLookupCache) {
    return ltlaLookupCache;
  }

  try {
    // Tentar buscar do cache IndexedDB primeiro
    const cacheKey = `aggregate_lookup:${ACTIVE_DATASET_PROFILE.id}`;
    const cached = await cacheService.get(cacheKey) as Record<string, string> | null;
    if (cached) {
      ltlaLookupCache = new Map(Object.entries(cached));
      return ltlaLookupCache;
    }

    // Se não tiver no cache, fazer fetch
    const response = await fetch(getAggregateLookupPath());
    const text = await response.text();
    const lines = text.split('\n');
    
    const lookup = new Map<string, string>();
    
    // Pular header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 3) {
        const msoaCode = parts[0].replace(/"/g, '');
        const ltlaCode = parts[2].replace(/"/g, '');
        lookup.set(msoaCode, ltlaCode);
      }
    }
    
    // Salvar no cache (converter Map para objeto)
    const lookupObj = Object.fromEntries(lookup);
    await cacheService.set(cacheKey, lookupObj);
    
    ltlaLookupCache = lookup;
    return lookup;
  } catch (error) {
    console.error('Erro ao carregar LTLA lookup:', error);
    throw error;
  }
}

/**
 * Carregar coordenadas LTLA
 */
let ltlaCoordsCache: Coordinates | null = null;

async function loadLTLACoordinates(): Promise<Coordinates> {
  if (ltlaCoordsCache) {
    return ltlaCoordsCache;
  }

  try {
    // Centroides agregados também são pequenos; buscar do CSV mantém linhas e pontos alinhados.
    const response = await fetch(getAggregateCentroidsPath());
    const text = await response.text();
    const lines = text.split('\n');
    
    const coords: Coordinates = {};
    
    // Função para fazer parse correto de CSV com campos quoted
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let insideQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    // Pular header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = parseCSVLine(line);
      if (parts.length >= 4) {
        const code = parts[0].replace(/"/g, '');
        const name = parts[1].replace(/"/g, '');
        const lat = parseFloat(parts[2]);
        const lon = parseFloat(parts[3]);
        
        coords[code] = { lat, lon, name };
      }
    }
    
    ltlaCoordsCache = coords;
    return coords;
  } catch (error) {
    console.error('Erro ao carregar coordenadas LTLA:', error);
    throw error;
  }
}

/**
 * Carregar flows LTLA agregando MSOA dinamicamente
 */
async function loadLTLAFlowsAggregated(
  ltlaCode: string,
  direction: 'incoming' | 'outgoing',
  limit: number
): Promise<{ type: string; features: unknown[] }> {
  const requestStartMs = nowMs();

  try {
    
    // Carregar lookup e coordenadas em paralelo
    const [lookup, ltlaCoords] = await Promise.all([
      loadLTLALookup(),
      loadLTLACoordinates()
    ]);
    
    // Encontrar todos os MSOAs que pertencem a este LTLA
    const msoasInLTLA: string[] = [];
    lookup.forEach((ltla, msoa) => {
      if (ltla === ltlaCode) {
        msoasInLTLA.push(msoa);
      }
    });
    
    if (msoasInLTLA.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    // Otimização: Uma única query SQL em vez de múltiplas queries
    const { aggregateMSOAToLTLAFlows } = await import('./duckdb');
    const aggregatedFlows = await aggregateMSOAToLTLAFlows(
      msoasInLTLA,
      direction,
      lookup
    );
    
    // Converter para GeoJSON
    interface FlowFeature {
      type: 'Feature';
      properties: {
        origin_code: string;
        origin_name: string;
        dest_code: string;
        dest_name: string;
        count: number;
      };
      geometry: {
        type: 'LineString';
        coordinates: number[][];
      };
    }
    
    const features: FlowFeature[] = [];
    aggregatedFlows.forEach(({ originLTLA, destLTLA, count }) => {
      
      const originCoord = ltlaCoords[originLTLA];
      const destCoord = ltlaCoords[destLTLA];
      
      if (!originCoord || !destCoord) return;
      
      features.push({
        type: 'Feature',
        properties: {
          origin_code: originLTLA,
          origin_name: originCoord.name || originLTLA,
          dest_code: destLTLA,
          dest_name: destCoord.name || destLTLA,
          count: count,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [originCoord.lon, originCoord.lat],
            [destCoord.lon, destCoord.lat],
          ],
        },
      });
    });
    
    // Ordenar por contagem e limitar
    features.sort((a, b) => b.properties.count - a.properties.count);
    const limitedFeatures = features.slice(0, limit);
    
    const result = {
      type: 'FeatureCollection',
      features: limitedFeatures,
    };

    recordLatency({
      startMs: requestStartMs,
      scenario: 'duckdb',
      cacheState: 'n/a',
      areaCode: ltlaCode,
      geographyLevel: 'aggregate',
      direction,
      filtersActive: false,
      resultCount: limitedFeatures.length,
    });
    
    return result;
  } catch (error) {
    console.error('Erro ao agregar LTLA:', error);
    throw error;
  }
}
