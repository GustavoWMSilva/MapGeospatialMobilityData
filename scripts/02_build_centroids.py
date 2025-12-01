"""
Script: Gerador de centróides para MSOAs a partir do arquivo oficial do ONS
"""

import geopandas as gpd
import pandas as pd
import os
import sys

# Obter o diretório do script e ir para a raiz do projeto
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
os.chdir(project_root)

print("=" * 70)
print("📍 GERADOR DE CENTRÓIDES PARA MSOAs")
print("=" * 70)

# Caminho do arquivo baixado
centroids_path = "data/lookup/msoa_centroids.geojson"
out_csv = "data/lookup/areas_centroids.csv"
os.makedirs(os.path.dirname(out_csv), exist_ok=True)

print(f"\n� Lendo arquivo: {centroids_path}")

try:
    # Ler o GeoJSON com os centróides
    gdf = gpd.read_file(centroids_path)
    
    print(f"✅ Arquivo lido com sucesso!")
    print(f"📊 Total de áreas: {len(gdf)}")
    print(f"📋 Colunas disponíveis: {gdf.columns.tolist()}\n")
    
    # Extrair coordenadas dos centróides
    gdf["lon"] = gdf.geometry.x
    gdf["lat"] = gdf.geometry.y
    
    # Identificar coluna de código
    code_col = None
    for col in gdf.columns:
        col_lower = col.lower()
        if 'msoa' in col_lower and ('cd' in col_lower or 'code' in col_lower):
            code_col = col
            break
    
    if not code_col:
        # Tentar encontrar qualquer coluna que pareça ser código
        for col in gdf.columns:
            if 'CD' in col or 'Code' in col:
                code_col = col
                break
    
    if not code_col:
        print("❌ Não foi possível identificar coluna de código automaticamente")
        print(f"Colunas disponíveis: {gdf.columns.tolist()}")
        sys.exit(1)
    
    print(f"✅ Coluna de código identificada: {code_col}")
    
    # Criar DataFrame básico com código e coordenadas
    result = gdf[[code_col, 'lat', 'lon']].copy()
    result.columns = ['code', 'lat', 'lon']
    
    # Buscar nomes no arquivo parquet
    print("\n📊 Buscando nomes das áreas no arquivo de dados...")
    parquet_path = "data/interim/odwp01ew.parquet"
    df = pd.read_parquet(parquet_path)
    
    # Obter mapeamento único de código -> nome
    origins = df[["origin_code", "origin_name"]].drop_duplicates()
    origins.columns = ["code", "name"]
    
    dests = df[["dest_code", "dest_name"]].drop_duplicates()
    dests.columns = ["code", "name"]
    
    names_map = pd.concat([origins, dests]).drop_duplicates(subset=["code"])
    
    # Fazer merge para adicionar nomes
    result = result.merge(names_map[['code', 'name']], on='code', how='left')
    
    # Para códigos sem nome, usar o próprio código
    result['name'] = result['name'].fillna(result['code'])
    
    # Reordenar colunas
    result = result[['code', 'name', 'lat', 'lon']]
    
    # Remover duplicatas e ordenar
    result = result.drop_duplicates(subset=['code']).sort_values('code').reset_index(drop=True)
    
    # Salvar
    result.to_csv(out_csv, index=False)
    
    print(f"\n✅ Arquivo criado: {out_csv}")
    print(f"📊 Total de áreas únicas: {len(result)}")
    print(f"📊 Áreas com nome: {result['name'].notna().sum()}")
    print(f"\n📋 Exemplos das primeiras áreas:")
    print(result.head(10).to_string(index=False))
    
    print("\n" + "=" * 70)
    print("✅ SUCESSO - Centróides oficiais do ONS importados!")
    print("=" * 70)
    print("\n✅ Agora você pode executar o próximo script:")
    print("   python 03_make_flows_geojson.py")
    
except FileNotFoundError:
    print(f"\n❌ Erro: Arquivo não encontrado: {centroids_path}")
    print("\n💡 Certifique-se de que o arquivo foi salvo em:")
    print(f"   {os.path.abspath(centroids_path)}")
    sys.exit(1)
    
except Exception as e:
    print(f"\n❌ Erro ao processar arquivo: {e}")
    print("\n💡 Verifique se o arquivo está no formato correto (GeoJSON)")
    sys.exit(1)


