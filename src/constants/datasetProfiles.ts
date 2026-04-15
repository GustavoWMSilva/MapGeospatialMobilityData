import type {
  DatasetChartConfig,
  DatasetChartId,
  DatasetDashboardConfig,
  DatasetProfile,
  DemographicFilters,
  DemographicDimensionConfig,
  GeographyLevel,
} from '../types';

const DEFAULT_FILTER_VALUE = 'all';

type DatasetProfileSource = Omit<DatasetProfile, 'dashboard'> & {
  dashboard?: Partial<Omit<DatasetDashboardConfig, 'charts'>> & {
    charts?: Partial<Record<DatasetChartId, Partial<DatasetChartConfig>>>;
  };
};

const DEFAULT_DASHBOARD_CHARTS: Record<DatasetChartId, DatasetChartConfig> = {
  socialPie: {
    title: 'Distribuicao por classe social',
    enabled: true,
    defaultCollapsed: false,
  },
  ageBar: {
    title: 'Distribuicao por faixa etaria',
    enabled: true,
    defaultCollapsed: false,
  },
  topFlows: {
    title: 'Ranking dos principais fluxos',
    enabled: true,
    defaultCollapsed: false,
  },
  performance: {
    title: 'Performance e latencia',
    enabled: true,
    defaultCollapsed: true,
  },
  odHeatmap: {
    title: 'Mapa de calor OD (Top N)',
    enabled: true,
    defaultCollapsed: true,
  },
  socialMultiples: {
    title: 'Multiplos paineis por classe',
    enabled: true,
    defaultCollapsed: true,
  },
  aggregateStacked: {
    title: 'Composicao social empilhada 100%',
    enabled: true,
    defaultCollapsed: true,
  },
  aggregationScatter: {
    title: 'Validacao da agregacao',
    enabled: true,
    defaultCollapsed: true,
  },
  directionalBalance: {
    title: 'Saldo direcional por area agregada',
    enabled: true,
    defaultCollapsed: true,
  },
};

const DEFAULT_DASHBOARD_CONFIG: Omit<DatasetDashboardConfig, 'charts'> = {
  panelTitle: 'Painel Analitico',
  panelSubtitle: 'Filtros e resumo da selecao atual',
  mainChartsTitle: 'Visualizacao principal',
  mainChartsSubtitle: 'Graficos principais para leitura rapida do fluxo',
  directionLabel: 'Direcao',
  directionValues: {
    incoming: 'Entrada',
    outgoing: 'Saida',
  },
  includeInternalFlowsLabel: 'Incluir fluxo interno (origem = destino)',
  includeInternalFlowsHint: 'Quando desativado, os graficos ignoram fluxos dentro da mesma area.',
  genericAnalyticsHint:
    'Este dataset usa filtros configuraveis no mapa e no ranking. Graficos analiticos especificos podem ser habilitados via configuracao e componentes existentes.',
  advancedChartsShowLabel: 'Mostrar graficos avancados (TCC)',
  advancedChartsHideLabel: 'Ocultar graficos avancados (TCC)',
};

const datasetProfileModules = import.meta.glob('../dataset-configs/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, DatasetProfileSource>;

function normalizeDatasetProfile(profile: DatasetProfileSource): DatasetProfile {
  const normalizedCharts = Object.fromEntries(
    (Object.keys(DEFAULT_DASHBOARD_CHARTS) as DatasetChartId[]).map((chartId) => [
      chartId,
      {
        ...DEFAULT_DASHBOARD_CHARTS[chartId],
        ...(profile.dashboard?.charts?.[chartId] ?? {}),
      },
    ])
  ) as Record<DatasetChartId, DatasetChartConfig>;

  return {
    ...profile,
    dashboard: {
      ...DEFAULT_DASHBOARD_CONFIG,
      ...profile.dashboard,
      directionValues: {
        ...DEFAULT_DASHBOARD_CONFIG.directionValues,
        ...(profile.dashboard?.directionValues ?? {}),
      },
      charts: normalizedCharts,
    },
  };
}

export const DATASET_PROFILES: Record<string, DatasetProfile> = Object.values(datasetProfileModules).reduce(
  (accumulator, profile) => {
    const normalizedProfile = normalizeDatasetProfile(profile);
    accumulator[normalizedProfile.id] = normalizedProfile;
    return accumulator;
  },
  {} as Record<string, DatasetProfile>
);

export const DEFAULT_DATASET_ID = 'uk_commuting_ons';
export const DATASET_STORAGE_KEY = 'map-geospatial-active-dataset';

function isKnownDatasetId(datasetId: string | null | undefined): datasetId is string {
  return Boolean(datasetId && datasetId in DATASET_PROFILES);
}

export function getActiveDatasetId(): string {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const datasetFromUrl = params.get('dataset');
    if (isKnownDatasetId(datasetFromUrl)) {
      return datasetFromUrl;
    }

    const datasetFromStorage = window.localStorage.getItem(DATASET_STORAGE_KEY);
    if (isKnownDatasetId(datasetFromStorage)) {
      return datasetFromStorage;
    }
  }

  const datasetFromEnv = import.meta.env.VITE_ACTIVE_DATASET as string | undefined;
  if (isKnownDatasetId(datasetFromEnv)) {
    return datasetFromEnv;
  }

  return DEFAULT_DATASET_ID;
}

export function buildDatasetSwitchUrl(datasetId: string): string {
  if (typeof window === 'undefined') {
    return `?dataset=${datasetId}`;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('dataset', datasetId);
  return nextUrl.toString();
}

export function persistActiveDataset(datasetId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DATASET_STORAGE_KEY, datasetId);
}

export const ACTIVE_DATASET_PROFILE =
  DATASET_PROFILES[getActiveDatasetId()] ||
  DATASET_PROFILES[DEFAULT_DATASET_ID];

export function getDatasetToggleOptions(): Array<{ id: string; label: string; sortOrder: number }> {
  return Object.values(DATASET_PROFILES)
    .sort((left, right) => {
      const leftSort = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const rightSort = right.sortOrder ?? Number.MAX_SAFE_INTEGER;

      if (leftSort !== rightSort) {
        return leftSort - rightSort;
      }

      return left.label.localeCompare(right.label);
    })
    .map((profile) => ({
      id: profile.id,
      label: profile.label,
      sortOrder: profile.sortOrder ?? Number.MAX_SAFE_INTEGER,
    }));
}

export function createInitialDemographicFilters(profile: DatasetProfile): DemographicFilters {
  return Object.fromEntries(
    profile.demographicDimensions.map((dimension) => [dimension.key, DEFAULT_FILTER_VALUE])
  );
}

export function getDemographicFilterValue(filters: DemographicFilters, dimensionKey: string): string {
  return filters[dimensionKey] ?? DEFAULT_FILTER_VALUE;
}

export function hasActiveDemographicFilters(
  filters: DemographicFilters,
  dimensions: DemographicDimensionConfig[]
): boolean {
  return dimensions.some((dimension) => getDemographicFilterValue(filters, dimension.key) !== DEFAULT_FILTER_VALUE);
}

export function getActiveDemographicBadges(
  profile: DatasetProfile,
  filters: DemographicFilters
): Array<{ key: string; label: string; value: string; valueLabel: string }> {
  return profile.demographicDimensions
    .map((dimension) => {
      const value = getDemographicFilterValue(filters, dimension.key);
      const option = dimension.options.find((candidate) => candidate.value === value);
      return {
        key: dimension.key,
        label: dimension.label,
        value,
        valueLabel: option?.label || value,
      };
    })
    .filter((badge) => badge.value !== DEFAULT_FILTER_VALUE);
}

export function getLegacyAnalyticsFilters(profile: DatasetProfile, filters: DemographicFilters): {
  socialGrade: string;
  ageGroup: string;
} {
  const socialGradeDimension = profile.demographicDimensions.find(
    (dimension) => dimension.analyticsRole === 'socialGrade'
  );
  const ageDimension = profile.demographicDimensions.find((dimension) => dimension.analyticsRole === 'age');

  return {
    socialGrade: socialGradeDimension ? getDemographicFilterValue(filters, socialGradeDimension.key) : DEFAULT_FILTER_VALUE,
    ageGroup: ageDimension ? getDemographicFilterValue(filters, ageDimension.key) : DEFAULT_FILTER_VALUE,
  };
}

export function getBaseCentroidsPath(profile: DatasetProfile = ACTIVE_DATASET_PROFILE): string {
  return profile.lookup.baseCentroidsPath;
}

export function getAggregateCentroidsPath(profile: DatasetProfile = ACTIVE_DATASET_PROFILE): string {
  return profile.lookup.aggregateCentroidsPath;
}

export function getAggregateLookupPath(profile: DatasetProfile = ACTIVE_DATASET_PROFILE): string {
  return profile.lookup.aggregateLookupPath;
}

export function getBaseBoundariesPath(profile: DatasetProfile = ACTIVE_DATASET_PROFILE): string {
  return profile.lookup.baseBoundariesPath;
}

export function getAggregateBoundariesPath(profile: DatasetProfile = ACTIVE_DATASET_PROFILE): string {
  return profile.lookup.aggregateBoundariesPath;
}

export function getDataSourceUnitLabels(
  geographyLevel: GeographyLevel,
  profile: DatasetProfile = ACTIVE_DATASET_PROFILE
) {
  return geographyLevel === 'aggregate' ? profile.labels.aggregate : profile.labels.base;
}

export function getDashboardChartConfig(
  profile: DatasetProfile,
  chartId: DatasetChartId
): DatasetChartConfig {
  return profile.dashboard.charts[chartId];
}
