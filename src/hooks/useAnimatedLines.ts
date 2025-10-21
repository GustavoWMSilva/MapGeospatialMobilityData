import { useState, useCallback } from 'react';
import type { Location, Point } from '../types';
import { LOCATIONS } from '../constants';

interface AnimatedLine {
  id: string;
  from: Location;
  to: Location | Point;
  progress: number;
  isActive: boolean;
}

export const useAnimatedLines = () => {
  const [lines, setLines] = useState<AnimatedLine[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const newYork = LOCATIONS.find(loc => loc.name === "Nova York");

  // Criar linhas de Nova York para outros locais
  const createLinesToLocations = useCallback(() => {
    if (!newYork) return;

    const newLines: AnimatedLine[] = LOCATIONS
      .filter(loc => loc.name !== "Nova York")
      .map(location => ({
        id: `ny-to-${location.name}`,
        from: newYork,
        to: location,
        progress: 0,
        isActive: false
      }));

    setLines(newLines);
  }, [newYork]);

  // Criar linhas de Nova York para pontos clicados
  const createLinesToPoints = useCallback((points: Point[]) => {
    if (!newYork || points.length === 0) return;

    const pointLines: AnimatedLine[] = points.map((point, index) => ({
      id: `ny-to-point-${index}`,
      from: newYork,
      to: point,
      progress: 0,
      isActive: false
    }));

    // Combinar com linhas existentes para localizações
    const locationLines: AnimatedLine[] = LOCATIONS
      .filter(loc => loc.name !== "Nova York")
      .map(location => ({
        id: `ny-to-${location.name}`,
        from: newYork,
        to: location,
        progress: 0,
        isActive: false
      }));

    setLines([...locationLines, ...pointLines]);
  }, [newYork]);

  // Animar linhas
  const startAnimation = useCallback(() => {
    setIsAnimating(true);
    
    setLines(prevLines => 
      prevLines.map(line => ({ ...line, isActive: true, progress: 0 }))
    );

    const animateProgress = () => {
      setLines(prevLines => {
        const updatedLines = prevLines.map(line => {
          if (!line.isActive) return line;
          
          const newProgress = Math.min(line.progress + 0.02, 1);
          return { ...line, progress: newProgress };
        });

        // Verificar se todas as animações terminaram
        const allCompleted = updatedLines.every(line => line.progress >= 1);
        if (allCompleted) {
          setIsAnimating(false);
          return updatedLines.map(line => ({ ...line, isActive: false, progress: 0 }));
        }

        return updatedLines;
      });
    };

    const interval = setInterval(animateProgress, 50);
    
    // Parar após 3 segundos
    setTimeout(() => {
      clearInterval(interval);
      setIsAnimating(false);
      setLines(prevLines => 
        prevLines.map(line => ({ ...line, isActive: false, progress: 0 }))
      );
    }, 3000);
  }, []);

  // Gerar dados GeoJSON para as linhas
  const getLinesGeoJSON = useCallback(() => {
    const features = lines
      .filter(line => line.isActive && line.progress > 0)
      .map(line => {
        const fromCoords = [line.from.longitude, line.from.latitude];
        const toCoords = 'name' in line.to 
          ? [line.to.longitude, line.to.latitude]
          : [line.to.lng, line.to.lat];

        // Calcular ponto intermediário baseado no progresso
        const interpolatedCoords = [
          fromCoords[0] + (toCoords[0] - fromCoords[0]) * line.progress,
          fromCoords[1] + (toCoords[1] - fromCoords[1]) * line.progress
        ];

        return {
          type: "Feature" as const,
          properties: { 
            id: line.id,
            progress: line.progress 
          },
          geometry: {
            type: "LineString" as const,
            coordinates: [fromCoords, interpolatedCoords]
          }
        };
      });

    return {
      type: "FeatureCollection" as const,
      features
    };
  }, [lines]);

  // Gerar pontos animados (para mostrar movimento)
  const getAnimatedPointsGeoJSON = useCallback(() => {
    const features = lines
      .filter(line => line.isActive && line.progress > 0 && line.progress < 1)
      .map(line => {
        const fromCoords = [line.from.longitude, line.from.latitude];
        const toCoords = 'name' in line.to 
          ? [line.to.longitude, line.to.latitude]
          : [line.to.lng, line.to.lat];

        // Ponto que se move ao longo da linha
        const movingPoint = [
          fromCoords[0] + (toCoords[0] - fromCoords[0]) * line.progress,
          fromCoords[1] + (toCoords[1] - fromCoords[1]) * line.progress
        ];

        return {
          type: "Feature" as const,
          properties: { 
            id: `${line.id}-point`,
            progress: line.progress 
          },
          geometry: {
            type: "Point" as const,
            coordinates: movingPoint
          }
        };
      });

    return {
      type: "FeatureCollection" as const,
      features
    };
  }, [lines]);

  return {
    lines,
    isAnimating,
    createLinesToLocations,
    createLinesToPoints,
    startAnimation,
    getLinesGeoJSON,
    getAnimatedPointsGeoJSON
  };
};