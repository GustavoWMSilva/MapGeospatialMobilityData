// Mobility Flows Visualization App - Fixed ltlaName state
import * as React from 'react';
import { useRef, useCallback, useEffect } from 'react';
import type { MapRef } from '@vis.gl/react-maplibre';

// Components
import { InteractiveMap } from './components/InteractiveMap';
import { AreaSelectionControls } from './components/AreaSelectionControls';
import { LTLASelector } from './components/LTLASelector';
import { CacheDebugPanel } from './components/CacheDebugPanel';
import { AnalyticsDashboard } from './components/analytics';
import { AnalyticsFilters } from './components/analytics/AnalyticsFilters';

// Hooks
import { useSelectedArea } from './hooks/useSelectedArea';

// Constants & Types
import type { ViewState, SocialGrade, AgeGroup } from './types';

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -1.5,
  latitude: 52.5,
  zoom: 6,
};

interface MapClickEvent {
  lngLat: { lng: number; lat: number };
  features?: Array<{
    layer: { id: string };
    properties: Record<string, unknown>;
  }>;
}

export default function App() {
  const [viewState, setViewState] = React.useState<ViewState>(DEFAULT_VIEW_STATE);
  const [mobilityDataSource] = React.useState<'general' | 'london'>('general');
  const [showAllPoints, setShowAllPoints] = React.useState(false);
  const [showLTLAs, setShowLTLAs] = React.useState(true);
  const [selectedLTLA, setSelectedLTLA] = React.useState<string | null>(null);
  const [selectedLTLAName, setSelectedLTLAName] = React.useState<string>('');
  const [selectedMSOAName, setSelectedMSOAName] = React.useState<string>('');
  const [viewMode, setViewMode] = React.useState<'msoa' | 'ltla'>('ltla');
  const [flowDirection, setFlowDirection] = React.useState<'incoming' | 'outgoing'>('incoming');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [includeInternalFlows, setIncludeInternalFlows] = React.useState(false);

  // Filtros demograficos (compartilhados entre Dashboard e Mapa)
  const [socialGrade, setSocialGrade] = React.useState<SocialGrade>('all');
  const [ageGroup, setAgeGroup] = React.useState<AgeGroup>('all');

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

  // Hooks
  const { selectedAreaCode, selectArea, clearSelection } = useSelectedArea();

  const onMove = useCallback(({ viewState: newViewState }: { viewState: ViewState }) => {
    setViewState(newViewState);
  }, []);

  const handleMapClick = useCallback((event: MapClickEvent) => {
    const { lng, lat } = event.lngLat;

    // Tentar detectar features no ponto clicado
    if (mapRef.current && event.features && event.features.length > 0) {
      const feature = event.features[0];

      // Se clicou em um ponto LTLA
      if (
        feature.layer.id === 'ltla-points-layer' ||
        feature.layer.id === 'ltla-heatmap-circles' ||
        feature.layer.id === 'ltla-points-selected'
      ) {
        const ltlaCode = String(feature.properties.code || '');
        const ltlaName = String(feature.properties.name || '');
        console.log('Distrito LTLA selecionado:', ltlaName, ltlaCode);
        setSelectedLTLA(ltlaCode);
        setSelectedLTLAName(ltlaName);
        selectArea(null); // Limpa selecao MSOA
        setSelectedMSOAName(''); // Limpa nome MSOA
        return;
      }

      // Se clicou em um boundary LTLA
      if (feature.layer.id === 'ltla-boundaries-clickable') {
        const ltlaCode = String(feature.properties.ltla_code || feature.properties.code || '');
        const ltlaName = String(feature.properties.ltla_name || feature.properties.name || '');
        console.log('Boundary LTLA clicado:', ltlaName, ltlaCode);
        setSelectedLTLA(ltlaCode);
        setSelectedLTLAName(ltlaName);
        selectArea(null); // Limpa selecao MSOA
        setSelectedMSOAName(''); // Limpa nome MSOA
        return;
      }

      // Se clicou em um ponto MSOA
      if (feature.layer.id === 'all-area-points-layer') {
        const msoaCode = String(feature.properties.code || '');
        const msoaName = String(feature.properties.name || '');
        console.log('Area MSOA selecionada:', msoaName, msoaCode);
        selectArea(msoaCode);
        setSelectedMSOAName(msoaName); // Salva nome MSOA
        setSelectedLTLA(null); // Limpa selecao LTLA
        setSelectedLTLAName(''); // Limpa nome LTLA
        return;
      }

      // Se clicou em um boundary MSOA
      if (feature.layer.id === 'msoa-boundaries-clickable') {
        const msoaCode = String(feature.properties.MSOA21CD || feature.properties.msoa_code || feature.properties.code || '');
        const msoaName = String(feature.properties.MSOA21NM || feature.properties.name || '');
        console.log('Boundary MSOA clicado:', msoaName, msoaCode);
        selectArea(msoaCode);
        setSelectedMSOAName(msoaName); // Salva nome MSOA
        setSelectedLTLA(null); // Limpa selecao LTLA
        setSelectedLTLAName(''); // Limpa nome LTLA
        return;
      }
    }

    // Se nao clicou em nenhuma feature, apenas registra o ponto (comportamento antigo)
    console.log('Clicou em:', { longitude: lng, latitude: lat });
    // addPoint(lng, lat); // Comentado para nao adicionar marcador
  }, [mapRef, selectArea, setSelectedLTLA]);

  const selectedArea = viewMode === 'ltla' ? (selectedLTLA || undefined) : (selectedAreaCode || undefined);
  const selectedAreaName = viewMode === 'ltla' ? selectedLTLAName : selectedMSOAName;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 50%, #f3e8ff 100%)' }}>
      {/* Header */}
      {!isFullscreen && (
      <div className="border-b border-purple-200 bg-gradient-to-r from-purple-700 via-purple-700 to-purple-800 shadow-sm">
        <div className="px-6 py-5">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
            Visualização de Mobilidade Geoespacial
          </h1>
          <p className="mt-1 text-sm text-purple-100">
            Análise interativa de fluxos de mobilidade no Reino Unido
          </p>
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
                  onClick={() => {
                    const newMode = viewMode === 'msoa' ? 'ltla' : 'msoa';
                    setViewMode(newMode);
                    setShowAllPoints(newMode === 'msoa');
                    setShowLTLAs(newMode === 'ltla');

                    if (newMode === 'ltla') {
                      selectArea(null);
                      setSelectedMSOAName('');
                    } else {
                      setSelectedLTLA(null);
                      setSelectedLTLAName('');
                    }
                  }}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors sm:text-xs ${
                    viewMode === 'ltla'
                      ? 'border-purple-700 bg-purple-700 text-white hover:bg-purple-800'
                      : 'border-purple-300 bg-purple-50 text-purple-800 hover:bg-purple-100'
                  }`}
                >
                  {viewMode === 'ltla' ? 'Cidades (LTLA)' : 'Areas (MSOA)'}
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
            {viewMode === 'ltla' ? (
              <LTLASelector
                selectedLTLA={selectedLTLA}
                onSelectLTLA={(ltlaCode, ltlaName) => {
                  setSelectedLTLA(ltlaCode);
                  setSelectedLTLAName(ltlaName);
                  selectArea(null); // Limpa selecao MSOA
                  setSelectedMSOAName(''); // Limpa nome MSOA
                }}
                onClearSelection={() => {
                  setSelectedLTLA(null);
                  setSelectedLTLAName('');
                }}
              />
            ) : (
              <AreaSelectionControls
                selectedAreaCode={selectedAreaCode}
                onSelectArea={(code) => {
                  selectArea(code);
                  setSelectedMSOAName(''); // Nome sera atualizado ao clicar no mapa
                  setSelectedLTLA(null); // Limpa selecao LTLA
                  setSelectedLTLAName(''); // Limpa nome LTLA
                }}
                onClearSelection={() => {
                  clearSelection();
                  setSelectedMSOAName(''); // Limpa nome MSOA
                }}
              />
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-purple-100 bg-white p-3 shadow-sm">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-purple-800">
              Filtros dos Gráficos
            </p>

            <AnalyticsFilters
              socialGrade={socialGrade}
              ageGroup={ageGroup}
              direction={flowDirection}
              compact
              onSocialGradeChange={setSocialGrade}
              onAgeGroupChange={setAgeGroup}
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
              selectedAreaCode={selectedAreaCode}
              showAllPoints={showAllPoints}
              showLTLAs={showLTLAs}
              selectedLTLA={selectedLTLA}
              flowDirection={flowDirection}
              isFullscreen={false}
              socialGrade={socialGrade}
              ageGroup={ageGroup}
              includeInternalFlows={includeInternalFlows}
              onIncludeInternalFlowsChange={setIncludeInternalFlows}
            />
          </div>

          <div className="space-y-5 xl:h-[calc(100vh-8.5rem)] xl:overflow-y-auto xl:pr-2">
            <AnalyticsDashboard
              selectedArea={selectedArea}
              areaName={selectedAreaName}
              dataSource={viewMode}
              socialGrade={socialGrade}
              ageGroup={ageGroup}
              direction={flowDirection}
              includeInternalFlows={includeInternalFlows}
              showTopControls={false}
              onSocialGradeChange={setSocialGrade}
              onAgeGroupChange={setAgeGroup}
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
          selectedAreaCode={selectedAreaCode}
          showAllPoints={showAllPoints}
          showLTLAs={showLTLAs}
          selectedLTLA={selectedLTLA}
          flowDirection={flowDirection}
          isFullscreen
          socialGrade={socialGrade}
          ageGroup={ageGroup}
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
              onClick={() => {
                const newMode = viewMode === 'msoa' ? 'ltla' : 'msoa';
                setViewMode(newMode);
                setShowAllPoints(newMode === 'msoa');
                setShowLTLAs(newMode === 'ltla');
              }}
              className={`px-5 py-2.5 rounded-lg font-semibold transition-all shadow-2xl transform hover:scale-105 border-2 border-white ${
                viewMode === 'ltla'
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700'
              }`}
            >
              {viewMode === 'ltla' ? 'Modo: Cidades (LTLA)' : 'Modo: Áreas (MSOA)'}
            </button>
          </div>
        </>
      </div>
      )}

      {/* Painel de Debug do Cache */}
      <CacheDebugPanel />
    </main>
  );
}
