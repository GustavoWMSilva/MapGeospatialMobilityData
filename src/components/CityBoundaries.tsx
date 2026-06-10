import React, { useEffect, useMemo, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { featureCollection, polygon, union } from '@turf/turf';
import { fetchWithCache } from '../utils/cacheService';
import { MAP_COLORS } from '../constants/mapColors';
import {
  getAggregateBoundariesPath,
  getAggregateLookupPath,
  getBaseBoundariesPath,
} from '../constants/datasetProfiles';
import { getMobilityIntensityByArea } from '../utils/duckdb';
import type { DemographicFilters, GeographyLevel, MobilityIntensityMetric } from '../types';

interface CityBoundariesProps {
  isVisible?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
  geographyLevel?: GeographyLevel;
  selectedCode?: string | null;
  connectedCodes?: string[];
  showMobilityIntensity?: boolean;
  mobilityIntensityMetric?: MobilityIntensityMetric;
  demographicFilters?: DemographicFilters;
  includeInternalFlows?: boolean;
}

interface LTLAFallbackRow {
  msoaCode: string;
  ltlaCode: string;
  ltlaName: string;
}

type PolygonalGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type BoundaryOutlineRole = 'selected' | 'connected';

interface BoundaryOutlineGroup {
  code: string;
  role: BoundaryOutlineRole;
  properties: GeoJSON.GeoJsonProperties;
  geometries: PolygonalGeometry[];
}

interface MobilityIntensityDatum {
  value: number;
  incomingTotal: number;
  outgoingTotal: number;
  total: number;
  balance: number;
}

const BOUNDARY_CACHE_VERSION = 'boundary-outer-rings-v2';

const withBoundaryCacheVersion = (path: string): string => {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${BOUNDARY_CACHE_VERSION}`;
};

const fetchBoundaryGeoJSON = async (path: string): Promise<GeoJSON.FeatureCollection> => {
  const response = await fetch(withBoundaryCacheVersion(path), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Falha ao carregar boundaries (${response.status})`);
  }

  return response.json() as Promise<GeoJSON.FeatureCollection>;
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const parseLTLALookupCSV = (csvText: string): LTLAFallbackRow[] => {
  return csvText
    .split('\n')
    .slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = parseCSVLine(line);
      return {
        msoaCode: values[0] || '',
        ltlaCode: values[2] || '',
        ltlaName: values[3] || ''
      };
    })
    .filter(row => row.msoaCode && row.ltlaCode);
};

const augmentMissingLTLABoundaries = async (
  ltlaBoundaries: GeoJSON.FeatureCollection
): Promise<GeoJSON.FeatureCollection> => {
  const existingCodes = new Set(
    (ltlaBoundaries.features || [])
      .map(feature => String((feature.properties as any)?.ltla_code || ''))
      .filter(Boolean)
  );

  const lookupCSVText = (await fetchWithCache(getAggregateLookupPath(), false, 'text')) as string;
  const lookupRows = parseLTLALookupCSV(lookupCSVText);

  const fallbackByLTLA = new Map<string, { name: string; msoaCodes: Set<string> }>();
  lookupRows.forEach(row => {
    if (existingCodes.has(row.ltlaCode)) {
      return;
    }

    if (!fallbackByLTLA.has(row.ltlaCode)) {
      fallbackByLTLA.set(row.ltlaCode, {
        name: row.ltlaName,
        msoaCodes: new Set<string>()
      });
    }

    fallbackByLTLA.get(row.ltlaCode)?.msoaCodes.add(row.msoaCode);
  });

  if (fallbackByLTLA.size === 0) {
    return ltlaBoundaries;
  }

  const msoaBoundaries = (await fetchWithCache(getBaseBoundariesPath())) as GeoJSON.FeatureCollection;
  const fallbackFeatures: GeoJSON.Feature[] = [];

  fallbackByLTLA.forEach((group, ltlaCode) => {
    const msoaFeatures = (msoaBoundaries.features || []).filter(feature => {
      const msoaCode = String(
        (feature.properties as any)?.MSOA21CD ||
        (feature.properties as any)?.msoa_code ||
        (feature.properties as any)?.code ||
        ''
      );
      return group.msoaCodes.has(msoaCode);
    });

    msoaFeatures.forEach(feature => {
      fallbackFeatures.push({
        type: 'Feature',
        geometry: feature.geometry,
        properties: {
          ltla_code: ltlaCode,
          ltla_name: group.name,
          is_fallback_msoa: true
        }
      });
    });
  });

  if (fallbackFeatures.length === 0) {
    return ltlaBoundaries;
  }

  if (import.meta.env.DEV) {
    console.warn(
      `LTLA boundaries faltantes detectadas: adicionando ${fallbackFeatures.length} features de fallback MSOA`
    );
  }

  return {
    ...ltlaBoundaries,
    features: [...(ltlaBoundaries.features || []), ...fallbackFeatures]
  };
};

const keepOnlyOuterRings = (geometry: GeoJSON.Geometry): GeoJSON.Geometry => {
  if (geometry.type === 'Polygon') {
    const outerRing = geometry.coordinates[0];
    return outerRing
      ? {
          type: 'Polygon',
          coordinates: [outerRing],
        }
      : geometry;
  }

  if (geometry.type === 'MultiPolygon') {
    const polygons = geometry.coordinates
      .map((polygon) => polygon[0])
      .filter((outerRing): outerRing is GeoJSON.Position[] => Boolean(outerRing))
      .map((outerRing) => [outerRing]);

    return polygons.length > 0
      ? {
          type: 'MultiPolygon',
          coordinates: polygons,
        }
      : geometry;
  }

  return geometry;
};

const getFeatureAreaCode = (feature: GeoJSON.Feature): string => {
  const properties = feature.properties || {};

  return String(
    (properties as any).ltla_code ||
    (properties as any).MSOA21CD ||
    (properties as any).msoa_code ||
    (properties as any).code ||
    ''
  );
};

const isPolygonalGeometry = (geometry: GeoJSON.Geometry | null): geometry is PolygonalGeometry => {
  return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
};

const isValidLinearRing = (ring: GeoJSON.Position[] | undefined): ring is GeoJSON.Position[] => {
  return Boolean(ring && ring.length >= 4);
};

const toOuterRingPolygons = (
  geometry: PolygonalGeometry
): Array<GeoJSON.Feature<GeoJSON.Polygon>> => {
  if (geometry.type === 'Polygon') {
    const outerRing = geometry.coordinates[0];
    return isValidLinearRing(outerRing) ? [polygon([outerRing])] : [];
  }

  return geometry.coordinates
    .map((polygonCoordinates) => polygonCoordinates[0])
    .filter(isValidLinearRing)
    .map((outerRing) => polygon([outerRing]));
};

const mergeOutlineGeometries = (geometries: PolygonalGeometry[]): PolygonalGeometry | null => {
  const outerRingPolygons = geometries.flatMap(toOuterRingPolygons);

  if (outerRingPolygons.length === 0) {
    return null;
  }

  if (outerRingPolygons.length === 1) {
    return outerRingPolygons[0].geometry;
  }

  try {
    const merged = union(featureCollection(outerRingPolygons));

    if (merged?.geometry && isPolygonalGeometry(merged.geometry)) {
      return keepOnlyOuterRings(merged.geometry) as PolygonalGeometry;
    }
  } catch (error) {
    console.warn('Falha ao dissolver contorno da area selecionada:', error);
  }

  return {
    type: 'MultiPolygon',
    coordinates: outerRingPolygons.map((feature) => feature.geometry.coordinates),
  };
};

const buildBoundaryOutlineData = (
  boundariesData: GeoJSON.FeatureCollection,
  selectedCode: string | null,
  connectedCodes: string[]
): GeoJSON.FeatureCollection => {
  const connectedCodeSet = new Set(connectedCodes);
  const groups = new Map<string, BoundaryOutlineGroup>();

  (boundariesData.features || []).forEach((feature) => {
    const code = getFeatureAreaCode(feature);
    const isSelected = Boolean(selectedCode && code === selectedCode);
    const isConnected = connectedCodeSet.has(code);

    if (!code || (!isSelected && !isConnected) || !isPolygonalGeometry(feature.geometry)) {
      return;
    }

    const role: BoundaryOutlineRole = isSelected ? 'selected' : 'connected';
    const existingGroup = groups.get(code);

    if (existingGroup) {
      existingGroup.geometries.push(feature.geometry);
      if (role === 'selected') {
        existingGroup.role = 'selected';
      }
      return;
    }

    groups.set(code, {
      code,
      role,
      properties: feature.properties || {},
      geometries: [feature.geometry],
    });
  });

  return {
    type: 'FeatureCollection',
    features: Array.from(groups.values()).flatMap((group) => {
      const geometry = mergeOutlineGeometries(group.geometries);

      if (!geometry) {
        return [];
      }

      return [{
        type: 'Feature',
        geometry,
        properties: {
          ...group.properties,
          outline_code: group.code,
          outline_role: group.role,
        },
      }];
    }),
  };
};

const buildIntensityBoundariesData = (
  boundariesData: GeoJSON.FeatureCollection,
  intensityByCode: Map<string, MobilityIntensityDatum>,
  metric: MobilityIntensityMetric
): GeoJSON.FeatureCollection => {
  const rawValues = Array.from(intensityByCode.values()).map((datum) => datum.value);
  const maxValue =
    metric === 'balance'
      ? Math.max(1, ...rawValues.map((value) => Math.abs(value)))
      : Math.max(1, ...rawValues);

  return {
    ...boundariesData,
    features: (boundariesData.features || []).map((feature) => {
      const code = getFeatureAreaCode(feature);
      const datum = intensityByCode.get(code);
      const value = datum?.value ?? 0;
      const normalized =
        metric === 'balance'
          ? (value + maxValue) / (maxValue * 2)
          : value / maxValue;

      return {
        ...feature,
        properties: {
          ...(feature.properties || {}),
          mobility_intensity_value: value,
          mobility_intensity_norm: Math.max(0, Math.min(1, normalized)),
          mobility_intensity_incoming: datum?.incomingTotal ?? 0,
          mobility_intensity_outgoing: datum?.outgoingTotal ?? 0,
          mobility_intensity_total: datum?.total ?? 0,
          mobility_intensity_balance: datum?.balance ?? 0,
        },
      };
    }),
  };
};

export const CityBoundaries: React.FC<CityBoundariesProps> = ({
  isVisible = true,
  borderColor = MAP_COLORS.boundaries.line,
  borderWidth = 5,
  fillColor = MAP_COLORS.boundaries.fill,
  fillOpacity = MAP_COLORS.boundaries.fillOpacity,
  geographyLevel = 'aggregate',
  selectedCode = null,
  connectedCodes = [],
  showMobilityIntensity = false,
  mobilityIntensityMetric = 'total',
  demographicFilters = {},
  includeInternalFlows = false
}) => {
  const [boundariesData, setBoundariesData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [intensityByCode, setIntensityByCode] = useState<Map<string, MobilityIntensityDatum>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const boundaryFile =
      geographyLevel === 'aggregate'
        ? getAggregateBoundariesPath()
        : getBaseBoundariesPath();

    const loadBoundaries = async () => {
      try {
        let geojson = await fetchBoundaryGeoJSON(boundaryFile);

        if (geographyLevel === 'aggregate') {
          geojson = await augmentMissingLTLABoundaries(geojson);
        }

        setBoundariesData(geojson);
      } catch {
        // Falha silenciosa - boundaries são opcionais
      } finally {
        setLoading(false);
      }
    };

    void loadBoundaries();
  }, [geographyLevel]);

  useEffect(() => {
    let cancelled = false;

    if (!showMobilityIntensity) {
      setIntensityByCode(new Map());
      return;
    }

    const loadIntensity = async () => {
      try {
        const rows = await getMobilityIntensityByArea(
          demographicFilters,
          geographyLevel,
          mobilityIntensityMetric,
          includeInternalFlows
        );

        if (cancelled) {
          return;
        }

        setIntensityByCode(
          new Map(
            rows.map((row) => [
              row.area_code,
              {
                value: row.value,
                incomingTotal: row.incoming_total,
                outgoingTotal: row.outgoing_total,
                total: row.total,
                balance: row.balance,
              },
            ])
          )
        );
      } catch (error) {
        console.warn('Falha ao carregar intensidade de mobilidade:', error);
        if (!cancelled) {
          setIntensityByCode(new Map());
        }
      }
    };

    void loadIntensity();

    return () => {
      cancelled = true;
    };
  }, [demographicFilters, geographyLevel, includeInternalFlows, mobilityIntensityMetric, showMobilityIntensity]);

  const outlineBoundariesData = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!boundariesData) {
      return null;
    }

    return buildBoundaryOutlineData(boundariesData, selectedCode, connectedCodes);
  }, [boundariesData, selectedCode, connectedCodes]);

  const displayBoundariesData = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!boundariesData) {
      return null;
    }

    if (!showMobilityIntensity) {
      return boundariesData;
    }

    return buildIntensityBoundariesData(boundariesData, intensityByCode, mobilityIntensityMetric);
  }, [boundariesData, intensityByCode, mobilityIntensityMetric, showMobilityIntensity]);

  if (loading || !boundariesData || !displayBoundariesData || !outlineBoundariesData || !isVisible) {
    return null;
  }

  const areaCodeExpression: any = [
    'coalesce',
    ['get', 'ltla_code'],
    ['get', 'MSOA21CD'],
    ['get', 'msoa_code'],
    ['get', 'code']
  ];

  const isSelectedExpression: any = ['==', areaCodeExpression, selectedCode || '__none__'];
  const isConnectedExpression: any = ['in', areaCodeExpression, ['literal', connectedCodes]];
  const isFallbackMsoaExpression: any = ['==', ['coalesce', ['get', 'is_fallback_msoa'], false], true];
  const intensityColorExpression: any =
    mobilityIntensityMetric === 'balance'
      ? [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'mobility_intensity_norm'], 0.5],
          0,
          MAP_COLORS.mobility.balance[0],
          0.25,
          MAP_COLORS.mobility.balance[1],
          0.5,
          MAP_COLORS.mobility.balance[2],
          0.75,
          MAP_COLORS.mobility.balance[3],
          1,
          MAP_COLORS.mobility.balance[4]
        ]
      : [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'mobility_intensity_norm'], 0],
          0,
          MAP_COLORS.mobility.sequential[0],
          0.25,
          MAP_COLORS.mobility.sequential[1],
          0.5,
          MAP_COLORS.mobility.sequential[2],
          0.75,
          MAP_COLORS.mobility.sequential[3],
          1,
          MAP_COLORS.mobility.sequential[4]
        ];
  const boundaryFillColor: any = showMobilityIntensity
    ? intensityColorExpression
    : [
        'case',
        isSelectedExpression,
        MAP_COLORS.boundaries.selectedFill,
        isConnectedExpression,
        MAP_COLORS.boundaries.connectedFill,
        fillColor
      ];
  const boundaryFillOpacity: any = showMobilityIntensity
    ? MAP_COLORS.mobility.fillOpacity
    : [
        'case',
        isSelectedExpression,
        MAP_COLORS.boundaries.selectedFillOpacity,
        isConnectedExpression,
        MAP_COLORS.boundaries.connectedFillOpacity,
        isFallbackMsoaExpression,
        0,
        fillOpacity
      ];

  return (
    <>
      <Source id={`${geographyLevel}-boundaries`} type="geojson" data={displayBoundariesData}>
        <Layer
          id={`${geographyLevel}-boundaries-fill`}
          type="fill"
          paint={{
            'fill-color': boundaryFillColor,
            'fill-opacity': boundaryFillOpacity
          }}
        />

        <Layer
          id={`${geographyLevel}-boundaries-clickable`}
          type="fill"
          paint={{
            'fill-color': 'transparent',
            'fill-opacity': 0.01
          }}
        />

        <Layer
          id={`${geographyLevel}-boundaries-line`}
          type="line"
          paint={{
            'line-color': borderColor,
            'line-width': borderWidth,
            'line-opacity': [
              'case',
              isSelectedExpression,
              0,
              isConnectedExpression,
              0,
              isFallbackMsoaExpression,
              0,
              MAP_COLORS.boundaries.baseLineOpacity
            ]
          }}
        />
      </Source>

      <Source
        id={`${geographyLevel}-selected-boundaries-outer-rings`}
        type="geojson"
        data={outlineBoundariesData}
      >
        <Layer
          id={`${geographyLevel}-selected-boundaries-outer-line`}
          type="line"
          layout={{
            'line-cap': 'round',
            'line-join': 'round'
          }}
          paint={{
            'line-color': [
              'case',
              ['==', ['get', 'outline_role'], 'selected'],
              MAP_COLORS.boundaries.selectedLine,
              ['==', ['get', 'outline_role'], 'connected'],
              MAP_COLORS.boundaries.connectedLine,
              'transparent'
            ],
            'line-width': [
              'case',
              ['==', ['get', 'outline_role'], 'selected'],
              MAP_COLORS.boundaries.selectedLineWidth,
              ['==', ['get', 'outline_role'], 'connected'],
              MAP_COLORS.boundaries.connectedLineWidth,
              0
            ],
            'line-opacity': [
              'case',
              ['==', ['get', 'outline_role'], 'selected'],
              MAP_COLORS.boundaries.selectedLineOpacity,
              ['==', ['get', 'outline_role'], 'connected'],
              MAP_COLORS.boundaries.connectedLineOpacity,
              0
            ]
          }}
        />
      </Source>
    </>
  );
};
