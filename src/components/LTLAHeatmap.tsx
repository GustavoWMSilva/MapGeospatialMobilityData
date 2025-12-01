import React, { useEffect, useState, useMemo } from 'react';
import { Source, Layer } from '@vis.gl/react-maplibre';

interface LTLACentroid {
  code: string;
  name: string;
  lat: number;
  lon: number;
  msoa_count: number;
}

interface LTLAFlowData {
  code: string;
  name: string;
  incoming_count: number;
  outgoing_count: number;
}

interface LTLAHeatmapProps {
  isVisible?: boolean;
  flowDirection?: 'incoming' | 'outgoing';
}

export const LTLAHeatmap: React.FC<LTLAHeatmapProps> = ({
  isVisible = true,
  flowDirection = 'incoming'
}) => {
  const [centroids, setCentroids] = useState<LTLACentroid[]>([]);
  const [flowsData, setFlowsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar centróides LTLA
  useEffect(() => {
    fetch('/data/lookup/ltla_centroids.csv')
      .then(response => response.text())
      .then(text => {
        const lines = text.trim().split('\n');
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          return {
            code: values[0],
            name: values[1],
            lat: parseFloat(values[2]),
            lon: parseFloat(values[3]),
            msoa_count: parseInt(values[4] || '0')
          };
        });
        setCentroids(data);
      })
      .catch(err => console.error('❌ Erro ao carregar centróides:', err));
  }, []);

  // Carregar dados de fluxos
  useEffect(() => {
    fetch('/ltla_flows.geojson')
      .then(response => response.json())
      .then(data => {
        setFlowsData(data.features || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('❌ Erro ao carregar fluxos:', err);
        setLoading(false);
      });
  }, []);

  // Agregar fluxos por LTLA
  const heatmapData = useMemo(() => {
    if (centroids.length === 0 || flowsData.length === 0) {
      return null;
    }

    // Calcular total de fluxos por LTLA
    const flowsByLTLA: { [key: string]: LTLAFlowData } = {};

    centroids.forEach(centroid => {
      flowsByLTLA[centroid.code] = {
        code: centroid.code,
        name: centroid.name,
        incoming_count: 0,
        outgoing_count: 0
      };
    });

    flowsData.forEach(feature => {
      const props = feature.properties;
      const origin = props.origin_code;
      const dest = props.dest_code;
      const count = props.count || 0;

      if (flowsByLTLA[dest]) {
        flowsByLTLA[dest].incoming_count += count;
      }
      if (flowsByLTLA[origin]) {
        flowsByLTLA[origin].outgoing_count += count;
      }
    });

    // Criar features para heatmap
    const features = centroids.map(centroid => {
      const flowData = flowsByLTLA[centroid.code];
      const intensity = flowDirection === 'incoming' 
        ? flowData?.incoming_count || 0 
        : flowData?.outgoing_count || 0;

      return {
        type: 'Feature' as const,
        properties: {
          code: centroid.code,
          name: centroid.name,
          intensity: intensity,
          msoa_count: centroid.msoa_count
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [centroid.lon, centroid.lat]
        }
      };
    });

    const maxIntensity = Math.max(...features.map(f => f.properties.intensity));
    console.log(`📊 Heatmap: ${features.length} pontos, intensidade máxima: ${maxIntensity.toLocaleString()}`);

    return {
      type: 'FeatureCollection' as const,
      features: features
    };
  }, [centroids, flowsData, flowDirection]);

  if (loading || !heatmapData || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Legenda do Heatmap */}
      <div className="absolute top-20 right-4 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 p-5 z-10" style={{ width: '280px' }}>
        <div className="flex items-center gap-2 mb-4">

          <h3 className="text-base font-bold text-gray-800">
            Heatmap de Intensidade
          </h3>
        </div>
        
        <div className="mb-3">
          <p className="text-xs text-gray-600 mb-2">
            {flowDirection === 'incoming' 
              ? 'Fluxos que CHEGAM em cada distrito' 
              : 'Fluxos que SAEM de cada distrito'}
          </p>
        </div>

        {/* Barra de Gradiente Contínuo */}
        <div className="mb-4">
          <div className="h-6 rounded-lg shadow-inner relative overflow-hidden" 
               style={{ 
                 background: 'linear-gradient(to right, rgba(255,255,255,0.3) 0%, #FEF3C7 20%, #FCD34D 40%, #F59E0B 60%, #EF4444 80%, #991B1B 100%)'
               }}>
            <div className="absolute inset-0 border-2 border-gray-300 rounded-lg pointer-events-none"></div>
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-xs font-semibold text-gray-600">Baixo</span>
            <span className="text-xs font-semibold text-gray-600">Alto</span>
          </div>
        </div>

        {/* Escala de Cores */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <div className="w-12 h-5 rounded shadow-sm border border-gray-300" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}></div>
            <span className="text-sm font-medium text-gray-700">0 - 10k</span>
          </div>
          <div className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <div className="w-12 h-5 rounded shadow-sm" style={{ backgroundColor: '#FEF3C7' }}></div>
            <span className="text-sm font-medium text-gray-700">10k - 50k</span>
          </div>
          <div className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <div className="w-12 h-5 rounded shadow-sm" style={{ backgroundColor: '#FCD34D' }}></div>
            <span className="text-sm font-medium text-gray-700">50k - 100k</span>
          </div>
          <div className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <div className="w-12 h-5 rounded shadow-sm" style={{ backgroundColor: '#F59E0B' }}></div>
            <span className="text-sm font-semibold text-gray-800">100k - 200k</span>
          </div>
          <div className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <div className="w-12 h-5 rounded shadow-md" style={{ backgroundColor: '#EF4444' }}></div>
            <span className="text-sm font-semibold text-gray-800">200k - 300k</span>
          </div>
          <div className="flex items-center gap-3 group hover:bg-gray-50 p-2 rounded-lg transition-colors">
            <div className="w-12 h-5 rounded shadow-lg border border-gray-700" style={{ backgroundColor: '#991B1B' }}></div>
            <span className="text-sm font-bold text-gray-900">300k+</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t-2 border-gray-200">
          <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
            <span className="text-amber-600 text-lg">💡</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Dica:</strong> Áreas mais vermelhas têm maior concentração de fluxos
            </p>
          </div>
        </div>
      </div>

      {/* Layer de Heatmap */}
      <Source
        id="ltla-heatmap"
        type="geojson"
        data={heatmapData}
      >
        {/* Heatmap Layer */}
        <Layer
          id="ltla-heatmap-layer"
          type="heatmap"
          paint={{
            // Peso baseado na intensidade
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 0,
              500000, 1
            ],
            // Intensidade do heatmap
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 0.5,
              9, 1.5
            ],
            // Cor do heatmap
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(255,255,255,0)',
              0.1, 'rgba(254, 243, 199, 0.4)',  // Amarelo muito claro
              0.3, 'rgba(252, 211, 77, 0.6)',   // Amarelo
              0.5, 'rgba(245, 158, 11, 0.7)',   // Laranja
              0.7, 'rgba(239, 68, 68, 0.8)',    // Vermelho
              0.9, 'rgba(153, 27, 27, 0.9)'     // Vermelho escuro
            ],
            // Raio do heatmap
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              0, 15,
              5, 30,
              9, 50
            ],
            // Opacidade
            'heatmap-opacity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              5, 0.8,
              9, 0.6
            ]
          }}
        />

        {/* Círculos para zoom alto */}
        <Layer
          id="ltla-heatmap-circles"
          type="circle"
          minzoom={7}
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 3,
              50000, 8,
              100000, 12,
              200000, 16,
              300000, 20,
              500000, 25
            ],
            'circle-color': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 'rgba(255,255,255,0.5)',
              10000, '#FEF3C7',
              50000, '#FCD34D',
              100000, '#F59E0B',
              200000, '#EF4444',
              300000, '#991B1B'
            ],
            'circle-opacity': 0.7,
            'circle-stroke-width': 2,
            'circle-stroke-color': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, '#E5E7EB',
              100000, '#F59E0B',
              200000, '#DC2626',
              300000, '#7F1D1D'
            ],
            'circle-stroke-opacity': 0.8
          }}
        />

        {/* Labels para círculos em zoom alto */}
        <Layer
          id="ltla-heatmap-labels"
          type="symbol"
          minzoom={8}
          layout={{
            'text-field': [
              'format',
              ['get', 'name'],
              {},
              '\n',
              {},
              ['number-format', ['get', 'intensity'], { 'min-fraction-digits': 0, 'max-fraction-digits': 0 }],
              { 'font-scale': 0.8 }
            ],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-offset': [0, 0.5],
            'text-anchor': 'top'
          }}
          paint={{
            'text-color': '#1F2937',
            'text-halo-color': '#FFFFFF',
            'text-halo-width': 2,
            'text-halo-blur': 1
          }}
        />
      </Source>
    </>
  );
};
