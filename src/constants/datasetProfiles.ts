import type {
  DatasetProfile,
  DemographicFilters,
  DemographicDimensionConfig,
  GeographyLevel,
} from '../types';

const DEFAULT_FILTER_VALUE = 'all';

export const DATASET_PROFILES: Record<string, DatasetProfile> = {
  uk_commuting_ons: {
    id: 'uk_commuting_ons',
    label: 'UK ONS Commuting',
    description: 'Dataset legado do Reino Unido com fluxos MSOA/LTLA e cortes por classe social e idade.',
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
      analyticsEmptyTitle: 'Select an Area to View Analytics',
      analyticsEmptyHint: 'Click on the map or use the search to select a location',
      areaChipLabel: 'Area',
      levelChipLabel: 'Nivel',
      datasetActiveLabel: 'Dataset ativo',
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
    demographicDimensions: [
      {
        key: 'socialGrade',
        label: 'Social Grade',
        categoryColumn: 'social_grade',
        codeColumn: 'social_grade_code',
        matchMode: 'contains',
        analyticsRole: 'socialGrade',
        allLabel: 'All Classes',
        dataset: {
          fileName: 'ODWP09EW_MSOA.parquet',
          tableName: 'flows_social_grade',
        },
        options: [
          { value: 'AB', label: 'AB - Higher & Intermediate Professional' },
          { value: 'C1', label: 'C1 - Supervisory & Clerical' },
          { value: 'C2', label: 'C2 - Skilled Manual' },
          { value: 'DE', label: 'DE - Semi-skilled & Unskilled' },
        ],
      },
      {
        key: 'age',
        label: 'Age Group',
        categoryColumn: 'age_group',
        codeColumn: 'age_code',
        analyticsRole: 'age',
        allLabel: 'All Ages',
        dataset: {
          fileName: 'ODWP04EW_MSOA.parquet',
          tableName: 'flows_age',
        },
        options: [
          { value: 'Aged 16 to 24 years', label: '16-24 years (Young Adults)' },
          { value: 'Aged 25 to 34 years', label: '25-34 years (Young Professionals)' },
          { value: 'Aged 35 to 44 years', label: '35-44 years (Mid-career)' },
          { value: 'Aged 45 to 54 years', label: '45-54 years (Experienced)' },
          { value: 'Aged 55 to 64 years', label: '55-64 years (Pre-retirement)' },
          { value: 'Aged 65 years and over', label: '65+ years (Retirement age)' },
        ],
      },
    ],
  },
  porto_alegre: {
    id: 'porto_alegre',
    label: 'Porto Alegre OD',
    description: 'Fluxos origem-destino por setor censitario e bairro, com cortes por idade e ocupacao.',
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
      datasetActiveLabel: 'Dataset ativo',
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
    demographicDimensions: [
      {
        key: 'age',
        label: 'Age Group',
        categoryColumn: 'age_group',
        analyticsRole: 'age',
        allLabel: 'All Ages',
        dataset: {
          fileName: 'od_matrix_enumeration_area_age.parquet',
          tableName: 'flows_age',
        },
        options: [
          { value: 'children', label: 'Children' },
          { value: 'youngs', label: 'Youngs' },
          { value: 'adults', label: 'Adults' },
          { value: 'elders', label: 'Elders' },
        ],
      },
      {
        key: 'occupation',
        label: 'Occupation',
        categoryColumn: 'occupation',
        allLabel: 'All Occupations',
        dataset: {
          fileName: 'od_matrix_enumeration_area_occupation.parquet',
          tableName: 'flows_occupation',
        },
        options: [
          { value: 'student', label: 'Student' },
          { value: 'worker', label: 'Worker' },
          { value: 'other', label: 'Other' },
        ],
      },
    ],
  },
};

export const DEFAULT_DATASET_ID = 'uk_commuting_ons';

export const ACTIVE_DATASET_PROFILE =
  DATASET_PROFILES[import.meta.env.VITE_ACTIVE_DATASET as string] ||
  DATASET_PROFILES[DEFAULT_DATASET_ID];

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
