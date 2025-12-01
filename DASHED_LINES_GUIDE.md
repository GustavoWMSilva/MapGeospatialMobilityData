# 📍 Linhas Tracejadas para Área Selecionada - Dados Reais de OD

Este guia explica como funciona o sistema de linhas tracejadas que mostra **fluxos reais de mobilidade** que chegam em uma área selecionada.

## 🎯 Como Funciona

Quando você seleciona uma área no mapa, o sistema:

1. **Carrega dados reais de Origem-Destino** do arquivo GeoJSON
2. **Filtra apenas fluxos que CHEGAM** na área selecionada
3. **Mostra linhas tracejadas** com espessura proporcional ao volume de pessoas
4. **Exibe estatísticas** no console (número de fluxos e total de pessoas)

## 📊 Dados Reais de Mobilidade

As linhas representam **dados reais de commuting** (deslocamento casa-trabalho) do Reino Unido:

- **Origem**: De onde as pessoas saem
- **Destino**: Para onde vão (área selecionada)
- **Contagem**: Número de pessoas que fazem esse trajeto

### Espessura das Linhas:

- 🔸 **Linhas finas**: 0-500 pessoas
- 🔹 **Linhas médias**: 500-1000 pessoas
- 🔺 **Linhas grossas**: 1000-2000 pessoas
- 🔴 **Linhas muito grossas**: >2000 pessoas

## 📋 Como Usar

### 1. **Escolha o Dataset**

Primeiro, selecione qual conjunto de dados usar:

- **🌍 Fluxos Gerais (Top 1000)**: Maiores fluxos de todo UK
- **🏙️ Fluxos para Londres (Top 5000)**: Fluxos convergindo para Londres

### 2. **Digite o Código da Área**

```
Digite o código da área (ex: E02000001)
```

### 3. **Pressione Enter**

As linhas tracejadas aparecerão mostrando de onde as pessoas vêm.

## 🧪 Exemplos para Testar

### **Dataset: Fluxos para Londres**

#### **E02000001** - City of London 001 (Centro Financeiro)

- 🔥 **988 fluxos chegando** (área mais popular!)
- Centro financeiro de Londres
- Ideal para ver padrões de commuting

#### **E02000977** - Westminster

- 🔥 **571 fluxos chegando**
- Área do Parlamento e Big Ben
- Grande volume de trabalhadores

#### **E02000972** - Londres Central

- 🔥 **528 fluxos chegando**
- Área comercial importante

### **Dataset: Fluxos Gerais (UK)**

#### **E02007099** - Newcastle upon Tyne 036

- **13 fluxos chegando**
- Área no norte da Inglaterra

#### **E02006875** - Área com múltiplos fluxos

- **13 fluxos chegando**

#### **E02007005** - Área regional

- **11 fluxos chegando**

## 🎨 Personalização

Você pode personalizar as linhas editando `InteractiveMap.tsx`:

```tsx
<SelectedAreaConnections
  selectedAreaCode={selectedAreaCode}
  lineColor="#FF6B6B" // Cor das linhas
  lineWidth={1.5} // Espessura base
  dataSource={mobilityDataSource} // 'general' ou 'london'
/>
```

### Cores Sugeridas:

- `#FF6B6B` - Vermelho (fluxos de entrada - padrão)
- `#4ECDC4` - Turquesa
- `#F39C12` - Laranja
- `#9B59B6` - Roxo

## 📈 Estatísticas no Console

Ao selecionar uma área, veja no console do navegador:

```
✅ 988 fluxos chegando em E02000001
📊 Total de pessoas: 45,234
```

## 🔧 Arquivos Importantes

### Componentes:

- `src/components/SelectedAreaConnections.tsx` - **ATUALIZADO** para usar dados reais de OD
- `src/components/AreaSelectionControls.tsx` - Interface de controle
- `src/hooks/useSelectedArea.ts` - Gerencia o estado

### Dados:

- `public/flows.geojson` - Top 1000 fluxos gerais do UK
- `public/flows-london.geojson` - Top 5000 fluxos para Londres

## 🎓 Estrutura dos Dados

Cada feature no GeoJSON contém:

```json
{
  "properties": {
    "origin_code": "E02000884",
    "origin_name": "Tower Hamlets 021",
    "dest_code": "E02000001",
    "dest_name": "City of London 001",
    "count": 357,
    "count_bin": "(100.0, 500.0]"
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [[lng1, lat1], [lng2, lat2]]
  }
}
```

## 💡 Interpretação

- **Muitas linhas convergindo**: Área é um polo de atração (emprego, serviços)
- **Linhas grossas**: Conexões importantes com alto volume de pessoas
- **Linhas de longe**: Pessoas viajam de áreas distantes para trabalhar
- **Padrões radiais**: Típico de centros urbanos

## 🐛 Troubleshooting

### Nenhuma linha aparece?

- ✅ Verifique se o código existe nos dados (use exemplos acima)
- ✅ Confirme que há fluxos chegando naquela área
- ✅ Veja mensagens no console

### Poucas linhas aparecem?

- ✅ Normal! Os dados mostram apenas os **maiores fluxos**
- ✅ Dataset geral: Top 1000 fluxos de todo UK
- ✅ Dataset Londres: Top 5000 fluxos convergindo para Londres

---

Visualização de mobilidade real com dados de commuting do UK 🗺️📊
