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

const DEFAULT_DASHBOARD_CHART_ORDER: DatasetChartId[] = [
  'socialPie',
  'ageBar',
  'topFlows',
  'performance',
  'odHeatmap',
  'socialMultiples',
  'aggregateStacked',
  'aggregationScatter',
  'directionalBalance',
];

const DEFAULT_DASHBOARD_CHARTS: Record<DatasetChartId, DatasetChartConfig> = {
  socialPie: {
    title: 'Distribuicao por classe social',
    enabled: true,
    defaultCollapsed: false,
    section: 'main',
  },
  ageBar: {
    title: 'Distribuicao por faixa etaria',
    enabled: true,
    defaultCollapsed: false,
    section: 'main',
  },
  topFlows: {
    title: 'Ranking dos principais fluxos',
    enabled: true,
    defaultCollapsed: false,
    section: 'main',
    params: {
      topN: 10,
    },
  },
  performance: {
    title: 'Performance e latencia',
    enabled: true,
    defaultCollapsed: true,
    section: 'advanced',
  },
  odHeatmap: {
    title: 'Mapa de calor OD (Top N)',
    enabled: true,
    defaultCollapsed: true,
    section: 'advanced',
    params: {
      initialTopN: 10,
    },
  },
  socialMultiples: {
    title: 'Multiplos paineis por classe',
    enabled: true,
    defaultCollapsed: true,
    section: 'advanced',
    params: {
      topN: 6,
    },
  },
  aggregateStacked: {
    title: 'Composicao social empilhada 100%',
    enabled: true,
    defaultCollapsed: true,
    section: 'advanced',
    params: {
      initialTopN: 12,
    },
  },
  aggregationScatter: {
    title: 'Validacao da agregacao',
    enabled: true,
    defaultCollapsed: true,
    section: 'advanced',
  },
  directionalBalance: {
    title: 'Saldo direcional por area agregada',
    enabled: true,
    defaultCollapsed: true,
    section: 'advanced',
    params: {
      topN: 15,
    },
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
  chartOrder: DEFAULT_DASHBOARD_CHART_ORDER,
};

const BUILTIN_DATASET_PROFILES: Record<string, DatasetProfileSource> = {
  uk_commuting_ons: {
    id: 'uk_commuting_ons',
    label: 'UK',
    description: 'Dataset legado do Reino Unido com fluxos MSOA/LTLA e cortes por classe social e idade.',
    sortOrder: 20,
    geography: {
      base: 'MSOA',
      aggregate: 'LTLA',
    },
    labels: {
      base: {
        singular: 'MSOA',
        plural: 'MSOAs',
        selectorTitle: 'Selecao por Area (MSOA)',
        selectedTitle: 'Area MSOA selecionada',
        helperText: 'Digite o codigo da area e pressione Enter para ver as conexoes de mobilidade.',
        inputPlaceholder: 'Digite o codigo da area (ex: E02000001)',
        modeLabel: 'Areas (MSOA)',
      },
      aggregate: {
        singular: 'LTLA',
        plural: 'LTLAs',
        selectorTitle: 'Selecao por Distrito',
        selectedTitle: 'Distrito selecionado',
        helperText: 'Digite o nome da cidade para visualizar os fluxos de mobilidade agregados por distrito.',
        searchPlaceholder: 'Buscar cidade... (ex: London, Manchester, Birmingham)',
        emptySearchTitle: 'Nenhum distrito encontrado',
        emptySearchHint: 'Tente buscar por London, Manchester ou Cardiff',
        modeLabel: 'Cidades (LTLA)',
      },
      analyticsEmptyTitle: 'Selecione uma area para ver os graficos',
      analyticsEmptyHint: 'Clique no mapa ou use a busca para selecionar uma localizacao',
      areaChipLabel: 'Area',
      levelChipLabel: 'Nivel',
      datasetActiveLabel: 'Conjunto de dados ativo',
    },
    mapView: {
      longitude: -1.5,
      latitude: 52.5,
      zoom: 6,
    },
    lookup: {
      baseCentroidsPath: '/data/lookup/areas_centroids.csv',
      aggregateCentroidsPath: '/data/lookup/ltla_centroids.csv',
      aggregateLookupPath: '/data/lookup/ltla_lookup.csv',
      baseBoundariesPath: '/data/lookup/boundaries.geojson',
      aggregateBoundariesPath: '/data/lookup/ltla_boundaries.geojson',
    },
    storage: {
      remoteBaseUrl: 'https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/',
      localProcessedBasePath: '/data/processed/',
    },
    baseFlowDataset: {
      fileName: 'ODWP01EW_MSOA.parquet',
      tableName: 'flows',
      required: true,
    },
    analyticsMode: 'uk-legacy',
    dashboard: {
      charts: {
        directionalBalance: {
          title: 'Saldo direcional por LTLA',
        },
      },
    },
    demographicDimensions: [
      {
        key: 'socialGrade',
        label: 'Classe social',
        categoryColumn: 'social_grade',
        codeColumn: 'social_grade_code',
        matchMode: 'contains',
        analyticsRole: 'socialGrade',
        allLabel: 'Todas as classes',
        dataset: {
          fileName: 'ODWP09EW_MSOA.parquet',
          tableName: 'flows_social_grade',
        },
        options: [
          { value: 'AB', label: 'AB - Profissionais de nivel superior e intermediario' },
          { value: 'C1', label: 'C1 - Supervisao e servicos administrativos' },
          { value: 'C2', label: 'C2 - Trabalho manual qualificado' },
          { value: 'DE', label: 'DE - Trabalho semiqualificado e nao qualificado' },
        ],
      },
      {
        key: 'age',
        label: 'Faixa etaria',
        categoryColumn: 'age_group',
        codeColumn: 'age_code',
        analyticsRole: 'age',
        allLabel: 'Todas as idades',
        dataset: {
          fileName: 'ODWP04EW_MSOA.parquet',
          tableName: 'flows_age',
        },
        options: [
          { value: 'Aged 16 to 24 years', label: '16-24 anos (jovens adultos)' },
          { value: 'Aged 25 to 34 years', label: '25-34 anos (jovens profissionais)' },
          { value: 'Aged 35 to 44 years', label: '35-44 anos (meio de carreira)' },
          { value: 'Aged 45 to 54 years', label: '45-54 anos (experientes)' },
          { value: 'Aged 55 to 64 years', label: '55-64 anos (pre-aposentadoria)' },
          { value: 'Aged 65 years and over', label: '65+ anos' },
        ],
      },
    ],
  },
  porto_alegre: {
    id: 'porto_alegre',
    label: 'Porto Alegre',
    description: 'Fluxos origem-destino por setor censitario e bairro, com cortes por idade e ocupacao.',
    sortOrder: 10,
    geography: {
      base: 'Setor Censitario',
      aggregate: 'Bairro',
    },
    labels: {
      base: {
        singular: 'Setor Censitario',
        plural: 'Setores Censitarios',
        selectorTitle: 'Selecao por Setor Censitario',
        selectedTitle: 'Setor Censitario selecionado',
        helperText: 'Digite o codigo do setor e pressione Enter para ver as conexoes de mobilidade.',
        inputPlaceholder: 'Digite o codigo do setor censitario',
        modeLabel: 'Setores Censitarios',
      },
      aggregate: {
        singular: 'Bairro',
        plural: 'Bairros',
        selectorTitle: 'Selecao por Bairro',
        selectedTitle: 'Bairro selecionado',
        helperText: 'Digite o nome do bairro para visualizar os fluxos de mobilidade no nivel agregado.',
        searchPlaceholder: 'Buscar bairro...',
        emptySearchTitle: 'Nenhum bairro encontrado',
        emptySearchHint: 'Tente buscar por nome ou codigo',
        modeLabel: 'Bairros',
      },
      analyticsEmptyTitle: 'Selecione uma area para ver os graficos',
      analyticsEmptyHint: 'Clique no mapa ou use a busca para selecionar uma unidade geografica',
      areaChipLabel: 'Area',
      levelChipLabel: 'Nivel',
      datasetActiveLabel: 'Conjunto de dados ativo',
    },
    mapView: {
      longitude: -51.23,
      latitude: -30.03,
      zoom: 10,
    },
    lookup: {
      baseCentroidsPath: '/data/porto_alegre/lookup/areas_centroids.csv',
      aggregateCentroidsPath: '/data/porto_alegre/lookup/aggregate_centroids.csv',
      aggregateLookupPath: '/data/porto_alegre/lookup/aggregate_lookup.csv',
      baseBoundariesPath: '/data/porto_alegre/lookup/boundaries.geojson',
      aggregateBoundariesPath: '/data/porto_alegre/lookup/aggregate_boundaries.geojson',
    },
    storage: {
      remoteBaseUrl: 'https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/public/data/porto_alegre/processed/',
      localProcessedBasePath: '/data/porto_alegre/processed/',
    },
    baseFlowDataset: {
      fileName: 'od_matrix_enumeration_area.parquet',
      tableName: 'flows',
      required: true,
    },
    analyticsMode: 'generic',
    dashboard: {
      genericAnalyticsHint:
        'Este dataset ja usa filtros configuraveis no mapa e no ranking. Para novos graficos, basta informar no JSON quais componentes existentes devem aparecer e quais titulos usar.',
      chartOrder: [
        'socialPie',
        'ageBar',
        'topFlows',
        'odHeatmap',
        'socialMultiples',
        'aggregateStacked',
        'directionalBalance',
      ],
      charts: {
        topFlows: {
          enabled: true,
          defaultCollapsed: false,
        },
        socialPie: {
          enabled: true,
          title: 'Distribuicao por ocupacao',
          defaultCollapsed: false,
          params: {
            dimensionKey: 'occupation',
          },
        },
        ageBar: {
          enabled: true,
          title: 'Distribuicao por faixa etaria',
          defaultCollapsed: false,
          params: {
            dimensionKey: 'age',
          },
        },
        performance: {
          enabled: false,
        },
        odHeatmap: {
          enabled: true,
          title: 'Mapa de calor OD por Bairro',
          defaultCollapsed: true,
        },
        socialMultiples: {
          enabled: true,
          title: 'Multiplos paineis por ocupacao',
          defaultCollapsed: true,
          params: {
            dimensionKey: 'occupation',
            topN: 6,
          },
        },
        aggregateStacked: {
          enabled: true,
          title: 'Composicao por ocupacao empilhada 100%',
          defaultCollapsed: true,
          params: {
            dimensionKey: 'occupation',
            initialTopN: 12,
          },
        },
        aggregationScatter: {
          enabled: false,
        },
        directionalBalance: {
          enabled: true,
          title: 'Saldo direcional por Bairro',
          defaultCollapsed: true,
        },
      },
    },
    demographicDimensions: [
      {
        key: 'age',
        label: 'Faixa etaria',
        categoryColumn: 'age_group',
        analyticsRole: 'age',
        allLabel: 'Todas as idades',
        dataset: {
          fileName: 'od_matrix_enumeration_area_age.parquet',
          tableName: 'flows_age',
        },
        options: [
          { value: 'children', label: 'Criancas' },
          { value: 'youngs', label: 'Jovens' },
          { value: 'adults', label: 'Adultos' },
          { value: 'elders', label: 'Idosos' },
        ],
      },
      {
        key: 'occupation',
        label: 'Ocupacao',
        categoryColumn: 'occupation',
        allLabel: 'Todas as ocupacoes',
        dataset: {
          fileName: 'od_matrix_enumeration_area_occupation.parquet',
          tableName: 'flows_occupation',
        },
        options: [
          { value: 'student', label: 'Estudante' },
          { value: 'worker', label: 'Trabalhador' },
          { value: 'other', label: 'Outros' },
        ],
      },
    ],
  },
};

const datasetProfileModules = import.meta.glob('../dataset-configs/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, DatasetProfileSource>;

const importedDatasetProfilesById = Object.values(datasetProfileModules).reduce(
  (accumulator, profile) => {
    accumulator[profile.id] = profile;
    return accumulator;
  },
  {} as Record<string, DatasetProfileSource>
);

if (import.meta.env.DEV && Object.keys(importedDatasetProfilesById).length === 0 && typeof console !== 'undefined') {
  console.warn(
    '[datasetProfiles] Nenhum perfil JSON foi carregado em src/dataset-configs. Usando perfis embutidos; verifique se os arquivos foram commitados antes do deploy.'
  );
}

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

  const requestedChartOrder = profile.dashboard?.chartOrder;
  const normalizedChartOrder =
    requestedChartOrder && requestedChartOrder.length > 0
      ? requestedChartOrder.filter(
          (chartId, index, chartIds): chartId is DatasetChartId =>
            chartId in DEFAULT_DASHBOARD_CHARTS && chartIds.indexOf(chartId) === index
        )
      : DEFAULT_DASHBOARD_CHART_ORDER;

  return {
    ...profile,
    dashboard: {
      ...DEFAULT_DASHBOARD_CONFIG,
      ...profile.dashboard,
      directionValues: {
        ...DEFAULT_DASHBOARD_CONFIG.directionValues,
        ...(profile.dashboard?.directionValues ?? {}),
      },
      chartOrder: normalizedChartOrder.length > 0 ? normalizedChartOrder : DEFAULT_DASHBOARD_CHART_ORDER,
      charts: normalizedCharts,
    },
  };
}

export const DATASET_PROFILES: Record<string, DatasetProfile> = Object.values({
  ...BUILTIN_DATASET_PROFILES,
  ...importedDatasetProfilesById,
}).reduce(
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
