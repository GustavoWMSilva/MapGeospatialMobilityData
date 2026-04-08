import React, { useEffect, useState } from 'react';
import { ACTIVE_DATASET_PROFILE, getAggregateCentroidsPath } from '../constants/datasetProfiles';

interface LTLAOption {
  code: string;
  name: string;
  msoa_count: number;
}

interface AggregateAreaSelectorProps {
  selectedAggregateAreaCode: string | null;
  onSelectAggregateArea: (areaCode: string, areaName: string) => void;
  onClearSelection: () => void;
}

export const AggregateAreaSelector: React.FC<AggregateAreaSelectorProps> = ({
  selectedAggregateAreaCode,
  onSelectAggregateArea,
  onClearSelection
}) => {
  const [aggregateAreas, setAggregateAreas] = useState<LTLAOption[]>([]);
  const [filteredAggregateAreas, setFilteredAggregateAreas] = useState<LTLAOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAggregateAreaName, setSelectedAggregateAreaName] = useState<string>('');
  const aggregateLabels = ACTIVE_DATASET_PROFILE.labels.aggregate;
  const baseLabels = ACTIVE_DATASET_PROFILE.labels.base;

  useEffect(() => {
    fetch(getAggregateCentroidsPath())
      .then((response) => response.text())
      .then((csvText) => {
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let insideQuotes = false;

          for (let i = 0; i < line.length; i += 1) {
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

        const lines = csvText.split('\n');
        const data: LTLAOption[] = lines
          .slice(1)
          .filter((line) => line.trim())
          .map((line) => {
            const values = parseCSVLine(line);
            return {
              code: values[0]?.trim() || '',
              name: values[1]?.trim() || '',
              msoa_count: parseInt(values[4]?.trim() || '0', 10),
            };
          })
          .filter((ltla) => ltla.code && ltla.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        setAggregateAreas(data);
        setFilteredAggregateAreas(data);
      })
      .catch((err) => console.error(`Erro ao carregar ${aggregateLabels.plural}:`, err));
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredAggregateAreas(aggregateAreas);
      return;
    }

    const filtered = aggregateAreas.filter(
      (aggregateArea) =>
        aggregateArea.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        aggregateArea.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAggregateAreas(filtered);
  }, [searchTerm, aggregateAreas]);

  useEffect(() => {
    if (!selectedAggregateAreaCode) {
      setSelectedAggregateAreaName('');
      return;
    }

    const selectedArea = aggregateAreas.find((item) => item.code === selectedAggregateAreaCode);
    setSelectedAggregateAreaName(selectedArea?.name || '');
  }, [selectedAggregateAreaCode, aggregateAreas]);

  const handleSelect = (aggregateArea: LTLAOption) => {
    onSelectAggregateArea(aggregateArea.code, aggregateArea.name);
    setSearchTerm('');
    setShowDropdown(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-purple-100 bg-purple-50/60 px-4 py-2.5">
        <h3 className="text-base font-semibold text-purple-900">
          {aggregateLabels.selectorTitle}
        </h3>
        <span className="rounded-full border border-purple-100 bg-white px-2 py-0.5 text-[10px] font-semibold text-purple-700">
          {aggregateAreas.length} {aggregateLabels.plural.toLowerCase()}
        </span>
      </div>

      <div className="p-4">
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              placeholder={aggregateLabels.searchPlaceholder}
              className="w-full rounded-xl border border-purple-200 py-2 pl-3 pr-9 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-300"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setShowDropdown(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                type="button"
              >
                x
              </button>
            )}
          </div>

          {showDropdown && filteredAggregateAreas.length > 0 && searchTerm && (
            <div className="absolute z-50 mt-2 max-h-80 w-full overflow-hidden rounded-xl border border-purple-200 bg-white shadow-xl">
              <div className="max-h-80 overflow-y-auto">
                {filteredAggregateAreas.slice(0, 30).map((aggregateArea) => (
                  <button
                    key={aggregateArea.code}
                    onClick={() => handleSelect(aggregateArea)}
                    className="group w-full border-b border-gray-100 px-3 py-2 text-left transition-colors hover:bg-purple-50 last:border-b-0"
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 transition-colors group-hover:text-purple-700">
                          {aggregateArea.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono">{aggregateArea.code}</span>
                          <span>-</span>
                          <span className="font-medium text-purple-600">
                            {aggregateArea.msoa_count} {baseLabels.plural.toLowerCase()}
                          </span>
                        </div>
                      </div>
                      <div className="text-purple-400 opacity-0 transition-opacity group-hover:opacity-100">-&gt;</div>
                    </div>
                  </button>
                ))}
                {filteredAggregateAreas.length > 30 && (
                  <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 px-3 py-2 text-center text-xs font-medium text-gray-600">
                    +{filteredAggregateAreas.length - 30} mais resultados... Continue digitando para refinar
                  </div>
                )}
              </div>
            </div>
          )}

          {showDropdown && filteredAggregateAreas.length === 0 && searchTerm && (
            <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white p-4 text-center shadow-lg">
              <p className="font-medium text-gray-600">{aggregateLabels.emptySearchTitle}</p>
              <p className="mt-1 text-xs text-gray-500">{aggregateLabels.emptySearchHint}</p>
            </div>
          )}
        </div>

        {selectedAggregateAreaCode ? (
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
                  {aggregateLabels.selectedTitle}
                </div>
                <div className="text-xl font-bold leading-tight text-purple-950">{selectedAggregateAreaName}</div>
                <div className="mt-1.5 font-mono text-xs text-purple-700">{selectedAggregateAreaCode}</div>
              </div>
              <button
                onClick={onClearSelection}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-200 bg-white font-bold text-purple-700 transition-colors hover:bg-purple-100"
                title="Limpar selecao"
                type="button"
              >
                x
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Como usar</p>
            <p className="mt-1 text-xs text-slate-600">
              {aggregateLabels.helperText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
