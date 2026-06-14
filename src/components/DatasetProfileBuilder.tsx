import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Copy, Database, Download, Link, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  buildDatasetSwitchUrl,
  persistActiveDataset,
  saveLocalDatasetProfile,
  type DatasetProfileSource,
} from '../constants/datasetProfiles';
import type { DatasetChartId } from '../types';
import { ChartObjectiveHelp } from './analytics/ChartObjectiveHelp';
import {
  publishDatasetProfileToBlob,
  type DatasetBlobFileKey,
  type DatasetBlobPublishFiles,
  type DatasetBlobPublishProgress,
} from '../utils/vercelBlobDatasetPublisher';

type LinkCheckStatus = 'checking' | 'ok' | 'error';
type LinkCheckSource = 'remote' | 'local';

interface LinkCheckResult {
  status: LinkCheckStatus;
  source?: LinkCheckSource;
  checkedUrl?: string;
}

interface LinkCheckTarget {
  key: string;
  label: string;
  url: string;
  source?: LinkCheckSource;
  fallbackUrl?: string;
  fallbackSource?: LinkCheckSource;
}

interface DatasetProfileBuilderProps {
  onClose: () => void;
}

interface DimensionDraft {
  key: string;
  label: string;
  categoryColumn: string;
  fileName: string;
  tableName: string;
  optionsText: string;
}

interface FormState {
  id: string;
  label: string;
  description: string;
  sortOrder: string;
  baseSingular: string;
  basePlural: string;
  aggregateSingular: string;
  aggregatePlural: string;
  longitude: string;
  latitude: string;
  zoom: string;
  remoteBaseUrl: string;
  localProcessedBasePath: string;
  baseFlowFileName: string;
  baseCentroidsPath: string;
  baseBoundariesPath: string;
  aggregateCentroidsPath: string;
  aggregateLookupPath: string;
  aggregateBoundariesPath: string;
  enableTopFlows: boolean;
  enableOdHeatmap: boolean;
  enableDirectionalBalance: boolean;
  dimensions: DimensionDraft[];
}

type FieldErrors = Partial<Record<keyof FormState, string>>;
type PublishedFileHelpKey =
  | 'remoteBaseUrl'
  | 'localProcessedBasePath'
  | 'baseCentroidsPath'
  | 'baseBoundariesPath'
  | 'aggregateCentroidsPath'
  | 'aggregateLookupPath'
  | 'aggregateBoundariesPath';
type BlobPublishStatus = 'idle' | 'publishing' | 'published' | 'failed';

// Keep JSON publishing available, but hide large file uploads until that flow is needed again.
const ENABLE_VERCEL_BLOB_JSON_PUBLISHING = true;
const ENABLE_VERCEL_BLOB_FILE_PUBLISHING = false;

const initialForm: FormState = {
  id: 'meu_dataset',
  label: 'Meu dataset',
  description: 'Fluxos origem-destino preparados para visualizacao geoespacial.',
  sortOrder: '40',
  baseSingular: 'Unidade Base',
  basePlural: 'Unidades Base',
  aggregateSingular: 'Unidade Agregada',
  aggregatePlural: 'Unidades Agregadas',
  longitude: '0',
  latitude: '0',
  zoom: '8',
  remoteBaseUrl: 'https://cdn.jsdelivr.net/gh/usuario/repositorio@main/public/data/meu_dataset/processed/',
  localProcessedBasePath: '/data/meu_dataset/processed/',
  baseFlowFileName: 'flows.parquet',
  baseCentroidsPath: '/data/meu_dataset/lookup/areas_centroids.csv',
  baseBoundariesPath: '/data/meu_dataset/lookup/boundaries.geojson',
  aggregateCentroidsPath: '/data/meu_dataset/lookup/aggregate_centroids.csv',
  aggregateLookupPath: '/data/meu_dataset/lookup/aggregate_lookup.csv',
  aggregateBoundariesPath: '/data/meu_dataset/lookup/aggregate_boundaries.geojson',
  enableTopFlows: true,
  enableOdHeatmap: true,
  enableDirectionalBalance: true,
  dimensions: [],
};

const chartOrder: DatasetChartId[] = [
  'topFlows',
  'odHeatmap',
  'directionalBalance',
  'performance',
  'socialPie',
  'ageBar',
  'socialMultiples',
  'aggregateStacked',
  'aggregationScatter',
];

const publishedFileHints: Record<PublishedFileHelpKey, { title: string; description: string }> = {
  remoteBaseUrl: {
    title: 'Pasta remota processed',
    description: 'Pasta publica dos Parquets. Deve terminar com /.',
  },
  localProcessedBasePath: {
    title: 'Fallback local processed',
    description: 'Pasta em public/data usada se o remoto falhar.',
  },
  baseCentroidsPath: {
    title: 'Centroides base CSV',
    description: 'CSV com code, name, lat, lon da unidade base.',
  },
  baseBoundariesPath: {
    title: 'Fronteiras base GeoJSON',
    description: 'GeoJSON dos poligonos da unidade base.',
  },
  aggregateCentroidsPath: {
    title: 'Centroides agregados CSV',
    description: 'CSV com code, name, lat, lon da area agregada.',
  },
  aggregateLookupPath: {
    title: 'Lookup agregado CSV',
    description: 'Liga base -> agregado. Ordem: codigo/nome base, codigo/nome agregado.',
  },
  aggregateBoundariesPath: {
    title: 'Fronteiras agregadas GeoJSON',
    description: 'GeoJSON dos poligonos das areas agregadas.',
  },
};

const publishedFilesJsonExample = `{
  "lookup": {
    "baseCentroidsPath": "/data/meu_dataset/lookup/areas_centroids.csv",
    "baseBoundariesPath": "/data/meu_dataset/lookup/boundaries.geojson",
    "aggregateCentroidsPath": "/data/meu_dataset/lookup/aggregate_centroids.csv",
    "aggregateLookupPath": "/data/meu_dataset/lookup/aggregate_lookup.csv",
    "aggregateBoundariesPath": "/data/meu_dataset/lookup/aggregate_boundaries.geojson"
  },
  "storage": {
    "remoteBaseUrl": "https://cdn.jsdelivr.net/gh/usuario/repositorio@main/public/data/meu_dataset/processed/",
    "localProcessedBasePath": "/data/meu_dataset/processed/"
  }
}`;

function ensureTrailingSlash(value: string): string {
  const trimmed = cleanPastedPath(value);
  return trimmed && !trimmed.endsWith('/') ? `${trimmed}/` : trimmed;
}

function cleanPastedPath(value: string): string {
  return value
    .trim()
    .replace(/^['"`]+/, '')
    .replace(/['"`]+$/, '')
    .trim();
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isValidNumberText(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value));
}

function getInputClass(hasError: boolean, extraClasses = 'text-sm'): string {
  const stateClasses = hasError
    ? 'border-red-400 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-100'
    : 'border-slate-200 focus:border-slate-400 focus:ring-slate-100';

  return `w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${stateClasses} ${extraClasses}`;
}

function parseDimensionOptions(optionsText: string) {
  return optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...labelParts] = line.split('=');
      const cleanValue = value.trim();
      const label = labelParts.join('=').trim() || cleanValue;
      return { value: cleanValue, label };
    })
    .filter((option) => option.value);
}

function isPathLike(value: string): boolean {
  const cleanedValue = cleanPastedPath(value);
  return cleanedValue.startsWith('/') || cleanedValue.startsWith('http://') || cleanedValue.startsWith('https://');
}

function slugifyDatasetId(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getNumberString(value: unknown, fallback: string): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  return isRecord(value) ? value : {};
}

function dimensionOptionsToText(value: unknown): string {
  if (!Array.isArray(value)) {
    return '';
  }

  return value
    .filter(isRecord)
    .map((option) => {
      const optionValue = getString(option.value);
      const optionLabel = getString(option.label, optionValue);
      return optionValue ? `${optionValue}=${optionLabel}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function buildFormFromProfile(profile: unknown, currentForm: FormState): FormState {
  if (!isRecord(profile)) {
    throw new Error('O JSON precisa ser um objeto de perfil de dataset.');
  }

  const geography = getNestedRecord(profile, 'geography');
  const labels = getNestedRecord(profile, 'labels');
  const baseLabels = getNestedRecord(labels, 'base');
  const aggregateLabels = getNestedRecord(labels, 'aggregate');
  const mapView = getNestedRecord(profile, 'mapView');
  const lookup = getNestedRecord(profile, 'lookup');
  const storage = getNestedRecord(profile, 'storage');
  const baseFlowDataset = getNestedRecord(profile, 'baseFlowDataset');
  const dashboard = getNestedRecord(profile, 'dashboard');
  const charts = getNestedRecord(dashboard, 'charts');
  const topFlows = getNestedRecord(charts, 'topFlows');
  const odHeatmap = getNestedRecord(charts, 'odHeatmap');
  const directionalBalance = getNestedRecord(charts, 'directionalBalance');
  const dimensions = Array.isArray(profile.demographicDimensions)
    ? profile.demographicDimensions.filter(isRecord)
    : [];

  const nextId = getString(profile.id, currentForm.id);
  const fallbackProcessedPath = nextId ? `/data/${nextId}/processed/` : currentForm.localProcessedBasePath;

  return {
    ...currentForm,
    id: nextId,
    label: getString(profile.label, currentForm.label),
    description: getString(profile.description, currentForm.description),
    sortOrder: getNumberString(profile.sortOrder, currentForm.sortOrder),
    baseSingular: getString(baseLabels.singular, getString(geography.base, currentForm.baseSingular)),
    basePlural: getString(baseLabels.plural, currentForm.basePlural),
    aggregateSingular: getString(aggregateLabels.singular, getString(geography.aggregate, currentForm.aggregateSingular)),
    aggregatePlural: getString(aggregateLabels.plural, currentForm.aggregatePlural),
    longitude: getNumberString(mapView.longitude, currentForm.longitude),
    latitude: getNumberString(mapView.latitude, currentForm.latitude),
    zoom: getNumberString(mapView.zoom, currentForm.zoom),
    remoteBaseUrl: getString(storage.remoteBaseUrl, currentForm.remoteBaseUrl),
    localProcessedBasePath: getString(storage.localProcessedBasePath, fallbackProcessedPath),
    baseFlowFileName: getString(baseFlowDataset.fileName, currentForm.baseFlowFileName),
    baseCentroidsPath: getString(lookup.baseCentroidsPath, currentForm.baseCentroidsPath),
    baseBoundariesPath: getString(lookup.baseBoundariesPath, currentForm.baseBoundariesPath),
    aggregateCentroidsPath: getString(lookup.aggregateCentroidsPath, currentForm.aggregateCentroidsPath),
    aggregateLookupPath: getString(lookup.aggregateLookupPath, currentForm.aggregateLookupPath),
    aggregateBoundariesPath: getString(lookup.aggregateBoundariesPath, currentForm.aggregateBoundariesPath),
    enableTopFlows: getBoolean(topFlows.enabled, currentForm.enableTopFlows),
    enableOdHeatmap: getBoolean(odHeatmap.enabled, currentForm.enableOdHeatmap),
    enableDirectionalBalance: getBoolean(directionalBalance.enabled, currentForm.enableDirectionalBalance),
    dimensions: dimensions.map((dimension) => {
      const dataset = getNestedRecord(dimension, 'dataset');
      const key = getString(dimension.key, 'categoria');

      return {
        key,
        label: getString(dimension.label, key),
        categoryColumn: getString(dimension.categoryColumn, 'category'),
        fileName: getString(dataset.fileName),
        tableName: getString(dataset.tableName, `flows_${key}`),
        optionsText: dimensionOptionsToText(dimension.options),
      };
    }),
  };
}

function buildProfile(form: FormState): DatasetProfileSource {
  const datasetId = form.id.trim();
  const aggregateSingular = form.aggregateSingular.trim();
  const aggregatePlural = form.aggregatePlural.trim() || `${aggregateSingular}s`;
  const baseSingular = form.baseSingular.trim();
  const basePlural = form.basePlural.trim() || `${baseSingular}s`;
  const enabledCharts = {
    topFlows: form.enableTopFlows,
    odHeatmap: form.enableOdHeatmap,
    directionalBalance: form.enableDirectionalBalance,
  };

  return {
    id: datasetId,
    label: form.label.trim(),
    description: form.description.trim(),
    sortOrder: parseNumber(form.sortOrder, 40),
    geography: {
      base: baseSingular,
      aggregate: aggregateSingular,
    },
    labels: {
      base: {
        singular: baseSingular,
        plural: basePlural,
        selectorTitle: `Selecao por ${baseSingular.toLowerCase()}`,
        selectedTitle: `${baseSingular} selecionada`,
        helperText: `Digite o codigo da ${baseSingular.toLowerCase()} e pressione Enter para ver as conexoes.`,
        inputPlaceholder: `Digite o codigo da ${baseSingular.toLowerCase()}`,
        modeLabel: basePlural,
      },
      aggregate: {
        singular: aggregateSingular,
        plural: aggregatePlural,
        selectorTitle: `Selecao por ${aggregateSingular.toLowerCase()}`,
        selectedTitle: `${aggregateSingular} selecionada`,
        helperText: `Busque uma ${aggregateSingular.toLowerCase()} para visualizar os fluxos agregados.`,
        searchPlaceholder: `Buscar ${aggregateSingular.toLowerCase()}...`,
        emptySearchTitle: 'Nenhuma unidade encontrada',
        emptySearchHint: 'Tente buscar por nome ou codigo',
        modeLabel: aggregatePlural,
      },
      analyticsEmptyTitle: 'Selecione uma area para ver os graficos',
      analyticsEmptyHint: 'Clique no mapa ou use a busca para selecionar uma unidade geografica',
      areaChipLabel: 'Area',
      levelChipLabel: 'Nivel',
      datasetActiveLabel: 'Conjunto de dados ativo',
    },
    mapView: {
      longitude: parseNumber(form.longitude, 0),
      latitude: parseNumber(form.latitude, 0),
      zoom: parseNumber(form.zoom, 8),
    },
    lookup: {
      baseCentroidsPath: cleanPastedPath(form.baseCentroidsPath),
      aggregateCentroidsPath: cleanPastedPath(form.aggregateCentroidsPath),
      aggregateLookupPath: cleanPastedPath(form.aggregateLookupPath),
      baseBoundariesPath: cleanPastedPath(form.baseBoundariesPath),
      aggregateBoundariesPath: cleanPastedPath(form.aggregateBoundariesPath),
    },
    storage: {
      remoteBaseUrl: ensureTrailingSlash(form.remoteBaseUrl),
      localProcessedBasePath: ensureTrailingSlash(form.localProcessedBasePath),
    },
    baseFlowDataset: {
      fileName: cleanPastedPath(form.baseFlowFileName),
      tableName: 'flows',
      required: true,
    },
    analyticsMode: 'generic',
    dashboard: {
      genericAnalyticsHint:
        'Dataset configurado pelo assistente. Garanta que os arquivos sigam o contrato antes de publicar.',
      chartOrder,
      charts: {
        topFlows: {
          title: 'Ranking dos principais fluxos',
          enabled: enabledCharts.topFlows,
          defaultCollapsed: false,
          section: 'main',
          params: { topN: 10 },
        },
        odHeatmap: {
          title: `Mapa de calor OD por ${aggregateSingular}`,
          enabled: enabledCharts.odHeatmap,
          defaultCollapsed: true,
          section: 'advanced',
          params: { initialTopN: 10 },
        },
        directionalBalance: {
          title: `Saldo direcional por ${aggregateSingular}`,
          enabled: enabledCharts.directionalBalance,
          defaultCollapsed: true,
          section: 'advanced',
          params: { topN: 15 },
        },
        performance: { title: 'Performance e latencia', enabled: false, defaultCollapsed: true, section: 'advanced' },
        socialPie: { title: 'Distribuicao por categoria', enabled: false, defaultCollapsed: false, section: 'main' },
        ageBar: { title: 'Distribuicao por faixa', enabled: false, defaultCollapsed: false, section: 'main' },
        socialMultiples: { title: 'Multiplos paineis', enabled: false, defaultCollapsed: true, section: 'advanced' },
        aggregateStacked: { title: 'Composicao empilhada', enabled: false, defaultCollapsed: true, section: 'advanced' },
        aggregationScatter: { title: 'Validacao da agregacao', enabled: false, defaultCollapsed: true, section: 'advanced' },
      },
    },
    demographicDimensions: form.dimensions
      .filter((dimension) => dimension.key.trim() && dimension.categoryColumn.trim() && dimension.fileName.trim())
      .map((dimension) => ({
        key: dimension.key.trim(),
        label: dimension.label.trim() || dimension.key.trim(),
        categoryColumn: dimension.categoryColumn.trim(),
        allLabel: 'Todas',
        dataset: {
          fileName: dimension.fileName.trim(),
          tableName: dimension.tableName.trim() || `flows_${dimension.key.trim()}`,
        },
        options: parseDimensionOptions(dimension.optionsText),
      })),
  };
}

function validateForm(form: FormState) {
  const errors: string[] = [];
  const fieldErrors: FieldErrors = {};
  const warnings: string[] = [];
  const id = form.id.trim();
  const remoteBaseUrl = ensureTrailingSlash(form.remoteBaseUrl);
  const baseFlowFileName = cleanPastedPath(form.baseFlowFileName);
  const longitude = Number(form.longitude);
  const latitude = Number(form.latitude);
  const zoom = Number(form.zoom);
  const sortOrder = Number(form.sortOrder);

  const addFieldError = (field: keyof FormState, message: string) => {
    fieldErrors[field] = message;
    errors.push(message);
  };

  if (!id) {
    addFieldError('id', 'Informe um id unico para o dataset.');
  } else if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
    addFieldError('id', 'O id deve usar apenas letras minusculas, numeros, hifen ou underline, comecando por letra ou numero.');
  }

  if (!form.label.trim()) addFieldError('label', 'Informe o nome que aparecera no seletor.');
  if (!form.description.trim()) addFieldError('description', 'Informe uma descricao curta.');
  if (!form.baseSingular.trim()) addFieldError('baseSingular', 'Informe o nome da unidade geografica base.');
  if (!form.aggregateSingular.trim()) addFieldError('aggregateSingular', 'Informe a unidade agregada; a tela atual inicia nesse modo.');
  if (!baseFlowFileName) addFieldError('baseFlowFileName', 'Informe o nome do Parquet principal.');
  if (!baseFlowFileName.endsWith('.parquet')) {
    warnings.push('O app le a matriz principal com DuckDB-WASM, entao o arquivo de fluxos precisa estar em Parquet.');
  }

  if (!isValidNumberText(form.sortOrder) || sortOrder < 0) {
    addFieldError('sortOrder', 'Ordem deve ser um numero maior ou igual a 0.');
  }

  [
    ['Caminho de centroides base', form.baseCentroidsPath],
    ['Caminho de fronteiras base', form.baseBoundariesPath],
    ['Caminho de centroides agregados', form.aggregateCentroidsPath],
    ['Caminho de lookup agregado', form.aggregateLookupPath],
    ['Caminho de fronteiras agregadas', form.aggregateBoundariesPath],
  ].forEach(([label, value]) => {
    const cleanValue = cleanPastedPath(value);
    if (!cleanValue) {
      errors.push(`${label} e obrigatorio.`);
    } else if (!isPathLike(cleanValue)) {
      warnings.push(`${label} deve ser um caminho publico iniciado por /data/... ou uma URL https.`);
    }
  });

  if (!cleanPastedPath(form.baseCentroidsPath).endsWith('.csv')) warnings.push('areas_centroids normalmente deve ser CSV com code,name,lat,lon.');
  if (!cleanPastedPath(form.aggregateLookupPath).endsWith('.csv')) warnings.push('aggregate_lookup normalmente deve ser CSV.');
  if (!cleanPastedPath(form.baseBoundariesPath).endsWith('.geojson')) warnings.push('boundaries normalmente deve ser GeoJSON.');
  if (!cleanPastedPath(form.aggregateBoundariesPath).endsWith('.geojson')) warnings.push('aggregate_boundaries normalmente deve ser GeoJSON.');

  if (!isValidNumberText(form.longitude) || longitude < -180 || longitude > 180) {
    addFieldError('longitude', 'Longitude inicial deve estar entre -180 e 180.');
  }
  if (!isValidNumberText(form.latitude) || latitude < -90 || latitude > 90) {
    addFieldError('latitude', 'Latitude inicial deve estar entre -90 e 90.');
  }
  if (!isValidNumberText(form.zoom) || zoom < 0 || zoom > 22) {
    addFieldError('zoom', 'Zoom inicial deve estar entre 0 e 22.');
  }

  if (!remoteBaseUrl) {
    warnings.push('Sem remoteBaseUrl o app usara apenas o arquivo local em public/data.');
  } else {
    if (remoteBaseUrl.includes('github.com/')) {
      warnings.push('Use jsDelivr ou raw.githubusercontent.com; links github.com apontam para HTML, nao para o arquivo bruto.');
    }
    if (/cdn\.jsdelivr\.net\/gh\/[^/]+\/[^/@]+@[^/]+\/$/.test(remoteBaseUrl)) {
      warnings.push('O link CDN parece apontar para a raiz do repositorio. Prefira terminar em /public/data/<dataset>/processed/.');
    }
  }

  form.dimensions.forEach((dimension) => {
    if (!dimension.key.trim() && !dimension.label.trim() && !dimension.fileName.trim()) {
      return;
    }
    if (!dimension.key.trim()) errors.push('Toda dimensao precisa de key.');
    if (!dimension.categoryColumn.trim()) errors.push(`A dimensao ${dimension.key || '(sem key)'} precisa da coluna categorica.`);
    if (!dimension.fileName.trim().endsWith('.parquet')) {
      warnings.push(`A dimensao ${dimension.key || '(sem key)'} deve apontar para um Parquet separado.`);
    }
    if (parseDimensionOptions(dimension.optionsText).length === 0) {
      warnings.push(`A dimensao ${dimension.key || '(sem key)'} esta sem opcoes; o filtro pode ficar vazio.`);
    }
  });

  return { errors, warnings, fieldErrors };
}

function getCheckUrls(form: FormState): LinkCheckTarget[] {
  const remoteBaseUrl = ensureTrailingSlash(form.remoteBaseUrl);
  const localProcessedBasePath = ensureTrailingSlash(form.localProcessedBasePath);
  const baseFlowFileName = cleanPastedPath(form.baseFlowFileName);
  const remoteFlowUrl = remoteBaseUrl ? `${remoteBaseUrl}${baseFlowFileName}` : '';
  const localFlowUrl = localProcessedBasePath ? `${localProcessedBasePath}${baseFlowFileName}` : '';
  const urls: LinkCheckTarget[] = [
    {
      key: 'flow',
      label: 'Parquet principal',
      url: remoteFlowUrl || localFlowUrl,
      source: remoteFlowUrl ? 'remote' : 'local',
      fallbackUrl: remoteFlowUrl ? localFlowUrl : undefined,
      fallbackSource: remoteFlowUrl ? 'local' : undefined,
    },
    { key: 'baseCentroids', label: 'Centroides base', url: cleanPastedPath(form.baseCentroidsPath) },
    { key: 'baseBoundaries', label: 'Fronteiras base', url: cleanPastedPath(form.baseBoundariesPath) },
    { key: 'aggregateCentroids', label: 'Centroides agregados', url: cleanPastedPath(form.aggregateCentroidsPath) },
    { key: 'aggregateLookup', label: 'Lookup agregado', url: cleanPastedPath(form.aggregateLookupPath) },
    { key: 'aggregateBoundaries', label: 'Fronteiras agregadas', url: cleanPastedPath(form.aggregateBoundariesPath) },
  ];

  return urls.filter((item) => (item.url && isPathLike(item.url)) || (item.fallbackUrl && isPathLike(item.fallbackUrl)));
}

async function checkUrl(url: string): Promise<boolean> {
  const isUsableAssetResponse = (response: Response): boolean => {
    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    return response.ok && !contentType.includes('text/html');
  };

  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (isUsableAssetResponse(response)) return true;
  } catch {
    // Some CDNs reject HEAD even when GET works.
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-0',
      },
    });
    return (response.ok || response.status === 206) && !response.headers.get('content-type')?.toLowerCase().includes('text/html');
  } catch {
    return false;
  }
}

async function checkTargetUrl(target: LinkCheckTarget): Promise<LinkCheckResult> {
  if (target.url && isPathLike(target.url) && await checkUrl(target.url)) {
    return {
      status: 'ok',
      source: target.source,
      checkedUrl: target.url,
    };
  }

  if (target.fallbackUrl && isPathLike(target.fallbackUrl) && await checkUrl(target.fallbackUrl)) {
    return {
      status: 'ok',
      source: target.fallbackSource,
      checkedUrl: target.fallbackUrl,
    };
  }

  return {
    status: 'error',
    checkedUrl: target.url || target.fallbackUrl,
  };
}

export function DatasetProfileBuilder({ onClose }: DatasetProfileBuilderProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [pastedJson, setPastedJson] = useState('');
  const [importMessage, setImportMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [localSaveState, setLocalSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [localSaveMessage, setLocalSaveMessage] = useState('');
  const [linkStatuses, setLinkStatuses] = useState<Record<string, LinkCheckResult>>({});
  const [blobFiles, setBlobFiles] = useState<DatasetBlobPublishFiles>({});
  const [blobPublishStatus, setBlobPublishStatus] = useState<BlobPublishStatus>('idle');
  const [blobPublishProgress, setBlobPublishProgress] = useState<DatasetBlobPublishProgress | null>(null);
  const [blobPublishMessage, setBlobPublishMessage] = useState('');
  const copyResetTimeoutRef = useRef<number | null>(null);
  const profile = useMemo(() => buildProfile(form), [form]);
  const profileJson = useMemo(() => JSON.stringify(profile, null, 2), [profile]);
  const validation = useMemo(() => validateForm(form), [form]);
  const suggestedFileName = `${form.id.trim() || 'novo_dataset'}.json`;

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const updateField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const importPastedJson = () => {
    try {
      const parsed = JSON.parse(pastedJson);
      setForm((current) => buildFormFromProfile(parsed, current));
      setImportMessage({ tone: 'success', text: 'JSON carregado no formulario.' });
      setLinkStatuses({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSON invalido.';
      setImportMessage({ tone: 'error', text: message });
    }
  };

  const addDimension = () => {
    setForm((current) => ({
      ...current,
      dimensions: [
        ...current.dimensions,
        {
          key: 'categoria',
          label: 'Categoria',
          categoryColumn: 'category',
          fileName: 'flows_categoria.parquet',
          tableName: 'flows_categoria',
          optionsText: 'valor=Rotulo visivel',
        },
      ],
    }));
  };

  const updateDimension = (index: number, changes: Partial<DimensionDraft>) => {
    setForm((current) => ({
      ...current,
      dimensions: current.dimensions.map((dimension, dimensionIndex) =>
        dimensionIndex === index ? { ...dimension, ...changes } : dimension
      ),
    }));
  };

  const removeDimension = (index: number) => {
    setForm((current) => ({
      ...current,
      dimensions: current.dimensions.filter((_, dimensionIndex) => dimensionIndex !== index),
    }));
  };

  const updateBlobFile = (key: DatasetBlobFileKey, file: File | null) => {
    setBlobFiles((current) => ({
      ...current,
      [key]: file ?? undefined,
    }));
  };

  const updateBlobDimensionFile = (dimensionKey: string, file: File | null) => {
    setBlobFiles((current) => ({
      ...current,
      dimensions: {
        ...(current.dimensions ?? {}),
        [dimensionKey]: file ?? undefined,
      },
    }));
  };

  const applySlug = () => {
    const slug = slugifyDatasetId(form.id || form.label);
    if (!slug) return;

    setForm((current) => ({
      ...current,
      id: slug,
      localProcessedBasePath: `/data/${slug}/processed/`,
      baseCentroidsPath: `/data/${slug}/lookup/areas_centroids.csv`,
      baseBoundariesPath: `/data/${slug}/lookup/boundaries.geojson`,
      aggregateCentroidsPath: `/data/${slug}/lookup/aggregate_centroids.csv`,
      aggregateLookupPath: `/data/${slug}/lookup/aggregate_lookup.csv`,
      aggregateBoundariesPath: `/data/${slug}/lookup/aggregate_boundaries.geojson`,
    }));
  };

  const copyJson = async () => {
    if (copyResetTimeoutRef.current !== null) {
      window.clearTimeout(copyResetTimeoutRef.current);
      copyResetTimeoutRef.current = null;
    }

    try {
      await navigator.clipboard.writeText(profileJson);
      setCopyState('copied');
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyState('idle');
        copyResetTimeoutRef.current = null;
      }, 1800);
    } catch {
      setCopyState('failed');
      copyResetTimeoutRef.current = window.setTimeout(() => {
        setCopyState('idle');
        copyResetTimeoutRef.current = null;
      }, 2400);
    }
  };

  const downloadJson = () => {
    const blob = new Blob([profileJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = suggestedFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveProfileLocally = async () => {
    if (validation.errors.length > 0) {
      setLocalSaveState('failed');
      setLocalSaveMessage('Corrija os erros obrigatorios antes de salvar o dataset local.');
      return;
    }

    setLocalSaveState('saving');
    setLocalSaveMessage('');

    try {
      await saveLocalDatasetProfile(profile);
      persistActiveDataset(profile.id);
      setLocalSaveState('saved');
      setLocalSaveMessage('Dataset salvo no navegador. Abrindo o dataset salvo...');

      window.setTimeout(() => {
        window.location.assign(buildDatasetSwitchUrl(profile.id));
      }, 450);
    } catch (error) {
      setLocalSaveState('failed');
      setLocalSaveMessage(error instanceof Error ? error.message : 'Nao foi possivel salvar o dataset local.');
    }
  };

  const publishToVercelBlob = async () => {
    if (validation.errors.length > 0) {
      setBlobPublishStatus('failed');
      setBlobPublishMessage('Corrija os erros obrigatorios antes de publicar no Vercel Blob.');
      return;
    }

    setBlobPublishStatus('publishing');
    setBlobPublishMessage('');
    setBlobPublishProgress(null);

    try {
      const result = await publishDatasetProfileToBlob(profile, blobFiles, setBlobPublishProgress);
      setForm((current) => buildFormFromProfile(result.profile, current));
      await saveLocalDatasetProfile(result.profile);
      setBlobPublishStatus('published');
      setBlobPublishMessage(`Publicado no Vercel Blob e salvo localmente. Perfil: ${result.profileUrl}`);
      setLinkStatuses({});
    } catch (error) {
      setBlobPublishStatus('failed');
      setBlobPublishMessage(error instanceof Error ? error.message : 'Nao foi possivel publicar no Vercel Blob.');
    }
  };

  const publishJsonToVercelBlob = async () => {
    if (validation.errors.length > 0) {
      setBlobPublishStatus('failed');
      setBlobPublishMessage('Corrija os erros obrigatorios antes de publicar o JSON no Vercel Blob.');
      return;
    }

    setBlobPublishStatus('publishing');
    setBlobPublishMessage('');
    setBlobPublishProgress(null);

    try {
      const result = await publishDatasetProfileToBlob(profile, {}, setBlobPublishProgress);
      await saveLocalDatasetProfile(result.profile);
      setBlobPublishStatus('published');
      setBlobPublishMessage(`JSON publicado no Vercel Blob: ${result.profileUrl}`);
    } catch (error) {
      setBlobPublishStatus('failed');
      setBlobPublishMessage(error instanceof Error ? error.message : 'Nao foi possivel publicar o JSON no Vercel Blob.');
    }
  };

  const checkLinks = async () => {
    const urls = getCheckUrls(form);
    setLinkStatuses(Object.fromEntries(urls.map((item) => [item.key, { status: 'checking' }])));

    const results = await Promise.all(
      urls.map(async (item) => [item.key, await checkTargetUrl(item)] as const)
    );

    setLinkStatuses(Object.fromEntries(results));
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/45 p-4 backdrop-blur-sm">
      <section className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Novo dataset</p>
            <h2 className="text-lg font-bold text-slate-950">Assistente de perfil OD</h2>
            <p className="mt-1 max-w-4xl text-xs leading-5 text-slate-500">
              Gere o JSON de configuracao e veja o que falta antes de publicar os arquivos em
              <span className="font-mono"> public/data/&lt;dataset&gt;</span> ou em um CDN.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(460px,0.95fr)_minmax(420px,1.05fr)]">
          <div className="min-h-0 overflow-y-auto border-r border-slate-200 p-5">
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              Link ajuda a nao versionar arquivos grandes, mas o navegador ainda baixa o Parquet para consultar com DuckDB-WASM.
              Para CSV bruto, rode a pipeline antes e publique os artefatos normalizados.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Id do dataset">
                <div className="flex gap-2">
                  <input
                    value={form.id}
                    onChange={(event) => updateField('id', event.target.value)}
                    aria-invalid={Boolean(validation.fieldErrors.id)}
                    className={getInputClass(Boolean(validation.fieldErrors.id), 'min-w-0 flex-1 text-sm')}
                  />
                  <button
                    type="button"
                    onClick={applySlug}
                    className="rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    slug
                  </button>
                </div>
              </Field>

              <Field label="Ordem">
                <input
                  value={form.sortOrder}
                  onChange={(event) => updateField('sortOrder', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.sortOrder)}
                  className={getInputClass(Boolean(validation.fieldErrors.sortOrder))}
                />
              </Field>

              <Field label="Nome no seletor">
                <input
                  value={form.label}
                  onChange={(event) => updateField('label', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.label)}
                  className={getInputClass(Boolean(validation.fieldErrors.label))}
                />
              </Field>

              <Field label="Parquet principal">
                <input
                  value={form.baseFlowFileName}
                  onChange={(event) => updateField('baseFlowFileName', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.baseFlowFileName)}
                  className={getInputClass(Boolean(validation.fieldErrors.baseFlowFileName))}
                />
              </Field>

              <Field label="Descricao" className="col-span-2">
                <textarea
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  rows={2}
                  aria-invalid={Boolean(validation.fieldErrors.description)}
                  className={getInputClass(Boolean(validation.fieldErrors.description))}
                />
              </Field>
            </div>

            <SectionTitle title="Geografia" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Base singular">
                <input
                  value={form.baseSingular}
                  onChange={(event) => updateField('baseSingular', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.baseSingular)}
                  className={getInputClass(Boolean(validation.fieldErrors.baseSingular))}
                />
              </Field>
              <Field label="Base plural">
                <input
                  value={form.basePlural}
                  onChange={(event) => updateField('basePlural', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Agregado singular">
                <input
                  value={form.aggregateSingular}
                  onChange={(event) => updateField('aggregateSingular', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.aggregateSingular)}
                  className={getInputClass(Boolean(validation.fieldErrors.aggregateSingular))}
                />
              </Field>
              <Field label="Agregado plural">
                <input
                  value={form.aggregatePlural}
                  onChange={(event) => updateField('aggregatePlural', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Longitude inicial">
                <input
                  value={form.longitude}
                  onChange={(event) => updateField('longitude', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.longitude)}
                  className={getInputClass(Boolean(validation.fieldErrors.longitude))}
                />
              </Field>
              <Field label="Latitude inicial">
                <input
                  value={form.latitude}
                  onChange={(event) => updateField('latitude', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.latitude)}
                  className={getInputClass(Boolean(validation.fieldErrors.latitude))}
                />
              </Field>
              <Field label="Zoom inicial">
                <input
                  value={form.zoom}
                  onChange={(event) => updateField('zoom', event.target.value)}
                  aria-invalid={Boolean(validation.fieldErrors.zoom)}
                  className={getInputClass(Boolean(validation.fieldErrors.zoom))}
                />
              </Field>
            </div>

            <SectionTitle title="Arquivos publicados" />
            <details className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-800">
                Ver exemplo no JSON
              </summary>
              <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-white p-3 font-mono text-[10px] leading-4 text-slate-700">
                {publishedFilesJsonExample}
              </pre>
            </details>

            {ENABLE_VERCEL_BLOB_FILE_PUBLISHING && (
              <details className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <summary className="cursor-pointer font-semibold">
                  Publicar arquivos no Vercel Blob
                </summary>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <BlobFilePicker
                    label="Parquet principal"
                    file={blobFiles.baseFlow}
                    accept=".parquet"
                    disabled={blobPublishStatus === 'publishing'}
                    onChange={(file) => updateBlobFile('baseFlow', file)}
                  />
                  <BlobFilePicker
                    label="Centroides base"
                    file={blobFiles.baseCentroids}
                    accept=".csv,text/csv"
                    disabled={blobPublishStatus === 'publishing'}
                    onChange={(file) => updateBlobFile('baseCentroids', file)}
                  />
                  <BlobFilePicker
                    label="Fronteiras base"
                    file={blobFiles.baseBoundaries}
                    accept=".geojson,.json,application/geo+json,application/json"
                    disabled={blobPublishStatus === 'publishing'}
                    onChange={(file) => updateBlobFile('baseBoundaries', file)}
                  />
                  <BlobFilePicker
                    label="Centroides agregados"
                    file={blobFiles.aggregateCentroids}
                    accept=".csv,text/csv"
                    disabled={blobPublishStatus === 'publishing'}
                    onChange={(file) => updateBlobFile('aggregateCentroids', file)}
                  />
                  <BlobFilePicker
                    label="Lookup agregado"
                    file={blobFiles.aggregateLookup}
                    accept=".csv,text/csv"
                    disabled={blobPublishStatus === 'publishing'}
                    onChange={(file) => updateBlobFile('aggregateLookup', file)}
                  />
                  <BlobFilePicker
                    label="Fronteiras agregadas"
                    file={blobFiles.aggregateBoundaries}
                    accept=".geojson,.json,application/geo+json,application/json"
                    disabled={blobPublishStatus === 'publishing'}
                    onChange={(file) => updateBlobFile('aggregateBoundaries', file)}
                  />
                </div>

                {form.dimensions.length > 0 && (
                  <div className="mt-3 border-t border-emerald-200 pt-3">
                    <p className="mb-2 font-semibold">Parquets das dimensoes</p>
                    <div className="grid grid-cols-2 gap-2">
                      {form.dimensions.map((dimension) => (
                        <BlobFilePicker
                          key={dimension.key}
                          label={dimension.label || dimension.key}
                          file={blobFiles.dimensions?.[dimension.key]}
                          accept=".parquet"
                          disabled={blobPublishStatus === 'publishing'}
                          onChange={(file) => updateBlobDimensionFile(dimension.key, file)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {blobPublishProgress && (
                  <div className="mt-3 rounded-md bg-white p-2 text-emerald-800">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{blobPublishProgress.currentFileLabel}</span>
                      <span>{Math.round(blobPublishProgress.percentage)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${blobPublishProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}

                {blobPublishMessage && (
                  <p
                    className={`mt-3 rounded-md px-3 py-2 font-semibold ${
                      blobPublishStatus === 'failed'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-white text-emerald-800'
                    }`}
                  >
                    {blobPublishMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void publishToVercelBlob()}
                  disabled={blobPublishStatus === 'publishing' || validation.errors.length > 0}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {blobPublishStatus === 'publishing' ? 'Publicando' : 'Publicar no Blob'}
                </button>
              </details>
            )}
            <div className="space-y-3">
              <Field
                label="URL remota da pasta processed"
                hint={
                  <FileHelpButton helpKey="remoteBaseUrl" />
                }
              >
                <input
                  value={form.remoteBaseUrl}
                  onChange={(event) => updateField('remoteBaseUrl', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </Field>
              <Field
                label="Fallback local processed"
                hint={
                  <FileHelpButton helpKey="localProcessedBasePath" />
                }
              >
                <input
                  value={form.localProcessedBasePath}
                  onChange={(event) => updateField('localProcessedBasePath', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </Field>
              <Field
                label="Centroides base CSV"
                hint={
                  <FileHelpButton helpKey="baseCentroidsPath" />
                }
              >
                <input
                  value={form.baseCentroidsPath}
                  onChange={(event) => updateField('baseCentroidsPath', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </Field>
              <Field
                label="Fronteiras base GeoJSON"
                hint={
                  <FileHelpButton helpKey="baseBoundariesPath" />
                }
              >
                <input
                  value={form.baseBoundariesPath}
                  onChange={(event) => updateField('baseBoundariesPath', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </Field>
              <Field
                label="Centroides agregados CSV"
                hint={
                  <FileHelpButton helpKey="aggregateCentroidsPath" />
                }
              >
                <input
                  value={form.aggregateCentroidsPath}
                  onChange={(event) => updateField('aggregateCentroidsPath', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </Field>
              <Field
                label="Lookup agregado CSV"
                hint={
                  <FileHelpButton helpKey="aggregateLookupPath" />
                }
              >
                <input
                  value={form.aggregateLookupPath}
                  onChange={(event) => updateField('aggregateLookupPath', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </Field>
              <Field
                label="Fronteiras agregadas GeoJSON"
                hint={
                  <FileHelpButton helpKey="aggregateBoundariesPath" />
                }
              >
                <input
                  value={form.aggregateBoundariesPath}
                  onChange={(event) => updateField('aggregateBoundariesPath', event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                />
              </Field>
            </div>

            <SectionTitle title="Graficos e filtros" />
            <div className="grid grid-cols-3 gap-2">
              <Toggle checked={form.enableTopFlows} label="Ranking" onChange={(value) => updateField('enableTopFlows', value)} />
              <Toggle checked={form.enableOdHeatmap} label="Heatmap OD" onChange={(value) => updateField('enableOdHeatmap', value)} />
              <Toggle
                checked={form.enableDirectionalBalance}
                label="Saldo"
                onChange={(value) => updateField('enableDirectionalBalance', value)}
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-950">Dimensoes opcionais</h3>
              <button
                type="button"
                onClick={addDimension}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {form.dimensions.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  Use dimensoes apenas quando tiver Parquets separados, por exemplo idade, renda, modo ou ocupacao.
                </p>
              )}

              {form.dimensions.map((dimension, index) => (
                <div key={index} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800">Dimensao {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeDimension(index)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                      title="Remover dimensao"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Key">
                      <input
                        value={dimension.key}
                        onChange={(event) => updateDimension(index, { key: event.target.value })}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="Rotulo">
                      <input
                        value={dimension.label}
                        onChange={(event) => updateDimension(index, { label: event.target.value })}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="Coluna categoria">
                      <input
                        value={dimension.categoryColumn}
                        onChange={(event) => updateDimension(index, { categoryColumn: event.target.value })}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="Table name">
                      <input
                        value={dimension.tableName}
                        onChange={(event) => updateDimension(index, { tableName: event.target.value })}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      />
                    </Field>
                    <Field label="Arquivo Parquet" className="col-span-2">
                      <input
                        value={dimension.fileName}
                        onChange={(event) => updateDimension(index, { fileName: event.target.value })}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                      />
                    </Field>
                    <Field label="Opcoes: valor=rotulo" className="col-span-2">
                      <textarea
                        value={dimension.optionsText}
                        onChange={(event) => updateDimension(index, { optionsText: event.target.value })}
                        rows={3}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto">
            <div className="shrink-0 border-b border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Validacao</p>
                  <h3 className="text-sm font-bold text-slate-950">Pendencias detectadas</h3>
                </div>
                <button
                  type="button"
                  onClick={checkLinks}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Link className="h-3.5 w-3.5" />
                  Testar links
                </button>
              </div>

              {validation.errors.length > 0 && (
                <ValidationList title="Erros" tone="error" items={validation.errors} emptyText="Nenhum erro obrigatorio." />
              )}
              {validation.warnings.length > 0 && (
                <ValidationList title="Avisos" tone="warning" items={validation.warnings} emptyText="Nenhum aviso por enquanto." />
              )}

              {Object.keys(linkStatuses).length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-xs font-bold text-slate-800">Resultado dos links</p>
                  <div className="space-y-1.5">
                    {getCheckUrls(form).map((item) => (
                      <div key={item.key} className="flex items-start justify-between gap-3 text-xs">
                        <span className="min-w-0 text-slate-600">
                          <span className="block truncate font-medium">{item.label}</span>
                          <span
                            className="mt-0.5 block truncate font-mono text-[10px] text-slate-400"
                            title={linkStatuses[item.key]?.checkedUrl || item.url}
                          >
                            {linkStatuses[item.key]?.checkedUrl || item.url}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                            linkStatuses[item.key]?.status === 'ok'
                              ? 'bg-emerald-50 text-emerald-700'
                              : linkStatuses[item.key]?.status === 'checking'
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {linkStatuses[item.key]?.status === 'ok'
                            ? linkStatuses[item.key]?.source === 'remote'
                              ? 'ok remoto'
                              : linkStatuses[item.key]?.source === 'local'
                                ? 'ok local'
                                : 'ok'
                            : linkStatuses[item.key]?.status === 'checking'
                              ? 'testando'
                              : 'falhou'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col p-5">
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Importar</p>
                    <h3 className="text-sm font-bold text-slate-950">Colar JSON existente</h3>
                  </div>
                  <button
                    type="button"
                    onClick={importPastedJson}
                    disabled={!pastedJson.trim()}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Carregar
                  </button>
                </div>

                <textarea
                  value={pastedJson}
                  onChange={(event) => {
                    setPastedJson(event.target.value);
                    setImportMessage(null);
                  }}
                  rows={5}
                  placeholder="Cole aqui um perfil de src/dataset-configs/*.json para editar os campos."
                  className="min-h-36 w-full resize-y rounded-md border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-800"
                />

                {importMessage && (
                  <p
                    className={`mt-2 rounded-md px-3 py-2 text-xs font-semibold ${
                      importMessage.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {importMessage.text}
                  </p>
                )}
              </div>

              <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Salvar como
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-950">JSON gerado</h3>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                      src/dataset-configs/{suggestedFileName}
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void saveProfileLocally()}
                      disabled={validation.errors.length > 0 || localSaveState === 'saving'}
                      className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Database className="h-3.5 w-3.5" />
                      {localSaveState === 'saving' ? 'Salvando' : 'Salvar local'}
                    </button>
                    {ENABLE_VERCEL_BLOB_JSON_PUBLISHING && (
                      <button
                        type="button"
                        onClick={() => void publishJsonToVercelBlob()}
                        disabled={validation.errors.length > 0 || blobPublishStatus === 'publishing'}
                        className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {blobPublishStatus === 'publishing' ? 'Salvando' : 'Salvar JSON online'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={copyJson}
                      className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copyState === 'copied' ? 'Copiado' : copyState === 'failed' ? 'Falhou' : 'Copiar'}
                    </button>
                    <button
                      type="button"
                      onClick={downloadJson}
                      className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar
                    </button>
                  </div>
                </div>
              </div>

              {localSaveMessage && (
                <p
                  className={`mb-3 rounded-md px-3 py-2 text-xs font-semibold ${
                    localSaveState === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {localSaveMessage}
                </p>
              )}

              {ENABLE_VERCEL_BLOB_JSON_PUBLISHING && blobPublishMessage && (
                <p
                  className={`mb-3 rounded-md px-3 py-2 text-xs font-semibold ${
                    blobPublishStatus === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {blobPublishMessage}
                </p>
              )}

              <textarea
                readOnly
                value={profileJson}
                className="h-[520px] min-h-[360px] shrink-0 resize-y rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`block ${className}`}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        <span>{label}</span>
        {hint}
      </div>
      {children}
    </div>
  );
}

function FileHelpButton({ helpKey }: { helpKey: PublishedFileHelpKey }) {
  const hint = publishedFileHints[helpKey];

  return (
    <ChartObjectiveHelp
      title={hint.title}
      objective={hint.description}
      bLeft={true}
    />
  );
}

function BlobFilePicker({
  label,
  file,
  accept,
  disabled,
  onChange,
}: {
  label: string;
  file?: File;
  accept: string;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="rounded-md border border-emerald-200 bg-white p-2">
      <p className="mb-1 text-[11px] font-semibold text-emerald-900">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0] ?? null;
          event.target.value = '';
          onChange(selectedFile);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-between gap-2 rounded border border-emerald-100 px-2 py-1.5 text-left text-[11px] text-emerald-800 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 truncate">{file ? file.name : 'Selecionar arquivo'}</span>
        <Upload className="h-3.5 w-3.5 shrink-0" />
      </button>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="mb-3 mt-5 text-sm font-bold text-slate-950">{title}</h3>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-slate-900"
      />
      {label}
    </label>
  );
}

function ValidationList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: 'error' | 'warning';
}) {
  const toneClasses =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <div className={`mt-3 rounded-lg border p-3 text-xs leading-5 ${toneClasses}`}>
      <p className="font-bold">{title}</p>
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul className="list-disc pl-4">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
