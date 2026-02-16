# 🚀 DuckDB Analytics - Guia de Uso

## ✅ **O QUE FOI IMPLEMENTADO**

O DuckDB-WASM agora carrega **3 datasets** automaticamente:

1. **`flows`** - ODWP01EW_MSOA.parquet (flows básicos)
2. **`flows_social_grade`** - ODWP09EW_MSOA.parquet (por classe social)
3. **`flows_age`** - ODWP04EW_MSOA.parquet (por faixa etária)

---

## 📦 **NOVAS FUNÇÕES DISPONÍVEIS**

### **1. getMSOAFlowsBySocialGrade()**

Obtém flows filtrados por classe social.

```typescript
import { getMSOAFlowsBySocialGrade } from "@/utils/duckdb";

// Todos os flows (todas as classes sociais)
const allFlows = await getMSOAFlowsBySocialGrade(
  "E02000001", // MSOA code
  "all", // social grade
  "incoming", // direction
  2000, // limit
);

// Apenas classe alta (AB)
const abFlows = await getMSOAFlowsBySocialGrade(
  "E02000001",
  "AB", // Higher/intermediate professionals
  "incoming",
  1000,
);

// Classe trabalhadora (DE)
const deFlows = await getMSOAFlowsBySocialGrade(
  "E02000001",
  "DE", // Semi-skilled/unskilled
  "outgoing",
  1000,
);
```

**Retorno:**

```typescript
interface SocialGradeFlowResult {
  origin_code: string;
  dest_code: string;
  social_grade_code: number;
  social_grade: string; // ex: "AB Higher and intermediate..."
  count: number;
}
```

**Opções de Social Grade:**

- `'AB'` - Classe alta (profissionais, gerentes)
- `'C1'` - Classe média-alta (supervisores, escritório)
- `'C2'` - Classe trabalhadora qualificada (manual qualificado)
- `'DE'` - Classe trabalhadora (semi-qualificado, desempregados)
- `'all'` - Todas as classes (exceto "Does not apply")

---

### **2. getMSOAFlowsByAge()**

Obtém flows filtrados por faixa etária.

```typescript
import { getMSOAFlowsByAge } from "@/utils/duckdb";

// Todos os flows (todas as idades)
const allFlows = await getMSOAFlowsByAge("E02000001", "all", "incoming", 2000);

// Apenas jovens profissionais (25-34)
const youngFlows = await getMSOAFlowsByAge(
  "E02000001",
  "Aged 25 to 34 years",
  "incoming",
  1000,
);

// Aposentados ainda trabalhando (65+)
const seniorFlows = await getMSOAFlowsByAge(
  "E02000001",
  "Aged 65 years and over",
  "outgoing",
  500,
);
```

**Retorno:**

```typescript
interface AgeFlowResult {
  origin_code: string;
  dest_code: string;
  age_code: number;
  age_group: string; // ex: "Aged 25 to 34 years"
  count: number;
}
```

**Opções de Age Group:**

- `'Aged 16 to 24 years'`
- `'Aged 25 to 34 years'`
- `'Aged 35 to 44 years'`
- `'Aged 45 to 54 years'`
- `'Aged 55 to 64 years'`
- `'Aged 65 years and over'`
- `'all'` - Todas as idades

---

### **3. getSocialGradeStats()**

Obtém estatísticas agregadas de classe social para uma área.

```typescript
import { getSocialGradeStats } from "@/utils/duckdb";

const stats = await getSocialGradeStats(
  "E02000001", // MSOA code
  "incoming", // direction
);

// Resultado:
// [
//   { grade: "AB Higher...", total: 5230, percentage: 35.2 },
//   { grade: "C1 Supervisory...", total: 4100, percentage: 27.6 },
//   { grade: "C2 Skilled...", total: 3200, percentage: 21.5 },
//   { grade: "DE Semi-skilled...", total: 2320, percentage: 15.7 }
// ]
```

**Uso:**

- Criar gráfico de pizza mostrando composição social
- Comparar perfil de diferentes áreas
- Identificar áreas com alta concentração de uma classe

---

### **4. getAgeStats()**

Obtém estatísticas agregadas de idade para uma área.

```typescript
import { getAgeStats } from "@/utils/duckdb";

const stats = await getAgeStats("E02000001", "incoming");

// Resultado:
// [
//   { ageGroup: "Aged 25 to 34 years", total: 4500, percentage: 28.5 },
//   { ageGroup: "Aged 35 to 44 years", total: 3800, percentage: 24.1 },
//   ...
// ]
```

**Uso:**

- Pirâmide etária de commuters
- Análise geracional
- Identificar áreas "jovens" vs "envelhecidas"

---

## 📊 **EXEMPLOS DE USO NOS COMPONENTES**

### **Exemplo 1: Filtro de Social Grade**

```tsx
import { useState, useEffect } from "react";
import { getMSOAFlowsBySocialGrade } from "@/utils/duckdb";

export function SocialGradeFilter() {
  const [grade, setGrade] = useState<"AB" | "C1" | "C2" | "DE" | "all">("all");
  const [flows, setFlows] = useState([]);

  useEffect(() => {
    async function loadFlows() {
      const data = await getMSOAFlowsBySocialGrade(
        selectedArea,
        grade,
        "incoming",
        1000,
      );
      setFlows(data);
    }
    loadFlows();
  }, [grade, selectedArea]);

  return (
    <div>
      <select value={grade} onChange={(e) => setGrade(e.target.value)}>
        <option value="all">All Classes</option>
        <option value="AB">AB - Professional</option>
        <option value="C1">C1 - Middle Class</option>
        <option value="C2">C2 - Skilled Workers</option>
        <option value="DE">DE - Working Class</option>
      </select>
      {/* Renderizar flows coloridos por classe */}
    </div>
  );
}
```

### **Exemplo 2: Gráfico de Pizza - Social Grade**

```tsx
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { getSocialGradeStats } from "@/utils/duckdb";

const COLORS = {
  AB: "#2563eb", // Azul
  C1: "#10b981", // Verde
  C2: "#f59e0b", // Amarelo
  DE: "#ef4444", // Vermelho
};

export function SocialGradePieChart({ areaCode }: { areaCode: string }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function loadStats() {
      const stats = await getSocialGradeStats(areaCode, "incoming");
      const chartData = stats.map((s) => ({
        name: s.grade.split(" ")[0], // Pegar só "AB", "C1", etc
        value: s.total,
        percentage: s.percentage,
      }));
      setData(chartData);
    }
    loadStats();
  }, [areaCode]);

  return (
    <PieChart width={400} height={400}>
      <Pie
        data={data}
        cx={200}
        cy={200}
        labelLine={false}
        label={({ name, percentage }) => `${name}: ${percentage}%`}
        outerRadius={120}
        fill="#8884d8"
        dataKey="value"
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend />
    </PieChart>
  );
}
```

### **Exemplo 3: Comparação Social Grade × Age**

```tsx
import { getMSOAFlowsBySocialGrade, getMSOAFlowsByAge } from "@/utils/duckdb";

async function analyzeYoungProfessionals(areaCode: string) {
  // Jovens profissionais: 25-34 anos + classe AB
  const youngAge = await getMSOAFlowsByAge(
    areaCode,
    "Aged 25 to 34 years",
    "incoming",
  );

  const professionals = await getMSOAFlowsBySocialGrade(
    areaCode,
    "AB",
    "incoming",
  );

  // Intersecção (aproximada)
  const youngProfessionals = youngAge.filter((flow) =>
    professionals.some(
      (p) =>
        p.origin_code === flow.origin_code && p.dest_code === flow.dest_code,
    ),
  );

  console.log(`Jovens profissionais: ${youngProfessionals.length} flows`);
  return youngProfessionals;
}
```

---

## 🎨 **IDEIAS DE VISUALIZAÇÕES**

### **1. Sankey Diagram Social Grade**

Flows coloridos por classe social (AB = azul, C1 = verde, etc)

### **2. Heatmap Age × Social Grade**

Matriz 2D mostrando intensidade de flows por segmento

### **3. Bar Chart Comparativo**

Comparar distância média de commute por classe social

### **4. Line Chart Temporal**

Evolução de flows por faixa etária (se tiver dados 2011)

### **5. Bubble Map**

Bolhas no mapa com tamanho = volume, cor = classe social dominante

### **6. Pyramid Chart**

Pirâmide etária de incoming vs outgoing flows

---

## 🔍 **QUERIES SQL CUSTOMIZADAS**

Você também pode executar queries SQL direto no DuckDB:

```typescript
import { executeQuery } from "@/utils/duckdb";

// Top 10 flows AB jovens
const query = `
  SELECT 
    fsg.origin_code,
    fsg.dest_code,
    fsg.social_grade,
    fa.age_group,
    (fsg.count + fa.count) / 2 as avg_count
  FROM flows_social_grade fsg
  JOIN flows_age fa 
    ON fsg.origin_code = fa.origin_code 
    AND fsg.dest_code = fa.dest_code
  WHERE fsg.social_grade LIKE '%AB%'
    AND fa.age_group = 'Aged 25 to 34 years'
  ORDER BY avg_count DESC
  LIMIT 10
`;

const results = await executeQuery(query);
```

---

## ⚡ **PERFORMANCE**

**Carregamento inicial:**

- 3 datasets (~22 MB total)
- Tempo: ~5-10 segundos (depende da conexão)
- Após carregar: queries **instantâneas** (memória)

**Otimizações:**

- Compressão Snappy no Parquet
- Queries SQL compiladas
- Cache no browser

---

## 🚀 **PRÓXIMOS PASSOS**

1. **Criar componentes de visualização**
   - `SocialGradeAnalysis.tsx`
   - `AgeAnalysis.tsx`
   - `CrossAnalysisChart.tsx`

2. **Implementar dashboards**
   - Página `/analytics/social-grade`
   - Página `/analytics/age`
   - Página `/analytics/cross-analysis`

3. **Adicionar filtros avançados**
   - Múltiplas classes sociais
   - Múltiplas faixas etárias
   - Combinações customizadas

4. **Criar métricas agregadas**
   - Índice de desigualdade
   - Mobilidade social via geografia
   - Segregação espacial

---

## 📝 **CHECKLIST DE IMPLEMENTAÇÃO**

- [x] Carregar 3 datasets no DuckDB
- [x] Criar funções de query por social grade
- [x] Criar funções de query por age
- [x] Adicionar funções de estatísticas agregadas
- [x] Exportar tipos TypeScript
- [ ] Criar componentes React
- [ ] Implementar gráficos
- [ ] Criar dashboards
- [ ] Adicionar testes
- [ ] Documentar insights

**Status: Backend completo! Frontend próximo! 🎉**
