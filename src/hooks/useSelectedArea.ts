import { useState, useCallback } from 'react';

export const useSelectedArea = () => {
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null);

  const selectArea = useCallback((areaCode: string | null) => {
    setSelectedAreaCode(areaCode);
    if (areaCode) {
    } else {
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedAreaCode(null);
  }, []);

  return {
    selectedAreaCode,
    selectArea,
    clearSelection
  };
};
