# Como adicionar novos dados ao projeto

## Objetivo

Este guia documenta o fluxo mais simples para integrar um novo dataset sem editar manualmente o frontend.

O principio agora e:

- os artefatos de dados entram como arquivos em `public/data/...`
- a interface e controlada por um perfil JSON em `src/dataset-configs/...`

## O que voce precisa receber

Para integrar um dataset novo, peca este pacote:

1. `flows.parquet`
2. `areas_centroids.csv`
3. `boundaries.geojson`
4. `aggregate_lookup.csv`, se houver geografia agregada
5. `aggregate_centroids.csv`, se houver geografia agregada
6. `aggregate_boundaries.geojson`, se houver geografia agregada
7. Um JSON de perfil baseado em `dataset_pipeline_configs/app_dataset_profile.template.json`

## Contrato minimo dos dados

### Dataset principal

Colunas minimas:

- `origin_code`
- `dest_code`
- `count`

Colunas recomendadas:

- `origin_name`
- `dest_name`

### Centroides da geografia base

Colunas:

- `code`
- `name`
- `lat`
- `lon`

### Lookup entre geografia base e geografia agregada

Se existir geografia agregada, o arquivo deve mapear a geografia base para a geografia agregada.

### Centroides da geografia agregada

Colunas:

- `code`
- `name`
- `lat`
- `lon`

## Novo fluxo de integracao

### Caso 1: atualizar um dataset existente

Se a geografia e os nomes de arquivos continuarem compativeis:

1. Substitua os arquivos em `public/data/<dataset-id>/...`
2. Mantenha o mesmo perfil JSON
3. Rode o app e valide

### Caso 2: adicionar um dataset novo

1. Gere os artefatos de dados com o pipeline.
2. Copie `dataset_pipeline_configs/app_dataset_profile.template.json`
3. Preencha o perfil do dataset.
4. Salve em `src/dataset-configs/<dataset-id>.json`
5. Teste no app pelo toggle do topo

Nao e mais necessario registrar manualmente o dataset em `src/constants/datasetProfiles.ts`.

## O que o perfil JSON controla

O JSON controla:

- nome no toggle
- descricao do dataset
- labels da geografia base e da geografia agregada
- placeholders e textos de ajuda
- paths dos artefatos em `processed` e `lookup`
- datasets demograficos opcionais
- textos do dashboard
- titulos dos graficos
- quais graficos existentes ficam habilitados
- se cada grafico abre expandido ou minimizado

## Estrutura esperada do JSON

Campos principais:

- `id`
- `label`
- `description`
- `sortOrder`
- `geography`
- `labels`
- `mapView`
- `lookup`
- `storage`
- `baseFlowDataset`
- `analyticsMode`
- `dashboard`
- `demographicDimensions`

## Exemplo de pedido para quem vai produzir a base

Voce pode pedir assim:

1. Entregue os artefatos `flows.parquet`, centroides, boundaries e lookup.
2. Preencha tambem o JSON de perfil com base no template.
3. Informe quais filtros demograficos existem.
4. Informe quais graficos existentes devem aparecer no dashboard e quais titulos devem ser usados.

## Quando ainda sera preciso mexer em codigo

O novo fluxo reduz muito a necessidade de alterar o app, mas ainda existem dois casos em que codigo pode ser necessario:

1. Quando a nova base usa uma hierarquia geografica que foge do fluxo atual entre geografia base e geografia agregada.
2. Quando voce quer um grafico totalmente novo, e nao apenas renomear ou habilitar um grafico existente.

## Arquivos mais importantes

- `dataset_pipeline_configs/app_dataset_profile.template.json`
- `src/dataset-configs/uk_commuting_ons.json`
- `src/dataset-configs/porto_alegre.json`
- `src/constants/datasetProfiles.ts`
- `src/components/analytics/AnalyticsDashboard.tsx`
- `DATASET_PIPELINE.md`
- `ESPECIFICACAO_DE_DADOS_PARA_NOVA_GEOGRAFIA.md`
