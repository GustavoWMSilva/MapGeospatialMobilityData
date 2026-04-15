import * as React from 'react';
import { useRef, useCallback, useEffect } from 'react';
import type { MapRef } from '@vis.gl/react-maplibre';

// Components
import { InteractiveMap } from './components/InteractiveMap';
import { AreaSelectionControls } from './components/AreaSelectionControls';
import { AggregateAreaSelector } from './components/AggregateAreaSelector';
import { CacheDebugPanel } from './components/CacheDebugPanel';
import { AnalyticsDashboard } from './components/analytics';
import { AnalyticsFilters } from './components/analytics/AnalyticsFilters';

// Hooks
import { useSelectedArea } from './hooks/useSelectedArea';
import {
  ACTIVE_DATASET_PROFILE,
  buildDatasetSwitchUrl,
  createInitialDemographicFilters,
  getActiveDatasetId,
  getDatasetToggleOptions,
  persistActiveDataset,
} from './constants/datasetProfiles';

// Constants & Types
import type { DemographicFilters, GeographyLevel, ViewState } from './types';

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: ACTIVE_DATASET_PROFILE.mapView.longitude,
  latitude: ACTIVE_DATASET_PROFILE.mapView.latitude,
  zoom: ACTIVE_DATASET_PROFILE.mapView.zoom,
};

const DATASET_TOGGLE_OPTIONS = getDatasetToggleOptions();

interface MapClickEvent {
  lngLat: { lng: number; lat: number };
  features?: Array<{
    layer: { id: string };
    properties: Record<string, unknown>;
  }>;
}

export default function App() {
  const activeDatasetId = getActiveDatasetId();
  const [viewState, setViewState] = React.useState<ViewState>(DEFAULT_VIEW_STATE);
  const [mobilityDataSource] = React.useState<'general' | 'london'>('general');
  const [showBasePoints, setShowBasePoints] = React.useState(false);
  const [showAggregateAreas, setShowAggregateAreas] = React.useState(true);
  const [selectedAggregateAreaCode, setSelectedAggregateAreaCode] = React.useState<string | null>(null);
  const [selectedAggregateAreaName, setSelectedAggregateAreaName] = React.useState<string>('');
  const [selectedBaseAreaName, setSelectedBaseAreaName] = React.useState<string>('');
  const [geographyLevel, setGeographyLevel] = React.useState<GeographyLevel>('aggregate');
  const [flowDirection, setFlowDirection] = React.useState<'incoming' | 'outgoing'>('incoming');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [includeInternalFlows, setIncludeInternalFlows] = React.useState(false);

  // Filtros demograficos (compartilhados entre Dashboard e Mapa)
  const [demographicFilters, setDemographicFilters] = React.useState<DemographicFilters>(() =>
    createInitialDemographicFilters(ACTIVE_DATASET_PROFILE)
  );

  const mapRef = useRef<MapRef>(null);

  // Pre-inicializar DuckDB para evitar delay na primeira selecao
  useEffect(() => {
    const preinitDB = async () => {
      try {
        const { initDuckDB } = await import('./utils/duckdb');
        console.log('Pre-inicializando DuckDB...');
        await initDuckDB();
        console.log('DuckDB pre-inicializado!');
      } catch (err) {
        console.warn('Erro ao pre-inicializar DuckDB:', err);
      }
    };
    preinitDB();
  }, []);

  useEffect(() => {
    setDemographicFilters(createInitialDemographicFilters(ACTIVE_DATASET_PROFILE));
  }, []);

  // Hooks
  const {
    selectedAreaCode: selectedBaseAreaCode,
    selectArea: selectBaseArea,
    clearSelection: clearBaseSelection,
  } = useSelectedArea();

  const onMove = useCallback(({ viewState: newViewState }: { viewState: ViewState }) => {
    setViewState(newViewState);
  }, []);

  const handleDatasetChange = useCallback((datasetId: string) => {
    if (datasetId === activeDatasetId) {
      return;
    }

    persistActiveDataset(datasetId);
    window.location.assign(buildDatasetSwitchUrl(datasetId));
  }, [activeDatasetId]);

  const activateAggregateLevel = useCallback(() => {
    setGeographyLevel('aggregate');
    setShowBasePoints(false);
    setShowAggregateAreas(true);
    selectBaseArea(null);
    setSelectedBaseAreaName('');
  }, [selectBaseArea]);

  const activateBaseLevel = useCallback(() => {
    setGeographyLevel('base');
    setShowBasePoints(true);
    setShowAggregateAreas(false);
    setSelectedAggregateAreaCode(null);
    setSelectedAggregateAreaName('');
  }, []);

  const toggleGeographyLevel = useCallback(() => {
    if (geographyLevel === 'aggregate') {
      activateBaseLevel();
      return;
    }

    activateAggregateLevel();
  }, [activateAggregateLevel, activateBaseLevel, geographyLevel]);

  const handleMapClick = useCallback((event: MapClickEvent) => {
    const { lng, lat } = event.lngLat;

    // Tentar detectar features no ponto clicado
    if (mapRef.current && event.features && event.features.length > 0) {
      const feature = event.features[0];

      // Seleção de área agregada
      if (
        feature.layer.id === 'aggregate-area-points-layer' ||
        feature.layer.id === 'ltla-heatmap-circles' ||
        feature.layer.id === 'aggregate-area-points-selected'
      ) {
        const aggregateAreaCode = String(feature.properties.code || '');
        const aggregateAreaName = String(feature.properties.name || '');
        console.log(
          `${ACTIVE_DATASET_PROFILE.labels.aggregate.singular} selecionado:`,
          aggregateAreaName,
          aggregateAreaCode
        );
        setSelectedAggregateAreaCode(aggregateAreaCode);
        setSelectedAggregateAreaName(aggregateAreaName);
        selectBaseArea(null);
        setSelectedBaseAreaName('');
        return;
      }

      if (feature.layer.id === 'aggregate-boundaries-clickable') {
        const aggregateAreaCode = String(feature.properties.ltla_code || feature.properties.code || '');
        const aggregateAreaName = String(feature.properties.ltla_name || feature.properties.name || '');
        console.log(
          `Limite de ${ACTIVE_DATASET_PROFILE.labels.aggregate.singular} clicado:`,
          aggregateAreaName,
          aggregateAreaCode
        );
        setSelectedAggregateAreaCode(aggregateAreaCode);
        setSelectedAggregateAreaName(aggregateAreaName);
        selectBaseArea(null);
        setSelectedBaseAreaName('');
        return;
      }

      // Seleção de área base
      if (feature.layer.id === 'all-area-points-layer') {
        const baseAreaCode = String(feature.properties.code || '');
        const baseAreaName = String(feature.properties.name || '');
        console.log(
          `${ACTIVE_DATASET_PROFILE.labels.base.singular} selecionada:`,
          baseAreaName,
          baseAreaCode
        );
        selectBaseArea(baseAreaCode);
        setSelectedBaseAreaName(baseAreaName);
        setSelectedAggregateAreaCode(null);
        setSelectedAggregateAreaName('');
        return;
      }

      if (feature.layer.id === 'base-boundaries-clickable') {
        const baseAreaCode = String(
          feature.properties.MSOA21CD ||
          feature.properties.msoa_code ||
          feature.properties.code ||
          ''
        );
        const baseAreaName = String(feature.properties.MSOA21NM || feature.properties.name || '');
        console.log(
          `Limite de ${ACTIVE_DATASET_PROFILE.labels.base.singular} clicado:`,
          baseAreaName,
          baseAreaCode
        );
        selectBaseArea(baseAreaCode);
        setSelectedBaseAreaName(baseAreaName);
        setSelectedAggregateAreaCode(null);
        setSelectedAggregateAreaName('');
        return;
      }
    }

    // Se nao clicou em nenhuma feature, apenas registra o ponto (comportamento antigo)
    console.log('Clicou em:', { longitude: lng, latitude: lat });
    // addPoint(lng, lat); // Comentado para nao adicionar marcador
  }, [mapRef, selectBaseArea]);

  const selectedArea =
    geographyLevel === 'aggregate'
      ? (selectedAggregateAreaCode || undefined)
      : (selectedBaseAreaCode || undefined);
  const selectedAreaName =
    geographyLevel === 'aggregate'
      ? selectedAggregateAreaName
      : selectedBaseAreaName;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 50%, #f3e8ff 100%)' }}>
      {/* Header */}
      {!isFullscreen && (
      <div className="border-b border-purple-200 bg-gradient-to-r from-purple-700 via-purple-700 to-purple-800 shadow-sm">
        <div className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Visualização de Mobilidade Geoespacial
          </h1>
          <p className="mt-1 text-sm text-purple-100">
            {ACTIVE_DATASET_PROFILE.description}
          </p>
          </div>

          <div className="rounded-2xl border border-purple-300/40 bg-white/10 p-2 backdrop-blur-sm">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-100">
              Base de dados
            </div>
            <div className="flex flex-wrap gap-2">
              {DATASET_TOGGLE_OPTIONS.map((option) => {
                const isActive = option.id === activeDatasetId;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleDatasetChange(option.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-white text-purple-800 shadow-lg'
                        : 'bg-purple-900/20 text-white hover:bg-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {!isFullscreen && (
      <div className="px-6 pb-6 pt-4">
        {/* Barra superior: busca da cidade + Analytics Filters (acima dos gráficos) */}
        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(420px,1fr)_minmax(0,1.25fr)]">
          <div>
            <div className="mb-3 rounded-xl border border-purple-100 bg-white p-2.5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">Controles:</div>
                <button
                  onClick={toggleGeographyLevel}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors sm:text-xs ${
                    geographyLevel === 'aggregate'
                      ? 'border-purple-700 bg-purple-700 text-white hover:bg-purple-800'
                      : 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100'
                  }`}
                >
                  {geographyLevel === 'aggregate'
                    ? ACTIVE_DATASET_PROFILE.labels.aggregate.modeLabel
                    : ACTIVE_DATASET_PROFILE.labels.base.modeLabel}
                </button>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="rounded-md border border-purple-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-purple-800 transition-colors hover:bg-purple-50 sm:text-xs"
                  title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                >
                  Tela Cheia
                </button>
              </div>
            </div>
            {geographyLevel === 'aggregate' ? (
              <AggregateAreaSelector
                selectedAggregateAreaCode={selectedAggregateAreaCode}
                onSelectAggregateArea={(aggregateAreaCode, aggregateAreaName) => {
                  setSelectedAggregateAreaCode(aggregateAreaCode);
                  setSelectedAggregateAreaName(aggregateAreaName);
                  selectBaseArea(null);
                  setSelectedBaseAreaName('');
                }}
                onClearSelection={() => {
                  setSelectedAggregateAreaCode(null);
                  setSelectedAggregateAreaName('');
                }}
              />
            ) : (
              <AreaSelectionControls
                selectedAreaCode={selectedBaseAreaCode}
                onSelectArea={(code) => {
                  selectBaseArea(code);
                  setSelectedBaseAreaName('');
                  setSelectedAggregateAreaCode(null);
                  setSelectedAggregateAreaName('');
                }}
                onClearSelection={() => {
                  clearBaseSelection();
                  setSelectedBaseAreaName('');
                }}
              />
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-purple-100 bg-white p-3 shadow-sm">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-purple-800">
              Filtros dos Gráficos
            </p>

            <div className="rounded-lg border border-purple-100 bg-purple-50/60 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
                {ACTIVE_DATASET_PROFILE.labels.datasetActiveLabel}
              </p>
              <p className="text-sm font-semibold text-purple-950">{ACTIVE_DATASET_PROFILE.label}</p>
              <p className="text-[11px] text-purple-700">{ACTIVE_DATASET_PROFILE.description}</p>
            </div>

            <AnalyticsFilters
              datasetProfile={ACTIVE_DATASET_PROFILE}
              filters={demographicFilters}
              direction={flowDirection}
              compact
              onFiltersChange={setDemographicFilters}
              onDirectionChange={setFlowDirection}
            />

            <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-2.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInternalFlows}
                  onChange={(e) => setIncludeInternalFlows(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-purple-600"
                />
                <div>
                  <p className="text-xs font-medium text-gray-800">Incluir fluxo interno (origem = destino)</p>
                  <p className="text-[11px] text-gray-600">Quando desativado, os gráficos ignoram fluxos dentro da mesma área.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(480px,1fr)]">
          <div className="self-start xl:sticky xl:top-6">
            <InteractiveMap
              mapRef={mapRef}
              viewState={viewState}
              points={[]}
              onMove={onMove}
              onClick={handleMapClick}
              onFlyToPoint={() => {}}
              mobilityDataSource={mobilityDataSource}
              selectedBaseAreaCode={selectedBaseAreaCode}
              showBasePoints={showBasePoints}
              showAggregateAreas={showAggregateAreas}
              selectedAggregateAreaCode={selectedAggregateAreaCode}
              flowDirection={flowDirection}
              isFullscreen={false}
              geographyLevel={geographyLevel}
              datasetProfile={ACTIVE_DATASET_PROFILE}
              demographicFilters={demographicFilters}
              includeInternalFlows={includeInternalFlows}
              onIncludeInternalFlowsChange={setIncludeInternalFlows}
            />
          </div>

          <div className="space-y-5 xl:h-[calc(100vh-8.5rem)] xl:overflow-y-auto xl:pr-2">
            <AnalyticsDashboard
              selectedArea={selectedArea}
              areaName={selectedAreaName}
              geographyLevel={geographyLevel}
              datasetProfile={ACTIVE_DATASET_PROFILE}
              demographicFilters={demographicFilters}
              direction={flowDirection}
              includeInternalFlows={includeInternalFlows}
              showTopControls={false}
              onDemographicFiltersChange={setDemographicFilters}
              onDirectionChange={setFlowDirection}
              onIncludeInternalFlowsChange={setIncludeInternalFlows}
            />
          </div>
        </div>
      </div>
      )}

      {isFullscreen && (
      <div className="fixed inset-0 z-50">
        <InteractiveMap
          mapRef={mapRef}
          viewState={viewState}
          points={[]}
          onMove={onMove}
          onClick={handleMapClick}
          onFlyToPoint={() => {}}
          mobilityDataSource={mobilityDataSource}
          selectedBaseAreaCode={selectedBaseAreaCode}
          showBasePoints={showBasePoints}
          showAggregateAreas={showAggregateAreas}
          selectedAggregateAreaCode={selectedAggregateAreaCode}
          flowDirection={flowDirection}
          isFullscreen
          geographyLevel={geographyLevel}
          datasetProfile={ACTIVE_DATASET_PROFILE}
          demographicFilters={demographicFilters}
          includeInternalFlows={includeInternalFlows}
          onIncludeInternalFlowsChange={setIncludeInternalFlows}
        />

        {/* Controles flutuantes no modo fullscreen */}
        <>
          {/* Botao de sair da tela cheia */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg font-bold transition-all shadow-2xl bg-gradient-to-r from-purple-600 to-purple-700 text-white border-2 border-white hover:from-purple-700 hover:to-purple-800 hover:scale-105"
            title="Sair da tela cheia"
          >
            Sair da Tela Cheia
          </button>

          {/* Painel de controles flutuante */}
          <div className="fixed top-4 left-4 z-[60] flex flex-col gap-3">
            {/* Botao de alternar modo */}
            <button
              onClick={toggleGeographyLevel}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all shadow-2xl transform hover:scale-105 border-2 border-white ${
                geographyLevel === 'aggregate'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
              }`}
            >
              {geographyLevel === 'aggregate'
                ? `Modo: ${ACTIVE_DATASET_PROFILE.labels.aggregate.modeLabel}`
                : `Modo: ${ACTIVE_DATASET_PROFILE.labels.base.modeLabel}`}
            </button>

            <div className="rounded-xl border-2 border-white bg-white/90 p-2 shadow-2xl backdrop-blur-sm">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                Base de dados
              </div>
              <div className="flex gap-2">
                {DATASET_TOGGLE_OPTIONS.map((option) => {
                  const isActive = option.id === activeDatasetId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleDatasetChange(option.id)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-purple-700 text-white'
                          : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      </div>
      )}

      {/* Painel de Debug do Cache */}
      <CacheDebugPanel />
    </main>
  );
}
