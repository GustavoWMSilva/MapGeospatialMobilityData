import React, { useEffect, useMemo, useState } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import type { Point, ViewState } from '../types';
import { AnimatedLines } from './AnimatedLines';
import { CityBoundaries } from './CityBoundaries';
import { AllAreaPoints } from './AllAreaPoints';
import { LTLAPoints } from './LTLAPoints';
import { FlowsVisualization } from './FlowsVisualization';
import { MAP_COLORS } from '../constants/mapColors';
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
  socialGrade?: string;
  ageGroup?: string;
  includeInternalFlows?: boolean;
  onIncludeInternalFlowsChange?: (value: boolean) => void;
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
  isFullscreen = false,
  socialGrade = 'all',
  ageGroup = 'all',
  includeInternalFlows = false,
  onIncludeInternalFlowsChange
}) => {
  const [activeConnectedAreaCodes, setActiveConnectedAreaCodes] = useState<string[]>([]);
  const selectedBoundaryCode = showLTLAs ? selectedLTLA : selectedAreaCode;

  useEffect(() => {
    if (!selectedBoundaryCode) {
      setActiveConnectedAreaCodes([]);
    }
  }, [selectedBoundaryCode]);

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
          'ltla-boundaries-clickable',  // Boundaries LTLA clicáveis
          'msoa-boundaries-clickable'   // Boundaries MSOA clicáveis
        ]}
        cursor="pointer"
      >
        {markers}
        
        {/* Todos os pontos/centróides das áreas */}
        <AllAreaPoints 
          isVisible={showAllPoints}
          pointColor={MAP_COLORS.points.msoa}
          pointSize={2}
        />
        
        {/* City Boundaries - Bordas das áreas/cidades - varia entre LTLA e MSOA */}
        <CityBoundaries 
          key={showLTLAs ? 'ltla' : 'msoa'}  // Forçar re-montagem ao mudar
          isVisible={true}
          borderColor={MAP_COLORS.boundaries.line}
          borderWidth={MAP_COLORS.boundaries.baseLineWidth}
          fillColor={MAP_COLORS.boundaries.fill}
          fillOpacity={MAP_COLORS.boundaries.baseFillOpacity}
          selectedCode={selectedBoundaryCode}
          connectedCodes={activeConnectedAreaCodes}
          dataSource={showLTLAs ? 'ltla' : 'msoa'}  // Alterar baseado no modo
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
            isFullscreen={isFullscreen}
            socialGrade={socialGrade}
            ageGroup={ageGroup}
            showInternal={includeInternalFlows}
            onShowInternalChange={onIncludeInternalFlowsChange}
            onActiveConnectionsChange={setActiveConnectedAreaCodes}
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
              isFullscreen={isFullscreen}
              socialGrade={socialGrade}
              ageGroup={ageGroup}
              showInternal={includeInternalFlows}
              onShowInternalChange={onIncludeInternalFlowsChange}
              onActiveConnectionsChange={setActiveConnectedAreaCodes}
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
