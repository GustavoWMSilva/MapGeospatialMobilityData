export interface Location {
  name: string;
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface Point {
  lng: number;
  lat: number;
}

export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export type GeographyLevel = 'base' | 'aggregate';
export type DemographicFilters = Record<string, string>;
export type MobilityIntensityMetric = 'total' | 'incoming' | 'outgoing' | 'balance';
export type DimensionMatchMode = 'equals' | 'contains';
export type DatasetAnalyticsMode = 'uk-legacy' | 'generic';
export type DatasetChartId =
  | 'socialPie'
  | 'ageBar'
  | 'topFlows'
  | 'performance'
  | 'odHeatmap'
  | 'socialMultiples'
  | 'aggregateStacked'
  | 'aggregationScatter'
  | 'directionalBalance';

export interface DatasetParquetConfig {
  fileName: string;
  tableName: string;
  required?: boolean;
}

export interface DatasetStorageConfig {
  remoteBaseUrl?: string;
  localProcessedBasePath: string;
}

export interface DemographicDimensionOption {
  value: string;
  label: string;
  description?: string;
}

export interface DemographicDimensionConfig {
  key: string;
  label: string;
  categoryColumn: string;
  codeColumn?: string;
  matchMode?: DimensionMatchMode;
  analyticsRole?: 'socialGrade' | 'age';
  dataset: DatasetParquetConfig;
  allLabel?: string;
  options: DemographicDimensionOption[];
}

export interface DatasetUnitLabels {
  singular: string;
  plural: string;
  selectorTitle: string;
  selectedTitle: string;
  helperText: string;
  inputPlaceholder?: string;
  searchPlaceholder?: string;
  emptySearchTitle?: string;
  emptySearchHint?: string;
  modeLabel: string;
}

export interface DatasetLabels {
  base: DatasetUnitLabels;
  aggregate: DatasetUnitLabels;
  analyticsEmptyTitle: string;
  analyticsEmptyHint: string;
  areaChipLabel: string;
  levelChipLabel: string;
  datasetActiveLabel: string;
}

export interface DatasetChartConfig {
  title: string;
  enabled?: boolean;
  defaultCollapsed?: boolean;
  section?: 'main' | 'advanced';
  params?: {
    dimensionKey?: string;
    referencePath?: string;
    aggregateCodePattern?: string;
    topN?: number;
    initialTopN?: number;
  };
}

export interface DatasetDashboardConfig {
  panelTitle: string;
  panelSubtitle: string;
  mainChartsTitle: string;
  mainChartsSubtitle: string;
  directionLabel: string;
  directionValues: {
    incoming: string;
    outgoing: string;
  };
  includeInternalFlowsLabel: string;
  includeInternalFlowsHint: string;
  genericAnalyticsHint: string;
  advancedChartsShowLabel: string;
  advancedChartsHideLabel: string;
  chartOrder: DatasetChartId[];
  charts: Record<DatasetChartId, DatasetChartConfig>;
}

export interface DatasetProfile {
  id: string;
  label: string;
  description: string;
  sortOrder?: number;
  geography: {
    base: string;
    aggregate?: string;
  };
  mapView: ViewState;
  labels: DatasetLabels;
  lookup: {
    baseCentroidsPath: string;
    aggregateCentroidsPath: string;
    aggregateLookupPath: string;
    baseBoundariesPath: string;
    aggregateBoundariesPath: string;
  };
  storage: DatasetStorageConfig;
  baseFlowDataset: DatasetParquetConfig;
  analyticsMode: DatasetAnalyticsMode;
  dashboard: DatasetDashboardConfig;
  demographicDimensions: DemographicDimensionConfig[];
}

// Flow Data Types
export interface FlowResult {
  origin_code: string;
  dest_code: string;
  count: number;
}

export interface SocialGradeFlowResult extends FlowResult {
  social_grade_code: number;
  social_grade: string;
}

export interface AgeFlowResult extends FlowResult {
  age_code: number;
  age_group: string;
}

export interface CombinedDemographicFlowResult extends FlowResult {
  social_count: number;
  age_count: number;
}

export interface SocialGradeStats {
  grade: string;
  total: number;
  percentage: number;
}

export interface AgeStats {
  ageGroup: string;
  total: number;
  percentage: number;
}

export type SocialGrade = 'AB' | 'C1' | 'C2' | 'DE' | 'all';
export type AgeGroup = 
  | 'Aged 16 to 24 years'
  | 'Aged 25 to 34 years' 
  | 'Aged 35 to 44 years'
  | 'Aged 45 to 54 years'
  | 'Aged 55 to 64 years'
  | 'Aged 65 years and over'
  | 'all';
