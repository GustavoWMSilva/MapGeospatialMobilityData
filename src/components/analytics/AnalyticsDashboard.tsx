import { useState, useEffect } from 'react';
import { SocialGradePieChart } from './SocialGradePieChart';
import { AgeBarChart } from './AgeBarChart';
import { AnalyticsFilters } from './AnalyticsFilters';
import { DirectionDebugPanel } from './DirectionDebugPanel';
import { DataAvailabilityCheck } from './DataAvailabilityCheck';
import { getMSOAFlowsBySocialGrade, getMSOAFlowsByAge, getMSOAFlowsBySocialGradeAndAge } from '../../utils/duckdb';
import type { SocialGrade, AgeGroup } from '../../types';
import { debugLog, getAnalyticsErrorMessage, isDevMode } from './analyticsUtils';

interface AnalyticsDashboardProps {
  selectedArea?: string;
  areaName?: string;
  socialGrade?: SocialGrade;
  ageGroup?: AgeGroup;
  direction?: 'incoming' | 'outgoing';
  onSocialGradeChange?: (grade: SocialGrade) => void;
  onAgeGroupChange?: (age: AgeGroup) => void;
  onDirectionChange?: (direction: 'incoming' | 'outgoing') => void;
}

export function AnalyticsDashboard({ 
  selectedArea, 
  areaName,
  socialGrade = 'all',
  ageGroup = 'all',
  direction = 'incoming',
  onSocialGradeChange,
  onAgeGroupChange,
  onDirectionChange
}: AnalyticsDashboardProps) {
  const [flowCount, setFlowCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [flowCountError, setFlowCountError] = useState<string | null>(null);

  useEffect(() => {
    debugLog(`[AnalyticsDashboard] direction=${direction}`);
  }, [direction]);

  useEffect(() => {
    debugLog(`[AnalyticsDashboard] selectedArea=${selectedArea} areaName=${areaName}`);
  }, [selectedArea, areaName]);

  // Atualizar contagem de flows quando filtros mudarem
  useEffect(() => {
    async function updateFlowCount() {
      if (!selectedArea) {
        setFlowCount(0);
        setFlowCountError(null);
        return;
      }
      
      setLoading(true);
      setFlowCountError(null);
      try {
        let flows;
        
        // Se ambos os filtros estiverem ativos, usar query combinada
        if (socialGrade !== 'all' && ageGroup !== 'all') {
          flows = await getMSOAFlowsBySocialGradeAndAge(selectedArea, socialGrade, ageGroup, direction, 5000);
          setFlowCount(flows.length);
        } else if (socialGrade !== 'all') {
          flows = await getMSOAFlowsBySocialGrade(selectedArea, socialGrade, direction, 5000);
          setFlowCount(flows.length);
        } else if (ageGroup !== 'all') {
          flows = await getMSOAFlowsByAge(selectedArea, ageGroup, direction, 5000);
          setFlowCount(flows.length);
        } else {
          setFlowCount(0);
        }
      } catch (error) {
        console.error('[AnalyticsDashboard] erro ao atualizar contagem', error);
        setFlowCountError(getAnalyticsErrorMessage(error));
        setFlowCount(0);
      } finally {
        setLoading(false);
      }
    }
    
    updateFlowCount();
  }, [selectedArea, socialGrade, ageGroup, direction]);

  if (!selectedArea) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Select an Area to View Analytics</h3>
        <p className="text-sm text-gray-500">Click on the map or use the search to select a location</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-blue-100">
          {areaName || selectedArea} - Census 2021 Mobility Analysis
        </p>
        {flowCount > 0 && (
          <div className="mt-4 inline-flex items-center bg-white bg-opacity-20 rounded-full px-4 py-2">
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-sm font-medium">
              {flowCount.toLocaleString()} filtered flows
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      <AnalyticsFilters
        socialGrade={socialGrade}
        ageGroup={ageGroup}
        direction={direction}
        onSocialGradeChange={onSocialGradeChange || (() => {})}
        onAgeGroupChange={onAgeGroupChange || (() => {})}
        onDirectionChange={onDirectionChange || (() => {})}
      />

      {flowCountError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>Erro no dashboard:</strong> {flowCountError}
        </div>
      )}

      {/* Verificação de Disponibilidade de Dados */}
      <DataAvailabilityCheck />

      {/* Painel de Diagnóstico */}
      {isDevMode && <DirectionDebugPanel areaCode={selectedArea} />}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Social Grade Pie Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <SocialGradePieChart 
            key={`social-${selectedArea}`}
            areaCode={selectedArea} 
            direction={direction}
          />
        </div>

        {/* Age Bar Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <AgeBarChart 
            key={`age-${selectedArea}`}
            areaCode={selectedArea} 
            direction={direction}
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Flows"
          value={loading ? '...' : flowCount.toLocaleString()}
          icon="📊"
          color="blue"
        />
        <MetricCard
          title="Direction"
          value={direction === 'incoming' ? 'Incoming' : 'Outgoing'}
          icon="🔄"
          color="green"
        />
        <MetricCard
          title="Social Filter"
          value={socialGrade === 'all' ? 'All Classes' : socialGrade}
          icon="👥"
          color="purple"
        />
        <MetricCard
          title="Age Filter"
          value={ageGroup === 'all' ? 'All Ages' : ageGroup.split(' ').slice(1, 4).join(' ')}
          icon="📅"
          color="orange"
        />
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">About the Data</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>Data source: Census 2021 (England & Wales)</li>
                <li>Social Grade: Based on NS-SEC classification</li>
                <li>Age Groups: Working population aged 16+</li>
                <li>Flows: Origin-Destination commuting patterns (MSOA level)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function MetricCard({ title, value, icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`text-3xl ${colorClasses[color]} rounded-full w-12 h-12 flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
