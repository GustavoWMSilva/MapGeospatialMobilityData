# 📊 Analytics Dashboard - Guia de Uso

## ✅ Componentes Criados

### **1. SocialGradePieChart** 🥧

Gráfico de pizza mostrando distribuição de classes sociais.

**Características:**

- 4 categorias: AB (Alta), C1 (Média), C2 (Trabalh. Qualificada), DE (Trabalh.)
- Cores distintas por classe
- Percentuais e totais
- Tooltip interativo

### **2. AgeBarChart** 📊

Gráfico de barras comparando faixas etárias.

**Características:**

- 6 faixas etárias: 16-24, 25-34, 35-44, 45-54, 55-64, 65+
- Cores degradê por idade
- Ordenação cronológica
- Totais e percentuais

### **3. AnalyticsFilters** 🔍

Seletor de filtros para análise.

**Filtros disponíveis:**

- **Direction**: Incoming / Outgoing
- **Social Grade**: AB, C1, C2, DE, All
- **Age Group**: 6 faixas + All
- Resumo de filtros ativos
- Descrições contextuais

### **4. AnalyticsDashboard** 🎯

Dashboard integrado com todos os componentes.

**Features:**

- Header com informações da área
- Contagem de flows filtrados
- Grid de 2 gráficos
- 4 cards de métricas
- Painel informativo

---

## 🚀 Como Usar

### **Opção 1: Integrar no App Existente**

Adicione o dashboard ao seu componente principal:

```tsx
import { useState } from "react";
import { AnalyticsDashboard } from "@/components/analytics";

function App() {
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [areaName, setAreaName] = useState<string>("");

  return (
    <div className="app">
      {/* Seu mapa existente */}
      <InteractiveMap
        onAreaSelect={(code, name) => {
          setSelectedArea(code);
          setAreaName(name);
        }}
      />

      {/* Novo Dashboard Analytics */}
      <AnalyticsDashboard selectedArea={selectedArea} areaName={areaName} />
    </div>
  );
}
```

### **Opção 2: Criar Rota Separada**

Crie uma página dedicada para analytics:

```tsx
// src/pages/Analytics.tsx
import { useSearchParams } from "react-router-dom";
import { AnalyticsDashboard } from "@/components/analytics";

export function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const areaCode = searchParams.get("area");
  const areaName = searchParams.get("name");

  return (
    <div className="container mx-auto px-4 py-8">
      <AnalyticsDashboard
        selectedArea={areaCode || undefined}
        areaName={areaName || undefined}
      />
    </div>
  );
}

// Adicionar rota no router
// <Route path="/analytics" element={<AnalyticsPage />} />
```

### **Opção 3: Modal/Sidebar**

Use como modal flutuante ou sidebar:

```tsx
import { useState } from "react";
import { AnalyticsDashboard } from "@/components/analytics";

function MapWithAnalytics() {
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedArea, setSelectedArea] = useState("");

  return (
    <>
      <Map onSelect={setSelectedArea} />

      <button
        onClick={() => setShowAnalytics(!showAnalytics)}
        className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        📊 View Analytics
      </button>

      {showAnalytics && (
        <div className="fixed right-0 top-0 h-full w-1/2 bg-white shadow-xl overflow-y-auto p-6">
          <AnalyticsDashboard selectedArea={selectedArea} />
        </div>
      )}
    </>
  );
}
```

---

## 📋 Exemplo Completo de Integração

```tsx
// src/App.tsx
import { useState } from "react";
import { InteractiveMap } from "@/components/InteractiveMap";
import { AnalyticsDashboard } from "@/components/analytics";

export default function App() {
  const [selectedLTLA, setSelectedLTLA] = useState<string>("");
  const [ltlaName, setLtlaName] = useState<string>("");
  const [showAnalytics, setShowAnalytics] = useState(false);

  const handleAreaSelect = (code: string, name: string) => {
    setSelectedLTLA(code);
    setLtlaName(name);
    setShowAnalytics(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Census 2021 - Mobility Analysis
          </h1>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={`px-4 py-2 rounded-lg font-medium ${
              showAnalytics
                ? "bg-gray-200 text-gray-700"
                : "bg-blue-600 text-white"
            }`}
          >
            {showAnalytics ? "🗺️ Show Map" : "📊 Show Analytics"}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {!showAnalytics ? (
          <div className="px-4 py-6 sm:px-0">
            <InteractiveMap onAreaSelect={handleAreaSelect} />
          </div>
        ) : (
          <div className="px-4 py-6 sm:px-0">
            <AnalyticsDashboard
              selectedArea={selectedLTLA}
              areaName={ltlaName}
            />
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## 🎨 Customização

### **Cores**

Edite as cores dos gráficos nos componentes:

```typescript
// SocialGradePieChart.tsx
const COLORS = {
  AB: "#2563eb", // Azul
  C1: "#10b981", // Verde
  C2: "#f59e0b", // Amarelo
  DE: "#ef4444", // Vermelho
};

// AgeBarChart.tsx
const AGE_COLORS = {
  "16-24": "#8b5cf6", // Roxo
  "25-34": "#3b82f6", // Azul
  // ...
};
```

### **Tamanhos de Gráficos**

Ajuste o height nas ResponsiveContainer:

```tsx
<ResponsiveContainer width="100%" height={400}>
  {/* Aumentar de 300 para 400 */}
</ResponsiveContainer>
```

### **Adicionar Novos Gráficos**

Crie novos componentes em `src/components/analytics/`:

```tsx
// LineChart.tsx - Comparação temporal
// HeatMap.tsx - Matriz social grade × age
// RadarChart.tsx - Perfil multidimensional
```

---

## 📊 Métricas Disponíveis

### **Via Props do Dashboard:**

- `selectedArea` - Código LTLA/MSOA
- `areaName` - Nome da área

### **Via Hooks Internos:**

- Total de flows filtrados
- Direction (incoming/outgoing)
- Social grade ativo
- Age group ativo

### **Via DuckDB:**

- `getSocialGradeStats()` - Distribuição de classes
- `getAgeStats()` - Distribuição de idades
- `getMSOAFlowsBySocialGrade()` - Flows por classe
- `getMSOAFlowsByAge()` - Flows por idade

---

## 🐛 Troubleshooting

### **Gráficos não aparecem:**

1. Verifique se `recharts` está instalado: `npm list recharts`
2. Confirme que `selectedArea` não é undefined
3. Abra console para ver erros de queries

### **Dados não carregam:**

1. Verifique se DuckDB inicializou: veja console
2. Confirme que Parquets estão no GitHub
3. Teste queries direto: `await getSocialGradeStats('E02000001')`

### **Performance lenta:**

1. Limite número de flows: ajuste `limit` nas queries
2. Use memoização: `useMemo` para dados processados
3. Debounce filtros: evite recarregar a cada mudança

---

## ✅ Checklist de Implementação

- [x] SocialGradePieChart criado
- [x] AgeBarChart criado
- [x] AnalyticsFilters criado
- [x] AnalyticsDashboard criado
- [x] Recharts instalado
- [ ] Integrar no App.tsx
- [ ] Testar com área selecionada
- [ ] Adicionar loading states
- [ ] Otimizar performance
- [ ] Documentar insights

**Próximo passo:** Integre o `<AnalyticsDashboard />` no seu App!
