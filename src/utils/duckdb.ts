/**
 * DuckDB-WASM Client
 * Carrega Parquet direto do jsdelivr CDN e executa queries SQL no navegador
 */
import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Verifica se o arquivo está disponível no jsdelivr
 */
async function isJsdelivrReady(): Promise<boolean> {
  try {
    const url = 'https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/ODWP01EW_MSOA.parquet';
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Inicializa DuckDB-WASM (apenas uma vez)
 */
export async function initDuckDB(): Promise<void> {
  // Se já inicializado, retornar
  if (initialized && db && conn) {
    return;
  }

  // Se está inicializando, aguardar
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      console.log('🚀 Inicializando DuckDB-WASM...');

      // Buscar bundles do CDN
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      
      // Selecionar bundle apropriado
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
      
      // Criar worker
      const worker_url = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], {
          type: 'text/javascript',
        })
      );
      const worker = new Worker(worker_url);
      
      // Logger
      const logger = new duckdb.ConsoleLogger();
      
      // Instanciar DuckDB
      db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      
      // Conectar
      conn = await db.connect();
      
      // Verificar se jsdelivr está disponível
      let parquetUrl: string;
      const jsdelivrReady = await isJsdelivrReady();
      
      if (jsdelivrReady) {
        parquetUrl = 'https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/ODWP01EW_MSOA.parquet';
        console.log('jsdelivr CDN disponível!');
      } else {
        parquetUrl = '/data/ODWP01EW_MSOA.parquet';
        console.log('jsdelivr ainda não disponível, usando fallback local');
      }

      // Baixar e registrar arquivo Parquet
      console.log('📥 Baixando Parquet de:', parquetUrl);
      const response = await fetch(parquetUrl);
      
      if (!response.ok) {
        throw new Error(`Falha ao baixar Parquet: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log(`Parquet baixado: ${(uint8Array.length / 1024 / 1024).toFixed(2)} MB`);

      // Registrar arquivo no DuckDB filesystem
      await db.registerFileBuffer('flows.parquet', uint8Array);
      console.log('Arquivo registrado no DuckDB filesystem');

      // Criar tabela a partir do arquivo registrado
      await conn.query(`
        CREATE TABLE IF NOT EXISTS flows AS 
        SELECT * FROM read_parquet('flows.parquet')
      `);

      const count = await conn.query('SELECT COUNT(*) as total FROM flows');
      const total = count.toArray()[0].total;
      console.log(`DuckDB-WASM inicializado! ${total.toLocaleString()} registros carregados`);
      
      initialized = true;
    } catch (error) {
      console.error('Erro ao inicializar DuckDB:', error);
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Obter flows MSOA para uma área específica
 */
interface FlowResult {
  origin_code: string;
  dest_code: string;
  count: number;
}

export async function getMSOAFlows(
  areaCode: string,
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 2000
): Promise<FlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';

  console.log(`Carregando ${limit} flows ${direction} para ${areaCode}...`);

  try {
    // Query SQL na tabela já carregada em memória
    const query = `
      SELECT 
        origin_code,
        dest_code,
        count
      FROM flows
      WHERE ${filterCol} = '${areaCode}'
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const result = await conn.query(query);
    const data = result.toArray().map((row) => ({
      origin_code: row.origin_code,
      dest_code: row.dest_code,
      count: row.count,
    }));

    console.log(`Carregados ${data.length} flows`);
    return data;
  } catch (error) {
    console.error('Erro ao carregar flows:', error);
    throw error;
  }
}

/**
 * Agregar flows de MSOA para LTLA usando lookup (UMA ÚNICA QUERY OTIMIZADA)
 */
export async function aggregateMSOAToLTLAFlows(
  msoaCodes: string[],
  direction: 'incoming' | 'outgoing',
  lookupMap: Map<string, string>, // MSOA -> LTLA
  limit: number = 10000
): Promise<{ originLTLA: string; destLTLA: string; count: number }[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  if (msoaCodes.length === 0) {
    return [];
  }

  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';
  const msoaList = msoaCodes.map(code => `'${code}'`).join(',');

  console.log(`🚀 Agregando ${msoaCodes.length} MSOAs para LTLA com query única...`);

  try {
    // Query única que pega todos os flows dos MSOAs de interesse
    const query = `
      SELECT 
        origin_code,
        dest_code,
        count
      FROM flows
      WHERE ${filterCol} IN (${msoaList})
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const result = await conn.query(query);
    const flows = result.toArray();

    console.log(`Query retornou ${flows.length} flows MSOA`);

    // Agregar por LTLA em memória (rápido)
    const ltlaAggregation = new Map<string, number>();

    flows.forEach((row: any) => {
      const originLTLA = lookupMap.get(row.origin_code);
      const destLTLA = lookupMap.get(row.dest_code);

      if (!originLTLA || !destLTLA) return;

      const key = `${originLTLA}|${destLTLA}`;
      ltlaAggregation.set(key, (ltlaAggregation.get(key) || 0) + row.count);
    });

    // Converter para array e ordenar
    const aggregated = Array.from(ltlaAggregation.entries())
      .map(([key, count]) => {
        const [originLTLA, destLTLA] = key.split('|');
        return { originLTLA, destLTLA, count };
      })
      .sort((a, b) => b.count - a.count);

    console.log(`Agregados ${aggregated.length} flows LTLA únicos`);

    return aggregated;
  } catch (error) {
    console.error('Erro ao agregar flows:', error);
    throw error;
  }
}

/**
 * Obter flows LTLA agregados
 */
export async function getLTLAFlows(
  _areaCode: string,
  _direction: 'incoming' | 'outgoing' = 'incoming',
  _limit: number = 500
): Promise<FlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  // TODO: Implementar quando tivermos lookup MSOA->LTLA no GitHub
  console.warn('LTLA flows ainda não implementado com DuckDB-WASM');
  return [];
}

/**
 * Executar query SQL customizada
 */
export async function executeQuery(query: string): Promise<unknown[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  try {
    const result = await conn.query(query);
    return result.toArray();
  } catch (error) {
    console.error('Erro ao executar query:', error);
    throw error;
  }
}

/**
 * Fechar conexão (cleanup)
 */
export async function closeDuckDB(): Promise<void> {
  if (conn) {
    await conn.close();
    conn = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
  initialized = false;
  initPromise = null;
  console.log('DuckDB fechado');
}
