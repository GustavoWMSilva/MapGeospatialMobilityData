import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getLTLAAggregationDiagnostics } from '../../utils/duckdb';
import { getAnalyticsErrorMessage } from './analyticsUtils';
import { ChartObjectiveHelp } from './ChartObjectiveHelp';
import { MAP_COLORS } from '../../constants/mapColors';

interface AggregationValidationScatterProps {
  direction?: 'incoming' | 'outgoing';
  includeInternalFlows?: boolean;
}

interface ReferenceFlowFeature {
  properties?: {
    origin_code?: string;
    origin_name?: string;
    dest_code?: string;
    dest_name?: string;
    count?: number;
  };
}

interface ValidationPoint {
  ltlaCode: string;
  ltlaName: string;
  reference: number;
  dynamic: number;
  absDiff: number;
  errorPct: number | null;
  isOutlier?: boolean;
  mappedMsoaCount: number;
  mismatchType: 'ok' | 'reference_only' | 'dynamic_only' | 'missing_lookup';
}

function isReferenceFlowFeature(value: unknown): value is ReferenceFlowFeature {
  if (!value || typeof value !== 'object') return false;
  return true;
}

function isValidLTLACode(code: string): boolean {
  return /^(E0[6-9]|W06)[0-9]{6}$/.test(code);
}

export function AggregationValidationScatter({
  direction = 'incoming',
  includeInternalFlows = false,
}: AggregationValidationScatterProps) {
  const [comparisonMode, setComparisonMode] = useState<'fair' | 'full'>('fair');
  const [metricMode, setMetricMode] = useState<'legacy' | 'robust'>('robust');
  const [diagnosticsSummary, setDiagnosticsSummary] = useState<{
    unmappedMsoaCount: number;
    unmappedMsoaSample: string[];
    ignoredNonMsoaCount: number;
    referenceOnlyCodes: number;
    dynamicOnlyCodes: number;
  }>({
    unmappedMsoaCount: 0,
    unmappedMsoaSample: [],
    ignoredNonMsoaCount: 0,
    referenceOnlyCodes: 0,
    dynamicOnlyCodes: 0,
  });
  const [points, setPoints] = useState<ValidationPoint[]>([]);
  const [evaluationPoints, setEvaluationPoints] = useState<ValidationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadValidationData() {
      setLoading(true);
      setError(null);

      try {
        const [diagnostics, referenceResponse] = await Promise.all([
          getLTLAAggregationDiagnostics(direction, includeInternalFlows),
          fetch('/ltla_flows_complete.geojson'),
        ]);

        if (!referenceResponse.ok) {
          throw new Error(`Falha ao carregar referência LTLA (${referenceResponse.status})`);
        }

        const referenceJson = await referenceResponse.json() as { features?: unknown[] };
        const referenceFeatures = (referenceJson.features || []).filter(isReferenceFlowFeature);

        const referenceTotals = new Map<string, { total: number; name: string }>();
        referenceFeatures.forEach((feature) => {
          const props = feature.properties;
          if (!props) return;

          const targetCode = direction === 'incoming' ? props.dest_code : props.origin_code;
          const targetName = direction === 'incoming' ? props.dest_name : props.origin_name;
          const count = typeof props.count === 'number' ? props.count : 0;

          if (!targetCode || !targetName || count <= 0) return;
          if (!includeInternalFlows && props.origin_code === props.dest_code) return;
          if (!isValidLTLACode(targetCode)) return;

          const current = referenceTotals.get(targetCode) || { total: 0, name: targetName };
          referenceTotals.set(targetCode, {
            total: current.total + count,
            name: current.name || targetName,
          });
        });

        const dynamicMap = new Map(diagnostics.ltlas.map((row) => [row.ltla_code, row.dynamic_total]));
        const mappedMsoaMap = new Map(diagnostics.ltlas.map((row) => [row.ltla_code, row.mapped_msoa_count]));
        const ltlaNameMap = new Map(diagnostics.ltlas.map((row) => [row.ltla_code, row.ltla_name]));
        const allCodes = new Set<string>(
          [...Array.from(referenceTotals.keys()), ...Array.from(dynamicMap.keys())].filter(isValidLTLACode)
        );

        const merged: ValidationPoint[] = Array.from(allCodes).map((code) => {
          const referenceRow = referenceTotals.get(code);
          const reference = referenceRow?.total || 0;
          const dynamic = dynamicMap.get(code) || 0;
          const mappedMsoaCount = Number(mappedMsoaMap.get(code) || 0);
          const absDiff = Math.abs(dynamic - reference);
          const errorPct = reference > 0 ? (absDiff * 100) / reference : null;
          let mismatchType: ValidationPoint['mismatchType'] = 'ok';

          if (mappedMsoaCount === 0) {
            mismatchType = 'missing_lookup';
          } else if (reference > 0 && dynamic === 0) {
            mismatchType = 'reference_only';
          } else if (dynamic > 0 && reference === 0) {
            mismatchType = 'dynamic_only';
          }

          return {
            ltlaCode: code,
            ltlaName: referenceRow?.name || ltlaNameMap.get(code) || code,
            reference,
            dynamic,
            absDiff,
            errorPct,
            mappedMsoaCount,
            mismatchType,
          };
        }).filter((row) => row.reference > 0 || row.dynamic > 0);

        const sortedAbsDiff = [...merged].map((row) => row.absDiff).sort((a, b) => a - b);
        const p95Index = Math.max(0, Math.floor(sortedAbsDiff.length * 0.95) - 1);
        const p95AbsDiff = sortedAbsDiff[p95Index] || 0;
        const withOutliers = merged.map((row) => ({
          ...row,
          isOutlier:
            row.absDiff >= p95AbsDiff ||
            (row.errorPct !== null && row.errorPct >= 25),
        }));

        const fairRows = withOutliers.filter(
          (row) =>
            row.reference > 0 &&
            row.dynamic > 0 &&
            row.mismatchType === 'ok'
        );
        const safeFairRows = fairRows.length === 0 ? withOutliers : fairRows;
        const chartRows = comparisonMode === 'fair' ? safeFairRows : withOutliers;
        const summaryRows = comparisonMode === 'fair' ? safeFairRows : withOutliers;
        const referenceOnlyCodes = summaryRows.filter((row) => row.mismatchType === 'reference_only').length;
        const dynamicOnlyCodes = summaryRows.filter((row) => row.mismatchType === 'dynamic_only').length;

        if (!cancelled) {
          setPoints(chartRows);
          setEvaluationPoints(safeFairRows);
          setDiagnosticsSummary({
            unmappedMsoaCount: diagnostics.unmapped_msoa_count,
            unmappedMsoaSample: diagnostics.unmapped_msoa_sample,
            ignoredNonMsoaCount: diagnostics.ignored_non_msoa_count,
            referenceOnlyCodes,
            dynamicOnlyCodes,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setPoints([]);
          setEvaluationPoints([]);
          setError(getAnalyticsErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadValidationData();

    return () => {
      cancelled = true;
    };
  }, [direction, comparisonMode, includeInternalFlows]);

  const maxValue = useMemo(
    () => Math.max(1, ...points.map((p) => Math.max(p.reference, p.dynamic))),
    [points]
  );

  const qualityMetrics = useMemo(() => {
    if (evaluationPoints.length === 0) {
      return { mae: null, mape: null, smape: null, rmse: null, r2: null, r2Log: null };
    }

    const n = evaluationPoints.length;
    const absErrors = evaluationPoints.map((p) => Math.abs(p.dynamic - p.reference));
    const squaredErrors = evaluationPoints.map((p) => {
      const e = p.dynamic - p.reference;
      return e * e;
    });

    const mae = absErrors.reduce((sum, value) => sum + value, 0) / n;
    const rmse = Math.sqrt(squaredErrors.reduce((sum, value) => sum + value, 0) / n);

    const mapeBase = evaluationPoints.filter((p) => p.reference > 0);
    const mape = mapeBase.length
      ? (mapeBase.reduce((sum, p) => sum + Math.abs((p.dynamic - p.reference) / p.reference), 0) / mapeBase.length) * 100
      : null;

    const smapeBase = evaluationPoints.filter((p) => (Math.abs(p.reference) + Math.abs(p.dynamic)) > 0);
    const smape = smapeBase.length
      ? (smapeBase.reduce((sum, p) => {
          const denom = (Math.abs(p.reference) + Math.abs(p.dynamic)) / 2;
          return sum + (denom === 0 ? 0 : Math.abs(p.dynamic - p.reference) / denom);
        }, 0) / smapeBase.length) * 100
      : null;

    const meanReference = evaluationPoints.reduce((sum, p) => sum + p.reference, 0) / n;
    const ssRes = evaluationPoints.reduce((sum, p) => sum + (p.dynamic - p.reference) ** 2, 0);
    const ssTot = evaluationPoints.reduce((sum, p) => sum + (p.reference - meanReference) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;

    const logs = evaluationPoints.map((p) => ({
      ref: Math.log1p(Math.max(0, p.reference)),
      dyn: Math.log1p(Math.max(0, p.dynamic)),
    }));
    const meanLogRef = logs.reduce((sum, p) => sum + p.ref, 0) / logs.length;
    const ssResLog = logs.reduce((sum, p) => sum + (p.dyn - p.ref) ** 2, 0);
    const ssTotLog = logs.reduce((sum, p) => sum + (p.ref - meanLogRef) ** 2, 0);
    const r2Log = ssTotLog > 0 ? 1 - ssResLog / ssTotLog : null;

    return { mae, mape, smape, rmse, r2, r2Log };
  }, [evaluationPoints]);

  const topDeviations = useMemo(
    () => [...points].sort((a, b) => b.absDiff - a.absDiff).slice(0, 10),
    [points]
  );

  const { outlierPoints, regularPoints } = useMemo(() => {
    const outliers = points.filter((p) => p.isOutlier);
    const regular = points.filter((p) => !p.isOutlier);
    return { outlierPoints: outliers, regularPoints: regular };
  }, [points]);

  const validationSummary = useMemo(() => {
    if (metricMode === 'legacy') {
      const { r2, mape } = qualityMetrics;
      if (r2 === null || mape === null) {
        return {
          level: 'insuficiente',
          text: 'Não foi possível classificar a validação com os dados atuais.',
          color: 'text-gray-700 bg-gray-100 border-gray-200',
        };
      }

      if ((r2 >= 0.95 && mape <= 2) || (r2 >= 0.9 && mape <= 1)) {
        return {
          level: 'forte',
          text: 'Validação forte: agregação dinâmica muito próxima da referência.',
          color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
        };
      }

      if ((r2 >= 0.9 && mape <= 5) || (r2 >= 0.85 && mape <= 2)) {
        return {
          level: 'moderada',
          text: 'Validação moderada: há boa aderência, com desvios em alguns casos.',
          color: 'text-amber-800 bg-amber-50 border-amber-200',
        };
      }

      return {
        level: 'fraca',
        text: 'Validação fraca: os desvios estão altos e merecem investigação.',
        color: 'text-red-800 bg-red-50 border-red-200',
      };
    }

    const { r2Log, smape } = qualityMetrics;
    if (r2Log === null || smape === null) {
      return {
        level: 'insuficiente',
        text: 'Não foi possível classificar a validação com os dados atuais.',
        color: 'text-gray-700 bg-gray-100 border-gray-200',
      };
    }

    if (r2Log >= 0.92 && smape <= 22) {
      return {
        level: 'forte',
        text: 'Validação forte: a agregação dinâmica acompanha bem a referência (escala log).',
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      };
    }

    if (r2Log >= 0.82 && smape <= 35) {
      return {
        level: 'moderada',
        text: 'Validação moderada: boa aderência geral, com desvios em alguns blocos.',
        color: 'text-amber-800 bg-amber-50 border-amber-200',
      };
    }

    return {
      level: 'fraca',
      text: 'Validação fraca: os desvios globais ainda estão altos e merecem investigação.',
      color: 'text-red-800 bg-red-50 border-red-200',
    };
  }, [qualityMetrics, metricMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80 text-red-600 text-sm">
        {error}
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-gray-500 p-4 text-center">
        <p className="font-semibold">Sem dados para validação MSOA→LTLA</p>
        <p className="text-sm mt-2">Verifique a referência e os dados dinâmicos</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">Validação MSOA→LTLA (Referência vs Dinâmico)</h3>
          <ChartObjectiveHelp objective="Validar a consistência técnica da agregação MSOA→LTLA comparando totais dinâmicos com uma referência externa." />
        </div>
        <p className="text-xs text-gray-600">
          Scatter com linha y=x ({direction === 'incoming' ? 'incoming' : 'outgoing'})
        </p>
      </div>

      <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${validationSummary.color}`}>
        <strong className="uppercase">Validação {validationSummary.level}:</strong> {validationSummary.text}
        <div className="mt-1 text-[11px] opacity-80">
          Outliers detectados: {outlierPoints.length} de {points.length} LTLAs.
          {comparisonMode === 'full' && ' Métricas calculadas na base de comparação justa.'}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setComparisonMode('fair')}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            comparisonMode === 'fair'
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Comparação Justa
        </button>
        <button
          type="button"
          onClick={() => setComparisonMode('full')}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            comparisonMode === 'full'
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Comparação Completa
        </button>
        <span className="text-[11px] text-gray-600">
          Justa: somente LTLAs com códigos casados nos dois lados e com lookup válido.
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMetricMode('legacy')}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            metricMode === 'legacy'
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Métrica legada
        </button>
        <button
          type="button"
          onClick={() => setMetricMode('robust')}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
            metricMode === 'robust'
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-purple-200 bg-white text-purple-700 hover:bg-purple-50'
          }`}
        >
          Métrica robusta
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          MSOAs sem match no lookup: <strong>{diagnosticsSummary.unmappedMsoaCount}</strong>
        </div>
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-900">
          Códigos apenas na referência: <strong>{diagnosticsSummary.referenceOnlyCodes}</strong>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Códigos apenas no dinâmico: <strong>{diagnosticsSummary.dynamicOnlyCodes}</strong>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-700">
        Códigos não-MSOA válidos ignorados automaticamente: <strong>{diagnosticsSummary.ignoredNonMsoaCount}</strong>
      </div>

      {diagnosticsSummary.unmappedMsoaSample.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          Exemplo de MSOAs sem lookup: {diagnosticsSummary.unmappedMsoaSample.slice(0, 8).join(', ')}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
          <div className="text-[11px] font-medium text-purple-700">
            {metricMode === 'legacy' ? 'R²' : 'R² (log)'}
          </div>
          <div className="text-sm font-semibold text-purple-900">
            {metricMode === 'legacy'
              ? (qualityMetrics.r2 === null ? '-' : qualityMetrics.r2.toFixed(4))
              : (qualityMetrics.r2Log === null ? '-' : qualityMetrics.r2Log.toFixed(4))}
          </div>
        </div>
        <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
          <div className="text-[11px] font-medium text-purple-700">
            {metricMode === 'legacy' ? 'MAPE' : 'sMAPE'}
          </div>
          <div className="text-sm font-semibold text-purple-900">
            {metricMode === 'legacy'
              ? (qualityMetrics.mape === null ? '-' : `${qualityMetrics.mape.toFixed(2)}%`)
              : (qualityMetrics.smape === null ? '-' : `${qualityMetrics.smape.toFixed(2)}%`)}
          </div>
        </div>
        <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
          <div className="text-[11px] font-medium text-purple-700">MAE</div>
          <div className="text-sm font-semibold text-purple-900">
            {qualityMetrics.mae === null ? '-' : qualityMetrics.mae.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
          <div className="text-[11px] font-medium text-purple-700">RMSE</div>
          <div className="text-sm font-semibold text-purple-900">
            {qualityMetrics.rmse === null ? '-' : qualityMetrics.rmse.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="reference"
            name="Referência"
            tickFormatter={(value: number) => Number(value).toLocaleString()}
          />
          <YAxis
            type="number"
            dataKey="dynamic"
            name="Dinâmico"
            tickFormatter={(value: number) => Number(value).toLocaleString()}
          />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: maxValue, y: maxValue },
            ]}
            stroke="#374151"
            strokeDasharray="4 4"
          />
          <Tooltip
            formatter={(value: number | string | Array<number | string> | undefined, name) => [
              Number(value ?? 0).toLocaleString(),
              String(name ?? ''),
            ]}
            labelFormatter={(_label, payload) => {
              const row = payload && payload.length > 0 ? payload[0]?.payload as ValidationPoint | undefined : undefined;
              if (!row) return '';
              return `${row.ltlaName} (${row.ltlaCode})`;
            }}
          />
          <Legend />
          <Scatter name="LTLAs (regulares)" data={regularPoints} fill={MAP_COLORS.analytics.scatter.regular} />
          <Scatter name="LTLAs (outliers)" data={outlierPoints} fill={MAP_COLORS.analytics.scatter.outlier} />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-xs border border-purple-100 rounded-lg overflow-hidden">
          <thead className="bg-purple-50 text-purple-900">
            <tr>
              <th className="px-3 py-2 text-left">LTLA</th>
              <th className="px-3 py-2 text-right">Referência</th>
              <th className="px-3 py-2 text-right">Dinâmico</th>
              <th className="px-3 py-2 text-right">MSOAs Lookup</th>
              <th className="px-3 py-2 text-right">Dif. Abs.</th>
              <th className="px-3 py-2 text-right">Erro (%)</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Outlier</th>
            </tr>
          </thead>
          <tbody>
            {topDeviations.map((row) => (
              <tr
                key={row.ltlaCode}
                className={`border-t border-purple-50 ${row.isOutlier ? 'bg-red-50/60' : ''}`}
              >
                <td className="px-3 py-2">
                  <div className="font-medium text-gray-800">{row.ltlaName}</div>
                  <div className="text-gray-500">{row.ltlaCode}</div>
                </td>
                <td className="px-3 py-2 text-right">{row.reference.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{row.dynamic.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{row.mappedMsoaCount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-semibold">{row.absDiff.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">
                  {row.errorPct === null ? '-' : `${row.errorPct.toFixed(2)}%`}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.mismatchType === 'ok' && 'OK'}
                  {row.mismatchType === 'missing_lookup' && 'Sem lookup'}
                  {row.mismatchType === 'reference_only' && 'Só referência'}
                  {row.mismatchType === 'dynamic_only' && 'Só dinâmico'}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.isOutlier ? 'Sim' : 'Não'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

