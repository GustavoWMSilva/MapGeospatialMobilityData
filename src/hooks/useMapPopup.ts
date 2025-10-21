import { useRef, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

export const useMapPopup = () => {
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const popup = useMemo(() => {
    return new maplibregl.Popup().setText('Hello world!');
  }, []);

  const togglePopup = useCallback(() => {
    markerRef.current?.togglePopup();
  }, []);

  return {
    markerRef,
    popup,
    togglePopup
  };
};