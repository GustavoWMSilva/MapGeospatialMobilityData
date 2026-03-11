import React from 'react';

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
    <div className="overflow-hidden rounded-2xl border border-purple-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-purple-100 bg-purple-50/60 px-4 py-2.5">
        <h3 className="text-base font-semibold text-purple-900">Selecao por Area (MSOA)</h3>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <input
            type="text"
            placeholder="Digite o codigo da area (ex: E02000001)"
            className="flex-1 rounded-xl border border-purple-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 transition-all focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-300"
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
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-purple-200 bg-white font-semibold text-purple-700 transition-colors hover:bg-purple-100"
              title="Limpar selecao"
              type="button"
            >
              x
            </button>
          )}
        </div>

        {selectedAreaCode ? (
          <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-700">Area MSOA selecionada</div>
            <div className="mt-1 font-mono text-lg font-bold text-purple-950">{selectedAreaCode}</div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Como usar</p>
            <p className="mt-1 text-xs text-slate-600">
              Digite o codigo da area MSOA e pressione Enter para ver as conexoes de mobilidade.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
