import React, { useEffect, useState } from 'react';

interface LTLAOption {
  code: string;
  name: string;
  msoa_count: number;
}

interface LTLASelectorProps {
  selectedLTLA: string | null;
  onSelectLTLA: (ltlaCode: string, ltlaName: string) => void;
  onClearSelection: () => void;
}

export const LTLASelector: React.FC<LTLASelectorProps> = ({
  selectedLTLA,
  onSelectLTLA,
  onClearSelection
}) => {
  const [ltlas, setLtlas] = useState<LTLAOption[]>([]);
  const [filteredLtlas, setFilteredLtlas] = useState<LTLAOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLTLAName, setSelectedLTLAName] = useState<string>('');

  // Carregar lista de LTLAs
  useEffect(() => {
    fetch('/data/lookup/ltla_centroids.csv')
      .then(response => response.text())
      .then(csvText => {
        // Função para fazer parsing correto de CSV com campos entre aspas
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let insideQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          
          result.push(current.trim());
          return result;
        };

        const lines = csvText.split('\n');
        const data: LTLAOption[] = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = parseCSVLine(line);
            return {
              code: values[0]?.trim() || '',
              name: values[1]?.trim() || '',
              msoa_count: parseInt(values[4]?.trim() || '0')
            };
          })
          .filter(ltla => ltla.code && ltla.name)
          .sort((a, b) => a.name.localeCompare(b.name));

        setLtlas(data);
        setFilteredLtlas(data);
      })
      .catch(err => console.error('Erro ao carregar LTLAs:', err));
  }, []);

  // Filtrar LTLAs baseado na busca
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredLtlas(ltlas);
    } else {
      const filtered = ltlas.filter(ltla =>
        ltla.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ltla.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredLtlas(filtered);
    }
  }, [searchTerm, ltlas]);

  // Atualizar nome quando seleção externa muda
  useEffect(() => {
    if (selectedLTLA) {
      const ltla = ltlas.find(l => l.code === selectedLTLA);
      if (ltla) {
        setSelectedLTLAName(ltla.name);
      }
    } else {
      setSelectedLTLAName('');
    }
  }, [selectedLTLA, ltlas]);

  const handleSelect = (ltla: LTLAOption) => {
    onSelectLTLA(ltla.code, ltla.name);
    setSearchTerm('');
    setShowDropdown(false);
  };

  return (
    <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-lg border border-purple-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-5 py-3">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          Seleção por Distrito
        </h3>
        <p className="text-purple-100 text-xs mt-1">
          {ltlas.length} cidades e distritos disponíveis
        </p>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="relative">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cidade... (ex: London, Manchester, Birmingham)"
              className="w-full pl-4 pr-10 py-3 border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 font-medium"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setShowDropdown(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Dropdown com opções */}
          {showDropdown && filteredLtlas.length > 0 && searchTerm && (
            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-purple-200 rounded-lg shadow-2xl max-h-80 overflow-hidden">
              <div className="overflow-y-auto max-h-80">
                {filteredLtlas.slice(0, 30).map((ltla) => (
                  <button
                    key={ltla.code}
                    onClick={() => handleSelect(ltla)}
                    className="w-full text-left px-4 py-3 hover:bg-purple-50 active:bg-purple-100 transition-colors border-b border-gray-100 last:border-b-0 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
                          {ltla.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{ltla.code}</span>
                          <span>•</span>
                          <span className="text-purple-600 font-medium">{ltla.msoa_count} áreas</span>
                        </div>
                      </div>
                      <div className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        →
                      </div>
                    </div>
                  </button>
                ))}
                {filteredLtlas.length > 30 && (
                  <div className="px-4 py-3 text-xs text-center bg-gradient-to-b from-gray-50 to-gray-100 text-gray-600 font-medium sticky bottom-0 border-t border-gray-200">
                    +{filteredLtlas.length - 30} mais resultados... Continue digitando para refinar
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No results */}
          {showDropdown && filteredLtlas.length === 0 && searchTerm && (
            <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4 text-center">
              <div className="text-gray-400 text-4xl mb-2">🔍</div>
              <p className="text-gray-600 font-medium">Nenhum distrito encontrado</p>
              <p className="text-xs text-gray-500 mt-1">Tente buscar por "London", "Manchester" ou "Cardiff"</p>
            </div>
          )}
        </div>
        
        {/* Área selecionada */}
        {selectedLTLA ? (
          <div className="mt-4">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-white text-xs font-semibold uppercase tracking-wider mb-1 opacity-90">
                    Distrito Selecionado
                  </div>
                  <div className="text-white text-xl font-bold leading-tight">
                    {selectedLTLAName}
                  </div>
                  <div className="text-purple-200 text-xs font-mono mt-2">
                    {selectedLTLA}
                  </div>
                </div>
                <button
                  onClick={onClearSelection}
                  className="px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 active:bg-purple-100 transition-all font-bold shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  title="Limpar seleção"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <div>
                <p className="text-sm text-blue-800 font-medium">Como usar</p>
                <p className="text-xs text-blue-600 mt-1">
                  Digite o nome de uma cidade para visualizar os fluxos de mobilidade agregados por distrito
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
