import React, { useEffect, useMemo, useState } from 'react';
import { cacheService } from '../utils/cacheService';

interface CacheDebugPanelProps {
  isFullscreen?: boolean;
}

export const CacheDebugPanel: React.FC<CacheDebugPanelProps> = ({ isFullscreen = false }) => {
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [cacheKeys, setCacheKeys] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const updateCacheInfo = async () => {
    try {
      const size = await cacheService.getSize();
      const keys = await cacheService.keys();
      setCacheSize(size);
      setCacheKeys(keys);
    } catch (error) {
      console.error('Erro ao atualizar info do cache:', error);
    }
  };

  useEffect(() => {
    void updateCacheInfo();
    const interval = setInterval(updateCacheInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    if (confirm('Tem certeza que deseja limpar todo o cache?')) {
      await cacheService.clear();
      await updateCacheInfo();
      window.location.reload();
    }
  };

  const formattedCacheSize = (cacheSize / 1024 / 1024).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const closedButtonClass = useMemo(
    () =>
      isFullscreen
        ? 'fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white shadow-lg hover:bg-gray-700'
        : 'fixed bottom-4 right-4 z-50 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white shadow-lg hover:bg-gray-700',
    [isFullscreen]
  );

  const openPanelClass = useMemo(
    () =>
      isFullscreen
        ? 'fixed bottom-4 left-1/2 z-[70] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border-2 border-gray-300 bg-white p-4 shadow-xl'
        : 'fixed bottom-4 right-4 z-50 max-w-md rounded-lg border-2 border-gray-300 bg-white p-4 shadow-xl',
    [isFullscreen]
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={closedButtonClass}
      >
        Cache: {formattedCacheSize} MB
      </button>
    );
  }

  return (
    <div className={openPanelClass}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-lg">Cache do IndexedDB</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          x
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tamanho total:</span>
          <span className="font-mono font-semibold">
            {formattedCacheSize} MB
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Entradas:</span>
          <span className="font-mono font-semibold">{cacheKeys.length}</span>
        </div>
      </div>

      <div className="mb-3 max-h-48 overflow-y-auto border border-gray-200 rounded p-2">
        <div className="text-xs font-semibold text-gray-600 mb-1">Chaves:</div>
        {cacheKeys.map((key) => (
          <div key={key} className="text-xs font-mono text-gray-700 py-0.5">
            {key}
          </div>
        ))}
      </div>

      <button
        onClick={handleClearCache}
        className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-semibold"
      >
        Limpar cache
      </button>
    </div>
  );
};
