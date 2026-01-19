/**
 * Componente de teste para DuckDB-WASM
 * Mostra status e permite testar queries
 */
import React, { useState } from 'react';
import { initDuckDB, getMSOAFlows } from '../utils/duckdb';

export const DuckDBTest: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState<unknown[] | null>(null);

  const handleInit = async () => {
    setStatus('loading');
    setMessage('Inicializando DuckDB-WASM...');
    
    try {
      await initDuckDB();
      setStatus('ready');
      setMessage('✅ DuckDB inicializado com sucesso!');
    } catch (error) {
      setStatus('error');
      setMessage(`❌ Erro: ${error}`);
    }
  };

  const handleTest = async () => {
    setStatus('loading');
    setMessage('Carregando flows de teste...');
    
    try {
      // Testar com código de exemplo (Londres)
      const flows = await getMSOAFlows('E02000001', 'incoming', 10);
      setTestResult(flows);
      setStatus('ready');
      setMessage(`✅ Carregados ${flows.length} flows`);
    } catch (error) {
      setStatus('error');
      setMessage(`❌ Erro: ${error}`);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg border-2 border-blue-500 max-w-md z-50">
      <h3 className="font-bold text-lg mb-2">🦆 DuckDB-WASM Test</h3>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${
            status === 'idle' ? 'bg-gray-400' :
            status === 'loading' ? 'bg-yellow-400 animate-pulse' :
            status === 'ready' ? 'bg-green-400' :
            'bg-red-400'
          }`}></span>
          <span className="text-sm font-medium">
            {status === 'idle' ? 'Não inicializado' :
             status === 'loading' ? 'Carregando...' :
             status === 'ready' ? 'Pronto' :
             'Erro'}
          </span>
        </div>
        
        {message && (
          <p className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
            {message}
          </p>
        )}
      </div>
      
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleInit}
          disabled={status === 'loading'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 text-sm"
        >
          Inicializar
        </button>
        
        <button
          onClick={handleTest}
          disabled={status === 'loading' || status === 'idle'}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 text-sm"
        >
          Testar Query
        </button>
      </div>
      
      {testResult && (
        <div className="bg-gray-50 p-3 rounded max-h-48 overflow-auto">
          <p className="font-semibold text-sm mb-2">Resultado:</p>
          <pre className="text-xs">
            {JSON.stringify(testResult.slice(0, 3), null, 2)}
          </pre>
          {testResult.length > 3 && (
            <p className="text-xs text-gray-500 mt-2">
              ... e mais {testResult.length - 3} flows
            </p>
          )}
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          💡 Dados carregados do GitHub Releases
        </p>
      </div>
    </div>
  );
};
