import * as React from 'react';
import { useRef, useCallback } from 'react';
import type { MapRef } from '@vis.gl/react-maplibre';

// Components
import { InteractiveMap } from './components/InteractiveMap';
import { AreaSelectionControls } from './components/AreaSelectionControls';
import { LTLASelector } from './components/LTLASelector';
import { DuckDBTest } from './components/DuckDBTest';

// Hooks
import { useSelectedArea } from './hooks/useSelectedArea';

// Constants & Types
import type { ViewState } from './types';

const DEFAULT_VIEW_STATE: ViewState = {
  longitude: -1.5,
  latitude: 52.5,
  zoom: 6
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
  const [viewMode, setViewMode] = React.useState<'msoa' | 'ltla'>('ltla');
  const [flowDirection, setFlowDirection] = React.useState<'incoming' | 'outgoing'>('incoming');
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const mapRef = useRef<MapRef>(null);

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
      if (feature.layer.id === 'ltla-points-layer' || 
          feature.layer.id === 'ltla-heatmap-circles' ||
          feature.layer.id === 'ltla-points-selected') {
        const ltlaCode = String(feature.properties.code || '');
        const ltlaName = String(feature.properties.name || '');
        console.log('✅ Distrito LTLA selecionado:', ltlaName, ltlaCode);
        setSelectedLTLA(ltlaCode);
        selectArea(null); // Limpa seleção MSOA
        return;
      }
      
      // Se clicou em um ponto MSOA
      if (feature.layer.id === 'all-area-points-layer') {
        const msoaCode = String(feature.properties.code || '');
        const msoaName = String(feature.properties.name || '');
        console.log('✅ Área MSOA selecionada:', msoaName, msoaCode);
        selectArea(msoaCode);
        setSelectedLTLA(null); // Limpa seleção LTLA
        return;
      }
    }
    
    // Se não clicou em nenhuma feature, apenas registra o ponto (comportamento antigo)
    console.log('📍 Clicou em:', { longitude: lng, latitude: lat });
    // addPoint(lng, lat); // Comentado para não adicionar marcador
  }, [mapRef, selectArea, setSelectedLTLA]);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 50%, #f3e8ff 100%)' }}>
      {/* Header */}
      {!isFullscreen && (
      <div className="bg-gradient-to-r from-purple-600 via-purple-700 to-purple-800 shadow-lg">
        <div className="px-6 py-4">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Visualização de Mobilidade Geoespacial
          </h1>
          <p className="text-purple-100 text-sm mt-1">
            Análise interativa de fluxos de mobilidade no Reino Unido
          </p>
        </div>
      </div>
      )}
      {/* Controles principais */}
      {!isFullscreen && (
      <div className="px-6 py-4 bg-white shadow-md border-b border-purple-100">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="text-sm font-semibold text-purple-900 mr-2">Controles:</div>
        {/* <button
          onClick={() => setMobilityDataSource('general')}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            mobilityDataSource === 'general'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🌍 Fluxos Gerais (Top 1000)
        </button>
        <button
          onClick={() => setMobilityDataSource('london')}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            mobilityDataSource === 'london'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🏙️ Fluxos para Londres (Top 5000)
        </button> */}
        
        {/* Botão para alternar modo de visualização */}
        <button
          onClick={() => {
            const newMode = viewMode === 'msoa' ? 'ltla' : 'msoa';
            setViewMode(newMode);
            setShowAllPoints(newMode === 'msoa');
            setShowLTLAs(newMode === 'ltla');
          }}
          className={`px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
            viewMode === 'ltla'
              ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white border-2 border-purple-600 hover:from-purple-700 hover:to-purple-800'
              : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white border-2 border-purple-500 hover:from-purple-600 hover:to-purple-700'
          }`}
        >
          {viewMode === 'ltla' ? 'Modo: Cidades (LTLA)' : 'Modo: Áreas (MSOA)'}
        </button>
        
        {/* Botão para alternar direção do fluxo (visível quando área selecionada) */}
        {((viewMode === 'ltla' && selectedLTLA) || (viewMode === 'msoa' && selectedAreaCode)) && (
          <button
            onClick={() => setFlowDirection(prev => prev === 'incoming' ? 'outgoing' : 'incoming')}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border-2 ${
              flowDirection === 'incoming'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 hover:from-blue-700 hover:to-blue-800'
                : 'bg-gradient-to-r from-rose-600 to-rose-700 text-white border-rose-600 hover:from-rose-700 hover:to-rose-800'
            }`}
          >
            {flowDirection === 'incoming' ? '⬇️ Fluxos Chegando' : '⬆️ Fluxos Saindo'}
          </button>
        )}
        
        {/* Botão para tela cheia */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white border-purple-600 hover:from-purple-700 hover:to-purple-800"
          title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        >
          {isFullscreen ? 'Modo Normal' : 'Tela Cheia'}
        </button>
        </div>
      </div>
      )}
      
      {/* Controles de seleção baseados no modo */}
      {!isFullscreen && (
      <div className="px-6 py-4 pb-6">
        {viewMode === 'ltla' ? (
          <LTLASelector
            selectedLTLA={selectedLTLA}
            onSelectLTLA={(ltlaCode) => {
              setSelectedLTLA(ltlaCode);
              selectArea(null); // Limpa seleção MSOA
            }}
            onClearSelection={() => setSelectedLTLA(null)}
          />
        ) : (
          <AreaSelectionControls
            selectedAreaCode={selectedAreaCode}
            onSelectArea={(code) => {
              selectArea(code);
              setSelectedLTLA(null); // Limpa seleção LTLA
            }}
            onClearSelection={clearSelection}
          />
        )}
      </div>
      )}

      <div className={isFullscreen ? 'fixed inset-0 z-50' : 'px-6 pb-6'}>
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
          isFullscreen={isFullscreen}
        />
        
        {/* Controles flutuantes no modo fullscreen */}
        {isFullscreen && (
          <>
            {/* Botão de sair da tela cheia */}
            <button
              onClick={() => setIsFullscreen(false)}
              className="fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg font-bold transition-all shadow-2xl bg-gradient-to-r from-purple-600 to-purple-700 text-white border-2 border-white hover:from-purple-700 hover:to-purple-800 hover:scale-105"
              title="Sair da tela cheia"
            >
              Sair da Tela Cheia
            </button>
            
            {/* Painel de controles flutuante */}
            <div className="fixed top-4 left-4 z-[60] flex flex-col gap-3">
              {/* Botão de alternar modo */}
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
              
              {/* Botão de alternar direção do fluxo */}
              {((viewMode === 'ltla' && selectedLTLA) || (viewMode === 'msoa' && selectedAreaCode)) && (
                <button
                  onClick={() => setFlowDirection(prev => prev === 'incoming' ? 'outgoing' : 'incoming')}
                  className={`px-5 py-2.5 rounded-lg font-semibold transition-all shadow-2xl transform hover:scale-105 border-2 border-white ${
                    flowDirection === 'incoming'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
                      : 'bg-gradient-to-r from-rose-600 to-rose-700 text-white hover:from-rose-700 hover:to-rose-800'
                  }`}
                >
                  {flowDirection === 'incoming' ? '⬇️ Fluxos Chegando' : '⬆️ Fluxos Saindo'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* DuckDB Test Component (remover após testar) */}
      <DuckDBTest />
    </main>
  );
}
