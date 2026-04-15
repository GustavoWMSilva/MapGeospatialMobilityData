# Pipeline de Datasets

Este projeto inclui um pipeline para gerar os artefatos que a aplicacao espera ao integrar um novo dataset.

O objetivo e transformar o processo de "adicionar uma nova cidade" em algo previsivel:

1. copiar um arquivo de configuracao YAML
2. apontar para as fontes brutas
3. rodar um comando
4. copiar o template do perfil JSON do app
5. preencher labels, paths e configuracao do dashboard
6. salvar o JSON em `src/dataset-configs/`

Nao e mais necessario registrar datasets manualmente em `src/constants/datasetProfiles.ts`.

## Arquivos importantes

- CLI do pipeline: [scripts/build_dataset.py](./scripts/build_dataset.py)
- Exemplo de configuracao do pipeline: [dataset_pipeline_configs/porto_alegre.yaml](./dataset_pipeline_configs/porto_alegre.yaml)
- Template do pipeline: [dataset_pipeline_configs/template.yaml](./dataset_pipeline_configs/template.yaml)
- Template do perfil do app: [dataset_pipeline_configs/app_dataset_profile.template.json](./dataset_pipeline_configs/app_dataset_profile.template.json)

## O que o pipeline gera

Para um dataset com `output_subdir: porto_alegre`, o pipeline gera:

- `public/data/porto_alegre/processed/*.parquet`
- `public/data/porto_alegre/lookup/areas_centroids.csv`
- `public/data/porto_alegre/lookup/aggregate_lookup.csv`
- `public/data/porto_alegre/lookup/aggregate_centroids.csv`
- `public/data/porto_alegre/lookup/boundaries.geojson`
- `public/data/porto_alegre/lookup/aggregate_boundaries.geojson`

## Entradas suportadas

Fontes tabulares:

- `csv`
- `xlsx`
- `parquet`

Fontes geograficas:

- shapefile
- GeoJSON
- GeoPackage

## Comando

No Windows com a venv do projeto:

```powershell
.\venv\Scripts\python scripts\build_dataset.py --config dataset_pipeline_configs\porto_alegre.yaml
```

Ou com npm:

```powershell
npm run dataset:build:poa
```

Entrada generica com npm:

```powershell
npm run dataset:build -- --config dataset_pipeline_configs/template.yaml
```

## Estrutura da configuracao YAML

O YAML do pipeline tem tres blocos principais:

### `dataset`

Controla onde os artefatos gerados serao gravados.

```yaml
dataset:
  id: porto_alegre
  output_root: public/data
  output_subdir: porto_alegre
```

### `flows`

Define:

- a fonte tabular bruta
- como gerar o dataset principal de fluxos OD
- datasets demograficos opcionais a partir de colunas abertas

### `geography`

Define:

- a fonte da geografia base
- como gerar centroides e boundaries da geografia base
- como gerar o lookup entre geografia base e geografia agregada
- como gerar centroides e boundaries da geografia agregada

## Depois do pipeline: perfil JSON do app

Depois de gerar os artefatos de dados, o proximo passo e criar o perfil JSON do dataset.

Copie:

- `dataset_pipeline_configs/app_dataset_profile.template.json`

Salve como:

- `src/dataset-configs/<dataset-id>.json`

Esse perfil controla:

- nome do dataset no toggle
- descricao mostrada na interface
- labels da geografia base e da geografia agregada
- placeholders dos campos de busca
- paths de lookup e storage
- datasets demograficos opcionais
- textos do dashboard
- titulos dos graficos
- quais graficos existentes ficam habilitados

## Fluxo recomendado para um novo dataset

1. Copie [dataset_pipeline_configs/template.yaml](./dataset_pipeline_configs/template.yaml)
2. Ajuste os caminhos das fontes e o mapeamento das colunas
3. Rode o pipeline
4. Verifique os artefatos gerados em `public/data/<dataset-id>/`
5. Copie [dataset_pipeline_configs/app_dataset_profile.template.json](./dataset_pipeline_configs/app_dataset_profile.template.json)
6. Ajuste labels, paths e configuracao do dashboard
7. Salve o JSON em `src/dataset-configs/<dataset-id>.json`
8. Rode o app e teste o dataset pelo toggle no topo

## Observacoes sobre Porto Alegre

O exemplo de Porto Alegre usa:

- `~/Downloads/od_matrix_enumeration_area.csv`
- `~/Downloads/**/setores_2022_poa.shp`
- `~/Downloads/**/Bairros_LC12112_16.shp`

Se os arquivos estiverem em outro local, basta ajustar os paths no YAML.

## Dependencias

O pipeline depende dos pacotes Python listados em [requirements.txt](./requirements.txt), incluindo:

- `pandas`
- `pyarrow`
- `geopandas`
- `pyogrio`
- `pyyaml`
- `openpyxl`
