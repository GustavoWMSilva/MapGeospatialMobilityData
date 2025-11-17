# 🗺️ Visualização de Mobilidade Geoespacial do Reino Unido

Sistema interativo de visualização de dados de mobilidade e fluxos de deslocamento casa-trabalho (commuting) no Reino Unido, utilizando dados do censo de 2021.

## 🎯 Objetivo do Projeto

Este projeto tem como objetivo visualizar e analisar padrões de mobilidade urbana no Reino Unido através de mapas interativos, permitindo:

- **Análise de Fluxos de Deslocamento**: Visualizar movimentos diários de pessoas entre áreas (origem-destino)
- **Agregação por Níveis Geográficos**: Dados podem ser visualizados em nível de MSOA (áreas pequenas) ou LTLA (distritos/cidades)
- **Visualização Interativa**: Explorar dados através de mapas com WebGL para performance otimizada
- **Análise Direcional**: Ver tanto fluxos que chegam quanto que saem de uma área específica
- **Intensidade Visual**: Cores e espessuras de linhas representam volume de pessoas em movimento

## 🏗️ Arquitetura do Projeto

### Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Mapa**: MapLibre GL JS (renderização WebGL)
- **Estilização**: Tailwind CSS
- **Processamento de Dados**: Python (pandas, geopandas)
- **Fonte de Dados**: UK Census 2021 (Office for National Statistics)

## 📦 Componentes do Sistema

### Componentes Principais de Visualização

#### `InteractiveMap.tsx`

**Objetivo**: Componente central que orquestra todos os layers do mapa

- Gerencia o estado do MapLibre GL
- Coordena renderização de todos os componentes de visualização
- Controla zoom, pan e interações do usuário
- Alterna entre diferentes modos de visualização (MSOA/LTLA)

#### `MobilityFlows.tsx`

**Objetivo**: Renderiza fluxos gerais de mobilidade do Reino Unido

- Exibe top 1000 fluxos mais significativos
- Opção para visualizar fluxos específicos de Londres (top 5000)
- Linhas coloridas por intensidade de fluxo
- Layer base para análise de padrões nacionais

#### `LTLAIncomingFlows.tsx`

**Objetivo**: Visualização avançada de fluxos direcionais por distrito

- Mostra fluxos que **chegam** ou **saem** de um distrito selecionado
- Sistema de cores por intensidade (branco → vermelho escuro)
- Espessura de linha proporcional ao volume de pessoas
- Efeito de brilho para destacar fluxos maiores
- Suporta alternância entre direções (incoming/outgoing)
- Legenda interativa com barra de gradiente contínuo

#### `LTLAHeatmap.tsx`

**Objetivo**: Visualização de densidade agregada de fluxos por distrito

- Renderiza mapa de calor (heatmap) mostrando intensidade total de fluxos
- Agrega todos os fluxos que chegam ou saem de cada distrito
- Gradiente de cores (transparente → amarelo → laranja → vermelho escuro)
- Adapta raio e intensidade baseado no nível de zoom
- Círculos escaláveis para zooms altos com labels informativos
- Ideal para identificar rapidamente áreas de alta concentração
- Legenda com escala de cores e valores de referência

### Componentes de Pontos e Áreas

#### `AllAreaPoints.tsx`

**Objetivo**: Renderiza todos os centróides MSOA (7.000+ pontos)

- Visualização de todas as áreas estatísticas do Reino Unido
- Labels aparecem em zoom alto (> 12)
- Útil para análise granular de áreas específicas

#### `LTLAPoints.tsx`

**Objetivo**: Renderiza centróides de distritos/cidades (331 pontos)

- Agregação de áreas em nível de Local Authority Districts
- Tamanho do ponto proporcional à quantidade de MSOAs
- Destaque visual para distrito selecionado
- Reduz complexidade visual mantendo informação relevante

#### `CityBoundaries.tsx`

**Objetivo**: Renderiza polígonos de fronteiras administrativas

- Exibe bordas de cidades e distritos
- Preenchimento semi-transparente
- Ajuda a contextualizar geograficamente os fluxos

### Componentes de Controle e Interface

#### `LTLASelector.tsx`

**Objetivo**: Seletor dropdown de distritos com busca

- Permite selecionar qualquer um dos 331 distritos
- Campo de busca para filtrar por nome
- Botão para limpar seleção
- Integrado com estado global de seleção

#### `AreaSelectionControls.tsx`

**Objetivo**: Controles para seleção de áreas MSOA

- Input para código de área (ex: E02000001)
- Validação de código
- Feedback visual de seleção ativa

#### `NavigationControls.tsx`

**Objetivo**: Controles de navegação do mapa

- Adicionar pontos de interesse
- Voar para localizações específicas
- Gerenciar lista de pontos salvos
- Controles de zoom e posição

### Componentes de Visualização Auxiliar

#### `MobilityLegend.tsx`

**Objetivo**: Legenda para fluxos gerais de mobilidade

- Explica sistema de cores dos fluxos
- Escala de intensidade
- Contexto visual para interpretação do mapa

#### `LTLAFlowLegend.tsx`

**Objetivo**: Legenda dinâmica para fluxos LTLA

- Muda título baseado na direção (chegando/saindo)
- Escala de cores personalizada (0-500, 500-1k, 1k-2k, 2k-5k, 5k+)
- Indica que espessura também representa volume

#### `AnimatedLines.tsx`

**Objetivo**: Animação de partículas ao longo de linhas

- Efeito visual de movimento direcional
- Pontos animados que seguem trajetória dos fluxos
- Reforça percepção de origem-destino

### Componentes de Análise Específica

#### `SelectedAreaConnections.tsx`

**Objetivo**: Linhas tracejadas de/para área MSOA selecionada

- Modo de visualização focado em uma área específica
- Usa dados reais de OD (Origin-Destination)
- Linhas tracejadas para diferenciação visual
- Espessura baseada em volume de fluxo

## 🔧 Hooks Customizados

#### `useMapNavigation.ts`

**Objetivo**: Gerencia navegação e pontos no mapa

- Controla estado de pontos de interesse
- Função de "fly to" para animação de câmera
- Adicionar/remover pontos
- Persistência de localização

#### `useAnimatedLines.ts`

**Objetivo**: Estado e lógica para animação de linhas

- Gerencia pontos animados
- Controla estado de animação (play/pause)
- Cria GeoJSON para partículas em movimento

#### `useMapPopup.ts`

**Objetivo**: Gerencia popups informativos no mapa

- Cria e posiciona popups
- Controla visibilidade
- Vincula informações a elementos do mapa

#### `useSelectedArea.ts`

**Objetivo**: Estado global de área selecionada

- Gerencia qual área está ativa
- Sincroniza seleção entre componentes
- Lógica de limpar seleção

## 🐍 Scripts Python de Processamento

### `01_csv_to_parquet.py`

**Objetivo**: Converte arquivos CSV grandes para formato Parquet

- Otimização de armazenamento (reduz 60-80% do tamanho)
- Leitura mais rápida em análises subsequentes

### `02_build_centroids.py`

**Objetivo**: Cria centróides geográficos das áreas MSOA

- Calcula ponto central (lat/lon) de cada área
- Necessário para plotar pontos e linhas no mapa

### `03_make_flows_geojson.py`

**Objetivo**: Cria GeoJSON dos fluxos gerais

- Top 1000 fluxos mais significativos do Reino Unido
- Formato LineString conectando origem-destino
- Inclui metadados de volume

### `04_london_inflows.py`

**Objetivo**: Processa fluxos específicos de Londres

- Filtra fluxos que chegam em Londres
- Gera versões com top 500, 5000 e 10000
- Análise focada em mobilidade para a capital

### `05_create_ltla_aggregation.py`

**Objetivo**: Agrega MSOAs em LTLAs (distritos)

- Reduz 7.000+ áreas para 331 distritos
- Calcula centróides agregados
- Conta número de MSOAs por distrito
- Fundamental para visualização simplificada

### `06_aggregate_flows_by_ltla.py`

**Objetivo**: Agrega fluxos OD por distrito

- Converte 1,8M+ fluxos MSOA em 73k fluxos LTLA
- Filtra fluxos significativos (≥100 pessoas)
- Cria GeoJSON com 5.894 linhas de fluxo
- Salva estatísticas (top destinos, volumes totais)

### `07_download_ltla_boundaries.py`

**Objetivo**: Baixa polígonos de fronteiras administrativas

- Conecta com ONS Open Geography Portal
- Download de boundaries dos 331 LTLAs
- Formato GeoJSON para renderização no mapa

## 📊 Estrutura de Dados

### Dados de Input

- **ODWP01EW_MSOA.csv**: 1,8M+ registros de fluxos origem-destino
- **PCD*OA21_LSOA21_MSOA21_LTLA22*\*.csv**: Tabela de lookup para hierarquia geográfica
- Dados do Censo UK 2021

### Dados Processados

- **areas_centroids.csv**: 7.000+ centróides MSOA
- **ltla_centroids.csv**: 331 centróides LTLA
- **ltla_lookup.csv**: Mapeamento MSOA → LTLA
- **ltla_flows.geojson**: 5.894 fluxos agregados entre distritos
- **top1000-geral.geojson**: Top 1000 fluxos nacionais
- **london-inflows-\*.geojson**: Fluxos para Londres

## 🎮 Funcionalidades Principais

### Modos de Visualização

1. **Modo MSOA (Áreas)**: Visualização granular com 7.000+ pontos
2. **Modo LTLA (Distritos)**: Visualização agregada com 331 distritos
   - **Visualização de Linhas**: Fluxos individuais entre distritos
   - **Visualização de Heatmap**: Densidade agregada de fluxos por região

### Direção de Fluxos

- **Fluxos Chegando (Incoming)**: Ver quem se desloca PARA o distrito
- **Fluxos Saindo (Outgoing)**: Ver para onde o distrito envia pessoas

### Interatividade

- Seleção de distrito via dropdown com busca
- Alternância entre modos com um clique
- Zoom e pan fluidos
- Labels que aparecem em zoom alto
- Cores dinâmicas baseadas em intensidade

## 🎨 Sistema de Cores

### Intensidade de Fluxo (pessoas/dia)

Escala de gradiente **branco → vermelho escuro**:

- ⚪ **Branco** (0-100): Fluxos muito baixos
- 🔴 **Vermelho Muito Claro** (100-500): Fluxos baixos
- 🔴 **Vermelho Claro** (500-1.000): Fluxos médios-baixos
- 🔴 **Vermelho Médio** (1.000-2.000): Fluxos médios
- 🔴 **Vermelho** (2.000-5.000): Fluxos altos
- 🔴 **Vermelho Escuro** (5.000-10.000): Fluxos muito altos
- ⚫ **Vermelho Muito Escuro** (10.000+): Fluxos extremos

> 💡 A espessura das linhas também aumenta proporcionalmente ao volume de fluxo

## 📈 Estatísticas do Dataset

- **Total de MSOAs**: 7.201 áreas
- **Total de LTLAs**: 331 distritos
- **Fluxos MSOA originais**: 1.856.456
- **Fluxos LTLA agregados**: 73.029
- **Fluxos significativos (≥100)**: 5.897
- **Total de pessoas**: 27,1 milhões de deslocamentos/dia
- **33 London Boroughs** incluídos

### Top 5 Destinos Mais Populares

1. Birmingham - 456.886 pessoas
2. Leeds - 391.045 pessoas
3. Manchester - 285.351 pessoas
4. Westminster - 259.633 pessoas
5. Buckinghamshire - 258.433 pessoas

## 🚀 Como Executar

```bash
# Instalar dependências
npm install

# Modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

### Processar Dados (opcional)

```bash
# Instalar dependências Python
pip install -r requirements.txt

# Executar scripts em ordem
python scripts/01_csv_to_parquet.py
python scripts/02_build_centroids.py
python scripts/03_make_flows_geojson.py
python scripts/04_london_inflows.py
python scripts/05_create_ltla_aggregation.py
python scripts/06_aggregate_flows_by_ltla.py
```

## 📚 Referências e Créditos

- **Dados**: [Office for National Statistics (ONS)](https://www.ons.gov.uk/) - UK Census 2021
- **Mapa Base**: MapLibre GL JS - Renderização WebGL de mapas
- **Geometrias**: ONS Open Geography Portal

---

## Configuração Técnica (Desenvolvimento)
