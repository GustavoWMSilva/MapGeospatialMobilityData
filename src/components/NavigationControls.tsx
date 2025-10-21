import React from 'react';
import type { Point, Location } from '../types';
import { LOCATIONS } from '../constants';

interface NavigationControlsProps {
  points: Point[];
  isAnimating?: boolean;
  onTogglePopup: () => void;
  onClearPoints: () => void;
  onFlyToLocation: (location: Location) => void;
  onFlyToPoint: (point: Point) => void;
  onStartAnimation?: () => void;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  points,
  isAnimating = false,
  onTogglePopup,
  onClearPoints,
  onFlyToLocation,
  onFlyToPoint,
  onStartAnimation
}) => {
  return (
    <div className="p-4 space-x-2 space-y-2">
      {/* Controles principais */}
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={onTogglePopup} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Toggle popup
        </button>
        <button 
          onClick={onClearPoints} 
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Limpar pontos ({points.length})
        </button>
        {onStartAnimation && (
          <button 
            onClick={onStartAnimation}
            disabled={isAnimating}
            className={`px-4 py-2 text-white rounded transition-colors ${
              isAnimating 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {isAnimating ? '🔥 Animando...' : '🚀 Animar Linhas NY'}
          </button>
        )}
      </div>
      
      {/* Botões de navegação para locais pré-definidos */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700 self-center">
          Viajar para:
        </span>
        {LOCATIONS.map((location) => (
          <button
            key={location.name}
            onClick={() => onFlyToLocation(location)}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
          >
            📍 {location.name}
          </button>
        ))}
      </div>
      
      {/* Navegação entre pontos clicados */}
      {points.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-medium text-gray-700 self-center">
            Pontos salvos:
          </span>
          {points.map((point, index) => (
            <button
              key={index}
              onClick={() => onFlyToPoint(point)}
              className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition-colors"
            >
              📌 Ponto {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};