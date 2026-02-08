import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getSocialGradeStats } from '../../utils/duckdb';

interface SocialGradePieChartProps {
  areaCode: string;
  direction?: 'incoming' | 'outgoing';
}

const COLORS = {
  AB: '#2563eb', // Azul - Classe Alta
  C1: '#10b981', // Verde - Classe Média
  C2: '#f59e0b', // Amarelo - Trabalhadores Qualificados
  DE: '#ef4444', // Vermelho - Classe Trabalhadora
};

const GRADE_LABELS: Record<string, string> = {
  AB: 'AB - Professional',
  C1: 'C1 - Middle Class',
  C2: 'C2 - Skilled Workers',
  DE: 'DE - Working Class',
};

export function SocialGradePieChart({ areaCode, direction = 'incoming' }: SocialGradePieChartProps) {
  const [data, setData] = useState<Array<{ name: string; value: number; percentage: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      if (!areaCode) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const stats = await getSocialGradeStats(areaCode, direction);
        
        const chartData = stats.map(s => {
          const gradeCode = s.grade.split(' ')[0] as keyof typeof COLORS;
          return {
            name: GRADE_LABELS[gradeCode] || gradeCode,
            fullName: s.grade,
            value: s.total,
            percentage: s.percentage,
            color: COLORS[gradeCode] || '#666',
          };
        });
        
        setData(chartData);
      } catch (err) {
        console.error('Erro ao carregar estatísticas de social grade:', err);
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    }
    
    loadStats();
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
        <p className="font-semibold">Dados de Social Grade não disponíveis</p>
        <p className="text-sm mt-2">Dataset ODWP09EW_MSOA não carregado</p>
      </div>
    );
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
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
        <h3 className="text-lg font-semibold text-gray-800">
          Social Grade Distribution
        </h3>
        <p className="text-sm text-gray-600">
          {direction === 'incoming' ? 'Incoming' : 'Outgoing'} commuters by social class
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number, name: string, props: any) => [
              `${value.toLocaleString()} (${props.payload.percentage}%)`,
              name
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-700">
              {item.name}: <strong>{item.value.toLocaleString()}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
