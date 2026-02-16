# 📊 Como Usar Filtros Demográficos (Social Grade e Age)

## ✅ Sim! Filtros de Idade Funcionam no Mapa!

Os filtros de **Social Grade** e **Age Group** são aplicados em **TEMPO REAL** tanto nos gráficos quanto no mapa.

## 🎯 Como Usar

### 1️⃣ Selecione uma Área

- Clique em qualquer MSOA (ponto pequeno) ou LTLA (distrito)
- Aguarde os dados carregarem

### 2️⃣ Abra o Analytics Dashboard

- Role a página para baixo
- Você verá filtros demográficos

### 3️⃣ Escolha seus Filtros

#### 📊 Filtro de Social Grade

```
Opções disponíveis:
- All Classes (padrão - sem filtro)
- AB - Professional (gerentes, profissionais)
- C1 - Middle Class (supervisores, escriturários)
- C2 - Skilled Workers (trabalhadores qualificados)
- DE - Working Class (trabalhadores não qualificados)
```

#### 👥 Filtro de Age Group

```
Opções disponíveis:
- All Ages (padrão - sem filtro)
- 16-24 years
- 25-34 years
- 35-44 years
- 45-54 years
- 55-64 years
- 65+ years
```

### 4️⃣ Observe as Mudanças

**No Mapa:**

- ✅ Linhas são **recarregadas automaticamente**
- ✅ Apenas flows do grupo selecionado aparecem
- ✅ Painel "Filtros de Fluxos" mostra badge roxo "Demografia Ativa"
- ✅ Indicador verde "✓ Ativo no mapa" mostra qual filtro está aplicado

**Nos Gráficos:**

- ✅ Social Grade Pie Chart atualiza
- ✅ Age Bar Chart atualiza
- ✅ Estatísticas recalculadas

## ⚠️ Comportamento com Ambos Filtros Ativos

### Se você selecionar Social Grade E Age simultaneamente:

**No Mapa:**

- 🔵 **Social Grade** tem prioridade
- ⚠️ Age Group NÃO é aplicado nas linhas do mapa

**Nos Gráficos:**

- ✅ Ambos funcionam normalmente
- Você pode comparar Social Grade E Age ao mesmo tempo

### Indicador Visual

Quando ambos estão ativos, você verá:

```
⚠️ Ambos ativos: apenas Social Grade no mapa
   Age usado apenas nos gráficos
```

## 🧪 Exemplos Práticos

### Exemplo 1: Ver apenas jovens (16-24 anos)

1. Selecione uma cidade (ex: Tower Hamlets)
2. Social Grade: **All Classes**
3. Age Group: **16-24 years**
4. ✅ Mapa mostra apenas fluxos de pessoas de 16-24 anos

### Exemplo 2: Ver profissionais (AB)

1. Selecione uma cidade
2. Social Grade: **AB - Professional**
3. Age Group: **All Ages**
4. ✅ Mapa mostra apenas fluxos de classe AB

### Exemplo 3: Comparar profissionais jovens vs velhos

1. Social Grade: **AB - Professional**
2. Age Group: **25-34 years**
3. ⚠️ **Mapa:** Mostra apenas AB (prioridade)
4. ✅ **Gráficos:** Mostram AB E 25-34 separadamente

## 🔍 Verificação no Console (F12)

### Quando você muda filtros, veja os logs:

```javascript
// Filtro de Social Grade ativo
📊 Filtrando por Social Grade: AB

// Filtro de Age ativo
👥 Filtrando por Age Group: 25-34 years

// Ambos ativos
⚠️ Ambos filtros ativos! Usando apenas Social Grade no mapa.

// Dados carregados
✅ Criados 87 features GeoJSON filtrados
```

## 📈 Estatísticas Filtradas

O painel de estatísticas do mapa mostra:

- **Total de fluxos filtrados** vs total disponível
- **Máximo de pessoas** no maior fluxo filtrado
- **Total de pessoas** nos fluxos filtrados

## 🎨 Indicadores Visuais

### Badge "Demografia Ativa"

- Aparece no header "Filtros de Fluxos"
- Cor roxa
- Indica que há filtros demográficos ativos

### Painel Roxo de Filtros

Mostra:

- ✓ Qual filtro está ativo no mapa (verde)
- Valores selecionados
- Aviso se ambos estiverem ativos

### Cores no Gráfico

- **Social Grade:** Azul, Verde, Amarelo, Vermelho
- **Age Groups:** Gradiente de Roxo a Vermelho

## 🔧 Tecnologia

### Como Funciona Internamente

1. **Analytics Dashboard** → muda filtro
2. **App.tsx** → estado global atualizado
3. **InteractiveMap** → recebe novos filtros
4. **FlowsVisualization** → detecta mudança
5. **dataService** → chama função correta:
   - `getMSOAFlowsBySocialGrade()` ou
   - `getMSOAFlowsByAge()`
6. **DuckDB** → query SQL filtrada
7. **Mapa** → linhas redesenhadas

### Query SQL (exemplo Age Filter)

```sql
SELECT origin_code, dest_code, age_code, age_group, count
FROM flows_age
WHERE dest_code = 'E02000001'
  AND age_group = 'Age 25 to 34 years'
ORDER BY count DESC
LIMIT 50000
```

## 💡 Dicas de Uso

### Para Análise Demográfica Completa:

1. **Comece com visão geral** (All Classes, All Ages)
2. **Identifique padrão** no mapa
3. **Filtre por Social Grade** → observe mudanças
4. **Limpe filtro** → volte para "All"
5. **Filtre por Age** → compare com Social Grade
6. **Use gráficos** para detalhes quantitativos

### Para Comparações:

1. **Tire screenshot** com um filtro ativo
2. **Mude para outro filtro**
3. **Compare visualmente** as diferenças nas linhas

### Para Exportar Dados:

- Console (F12) mostra todos os flows carregados
- Você pode copiar/inspecionar os dados
- Estatísticas são exibidas nos painéis

## ❓ FAQ

### P: Por que só 1 filtro funciona no mapa quando seleciono ambos?

**R:** Limitação técnica atual. Combinar ambos requer query SQL mais complexa. Está na roadmap!

### P: Os gráficos respeitam ambos filtros?

**R:** Sim! Gráficos funcionam independentemente.

### P: Como resetar filtros?

**R:** Volte para "All Classes" e "All Ages" no Analytics Dashboard.

### P: Filtros funcionam para LTLA?

**R:** Sim! Os dados de LTLA são agregados automaticamente dos MSOAs filtrados.

### P: Preciso recarregar a página?

**R:** Não! Tudo é dinâmico e em tempo real.

## 🎉 Resumo

✅ **Filtros de Idade FUNCIONAM no mapa!**
✅ **Filtros de Social Grade FUNCIONAM no mapa!**
✅ Ambos funcionam nos gráficos simultaneamente
⚠️ No mapa, apenas 1 filtro por vez (prioridade: Social Grade)
🚀 Tudo em tempo real, sem recarregar página

**Experimente agora e veja a mágia acontecer!** 🎨📊🗺️
