import React, { useEffect, useMemo, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { fetchWithCache } from '../utils/cacheService';
import { MAP_COLORS } from '../constants/mapColors';
import {
  getAggregateBoundariesPath,
  getAggregateLookupPath,
  getBaseBoundariesPath,
} from '../constants/datasetProfiles';
import type { GeographyLevel } from '../types';

interface CityBoundariesProps {
  isVisible?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
  geographyLevel?: GeographyLevel;
  selectedCode?: string | null;
  connectedCodes?: string[];
}

interface LTLAFallbackRow {
  msoaCode: string;
  ltlaCode: string;
  ltlaName: string;
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

  console.warn(
    `LTLA boundaries faltantes detectadas: adicionando ${fallbackFeatures.length} features de fallback MSOA`
  );

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

export const CityBoundaries: React.FC<CityBoundariesProps> = ({
  isVisible = true,
  borderColor = MAP_COLORS.boundaries.line,
  borderWidth = 5,
  fillColor = MAP_COLORS.boundaries.fill,
  fillOpacity = MAP_COLORS.boundaries.fillOpacity,
  geographyLevel = 'aggregate',
  selectedCode = null,
  connectedCodes = []
}) => {
  const [boundariesData, setBoundariesData] = useState<GeoJSON.FeatureCollection | null>(null);
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
        console.log(
          `Boundaries ${geographyLevel.toUpperCase()} carregadas:`,
          geojson.features?.length || 0,
          'áreas'
        );
      } catch {
        // Falha silenciosa - boundaries são opcionais
      } finally {
        setLoading(false);
      }
    };

    void loadBoundaries();
  }, [geographyLevel]);

  const outerRingBoundariesData = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!boundariesData) {
      return null;
    }

    return {
      ...boundariesData,
      features: (boundariesData.features || []).map((feature) => ({
        ...feature,
        geometry: keepOnlyOuterRings(feature.geometry),
      })),
    };
  }, [boundariesData]);

  if (loading || !boundariesData || !outerRingBoundariesData || !isVisible) {
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
  const baseBoundaryLineOpacity = selectedCode ? 0 : MAP_COLORS.boundaries.baseLineOpacity;

  return (
    <>
      <Source id={`${geographyLevel}-boundaries`} type="geojson" data={boundariesData}>
        <Layer
          id={`${geographyLevel}-boundaries-fill`}
          type="fill"
          paint={{
            'fill-color': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedFill,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedFill,
              fillColor
            ],
            'fill-opacity': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedFillOpacity,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedFillOpacity,
              isFallbackMsoaExpression,
              0,
              fillOpacity
            ]
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
              isFallbackMsoaExpression,
              0,
              baseBoundaryLineOpacity
            ]
          }}
        />
      </Source>

      <Source
        id={`${geographyLevel}-selected-boundaries-outer-rings`}
        type="geojson"
        data={outerRingBoundariesData}
      >
        <Layer
          id={`${geographyLevel}-selected-boundaries-outer-line`}
          type="line"
          paint={{
            'line-color': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedLine,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedLine,
              'transparent'
            ],
            'line-width': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedLineWidth,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedLineWidth,
              0
            ],
            'line-opacity': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedLineOpacity,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedLineOpacity,
              0
            ]
          }}
        />
      </Source>
    </>
  );
};
