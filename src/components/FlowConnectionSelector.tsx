import { useEffect, useMemo, useState } from 'react';
import { loadFlowsFiltered } from '../utils/dataService';
import type {
  DemographicFilters,
  FlowConnectionFilter,
  GeographyLevel,
} from '../types';
import { MAP_COLORS } from '../constants/mapColors';

interface FlowConnectionSelectorProps {
  selectedAreaCode?: string;
  direction: 'incoming' | 'outgoing';
  geographyLevel: GeographyLevel;
  demographicFilters?: DemographicFilters;
  includeInternalFlows?: boolean;
  value: FlowConnectionFilter[];
  onChange: (value: FlowConnectionFilter[]) => void;
}

interface FlowConnectionOption {
  code: string;
  name: string;
  count: number;
}

interface FlowFeatureProperties {
  origin_code: string;
  origin_name?: string;
  dest_code: string;
  dest_name?: string;
  count: number;
}

interface FlowFeature {
  properties: FlowFeatureProperties;
}

const MAX_COMPARED_CONNECTIONS = 3;
const COMPARISON_COLORS = MAP_COLORS.analytics.topFlowsBar.slice(0, MAX_COMPARED_CONNECTIONS);

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isFlowFeature(value: unknown): value is FlowFeature {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { properties?: Partial<FlowFeatureProperties> };
  if (!candidate.properties || typeof candidate.properties !== 'object') return false;

  return (
    typeof candidate.properties.origin_code === 'string' &&
    typeof candidate.properties.dest_code === 'string' &&
    typeof candidate.properties.count === 'number'
  );
}

function getCounterpartCode(
  properties: FlowFeatureProperties,
  direction: 'incoming' | 'outgoing'
): string {
  return direction === 'incoming' ? properties.origin_code : properties.dest_code;
}

function getCounterpartName(
  properties: FlowFeatureProperties,
  direction: 'incoming' | 'outgoing'
): string {
  return direction === 'incoming'
    ? (properties.origin_name || properties.origin_code)
    : (properties.dest_name || properties.dest_code);
}

function getNextConnectionColor(currentFilters: FlowConnectionFilter[]): string {
  return (
    COMPARISON_COLORS.find((color) => !currentFilters.some((filter) => filter.color === color)) ||
    COMPARISON_COLORS[currentFilters.length % COMPARISON_COLORS.length]
  );
}

export function FlowConnectionSelector({
  selectedAreaCode,
  direction,
  geographyLevel,
  demographicFilters = {},
  includeInternalFlows = false,
  value,
  onChange,
}: FlowConnectionSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState<FlowConnectionOption[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = normalizeSearchText(searchTerm);
  const counterpartLabel = direction === 'incoming' ? 'Origem' : 'Destino';
  const placeholder = direction === 'incoming'
    ? 'Buscar origem conectada'
    : 'Buscar destino conectado';
  const selectedCodes = useMemo(() => new Set(value.map((filter) => filter.code)), [value]);
  const hasReachedLimit = value.length >= MAX_COMPARED_CONNECTIONS;

  useEffect(() => {
    setSearchTerm('');
  }, [selectedAreaCode, direction, geographyLevel]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      if (!selectedAreaCode) {
        setOptions([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await loadFlowsFiltered(
          selectedAreaCode,
          direction,
          50000,
          geographyLevel,
          demographicFilters
        );

        const optionsByCode = new Map<string, FlowConnectionOption>();

        result.features.filter(isFlowFeature).forEach((feature) => {
          const { origin_code: originCode, dest_code: destCode, count } = feature.properties;
          if (!includeInternalFlows && originCode === destCode) return;

          const code = getCounterpartCode(feature.properties, direction);
          if (!code || code === selectedAreaCode) return;

          const name = getCounterpartName(feature.properties, direction);
          const existing = optionsByCode.get(code);

          if (existing) {
            existing.count += count;
            if (!existing.name && name) {
              existing.name = name;
            }
            return;
          }

          optionsByCode.set(code, {
            code,
            name,
            count,
          });
        });

        const nextOptions = Array.from(optionsByCode.values()).sort(
          (left, right) => right.count - left.count
        );

        if (!cancelled) {
          setOptions(nextOptions);
        }
      } catch (loadError) {
        if (!cancelled) {
          setOptions([]);
          setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar conexoes');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [
    demographicFilters,
    direction,
    geographyLevel,
    includeInternalFlows,
    selectedAreaCode,
  ]);

  const visibleOptions = useMemo(() => {
    const availableOptions = options.filter((option) => !selectedCodes.has(option.code));
    const filteredOptions = query
      ? availableOptions.filter((option) =>
          normalizeSearchText(`${option.name} ${option.code}`).includes(query)
        )
      : availableOptions;

    return filteredOptions.slice(0, 8);
  }, [options, query, selectedCodes]);

  const showDropdown =
    selectedAreaCode &&
    isFocused &&
    !loading &&
    !hasReachedLimit &&
    (visibleOptions.length > 0 || searchTerm.trim().length > 0);

  const handleAddConnection = (option: FlowConnectionOption) => {
    if (hasReachedLimit || selectedCodes.has(option.code)) {
      return;
    }

    onChange([
      ...value,
      {
        code: option.code,
        name: option.name || option.code,
        color: getNextConnectionColor(value),
      },
    ]);
    setSearchTerm('');
    setIsFocused(false);
  };

  const handleRemoveConnection = (code: string) => {
    onChange(value.filter((filter) => filter.code !== code));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Conexao especifica
          </p>
          <h4 className="text-xs font-bold text-slate-900">{counterpartLabel} do fluxo</h4>
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              onChange([]);
            }}
            className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-900"
          >
            Limpar
          </button>
        )}
      </div>

      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((filter) => (
            <span
              key={filter.code}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: filter.color || COMPARISON_COLORS[0] }}
              />
              <span className="truncate">{filter.name || filter.code}</span>
              <button
                type="button"
                onClick={() => handleRemoveConnection(filter.code)}
                className="ml-0.5 text-slate-400 transition-colors hover:text-slate-900"
                title={`Remover ${filter.name || filter.code}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className="relative"
        onBlur={(event) => {
          const nextFocusedElement = event.relatedTarget;
          if (
            !(nextFocusedElement instanceof Node) ||
            !event.currentTarget.contains(nextFocusedElement)
          ) {
            setIsFocused(false);
          }
        }}
      >
        <input
          type="text"
          value={searchTerm}
          disabled={!selectedAreaCode || hasReachedLimit}
          onChange={(event) => {
            setSearchTerm(event.target.value);
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={
            !selectedAreaCode
              ? 'Selecione uma area primeiro'
              : hasReachedLimit
                ? 'Limite de 3 fluxos atingido'
                : placeholder
          }
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 transition-all disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />

        {showDropdown && (
          <div className="absolute z-40 mt-1.5 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.code}
                  type="button"
                  onClick={() => {
                    handleAddConnection(option);
                  }}
                  className="w-full border-b border-slate-100 px-3 py-2 text-left transition-colors hover:bg-slate-50 last:border-b-0"
                >
                  <span className="block truncate text-xs font-semibold text-slate-900">
                    {option.name || option.code}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span className="truncate font-mono">{option.code}</span>
                    <span className="shrink-0 font-semibold">
                      {option.count.toLocaleString('pt-BR')} pessoas
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-slate-500">
                Nenhuma conexao encontrada.
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-4 text-slate-500">
        {loading
          ? 'Carregando conexoes...'
          : error
            ? error
            : value.length > 0
              ? `${value.length}/${MAX_COMPARED_CONNECTIONS} fluxos em comparacao no mapa e nos graficos.`
              : 'Opcional: adicione ate 3 locais para comparar fluxos origem-destino.'}
      </p>
    </div>
  );
}
