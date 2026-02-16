import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAgeStats } from '../../utils/duckdb';
import { debugLog, debugWarn, getAnalyticsErrorMessage } from './analyticsUtils';

interface AgeBarChartProps {
  areaCode: string;
  direction?: 'incoming' | 'outgoing';
}

const AGE_COLORS: Record<string, string> = {
  '16-24': '#8b5cf6', // Roxo
  '25-34': '#3b82f6', // Azul
  '35-44': '#10b981', // Verde
  '45-54': '#f59e0b', // Amarelo
  '55-64': '#f97316', // Laranja
  '65+': '#ef4444',   // Vermelho
};

function getAgeColor(ageGroup: string): string {
  if (ageGroup.includes('16 to 24')) return AGE_COLORS['16-24'];
  if (ageGroup.includes('25 to 34')) return AGE_COLORS['25-34'];
  if (ageGroup.includes('35 to 44')) return AGE_COLORS['35-44'];
  if (ageGroup.includes('45 to 54')) return AGE_COLORS['45-54'];
  if (ageGroup.includes('55 to 64')) return AGE_COLORS['55-64'];
  if (ageGroup.includes('65')) return AGE_COLORS['65+'];
  return '#666';
}

function simplifyAgeLabel(ageGroup: string): string {
  if (ageGroup.includes('16 to 24')) return '16-24';
  if (ageGroup.includes('25 to 34')) return '25-34';
  if (ageGroup.includes('35 to 44')) return '35-44';
  if (ageGroup.includes('45 to 54')) return '45-54';
  if (ageGroup.includes('55 to 64')) return '55-64';
  if (ageGroup.includes('65')) return '65+';
  return ageGroup;
}

export function AgeBarChart({ areaCode, direction = 'incoming' }: AgeBarChartProps) {
  const [data, setData] = useState<Array<{ name: string; total: number; percentage: number; color: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugLog(`[AgeBarChart] useEffect areaCode=${areaCode} direction=${direction}`);
    
    // Limpar dados imediatamente ao trocar de área
    setData([]);
    setError(null);
    setLoading(true);
    
    async function loadStats() {
      if (!areaCode) {
        debugLog('[AgeBarChart] aguardando selecao de area');
        setLoading(false);
        return;
      }
      
      debugLog(`[AgeBarChart] carregando stats para ${areaCode} (${direction})`);
      
      try {
        setLoading(true);
        setError(null);
        
        const stats = await getAgeStats(areaCode, direction);
        debugLog('[AgeBarChart] stats recebidas', stats);
        
        if (stats.length === 0) {
          debugWarn('[AgeBarChart] nenhum dado retornado');
          setData([]);
          setLoading(false);
          return;
        }
        
        const chartData = stats.map(s => ({
          name: simplifyAgeLabel(s.ageGroup),
          fullName: s.ageGroup,
          total: s.total,
          percentage: s.percentage,
          color: getAgeColor(s.ageGroup),
        }));
        
        // Ordenar por faixa etária
        const ageOrder = ['16-24', '25-34', '35-44', '45-54', '55-64', '65+'];
        chartData.sort((a, b) => ageOrder.indexOf(a.name) - ageOrder.indexOf(b.name));
        
        debugLog(`[AgeBarChart] dados processados (${chartData.length} grupos)`);
        setData(chartData);
      } catch (err) {
        console.error('[AgeBarChart] erro ao carregar', err);
        setError(getAnalyticsErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    
    loadStats();
    
    // Cleanup ao desmontar ou trocar de área
    return () => {
      debugLog(`[AgeBarChart] limpando dados de ${areaCode}`);
      setData([]);
    };
  }, [areaCode, direction]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 p-4 text-center">
        <p className="font-semibold">Dados de Age Group não disponíveis</p>
        <p className="text-sm mt-2">Dataset ODWP04EW_MSOA não carregado</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Age Groups Distribution
        </h3>
        <p className="text-sm text-gray-600">
          {direction === 'incoming' ? 'Incoming' : 'Outgoing'} commuters by age group
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip 
            formatter={(value: number | string | Array<number | string> | undefined, _name: string | undefined, props: any) => [
              `${Number(value ?? 0).toLocaleString()} (${props.payload.percentage}%)`,
              'Commuters'
            ]}
          />
          <Legend formatter={() => 'Commuters'} />
          <Bar dataKey="total" fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">
              {item.name}: <strong>{item.total.toLocaleString()}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
