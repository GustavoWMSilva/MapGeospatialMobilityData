"""
Script para agregar todos os flows MSOA em LTLA
Diferente do arquivo existente, este inclui TODOS os flows, não apenas ≥100
"""
import pandas as pd
import json
import os

print("🔄 Iniciando agregação MSOA → LTLA...")

# Caminhos
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
parquet_path = os.path.join(project_root, "data/interim/odwp01ew.parquet")
msoa_lookup = os.path.join(project_root, "data/lookup/areas_centroids.csv")
ltla_lookup = os.path.join(project_root, "data/lookup/ltla_centroids.csv")
output_path = os.path.join(project_root, "public/ltla_flows_complete.geojson")

# Passo 1: Baixar/carregar mapeamento MSOA -> LTLA
print("\n📥 Baixando mapeamento MSOA → LTLA do ONS...")
lookup_url = "https://www.arcgis.com/sharing/rest/content/items/8ff16bc64c924501b9a70f66e8dac78f/data"

try:
    # Tentar baixar o lookup
    import requests
    response = requests.get(lookup_url, timeout=30)
    
    if response.status_code == 200:
        lookup_file = os.path.join(project_root, "data/lookup/msoa_ltla_lookup.csv")
        with open(lookup_file, 'wb') as f:
            f.write(response.content)
        print(f"✅ Download completo: {lookup_file}")
    else:
        print(f"⚠️  Falha no download (HTTP {response.status_code})")
        print("📝 Tentando criar mapeamento alternativo...")
        raise Exception("Download failed")
        
except Exception as e:
    print(f"⚠️  Erro ao baixar: {e}")
    print("📝 Criando mapeamento baseado nos dados existentes...")
    
    # Carregar LTLA centroids que já temos
    ltla_df = pd.read_csv(ltla_lookup, dtype={'code': str})
    
    # Criar mapeamento baseado em proximidade geográfica
    # (simplificação: usar os primeiros caracteres do nome)
    msoa_df = pd.read_csv(msoa_lookup, dtype={'code': str})
    
    # Extrair nome base (removendo números do MSOA)
    msoa_df['area_name'] = msoa_df['name'].str.replace(r'\s+\d+[A-Z]?$', '', regex=True)
    
    # Criar lookup baseado em nome
    lookup_dict = {}
    for _, ltla_row in ltla_df.iterrows():
        ltla_code = ltla_row['code']
        ltla_name = ltla_row['name']
        
        # Encontrar MSOAs que correspondem a este LTLA
        matching = msoa_df[msoa_df['area_name'] == ltla_name]
        for _, msoa_row in matching.iterrows():
            lookup_dict[msoa_row['code']] = ltla_code
    
    print(f"✅ Mapeamento criado: {len(lookup_dict)} MSOAs → {len(set(lookup_dict.values()))} LTLAs")
    
    # Salvar lookup
    lookup_file = os.path.join(project_root, "data/lookup/msoa_ltla_lookup.csv")
    lookup_df = pd.DataFrame([
        {'msoa_code': k, 'ltla_code': v} 
        for k, v in lookup_dict.items()
    ])
    lookup_df.to_csv(lookup_file, index=False)

# Passo 2: Carregar lookup
print("\n📂 Carregando mapeamento...")
lookup_df = pd.read_csv(lookup_file, dtype={'msoa_code': str, 'ltla_code': str})
print(f"✅ Carregado: {len(lookup_df)} mapeamentos MSOA → LTLA")

# Passo 3: Carregar flows MSOA
print("\n📂 Carregando flows MSOA...")
df = pd.read_parquet(parquet_path)
print(f"✅ Carregado: {len(df):,} flows MSOA")

# Passo 4: Mapear MSOA → LTLA
print("\n🔄 Mapeando códigos MSOA → LTLA...")
df = df.merge(
    lookup_df.rename(columns={'msoa_code': 'origin_code', 'ltla_code': 'origin_ltla'}),
    on='origin_code',
    how='left'
)
df = df.merge(
    lookup_df.rename(columns={'msoa_code': 'dest_code', 'ltla_code': 'dest_ltla'}),
    on='dest_code',
    how='left'
)

# Remover flows sem mapeamento
before = len(df)
df = df.dropna(subset=['origin_ltla', 'dest_ltla'])
print(f"✅ Mapeado: {len(df):,} flows ({before - len(df):,} sem mapeamento)")

# Passo 5: Agregar por LTLA
print("\n🔄 Agregando flows por LTLA...")
ltla_flows = df.groupby(['origin_ltla', 'dest_ltla']).agg({
    'count': 'sum'
}).reset_index()

ltla_flows = ltla_flows.rename(columns={
    'origin_ltla': 'origin_code',
    'dest_ltla': 'dest_code'
})

print(f"✅ Agregado: {len(ltla_flows):,} flows LTLA")

# Passo 6: Adicionar nomes e coordenadas
print("\n🔄 Adicionando coordenadas...")
ltla_coords = pd.read_csv(ltla_lookup, dtype={'code': str})

ltla_flows = ltla_flows.merge(
    ltla_coords.rename(columns={'code': 'origin_code', 'name': 'origin_name', 'lat': 'origin_lat', 'lon': 'origin_lon'}),
    on='origin_code',
    how='left'
)
ltla_flows = ltla_flows.merge(
    ltla_coords.rename(columns={'code': 'dest_code', 'name': 'dest_name', 'lat': 'dest_lat', 'lon': 'dest_lon'}),
    on='dest_code',
    how='left'
)

# Remover flows sem coordenadas
before = len(ltla_flows)
ltla_flows = ltla_flows.dropna(subset=['origin_lat', 'origin_lon', 'dest_lat', 'dest_lon'])
print(f"✅ {len(ltla_flows):,} flows com coordenadas ({before - len(ltla_flows):,} removidos)")

# Passo 7: Criar GeoJSON
print("\n🔄 Criando GeoJSON...")
features = []
for _, row in ltla_flows.iterrows():
    features.append({
        "type": "Feature",
        "properties": {
            "origin_code": row['origin_code'],
            "origin_name": row['origin_name'],
            "dest_code": row['dest_code'],
            "dest_name": row['dest_name'],
            "count": int(row['count'])
        },
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [float(row['origin_lon']), float(row['origin_lat'])],
                [float(row['dest_lon']), float(row['dest_lat'])]
            ]
        }
    })

geojson = {
    "type": "FeatureCollection",
    "features": features
}

# Passo 8: Salvar
print(f"\n💾 Salvando em {output_path}...")
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(geojson, f)

# Verificar tamanho
file_size = os.path.getsize(output_path) / (1024 * 1024)
print(f"✅ Arquivo salvo: {file_size:.1f} MB")

# Estatísticas
print("\n📊 Estatísticas:")
print(f"   Total de flows LTLA: {len(ltla_flows):,}")
print(f"   LTLAs únicos como origem: {ltla_flows['origin_code'].nunique()}")
print(f"   LTLAs únicos como destino: {ltla_flows['dest_code'].nunique()}")
print(f"   Média de pessoas por flow: {ltla_flows['count'].mean():.0f}")
print(f"   Mediana: {ltla_flows['count'].median():.0f}")
print(f"   Min: {ltla_flows['count'].min()}")
print(f"   Max: {ltla_flows['count'].max():,}")

print("\n✅ Concluído!")
