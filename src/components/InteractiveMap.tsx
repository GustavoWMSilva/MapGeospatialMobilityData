import React, { useMemo } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import type { Point, ViewState } from '../types';
import { AnimatedLines } from './AnimatedLines';
<<<<<<< Updated upstream
import { CityBoundaries } from './CityBoundaries';
import { AllAreaPoints } from './AllAreaPoints';
import { LTLAPoints } from './LTLAPoints';
import { FlowsVisualization } from './FlowsVisualization';
import { LTLABoundaries } from './LTLABoundaries';
=======
import { MobilityFlows } from './MobilityFlows';
import { MobilityLegend } from './MobilityLegend';
import { CityBoundaries } from './CityBoundaries';
import { SelectedAreaConnections } from './SelectedAreaConnections';
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
  showAllPoints?: boolean;
  showLTLAs?: boolean;
  selectedLTLA?: string | null;
  flowDirection?: 'incoming' | 'outgoing';
  isFullscreen?: boolean;
=======
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
  selectedAreaCode = null,
  showAllPoints = false,
  showLTLAs = false,
  selectedLTLA = null,
  flowDirection = 'incoming',
  isFullscreen = false
=======
  selectedAreaCode = null
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    <div className={isFullscreen ? "h-screen w-screen overflow-hidden relative" : "h-[calc(100vh-8rem)] overflow-hidden shadow-2xl rounded-xl relative border-4 border-purple-200"}>
=======
    <div className="h-[calc(100vh-8rem)] overflow-hidden shadow relative">
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
        interactiveLayerIds={[
          'flow-lines',
          'ltla-points-layer',
          'ltla-points-selected',
          'ltla-heatmap-circles',
          'all-area-points-layer'
        ]}
        cursor="pointer"
=======
        interactiveLayerIds={['flow-lines']}
>>>>>>> Stashed changes
            >
        {/* Marcador de exemplo removido - era em São Francisco */}
        {/* <Marker 
          longitude={-122.4} 
          latitude={37.8} 
          color="red" 
          popup={popup} 
          ref={markerRef} 
        /> */}
        {markers}
        
<<<<<<< Updated upstream
        {/* Todos os pontos/centróides das áreas */}
        <AllAreaPoints 
          isVisible={showAllPoints}
          pointColor="#3B82F6"
          pointSize={3}
        />
        
=======
>>>>>>> Stashed changes
        {/* City Boundaries - Bordas das áreas/cidades */}
        <CityBoundaries 
          isVisible={true}
          borderColor="#4A90E2"
          borderWidth={1.5}
          fillColor="#4A90E2"
          fillOpacity={0.05}
        />
        
<<<<<<< Updated upstream
        {/* LTLA Boundaries - Administrative Boundaries */}
        {showLTLAs && (
          <LTLABoundaries 
            selectedLTLA={selectedLTLA}
          />
        )}
        
        {/* LTLA Points - City-level Aggregation */}
        {showLTLAs  && (
          <LTLAPoints 
            selectedLTLA={selectedLTLA}
          />
        )}
        
        {/* LTLA Flows Visualization */}
        {showLTLAs && selectedLTLA && (
          <FlowsVisualization 
            selectedCode={selectedLTLA}
            isVisible={true}
            flowDirection={flowDirection}
            dataSource="ltla"
          />
        )}
        
       
        {/* MSOA Flows Visualization */}
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
=======
        {/* Mobility Flows - UK Commuting Data */}
        {/* <MobilityFlows isVisible={true} dataSource={mobilityDataSource} /> */}
        
        {/* Linhas tracejadas da área selecionada para todas as outras */}
        <SelectedAreaConnections 
          selectedAreaCode={selectedAreaCode}
          isVisible={true}
          lineColor="#FF6B6B"
          lineWidth={1.5}
          dataSource={mobilityDataSource}
        />
>>>>>>> Stashed changes
        
        {/* Linhas animadas */}
        {linesGeoJSON && animatedPointsGeoJSON && (
          <AnimatedLines
            mapRef={mapRef}
            linesGeoJSON={linesGeoJSON}
            animatedPointsGeoJSON={animatedPointsGeoJSON}
          />
        )}
      </Map>
      
<<<<<<< Updated upstream
      
=======
      {/* Legenda dos fluxos de mobilidade */}
      <MobilityLegend isVisible={true} />
>>>>>>> Stashed changes
    </div>
  );
};