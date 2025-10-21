import * as React from 'react';
import {useRef, useMemo, useCallback} from 'react';
import {Map, Marker} from '@vis.gl/react-maplibre';
import maplibregl from 'maplibre-gl';
// npm install @turf/turf
import * as turf from '@turf/turf';


const GEOFENCE = turf.circle([-74.0122106, 40.7467898], 5, {units: 'miles'});

export default function App() {
  const [viewState, setViewState] = React.useState({
    longitude: -100,
    latitude: 40,
    zoom: 3.5
  });

  const onMove = React.useCallback(({viewState}: {viewState: {longitude: number; latitude: number; zoom: number}}) => {
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

  const markerRef = useRef<maplibregl.Marker | null>(null);

  const popup = useMemo(() => {
    return new maplibregl.Popup().setText('Hello world!');
  }, [])

  const togglePopup = useCallback(() => {
    markerRef.current?.togglePopup();
  }, []);

  const [points, setPoints] = React.useState<Array<{ lng: number; lat: number }>>([]);

  const addPoint = useCallback((lng: number, lat: number) => {
    setPoints(prev => [...prev, { lng, lat }]);
  }, []);

  const clearPoints = useCallback(() => {
    setPoints([]);
  }, []);

  const markers = useMemo(
    () =>
      points.map((p, i) => (
        <Marker key={i} longitude={p.lng} latitude={p.lat} color="blue" />
      )),
    [points]
  );

  const handleMapClick = useCallback((event: {lngLat: {lng: number; lat: number}}) => {
    const { lng, lat } = event.lngLat;
    
    console.log('Clicou em:', { longitude: lng, latitude: lat });
    // Adiciona um novo ponto no local clicado
    addPoint(lng, lat);
  }, [addPoint]);

  return (
    <main className="">
       <div className="p-4 space-x-2">
          <button onClick={togglePopup} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Toggle popup
          </button>
          <button onClick={clearPoints} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            Limpar pontos ({points.length})
          </button>
        </div>

      <div className="h-[calc(100vh-2rem)]  overflow-hidden shadow">
        <Map
          {...viewState}
          onMove={onMove}
          onClick={handleMapClick}
          mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
        >
          <Marker longitude={-122.4} latitude={37.8} color="red" popup={popup} ref={markerRef} />
          {markers}
        </Map>
       
      </div>
    </main>
  );
}
