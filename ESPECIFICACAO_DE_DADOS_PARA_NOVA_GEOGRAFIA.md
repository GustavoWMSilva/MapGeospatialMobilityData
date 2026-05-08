# Especificacao de dados para nova geografia

## Objetivo

Este documento pode ser enviado diretamente para quem vai preparar uma nova base para o projeto.

O pacote esperado agora tem duas partes:

1. artefatos de dados
2. um perfil JSON com labels e configuracao do dashboard

## Entrega minima obrigatoria

1. `flows.parquet`
2. `areas_centroids.csv`
3. `boundaries.geojson`

Se houver geografia agregada, entregar tambem:

4. `aggregate_lookup.csv`
5. `aggregate_centroids.csv`
6. `aggregate_boundaries.geojson`

E junto com isso:

7. um perfil JSON baseado em `dataset_pipeline_configs/app_dataset_profile.template.json`

## Arquivo 1: fluxo principal

Formato recomendado:

- `Parquet`

Schema minimo:

| Coluna | Tipo | Obrigatoria | Descricao |
| --- | --- | --- | --- |
| `origin_code` | string | sim | identificador da area de origem |
| `dest_code` | string | sim | identificador da area de destino |
| `count` | integer | sim | quantidade de pessoas |

Schema recomendado:

| Coluna | Tipo |
| --- | --- |
| `origin_name` | string |
| `dest_name` | string |

## Arquivo 2: centroides da geografia base

Formato:

- `CSV`

Schema:

| Coluna | Tipo | Obrigatoria |
| --- | --- | --- |
| `code` | string | sim |
| `name` | string | sim |
| `lat` | number | sim |
| `lon` | number | sim |

## Arquivo 3: boundaries da geografia base

Formato:

- `GeoJSON`

Requisitos:

- deve haver uma feature para cada unidade geografica mapeavel
- os codigos precisam ser compativeis com o fluxo e os centroides

## Arquivos 4 a 6: nivel agregado

Se a base tiver um nivel agregado, entregar:

- `aggregate_lookup.csv`
- `aggregate_centroids.csv`
- `aggregate_boundaries.geojson`

O lookup deve mapear cada unidade da geografia base para sua unidade da geografia agregada.

## Datasets categoricos opcionais

Se existirem recortes como idade, ocupacao, sexo ou renda, cada dataset adicional deve manter:

- `origin_code`
- `dest_code`
- `count`
- uma coluna de categoria
- opcionalmente uma coluna de codigo da categoria

## Perfil JSON obrigatorio para integracao

O perfil JSON deve informar:

- `id`
- `label`
- `description`
- `sortOrder`
- nomes da geografia base e da geografia agregada
- labels dos seletores
- placeholders de busca
- paths de `lookup`
- paths de `storage`
- dataset principal
- datasets demograficos opcionais
- configuracao do dashboard

## Configuracao do dashboard no JSON

O campo `dashboard` deve dizer:

- titulo do painel
- subtitulo do painel
- label da direcao
- textos do checkbox de fluxo interno
- mensagem para datasets genericos
- `chartOrder`, com a ordem exata dos graficos que devem aparecer
- titulos dos graficos
- quais graficos existentes ficam habilitados
- quais comecam minimizados
- parametros por grafico em `dashboard.charts.<chartId>.params`, como `topN` e `initialTopN`

## Lista objetiva do que preencher no JSON

Campos mais importantes:

1. `label`: nome que aparece no toggle
2. `labels.base.singular`
3. `labels.base.plural`
4. `labels.aggregate.singular`
5. `labels.aggregate.plural`
6. `labels.base.inputPlaceholder`
7. `labels.aggregate.searchPlaceholder`
8. `dashboard.chartOrder`
9. `dashboard.charts.<chartId>.title`
10. `dashboard.charts.<chartId>.enabled`
11. `dashboard.charts.<chartId>.defaultCollapsed`
12. `dashboard.charts.<chartId>.section`
13. `dashboard.charts.<chartId>.params`

## Validacoes antes da entrega

Quem gerar a base deve validar:

1. `origin_code` e `dest_code` existem em todas as linhas
2. `count` e inteiro e nao negativo
3. todos os codigos do fluxo existem nos centroides, exceto codigos especiais documentados
4. `lat` e `lon` estao preenchidos
5. se houver geografia agregada, o lookup cobre as unidades da geografia base
6. o JSON aponta para arquivos que realmente existem
7. os nomes das categorias no JSON batem com os arquivos Parquet opcionais

## Observacao importante

O JSON nao cria graficos novos sozinho. Ele apenas configura os componentes que o app ja possui.

Se for necessario um grafico totalmente novo, entregue tambem a especificacao funcional do grafico:

- objetivo analitico
- dataset usado
- colunas necessarias
- titulo desejado
- regra de agregacao
