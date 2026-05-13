import React, { useEffect, useMemo, useState } from 'react';
import { Map, Marker } from '@vis.gl/react-maplibre';
import type { MapRef } from '@vis.gl/react-maplibre';
import type {
  DatasetProfile,
  DemographicFilters,
  GeographyLevel,
  MobilityIntensityMetric,
  Point,
  ViewState,
} from '../types';
import { AnimatedLines } from './AnimatedLines';
import { CityBoundaries } from './CityBoundaries';
import { AllAreaPoints } from './AllAreaPoints';
import { AggregateAreaPoints } from './AggregateAreaPoints';
import { FlowsVisualization } from './FlowsVisualization';
import { MAP_COLORS } from '../constants/mapColors';

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
  selectedBaseAreaCode?: string | null;
  showBasePoints?: boolean;
  showAggregateAreas?: boolean;
  selectedAggregateAreaCode?: string | null;
  flowDirection?: 'incoming' | 'outgoing';
  isFullscreen?: boolean;
  geographyLevel: GeographyLevel;
  datasetProfile: DatasetProfile;
  demographicFilters?: DemographicFilters;
  includeInternalFlows?: boolean;
  showMobilityIntensity?: boolean;
  mobilityIntensityMetric?: MobilityIntensityMetric;
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
  selectedBaseAreaCode = null,
  showBasePoints = false,
  showAggregateAreas = false,
  selectedAggregateAreaCode = null,
  flowDirection = 'incoming',
  isFullscreen = false,
  geographyLevel,
  datasetProfile,
  demographicFilters = {},
  includeInternalFlows = false,
  showMobilityIntensity = false,
  mobilityIntensityMetric = 'total',
  onIncludeInternalFlowsChange,
}) => {
  const [activeConnectedAreaCodes, setActiveConnectedAreaCodes] = useState<string[]>([]);
  const selectedBoundaryCode =
    geographyLevel === 'aggregate' ? selectedAggregateAreaCode : selectedBaseAreaCode;
  const intensityMetricLabel =
    mobilityIntensityMetric === 'incoming'
      ? 'Entrada'
      : mobilityIntensityMetric === 'outgoing'
        ? 'Saída'
        : mobilityIntensityMetric === 'balance'
          ? 'Saldo'
          : 'Total';

  useEffect(() => {
    if (!selectedBoundaryCode) {
      setActiveConnectedAreaCodes([]);
    }
  }, [selectedBoundaryCode]);

  const markers = useMemo(
    () =>
      points.map((point, index) => (
        <Marker
          key={index}
          longitude={point.lng}
          latitude={point.lat}
          color="blue"
          onClick={() => onFlyToPoint(point)}
        />
      )),
    [points, onFlyToPoint]
  );

  return (
    <div
      className={
        isFullscreen
          ? 'relative h-screen w-screen overflow-hidden'
          : 'relative h-full min-h-0 overflow-hidden rounded-xl border border-slate-200 shadow-xl'
      }
    >
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
          'aggregate-boundaries-clickable',
          'base-boundaries-clickable',
        ]}
        cursor="pointer"
      >
        {markers}

        <AllAreaPoints isVisible={showBasePoints} pointColor={MAP_COLORS.points.msoa} pointSize={2} />

        <CityBoundaries
          key={geographyLevel}
          isVisible
          borderColor={MAP_COLORS.boundaries.line}
          borderWidth={MAP_COLORS.boundaries.baseLineWidth}
          fillColor={MAP_COLORS.boundaries.fill}
          fillOpacity={MAP_COLORS.boundaries.baseFillOpacity}
          selectedCode={selectedBoundaryCode}
          connectedCodes={activeConnectedAreaCodes}
          geographyLevel={geographyLevel}
          showMobilityIntensity={showMobilityIntensity}
          mobilityIntensityMetric={mobilityIntensityMetric}
          demographicFilters={demographicFilters}
          includeInternalFlows={includeInternalFlows}
        />

        {showAggregateAreas && selectedAggregateAreaCode && (
          <FlowsVisualization
            selectedCode={selectedAggregateAreaCode}
            isVisible
            flowDirection={flowDirection}
            geographyLevel="aggregate"
            isFullscreen={isFullscreen}
            datasetProfile={datasetProfile}
            demographicFilters={demographicFilters}
            showInternal={includeInternalFlows}
            onShowInternalChange={onIncludeInternalFlowsChange}
            onActiveConnectionsChange={setActiveConnectedAreaCodes}
          />
        )}

        {showBasePoints && selectedBaseAreaCode && (
          <>
            {console.log('Renderizando FlowsVisualization base:', {
              showBasePoints,
              selectedBaseAreaCode,
              mobilityDataSource,
              flowDirection,
            })}
            <FlowsVisualization
              selectedCode={selectedBaseAreaCode}
              isVisible
              flowDirection={flowDirection}
              geographyLevel="base"
              isFullscreen={isFullscreen}
              datasetProfile={datasetProfile}
              demographicFilters={demographicFilters}
              showInternal={includeInternalFlows}
              onShowInternalChange={onIncludeInternalFlowsChange}
              onActiveConnectionsChange={setActiveConnectedAreaCodes}
            />
          </>
        )}

        {showAggregateAreas && (
          <AggregateAreaPoints selectedAggregateAreaCode={selectedAggregateAreaCode} />
        )}

        {linesGeoJSON && animatedPointsGeoJSON && (
          <AnimatedLines
            mapRef={mapRef}
            linesGeoJSON={linesGeoJSON}
            animatedPointsGeoJSON={animatedPointsGeoJSON}
          />
        )}
      </Map>

      {showMobilityIntensity && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-52 rounded-lg border border-white/70 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-900">Intensidade</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {intensityMetricLabel}
            </span>
          </div>
          <div
            className="h-2.5 rounded-full"
            style={{
              background:
                mobilityIntensityMetric === 'balance'
                  ? 'linear-gradient(90deg, #B91C1C 0%, #F8FAFC 50%, #15803D 100%)'
                  : 'linear-gradient(90deg, #F8FAFC 0%, #FCA5A5 45%, #991B1B 100%)',
            }}
          />
          <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-500">
            <span>{mobilityIntensityMetric === 'balance' ? 'Emissora' : 'Menor'}</span>
            <span>{mobilityIntensityMetric === 'balance' ? 'Atratora' : 'Maior'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
