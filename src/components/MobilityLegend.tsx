import React from 'react';

interface MobilityLegendProps {
  isVisible?: boolean;
}

export const MobilityLegend: React.FC<MobilityLegendProps> = ({ 
  isVisible = true 
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute bottom-8 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-10">
      <h3 className="font-bold text-sm mb-2 text-gray-800">
        🗺️ Fluxos de Mobilidade (UK)
      </h3>
      <p className="text-xs text-gray-600 mb-3">
        Deslocamentos casa → trabalho (Top 1000 fluxos)
      </p>
      
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-700 mb-1">
          Volume de pessoas:
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-12 h-1 rounded" style={{ backgroundColor: '#fee5d9' }}></div>
          <span className="text-xs text-gray-600">0-100</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 rounded" style={{ backgroundColor: '#fcae91' }}></div>
          <span className="text-xs text-gray-600">100-500</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-12 h-2 rounded" style={{ backgroundColor: '#fb6a4a' }}></div>
          <span className="text-xs text-gray-600">500-1000</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-12 h-2.5 rounded" style={{ backgroundColor: '#de2d26' }}></div>
          <span className="text-xs text-gray-600">1000-5000</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-12 h-3 rounded" style={{ backgroundColor: '#a50f15' }}></div>
          <span className="text-xs text-gray-600">5000+</span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          💡 Dica: Clique nas linhas para ver detalhes
        </p>
      </div>
    </div>
  );
};
