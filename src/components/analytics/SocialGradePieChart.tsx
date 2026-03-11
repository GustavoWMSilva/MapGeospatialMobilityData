import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getSocialGradeStats } from '../../utils/duckdb';
import { debugLog, debugWarn, getAnalyticsErrorMessage } from './analyticsUtils';
import type { SocialGrade } from '../../types';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface SocialGradePieChartProps {
  areaCode: string;
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
  selectedGrade?: SocialGrade;
  onSelectGrade?: (grade: SocialGrade) => void;
}

interface SocialGradeChartDatum {
  code: SocialGrade;
  name: string;
  value: number;
  percentage: number;
  color: string;
}

const COLORS = MAP_COLORS.analytics.socialGrade;

const GRADE_LABELS: Record<string, string> = {
  AB: 'AB - Professional',
  C1: 'C1 - Middle Class',
  C2: 'C2 - Skilled Workers',
  DE: 'DE - Working Class',
};

export function SocialGradePieChart({
  areaCode,
  direction = 'incoming',
  includeInternalFlows = false,
  selectedGrade = 'all',
  onSelectGrade,
}: SocialGradePieChartProps) {
  const [data, setData] = useState<SocialGradeChartDatum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    debugLog(`[SocialGradePieChart] useEffect areaCode=${areaCode} direction=${direction}`);
    
    // Limpar dados imediatamente ao trocar de Ã¡rea
    setData([]);
    setError(null);
    setLoading(true);
    
    async function loadStats() {
      if (!areaCode) {
        debugLog('[SocialGradePieChart] aguardando selecao de area');
        setLoading(false);
        return;
      }
      
      debugLog(`[SocialGradePieChart] carregando stats para ${areaCode} (${direction})`);
      
      try {
        setLoading(true);
        setError(null);
        
        const stats = await getSocialGradeStats(areaCode, direction, includeInternalFlows);
        debugLog('[SocialGradePieChart] stats recebidas', stats);
        
        if (stats.length === 0) {
          debugWarn('[SocialGradePieChart] nenhum dado retornado');
          setData([]);
          setLoading(false);
          return;
        }
        
        const chartData = stats.map(s => {
          const gradeCode = s.grade.split(' ')[0] as keyof typeof COLORS;
          return {
            code: (gradeCode as SocialGrade) || 'all',
            name: GRADE_LABELS[gradeCode] || gradeCode,
            fullName: s.grade,
            value: s.total,
            percentage: s.percentage,
            color: COLORS[gradeCode] || '#666',
          };
        });
        
        debugLog(`[SocialGradePieChart] dados processados (${chartData.length} categorias)`);
        setData(chartData);
      } catch (err) {
        console.error('[SocialGradePieChart] erro ao carregar', err);
        setError(getAnalyticsErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    
    loadStats();
    
    // Cleanup ao desmontar ou trocar de Ã¡rea
    return () => {
      debugLog(`[SocialGradePieChart] limpando dados de ${areaCode}`);
      setData([]);
    };
  }, [areaCode, direction, includeInternalFlows]);

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
        <p className="font-semibold">Dados de Social Grade nÃ£o disponÃ­veis</p>
        <p className="text-sm mt-2">Dataset ODWP09EW_MSOA nÃ£o carregado</p>
      </div>
    );
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    if (percentage < 7) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="font-semibold text-sm"
      >
        {`${percentage.toFixed(1)}%`}
      </text>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">
            Social Grade Distribution
          </h3>
          <ChartObjectiveHelp objective="Mostrar a composiÃ§Ã£o social dos fluxos da Ã¡rea selecionada para identificar diferenÃ§as estruturais entre classes." />
        </div>
        <p className="text-sm text-gray-600">
          {direction === 'incoming' ? 'Incoming' : 'Outgoing'} commuters by social class
        </p>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <PieChart margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomLabel}
            innerRadius={46}
            outerRadius={112}
            fill="#8884d8"
            dataKey="value"
            onClick={(_, index) => {
              if (index === undefined) return;
              const clicked = data[index];
              if (!clicked || !onSelectGrade) return;
              onSelectGrade(selectedGrade === clicked.code ? 'all' : clicked.code);
            }}
            cursor="pointer"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                fillOpacity={selectedGrade === 'all' || selectedGrade === entry.code ? 1 : 0.25}
                stroke={selectedGrade === entry.code ? '#111827' : '#ffffff'}
                strokeWidth={selectedGrade === entry.code ? 3 : 1}
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number | string | Array<number | string> | undefined, name: string | undefined, props: any) => [
              `${Number(value ?? 0).toLocaleString()} (${props.payload.percentage}%)`,
              name ?? 'Commuters'
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {data.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => onSelectGrade?.(selectedGrade === item.code ? 'all' : item.code)}
            className={`flex items-center gap-2 rounded px-2 py-1 text-left transition ${
              selectedGrade === item.code ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'
            }`}
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">
              {item.name}: <strong>{item.value.toLocaleString()}</strong>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

