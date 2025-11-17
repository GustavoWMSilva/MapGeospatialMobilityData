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
    <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg border border-purple-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-5 py-3">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          Seleção por Área (MSOA)
        </h3>
        <p className="text-purple-100 text-xs mt-1">
          Selecione uma área específica para análise detalhada
        </p>
      </div>
      
      {/* Content */}
      <div className="p-5">
        <div className="flex gap-3 items-center">
          <input
            type="text"
            placeholder="Digite o código da área (ex: E02000001)"
            className="flex-1 px-4 py-3 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 font-medium"
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
              className="px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-lg hover:from-rose-600 hover:to-rose-700 transition-all font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              title="Limpar seleção"
            >
              ✕
            </button>
          )}
        </div>
        
        {/* Área selecionada */}
        {selectedAreaCode ? (
          <div className="mt-4">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-white text-xs font-semibold uppercase tracking-wider mb-1 opacity-90">
                    Área MSOA Selecionada
                  </div>
                  <div className="text-white text-xl font-bold font-mono leading-tight">
                    {selectedAreaCode}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-blue-500 text-lg flex-shrink-0">💡</span>
              <div>
                <p className="text-sm text-blue-800 font-medium">Como usar</p>
                <p className="text-xs text-blue-600 mt-1">
                  Digite o código da área MSOA e pressione Enter para ver as conexões de mobilidade
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
