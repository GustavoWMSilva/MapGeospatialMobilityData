/**
 * Painel de debug do cache IndexedDB
 * Mostra informações sobre o cache e permite limpar
 */
import React, { useEffect, useState } from 'react';
import { cacheService } from '../utils/cacheService';

export const CacheDebugPanel: React.FC = () => {
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
    updateCacheInfo();
    // Atualizar a cada 5 segundos
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-gray-700 text-sm z-50"
      >
        Cache: {(cacheSize / 1024 / 1024).toFixed(2)} MB
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-4 z-50 max-w-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-lg">Cache IndexedDB</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tamanho total:</span>
          <span className="font-mono font-semibold">
            {(cacheSize / 1024 / 1024).toFixed(2)} MB
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
        Limpar Cache
      </button>
    </div>
  );
};
