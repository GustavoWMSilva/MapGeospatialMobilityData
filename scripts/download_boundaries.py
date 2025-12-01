"""
Script para baixar boundaries das MSOAs (Middle Layer Super Output Areas) do Reino Unido
e calcular os centróides com coordenadas reais.

Fonte: Office for National Statistics (ONS) - UK Geoportal
"""

import geopandas as gpd
import pandas as pd
import os
import sys
import requests
import json

# Obter o diretório do script e ir para a raiz do projeto
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
os.chdir(project_root)

print("🌐 Baixando boundaries das MSOAs do Reino Unido...")
print("⏳ Isso pode levar alguns minutos dependendo da sua conexão...\n")

# URL do ONS - Boundaries simplificadas das MSOAs 2021
# Fonte: ONS Open Geography Portal - versão generalizada (BGC - generalized clipped)
# Esta versão é menor e mais rápida de baixar
url = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/MSOA_Dec_2021_Boundaries_Generalised_Clipped_EW_BGC_2022/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson"

try:
    # Baixar e ler o GeoJSON usando requests primeiro
    print("📥 Baixando dados do ONS Open Geography Portal...")
    print("📊 Fonte: MSOA December 2021 Boundaries (Generalised Clipped)")
    print("⏳ Aguarde, este arquivo pode ser grande...\n")
    
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    
    print("✅ Dados baixados com sucesso!")
    print("📦 Processando GeoJSON...\n")
    
    geojson_data = response.json()
    gdf = gpd.GeoDataFrame.from_features(geojson_data['features'], crs='EPSG:4326')
    
    print(f"✅ Dados baixados: {len(gdf)} áreas")
    print(f"📊 Colunas disponíveis: {gdf.columns.tolist()}\n")
    
    # Verificar e ajustar nomes das colunas para MSOA 2021
    # As colunas do ONS 2021 usam MSOA21CD e MSOA21NM
    if "MSOA21CD" in gdf.columns:
        gdf["code"] = gdf["MSOA21CD"]
    elif "MSOA11CD" in gdf.columns:
        gdf["code"] = gdf["MSOA11CD"]
    elif "msoa21cd" in gdf.columns:
        gdf["code"] = gdf["msoa21cd"]
    elif "msoa11cd" in gdf.columns:
        gdf["code"] = gdf["msoa11cd"]
    elif "code" in gdf.columns:
        pass  # já existe
    else:
        print("⚠️  Coluna de código não encontrada. Colunas disponíveis:", gdf.columns.tolist())
        # Tentar usar a primeira coluna que pareça ser um código
        for col in gdf.columns:
            if 'cd' in col.lower() or 'code' in col.lower():
                gdf["code"] = gdf[col]
                break
    
    if "MSOA21NM" in gdf.columns:
        gdf["name"] = gdf["MSOA21NM"]
    elif "MSOA11NM" in gdf.columns:
        gdf["name"] = gdf["MSOA11NM"]
    elif "msoa21nm" in gdf.columns:
        gdf["name"] = gdf["msoa21nm"]
    elif "msoa11nm" in gdf.columns:
        gdf["name"] = gdf["msoa11nm"]
    elif "name" in gdf.columns:
        pass  # já existe
    else:
        print("⚠️  Coluna de nome não encontrada")
        gdf["name"] = gdf["code"] if "code" in gdf.columns else "Unknown"
    
    # Garantir que está em WGS84 (EPSG:4326)
    if gdf.crs != "EPSG:4326":
        print("🔄 Convertendo para WGS84 (EPSG:4326)...")
        gdf = gdf.to_crs(4326)
    
    # Salvar o GeoJSON completo
    boundaries_path = "data/lookup/boundaries.geojson"
    os.makedirs(os.path.dirname(boundaries_path), exist_ok=True)
    
    print("💾 Salvando boundaries...")
    gdf[["code", "name", "geometry"]].to_file(boundaries_path, driver="GeoJSON")
    print(f"✅ Boundaries salvos em: {boundaries_path}")
    
    # Calcular centróides
    print("\n📍 Calculando centróides...")
    cent = gdf.copy()
    cent["lon"] = cent.geometry.centroid.x
    cent["lat"] = cent.geometry.centroid.y
    
    # Salvar CSV com centróides
    out_csv = "data/lookup/areas_centroids.csv"
    out = cent[["code", "name", "lat", "lon"]].drop_duplicates()
    out.to_csv(out_csv, index=False)
    
    print(f"✅ Centróides salvos em: {out_csv}")
    print(f"📊 Total de áreas: {len(out)}")
    
    # Mostrar alguns exemplos
    print("\n📋 Exemplos de centróides:")
    print(out.head(10).to_string(index=False))
    
    print("\n✅ Processo concluído com sucesso!")
    print("💡 Agora você pode executar o script 03_make_flows_geojson.py")
    
except Exception as e:
    print(f"\n❌ Erro ao baixar/processar dados: {e}")
    print("\n💡 Alternativas:")
    print("   1. Verificar sua conexão com a internet")
    print("   2. Baixar manualmente de: https://geoportal.statistics.gov.uk/")
    print("   3. Usar arquivo de lookup existente com coordenadas")
    sys.exit(1)
