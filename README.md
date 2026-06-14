# Visualizacao de Mobilidade Geoespacial

Aplicacao React + MapLibre para visualizar fluxos origem-destino em multiplos datasets geograficos.

Hoje o projeto ja suporta:

- UK
- Porto Alegre

O dataset ativo e definido por perfis JSON em `src/dataset-configs/`, entao nao e mais necessario editar o frontend para trocar labels, titulos de graficos ou textos da interface.

## Como funciona agora

Para adicionar um novo dataset, o fluxo recomendado e:

1. Gerar os artefatos de dados.
2. Preencher um perfil JSON com labels, paths e configuracao do dashboard.
3. Salvar esse perfil em `src/dataset-configs/<dataset-id>.json`.
4. Abrir o app e testar pelo toggle de datasets.

## O que voce precisa receber para integrar um novo dataset

Pacote minimo:

1. `flows.parquet`
2. `areas_centroids.csv`
3. `boundaries.geojson`
4. `aggregate_lookup.csv`, se houver geografia agregada
5. `aggregate_centroids.csv`, se houver geografia agregada
6. `aggregate_boundaries.geojson`, se houver geografia agregada
7. Um perfil JSON no formato de `dataset_pipeline_configs/app_dataset_profile.template.json`

Esse JSON deve informar:

- `id`, `label`, `description`
- `sortOrder` para controlar a ordem no toggle
- nomes da geografia base e da geografia agregada
- labels dos seletores e textos da interface
- paths em `lookup` e `storage`
- dataset principal e datasets demograficos opcionais
- titulos dos graficos
- quais graficos existentes estao habilitados
- textos do dashboard

## Onde ficam as configuracoes

- Perfis ativos do app: `src/dataset-configs/*.json`
- Template para novo perfil: `dataset_pipeline_configs/app_dataset_profile.template.json`
- Normalizacao e defaults: `src/constants/datasetProfiles.ts`

Perfis de exemplo:

- `src/dataset-configs/uk_commuting_ons.json`
- `src/dataset-configs/porto_alegre.json`

## Como os dados sao servidos em producao

A aplicacao funciona como um app estatico na Vercel. Nao existe um servidor DuckDB externo: os arquivos Parquet sao baixados pelo navegador, registrados no DuckDB-WASM e consultados localmente como tabelas SQL.

O caminho usado para baixar os Parquets e definido no perfil JSON de cada dataset:

```json
"storage": {
  "remoteBaseUrl": "...",
  "localProcessedBasePath": "..."
}
```

No dataset do Reino Unido, os Parquets sao carregados pelo jsDelivr a partir do repositorio GitHub:

```text
https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/
```

Essa URL segue o formato:

```text
https://cdn.jsdelivr.net/gh/<usuario>/<repositorio>@<branch-ou-tag>/<arquivo>
```

Assim, por exemplo, o arquivo principal do UK e acessado em:

```text
https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@main/ODWP01EW_MSOA.parquet
```

O codigo verifica primeiro se o arquivo remoto existe. Se existir, usa `remoteBaseUrl`; se nao existir, usa o fallback local em `localProcessedBasePath`, como `/data/processed/`.

Fluxo simplificado:

```text
jsDelivr/GitHub ou Vercel public/ -> navegador -> DuckDB-WASM -> consultas SQL locais
```

Os arquivos de lookup e GeoJSON normalmente ficam no proprio deploy da Vercel, dentro de `public/data/...`, e sao acessados por caminhos como:

```text
/data/lookup/areas_centroids.csv
/data/lookup/ltla_lookup.csv
/data/lookup/boundaries.geojson
```

Para datasets pequenos, como `br_air_od_2022`, basta commitar os artefatos em `public/data/<dataset-id>/`. Para datasets maiores, pode ser melhor subir os Parquets para o GitHub e usar uma URL jsDelivr no `remoteBaseUrl`. Para reprodutibilidade, prefira uma tag ou release em vez de `@main`, por exemplo:

```text
https://cdn.jsdelivr.net/gh/GustavoWMSilva/MapGeospatialMobilityData@v1.0.0-data/public/data/br_air_od_2022/processed/
```

## O que o JSON controla

O perfil JSON controla:

- nome exibido no toggle
- descricao do dataset ativo
- labels da geografia base e da geografia agregada
- placeholder dos campos de busca
- textos do dashboard
- titulo de cada grafico existente
- visibilidade de cada grafico
- ordem de exibicao em `dashboard.chartOrder`
- estado inicial expandido/minimizado
- parametros por grafico em `dashboard.charts.<chartId>.params`

Importante: o JSON ativa ou desativa componentes que ja existem. Se voce quiser um grafico totalmente novo, ainda sera preciso implementar o componente uma vez.

## Opcoes de graficos no JSON

Use estes valores em `dashboard.chartOrder` e em `dashboard.charts`:

| `chartId`            | Grafico                                  | Modo                            | Secao sugerida | Parametros                                                 |
| -------------------- | ---------------------------------------- | ------------------------------- | -------------- | ---------------------------------------------------------- |
| `topFlows`           | Ranking dos principais fluxos            | generico e UK legado            | `main`         | `params.topN`                                              |
| `socialPie`          | Distribuicao por uma dimensao categorica | generico e UK legado            | `main`         | `params.dimensionKey`                                      |
| `ageBar`             | Barras por uma dimensao categorica       | generico e UK legado            | `main`         | `params.dimensionKey`                                      |
| `performance`        | Performance e latencia                   | UK legado                       | `advanced`     | nenhum                                                     |
| `odHeatmap`          | Mapa de calor origem-destino agregado    | generico em geografia agregada  | `advanced`     | `params.initialTopN`                                       |
| `socialMultiples`    | Multiplos paineis por categoria          | generico em geografia agregada  | `advanced`     | `params.dimensionKey`, `params.topN`                       |
| `aggregateStacked`   | Composicao categorica empilhada 100%     | generico em geografia agregada  | `advanced`     | `params.dimensionKey`, `params.initialTopN` (`12` ou `20`) |
| `aggregationScatter` | Validacao da agregacao                   | UK legado em geografia agregada | `advanced`     | nenhum                                                     |
| `directionalBalance` | Saldo direcional por area agregada       | generico em geografia agregada  | `advanced`     | `params.topN`                                              |

Exemplo:

```json
"dashboard": {
  "chartOrder": ["socialPie", "ageBar", "topFlows", "directionalBalance"],
  "charts": {
    "socialPie": {
      "title": "Distribuicao por ocupacao",
      "enabled": true,
      "section": "main",
      "params": { "dimensionKey": "occupation" }
    },
    "ageBar": {
      "title": "Distribuicao por faixa etaria",
      "enabled": true,
      "section": "main",
      "params": { "dimensionKey": "age" }
    },
    "topFlows": {
      "title": "Ranking dos principais fluxos",
      "enabled": true,
      "section": "main",
      "params": { "topN": 10 }
    },
    "directionalBalance": {
      "title": "Saldo direcional por bairro",
      "enabled": true,
      "section": "advanced",
      "params": { "topN": 15 }
    }
  }
}
```

## Estrutura minima esperada dos dados

Dataset principal:

- `origin_code`
- `dest_code`
- `count`

Colunas recomendadas no fluxo base:

- `origin_name`
- `dest_name`

Centroides base:

- `code`
- `name`
- `lat`
- `lon`

Lookup entre geografia base e geografia agregada, se existir:

- coluna do codigo da geografia base
- coluna do codigo da geografia agregada
- nomes legiveis, quando possivel

## Pipeline de dados

O projeto inclui um pipeline para gerar os artefatos que o app espera.

Consulte:

- [DATASET_PIPELINE.md](DATASET_PIPELINE.md)
- [COMO_ADICIONAR_NOVOS_DADOS.md](COMO_ADICIONAR_NOVOS_DADOS.md)
- [ESPECIFICACAO_DE_DADOS_PARA_NOVA_GEOGRAFIA.md](ESPECIFICACAO_DE_DADOS_PARA_NOVA_GEOGRAFIA.md)

## Funcionalidades da aba Ferramentas

A aba **Ferramentas** concentra recursos para testar novos dados sem alterar diretamente o codigo da aplicacao.

### Aplicar matriz OD personalizada

A opcao **Aplicar matriz OD personalizada** permite carregar uma nova matriz origem-destino sobre um dataset que ja existe no app. Esse fluxo e util quando a geografia, centroides, limites e lookup ja estao configurados, como no caso de Porto Alegre, mas o usuario quer testar outra simulacao ou outra matriz OD.

A matriz enviada substitui temporariamente os fluxos carregados no DuckDB-WASM para o dataset ativo. Com isso, o mapa, as linhas, os rankings, os graficos e os filtros passam a consultar a nova matriz aplicada. A matriz original pode ser restaurada pela propria interface.

O arquivo principal precisa conter colunas equivalentes a:

- origem
- destino
- volume ou quantidade de pessoas

A interface tenta inferir automaticamente as colunas, mas tambem permite ajustar o mapeamento antes de aplicar. Quando o dataset possui filtros demograficos, como faixa etaria ou ocupacao, tambem e possivel carregar arquivos separados para essas dimensoes. Cada arquivo de filtro deve conter origem, destino, volume e a coluna categorica correspondente.

As simulacoes podem ser salvas localmente no navegador usando IndexedDB. Atualmente, o app guarda uma simulacao por dataset; ao salvar uma nova simulacao para o mesmo dataset, ela substitui a anterior. Esse comportamento evita acumular muitos arquivos grandes no navegador.

Arquivo relacionado: `src/components/ODSimulationUploader.tsx`.

### Assistente de perfil OD

A opcao **Criar dataset por JSON** abre o Assistente de perfil OD. Ele foi criado para facilitar a inclusao de novos datasets por usuarios que nao querem editar manualmente todos os campos do JSON.

O assistente permite:

- preencher de forma guiada os metadados do dataset;
- configurar nomes da geografia base e agregada;
- informar caminhos dos arquivos publicados;
- adicionar dimensoes demograficas e opcoes de filtros;
- habilitar ou desabilitar graficos existentes;
- colar um JSON pronto para editar;
- validar campos obrigatorios;
- testar links dos arquivos antes de salvar;
- copiar ou baixar o JSON gerado.

O perfil pode ser salvo localmente no navegador por IndexedDB/localStorage. Assim, o dataset aparece no seletor da interface sem precisar recompilar o projeto. Tambem e possivel remover pela interface datasets adicionados localmente.

Tambem existe a opcao **Salvar JSON online**, que publica o perfil no Vercel Blob e salva a referencia localmente. No fluxo atual, apenas o arquivo JSON e enviado para o Blob. Os Parquets, CSVs e GeoJSONs continuam apontando para URLs publicas ja existentes, como `public/data/...` no deploy ou jsDelivr/GitHub.

Essa escolha foi feita para reduzir uso de armazenamento, transferencia e operacoes no plano gratuito. O Vercel Blob possui limites mensais de armazenamento, transferencia e operacoes; para fins de estudo, publicar apenas os perfis JSON e suficiente e evita consumir recursos com arquivos grandes. A documentacao oficial do Vercel Blob esta em:

```text
https://vercel.com/docs/vercel-blob
```

Para usar o salvamento online, o projeto precisa ter um Blob Store conectado e a variavel `BLOB_READ_WRITE_TOKEN` configurada no ambiente da Vercel. O endpoint usado pelo app fica em `api/blob-upload.ts`.

Arquivo relacionado: `src/components/DatasetProfileBuilder.tsx`.

## Executando o projeto

```bash
npm install
npm run dev
```

Por padrao, tanto em producao quanto no localhost, o app usa DuckDB-WASM no navegador para consultar os arquivos publicados. Assim, nao e necessario subir a API Flask para usar o mapa localmente.

Se voce quiser testar a API Flask local em `http://localhost:5000`, ative explicitamente:

```bash
VITE_USE_FLASK_API=true npm run dev
```

No Windows PowerShell:

```powershell
$env:VITE_USE_FLASK_API="true"; npm run dev
```

Sem essa flag, o app nao tenta chamar `localhost:5000`, evitando erros como:

```text
GET http://localhost:5000/api/flows/... net::ERR_CONNECTION_REFUSED
```

Build:

```bash
npm run build
```

## Resumo pratico

Se alguem for te entregar uma nova base, voce pode pedir exatamente isto:

1. Artefatos de dados prontos
2. Um JSON de perfil preenchido a partir do template
3. Confirmacao dos nomes da geografia base e da geografia agregada
4. Lista de filtros demograficos opcionais
5. Lista de graficos existentes que devem aparecer, ordem, titulos e parametros
