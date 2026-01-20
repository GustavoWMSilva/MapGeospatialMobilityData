import React, { useMemo } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import type { Point, ViewState } from '../types';
import { AnimatedLines } from './AnimatedLines';
import { CityBoundaries } from './CityBoundaries';
import { AllAreaPoints } from './AllAreaPoints';
import { LTLAPoints } from './LTLAPoints';
import { FlowsVisualization } from './FlowsVisualization';
// import { LTLABoundaries } from './LTLABoundaries'; // Temporariamente desabilitado

interface InteractiveMapProps {
  mapRef: React.RefObject<MapRef | null>;
  viewState: ViewState;
  points: Point[];
  onMove: (params: { viewState: ViewState }) => void;
  onClick: (event: { lngLat: { lng: number; lat: number } }) => void;
  onFlyToPoint: (point: Point) => void;
  linesGeoJSON?: GeoJSON.FeatureCollection;
  animatedPointsGeoJSON?: GeoJSON.FeatureCollection;
  mobilityDataSource?: 'general' | 'london';
  selectedAreaCode?: string | null;
  showAllPoints?: boolean;
  showLTLAs?: boolean;
  selectedLTLA?: string | null;
  flowDirection?: 'incoming' | 'outgoing';
  isFullscreen?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  mapRef,
  viewState,
  points,
  onMove,
  onClick,
  onFlyToPoint,
  linesGeoJSON,
  animatedPointsGeoJSON,
  mobilityDataSource = 'general',
  selectedAreaCode = null,
  showAllPoints = false,
  showLTLAs = false,
  selectedLTLA = null,
  flowDirection = 'incoming',
  isFullscreen = false
}) => {
  const markers = useMemo(
    () =>
      points.map((p, i) => (
        <Marker 
          key={i} 
          longitude={p.lng} 
          latitude={p.lat} 
          color="blue"
          onClick={() => onFlyToPoint(p)}
        />
      )),
    [points, onFlyToPoint]
  );

  return (
    <div className={isFullscreen ? "h-screen w-screen overflow-hidden relative" : "h-[calc(100vh-8rem)] overflow-hidden shadow-2xl rounded-xl relative border-4 border-purple-200"}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={onMove}
        onClick={onClick}
        mapStyle={
          typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
        }
        interactiveLayerIds={[
          'flow-lines',
          'ltla-points-layer',
          'ltla-points-selected',
          'ltla-heatmap-circles',
          'all-area-points-layer'
        ]}
        cursor="pointer"
      >
        {markers}
        
        {/* Todos os pontos/centróides das áreas */}
        <AllAreaPoints 
          isVisible={showAllPoints}
          pointColor="#3B82F6"
          pointSize={3}
        />
        
        {/* City Boundaries - Bordas das áreas/cidades */}
        <CityBoundaries 
          isVisible={true}
          borderColor="#4A90E2"
          borderWidth={1.5}
          fillColor="#4A90E2"
          fillOpacity={0.05}
        />
        
        {/* LTLA Boundaries - Temporariamente desabilitado (requer Stadia Maps API key) */}
        {/* {showLTLAs && (
          <LTLABoundaries 
            selectedLTLA={selectedLTLA}
          />
        )} */}
        
        {/* LTLA Flows Visualization - renderizar ANTES dos pontos */}
        {showLTLAs && selectedLTLA && (
          <FlowsVisualization 
            selectedCode={selectedLTLA}
            isVisible={true}
            flowDirection={flowDirection}
            dataSource="ltla"
          />
        )}
        
        {/* MSOA Flows Visualization - renderizar ANTES dos pontos */}
        {showAllPoints && selectedAreaCode && (
          <>
            {console.log('🎯 Renderizando FlowsVisualization MSOA:', { showAllPoints, selectedAreaCode, mobilityDataSource, flowDirection })}
            <FlowsVisualization 
              selectedCode={selectedAreaCode}
              isVisible={true}
              flowDirection={flowDirection}
              dataSource="msoa"
            />
          </>
        )}
        
        {/* LTLA Points - City-level Aggregation - renderizar POR ÚLTIMO para ficar por cima */}
        {showLTLAs && (
          <LTLAPoints 
            selectedLTLA={selectedLTLA}
          />
        )}
        
        {/* Linhas animadas */}
        {linesGeoJSON && animatedPointsGeoJSON && (
          <AnimatedLines
            mapRef={mapRef}
            linesGeoJSON={linesGeoJSON}
            animatedPointsGeoJSON={animatedPointsGeoJSON}
          />
        )}
      </Map>
    </div>
  );
};
