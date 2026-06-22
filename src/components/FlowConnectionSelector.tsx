import { useEffect, useMemo, useState } from 'react';
import { loadFlowsFiltered } from '../utils/dataService';
import type {
  DemographicFilters,
  FlowConnectionFilter,
  GeographyLevel,
} from '../types';

interface FlowConnectionSelectorProps {
  selectedAreaCode?: string;
  direction: 'incoming' | 'outgoing';
  geographyLevel: GeographyLevel;
  demographicFilters?: DemographicFilters;
  includeInternalFlows?: boolean;
  value: FlowConnectionFilter | null;
  onChange: (value: FlowConnectionFilter | null) => void;
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

  useEffect(() => {
    if (value) {
      setSearchTerm(value.name || value.code);
    }
  }, [value]);

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
    const filteredOptions = query
      ? options.filter((option) =>
          normalizeSearchText(`${option.name} ${option.code}`).includes(query)
        )
      : options;

    return filteredOptions.slice(0, 8);
  }, [options, query]);

  const showDropdown =
    selectedAreaCode &&
    isFocused &&
    !loading &&
    (visibleOptions.length > 0 || searchTerm.trim().length > 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Conexao especifica
          </p>
          <h4 className="text-xs font-bold text-slate-900">{counterpartLabel} do fluxo</h4>
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              onChange(null);
            }}
            className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:text-slate-900"
          >
            Limpar
          </button>
        )}
      </div>

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
          disabled={!selectedAreaCode}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            if (value) {
              onChange(null);
            }
          }}
          onFocus={() => setIsFocused(true)}
          placeholder={selectedAreaCode ? placeholder : 'Selecione uma area primeiro'}
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
                    onChange({ code: option.code, name: option.name || option.code });
                    setIsFocused(false);
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
            : value
              ? `Mapa e graficos filtrados por ${value.name || value.code}.`
              : 'Opcional: escolha um local para ver apenas esse par origem-destino.'}
      </p>
    </div>
  );
}
