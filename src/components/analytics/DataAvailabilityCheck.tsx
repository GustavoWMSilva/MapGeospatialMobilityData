import { useEffect, useState } from 'react';
import { executeQuery } from '../../utils/duckdb';

interface DatasetStatus {
  name: string;
  tableName: string;
  available: boolean;
  recordCount: number;
  error?: string;
}

export function DataAvailabilityCheck() {
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkDatasets() {
      setLoading(true);
      const results: DatasetStatus[] = [];

      // Datasets para verificar
      const checks = [
        { name: 'Flows Básicos (OBRIGATÓRIO)', tableName: 'flows' },
        { name: 'Social Grade (OPCIONAL)', tableName: 'flows_social_grade' },
        { name: 'Age Groups (OPCIONAL)', tableName: 'flows_age' },
      ];

      for (const check of checks) {
        try {
          // Tentar contar registros
          const result = await executeQuery(`SELECT COUNT(*) as total FROM ${check.tableName}`);
          const count = Number((result[0] as any).total);

          results.push({
            name: check.name,
            tableName: check.tableName,
            available: true,
            recordCount: count,
          });
        } catch (error) {
          results.push({
            name: check.name,
            tableName: check.tableName,
            available: false,
            recordCount: 0,
            error: String(error),
          });
        }
      }

      setDatasets(results);
      setLoading(false);
    }

    checkDatasets();
  }, []);

  if (loading) {
    return (
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-4">
        <h3 className="font-bold text-blue-800 mb-2">🔍 Verificando Datasets Disponíveis...</h3>
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-4 w-4 bg-blue-400 rounded-full"></div>
          <div className="text-sm text-blue-700">Consultando DuckDB...</div>
        </div>
      </div>
    );
  }

  const allAvailable = datasets.every(d => d.available);
  const demographicsAvailable = datasets.slice(1).every(d => d.available);

  return (
    <div className={`border-2 rounded-lg p-4 mb-4 ${allAvailable ? 'bg-green-50 border-green-400' : 'bg-yellow-50 border-yellow-400'}`}>
      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
        {allAvailable ? '✅' : '⚠️'} Status dos Dados
      </h3>

      <div className="space-y-2">
        {datasets.map((dataset, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-3 rounded ${
              dataset.available ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{dataset.available ? '✅' : '❌'}</span>
              <div>
                <div className="font-semibold">
                  {dataset.available ? dataset.name : `${dataset.name} - NÃO DISPONÍVEL`}
                </div>
                <div className="text-xs text-gray-600">
                  Tabela: <code className="bg-white px-1 rounded">{dataset.tableName}</code>
                </div>
              </div>
            </div>
            {dataset.available ? (
              <div className="text-sm font-mono bg-white px-3 py-1 rounded">
                {dataset.recordCount.toLocaleString()} registros
              </div>
            ) : (
              <div className="text-xs text-red-700">Não carregado</div>
            )}
          </div>
        ))}
      </div>

      {!demographicsAvailable && (
        <div className="mt-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 rounded">
          <h4 className="font-bold text-yellow-800 mb-2">📋 Como habilitar dados demográficos:</h4>
          <ol className="text-sm text-yellow-900 space-y-1 list-decimal ml-5">
            <li>
              Faça upload dos arquivos para o GitHub:
              <ul className="list-disc ml-5 mt-1">
                <li><code className="bg-white px-1 rounded">ODWP09EW_MSOA.parquet</code> (Social Grade)</li>
                <li><code className="bg-white px-1 rounded">ODWP04EW_MSOA.parquet</code> (Age)</li>
              </ul>
            </li>
            <li>Repositório: <code className="bg-white px-1 rounded">GustavoWMSilva/MapGeospatialMobilityData</code></li>
            <li>Branch: <code className="bg-white px-1 rounded">main</code></li>
            <li>Os arquivos serão automaticamente carregados via jsdelivr CDN</li>
          </ol>
        </div>
      )}

      {allAvailable && (
        <div className="mt-4 p-3 bg-green-100 border-l-4 border-green-500 rounded">
          <h4 className="font-bold text-green-800 mb-1">🎉 Todos os dados estão disponíveis!</h4>
          <p className="text-sm text-green-900">
            Analytics demográficos (Social Grade e Age) funcionam tanto para <strong>MSOA</strong> quanto para <strong>LTLA</strong>.
          </p>
          <p className="text-xs text-green-700 mt-2">
            💡 Para LTLA, os dados são agregados automaticamente de todos os MSOAs que pertencem àquele LTLA.
          </p>
        </div>
      )}
    </div>
  );
}
