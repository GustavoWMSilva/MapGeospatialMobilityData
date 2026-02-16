# Guia: Upload de Dados para GitHub Releases

## Passo 1: Criar uma Release no GitHub

1. Acesse seu repositório: https://github.com/GustavoWMSilva/MapGeospatialMobilityData

2. Clique em **"Releases"** (lado direito)

3. Clique em **"Create a new release"**

4. Preencha:

   - **Tag version:** `v1.0.0-data`
   - **Release title:** `Data Files - MSOA Flows`
   - **Description:**

   ```markdown
   # Dados de Mobilidade MSOA

   Arquivo Parquet contendo 1,856,456 flows de mobilidade do UK Census 2011.

   ## Arquivos:

   - `ODWP01EW_MSOA.parquet` (189 MB) - Dados completos MSOA

   ## Uso:

   Estes arquivos são carregados automaticamente pelo frontend usando DuckDB-WASM.

   Fonte: Office for National Statistics (ONS)
   ```

## Passo 2: Upload dos Arquivos

### Arrastar e soltar no GitHub:

Arraste estes arquivos para a área de upload da release:

1. **`data/interim/odwp01ew.parquet`** (189 MB)
   - Renomear para: `ODWP01EW_MSOA.parquet`

### Opcional (para lookup):

2. **`data/lookup/areas_centroids.csv`** (~500 KB)
3. **`data/lookup/ltla_centroids.csv`** (~10 KB)

## Passo 3: Publicar

Clique em **"Publish release"**

## Passo 4: Obter URLs

Após publicar, os arquivos estarão disponíveis em:

```
https://github.com/GustavoWMSilva/MapGeospatialMobilityData/releases/download/v1.0.0-data/ODWP01EW_MSOA.parquet
```

## Passo 5: Copiar CSV de Coordenadas para /public

Para que o frontend possa acessar as coordenadas:

```bash
# Copiar para pasta pública
cp data/lookup/areas_centroids.csv public/data/lookup/
```

Criar a estrutura:

```bash
mkdir -p public/data/lookup
cp data/lookup/areas_centroids.csv public/data/lookup/
cp data/lookup/ltla_centroids.csv public/data/lookup/
```

## Passo 6: Testar

Após fazer upload:

1. **Desenvolvimento:**

```bash
npm run dev
```

Vai usar a API local

2. **Produção (simulação):**

```bash
npm run build
npm run preview
```

Vai usar DuckDB-WASM + GitHub Releases

## Comandos de Preparação

```bash
# 1. Copiar coordenadas para /public
mkdir -p public/data/lookup
cp data/lookup/areas_centroids.csv public/data/lookup/
cp data/lookup/ltla_centroids.csv public/data/lookup/

# 2. Renomear Parquet
cp data/interim/odwp01ew.parquet data/interim/ODWP01EW_MSOA.parquet

# 3. Verificar tamanhos
ls -lh data/interim/ODWP01EW_MSOA.parquet
ls -lh public/data/lookup/*.csv
```

## Verificação Final

Após deploy, teste a URL do Parquet:

```
https://github.com/GustavoWMSilva/MapGeospatialMobilityData/releases/download/v1.0.0-data/ODWP01EW_MSOA.parquet
```

Deve baixar o arquivo (189 MB).

## Troubleshooting

### Erro: "File too large"

- GitHub Releases aceita até 2GB por arquivo
- Seu arquivo (189MB) está OK ✅

### Erro: CORS

- GitHub Releases permite CORS automaticamente ✅

### Erro: Arquivo não encontrado

- Verifique o nome exato do arquivo
- Tag da release deve ser `v1.0.0-data`

## Estrutura Final

```
GitHub Release v1.0.0-data/
  ├── ODWP01EW_MSOA.parquet (189 MB)
  ├── areas_centroids.csv (500 KB) [opcional]
  └── ltla_centroids.csv (10 KB) [opcional]

public/
  ├── data/
  │   └── lookup/
  │       ├── areas_centroids.csv
  │       └── ltla_centroids.csv
  └── ltla_flows_complete.geojson (19.4 MB)
```
