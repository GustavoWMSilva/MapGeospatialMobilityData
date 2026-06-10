import * as React from 'react';
import { useRef, useCallback, useEffect } from 'react';
import type { MapRef } from '@vis.gl/react-maplibre';

import { InteractiveMap } from './components/InteractiveMap';
import { AreaSelectionControls } from './components/AreaSelectionControls';
import { AggregateAreaSelector } from './components/AggregateAreaSelector';
import { CacheDebugPanel } from './components/CacheDebugPanel';
import { AnalyticsDashboard } from './components/analytics';
import { AnalyticsFilters } from './components/analytics/AnalyticsFilters';
import { useSelectedArea } from './hooks/useSelectedArea';
import {
  ACTIVE_DATASET_PROFILE,
  buildDatasetSwitchUrl,
  createInitialDemographicFilters,
  getActiveDatasetId,
  getDatasetToggleOptions,
  persistActiveDataset,
} from './constants/datasetProfiles';
import type { DemographicFilters, GeographyLevel, MobilityIntensityMetric, ViewState } from './types';

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: ACTIVE_DATASET_PROFILE.mapView.longitude,
  latitude: ACTIVE_DATASET_PROFILE.mapView.latitude,
  zoom: ACTIVE_DATASET_PROFILE.mapView.zoom,
};

const DATASET_TOGGLE_OPTIONS = getDatasetToggleOptions();
const SHORTCUTS = [
  { key: 'S', description: 'Focar busca/selecionar area' },
  { key: 'G', description: 'Alternar nivel geografico' },
  { key: 'D', description: 'Alternar direcao entrada/saida' },
  { key: 'I', description: 'Incluir/remover fluxos internos' },
  { key: 'H', description: 'Ativar/desativar mapa de calor' },
  { key: 'M', description: 'Alternar tela cheia do mapa' },
  { key: 'C', description: 'Limpar selecao atual' },
  { key: 'F', description: 'Minimizar/expandir painel de fluxos' },
  { key: 'R', description: 'Resetar filtros demograficos' },
  { key: '?', description: 'Mostrar/ocultar esta ajuda' },
] as const;

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'SELECT' ||
    target.tagName === 'TEXTAREA'
  );
}

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
  const [selectedAggregateAreaName, setSelectedAggregateAreaName] = React.useState('');
  const [selectedBaseAreaName, setSelectedBaseAreaName] = React.useState('');
  const [geographyLevel, setGeographyLevel] = React.useState<GeographyLevel>('aggregate');
  const [flowDirection, setFlowDirection] = React.useState<'incoming' | 'outgoing'>('incoming');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [includeInternalFlows, setIncludeInternalFlows] = React.useState(false);
  const [showMobilityIntensity, setShowMobilityIntensity] = React.useState(false);
  const [mobilityIntensityMetric, setMobilityIntensityMetric] = React.useState<MobilityIntensityMetric>('total');
  const [showShortcutsHelp, setShowShortcutsHelp] = React.useState(false);
  const [demographicFilters, setDemographicFilters] = React.useState<DemographicFilters>(() =>
    createInitialDemographicFilters(ACTIVE_DATASET_PROFILE)
  );

  const mapRef = useRef<MapRef>(null);
  const aggregateAreaSearchRef = useRef<HTMLInputElement | null>(null);
  const baseAreaSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const preinitDB = async () => {
      try {
        const { initDuckDB, warmUpDuckDB } = await import('./utils/duckdb');
        await initDuckDB();
        await warmUpDuckDB();
      } catch (err) {
        console.warn('Erro ao pre-inicializar DuckDB:', err);
      }
    };

    void preinitDB();
  }, []);

  useEffect(() => {
    setDemographicFilters(createInitialDemographicFilters(ACTIVE_DATASET_PROFILE));
  }, []);

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

  const focusCurrentAreaSearch = useCallback(() => {
    const focusInput = () => {
      const input = geographyLevel === 'aggregate'
        ? aggregateAreaSearchRef.current
        : baseAreaSearchRef.current;

      input?.focus();
      input?.select();
    };

    if (isFullscreen) {
      setIsFullscreen(false);
      window.setTimeout(focusInput, 50);
      return;
    }

    focusInput();
  }, [geographyLevel, isFullscreen]);

  const clearCurrentSelection = useCallback(() => {
    if (geographyLevel === 'aggregate') {
      setSelectedAggregateAreaCode(null);
      setSelectedAggregateAreaName('');
      return;
    }

    clearBaseSelection();
    setSelectedBaseAreaName('');
  }, [clearBaseSelection, geographyLevel]);

  const resetDemographicFilters = useCallback(() => {
    setDemographicFilters(createInitialDemographicFilters(ACTIVE_DATASET_PROFILE));
  }, []);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isEditableShortcutTarget(event.target)) {
        return;
      }

      const key = event.key === '?' ? '?' : event.key.toLowerCase();
      let handled = true;

      if (event.repeat && key !== '?') {
        return;
      }

      switch (key) {
        case 's':
          focusCurrentAreaSearch();
          break;
        case 'g':
          toggleGeographyLevel();
          break;
        case 'd':
          setFlowDirection((current) => (current === 'incoming' ? 'outgoing' : 'incoming'));
          break;
        case 'i':
          setIncludeInternalFlows((current) => !current);
          break;
        case 'h':
          setShowMobilityIntensity((current) => !current);
          break;
        case 'm':
          setIsFullscreen((current) => !current);
          break;
        case 'c':
          clearCurrentSelection();
          break;
        case 'f':
          window.dispatchEvent(new Event('mobility:toggle-flow-filters'));
          break;
        case 'r':
          resetDemographicFilters();
          break;
        case '?':
          setShowShortcutsHelp((current) => !current);
          break;
        case 'escape':
          if (showShortcutsHelp) {
            setShowShortcutsHelp(false);
          } else if (isFullscreen) {
            setIsFullscreen(false);
          } else {
            handled = false;
          }
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);

    return () => {
      window.removeEventListener('keydown', handleGlobalShortcut);
    };
  }, [
    clearCurrentSelection,
    focusCurrentAreaSearch,
    isFullscreen,
    resetDemographicFilters,
    showShortcutsHelp,
    toggleGeographyLevel,
  ]);

  const handleMapClick = useCallback((event: MapClickEvent) => {
    if (mapRef.current && event.features && event.features.length > 0) {
      const feature = event.features[0];

      if (
        feature.layer.id === 'aggregate-area-points-layer' ||
        feature.layer.id === 'ltla-heatmap-circles' ||
        feature.layer.id === 'aggregate-area-points-selected'
      ) {
        const aggregateAreaCode = String(feature.properties.code || '');
        const aggregateAreaName = String(feature.properties.name || '');
        setSelectedAggregateAreaCode(aggregateAreaCode);
        setSelectedAggregateAreaName(aggregateAreaName);
        selectBaseArea(null);
        setSelectedBaseAreaName('');
        return;
      }

      if (feature.layer.id === 'aggregate-boundaries-clickable') {
        const aggregateAreaCode = String(feature.properties.ltla_code || feature.properties.code || '');
        const aggregateAreaName = String(feature.properties.ltla_name || feature.properties.name || '');
        setSelectedAggregateAreaCode(aggregateAreaCode);
        setSelectedAggregateAreaName(aggregateAreaName);
        selectBaseArea(null);
        setSelectedBaseAreaName('');
        return;
      }

      if (feature.layer.id === 'all-area-points-layer') {
        const baseAreaCode = String(feature.properties.code || '');
        const baseAreaName = String(feature.properties.name || '');
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
        selectBaseArea(baseAreaCode);
        setSelectedBaseAreaName(baseAreaName);
        setSelectedAggregateAreaCode(null);
        setSelectedAggregateAreaName('');
        return;
      }
    }
  }, [selectBaseArea]);

  const selectedArea =
    geographyLevel === 'aggregate'
      ? (selectedAggregateAreaCode || undefined)
      : (selectedBaseAreaCode || undefined);
  const selectedAreaName =
    geographyLevel === 'aggregate'
      ? selectedAggregateAreaName
      : selectedBaseAreaName;
  const selectedUnitLabel =
    geographyLevel === 'aggregate'
      ? ACTIVE_DATASET_PROFILE.labels.aggregate.singular
      : ACTIVE_DATASET_PROFILE.labels.base.singular;

  const map = (
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
      isFullscreen={isFullscreen}
      geographyLevel={geographyLevel}
      datasetProfile={ACTIVE_DATASET_PROFILE}
      demographicFilters={demographicFilters}
      includeInternalFlows={includeInternalFlows}
      showMobilityIntensity={showMobilityIntensity}
      mobilityIntensityMetric={mobilityIntensityMetric}
      onIncludeInternalFlowsChange={setIncludeInternalFlows}
    />
  );

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      {!isFullscreen && (
        <div className="flex h-full min-w-[1180px] flex-col overflow-hidden">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950">
                Visualizacao de Mobilidade Geoespacial
              </h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-500">
                {ACTIVE_DATASET_PROFILE.description}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right lg:block">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {ACTIVE_DATASET_PROFILE.labels.datasetActiveLabel}
                </p>
                <p className="text-sm font-semibold text-slate-900">{ACTIVE_DATASET_PROFILE.label}</p>
              </div>

              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {DATASET_TOGGLE_OPTIONS.map((option) => {
                  const isActive = option.id === activeDatasetId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleDatasetChange(option.id)}
                      className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-slate-950 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white hover:text-slate-950'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(520px,1fr)_400px] gap-4 p-4">
            <aside className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Explorar</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">Selecionar area</h2>
              </div>

              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={activateAggregateLevel}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                      geographyLevel === 'aggregate'
                        ? 'bg-slate-950 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {ACTIVE_DATASET_PROFILE.labels.aggregate.modeLabel}
                  </button>
                  <button
                    type="button"
                    onClick={activateBaseLevel}
                    className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                      geographyLevel === 'base'
                        ? 'bg-slate-950 text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {ACTIVE_DATASET_PROFILE.labels.base.modeLabel}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Tela cheia
                </button>
              </div>

              <div className="space-y-4">
                {geographyLevel === 'aggregate' ? (
                  <AggregateAreaSelector
                    selectedAggregateAreaCode={selectedAggregateAreaCode}
                    searchInputRef={aggregateAreaSearchRef}
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
                    searchInputRef={baseAreaSearchRef}
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

                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Filtros</p>
                    <h3 className="text-sm font-bold text-slate-950">Leitura dos fluxos</h3>
                  </div>

                  <AnalyticsFilters
                    datasetProfile={ACTIVE_DATASET_PROFILE}
                    filters={demographicFilters}
                    direction={flowDirection}
                    compact
                    onFiltersChange={setDemographicFilters}
                    onDirectionChange={setFlowDirection}
                  />

                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={includeInternalFlows}
                      onChange={(e) => setIncludeInternalFlows(e.target.checked)}
                      className="mt-1 h-4 w-4 accent-slate-900"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800">
                        {ACTIVE_DATASET_PROFILE.dashboard.includeInternalFlowsLabel}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                        {ACTIVE_DATASET_PROFILE.dashboard.includeInternalFlowsHint}
                      </span>
                    </span>
                  </label>

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={showMobilityIntensity}
                        onChange={(e) => setShowMobilityIntensity(e.target.checked)}
                        className="mt-1 h-4 w-4 accent-slate-900"
                      />
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">
                          Mapa de calor de mobilidade
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                          Colore as áreas com maior movimentação considerando os filtros ativos.
                        </span>
                      </span>
                    </label>

                    {showMobilityIntensity && (
                      <select
                        value={mobilityIntensityMetric}
                        onChange={(e) => setMobilityIntensityMetric(e.target.value as MobilityIntensityMetric)}
                        className="mt-3 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="total">Total (entrada + saida)</option>
                        <option value="incoming">Entrada</option>
                        <option value="outgoing">Saída</option>
                        <option value="balance">Saldo (entrada - saída)</option>
                      </select>
                    )}
                  </div>
                </section>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="mb-3 flex shrink-0 items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mapa principal</p>
                  <h2 className="text-base font-bold text-slate-950">
                    {selectedArea
                      ? `${selectedUnitLabel}: ${selectedAreaName || selectedArea}`
                      : 'Clique no mapa ou use a busca para iniciar'}
                  </h2>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
                  {flowDirection === 'incoming'
                    ? ACTIVE_DATASET_PROFILE.dashboard.directionValues.incoming
                    : ACTIVE_DATASET_PROFILE.dashboard.directionValues.outgoing}
                </div>
              </div>

              <div className="min-h-0 flex-1">{map}</div>
            </section>

            <aside className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Leitura rapida</p>
                <h2 className="text-lg font-bold text-slate-950">Indicadores e graficos</h2>
                {selectedArea && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {selectedUnitLabel} selecionado
                    </p>
                    <p className="mt-1 truncate text-base font-bold text-slate-950">
                      {selectedAreaName || selectedArea}
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{selectedArea}</p>
                  </div>
                )}
              </div>

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
            </aside>
          </div>
        </div>
      )}

      {isFullscreen && (
        <div className="fixed inset-0 z-50">
          {map}

          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="fixed left-4 top-4 z-[60] rounded-lg border border-white bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl transition-colors hover:bg-slate-800"
            title="Sair da tela cheia"
          >
            Sair da tela cheia
          </button>

          <div className="fixed left-4 top-20 z-[60] flex flex-col gap-3">
            <button
              type="button"
              onClick={toggleGeographyLevel}
              className="rounded-lg border border-white bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-2xl backdrop-blur-sm"
            >
              {geographyLevel === 'aggregate'
                ? `Modo: ${ACTIVE_DATASET_PROFILE.labels.aggregate.modeLabel}`
                : `Modo: ${ACTIVE_DATASET_PROFILE.labels.base.modeLabel}`}
            </button>
          </div>
        </div>
      )}

      {showShortcutsHelp && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Ajuda</p>
                <h2 className="text-base font-bold text-slate-950">Atalhos do teclado</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsHelp(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white font-bold text-slate-600 transition-colors hover:bg-slate-100"
                title="Fechar atalhos"
              >
                x
              </button>
            </div>

            <div className="space-y-2">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{shortcut.description}</span>
                  <kbd className="min-w-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-center font-mono text-xs font-bold text-slate-900 shadow-sm">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] leading-4 text-slate-500">
              Os atalhos ficam pausados enquanto voce digita em campos, selects ou textareas. Use Esc para fechar esta ajuda ou sair da tela cheia.
            </p>
          </section>
        </div>
      )}

      <CacheDebugPanel isFullscreen={isFullscreen} />
    </main>
  );
}
