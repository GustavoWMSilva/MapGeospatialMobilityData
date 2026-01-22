/**
 * Serviço de dados que escolhe automaticamente a melhor fonte:
 * - Localhost: API Flask
 * - Produção: DuckDB-WASM + GitHub Releases
 */
import { getMSOAFlows } from './duckdb';
import { cacheService } from './cacheService';

interface Coordinates {
  [code: string]: {
    lat: number;
    lon: number;
    name?: string;
  };
}

// Cache de coordenadas
let coordinatesCache: Coordinates | null = null;

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
    // Tentar buscar do cache IndexedDB primeiro
    const cacheKey = 'areas_centroids';
    const cached = await cacheService.get(cacheKey) as Coordinates | null;
    if (cached) {
      coordinatesCache = cached;
      console.log(`Coordenadas carregadas do cache (${Object.keys(cached).length} áreas)`);
      return cached;
    }

    // Se não tiver no cache, fazer fetch
    const response = await fetch('/data/lookup/areas_centroids.csv');
    const text = await response.text();
    const lines = text.split('\n');
    
    const coords: Coordinates = {};
    
    // Pular header
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 4) {
        const code = parts[0].replace(/"/g, '');
        const name = parts[1].replace(/"/g, '');
        const lat = parseFloat(parts[2]);
        const lon = parseFloat(parts[3]);
        
        coords[code] = { lat, lon, name };
      }
    }
    
    // Salvar no cache
    await cacheService.set(cacheKey, coords);
    coordinatesCache = coords;
    console.log(`Carregadas ${Object.keys(coords).length} coordenadas`);
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
  dataSource: 'msoa' | 'ltla' = 'msoa'
): Promise<{ type: string; features: unknown[] }> {
  // Se for LTLA, agregar MSOA dinamicamente
  if (dataSource === 'ltla') {
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
 * Carregar flows da API Flask (desenvolvimento)
 */
async function loadFlowsFromAPI(
  areaCode: string,
  direction: string,
  limit: number
): Promise<{ type: string; features: unknown[] }> {
  try {
    const url = `http://localhost:5000/api/flows/${areaCode}?direction=${direction}&limit=${limit}`;
    console.log(`📡 Carregando da API: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Carregados ${data.features?.length || 0} flows da API`);
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
  try {
    console.log(`🦆 Carregando com DuckDB-WASM...`);
    
    // Carregar coordenadas
    const coords = await loadCoordinates();
    
    // Carregar flows do Parquet
    const flows = await getMSOAFlows(areaCode, direction, limit);
    
    // Converter para GeoJSON
    const features = flows
      .filter(flow => {
        const originCoord = coords[flow.origin_code];
        const destCoord = coords[flow.dest_code];
        return originCoord && destCoord;
      })
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
    
    console.log(`Criados ${features.length} features GeoJSON`);
    
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
 * Carregar e cachear o lookup MSOA→LTLA
 */
let ltlaLookupCache: Map<string, string> | null = null;

async function loadLTLALookup(): Promise<Map<string, string>> {
  if (ltlaLookupCache) {
    return ltlaLookupCache;
  }

  try {
    // Tentar buscar do cache IndexedDB primeiro
    const cacheKey = 'ltla_lookup';
    const cached = await cacheService.get(cacheKey) as Record<string, string> | null;
    if (cached) {
      ltlaLookupCache = new Map(Object.entries(cached));
      console.log(`Lookup MSOA→LTLA carregado do cache (${ltlaLookupCache.size} entradas)`);
      return ltlaLookupCache;
    }

    // Se não tiver no cache, fazer fetch
    const response = await fetch('/data/lookup/ltla_lookup.csv');
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
    console.log(`Carregado lookup MSOA→LTLA: ${lookup.size} entradas`);
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
    // Tentar buscar do cache IndexedDB primeiro
    const cacheKey = 'ltla_centroids';
    const cached = await cacheService.get(cacheKey) as Coordinates | null;
    if (cached) {
      ltlaCoordsCache = cached;
      console.log(`Coordenadas LTLA carregadas do cache (${Object.keys(cached).length} áreas)`);
      return cached;
    }

    // Se não tiver no cache, fazer fetch
    const response = await fetch('/data/lookup/ltla_centroids.csv');
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
    
    // Salvar no cache
    await cacheService.set(cacheKey, coords);
    
    ltlaCoordsCache = coords;
    console.log(`Carregadas ${Object.keys(coords).length} coordenadas LTLA`);
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
  // Verificar cache IndexedDB primeiro
  const cacheKey = `ltla_flows:${ltlaCode}|${direction}|${limit}`;
  const cached = await cacheService.get(cacheKey) as { type: string; features: unknown[] } | null;
  if (cached) {
    console.log(`Flows LTLA carregados do cache para ${ltlaCode}`);
    return cached;
  }

  try {
    console.log(`Agregando MSOA→LTLA para ${ltlaCode}...`);
    
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
    
    console.log(`Encontrados ${msoasInLTLA.length} MSOAs no LTLA ${ltlaCode}`);
    
    if (msoasInLTLA.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }
    
    // Otimização: Uma única query SQL em vez de múltiplas queries
    const { aggregateMSOAToLTLAFlows } = await import('./duckdb');
    const aggregatedFlows = await aggregateMSOAToLTLAFlows(
      msoasInLTLA,
      direction,
      lookup,
      50000
    );
    
    console.log(`Agregações LTLA criadas: ${aggregatedFlows.length}`);
    
    // Converter para GeoJSON
    const features: unknown[] = [];
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
    features.sort((a: any, b: any) => b.properties.count - a.properties.count);
    const limitedFeatures = features.slice(0, limit);
    
    console.log(`Retornando ${limitedFeatures.length} flows LTLA agregados`);
    
    const result = {
      type: 'FeatureCollection',
      features: limitedFeatures,
    };

    // Salvar no cache IndexedDB
    await cacheService.set(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error('Erro ao agregar LTLA:', error);
    throw error;
  }
}
