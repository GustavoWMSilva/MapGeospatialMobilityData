"""
Script para criar boundaries de LTLA a partir de boundaries de MSOA
Agrupa (dissolve) polígonos MSOA que pertencem ao mesmo LTLA
"""

import geopandas as gpd
import pandas as pd
import os

print("Criando boundaries LTLA a partir de MSOA...\n")

# Caminhos
msoa_boundaries_path = "data/lookup/MSOA_boundaries.geojson"  # MSOA boundaries
lookup_path = "data/lookup/msoa_ltla_lookup.csv"  # Lookup MSOA → LTLA
output_path = "public/data/lookup/ltla_boundaries.geojson"


msoa_gdf = gpd.read_file(msoa_boundaries_path)
print(f"  {len(msoa_gdf)} polígonos MSOA carregados")

# 2. Carregar lookup MSOA → LTLA
print("\nCarregando lookup MSOA → LTLA...")
if not os.path.exists(lookup_path):
    print(f"ERRO: Arquivo não encontrado: {lookup_path}")
    exit(1)

lookup_df = pd.read_csv(lookup_path)
print(f"  {len(lookup_df)} mapeamentos carregados")

# Verificar nome da coluna de código
print(f"Colunas no MSOA GeoDataFrame: {msoa_gdf.columns.tolist()}")
print(f"Colunas no lookup: {lookup_df.columns.tolist()}")

# Identificar coluna de código MSOA
if 'msoa_code' in msoa_gdf.columns:
    code_col = 'msoa_code'
elif 'code' in msoa_gdf.columns:
    msoa_gdf = msoa_gdf.rename(columns={'code': 'msoa_code'})
    code_col = 'msoa_code'
elif 'MSOA21CD' in msoa_gdf.columns:
    msoa_gdf = msoa_gdf.rename(columns={'MSOA21CD': 'msoa_code'})
    code_col = 'msoa_code'
else:
    # Usar a primeira coluna que pareça ser um código
    for col in msoa_gdf.columns:
        if 'cd' in col.lower() or 'code' in col.lower():
            msoa_gdf = msoa_gdf.rename(columns={col: 'msoa_code'})
            code_col = 'msoa_code'
            print(f"Usando coluna '{col}' como msoa_code")
            break

# Merge com lookup
merged = msoa_gdf.merge(lookup_df, on='msoa_code', how='left')
print(f"  {len(merged)} registros após merge")

# Remover registros sem LTLA
merged = merged.dropna(subset=['ltla_code'])
print(f"  {len(merged)} registros com LTLA válido")

# 4. Agrupar (dissolve) por LTLA
print("\nAgrupando MSOAs por LTLA (dissolve)...")

ltla_gdf = merged.dissolve(by='ltla_code', as_index=False)
print(f"  {len(ltla_gdf)} polígonos LTLA criados")

# 5. Adicionar nome do LTLA (carregar de ltla_centroids.csv)
print("\nAdicionando nomes dos LTLAs...")
ltla_centroids_path = "public/data/lookup/ltla_centroids.csv"
if os.path.exists(ltla_centroids_path):
    ltla_names = pd.read_csv(ltla_centroids_path)[['code', 'name']]
    ltla_names = ltla_names.rename(columns={'code': 'ltla_code', 'name': 'ltla_name'})
    ltla_gdf = ltla_gdf.merge(ltla_names, on='ltla_code', how='left')
else:
    print(f"  AVISO: {ltla_centroids_path} não encontrado, usando código como nome")
    ltla_gdf['ltla_name'] = ltla_gdf['ltla_code']

# 6. Simplificar geometria (opcional, reduz tamanho do arquivo)
print("\nSimplificando geometrias...")
ltla_gdf['geometry'] = ltla_gdf['geometry'].simplify(tolerance=0.001, preserve_topology=True)

# 7. Salvar resultado
print(f"\nSalvando em {output_path}...")
os.makedirs(os.path.dirname(output_path), exist_ok=True)

ltla_gdf[['ltla_code', 'ltla_name', 'geometry']].to_file(
    output_path,
    driver='GeoJSON'
)

# Estatísticas
file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
print(f"\nConcluído!")
print(f"  {len(ltla_gdf)} boundaries LTLA criadas")
print(f"  Tamanho do arquivo: {file_size_mb:.2f} MB")
print(f"  Salvo em: {output_path}")

# Mostrar exemplos
print("\nExemplos de LTLAs criados:")
for i, row in ltla_gdf.head(5).iterrows():
    print(f"  - {row['ltla_code']}: {row['ltla_name']}")
