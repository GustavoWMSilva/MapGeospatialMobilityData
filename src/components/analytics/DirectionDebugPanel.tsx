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
      } catch (currentError) {
        console.error('[DirectionDebugPanel] erro ao carregar diagnostico', currentError);
        setError(getAnalyticsErrorMessage(currentError));
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [areaCode]);

  if (!areaCode) return null;

  if (loading) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
        <h3 className="font-bold text-yellow-800 mb-2">Diagnostico de direcao</h3>
        <p className="text-sm text-yellow-700">Comparando entrada vs saida...</p>
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
        Diagnostico de direcao - {areaCode}
      </h3>

      <div className="mb-4">
        <div className={`flex items-center gap-2 mb-2 ${socialIguais ? 'text-red-700' : 'text-green-700'}`}>
          <span className="font-semibold">
            Classe social: {socialIguais ? 'ENTRADA = SAIDA (PROBLEMA!)' : 'Entrada diferente de saida (correto)'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-white rounded p-2">
            <div className="font-bold text-blue-700 mb-1">ENTRADA (pessoas que chegam)</div>
            {incomingSocial.map((item, index) => (
              <div key={index}>{item.grade}: {item.percentage}%</div>
            ))}
          </div>
          <div className="bg-white rounded p-2">
            <div className="font-bold text-orange-700 mb-1">SAIDA (pessoas que saem)</div>
            {outgoingSocial.map((item, index) => (
              <div key={index}>{item.grade}: {item.percentage}%</div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className={`flex items-center gap-2 mb-2 ${ageIguais ? 'text-red-700' : 'text-green-700'}`}>
          <span className="font-semibold">
            Idade: {ageIguais ? 'ENTRADA = SAIDA (PROBLEMA!)' : 'Entrada diferente de saida (correto)'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="bg-white rounded p-2">
            <div className="font-bold text-blue-700 mb-1">ENTRADA (pessoas que chegam)</div>
            {incomingAge.map((item, index) => (
              <div key={index}>{item.ageGroup}: {item.percentage}%</div>
            ))}
          </div>
          <div className="bg-white rounded p-2">
            <div className="font-bold text-orange-700 mb-1">SAIDA (pessoas que saem)</div>
            {outgoingAge.map((item, index) => (
              <div key={index}>{item.ageGroup}: {item.percentage}%</div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-600 border-t pt-2">
        <strong>Como interpretar:</strong>
        <ul className="list-disc ml-5 mt-1">
          <li><strong>ENTRADA:</strong> Perfil de quem mora em outros lugares e vem trabalhar nesta area</li>
          <li><strong>SAIDA:</strong> Perfil de quem mora nesta area e vai trabalhar em outros lugares</li>
          <li>Se os valores forem iguais, ha um bug na query SQL</li>
        </ul>
      </div>
    </div>
  );
}
