# 📊 Dados Demográficos (Social Grade e Age) - Suporte MSOA e LTLA

## ✅ Status Atual

**Os dados demográficos JÁ suportam tanto MSOA quanto LTLA!**

A implementação está completa em `src/utils/duckdb.ts`:

- `getSocialGradeStats()` - linhas 476-556
- `getAgeStats()` - linhas 558-638

## 🔧 Como Funciona

### Para MSOA (nível mais detalhado)

```typescript
// Exemplo: E02000001 (um MSOA específico em Tower Hamlets)
const stats = await getSocialGradeStats("E02000001", "incoming");
// Query: WHERE dest_code = 'E02000001'
```

### Para LTLA (agregado automaticamente)

```typescript
// Exemplo: E09000030 (Tower Hamlets - LTLA)
const stats = await getSocialGradeStats("E09000030", "incoming");

// 1️⃣ Detecta que é LTLA (começa com E06/E07/E08/E09/W06)
// 2️⃣ Busca todos os MSOAs daquele LTLA via lookup (ltla_lookup.csv)
// 3️⃣ Agrega dados: WHERE dest_code IN ('E02000001', 'E02000002', ...)
// 4️⃣ Retorna estatísticas agregadas
```

## 📁 Datasets Necessários

### Obrigatório (já no GitHub)

- ✅ `ODWP01EW_MSOA.parquet` - Flows básicos (origem → destino)

### Opcional (para analytics demográficos)

- ⚠️ `ODWP09EW_MSOA.parquet` - Social Grade (NS-SeC)
- ⚠️ `ODWP04EW_MSOA.parquet` - Age Groups

## 🚀 Como Habilitar Dados Demográficos

### Opção 1: Upload para GitHub (Recomendado para produção)

1. **Converter CSV para Parquet**

   ```bash
   cd scripts
   python 01_csv_to_parquet.py
   ```

   Isso cria:
   - `data/processed/ODWP09EW_MSOA.parquet`
   - `data/processed/ODWP04EW_MSOA.parquet`

2. **Upload para GitHub**

   ```bash
   # No repositório GustavoWMSilva/MapGeospatialMobilityData
   git add ODWP09EW_MSOA.parquet ODWP04EW_MSOA.parquet
   git commit -m "Add demographic datasets"
   git push origin main
   ```

3. **Aguardar CDN** (5-10 minutos)
   - jsdelivr sincroniza automaticamente
   - URLs:
     - `https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/ODWP09EW_MSOA.parquet`
     - `https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/ODWP04EW_MSOA.parquet`

4. **Recarregar app** - DuckDB carregará automaticamente

### Opção 2: Fallback Local (Desenvolvimento)

Se CDN falhar, o sistema usa arquivos locais:

1. Colocar arquivos em `public/data/processed/`:

   ```
   public/
     data/
       processed/
         ODWP09EW_MSOA.parquet ← Social Grade
         ODWP04EW_MSOA.parquet ← Age
   ```

2. DuckDB detecta automaticamente e usa fallback

## 🔍 Verificação de Status

### No Console do Navegador (F12)

```javascript
// Ao carregar a página
🚀 Carregando datasets...
📥 Baixando ODWP01EW_MSOA.parquet...
   ✓ ODWP01EW_MSOA.parquet: 45.3 MB
   ✓ Tabela flows: 2,402,201 registros

📥 Baixando ODWP09EW_MSOA.parquet...
   ⚠️ ODWP09EW_MSOA.parquet não disponível (404) - pulando

📥 Baixando ODWP04EW_MSOA.parquet...
   ⚠️ ODWP04EW_MSOA.parquet não disponível (404) - pulando

✅ DuckDB-WASM inicializado com 1 dataset(s)!
```

### No UI - Painel de Status

A aplicação agora mostra um painel visual:

- ✅ Verde = Todos dados disponíveis
- ⚠️ Amarelo = Dados demográficos faltando
- ❌ Vermelho = Erro crítico

## 📊 Estrutura dos Dados

### Social Grade (ODWP09EW)

```
Colunas:
- origin_code: MSOA origem (ex: E02000001)
- dest_code: MSOA destino
- social_grade_code: 1-9
- social_grade: texto descritivo
- count: número de pessoas

Categorias:
1. AB - Higher & intermediate managerial
2. C1 - Supervisory, clerical, junior managerial
3. C2 - Skilled manual workers
4. DE - Semi-skilled & unskilled manual workers
```

### Age Groups (ODWP04EW)

```
Colunas:
- origin_code: MSOA origem
- dest_code: MSOA destino
- age_code: 1-6
- age_group: faixa etária
- count: número de pessoas

Faixas:
1. Age 16 to 24 years
2. Age 25 to 34 years
3. Age 35 to 44 years
4. Age 45 to 54 years
5. Age 55 to 64 years
6. Age 65 years and over
```

## 🎯 Exemplos de Uso

### Analytics Dashboard (interface)

```tsx
import { AnalyticsDashboard } from './components/analytics';

// MSOA
<AnalyticsDashboard
  selectedArea="E02000001"
  areaName="Tower Hamlets 001"
/>

// LTLA (agregação automática)
<AnalyticsDashboard
  selectedArea="E09000030"
  areaName="Tower Hamlets"
/>
```

### Programático

```typescript
import { getSocialGradeStats, getAgeStats } from "./utils/duckdb";

// MSOA - incoming (quem CHEGA para trabalhar)
const socialIncoming = await getSocialGradeStats("E02000001", "incoming");
// Resultado: [{ grade: 'AB - Higher managerial', total: 1234, percentage: 45.2 }]

// LTLA - outgoing (quem SAI para trabalhar)
const ageOutgoing = await getAgeStats("E09000030", "outgoing");
// Agrega automaticamente todos MSOAs de Tower Hamlets
```

## 🐛 Troubleshooting

### Erro: "Tabela flows_social_grade NÃO disponível"

**Causa:** Arquivo parquet não foi carregado (404 no GitHub ou ausente localmente)

**Solução:**

1. Verificar arquivo no GitHub
2. Aguardar sincronização jsdelivr (5-10 min)
3. Usar fallback local (colocar em `public/data/processed/`)

### Erro: "Query retornou 0 resultados"

**Causa:** Área selecionada não tem dados demográficos

**Possíveis razões:**

1. LTLA sem MSOAs mapeados → verificar `ltla_lookup.csv`
2. Dados filtrados vazios (ex: área sem flows incoming)

### Charts mostram "Dados não disponíveis"

**Diagnóstico:**

1. Abrir console (F12)
2. Procurar por "❌ Tabela flows_social_grade NÃO disponível"
3. Ver painel de status no topo do Analytics Dashboard

## 📈 Performance

### Tempos esperados (LTLA com ~100 MSOAs)

- Inicial (primeira query): 200-500ms
- Subsequentes (cache): 50-100ms

### Otimizações implementadas

- ✅ Query única agregando todos MSOAs
- ✅ IN-memory aggregation (Map)
- ✅ DuckDB columnar processing
- ✅ Lookup cache (ltla → msoa)

## 🎓 Entendendo Incoming vs Outgoing

### Incoming (direction='incoming')

```sql
WHERE dest_code = 'E09000030'
-- ou
WHERE dest_code IN ('E02000001', 'E02000002', ...) -- MSOAs do LTLA
```

**Significa:** Perfil de quem **CHEGA** para trabalhar nesta área (moram fora)

### Outgoing (direction='outgoing')

```sql
WHERE origin_code = 'E09000030'
-- ou
WHERE origin_code IN ('E02000001', 'E02000002', ...)
```

**Significa:** Perfil de quem **SAI** desta área para trabalhar (moram aqui)

## ✅ Checklist de Implementação

- [x] Função `getSocialGradeStats()` com suporte LTLA
- [x] Função `getAgeStats()` com suporte LTLA
- [x] Detecção automática MSOA vs LTLA (`isLTLACode()`)
- [x] Lookup MSOA→LTLA (`loadLTLALookup()`)
- [x] Agregação em uma query única
- [x] Logs detalhados para debugging
- [x] UI: SocialGradePieChart com direction
- [x] UI: AgeBarChart com direction
- [x] UI: AnalyticsFilters (incoming/outgoing toggle)
- [x] UI: DataAvailabilityCheck (status dos datasets)
- [x] UI: DirectionDebugPanel (comparação incoming vs outgoing)
- [x] Fallback local + CDN jsdelivr
- [x] Documentação completa

## 🎉 Conclusão

**Os dados demográficos já estão completamente integrados e funcionam para MSOA e LTLA!**

O único passo restante é fazer **upload dos arquivos parquet para o GitHub** (se ainda não fez).

Se os arquivos já estão no GitHub, **tudo deve funcionar automaticamente**. Use o painel de status no Analytics Dashboard para confirmar.
