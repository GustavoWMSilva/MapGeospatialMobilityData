import { useState } from 'react';
import type { SocialGrade, AgeGroup } from '../../types';

interface AnalyticsFiltersProps {
  onSocialGradeChange: (grade: SocialGrade) => void;
  onAgeGroupChange: (age: AgeGroup) => void;
  onDirectionChange: (direction: 'incoming' | 'outgoing') => void;
  socialGrade?: SocialGrade;
  ageGroup?: AgeGroup;
  direction?: 'incoming' | 'outgoing';
}

export function AnalyticsFilters({
  onSocialGradeChange,
  onAgeGroupChange,
  onDirectionChange,
  socialGrade = 'all',
  ageGroup = 'all',
  direction = 'incoming',
}: AnalyticsFiltersProps) {
  const [selectedGrade, setSelectedGrade] = useState<SocialGrade>(socialGrade);
  const [selectedAge, setSelectedAge] = useState<AgeGroup>(ageGroup);
  const [selectedDirection, setSelectedDirection] = useState<'incoming' | 'outgoing'>(direction);

  const handleGradeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const grade = e.target.value as SocialGrade;
    setSelectedGrade(grade);
    onSocialGradeChange(grade);
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const age = e.target.value as AgeGroup;
    setSelectedAge(age);
    onAgeGroupChange(age);
  };

  const handleDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dir = e.target.value as 'incoming' | 'outgoing';
    setSelectedDirection(dir);
    onDirectionChange(dir);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Analytics Filters
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Flow Direction */}
        <div>
          <label htmlFor="direction" className="block text-sm font-medium text-gray-700 mb-2">
            Flow Direction
          </label>
          <select
            id="direction"
            value={selectedDirection}
            onChange={handleDirectionChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="incoming">Incoming (to selected area)</option>
            <option value="outgoing">Outgoing (from selected area)</option>
          </select>
        </div>

        {/* Social Grade */}
        <div>
          <label htmlFor="socialGrade" className="block text-sm font-medium text-gray-700 mb-2">
            Social Grade
          </label>
          <select
            id="socialGrade"
            value={selectedGrade}
            onChange={handleGradeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Classes</option>
            <option value="AB">AB - Higher & Intermediate Professional</option>
            <option value="C1">C1 - Supervisory & Clerical</option>
            <option value="C2">C2 - Skilled Manual</option>
            <option value="DE">DE - Semi-skilled & Unskilled</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {selectedGrade === 'AB' && 'Top managers, professionals, senior officials'}
            {selectedGrade === 'C1' && 'Middle managers, junior professionals'}
            {selectedGrade === 'C2' && 'Skilled manual workers'}
            {selectedGrade === 'DE' && 'Semi & unskilled workers, unemployed'}
            {selectedGrade === 'all' && 'All social classes combined'}
          </p>
        </div>

        {/* Age Group */}
        <div>
          <label htmlFor="ageGroup" className="block text-sm font-medium text-gray-700 mb-2">
            Age Group
          </label>
          <select
            id="ageGroup"
            value={selectedAge}
            onChange={handleAgeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Ages</option>
            <option value="Aged 16 to 24 years">16-24 years (Young Adults)</option>
            <option value="Aged 25 to 34 years">25-34 years (Young Professionals)</option>
            <option value="Aged 35 to 44 years">35-44 years (Mid-career)</option>
            <option value="Aged 45 to 54 years">45-54 years (Experienced)</option>
            <option value="Aged 55 to 64 years">55-64 years (Pre-retirement)</option>
            <option value="Aged 65 years and over">65+ years (Retirement age)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {selectedAge === 'Aged 16 to 24 years' && 'Students, entry-level workers'}
            {selectedAge === 'Aged 25 to 34 years' && 'Career building, high mobility'}
            {selectedAge === 'Aged 35 to 44 years' && 'Peak career, family commitments'}
            {selectedAge === 'Aged 45 to 54 years' && 'Senior positions, stability'}
            {selectedAge === 'Aged 55 to 64 years' && 'Approaching retirement'}
            {selectedAge === 'Aged 65 years and over' && 'Working pensioners'}
            {selectedAge === 'all' && 'All age groups combined'}
          </p>
        </div>
      </div>

      {/* Active Filters Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700">Active filters:</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {selectedDirection === 'incoming' ? 'Incoming' : 'Outgoing'}
          </span>
          {selectedGrade !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {selectedGrade}
            </span>
          )}
          {selectedAge !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              {selectedAge.split(' ').slice(1, 4).join(' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
