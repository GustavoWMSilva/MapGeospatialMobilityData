import { useEffect, useMemo, useRef, useState } from 'react';
import { Database, RotateCcw, Trash2, Upload } from 'lucide-react';
import {
  applyODSimulationFile,
  inspectODSimulationFile,
  restoreBaseODDataset,
  type ODSimulationApplyResult,
  type ODSimulationColumnMapping,
  type ODSimulationDimensionFile,
  type ODSimulationDimensionMapping,
} from '../utils/duckdb';
import { cacheService } from '../utils/cacheService';
import type { DatasetProfile } from '../types';

interface ODSimulationUploaderProps {
  datasetProfile: DatasetProfile;
  onSimulationApplied: (result: ODSimulationApplyResult) => void;
  onSimulationCleared: () => void;
}

type SimulationStatus = 'idle' | 'inspecting' | 'applying' | 'active' | 'error';

interface SavedODSimulation {
  datasetId: string;
  fileName: string;
  fileType: string;
  fileBlob: Blob;
  mapping: ODSimulationColumnMapping;
  dimensions: SavedODSimulationDimension[];
  savedAt: number;
}

interface SavedODSimulationDimension {
  dimensionKey: string;
  label: string;
  tableName: string;
  targetCategoryColumn: string;
  fileName: string;
  fileType: string;
  fileBlob: Blob;
  mapping: ODSimulationDimensionMapping;
}

interface DimensionUploadDraft {
  file: File | null;
  columns: string[];
  mapping: ODSimulationDimensionMapping;
}

function getSimulationCacheKey(datasetId: string): string {
  return `od-simulation:${datasetId}`;
}

function isSavedODSimulation(value: unknown): value is SavedODSimulation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SavedODSimulation>;
  const hasValidBase =
    typeof candidate.datasetId === 'string' &&
    typeof candidate.fileName === 'string' &&
    candidate.fileBlob instanceof Blob &&
    Boolean(candidate.mapping?.originColumn) &&
    Boolean(candidate.mapping?.destinationColumn) &&
    Boolean(candidate.mapping?.countColumn);

  if (!hasValidBase) {
    return false;
  }

  if (candidate.dimensions === undefined) {
    candidate.dimensions = [];
    return true;
  }

  return Array.isArray(candidate.dimensions);
}

function normalizeColumnName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findBestColumn(columns: string[], patterns: string[], fallbackIndex: number): string {
  const normalizedColumns = columns.map((column) => ({
    raw: column,
    normalized: normalizeColumnName(column),
  }));

  const exactMatch = normalizedColumns.find((column) =>
    patterns.some((pattern) => column.normalized === pattern)
  );
  if (exactMatch) return exactMatch.raw;

  const partialMatch = normalizedColumns.find((column) =>
    patterns.some((pattern) => column.normalized.includes(pattern))
  );
  if (partialMatch) return partialMatch.raw;

  return columns[fallbackIndex] || columns[0] || '';
}

function inferMapping(columns: string[]): ODSimulationColumnMapping {
  return {
    originColumn: findBestColumn(
      columns,
      ['origin_code', 'origem', 'origin', 'from', 'source', 'id_origem', 'o'],
      0
    ),
    destinationColumn: findBestColumn(
      columns,
      ['dest_code', 'destination', 'destino', 'dest', 'to', 'target', 'id_destino', 'd'],
      1
    ),
    countColumn: findBestColumn(
      columns,
      ['count', 'total', 'trips', 'viagens', 'quantidade', 'volume', 'flow', 'peso'],
      2
    ),
  };
}

function inferDimensionMapping(columns: string[], preferredCategoryColumn: string): ODSimulationDimensionMapping {
  return {
    ...inferMapping(columns),
    categoryColumn: findBestColumn(
      columns,
      [
        normalizeColumnName(preferredCategoryColumn),
        'category',
        'categoria',
        'age',
        'idade',
        'age_group',
        'occupation',
        'ocupacao',
        'classe',
        'social_grade',
      ],
      3
    ),
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function ODSimulationUploader({
  datasetProfile,
  onSimulationApplied,
  onSimulationCleared,
}: ODSimulationUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ODSimulationColumnMapping>({
    originColumn: '',
    destinationColumn: '',
    countColumn: '',
  });
  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ODSimulationApplyResult | null>(null);
  const [savedSimulation, setSavedSimulation] = useState<SavedODSimulation | null>(null);
  const [isStorageBusy, setIsStorageBusy] = useState(false);
  const [dimensionUploads, setDimensionUploads] = useState<Record<string, DimensionUploadDraft>>({});
  const dimensionFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let isMounted = true;

    const loadSavedSimulation = async () => {
      try {
        const saved = await cacheService.get(getSimulationCacheKey(datasetProfile.id));
        if (!isMounted) return;
        setSavedSimulation(isSavedODSimulation(saved) ? saved : null);
      } catch {
        if (isMounted) {
          setSavedSimulation(null);
        }
      }
    };

    void loadSavedSimulation();

    return () => {
      isMounted = false;
    };
  }, [datasetProfile.id]);

  const canApply = useMemo(
    () =>
      Boolean(
        file &&
        mapping.originColumn &&
        mapping.destinationColumn &&
        mapping.countColumn &&
        mapping.originColumn !== mapping.destinationColumn &&
        mapping.originColumn !== mapping.countColumn &&
        mapping.destinationColumn !== mapping.countColumn
      ),
    [file, mapping]
  );

  const dimensionInputs = useMemo<ODSimulationDimensionFile[]>(
    () =>
      datasetProfile.demographicDimensions
        .map((dimension) => {
          const draft = dimensionUploads[dimension.key];
          if (
            !draft?.file ||
            !draft.mapping.originColumn ||
            !draft.mapping.destinationColumn ||
            !draft.mapping.countColumn ||
            !draft.mapping.categoryColumn
          ) {
            return null;
          }

          return {
            dimensionKey: dimension.key,
            label: dimension.label,
            tableName: dimension.dataset.tableName,
            targetCategoryColumn: dimension.categoryColumn,
            file: draft.file,
            mapping: draft.mapping,
          };
        })
        .filter((dimension): dimension is ODSimulationDimensionFile => dimension !== null),
    [datasetProfile.demographicDimensions, dimensionUploads]
  );

  const handleFileChange = async (selectedFile: File | null) => {
    setFile(selectedFile);
    setColumns([]);
    setResult(null);
    setMessage('');

    if (!selectedFile) {
      setStatus('idle');
      return;
    }

    setStatus('inspecting');

    try {
      const profile = await inspectODSimulationFile(selectedFile);
      const nextMapping = inferMapping(profile.columns);
      setColumns(profile.columns);
      setMapping(nextMapping);
      setStatus('idle');
      setMessage(
        profile.fileKind === 'parquet'
          ? 'Parquet lido. Confira o mapeamento antes de aplicar.'
          : 'CSV lido. Confira o mapeamento antes de aplicar.'
      );
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel ler o arquivo.');
    }
  };

  const handleDimensionFileChange = async (
    dimensionKey: string,
    preferredCategoryColumn: string,
    selectedFile: File | null
  ) => {
    setMessage('');

    if (!selectedFile) {
      setDimensionUploads((current) => {
        const next = { ...current };
        delete next[dimensionKey];
        return next;
      });
      return;
    }

    setStatus('inspecting');

    try {
      const profile = await inspectODSimulationFile(selectedFile);
      const nextMapping = inferDimensionMapping(profile.columns, preferredCategoryColumn);
      setDimensionUploads((current) => ({
        ...current,
        [dimensionKey]: {
          file: selectedFile,
          columns: profile.columns,
          mapping: nextMapping,
        },
      }));
      setStatus('idle');
      setMessage(`Dimensao lida: ${selectedFile.name}. Confira o mapeamento antes de aplicar.`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Nao foi possivel ler o arquivo da dimensao.');
    }
  };

  const applySimulation = async () => {
    if (!file || !canApply) {
      return;
    }

    setStatus('applying');
    setMessage('');

    try {
      const appliedResult = await applyODSimulationFile(file, mapping, dimensionInputs);
      setResult(appliedResult);
      setStatus('active');
      onSimulationApplied(appliedResult);
      setMessage('Simulacao aplicada. O mapa e os graficos agora usam a matriz enviada.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro ao aplicar a matriz OD.');
    }
  };

  const saveCurrentSimulation = async () => {
    if (!file || !canApply) {
      return;
    }

    setIsStorageBusy(true);
    setMessage('');

    try {
      const saved: SavedODSimulation = {
        datasetId: datasetProfile.id,
        fileName: file.name,
        fileType: file.type,
        fileBlob: file,
        mapping,
        dimensions: dimensionInputs.map((dimension) => ({
          dimensionKey: dimension.dimensionKey,
          label: dimension.label,
          tableName: dimension.tableName,
          targetCategoryColumn: dimension.targetCategoryColumn,
          fileName: dimension.file.name,
          fileType: dimension.file.type,
          fileBlob: dimension.file,
          mapping: dimension.mapping,
        })),
        savedAt: Date.now(),
      };
      await cacheService.set(getSimulationCacheKey(datasetProfile.id), saved);
      setSavedSimulation(saved);
      setMessage('Simulacao salva neste navegador. Ela substitui qualquer simulacao salva anterior deste dataset.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar a simulacao.');
    } finally {
      setIsStorageBusy(false);
    }
  };

  const applySavedSimulation = async () => {
    if (!savedSimulation) {
      return;
    }

    setStatus('applying');
    setMessage('');

    try {
      const savedFile = new File([savedSimulation.fileBlob], savedSimulation.fileName, {
        type: savedSimulation.fileType || savedSimulation.fileBlob.type,
      });
      const savedDimensionInputs = savedSimulation.dimensions.map((dimension) => ({
        dimensionKey: dimension.dimensionKey,
        label: dimension.label,
        tableName: dimension.tableName,
        targetCategoryColumn: dimension.targetCategoryColumn,
        file: new File([dimension.fileBlob], dimension.fileName, {
          type: dimension.fileType || dimension.fileBlob.type,
        }),
        mapping: dimension.mapping,
      }));
      const appliedResult = await applyODSimulationFile(savedFile, savedSimulation.mapping, savedDimensionInputs);
      setFile(savedFile);
      setMapping(savedSimulation.mapping);
      setDimensionUploads(Object.fromEntries(
        savedDimensionInputs.map((dimension) => [
          dimension.dimensionKey,
          {
            file: dimension.file,
            columns: [],
            mapping: dimension.mapping,
          },
        ])
      ));
      setResult(appliedResult);
      setStatus('active');
      onSimulationApplied(appliedResult);
      setMessage('Simulacao salva aplicada.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro ao aplicar a simulacao salva.');
    }
  };

  const deleteSavedSimulation = async () => {
    setIsStorageBusy(true);
    setMessage('');

    try {
      await cacheService.delete(getSimulationCacheKey(datasetProfile.id));
      setSavedSimulation(null);
      setMessage('Simulacao salva removida deste navegador.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro ao remover a simulacao salva.');
    } finally {
      setIsStorageBusy(false);
    }
  };

  const clearSimulation = async () => {
    setStatus('applying');
    setMessage('');

    try {
      await restoreBaseODDataset();
      setResult(null);
      setStatus('idle');
      setMessage('Matriz original restaurada.');
      onSimulationCleared();
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Erro ao restaurar a matriz original.');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Simulacao</p>
        <h3 className="text-sm font-bold text-slate-950">Trocar matriz OD</h3>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">
          Usa a geografia atual de {datasetProfile.label} e substitui temporariamente a tabela de fluxos.
        </p>
      </div>

      <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
        <span className="mb-2 block font-semibold text-slate-800">CSV ou Parquet</span>
        <input
          type="file"
          accept=".csv,.tsv,.parquet,text/csv"
          onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
          className="w-full text-xs"
        />
      </label>

      {savedSimulation && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
          <p className="font-semibold text-slate-800">Simulacao salva</p>
          <p className="truncate font-mono">{savedSimulation.fileName}</p>
          {savedSimulation.dimensions.length > 0 && (
            <p>Dimensoes: {savedSimulation.dimensions.map((dimension) => dimension.label).join(', ')}</p>
          )}
          <p>{new Date(savedSimulation.savedAt).toLocaleString('pt-BR')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void applySavedSimulation()}
              disabled={status === 'inspecting' || status === 'applying' || isStorageBusy}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Database className="h-3.5 w-3.5" />
              Aplicar salva
            </button>
            <button
              type="button"
              onClick={() => void deleteSavedSimulation()}
              disabled={status === 'inspecting' || status === 'applying' || isStorageBusy}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </button>
          </div>
        </div>
      )}

      {columns.length > 0 && (
        <div className="mt-3 space-y-2">
          <ColumnSelect
            label="Origem"
            value={mapping.originColumn}
            columns={columns}
            onChange={(originColumn) => setMapping((current) => ({ ...current, originColumn }))}
          />
          <ColumnSelect
            label="Destino"
            value={mapping.destinationColumn}
            columns={columns}
            onChange={(destinationColumn) => setMapping((current) => ({ ...current, destinationColumn }))}
          />
          <ColumnSelect
            label="Fluxo"
            value={mapping.countColumn}
            columns={columns}
            onChange={(countColumn) => setMapping((current) => ({ ...current, countColumn }))}
          />
        </div>
      )}

      {datasetProfile.demographicDimensions.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-900">Dimensoes opcionais</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Envie arquivos separados para os filtros e graficos por categoria. Cada linha precisa ter origem, destino,
            fluxo e a categoria.
          </p>

          <div className="mt-3 space-y-3">
            {datasetProfile.demographicDimensions.map((dimension) => {
              const draft = dimensionUploads[dimension.key];

              return (
                <div key={dimension.key} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2">
                    <p className="text-xs font-bold text-slate-800">{dimension.label}</p>
                    <p className="font-mono text-[10px] text-slate-400">{dimension.dataset.tableName}</p>
                  </div>

                  <input
                    ref={(element) => {
                      dimensionFileInputRefs.current[dimension.key] = element;
                    }}
                    type="file"
                    accept=".csv,.tsv,.parquet,text/csv"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] ?? null;
                      event.target.value = '';
                      void handleDimensionFileChange(
                        dimension.key,
                        dimension.categoryColumn,
                        selectedFile
                      );
                    }}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => dimensionFileInputRefs.current[dimension.key]?.click()}
                    disabled={status === 'inspecting' || status === 'applying'}
                    className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0 truncate">
                      {draft?.file ? draft.file.name : `Selecionar arquivo de ${dimension.label}`}
                    </span>
                    <Upload className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </button>

                  {draft && draft.columns.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ColumnSelect
                        label="Origem"
                        value={draft.mapping.originColumn}
                        columns={draft.columns}
                        onChange={(originColumn) =>
                          setDimensionUploads((current) => ({
                            ...current,
                            [dimension.key]: {
                              ...draft,
                              mapping: { ...draft.mapping, originColumn },
                            },
                          }))
                        }
                      />
                      <ColumnSelect
                        label="Destino"
                        value={draft.mapping.destinationColumn}
                        columns={draft.columns}
                        onChange={(destinationColumn) =>
                          setDimensionUploads((current) => ({
                            ...current,
                            [dimension.key]: {
                              ...draft,
                              mapping: { ...draft.mapping, destinationColumn },
                            },
                          }))
                        }
                      />
                      <ColumnSelect
                        label="Fluxo"
                        value={draft.mapping.countColumn}
                        columns={draft.columns}
                        onChange={(countColumn) =>
                          setDimensionUploads((current) => ({
                            ...current,
                            [dimension.key]: {
                              ...draft,
                              mapping: { ...draft.mapping, countColumn },
                            },
                          }))
                        }
                      />
                      <ColumnSelect
                        label="Categoria"
                        value={draft.mapping.categoryColumn}
                        columns={draft.columns}
                        onChange={(categoryColumn) =>
                          setDimensionUploads((current) => ({
                            ...current,
                            [dimension.key]: {
                              ...draft,
                              mapping: { ...draft.mapping, categoryColumn },
                            },
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {message && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-[11px] leading-4 ${
            status === 'error'
              ? 'bg-red-50 text-red-700'
              : status === 'active'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-50 text-slate-600'
          }`}
        >
          {message}
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600">
          <p className="font-semibold text-slate-800">{result.fileName}</p>
          <p>Linhas originais: {formatNumber(result.totalRows)}</p>
          <p>Pares OD carregados: {formatNumber(result.loadedRows)}</p>
          <p>Linhas descartadas: {formatNumber(result.droppedRows)}</p>
          {result.duplicatePairsAggregated > 0 && (
            <p>Pares duplicados somados: {formatNumber(result.duplicatePairsAggregated)}</p>
          )}
          {result.unmappedCodeCount > 0 && (
            <p className="text-amber-700">
              Codigos sem centroide: {formatNumber(result.unmappedCodeCount)} ({result.unmappedCodeSample.join(', ')})
            </p>
          )}
          {result.dimensionResults && result.dimensionResults.length > 0 && (
            <div className="mt-2 border-t border-slate-200 pt-2">
              <p className="font-semibold text-slate-800">Dimensoes aplicadas</p>
              {result.dimensionResults.map((dimension) => (
                <p key={dimension.dimensionKey}>
                  {dimension.label}: {formatNumber(dimension.loadedRows)} linhas ({formatNumber(dimension.droppedRows)} descartadas)
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => void applySimulation()}
          disabled={!canApply || status === 'inspecting' || status === 'applying'}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {status === 'applying' ? 'Aplicando' : 'Aplicar'}
        </button>
        <button
          type="button"
          onClick={() => void saveCurrentSimulation()}
          disabled={!canApply || status === 'inspecting' || status === 'applying' || isStorageBusy}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Database className="h-3.5 w-3.5" />
          Salvar
        </button>
        <button
          type="button"
          onClick={() => void clearSimulation()}
          disabled={status === 'inspecting' || status === 'applying'}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Original
        </button>
      </div>
    </section>
  );
}

function ColumnSelect({
  label,
  value,
  columns,
  onChange,
}: {
  label: string;
  value: string;
  columns: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100"
      >
        <option value="">Selecione...</option>
        {columns.map((column) => (
          <option key={column} value={column}>
            {column}
          </option>
        ))}
      </select>
    </label>
  );
}
