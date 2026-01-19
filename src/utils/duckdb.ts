/**
 * DuckDB-WASM Client
 * Carrega Parquet direto do GitHub Releases e executa queries SQL no navegador
 */
import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

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
      
      // Determinar origem do arquivo
      const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';

      let parquetUrl: string;
      
      if (isLocalhost) {
        parquetUrl = `${window.location.origin}/data/ODWP01EW_MSOA.parquet`;
        console.log('📁 Modo local - carregando de:', parquetUrl);
      } else {
        parquetUrl = 'https://github.com/GustavoWMSilva/MapGeospatialMobilityData/releases/download/v1.0.0-data/ODWP01EW_MSOA.parquet';
        console.log('🌐 Modo produção - carregando de GitHub Releases');
      }

      // Baixar e registrar arquivo Parquet
      console.log('📥 Baixando Parquet...');
      const response = await fetch(parquetUrl);
      
      if (!response.ok) {
        throw new Error(`Falha ao baixar Parquet: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log(`✅ Parquet baixado: ${(uint8Array.length / 1024 / 1024).toFixed(2)} MB`);

      // Registrar arquivo no DuckDB filesystem
      await db.registerFileBuffer('flows.parquet', uint8Array);
      console.log('✅ Arquivo registrado no DuckDB filesystem');

      // Criar tabela a partir do arquivo registrado
      await conn.query(`
        CREATE TABLE IF NOT EXISTS flows AS 
        SELECT * FROM read_parquet('flows.parquet')
      `);

      const count = await conn.query('SELECT COUNT(*) as total FROM flows');
      const total = count.toArray()[0].total;
      console.log(`✅ DuckDB-WASM inicializado! ${total.toLocaleString()} registros carregados`);
      
      initialized = true;
    } catch (error) {
      console.error('❌ Erro ao inicializar DuckDB:', error);
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

  console.log(`🔍 Carregando ${limit} flows ${direction} para ${areaCode}...`);

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

    console.log(`✅ Carregados ${data.length} flows`);
    return data;
  } catch (error) {
    console.error('❌ Erro ao carregar flows:', error);
    throw error;
  }
}

/**
 * Obter flows LTLA agregados
 */
export async function getLTLAFlows(
  _areaCode: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _direction: 'incoming' | 'outgoing' = 'incoming',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _limit: number = 500
): Promise<FlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  // TODO: Implementar quando tivermos lookup MSOA->LTLA no GitHub
  console.warn('⚠️ LTLA flows ainda não implementado com DuckDB-WASM');
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
    console.error('❌ Erro ao executar query:', error);
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
  console.log('🔒 DuckDB fechado');
}
