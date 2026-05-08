/**
 * DuckDB-WASM Client - Updated with optional datasets
 * Carrega múltiplos Parquets do jsdelivr CDN:
 * - ODWP01EW_MSOA.parquet (flows básicos) - OBRIGATÓRIO
 * - ODWP09EW_MSOA.parquet (social grade) - OPCIONAL
 * - ODWP04EW_MSOA.parquet (age) - OPCIONAL
 */
import * as duckdb from '@duckdb/duckdb-wasm';
import {
  ACTIVE_DATASET_PROFILE,
  getAggregateLookupPath,
  getDemographicFilterValue,
} from '../constants/datasetProfiles';
import type { DemographicDimensionConfig, DemographicDimensionOption, DemographicFilters } from '../types';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
let ltlaLookupTableReady = false;
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

/**
 * Verifica se o arquivo remoto principal está disponível
 */
async function isRemoteDatasetReady(): Promise<boolean> {
  if (!ACTIVE_DATASET_PROFILE.storage.remoteBaseUrl) {
    return false;
  }

  try {
    const url = `${ACTIVE_DATASET_PROFILE.storage.remoteBaseUrl}${ACTIVE_DATASET_PROFILE.baseFlowDataset.fileName}`;
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

function getDimensionFilterCondition(dimension: DemographicDimensionConfig, selectedValue: string): string {
  const safeValue = escapeSqlLiteral(selectedValue);
  const matchMode = dimension.matchMode || 'equals';

  if (matchMode === 'contains') {
    return `${dimension.categoryColumn} LIKE '%${safeValue}%'`;
  }

  return `${dimension.categoryColumn} = '${safeValue}'`;
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
      console.log('?? Inicializando DuckDB-WASM...');

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
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      
      // Instanciar DuckDB
      db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      
      // Conectar
      conn = await db.connect();
      
      // Resolver base dos dados do dataset ativo
      const remoteDatasetReady = await isRemoteDatasetReady();
      const baseUrl = remoteDatasetReady && ACTIVE_DATASET_PROFILE.storage.remoteBaseUrl
        ? ACTIVE_DATASET_PROFILE.storage.remoteBaseUrl
        : ACTIVE_DATASET_PROFILE.storage.localProcessedBasePath;

      console.log(
        remoteDatasetReady
          ? `?? Usando fonte remota do dataset ${ACTIVE_DATASET_PROFILE.label}`
          : `?? Usando fallback local do dataset ${ACTIVE_DATASET_PROFILE.label}`
      );

      // Função auxiliar para carregar dataset
      async function loadDataset(filename: string, tableName: string, optional: boolean = false) {
        const url = baseUrl + filename;
        console.log(`?? Baixando ${filename}...`);
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            if (optional) {
              console.warn(`   ?? ${filename} não disponível (${response.status}) - pulando`);
              return false;
            }
            throw new Error(`Falha ao baixar ${filename}: ${response.status}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          
          console.log(`   ? ${filename}: ${(uint8Array.length / 1024 / 1024).toFixed(1)} MB`);

          await db!.registerFileBuffer(filename, uint8Array);
          await conn!.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} AS 
            SELECT * FROM read_parquet('${filename}')
          `);

          const count = await conn!.query(`SELECT COUNT(*) as total FROM ${tableName}`);
          const total = count.toArray()[0].total;
          console.log(`   ? Tabela ${tableName}: ${total.toLocaleString('pt-BR')} registros`);
          return true;
        } catch (error) {
          if (optional) {
            console.warn(`   ?? Erro ao carregar ${filename} - pulando:`, error);
            return false;
          }
          throw error;
        }
      }

      // Carregar todos os datasets
      console.log('\n?? Carregando datasets...');
      await loadDataset(
        ACTIVE_DATASET_PROFILE.baseFlowDataset.fileName,
        ACTIVE_DATASET_PROFILE.baseFlowDataset.tableName,
        !ACTIVE_DATASET_PROFILE.baseFlowDataset.required
      );

      let loadedCount = 1;
      for (const dimension of ACTIVE_DATASET_PROFILE.demographicDimensions) {
        const loaded = await loadDataset(
          dimension.dataset.fileName,
          dimension.dataset.tableName,
          !dimension.dataset.required
        );
        if (loaded) {
          loadedCount += 1;
        }
      }

      console.log(`\n? DuckDB-WASM inicializado com ${loadedCount} dataset(s)!`);
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
 * Helper: Carregar lookup MSOA ? LTLA
 */
let ltlaLookupCache: Map<string, string> | null = null;

async function loadLTLALookup(): Promise<Map<string, string>> {
  if (ltlaLookupCache) {
    return ltlaLookupCache;
  }

  const response = await fetch(getAggregateLookupPath());
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
  
  debugLog(`  ? Lookup MSOA->LTLA carregado (${ltlaLookupCache.size} entradas)`);
  return ltlaLookupCache;
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
  
  debugLog(`  ? Encontrados ${msoas.length} MSOAs no LTLA ${ltlaCode}`);
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

export interface LTLADirectionalBalanceResult {
  ltla_code: string;
  ltla_name: string;
  incoming_total: number;
  outgoing_total: number;
  balance: number;
}

export interface LTLASocialGradeShareResult {
  ltla_code: string;
  ltla_name: string;
  social_grade_group: 'AB' | 'C1' | 'C2' | 'DE';
  total: number;
  percentage: number;
  ltla_total: number;
}

export interface LTLAAggregatedTotalResult {
  ltla_code: string;
  total: number;
}

export interface LTLAAggregationDiagnosticRow {
  ltla_code: string;
  ltla_name: string;
  mapped_msoa_count: number;
  dynamic_total: number;
}

export interface LTLAAggregationDiagnosticsResult {
  ltlas: LTLAAggregationDiagnosticRow[];
  unmapped_msoa_count: number;
  unmapped_msoa_sample: string[];
  ignored_non_msoa_count: number;
}

export interface LTLATopODFlow {
  origin_ltla_code: string;
  origin_ltla_name: string;
  dest_ltla_code: string;
  dest_ltla_name: string;
  count: number;
}

export interface AggregateDirectionalBalanceResult {
  aggregate_area_code: string;
  aggregate_area_name: string;
  incoming_total: number;
  outgoing_total: number;
  balance: number;
}

export interface AggregateSocialGradeShareResult {
  aggregate_area_code: string;
  aggregate_area_name: string;
  social_grade_group: 'AB' | 'C1' | 'C2' | 'DE';
  total: number;
  percentage: number;
  aggregate_area_total: number;
}

export interface AggregateDimensionShareResult {
  aggregate_area_code: string;
  aggregate_area_name: string;
  category_value: string;
  category_label: string;
  total: number;
  percentage: number;
  aggregate_area_total: number;
}

export interface AggregateAreaAggregatedTotalResult {
  aggregate_area_code: string;
  total: number;
}

export interface AggregateAreaAggregationDiagnosticRow {
  aggregate_area_code: string;
  aggregate_area_name: string;
  mapped_base_area_count: number;
  dynamic_total: number;
}

export interface AggregateAreaAggregationDiagnosticsResult {
  aggregate_areas: AggregateAreaAggregationDiagnosticRow[];
  unmapped_base_area_count: number;
  unmapped_base_area_sample: string[];
  ignored_non_base_area_count: number;
}

export interface AggregateODFlow {
  origin_aggregate_area_code: string;
  origin_aggregate_area_name: string;
  dest_aggregate_area_code: string;
  dest_aggregate_area_name: string;
  count: number;
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeDimensionText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findDimensionOption(
  rawValue: string,
  options: DemographicDimensionOption[]
): DemographicDimensionOption | undefined {
  const normalizedRaw = normalizeDimensionText(rawValue);
  const rawTokens = ` ${normalizedRaw.replace(/[^a-z0-9]+/g, ' ')} `;

  return options.find((option) => {
    const normalizedValue = normalizeDimensionText(option.value);
    const normalizedLabel = normalizeDimensionText(option.label);

    if (normalizedRaw === normalizedValue || normalizedRaw === normalizedLabel) {
      return true;
    }

    if (normalizedLabel.includes(normalizedRaw) || normalizedRaw.includes(normalizedLabel)) {
      return true;
    }

    return normalizedValue.length <= 3 && rawTokens.includes(` ${normalizedValue} `);
  });
}

function getInternalFlowCondition(includeInternalFlows: boolean): string {
  return includeInternalFlows ? '1=1' : 'origin_code <> dest_code';
}

async function tableExists(tableName: string): Promise<boolean> {
  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  try {
    await conn.query(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function ensureLTLALookupTable(): Promise<void> {
  await initDuckDB();

  if (!db || !conn) {
    throw new Error('DuckDB não inicializado');
  }

  if (ltlaLookupTableReady) {
    return;
  }

  if (await tableExists('ltla_lookup')) {
    ltlaLookupTableReady = true;
    return;
  }

  const response = await fetch(getAggregateLookupPath());
  if (!response.ok) {
    throw new Error(`Falha ao carregar ltla_lookup.csv (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileName = 'ltla_lookup.csv';
  await db.registerFileBuffer(fileName, new Uint8Array(arrayBuffer));

  await conn.query(`
    CREATE OR REPLACE TABLE ltla_lookup AS
    SELECT
      TRIM(msoa21cd) AS msoa21cd,
      TRIM(ltla22cd) AS ltla22cd,
      TRIM(ltla22nm) AS ltla22nm
    FROM read_csv_auto('${fileName}', HEADER = TRUE)
    WHERE msoa21cd IS NOT NULL
      AND ltla22cd IS NOT NULL
  `);

  ltlaLookupTableReady = true;
  debugLog('? Tabela ltla_lookup pronta para agregações LTLA');
}

async function resolveAreaWhereClause(
  areaCode: string,
  direction: 'incoming' | 'outgoing'
): Promise<{ whereClause: string }> {
  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';

  const msoas = await getMSOAsInLTLA(areaCode);
  if (msoas.length > 0) {
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
      count: Number(row.count),
    }));

    console.log(`Carregados ${data.length} flows`);
    return data;
  } catch (error) {
    console.error('Erro ao carregar flows:', error);
    throw error;
  }
}

export async function getMSOAFlowsByDemographicFilters(
  areaCode: string,
  filters: DemographicFilters,
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 2000,
  includeInternalFlows: boolean = false
): Promise<FlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  const activeDimensions = ACTIVE_DATASET_PROFILE.demographicDimensions.filter(
    (dimension) => getDemographicFilterValue(filters, dimension.key) !== 'all'
  );

  if (activeDimensions.length === 0) {
    return getMSOAFlows(areaCode, direction, limit);
  }

  const { whereClause } = await resolveAreaWhereClause(areaCode, direction);
  if (whereClause === '1=0') {
    return [];
  }

  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);

  for (const dimension of activeDimensions) {
    if (!(await tableExists(dimension.dataset.tableName))) {
      debugWarn(`Tabela ${dimension.dataset.tableName} não disponível para filtro ${dimension.key}`);
      return [];
    }
  }

  const dimensionCtes = activeDimensions.map((dimension, index) => {
    const selectedValue = getDemographicFilterValue(filters, dimension.key);
    const filterCondition = getDimensionFilterCondition(dimension, selectedValue);

    return `
      dim_${index} AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS dim_count_${index}
        FROM ${dimension.dataset.tableName}
        WHERE ${whereClause}
          AND ${filterCondition}
          AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      )
    `;
  });

  const joins = activeDimensions
    .slice(1)
    .map(
      (_dimension, index) => `
      INNER JOIN dim_${index + 1}
        ON dim_0.origin_code = dim_${index + 1}.origin_code
       AND dim_0.dest_code = dim_${index + 1}.dest_code
    `
    )
    .join('');

  const leastExpression =
    activeDimensions.length === 1
      ? 'dim_0.dim_count_0'
      : `LEAST(${activeDimensions.map((_dimension, index) => `dim_${index}.dim_count_${index}`).join(', ')})`;

  const query = `
    WITH
    ${dimensionCtes.join(',\n')}
    SELECT
      dim_0.origin_code,
      dim_0.dest_code,
      ${leastExpression} AS count
    FROM dim_0
    ${joins}
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  try {
    const result = await conn.query(query);
    return result.toArray().map((row) => ({
      origin_code: String(row.origin_code),
      dest_code: String(row.dest_code),
      count: Number(row.count),
    }));
  } catch (error) {
    console.error('Erro ao carregar flows por filtros demográficos:', error);
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
  includeInternalFlows: boolean = false
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
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);

  console.log(`?? Agregando ${msoaCodes.length} MSOAs para LTLA (SEM LIMIT - métricas precisas)...`);

  try {
    // Query única que pega TODOS os flows dos MSOAs de interesse (sem limit)
    const query = `
      SELECT 
        origin_code,
        dest_code,
        count
      FROM flows
      WHERE ${filterCol} IN (${msoaList})
        AND ${internalFlowCondition}
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
      ltlaAggregation.set(key, (ltlaAggregation.get(key) || 0) + Number(row.count));
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
  limit: number = 2000,
  includeInternalFlows: boolean = false
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
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);

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
      WHERE ${whereClause} AND ${gradeFilter} AND ${internalFlowCondition}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const result = await conn.query(query);
    const data = result.toArray().map((row: any) => ({
      origin_code: row.origin_code,
      dest_code: row.dest_code,
      social_grade_code: row.social_grade_code,
      social_grade: row.social_grade,
      count: Number(row.count),
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
  limit: number = 2000,
  includeInternalFlows: boolean = false
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
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);

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
      WHERE ${whereClause} AND ${ageFilter} AND ${internalFlowCondition}
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    const result = await conn.query(query);
    const data = result.toArray().map((row: any) => ({
      origin_code: row.origin_code,
      dest_code: row.dest_code,
      age_code: row.age_code,
      age_group: row.age_group,
      count: Number(row.count),
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
  direction: 'incoming' | 'outgoing' = 'incoming',
  includeInternalFlows: boolean = false
): Promise<Array<{ grade: string; total: number; percentage: number }>> {
  debugLog(`getSocialGradeStats chamado para: ${areaCode} (${direction})`);
  
  await initDuckDB();
  debugLog('  ? DuckDB inicializado');

  if (!conn) {
    console.error('  ? Conexão DuckDB não disponível');
    throw new Error('DuckDB não inicializado');
  }

  // Verificar se tabela existe
  try {
    await conn.query(`SELECT 1 FROM flows_social_grade LIMIT 1`);
    debugLog('  ? Tabela flows_social_grade existe e esta acessivel');
  } catch (error) {
    debugWarn('Tabela flows_social_grade não disponível:', error);
    return [];
  }

  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';
  
  // Se for LTLA, converter para MSOAs
  let whereClause: string;
  const msoas = await getMSOAsInLTLA(areaCode);
  if (msoas.length > 0) {
    debugLog('  ? Codigo LTLA detectado, buscando MSOAs...');
    const msoaList = msoas.map(m => `'${m}'`).join(',');
    whereClause = `${filterCol} IN (${msoaList})`;
    debugLog(`  ? Consultando ${filterCol} IN (${msoas.length} MSOAs)`);
  } else {
    whereClause = `${filterCol} = '${areaCode}'`;
    debugLog(`  ? Consultando ${filterCol} = '${areaCode}' (MSOA)`);
  }

  try {
    const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);
    const query = `
      WITH totals AS (
        SELECT 
          social_grade,
          SUM(count) as total
        FROM flows_social_grade
        WHERE ${whereClause} AND social_grade != 'Does not apply' AND ${internalFlowCondition}
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

async function buildFilteredBaseFlowsCte(
  filters: DemographicFilters = {},
  includeInternalFlows: boolean = false,
  excludedDimensionKey?: string
): Promise<string> {
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);
  const activeDimensions = ACTIVE_DATASET_PROFILE.demographicDimensions.filter(
    (dimension) =>
      dimension.key !== excludedDimensionKey &&
      getDemographicFilterValue(filters, dimension.key) !== 'all'
  );

  if (activeDimensions.length === 0) {
    return `
      base_flows AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS count
        FROM flows
        WHERE ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      )
    `;
  }

  for (const dimension of activeDimensions) {
    if (!(await tableExists(dimension.dataset.tableName))) {
      debugWarn(`Tabela ${dimension.dataset.tableName} não disponível para filtro ${dimension.key}`);
      return `
        base_flows AS (
          SELECT origin_code, dest_code, 0 AS count
          FROM flows
          WHERE 1=0
        )
      `;
    }
  }

  const dimensionCtes = activeDimensions.map((dimension, index) => {
    const selectedValue = getDemographicFilterValue(filters, dimension.key);
    const filterCondition = getDimensionFilterCondition(dimension, selectedValue);

    return `
      dim_${index} AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS dim_count_${index}
        FROM ${dimension.dataset.tableName}
        WHERE ${filterCondition}
          AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      )
    `;
  });

  const joins = activeDimensions
    .slice(1)
    .map(
      (_dimension, index) => `
      INNER JOIN dim_${index + 1}
        ON dim_0.origin_code = dim_${index + 1}.origin_code
       AND dim_0.dest_code = dim_${index + 1}.dest_code
    `
    )
    .join('\n');

  const countExpression =
    activeDimensions.length === 1
      ? 'dim_0.dim_count_0'
      : `LEAST(${activeDimensions.map((_dimension, index) => `dim_${index}.dim_count_${index}`).join(', ')})`;

  return `
    ${dimensionCtes.join(',\n')},
    base_flows AS (
      SELECT
        dim_0.origin_code,
        dim_0.dest_code,
        ${countExpression} AS count
      FROM dim_0
      ${joins}
    )
  `;
}

/**
 * Obter estatisticas agregadas para qualquer dimensao demografica configurada.
 */
export async function getDemographicDimensionStats(
  areaCode: string,
  dimension: DemographicDimensionConfig,
  direction: 'incoming' | 'outgoing' = 'incoming',
  includeInternalFlows: boolean = false
): Promise<Array<{ value: string; label: string; total: number; percentage: number }>> {
  debugLog(`getDemographicDimensionStats ${dimension.key} para: ${areaCode} (${direction})`);

  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  if (!(await tableExists(dimension.dataset.tableName))) {
    debugWarn(`Tabela ${dimension.dataset.tableName} não disponível para ${dimension.key}`);
    return [];
  }

  const { whereClause } = await resolveAreaWhereClause(areaCode, direction);
  if (whereClause === '1=0') {
    return [];
  }

  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);
  const validOptions = dimension.options.filter((option) => option.value !== 'all');
  const optionConditions =
    validOptions.length > 0
      ? validOptions
          .map((option) => `(${getDimensionFilterCondition(dimension, option.value)})`)
          .join(' OR ')
      : `${dimension.categoryColumn} IS NOT NULL`;

  try {
    const query = `
      WITH totals AS (
        SELECT
          ${dimension.categoryColumn} AS category_value,
          SUM(count) AS total
        FROM ${dimension.dataset.tableName}
        WHERE ${whereClause}
          AND ${internalFlowCondition}
          AND (${optionConditions})
        GROUP BY ${dimension.categoryColumn}
      ),
      grand_total AS (
        SELECT SUM(total) AS gt FROM totals
      )
      SELECT
        category_value,
        total,
        ROUND((total * 100.0) / gt, 2) AS percentage
      FROM totals, grand_total
      ORDER BY total DESC
    `;

    const optionLabelByValue = new Map(validOptions.map((option) => [option.value, option.label]));
    const result = await conn.query(query);

    return result.toArray().map((row: any) => {
      const value = String(row.category_value);
      return {
        value,
        label: optionLabelByValue.get(value) || value,
        total: Number(row.total),
        percentage: Number(row.percentage),
      };
    });
  } catch (error) {
    console.error(`Erro ao calcular estatisticas de ${dimension.key}:`, error);
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
  limit: number = 2000,
  includeInternalFlows: boolean = false
): Promise<CombinedDemographicFlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  try {
    await conn.query(`SELECT 1 FROM flows_social_grade LIMIT 1`);
    await conn.query(`SELECT 1 FROM flows_age LIMIT 1`);
  } catch {
    debugWarn('Tabelas demográficas (social/age) não disponíveis para filtro combinado');
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
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);

  debugLog(`Carregando flows combinados ${direction} para ${areaCode} (grade=${socialGrade}, age=${ageGroup})...`);

  try {
    const query = `
      WITH social AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS social_count
        FROM flows_social_grade
        WHERE ${whereClause} AND ${gradeFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      ),
      age AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS age_count
        FROM flows_age
        WHERE ${whereClause} AND ${ageFilter} AND ${internalFlowCondition}
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
  direction: 'incoming' | 'outgoing' = 'incoming',
  includeInternalFlows: boolean = false
): Promise<Array<{ ageGroup: string; total: number; percentage: number }>> {
  debugLog(`getAgeStats chamado para: ${areaCode} (${direction})`);
  
  await initDuckDB();
  debugLog('  ? DuckDB inicializado');

  if (!conn) {
    console.error('  ? Conexão DuckDB não disponível');
    throw new Error('DuckDB não inicializado');
  }

  // Verificar se tabela existe
  try {
    await conn.query(`SELECT 1 FROM flows_age LIMIT 1`);
    debugLog('  ? Tabela flows_age existe e esta acessivel');
  } catch (error) {
    debugWarn('Tabela flows_age não disponível:', error);
    return [];
  }

  const filterCol = direction === 'incoming' ? 'dest_code' : 'origin_code';
  
  // Se for LTLA, converter para MSOAs
  let whereClause: string;
  const msoas = await getMSOAsInLTLA(areaCode);
  if (msoas.length > 0) {
    debugLog('  ? Codigo LTLA detectado, buscando MSOAs...');
    const msoaList = msoas.map(m => `'${m}'`).join(',');
    whereClause = `${filterCol} IN (${msoaList})`;
    debugLog(`  ? Consultando ${filterCol} IN (${msoas.length} MSOAs)`);
  } else {
    whereClause = `${filterCol} = '${areaCode}'`;
    debugLog(`  ? Consultando ${filterCol} = '${areaCode}' (MSOA)`);
  }

  try {
    const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);
    const query = `
      WITH totals AS (
        SELECT 
          age_group,
          SUM(count) as total
        FROM flows_age
        WHERE ${whereClause} AND ${internalFlowCondition}
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
 * Obter saldo direcional por LTLA (incoming - outgoing)
 */
export async function getLTLADirectionalBalances(
  socialGrade: 'AB' | 'C1' | 'C2' | 'DE' | 'all' = 'all',
  ageGroup: string | 'all' = 'all',
  topN: number = 15,
  includeInternalFlows: boolean = false
): Promise<LTLADirectionalBalanceResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  await ensureLTLALookupTable();

  const safeTopN = Math.max(1, Math.min(topN, 40));
  const safeSocialGrade = escapeSqlLiteral(socialGrade);
  const safeAgeGroup = escapeSqlLiteral(ageGroup);
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);
  const gradeFilter =
    socialGrade === 'all'
      ? "social_grade != 'Does not apply'"
      : `social_grade LIKE '%${safeSocialGrade}%'`;
  const ageFilter = ageGroup === 'all' ? '1=1' : `age_group = '${safeAgeGroup}'`;

  const needsSocial = socialGrade !== 'all';
  const needsAge = ageGroup !== 'all';

  if (needsSocial && !(await tableExists('flows_social_grade'))) {
    debugWarn('Tabela flows_social_grade não disponível para saldo direcional LTLA');
    return [];
  }

  if (needsAge && !(await tableExists('flows_age'))) {
    debugWarn('Tabela flows_age não disponível para saldo direcional LTLA');
    return [];
  }

  let baseFlowsCte = `
    base_flows AS (
      SELECT
        origin_code,
        dest_code,
        SUM(count) AS count
      FROM flows
      WHERE ${internalFlowCondition}
      GROUP BY origin_code, dest_code
    )
  `;

  if (socialGrade !== 'all' && ageGroup === 'all') {
    baseFlowsCte = `
      base_flows AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS count
        FROM flows_social_grade
        WHERE ${gradeFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      )
    `;
  } else if (socialGrade === 'all' && ageGroup !== 'all') {
    baseFlowsCte = `
      base_flows AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS count
        FROM flows_age
        WHERE ${ageFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      )
    `;
  } else if (socialGrade !== 'all' && ageGroup !== 'all') {
    baseFlowsCte = `
      social_filtered AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS social_count
        FROM flows_social_grade
        WHERE ${gradeFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      ),
      age_filtered AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS age_count
        FROM flows_age
        WHERE ${ageFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      ),
      base_flows AS (
        SELECT
          s.origin_code,
          s.dest_code,
          LEAST(s.social_count, a.age_count) AS count
        FROM social_filtered s
        INNER JOIN age_filtered a
          ON s.origin_code = a.origin_code
         AND s.dest_code = a.dest_code
      )
    `;
  }

  const query = `
    WITH
    ${baseFlowsCte},
    ltla_flows AS (
      SELECT
        origin_lookup.ltla22cd AS origin_ltla_code,
        MAX(origin_lookup.ltla22nm) AS origin_ltla_name,
        dest_lookup.ltla22cd AS dest_ltla_code,
        MAX(dest_lookup.ltla22nm) AS dest_ltla_name,
        SUM(base_flows.count) AS flow_count
      FROM base_flows
      INNER JOIN ltla_lookup origin_lookup
        ON base_flows.origin_code = origin_lookup.msoa21cd
      INNER JOIN ltla_lookup dest_lookup
        ON base_flows.dest_code = dest_lookup.msoa21cd
      GROUP BY origin_lookup.ltla22cd, dest_lookup.ltla22cd
    ),
    incoming_totals AS (
      SELECT
        dest_ltla_code AS ltla_code,
        MAX(dest_ltla_name) AS ltla_name,
        SUM(flow_count) AS incoming_total
      FROM ltla_flows
      GROUP BY dest_ltla_code
    ),
    outgoing_totals AS (
      SELECT
        origin_ltla_code AS ltla_code,
        MAX(origin_ltla_name) AS ltla_name,
        SUM(flow_count) AS outgoing_total
      FROM ltla_flows
      GROUP BY origin_ltla_code
    ),
    ltla_balances AS (
      SELECT
        COALESCE(incoming_totals.ltla_code, outgoing_totals.ltla_code) AS ltla_code,
        COALESCE(incoming_totals.ltla_name, outgoing_totals.ltla_name) AS ltla_name,
        COALESCE(incoming_totals.incoming_total, 0) AS incoming_total,
        COALESCE(outgoing_totals.outgoing_total, 0) AS outgoing_total,
        COALESCE(incoming_totals.incoming_total, 0) - COALESCE(outgoing_totals.outgoing_total, 0) AS balance
      FROM incoming_totals
      FULL OUTER JOIN outgoing_totals
        ON incoming_totals.ltla_code = outgoing_totals.ltla_code
    )
    SELECT
      ltla_code,
      ltla_name,
      incoming_total,
      outgoing_total,
      balance
    FROM ltla_balances
    ORDER BY ABS(balance) DESC
    LIMIT ${safeTopN}
  `;

  try {
    const result = await conn.query(query);
    return result.toArray().map((row) => ({
      ltla_code: String(row.ltla_code),
      ltla_name: String(row.ltla_name),
      incoming_total: Number(row.incoming_total),
      outgoing_total: Number(row.outgoing_total),
      balance: Number(row.balance),
    }));
  } catch (error) {
    console.error('Erro ao calcular saldo direcional LTLA:', error);
    throw error;
  }
}

/**
 * Obter composição de Social Grade por LTLA em percentual (100% stacked)
 */
export async function getLTLASocialGradeShares(
  direction: 'incoming' | 'outgoing' = 'incoming',
  topN: number = 12,
  includeInternalFlows: boolean = false
): Promise<LTLASocialGradeShareResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  await ensureLTLALookupTable();

  if (!(await tableExists('flows_social_grade'))) {
    debugWarn('Tabela flows_social_grade não disponível para composição LTLA');
    return [];
  }

  const safeTopN = Math.max(1, Math.min(topN, 30));
  const areaCodeColumn = direction === 'incoming' ? 'dest_code' : 'origin_code';
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);

  const query = `
    WITH mapped_grades AS (
      SELECT
        ${areaCodeColumn} AS msoa_code,
        CASE
          WHEN social_grade LIKE '%AB%' THEN 'AB'
          WHEN social_grade LIKE '%C1%' THEN 'C1'
          WHEN social_grade LIKE '%C2%' THEN 'C2'
          WHEN social_grade LIKE '%DE%' THEN 'DE'
          ELSE NULL
        END AS social_grade_group,
        SUM(count) AS total
      FROM flows_social_grade
      WHERE social_grade != 'Does not apply'
        AND ${internalFlowCondition}
      GROUP BY ${areaCodeColumn}, social_grade_group
    ),
    ltla_grade_totals AS (
      SELECT
        lookup.ltla22cd AS ltla_code,
        MAX(lookup.ltla22nm) AS ltla_name,
        mapped_grades.social_grade_group,
        SUM(mapped_grades.total) AS total
      FROM mapped_grades
      INNER JOIN ltla_lookup lookup
        ON mapped_grades.msoa_code = lookup.msoa21cd
      WHERE mapped_grades.social_grade_group IS NOT NULL
      GROUP BY lookup.ltla22cd, mapped_grades.social_grade_group
    ),
    ltla_totals AS (
      SELECT
        ltla_code,
        MAX(ltla_name) AS ltla_name,
        SUM(total) AS ltla_total
      FROM ltla_grade_totals
      GROUP BY ltla_code
    ),
    top_ltlas AS (
      SELECT
        ltla_code,
        ltla_name,
        ltla_total
      FROM ltla_totals
      ORDER BY ltla_total DESC
      LIMIT ${safeTopN}
    )
    SELECT
      top_ltlas.ltla_code,
      top_ltlas.ltla_name,
      ltla_grade_totals.social_grade_group,
      ltla_grade_totals.total,
      top_ltlas.ltla_total,
      ROUND((ltla_grade_totals.total * 100.0) / NULLIF(top_ltlas.ltla_total, 0), 2) AS percentage
    FROM top_ltlas
    INNER JOIN ltla_grade_totals
      ON top_ltlas.ltla_code = ltla_grade_totals.ltla_code
    ORDER BY
      top_ltlas.ltla_total DESC,
      CASE ltla_grade_totals.social_grade_group
        WHEN 'AB' THEN 1
        WHEN 'C1' THEN 2
        WHEN 'C2' THEN 3
        WHEN 'DE' THEN 4
        ELSE 5
      END
  `;

  try {
    const result = await conn.query(query);
    return result.toArray().map((row) => ({
      ltla_code: String(row.ltla_code),
      ltla_name: String(row.ltla_name),
      social_grade_group: String(row.social_grade_group) as 'AB' | 'C1' | 'C2' | 'DE',
      total: Number(row.total),
      percentage: Number(row.percentage),
      ltla_total: Number(row.ltla_total),
    }));
  } catch (error) {
    console.error('Erro ao calcular composição de Social Grade por LTLA:', error);
    throw error;
  }
}

/**
 * Obter totais por LTLA a partir da agregação dinâmica MSOA->LTLA.
 * Reusa aggregateMSOAToLTLAFlows para validação técnica.
 */
export async function getDynamicLTLATotalsFromMSOAAggregation(
  direction: 'incoming' | 'outgoing' = 'incoming',
  includeInternalFlows: boolean = false
): Promise<LTLAAggregatedTotalResult[]> {
  const lookup = await loadLTLALookup();
  const allMSOAs = Array.from(lookup.keys());

  if (allMSOAs.length === 0) {
    return [];
  }

  const aggregated = await aggregateMSOAToLTLAFlows(
    allMSOAs,
    direction,
    lookup,
    includeInternalFlows
  );

  const totalsByLTLA = new Map<string, number>();

  aggregated.forEach((row) => {
    const targetCode = direction === 'incoming' ? row.destLTLA : row.originLTLA;
    totalsByLTLA.set(targetCode, (totalsByLTLA.get(targetCode) || 0) + row.count);
  });

  return Array.from(totalsByLTLA.entries())
    .map(([ltla_code, total]) => ({ ltla_code, total }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Diagnóstico de cobertura de lookup para validação MSOA->LTLA.
 */
export async function getLTLAAggregationDiagnostics(
  direction: 'incoming' | 'outgoing' = 'incoming',
  includeInternalFlows: boolean = false
): Promise<LTLAAggregationDiagnosticsResult> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  await ensureLTLALookupTable();

  const directionColumn = direction === 'incoming' ? 'dest_code' : 'origin_code';
  const validMsoaPattern = '^[EW]02[0-9]{6}$';
  const rawFlowCondition = includeInternalFlows ? '1=1' : 'f.origin_code <> f.dest_code';

  const [dynamicTotals, lookupRowsResult, unmappedCountResult, unmappedSampleResult, ignoredCountResult] = await Promise.all([
    getDynamicLTLATotalsFromMSOAAggregation(direction, includeInternalFlows),
    conn.query(`
      SELECT
        ltla22cd AS ltla_code,
        MAX(ltla22nm) AS ltla_name,
        COUNT(DISTINCT msoa21cd) AS mapped_msoa_count
      FROM ltla_lookup
      GROUP BY ltla22cd
    `),
    conn.query(`
      SELECT COUNT(DISTINCT f.${directionColumn}) AS unmapped_msoa_count
      FROM flows f
      LEFT JOIN ltla_lookup l
        ON f.${directionColumn} = l.msoa21cd
      WHERE l.msoa21cd IS NULL
        AND regexp_full_match(f.${directionColumn}, '${validMsoaPattern}')
        AND ${rawFlowCondition}
    `),
    conn.query(`
      SELECT DISTINCT f.${directionColumn} AS msoa_code
      FROM flows f
      LEFT JOIN ltla_lookup l
        ON f.${directionColumn} = l.msoa21cd
      WHERE l.msoa21cd IS NULL
        AND regexp_full_match(f.${directionColumn}, '${validMsoaPattern}')
        AND ${rawFlowCondition}
      LIMIT 20
    `),
    conn.query(`
      SELECT COUNT(DISTINCT f.${directionColumn}) AS ignored_non_msoa_count
      FROM flows f
      WHERE NOT regexp_full_match(f.${directionColumn}, '${validMsoaPattern}')
        AND ${rawFlowCondition}
    `),
  ]);

  const dynamicMap = new Map(dynamicTotals.map((row) => [row.ltla_code, row.total]));

  const lookupRows = lookupRowsResult.toArray().map((row) => {
    const record = row as { ltla_code: unknown; ltla_name: unknown; mapped_msoa_count: unknown };
    return {
      ltla_code: String(record.ltla_code ?? ''),
      ltla_name: String(record.ltla_name ?? record.ltla_code ?? ''),
      mapped_msoa_count: Number(record.mapped_msoa_count ?? 0),
    };
  });

  const diagnosticsRows: LTLAAggregationDiagnosticRow[] = lookupRows.map((row) => ({
    ltla_code: row.ltla_code,
    ltla_name: row.ltla_name,
    mapped_msoa_count: row.mapped_msoa_count,
    dynamic_total: Number(dynamicMap.get(row.ltla_code) || 0),
  }));

  const unmappedCountRow = unmappedCountResult.toArray()[0] as { unmapped_msoa_count?: unknown } | undefined;
  const unmappedCount = Number(unmappedCountRow?.unmapped_msoa_count ?? 0);
  const ignoredCountRow = ignoredCountResult.toArray()[0] as { ignored_non_msoa_count?: unknown } | undefined;
  const ignoredNonMsoaCount = Number(ignoredCountRow?.ignored_non_msoa_count ?? 0);
  const unmappedSample = unmappedSampleResult
    .toArray()
    .map((row) => String((row as { msoa_code?: unknown }).msoa_code ?? ''))
    .filter(Boolean);

  return {
    ltlas: diagnosticsRows.sort((a, b) => b.dynamic_total - a.dynamic_total),
    unmapped_msoa_count: unmappedCount,
    unmapped_msoa_sample: unmappedSample,
    ignored_non_msoa_count: ignoredNonMsoaCount,
  };
}

/**
 * OD Heatmap: Top N áreas LTLA (origem x destino) com suporte a filtros demográficos.
 */
export async function getTopLTLAODFlows(
  socialGrade: 'AB' | 'C1' | 'C2' | 'DE' | 'all' = 'all',
  ageGroup: string | 'all' = 'all',
  topN: number = 10,
  includeInternalFlows: boolean = false
): Promise<LTLATopODFlow[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  await ensureLTLALookupTable();

  const safeTopN = Math.max(4, Math.min(topN, 20));
  const safeSocialGrade = escapeSqlLiteral(socialGrade);
  const safeAgeGroup = escapeSqlLiteral(ageGroup);
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);
  const gradeFilter =
    socialGrade === 'all'
      ? "social_grade != 'Does not apply'"
      : `social_grade LIKE '%${safeSocialGrade}%'`;
  const ageFilter = ageGroup === 'all' ? '1=1' : `age_group = '${safeAgeGroup}'`;

  const needsSocial = socialGrade !== 'all';
  const needsAge = ageGroup !== 'all';

  if (needsSocial && !(await tableExists('flows_social_grade'))) {
    debugWarn('Tabela flows_social_grade não disponível para heatmap OD LTLA');
    return [];
  }

  if (needsAge && !(await tableExists('flows_age'))) {
    debugWarn('Tabela flows_age não disponível para heatmap OD LTLA');
    return [];
  }

  let baseFlowsCte = `
    base_flows AS (
      SELECT
        origin_code,
        dest_code,
        SUM(count) AS count
      FROM flows
      WHERE ${internalFlowCondition}
      GROUP BY origin_code, dest_code
    )
  `;

  if (socialGrade !== 'all' && ageGroup === 'all') {
    baseFlowsCte = `
      base_flows AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS count
        FROM flows_social_grade
        WHERE ${gradeFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      )
    `;
  } else if (socialGrade === 'all' && ageGroup !== 'all') {
    baseFlowsCte = `
      base_flows AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS count
        FROM flows_age
        WHERE ${ageFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      )
    `;
  } else if (socialGrade !== 'all' && ageGroup !== 'all') {
    baseFlowsCte = `
      social_filtered AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS social_count
        FROM flows_social_grade
        WHERE ${gradeFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      ),
      age_filtered AS (
        SELECT
          origin_code,
          dest_code,
          SUM(count) AS age_count
        FROM flows_age
        WHERE ${ageFilter} AND ${internalFlowCondition}
        GROUP BY origin_code, dest_code
      ),
      base_flows AS (
        SELECT
          s.origin_code,
          s.dest_code,
          LEAST(s.social_count, a.age_count) AS count
        FROM social_filtered s
        INNER JOIN age_filtered a
          ON s.origin_code = a.origin_code
         AND s.dest_code = a.dest_code
      )
    `;
  }

  const query = `
    WITH
    ${baseFlowsCte},
    ltla_od AS (
      SELECT
        origin_lookup.ltla22cd AS origin_ltla_code,
        MAX(origin_lookup.ltla22nm) AS origin_ltla_name,
        dest_lookup.ltla22cd AS dest_ltla_code,
        MAX(dest_lookup.ltla22nm) AS dest_ltla_name,
        SUM(base_flows.count) AS total_count
      FROM base_flows
      INNER JOIN ltla_lookup origin_lookup
        ON base_flows.origin_code = origin_lookup.msoa21cd
      INNER JOIN ltla_lookup dest_lookup
        ON base_flows.dest_code = dest_lookup.msoa21cd
      GROUP BY origin_lookup.ltla22cd, dest_lookup.ltla22cd
    ),
    area_activity AS (
      SELECT
        ltla_code,
        SUM(volume) AS total_activity
      FROM (
        SELECT origin_ltla_code AS ltla_code, total_count AS volume FROM ltla_od
        UNION ALL
        SELECT dest_ltla_code AS ltla_code, total_count AS volume FROM ltla_od
      ) combined
      GROUP BY ltla_code
    ),
    top_areas AS (
      SELECT ltla_code
      FROM area_activity
      ORDER BY total_activity DESC
      LIMIT ${safeTopN}
    )
    SELECT
      ltla_od.origin_ltla_code,
      ltla_od.origin_ltla_name,
      ltla_od.dest_ltla_code,
      ltla_od.dest_ltla_name,
      ltla_od.total_count AS count
    FROM ltla_od
    INNER JOIN top_areas top_origin
      ON ltla_od.origin_ltla_code = top_origin.ltla_code
    INNER JOIN top_areas top_dest
      ON ltla_od.dest_ltla_code = top_dest.ltla_code
    ORDER BY ltla_od.total_count DESC
  `;

  try {
    const result = await conn.query(query);
    return result.toArray().map((row) => {
      const record = row as {
        origin_ltla_code: unknown;
        origin_ltla_name: unknown;
        dest_ltla_code: unknown;
        dest_ltla_name: unknown;
        count: unknown;
      };
      return {
        origin_ltla_code: String(record.origin_ltla_code ?? ''),
        origin_ltla_name: String(record.origin_ltla_name ?? record.origin_ltla_code ?? ''),
        dest_ltla_code: String(record.dest_ltla_code ?? ''),
        dest_ltla_name: String(record.dest_ltla_name ?? record.dest_ltla_code ?? ''),
        count: Number(record.count ?? 0),
      };
    });
  } catch (error) {
    console.error('Erro ao calcular OD Top N LTLA:', error);
    throw error;
  }
}

export async function getAggregateDirectionalBalances(
  socialGrade: 'AB' | 'C1' | 'C2' | 'DE' | 'all' = 'all',
  ageGroup: string = 'all',
  topN: number = 15,
  includeInternalFlows: boolean = false
): Promise<AggregateDirectionalBalanceResult[]> {
  const results = await getLTLADirectionalBalances(
    socialGrade,
    ageGroup,
    topN,
    includeInternalFlows
  );

  return results.map((row) => ({
    aggregate_area_code: row.ltla_code,
    aggregate_area_name: row.ltla_name,
    incoming_total: row.incoming_total,
    outgoing_total: row.outgoing_total,
    balance: row.balance,
  }));
}

export async function getAggregateSocialGradeShares(
  direction: 'incoming' | 'outgoing' = 'incoming',
  topN: number = 30,
  includeInternalFlows: boolean = false
): Promise<AggregateSocialGradeShareResult[]> {
  const results = await getLTLASocialGradeShares(direction, topN, includeInternalFlows);

  return results.map((row) => ({
    aggregate_area_code: row.ltla_code,
    aggregate_area_name: row.ltla_name,
    social_grade_group: row.social_grade_group,
    total: row.total,
    percentage: row.percentage,
    aggregate_area_total: row.ltla_total,
  }));
}

export async function getAggregateAreaAggregationDiagnostics(
  direction: 'incoming' | 'outgoing' = 'incoming',
  includeInternalFlows: boolean = false
): Promise<AggregateAreaAggregationDiagnosticsResult> {
  const diagnostics = await getLTLAAggregationDiagnostics(direction, includeInternalFlows);

  return {
    aggregate_areas: diagnostics.ltlas.map((row) => ({
      aggregate_area_code: row.ltla_code,
      aggregate_area_name: row.ltla_name,
      mapped_base_area_count: row.mapped_msoa_count,
      dynamic_total: row.dynamic_total,
    })),
    unmapped_base_area_count: diagnostics.unmapped_msoa_count,
    unmapped_base_area_sample: diagnostics.unmapped_msoa_sample,
    ignored_non_base_area_count: diagnostics.ignored_non_msoa_count,
  };
}

export async function getTopAggregateODFlows(
  socialGrade: 'AB' | 'C1' | 'C2' | 'DE' | 'all' = 'all',
  ageGroup: string | 'all' = 'all',
  topN: number = 10,
  includeInternalFlows: boolean = false
): Promise<AggregateODFlow[]> {
  const results = await getTopLTLAODFlows(socialGrade, ageGroup, topN, includeInternalFlows);

  return results.map((row) => ({
    origin_aggregate_area_code: row.origin_ltla_code,
    origin_aggregate_area_name: row.origin_ltla_name,
    dest_aggregate_area_code: row.dest_ltla_code,
    dest_aggregate_area_name: row.dest_ltla_name,
    count: row.count,
  }));
}

export async function getAggregateDirectionalBalancesForFilters(
  filters: DemographicFilters = {},
  topN: number = 15,
  includeInternalFlows: boolean = false
): Promise<AggregateDirectionalBalanceResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  await ensureLTLALookupTable();

  const safeTopN = Math.max(1, Math.min(topN, 40));
  const baseFlowsCte = await buildFilteredBaseFlowsCte(filters, includeInternalFlows);

  const query = `
    WITH
    ${baseFlowsCte},
    aggregate_flows AS (
      SELECT
        origin_lookup.ltla22cd AS origin_aggregate_code,
        MAX(origin_lookup.ltla22nm) AS origin_aggregate_name,
        dest_lookup.ltla22cd AS dest_aggregate_code,
        MAX(dest_lookup.ltla22nm) AS dest_aggregate_name,
        SUM(base_flows.count) AS flow_count
      FROM base_flows
      INNER JOIN ltla_lookup origin_lookup
        ON base_flows.origin_code = origin_lookup.msoa21cd
      INNER JOIN ltla_lookup dest_lookup
        ON base_flows.dest_code = dest_lookup.msoa21cd
      GROUP BY origin_lookup.ltla22cd, dest_lookup.ltla22cd
    ),
    incoming_totals AS (
      SELECT
        dest_aggregate_code AS aggregate_code,
        MAX(dest_aggregate_name) AS aggregate_name,
        SUM(flow_count) AS incoming_total
      FROM aggregate_flows
      GROUP BY dest_aggregate_code
    ),
    outgoing_totals AS (
      SELECT
        origin_aggregate_code AS aggregate_code,
        MAX(origin_aggregate_name) AS aggregate_name,
        SUM(flow_count) AS outgoing_total
      FROM aggregate_flows
      GROUP BY origin_aggregate_code
    ),
    aggregate_balances AS (
      SELECT
        COALESCE(incoming_totals.aggregate_code, outgoing_totals.aggregate_code) AS aggregate_code,
        COALESCE(incoming_totals.aggregate_name, outgoing_totals.aggregate_name) AS aggregate_name,
        COALESCE(incoming_totals.incoming_total, 0) AS incoming_total,
        COALESCE(outgoing_totals.outgoing_total, 0) AS outgoing_total,
        COALESCE(incoming_totals.incoming_total, 0) - COALESCE(outgoing_totals.outgoing_total, 0) AS balance
      FROM incoming_totals
      FULL OUTER JOIN outgoing_totals
        ON incoming_totals.aggregate_code = outgoing_totals.aggregate_code
    )
    SELECT
      aggregate_code,
      aggregate_name,
      incoming_total,
      outgoing_total,
      balance
    FROM aggregate_balances
    ORDER BY ABS(balance) DESC
    LIMIT ${safeTopN}
  `;

  const result = await conn.query(query);
  return result.toArray().map((row) => ({
    aggregate_area_code: String(row.aggregate_code),
    aggregate_area_name: String(row.aggregate_name ?? row.aggregate_code),
    incoming_total: Number(row.incoming_total),
    outgoing_total: Number(row.outgoing_total),
    balance: Number(row.balance),
  }));
}

export async function getTopAggregateODFlowsForFilters(
  filters: DemographicFilters = {},
  topN: number = 10,
  includeInternalFlows: boolean = false
): Promise<AggregateODFlow[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  await ensureLTLALookupTable();

  const safeTopN = Math.max(4, Math.min(topN, 20));
  const baseFlowsCte = await buildFilteredBaseFlowsCte(filters, includeInternalFlows);

  const query = `
    WITH
    ${baseFlowsCte},
    aggregate_od AS (
      SELECT
        origin_lookup.ltla22cd AS origin_aggregate_code,
        MAX(origin_lookup.ltla22nm) AS origin_aggregate_name,
        dest_lookup.ltla22cd AS dest_aggregate_code,
        MAX(dest_lookup.ltla22nm) AS dest_aggregate_name,
        SUM(base_flows.count) AS total_count
      FROM base_flows
      INNER JOIN ltla_lookup origin_lookup
        ON base_flows.origin_code = origin_lookup.msoa21cd
      INNER JOIN ltla_lookup dest_lookup
        ON base_flows.dest_code = dest_lookup.msoa21cd
      GROUP BY origin_lookup.ltla22cd, dest_lookup.ltla22cd
    ),
    area_activity AS (
      SELECT
        aggregate_code,
        SUM(volume) AS total_activity
      FROM (
        SELECT origin_aggregate_code AS aggregate_code, total_count AS volume FROM aggregate_od
        UNION ALL
        SELECT dest_aggregate_code AS aggregate_code, total_count AS volume FROM aggregate_od
      ) combined
      GROUP BY aggregate_code
    ),
    top_areas AS (
      SELECT aggregate_code
      FROM area_activity
      ORDER BY total_activity DESC
      LIMIT ${safeTopN}
    )
    SELECT
      aggregate_od.origin_aggregate_code,
      aggregate_od.origin_aggregate_name,
      aggregate_od.dest_aggregate_code,
      aggregate_od.dest_aggregate_name,
      aggregate_od.total_count AS count
    FROM aggregate_od
    INNER JOIN top_areas top_origin
      ON aggregate_od.origin_aggregate_code = top_origin.aggregate_code
    INNER JOIN top_areas top_dest
      ON aggregate_od.dest_aggregate_code = top_dest.aggregate_code
    ORDER BY aggregate_od.total_count DESC
  `;

  const result = await conn.query(query);
  return result.toArray().map((row) => ({
    origin_aggregate_area_code: String(row.origin_aggregate_code),
    origin_aggregate_area_name: String(row.origin_aggregate_name ?? row.origin_aggregate_code),
    dest_aggregate_area_code: String(row.dest_aggregate_code),
    dest_aggregate_area_name: String(row.dest_aggregate_name ?? row.dest_aggregate_code),
    count: Number(row.count),
  }));
}

export async function getAggregateDimensionShares(
  dimension: DemographicDimensionConfig,
  filters: DemographicFilters = {},
  direction: 'incoming' | 'outgoing' = 'incoming',
  topN: number = 30,
  includeInternalFlows: boolean = false
): Promise<AggregateDimensionShareResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  await ensureLTLALookupTable();

  if (!(await tableExists(dimension.dataset.tableName))) {
    debugWarn(`Tabela ${dimension.dataset.tableName} não disponível para composição agregada`);
    return [];
  }

  const safeTopN = Math.max(1, Math.min(topN, 30));
  const areaCodeColumn = direction === 'incoming' ? 'dest_code' : 'origin_code';
  const internalFlowCondition = getInternalFlowCondition(includeInternalFlows);
  const filteredBaseFlowsCte = await buildFilteredBaseFlowsCte(filters, includeInternalFlows, dimension.key);
  const validOptions = dimension.options.filter((option) => option.value !== 'all');
  const categoryColumnRef = `d.${dimension.categoryColumn}`;
  const getOptionCondition = (value: string, label: string) => {
    const safeValue = escapeSqlLiteral(value);
    const safeLabel = escapeSqlLiteral(label);

    if ((dimension.matchMode || 'equals') === 'contains') {
      return `(${categoryColumnRef} LIKE '%${safeValue}%' OR ${categoryColumnRef} LIKE '%${safeLabel}%')`;
    }

    return `(${categoryColumnRef} = '${safeValue}' OR ${categoryColumnRef} = '${safeLabel}')`;
  };
  const optionConditions =
    validOptions.length > 0
      ? validOptions
          .map((option) => getOptionCondition(option.value, option.label))
          .join(' OR ')
      : `${categoryColumnRef} IS NOT NULL`;

  const query = `
    WITH
    ${filteredBaseFlowsCte},
    dimension_rows AS (
      SELECT
        d.${areaCodeColumn} AS base_area_code,
        d.${dimension.categoryColumn} AS category_value,
        SUM(d.count) AS total
      FROM ${dimension.dataset.tableName} d
      INNER JOIN base_flows
        ON d.origin_code = base_flows.origin_code
       AND d.dest_code = base_flows.dest_code
      WHERE (${optionConditions})
        AND ${internalFlowCondition.replace('origin_code', 'd.origin_code').replace('dest_code', 'd.dest_code')}
      GROUP BY d.${areaCodeColumn}, d.${dimension.categoryColumn}
    ),
    aggregate_category_totals AS (
      SELECT
        lookup.ltla22cd AS aggregate_code,
        MAX(lookup.ltla22nm) AS aggregate_name,
        dimension_rows.category_value,
        SUM(dimension_rows.total) AS total
      FROM dimension_rows
      INNER JOIN ltla_lookup lookup
        ON dimension_rows.base_area_code = lookup.msoa21cd
      GROUP BY lookup.ltla22cd, dimension_rows.category_value
    ),
    aggregate_totals AS (
      SELECT
        aggregate_code,
        MAX(aggregate_name) AS aggregate_name,
        SUM(total) AS aggregate_total
      FROM aggregate_category_totals
      GROUP BY aggregate_code
    ),
    top_areas AS (
      SELECT
        aggregate_code,
        aggregate_name,
        aggregate_total
      FROM aggregate_totals
      ORDER BY aggregate_total DESC
      LIMIT ${safeTopN}
    )
    SELECT
      top_areas.aggregate_code,
      top_areas.aggregate_name,
      aggregate_category_totals.category_value,
      aggregate_category_totals.total,
      top_areas.aggregate_total,
      ROUND((aggregate_category_totals.total * 100.0) / NULLIF(top_areas.aggregate_total, 0), 2) AS percentage
    FROM top_areas
    INNER JOIN aggregate_category_totals
      ON top_areas.aggregate_code = aggregate_category_totals.aggregate_code
    ORDER BY top_areas.aggregate_total DESC, aggregate_category_totals.category_value
  `;

  const labelByValue = new Map(validOptions.map((option) => [option.value, option.label]));
  const result = await conn.query(query);

  return result.toArray().map((row) => {
    const rawValue = String(row.category_value);
    const matchedOption = findDimensionOption(rawValue, validOptions);
    const value = matchedOption?.value || rawValue;
    return {
      aggregate_area_code: String(row.aggregate_code),
      aggregate_area_name: String(row.aggregate_name ?? row.aggregate_code),
      category_value: value,
      category_label: matchedOption?.label || labelByValue.get(value) || rawValue,
      total: Number(row.total),
      percentage: Number(row.percentage),
      aggregate_area_total: Number(row.aggregate_total),
    };
  });
}

/**
 * Obter flows LTLA agregados
 */
export async function getLTLAFlows(
  areaCode: string,
  direction: 'incoming' | 'outgoing' = 'incoming',
  limit: number = 500
): Promise<FlowResult[]> {
  await initDuckDB();

  if (!conn) {
    throw new Error('DuckDB não inicializado');
  }

  // TODO: Implementar quando tivermos lookup MSOA->LTLA no GitHub
  console.warn(`LTLA flows ainda não implementado com DuckDB-WASM (area=${areaCode}, direction=${direction}, limit=${limit})`);
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
  ltlaLookupTableReady = false;
  console.log('DuckDB fechado');
}
