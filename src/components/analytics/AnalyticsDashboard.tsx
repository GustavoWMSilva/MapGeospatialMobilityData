import { useState, useEffect } from 'react';
import { SocialGradePieChart } from './SocialGradePieChart';
import { AgeBarChart } from './AgeBarChart';
import { AnalyticsFilters } from './AnalyticsFilters';
import { getMSOAFlowsBySocialGrade, getMSOAFlowsByAge, getMSOAFlowsBySocialGradeAndAge } from '../../utils/duckdb';
import type { SocialGrade, AgeGroup } from '../../types';
import { debugLog, getAnalyticsErrorMessage } from './analyticsUtils';

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
  onDirectionChange,
}: AnalyticsDashboardProps) {
  const [flowCountError, setFlowCountError] = useState<string | null>(null);

  useEffect(() => {
    debugLog(`[AnalyticsDashboard] direction=${direction}`);
  }, [direction]);

  useEffect(() => {
    debugLog(`[AnalyticsDashboard] selectedArea=${selectedArea} areaName=${areaName}`);
  }, [selectedArea, areaName]);

  // Validate data availability for selected filters
  useEffect(() => {
    async function validateDataAvailability() {
      if (!selectedArea) {
        setFlowCountError(null);
        return;
      }

      setFlowCountError(null);
      try {
        if (socialGrade !== 'all' && ageGroup !== 'all') {
          await getMSOAFlowsBySocialGradeAndAge(selectedArea, socialGrade, ageGroup, direction, 5000);
        } else if (socialGrade !== 'all') {
          await getMSOAFlowsBySocialGrade(selectedArea, socialGrade, direction, 5000);
        } else if (ageGroup !== 'all') {
          await getMSOAFlowsByAge(selectedArea, ageGroup, direction, 5000);
        }
      } catch (error) {
        console.error('[AnalyticsDashboard] erro ao validar disponibilidade de dados', error);
        setFlowCountError(getAnalyticsErrorMessage(error));
      }
    }

    validateDataAvailability();
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <SocialGradePieChart
            key={`social-${selectedArea}`}
            areaCode={selectedArea}
            direction={direction}
            selectedGrade={socialGrade}
            onSelectGrade={onSocialGradeChange || (() => {})}
          />
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <AgeBarChart
            key={`age-${selectedArea}`}
            areaCode={selectedArea}
            direction={direction}
            selectedAgeGroup={ageGroup}
            onSelectAgeGroup={onAgeGroupChange || (() => {})}
          />
        </div>
      </div>
    </div>
  );
}
