# Dataset Pipeline

This project now includes a config-driven pipeline to generate the artifacts the app expects for a new dataset:

- `processed/*.parquet`
- `lookup/*.csv`
- `lookup/*.geojson`

The goal is to turn "add a new city" into:

1. copy a config file
2. point it to the raw sources
3. run one command
4. register the dataset in `src/constants/datasetProfiles.ts`

## Files

- Pipeline CLI: [scripts/build_dataset.py](./scripts/build_dataset.py)
- Example config: [dataset_pipeline_configs/porto_alegre.yaml](./dataset_pipeline_configs/porto_alegre.yaml)
- Template config: [dataset_pipeline_configs/template.yaml](./dataset_pipeline_configs/template.yaml)

## What the pipeline writes

For a dataset with `output_subdir: porto_alegre`, the pipeline writes:

- `public/data/porto_alegre/processed/*.parquet`
- `public/data/porto_alegre/lookup/areas_centroids.csv`
- `public/data/porto_alegre/lookup/aggregate_lookup.csv`
- `public/data/porto_alegre/lookup/aggregate_centroids.csv`
- `public/data/porto_alegre/lookup/boundaries.geojson`
- `public/data/porto_alegre/lookup/aggregate_boundaries.geojson`

## Supported inputs

Tabular sources:

- `csv`
- `xlsx`
- `parquet`

Geographic sources:

- shapefile
- GeoJSON
- GeoPackage

## Command

Windows with the project venv:

```powershell
.\venv\Scripts\python scripts\build_dataset.py --config dataset_pipeline_configs\porto_alegre.yaml
```

Or with npm:

```powershell
npm run dataset:build:poa
```

Generic npm entrypoint:

```powershell
npm run dataset:build -- --config dataset_pipeline_configs/template.yaml
```

## Config shape

The config has three main blocks:

### `dataset`

Controls where the generated artifacts are written.

```yaml
dataset:
  id: porto_alegre
  output_root: public/data
  output_subdir: porto_alegre
```

### `flows`

Defines:

- the raw tabular source
- how to build the base OD parquet
- optional dimension parquets from wide columns

Example:

```yaml
flows:
  source:
    path: "~/Downloads/od_matrix_enumeration_area.csv"
    format: csv
    read_options:
      sep: ";"

  base:
    output_file: od_matrix_enumeration_area.parquet
    columns:
      origin_code: Origin
      origin_name: Origin
      dest_code: Destination
      dest_name: Destination
      count: Total
```

Dimension datasets are created by melting wide columns into the long format the app already uses:

```yaml
dimensions:
  - key: age
    output_file: od_matrix_enumeration_area_age.parquet
    code_column: age_code
    category_column: age_group
    categories:
      - code: 1
        value: children
        source_column: "age: [children]"
```

### `geography`

Defines:

- the base geography source
- how to build base centroids and boundaries
- how to build the base -> aggregate lookup
- how to build aggregate centroids and boundaries

The pipeline currently writes lookup columns compatible with the existing app:

- `msoa21cd`
- `msoa21nm`
- `ltla22cd`
- `ltla22nm`

and aggregate boundary properties compatible with the current map code:

- `ltla_code`
- `ltla_name`

That means the pipeline is generic on the source side, while still producing files the current frontend can consume immediately.

## Porto Alegre notes

The Porto Alegre example config uses:

- `~/Downloads/od_matrix_enumeration_area.csv`
- `~/Downloads/**/setores_2022_poa.shp`
- `~/Downloads/**/Bairros_LC12112_16.shp`

So if the files are in another location, you only need to edit the paths in the YAML.

## Dependencies

The data pipeline relies on the Python packages listed in [requirements.txt](./requirements.txt), including:

- `pandas`
- `pyarrow`
- `geopandas`
- `pyogrio`
- `pyyaml`
- `openpyxl`

If you want Excel input support, `openpyxl` needs to be installed.

## Suggested workflow for a new city

1. Copy [dataset_pipeline_configs/template.yaml](./dataset_pipeline_configs/template.yaml)
2. Change source paths and column mappings
3. Run the pipeline
4. Check the generated files under `public/data/<dataset-id>/`
5. Add a new entry in [src/constants/datasetProfiles.ts](./src/constants/datasetProfiles.ts)
6. Switch `VITE_ACTIVE_DATASET` in [.env](./.env) to test it
