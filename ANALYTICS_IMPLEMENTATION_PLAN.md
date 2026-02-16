# 📊 Plano de Implementação de Análises e Visualizações

## 🎯 Dados Disponíveis

### **ODWP09EW_MSOA - Social Grade**

**Categorias de Classe Social:**

- **AB**: Higher/intermediate managerial/professional (Classe Alta)
- **C1**: Supervisory/clerical/junior managerial (Classe Média-Alta)
- **C2**: Skilled manual occupations (Classe Trabalhadora Qualificada)
- **DE**: Semi-skilled/unskilled/unemployed (Classe Trabalhadora)

### **ODWP04EW_MSOA - Age**

**Faixas Etárias:**

- Aged 16-24 years
- Aged 25-34 years
- Aged 35-44 years
- Aged 45-54 years
- Aged 55-64 years
- Aged 65+ years

---

## 📈 ANÁLISES & VISUALIZAÇÕES RECOMENDADAS

### **1. Análise de Desigualdade Socioeconômica** ⭐⭐⭐⭐⭐

#### **Gráficos:**

- **Sankey Diagram**: Flows por classe social (origem → dest, colorido por grade)
- **Bar Chart**: Total de commuters por social grade
- **Heatmap**: Matriz LTLA × Social Grade
- **Scatter Plot**: Distância commute × social grade

#### **Métricas:**

```typescript
interface SocialGradeMetrics {
  grade: "AB" | "C1" | "C2" | "DE";
  totalCommuters: number;
  avgDistance: number;
  topDestinations: Array<{ ltla: string; count: number }>;
  selfContainment: number; // % que trabalha na mesma área
}
```

#### **Insights a Extrair:**

- Qual classe social viaja mais longe?
- Áreas ricas têm mais self-containment?
- Segregação espacial: onde vivem vs onde trabalham
- Desigualdade de acesso a empregos

---

### **2. Análise Geracional** ⭐⭐⭐⭐⭐

#### **Gráficos:**

- **Line Chart**: Distância média de commute por faixa etária
- **Stacked Bar**: Composição etária por LTLA
- **Pyramid Chart**: Pirâmide etária de commuters por região
- **Bubble Chart**: Volume × Distância × Age

#### **Métricas:**

```typescript
interface AgeMetrics {
  ageGroup: string;
  totalCommuters: number;
  avgDistance: number;
  mobilityIndex: number; // cross-LTLA flows / total flows
  topOrigins: Array<{ ltla: string; count: number }>;
}
```

#### **Insights a Extrair:**

- Jovens viajam mais longe que idosos?
- Padrões de aposentados (65+)
- Faixa etária mais móvel
- Regiões que "retêm" vs "expelem" cada faixa etária

---

### **3. Análise Cruzada: Social Grade × Age** ⭐⭐⭐⭐⭐

#### **Gráficos:**

- **Heatmap 2D**: Age × Social Grade (intensidade = volume)
- **Grouped Bar Chart**: Distância por age, agrupado por grade
- **Chord Diagram**: Flows entre LTLAs, segmentado por grade+age

#### **Métricas:**

```typescript
interface CrossAnalysisMetrics {
  segment: string; // ex: "25-34_AB"
  totalCommuters: number;
  avgDistance: number;
  dominantOrigin: string;
  dominantDest: string;
  mobilityPattern: "local" | "regional" | "long-distance";
}
```

#### **Insights a Extrair:**

- Jovens profissionais (25-34 AB) têm padrão diferente de idosos classe trabalhadora (65+ DE)?
- Mobilidade social via geografia
- Oportunidades de emprego por perfil demográfico

---

### **4. Clustering de Regiões** ⭐⭐⭐⭐

#### **Gráficos:**

- **Map Visualization**: Mapa colorido por cluster
- **Radar Chart**: Perfil de cada cluster
- **Dendrogram**: Hierarquia de similaridade

#### **Algoritmo:**

```python
# K-means clustering baseado em:
features = [
  'pct_AB',          # % classe alta
  'pct_C1',          # % classe média
  'pct_C2',          # % trabalhadora qualificada
  'pct_DE',          # % classe baixa
  'avg_age',         # idade média
  'pct_young',       # % 16-34
  'pct_senior',      # % 65+
  'self_containment', # % local
  'avg_distance'     # distância média
}
```

#### **Clusters Esperados:**

1. **"Professional Hubs"**: AB dominant, jovens, alta mobilidade
2. **"Working Class"**: C2/DE dominant, variada idade
3. **"Retirement Areas"**: 65+ dominant, baixa mobilidade
4. **"Mixed/Balanced"**: distribuição equilibrada

---

### **5. Detecção de Outliers & Anomalias** ⭐⭐⭐⭐

#### **Análises:**

- **Z-score**: Flows anormalmente altos
- **IQR**: Padrões fora do esperado
- **Desvios**: Áreas com perfil muito diferente do nacional

#### **Visualizações:**

- **Box Plot**: Distribuição por social grade
- **Scatter with annotations**: Outliers destacados
- **Anomaly Map**: Mapa com áreas anômalas

---

## 🛠️ **IMPLEMENTAÇÃO TÉCNICA**

### **Fase 1: Preparação de Dados**

1. **Converter CSVs para Parquet:**

```python
# Script: convert_to_parquet.py
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# Social Grade
df_social = pd.read_csv('ODWP09EW_MSOA.csv')
df_social.to_parquet('ODWP09EW_MSOA.parquet', compression='snappy')

# Age
df_age = pd.read_csv('ODWP04EW_MSOA.csv')
df_age.to_parquet('ODWP04EW_MSOA.parquet', compression='snappy')
```

2. **Upload para GitHub (CDN):**

```bash
# Adicionar ao repo GustavoWMSilva/MapGeospatialMobilityData
ODWP09EW_MSOA.parquet
ODWP04EW_MSOA.parquet
```

### **Fase 2: Backend (DuckDB-WASM)**

3. **Modificar `duckdb.ts` para carregar múltiplos datasets:**

```typescript
// Carregar 3 parquets:
// 1. ODWP01EW_MSOA.parquet (básico - já tem)
// 2. ODWP09EW_MSOA.parquet (social grade)
// 3. ODWP04EW_MSOA.parquet (age)
```

4. **Criar funções de query:**

```typescript
export async function getMSOAFlowsBySocialGrade(
  areaCode: string,
  socialGrade: "AB" | "C1" | "C2" | "DE" | "all",
  direction: "incoming" | "outgoing",
  limit: number,
): Promise<FlowResult[]>;

export async function getMSOAFlowsByAge(
  areaCode: string,
  ageGroup: string | "all",
  direction: "incoming" | "outgoing",
  limit: number,
): Promise<FlowResult[]>;
```

### **Fase 3: Analytics Service**

5. **Criar `analyticsService.ts`:**

```typescript
// Métricas agregadas
export function calculateSocialGradeMetrics(
  flows: FlowResult[],
): SocialGradeMetrics[];
export function calculateAgeMetrics(flows: FlowResult[]): AgeMetrics[];
export function performClustering(ltlaData: LTLAData[]): ClusterResult[];
export function detectOutliers(flows: FlowResult[]): OutlierResult[];
```

### **Fase 4: React Components**

6. **Componentes de Visualização:**

```
src/components/analytics/
  ├── SocialGradeAnalysis.tsx      # Análise de classe social
  ├── AgeAnalysis.tsx              # Análise geracional
  ├── CrossAnalysis.tsx            # Análise cruzada
  ├── ClusteringMap.tsx            # Mapa de clusters
  ├── OutlierDetection.tsx         # Detecção de anomalias
  ├── MetricsDashboard.tsx         # Dashboard agregado
  └── charts/
      ├── SankeyChart.tsx
      ├── HeatmapChart.tsx
      ├── PyramidChart.tsx
      └── RadarChart.tsx
```

7. **Bibliotecas de Gráficos:**

```bash
npm install recharts plotly.js-dist d3-sankey
```

### **Fase 5: Dashboard Analítico**

8. **Criar página de Analytics:**

```
/analytics
  ├── Overview (métricas gerais)
  ├── Social Grade (análise de classe)
  ├── Age Groups (análise geracional)
  ├── Cross Analysis (cruzamento)
  ├── Clustering (agrupamentos)
  └── Insights (descobertas automáticas)
```

---

## 📊 **EXEMPLOS DE INSIGHTS PARA O TCC**

### **Desigualdade Socioeconômica:**

- "Profissionais AB viajam em média 18km, enquanto DE viajam 12km"
- "Londres concentra 45% dos flows AB, mas apenas 15% dos DE"
- "Áreas com > 60% DE têm self-containment 2x maior"

### **Padrões Geracionais:**

- "Jovens 25-34 têm mobilidade 40% maior que 55-64"
- "65+ preferem trabalhar localmente (80% self-containment)"
- "Faixa 35-44 domina flows long-distance"

### **Segregação Espacial:**

- "Cluster 'Professional Hubs': Cambridge, Oxford, partes de Londres"
- "Cluster 'Working Class Industrial': regiões do norte"
- "Cluster 'Retirement': costa sul, áreas rurais"

---

## 🎯 **ROADMAP DE IMPLEMENTAÇÃO**

### **Semana 1: Preparação**

- ✅ Análise exploratória (FEITO)
- ⬜ Converter para Parquet
- ⬜ Upload GitHub

### **Semana 2: Backend**

- ⬜ Modificar DuckDB
- ⬜ Criar funções de query
- ⬜ Testar performance

### **Semana 3: Analytics**

- ⬜ Analytics service
- ⬜ Cálculo de métricas
- ⬜ Clustering

### **Semana 4: Frontend**

- ⬜ Componentes React
- ⬜ Gráficos interativos
- ⬜ Dashboard

### **Semana 5: Polimento**

- ⬜ Testes
- ⬜ Otimização
- ⬜ Documentação

---

## 📝 **PRÓXIMO PASSO IMEDIATO**

Execute este comando para converter os CSVs para Parquet:

```bash
python convert_to_parquet.py
```

Depois disso, faremos o upload para o GitHub e modificaremos o DuckDB!
