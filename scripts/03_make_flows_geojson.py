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
scenarios      = cfg["export"]["scenarios"]

os.makedirs(processed_dir, exist_ok=True)

print("=" * 70)
print("🗺️  GERADOR DE GEOJSON DE FLUXOS DE MOBILIDADE")
print("=" * 70)

print(f"\n📥 Lendo arquivo Parquet: {parquet_path}")
df = pd.read_parquet(parquet_path)
print(f"✅ Total de registros: {len(df):,}")

# Junta centróides de origem e destino
print(f"\n📍 Carregando centróides: {lookup_path}")
lut = pd.read_csv(lookup_path, dtype={"code":"string"})
lut = lut.rename(columns={"code":"code_area", "name":"area_name"})
print(f"✅ Total de áreas com centróides: {len(lut):,}")

df = df.merge(lut.add_prefix("o_"), left_on=cols["origin_code"], right_on="o_code_area", how="left")
df = df.merge(lut.add_prefix("d_"), left_on=cols["dest_code"],   right_on="d_code_area", how="left")

# Remove pares sem centróide
before_drop = len(df)
df = df.dropna(subset=["o_lat","o_lon","d_lat","d_lon"])
dropped = before_drop - len(df)
print(f"\n⚙️  Registros sem centróides removidos: {dropped:,}")

# ✨ NOVO: Remove fluxos onde origem = destino (não aparecem no mapa)
before_same = len(df)
df = df[(df["o_lat"] != df["d_lat"]) | (df["o_lon"] != df["d_lon"])]
same_location = before_same - len(df)
print(f"⚙️  Fluxos origem=destino removidos: {same_location:,}")
print(f"✅ Registros válidos para visualização: {len(df):,}")

def make_geojson(sub, out_path):
    # cria LineString entre centróide origem e destino
    geom = [LineString([(lon1, lat1), (lon2, lat2)]) 
            for lon1, lat1, lon2, lat2 in zip(sub["o_lon"], sub["o_lat"], sub["d_lon"], sub["d_lat"])]
    gdf = gpd.GeoDataFrame(sub[[
        cols["origin_code"], cols["origin_name"], 
        cols["dest_code"], cols["dest_name"], 
        cols["count"]]], geometry=geom, crs=4326)
    # Opcional: arredondar contagem para "bins" (ajuda na privacidade/desempenho)
    gdf["count_bin"] = pd.cut(gdf[cols["count"]], bins=[0,10,50,100,500,1000,5000,100000], include_lowest=True)
    gdf.to_file(out_path, driver="GeoJSON")
    return len(gdf)

print("\n" + "=" * 70)
print("📊 GERANDO CENÁRIOS DE VISUALIZAÇÃO")
print("=" * 70)

results = []
for sc in scenarios:
    name   = sc["name"]
    flt    = sc.get("filter", {})
    top_n  = int(sc.get("top_n", 1000))
    
    print(f"\n🔍 Cenário: {name}")
    print(f"   Filtros: {flt if flt else 'Nenhum'}")
    print(f"   Top N: {top_n}")
    
    sub = df.copy()
    for k, v in flt.items():
        before = len(sub)
        sub = sub[sub[k] == v]
        print(f"   Aplicando filtro {k}={v}: {before:,} → {len(sub):,} registros")
    
    sub = sub.sort_values(cols["count"], ascending=False).head(top_n)
    out = os.path.join(processed_dir, f"{name}.geojson")
    
    num_lines = make_geojson(sub, out)
    file_size = os.path.getsize(out) / (1024*1024)
    
    print(f"   ✅ Gerado: {out}")
    print(f"   📊 Linhas: {num_lines:,}")
    print(f"   💾 Tamanho: {file_size:.2f} MB")
    
    results.append({
        'name': name,
        'lines': num_lines,
        'size_mb': file_size,
        'file': out
    })

print("\n" + "=" * 70)
print("✅ RESUMO FINAL")
print("=" * 70)
for r in results:
    print(f"\n📁 {r['name']}")
    print(f"   Arquivo: {r['file']}")
    print(f"   Linhas: {r['lines']:,}")
    print(f"   Tamanho: {r['size_mb']:.2f} MB")

print("\n" + "=" * 70)
print("🎉 PIPELINE COMPLETO!")
print("=" * 70)
print("\n✅ Todos os arquivos GeoJSON foram gerados com sucesso!")
print(f"📁 Localização: {os.path.abspath(processed_dir)}")
print("\n🗺️  Agora você pode usar esses arquivos no seu projeto React!")
print("   Importe-os como fontes de dados no mapa MapLibre GL.")

