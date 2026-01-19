/**
 * Serviço de dados que escolhe automaticamente a melhor fonte:
 * - Localhost: API Flask
 * - Produção: DuckDB-WASM + GitHub Releases
 */
import { getMSOAFlows } from './duckdb';

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
    
    coordinatesCache = coords;
    console.log(`✅ Carregadas ${Object.keys(coords).length} coordenadas`);
    return coords;
  } catch (error) {
    console.error('❌ Erro ao carregar coordenadas:', error);
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
  // Se for LTLA, usar GeoJSON estático (por enquanto)
  if (dataSource === 'ltla') {
    return loadLTLAFlowsStatic();
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
    console.log(`✅ Carregados ${data.features?.length || 0} flows da API`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao carregar da API:', error);
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
    
    console.log(`✅ Criados ${features.length} features GeoJSON`);
    
    return {
      type: 'FeatureCollection',
      features,
    };
  } catch (error) {
    console.error('❌ Erro ao carregar com DuckDB:', error);
    throw error;
  }
}

/**
 * Carregar flows LTLA do GeoJSON estático
 */
async function loadLTLAFlowsStatic(): Promise<{ type: string; features: unknown[] }> {
  try {
    console.log(`📄 Carregando LTLA do GeoJSON estático...`);
    const response = await fetch('/ltla_flows_complete.geojson');
    const data = await response.json();
    console.log(`✅ Carregado GeoJSON com ${data.features?.length || 0} flows`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao carregar LTLA:', error);
    throw error;
  }
}
