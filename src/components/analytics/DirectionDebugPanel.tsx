import { useEffect, useState } from 'react';
import { getSocialGradeStats, getAgeStats } from '../../utils/duckdb';
import { debugLog, getAnalyticsErrorMessage } from './analyticsUtils';

interface DirectionDebugPanelProps {
  areaCode: string;
}

export function DirectionDebugPanel({ areaCode }: DirectionDebugPanelProps) {
  const [incomingSocial, setIncomingSocial] = useState<any[]>([]);
  const [outgoingSocial, setOutgoingSocial] = useState<any[]>([]);
  const [incomingAge, setIncomingAge] = useState<any[]>([]);
  const [outgoingAge, setOutgoingAge] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!areaCode) return;

      debugLog('[DirectionDebugPanel] carregando dados de comparacao');
      setLoading(true);
      setError(null);

      try {
        // Carregar INCOMING e OUTGOING em paralelo
        const [incSocial, outSocial, incAge, outAge] = await Promise.all([
          getSocialGradeStats(areaCode, 'incoming'),
          getSocialGradeStats(areaCode, 'outgoing'),
          getAgeStats(areaCode, 'incoming'),
          getAgeStats(areaCode, 'outgoing'),
        ]);

        setIncomingSocial(incSocial);
        setOutgoingSocial(outSocial);
        setIncomingAge(incAge);
        setOutgoingAge(outAge);

        // Comparar se são iguais
        const socialIguais = JSON.stringify(incSocial) === JSON.stringify(outSocial);
        const ageIguais = JSON.stringify(incAge) === JSON.stringify(outAge);

        debugLog('[DirectionDebugPanel] diagnostico', {
          socialIguais,
          ageIguais,
          incSocial,
          outSocial,
          incAge,
          outAge,
        });
      } catch (error) {
        console.error('[DirectionDebugPanel] erro ao carregar diagnostico', error);
        setError(getAnalyticsErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [areaCode]);

  if (!areaCode) return null;

  if (loading) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
        <h3 className="font-bold text-yellow-800 mb-2">🔍 Diagnóstico de Direção</h3>
        <p className="text-sm text-yellow-700">Comparando incoming vs outgoing...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 mb-4 text-sm text-red-700">
        <strong>Erro no diagnostico:</strong> {error}
      </div>
    );
  }

  const socialIguais = JSON.stringify(incomingSocial) === JSON.stringify(outgoingSocial);
  const ageIguais = JSON.stringify(incomingAge) === JSON.stringify(outgoingAge);

  return (
    <div className={`border-2 rounded-lg p-4 mb-4 ${socialIguais || ageIguais ? 'bg-red-50 border-red-500' : 'bg-green-50 border-green-500'}`}>
      <h3 className="font-bold mb-3">
        🔍 Diagnóstico de Direção - {areaCode}
      </h3>

      {/* Social Grade */}
      <div className="mb-4">
        <div className={`flex items-center gap-2 mb-2 ${socialIguais ? 'text-red-700' : 'text-green-700'}`}>
          <span className="text-lg">{socialIguais ? '⚠️' : '✅'}</span>
          <span className="font-semibold">
            Social Grade: {socialIguais ? 'INCOMING = OUTGOING (PROBLEMA!)' : 'Incoming ≠ Outgoing (correto)'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-white rounded p-2">
            <div className="font-bold text-blue-700 mb-1">INCOMING (pessoas que chegam)</div>
            {incomingSocial.map((s, i) => (
              <div key={i}>{s.grade}: {s.percentage}%</div>
            ))}
          </div>
          <div className="bg-white rounded p-2">
            <div className="font-bold text-orange-700 mb-1">OUTGOING (pessoas que saem)</div>
            {outgoingSocial.map((s, i) => (
              <div key={i}>{s.grade}: {s.percentage}%</div>
            ))}
          </div>
        </div>
      </div>

      {/* Age */}
      <div>
        <div className={`flex items-center gap-2 mb-2 ${ageIguais ? 'text-red-700' : 'text-green-700'}`}>
          <span className="text-lg">{ageIguais ? '⚠️' : '✅'}</span>
          <span className="font-semibold">
            Age: {ageIguais ? 'INCOMING = OUTGOING (PROBLEMA!)' : 'Incoming ≠ Outgoing (correto)'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-white rounded p-2">
            <div className="font-bold text-blue-700 mb-1">INCOMING (pessoas que chegam)</div>
            {incomingAge.map((a, i) => (
              <div key={i}>{a.ageGroup}: {a.percentage}%</div>
            ))}
          </div>
          <div className="bg-white rounded p-2">
            <div className="font-bold text-orange-700 mb-1">OUTGOING (pessoas que saem)</div>
            {outgoingAge.map((a, i) => (
              <div key={i}>{a.ageGroup}: {a.percentage}%</div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-600 border-t pt-2">
        <strong>Como interpretar:</strong>
        <ul className="list-disc ml-5 mt-1">
          <li><strong>INCOMING:</strong> Perfil de quem MORA em outros lugares e VEM trabalhar nesta área</li>
          <li><strong>OUTGOING:</strong> Perfil de quem MORA nesta área e VAI trabalhar em outros lugares</li>
          <li>Se os valores forem iguais, há um bug na query SQL</li>
        </ul>
      </div>
    </div>
  );
}
