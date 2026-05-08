import React from 'react';
import { ACTIVE_DATASET_PROFILE } from '../constants/datasetProfiles';

interface AreaSelectionControlsProps {
  selectedAreaCode: string | null;
  onSelectArea: (areaCode: string) => void;
  onClearSelection: () => void;
}

export const AreaSelectionControls: React.FC<AreaSelectionControlsProps> = ({
  selectedAreaCode,
  onSelectArea,
  onClearSelection
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-950">
          {ACTIVE_DATASET_PROFILE.labels.base.selectorTitle}
        </h3>
      </div>

      <div>
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            placeholder={ACTIVE_DATASET_PROFILE.labels.base.inputPlaceholder}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition-all focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = e.currentTarget.value.trim();
                if (input) {
                  onSelectArea(input);
                  e.currentTarget.value = '';
                }
              }
            }}
          />

          {selectedAreaCode && (
            <button
              onClick={onClearSelection}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              title="Limpar selecao"
              type="button"
            >
              x
            </button>
          )}
        </div>

        {selectedAreaCode ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {ACTIVE_DATASET_PROFILE.labels.base.selectedTitle}
            </div>
            <div className="mt-1 font-mono text-base font-bold text-slate-950">{selectedAreaCode}</div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-slate-700">Como usar</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              {ACTIVE_DATASET_PROFILE.labels.base.helperText}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
