import React, { useEffect, useState } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';
import { fetchWithCache } from '../utils/cacheService';
import { MAP_COLORS } from '../constants/mapColors';

interface CityBoundariesProps {
  isVisible?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
  dataSource?: 'ltla' | 'msoa';
  selectedCode?: string | null;
  connectedCodes?: string[];
}

interface LTLAFallbackRow {
  msoaCode: string;
  ltlaCode: string;
  ltlaName: string;
}

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

  const lookupCSVText = (await fetchWithCache('/data/lookup/ltla_lookup.csv', false, 'text')) as string;
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

  const msoaBoundaries = (await fetchWithCache('/data/lookup/boundaries.geojson')) as GeoJSON.FeatureCollection;
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

export const CityBoundaries: React.FC<CityBoundariesProps> = ({
  isVisible = true,
  borderColor = MAP_COLORS.boundaries.line,
  borderWidth = 5,
  fillColor = MAP_COLORS.boundaries.fill,
  fillOpacity = MAP_COLORS.boundaries.fillOpacity,
  dataSource = 'ltla',
  selectedCode = null,
  connectedCodes = []
}) => {
  const [boundariesData, setBoundariesData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const boundaryFile =
      dataSource === 'ltla'
        ? '/data/lookup/ltla_boundaries.geojson'
        : '/data/lookup/boundaries.geojson';

    const loadBoundaries = async () => {
      try {
        const data = await fetchWithCache(boundaryFile);
        let geojson = data as GeoJSON.FeatureCollection;

        if (dataSource === 'ltla') {
          geojson = await augmentMissingLTLABoundaries(geojson);
        }

        setBoundariesData(geojson);
        console.log(
          `Boundaries ${dataSource.toUpperCase()} carregadas:`,
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
  }, [dataSource]);

  if (loading || !boundariesData || !isVisible) {
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

  return (
    <>
      <Source id={`${dataSource}-boundaries`} type="geojson" data={boundariesData}>
        <Layer
          id={`${dataSource}-boundaries-fill`}
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
          id={`${dataSource}-boundaries-clickable`}
          type="fill"
          paint={{
            'fill-color': 'transparent',
            'fill-opacity': 0.01
          }}
        />

        <Layer
          id={`${dataSource}-boundaries-line`}
          type="line"
          paint={{
            'line-color': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedLine,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedLine,
              borderColor
            ],
            'line-width': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedLineWidth,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedLineWidth,
              borderWidth
            ],
            'line-opacity': [
              'case',
              isSelectedExpression,
              MAP_COLORS.boundaries.selectedLineOpacity,
              isConnectedExpression,
              MAP_COLORS.boundaries.connectedLineOpacity,
              isFallbackMsoaExpression,
              0,
              MAP_COLORS.boundaries.baseLineOpacity
            ]
          }}
        />
      </Source>
    </>
  );
};
