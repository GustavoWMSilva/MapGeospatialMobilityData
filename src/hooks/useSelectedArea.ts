import { useState, useCallback } from 'react';

export const useSelectedArea = () => {
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);

  const selectArea = useCallback((areaCode: string | null) => {
    setSelectedAreaCode(areaCode);
    if (areaCode) {
      console.log('📍 Área selecionada:', areaCode);
    } else {
      console.log('❌ Área desmarcada');
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAreaCode(null);
    console.log('🧹 Seleção limpa');
  }, []);

  return {
    selectedAreaCode,
    selectArea,
    clearSelection
  };
};
