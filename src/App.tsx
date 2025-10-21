import * as React from 'react';
import { useRef, useCallback } from 'react';
import type { MapRef } from '@vis.gl/react-maplibre';
// npm install @turf/turf
import * as turf from '@turf/turf';

// Components
import { NavigationControls } from './components/NavigationControls';
import { InteractiveMap } from './components/InteractiveMap';

// Hooks
import { useMapNavigation } from './hooks/useMapNavigation';
import { useMapPopup } from './hooks/useMapPopup';
import { useAnimatedLines } from './hooks/useAnimatedLines';

// Constants & Types
import { DEFAULT_VIEW_STATE } from './constants';
import type { ViewState } from './types';

const GEOFENCE = turf.circle([-74.0122106, 40.7467898], 5, {units: 'miles'});

export default function App() {
  const [viewState, setViewState] = React.useState<ViewState>(DEFAULT_VIEW_STATE);
  const mapRef = useRef<MapRef>(null);

  // Hooks
  const { points, addPoint, clearPoints, flyToLocation, flyToPoint } = useMapNavigation(mapRef);
  const { markerRef, popup, togglePopup } = useMapPopup();
  const { 
    isAnimating, 
    createLinesToPoints, 
    startAnimation, 
    getLinesGeoJSON, 
    getAnimatedPointsGeoJSON 
  } = useAnimatedLines();

  // Atualizar linhas quando pontos mudarem
  React.useEffect(() => {
    createLinesToPoints(points);
  }, [points, createLinesToPoints]);

  const onMove = useCallback(({ viewState }: { viewState: ViewState }) => {
    const newCenter = {
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom
    };
    // Only update the view state if the center is inside the geofence
    // if (turf.booleanPointInPolygon(turf.point([newCenter.longitude, newCenter.latitude]), GEOFENCE)) {
      setViewState(newCenter);
    // }
  }, []);

  const handleMapClick = useCallback((event: { lngLat: { lng: number; lat: number } }) => {
    const { lng, lat } = event.lngLat;
    
    console.log('Clicou em:', { longitude: lng, latitude: lat });
    addPoint(lng, lat);
  }, [addPoint]);

  return (
    <main className="">
      <NavigationControls
        points={points}
        isAnimating={isAnimating}
        onTogglePopup={togglePopup}
        onClearPoints={clearPoints}
        onFlyToLocation={flyToLocation}
        onFlyToPoint={flyToPoint}
        onStartAnimation={startAnimation}
      />

      <InteractiveMap
        mapRef={mapRef}
        viewState={viewState}
        points={points}
        markerRef={markerRef}
        popup={popup}
        onMove={onMove}
        onClick={handleMapClick}
        onFlyToPoint={flyToPoint}
        linesGeoJSON={getLinesGeoJSON()}
        animatedPointsGeoJSON={getAnimatedPointsGeoJSON()}
      />
    </main>
  );
}
