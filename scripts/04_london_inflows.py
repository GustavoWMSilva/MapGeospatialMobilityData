import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString
import yaml, os

# Obter o diretório do script e ir para a raiz do projeto
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
os.chdir(project_root)

cfg = yaml.safe_load(open("config.yaml"))
parquet_path   = cfg["paths"]["parquet"]
lookup_path    = cfg["paths"]["lookup_areas"]
processed_dir  = cfg["paths"]["processed_dir"]
cols           = cfg["columns"]

os.makedirs(processed_dir, exist_ok=True)

print("=" * 70)
print("🏙️  GERADOR DE FLUXOS PARA LONDRES (CAPITAL)")
print("=" * 70)

print(f"\n📥 Lendo arquivo Parquet: {parquet_path}")
df = pd.read_parquet(parquet_path)
print(f"✅ Total de registros: {len(df):,}")

# Carregar centróides
print(f"\n📍 Carregando centróides: {lookup_path}")
lut = pd.read_csv(lookup_path, dtype={"code":"string"})
lut = lut.rename(columns={"code":"code_area", "name":"area_name"})
print(f"✅ Total de áreas com centróides: {len(lut):,}")

# Identificar áreas centrais de Londres
london_keywords = [
    'City of London', 'Westminster', 'Camden', 'Islington', 'Hackney', 
    'Tower Hamlets', 'Greenwich', 'Lewisham', 'Southwark', 'Lambeth', 
    'Wandsworth', 'Hammersmith', 'Kensington', 'Newham', 'Waltham Forest'
]

london_pattern = '|'.join(london_keywords)
london_areas = lut[lut['area_name'].str.contains(london_pattern, case=False, na=False)]
london_codes = set(london_areas['code_area'].values)

print(f"\n🏙️  Áreas identificadas como Londres: {len(london_codes)}")
print(f"   Exemplos: {list(london_codes)[:5]}")

# Filtrar apenas fluxos que vão PARA Londres
print(f"\n🔍 Filtrando fluxos com destino em Londres...")
before = len(df)
df_london = df[df[cols["dest_code"]].isin(london_codes)].copy()
print(f"   {before:,} → {len(df_london):,} registros")

# Juntar com centróides
df_london = df_london.merge(lut.add_prefix("o_"), left_on=cols["origin_code"], right_on="o_code_area", how="left")
df_london = df_london.merge(lut.add_prefix("d_"), left_on=cols["dest_code"], right_on="d_code_area", how="left")

# Remove registros sem centróides
before_drop = len(df_london)
df_london = df_london.dropna(subset=["o_lat","o_lon","d_lat","d_lon"])
dropped = before_drop - len(df_london)
print(f"\n⚙️  Registros sem centróides removidos: {dropped:,}")

# Remove fluxos onde origem = destino
before_same = len(df_london)
df_london = df_london[(df_london["o_lat"] != df_london["d_lat"]) | (df_london["o_lon"] != df_london["d_lon"])]
same_location = before_same - len(df_london)
print(f"⚙️  Fluxos origem=destino removidos: {same_location:,}")
print(f"✅ Fluxos válidos para visualização: {len(df_london):,}")

# Ordenar por volume e pegar top fluxos
top_n = 5000  # Pegar top 5000 fluxos mais volumosos
df_london = df_london.sort_values(cols["count"], ascending=False).head(top_n)
print(f"\n📊 Selecionando top {top_n} fluxos mais volumosos")
print(f"   Volume mínimo: {df_london[cols['count']].min():,} pessoas")
print(f"   Volume máximo: {df_london[cols['count']].max():,} pessoas")

# Criar GeoJSON
print(f"\n🗺️  Gerando GeoJSON...")
geom = [LineString([(lon1, lat1), (lon2, lat2)]) 
        for lon1, lat1, lon2, lat2 in zip(
            df_london["o_lon"], df_london["o_lat"], 
            df_london["d_lon"], df_london["d_lat"]
        )]

gdf = gpd.GeoDataFrame(
    df_london[[
        cols["origin_code"], cols["origin_name"], 
        cols["dest_code"], cols["dest_name"], 
        cols["count"]
    ]], 
    geometry=geom, 
    crs=4326
)

# Adicionar bins de contagem
gdf["count_bin"] = pd.cut(
    gdf[cols["count"]], 
    bins=[0, 10, 50, 100, 500, 1000, 5000, 100000], 
    include_lowest=True
)

# Salvar arquivo
out_path = os.path.join(processed_dir, "london-inflows-top5000.geojson")
gdf.to_file(out_path, driver="GeoJSON")
file_size = os.path.getsize(out_path) / (1024*1024)

print(f"\n✅ ARQUIVO GERADO COM SUCESSO!")
print(f"   📁 Arquivo: {out_path}")
print(f"   📊 Linhas: {len(gdf):,}")
print(f"   💾 Tamanho: {file_size:.2f} MB")

# Estatísticas dos destinos
print(f"\n📈 ESTATÍSTICAS DOS DESTINOS EM LONDRES:")
top_dests = df_london.groupby(cols["dest_name"])[cols["count"]].sum().sort_values(ascending=False).head(10)
for i, (dest, count) in enumerate(top_dests.items(), 1):
    print(f"   {i}. {dest}: {count:,} pessoas")

print("\n" + "=" * 70)
print("🎉 PIPELINE COMPLETO!")
print("=" * 70)
