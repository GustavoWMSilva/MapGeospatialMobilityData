/**
 * DuckDB-WASM Client - Updated with optional datasets
 * Carrega múltiplos Parquets do jsdelivr CDN:
 * - ODWP01EW_MSOA.parquet (flows básicos) - OBRIGATÓRIO
 * - ODWP09EW_MSOA.parquet (social grade) - OPCIONAL
 * - ODWP04EW_MSOA.parquet (age) - OPCIONAL
 */
import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
const isDevMode = import.meta.env.DEV;

function debugLog(...args: unknown[]) {
  if (isDevMode) {
    console.log(...args);
  }
}

function debugWarn(...args: unknown[]) {
  if (isDevMode) {
    console.warn(...args);
  }
}

// URLs dos datasets
const DATASETS = {
  flows: 'ODWP01EW_MSOA.parquet',
  socialGrade: 'ODWP09EW_MSOA.parquet',
  age: 'ODWP04EW_MSOA.parquet',
};

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
      const jsdelivrReady = await isJsdelivrReady();
      const baseUrl = jsdelivrReady 
        ? 'https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/'
        : '/data/processed/';
      
      console.log(jsdelivrReady ? '📡 jsdelivr CDN disponível!' : '📁 Usando fallback local');

      // Função auxiliar para carregar dataset
      async function loadDataset(filename: string, tableName: string, optional: boolean = false) {
        const url = baseUrl + filename;
        console.log(`📥 Baixando ${filename}...`);
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            if (optional) {
              console.warn(`   ⚠️ ${filename} não disponível (${response.status}) - pulando`);
              return false;
            }
            throw new Error(`Falha ao baixar ${filename}: ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          console.log(`   ✓ ${filename}: ${(uint8Array.length / 1024 / 1024).toFixed(1)} MB`);

          await db!.registerFileBuffer(filename, uint8Array);
          await conn!.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} AS 
            SELECT * FROM read_parquet('${filename}')
          `);

          const count = await conn!.query(`SELECT COUNT(*) as total FROM ${tableName}`);
          const total = count.toArray()[0].total;
          console.log(`   ✓ Tabela ${tableName}: ${total.toLocaleString()} registros`);
          return true;
        } catch (error) {
          if (optional) {
            console.warn(`   ⚠️ Erro ao carregar ${filename} - pulando:`, error);
            return false;
          }
          throw error;
        }
      }

      // Carregar todos os datasets
      console.log('\n🚀 Carregando datasets...');
      await loadDataset(DATASETS.flows, 'flows', false); // Obrigatório
      const hasSocialGrade = await loadDataset(DATASETS.socialGrade, 'flows_social_grade', true); // Opcional
      const hasAge = await loadDataset(DATASETS.age, 'flows_age', true); // Opcional
      
      const loadedCount = 1 + (hasSocialGrade ? 1 : 0) + (hasAge ? 1 : 0);
      console.log(`\n✅ DuckDB-WASM inicializado com ${loadedCount} dataset(s)!`);
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
 * Helper: Carregar lookup MSOA → LTLA
 */
let ltlaLookupCache: Map<string, string> | null = null;

async function loadLTLALookup(): Promise<Map<string, string>> {
  if (ltlaLookupCache) {
    return ltlaLookupCache;
  }

  const response = await fetch('/data/lookup/ltla_lookup.csv');
  const text = await response.text();
  const lines = text.split('\n');
  
  ltlaLookupCache = new Map();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // CSV format: msoa21cd,msoa21nm,ltla22cd,ltla22nm
    const cols = line.split(',');
    const msoaCode = cols[0]?.trim();
    const ltlaCode = cols[2]?.trim(); // LTLA code is in column 3 (index 2)
    if (msoaCode && ltlaCode) {
      ltlaLookupCache.set(msoaCode, ltlaCode);
    }
  }
  
  debugLog(`  ✓ Lookup MSOA→LTLA carregado (${ltlaLookupCache.size} entradas)`);
  return ltlaLookupCache;
}

/**
 * Helper: Detectar se código é LTLA (vs MSOA)
 */
function isLTLACode(code: string): boolean {
  return code.startsWith('E06') || code.startsWith('E07') || 
         code.startsWith('E08') || code.startsWith('E09') ||
         code.startsWith('W06');
}

/**
 * Helper: Obter todos os MSOAs de um LTLA
 */
async function getMSOAsInLTLA(ltlaCode: string): Promise<string[]> {
  const lookup = await loadLTLALookup();
  const msoas: string[] = [];
  
  lookup.forEach((ltla, msoa) => {
    if (ltla === ltlaCode) {
      msoas.push(msoa);
    }
  });
  
  debugLog(`  ✓ Encontrados ${msoas.length} MSOAs no LTLA ${ltlaCode}`);
  return msoas;
}

/**
 * Interfaces de Resultados
 */
interface FlowResult {
  origin_code: string;
  dest_code: string;
  count: number;
}

interface SocialGradeFlowResult extends FlowResult {
  social_grade_code: number;
  social_grade: string;
}

interface AgeFlowResult extends FlowResult {
  age_code: number;
  age_group: string;
}

interface CombinedDemographicFlowResult extends FlowResult {
  social_count: number;
  age_count: number;
}

async function resolveAreaWhereClause(
  areaCode: string,
  direction: 'incoming' | 'outgoing'
): Promise<{ whereClause: string }> {
  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';

  if (isLTLACode(areaCode)) {
    const msoas = await getMSOAsInLTLA(areaCode);
    if (msoas.length === 0) {
      return { whereClause: '1=0' };
    }
    const msoaList = msoas.map(m => `'${m}'`).join(',');
    return { whereClause: `${filterCol} IN (${msoaList})` };
  }

  return { whereClause: `${filterCol} = '${areaCode}'` };
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
  _limit: number = 10000
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

  console.log(`🚀 Agregando ${msoaCodes.length} MSOAs para LTLA (SEM LIMIT - métricas precisas)...`);

  try {
    // Query única que pega TODOS os flows dos MSOAs de interesse (sem limit)
    const query = `
      SELECT 
        origin_code,
        dest_code,
        count
      FROM flows
      WHERE ${filterCol} IN (${msoaList})
      ORDER BY count DESC
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
 * Obter flows MSOA por Social Grade
 */
export async function getMSOAFlowsBySocialGrade(
  areaCode: string,
  socialGrade: 'AB' | 'C1' | 'C2' | 'DE' | 'all' = 'all',
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 2000
): Promise<SocialGradeFlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  // Verificar se tabela existe
  try {
    await conn.query(`SELECT 1 FROM flows_social_grade LIMIT 1`);
  } catch {
    console.warn('Tabela flows_social_grade não disponível');
    return [];
  }

  const gradeFilter = socialGrade === 'all' 
    ? "social_grade != 'Does not apply'"
    : `social_grade LIKE '%${socialGrade}%'`;

  const { whereClause } = await resolveAreaWhereClause(areaCode, direction);
  if (whereClause === '1=0') {
    return [];
  }

  debugLog(`Carregando flows ${direction} para ${areaCode} (grade: ${socialGrade})...`);

  try {
    const query = `
      SELECT 
        origin_code,
        dest_code,
        social_grade_code,
        social_grade,
        count
      FROM flows_social_grade
      WHERE ${whereClause} AND ${gradeFilter}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const result = await conn.query(query);
    const data = result.toArray().map((row: any) => ({
      origin_code: row.origin_code,
      dest_code: row.dest_code,
      social_grade_code: row.social_grade_code,
      social_grade: row.social_grade,
      count: row.count,
    }));

    debugLog(`Carregados ${data.length} flows (social grade)`);
    return data;
  } catch (error) {
    console.error('Erro ao carregar flows por social grade:', error);
    throw error;
  }
}

/**
 * Obter flows MSOA por Age Group
 */
export async function getMSOAFlowsByAge(
  areaCode: string,
  ageGroup: string | 'all' = 'all',
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 2000
): Promise<AgeFlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  // Verificar se tabela existe
  try {
    await conn.query(`SELECT 1 FROM flows_age LIMIT 1`);
  } catch {
    console.warn('Tabela flows_age não disponível');
    return [];
  }

  const ageFilter = ageGroup === 'all' 
    ? "1=1"
    : `age_group = '${ageGroup}'`;

  const { whereClause } = await resolveAreaWhereClause(areaCode, direction);
  if (whereClause === '1=0') {
    return [];
  }

  debugLog(`Carregando flows ${direction} para ${areaCode} (age: ${ageGroup})...`);

  try {
    const query = `
      SELECT 
        origin_code,
        dest_code,
        age_code,
        age_group,
        count
      FROM flows_age
      WHERE ${whereClause} AND ${ageFilter}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const result = await conn.query(query);
    const data = result.toArray().map((row: any) => ({
      origin_code: row.origin_code,
      dest_code: row.dest_code,
      age_code: row.age_code,
      age_group: row.age_group,
      count: row.count,
    }));

    debugLog(`Carregados ${data.length} flows (age)`);
    return data;
  } catch (error) {
    console.error('Erro ao carregar flows por age:', error);
    throw error;
  }
}

/**
 * Obter estatísticas agregadas de Social Grade para uma área
 */
export async function getSocialGradeStats(
  areaCode: string,
  direction: 'incoming' | 'outgoing' = 'incoming'
): Promise<Array<{ grade: string; total: number; percentage: number }>> {
  debugLog(`getSocialGradeStats chamado para: ${areaCode} (${direction})`);
  
  await initDuckDB();
  debugLog('  ✓ DuckDB inicializado');

  if (!conn) {
    console.error('  ❌ Conexão DuckDB não disponível');
    throw new Error('DuckDB não inicializado');
  }

  // Verificar se tabela existe
  try {
    await conn.query(`SELECT 1 FROM flows_social_grade LIMIT 1`);
    debugLog('  ✓ Tabela flows_social_grade existe e esta acessivel');
  } catch (error) {
    debugWarn('Tabela flows_social_grade nao disponivel:', error);
    return [];
  }

  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';
  
  // Se for LTLA, converter para MSOAs
  let whereClause: string;
  if (isLTLACode(areaCode)) {
    debugLog('  → Codigo LTLA detectado, buscando MSOAs...');
    const msoas = await getMSOAsInLTLA(areaCode);
    if (msoas.length === 0) {
      debugWarn(`Nenhum MSOA encontrado para LTLA ${areaCode}`);
      return [];
    }
    const msoaList = msoas.map(m => `'${m}'`).join(',');
    whereClause = `${filterCol} IN (${msoaList})`;
    debugLog(`  → Consultando ${filterCol} IN (${msoas.length} MSOAs)`);
  } else {
    whereClause = `${filterCol} = '${areaCode}'`;
    debugLog(`  → Consultando ${filterCol} = '${areaCode}' (MSOA)`);
  }

  try {
    const query = `
      WITH totals AS (
        SELECT 
          social_grade,
          SUM(count) as total
        FROM flows_social_grade
        WHERE ${whereClause} AND social_grade != 'Does not apply'
        GROUP BY social_grade
      ),
      grand_total AS (
        SELECT SUM(total) as gt FROM totals
      )
      SELECT 
        t.social_grade as grade,
        t.total,
        ROUND((t.total * 100.0) / g.gt, 2) as percentage
      FROM totals t, grand_total g
      ORDER BY t.total DESC
    `;
    
    debugLog(`  query (${direction}):`, query.substring(0, 200) + '...');

    const result = await conn.query(query);
    const stats = result.toArray().map((row: any) => ({
      grade: row.grade,
      total: Number(row.total),  // Convert BigInt to Number
      percentage: Number(row.percentage),
    }));
    debugLog(`Social grade stats retornadas: ${stats.length} categorias`);
    if (stats.length === 0) {
      debugWarn(`Query retornou 0 resultados para ${areaCode}`);
    }
    debugLog('stats', stats);
    return stats;
  } catch (error) {
    console.error('Erro ao calcular estatisticas de social grade:', error);
    throw error;
  }
}

/**
 * Obter flows MSOA por Social Grade + Age Group em uma unica query
 */
export async function getMSOAFlowsBySocialGradeAndAge(
  areaCode: string,
  socialGrade: 'AB' | 'C1' | 'C2' | 'DE' | 'all' = 'all',
  ageGroup: string | 'all' = 'all',
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 2000
): Promise<CombinedDemographicFlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  try {
    await conn.query(`SELECT 1 FROM flows_social_grade LIMIT 1`);
    await conn.query(`SELECT 1 FROM flows_age LIMIT 1`);
  } catch {
    debugWarn('Tabelas demograficas (social/age) nao disponiveis para filtro combinado');
    return [];
  }

  const gradeFilter = socialGrade === 'all'
    ? "social_grade != 'Does not apply'"
    : `social_grade LIKE '%${socialGrade}%'`;
  const ageFilter = ageGroup === 'all'
    ? '1=1'
    : `age_group = '${ageGroup}'`;

  const { whereClause } = await resolveAreaWhereClause(areaCode, direction);
  if (whereClause === '1=0') {
    return [];
  }

  debugLog(`Carregando flows combinados ${direction} para ${areaCode} (grade=${socialGrade}, age=${ageGroup})...`);

  try {
    const query = `
      WITH social AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS social_count
        FROM flows_social_grade
        WHERE ${whereClause} AND ${gradeFilter}
        GROUP BY origin_code, dest_code
      ),
      age AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS age_count
        FROM flows_age
        WHERE ${whereClause} AND ${ageFilter}
        GROUP BY origin_code, dest_code
      )
      SELECT
        s.origin_code,
        s.dest_code,
        LEAST(s.social_count, a.age_count) AS count,
        s.social_count,
        a.age_count
      FROM social s
      INNER JOIN age a
        ON s.origin_code = a.origin_code
       AND s.dest_code = a.dest_code
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const result = await conn.query(query);
    const data = result.toArray().map((row: any) => ({
      origin_code: row.origin_code,
      dest_code: row.dest_code,
      count: Number(row.count),
      social_count: Number(row.social_count),
      age_count: Number(row.age_count),
    }));

    debugLog(`Carregados ${data.length} flows (social+age)`);
    return data;
  } catch (error) {
    console.error('Erro ao carregar flows por social+age:', error);
    throw error;
  }
}

/**
 * Obter estatísticas agregadas de Age para uma área
 */
export async function getAgeStats(
  areaCode: string,
  direction: 'incoming' | 'outgoing' = 'incoming'
): Promise<Array<{ ageGroup: string; total: number; percentage: number }>> {
  debugLog(`getAgeStats chamado para: ${areaCode} (${direction})`);
  
  await initDuckDB();
  debugLog('  ✓ DuckDB inicializado');

  if (!conn) {
    console.error('  ❌ Conexão DuckDB não disponível');
    throw new Error('DuckDB não inicializado');
  }

  // Verificar se tabela existe
  try {
    await conn.query(`SELECT 1 FROM flows_age LIMIT 1`);
    debugLog('  ✓ Tabela flows_age existe e esta acessivel');
  } catch (error) {
    debugWarn('Tabela flows_age nao disponivel:', error);
    return [];
  }

  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';
  
  // Se for LTLA, converter para MSOAs
  let whereClause: string;
  if (isLTLACode(areaCode)) {
    debugLog('  → Codigo LTLA detectado, buscando MSOAs...');
    const msoas = await getMSOAsInLTLA(areaCode);
    if (msoas.length === 0) {
      debugWarn(`Nenhum MSOA encontrado para LTLA ${areaCode}`);
      return [];
    }
    const msoaList = msoas.map(m => `'${m}'`).join(',');
    whereClause = `${filterCol} IN (${msoaList})`;
    debugLog(`  → Consultando ${filterCol} IN (${msoas.length} MSOAs)`);
  } else {
    whereClause = `${filterCol} = '${areaCode}'`;
    debugLog(`  → Consultando ${filterCol} = '${areaCode}' (MSOA)`);
  }

  try {
    const query = `
      WITH totals AS (
        SELECT 
          age_group,
          SUM(count) as total
        FROM flows_age
        WHERE ${whereClause}
        GROUP BY age_group
      ),
      grand_total AS (
        SELECT SUM(total) as gt FROM totals
      )
      SELECT 
        t.age_group as ageGroup,
        t.total,
        ROUND((t.total * 100.0) / g.gt, 2) as percentage
      FROM totals t, grand_total g
      ORDER BY t.total DESC
    `;
    
    debugLog(`  query (${direction}):`, query.substring(0, 200) + '...');

    const result = await conn.query(query);
    const stats = result.toArray().map((row: any) => ({
      ageGroup: row.ageGroup,
      total: Number(row.total),  // Convert BigInt to Number
      percentage: Number(row.percentage),
    }));
    debugLog(`Age stats retornadas: ${stats.length} grupos`);
    if (stats.length === 0) {
      debugWarn(`Query retornou 0 resultados para ${areaCode}`);
    }
    debugLog('stats', stats);
    return stats;
  } catch (error) {
    console.error('Erro ao calcular estatisticas de age:', error);
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
