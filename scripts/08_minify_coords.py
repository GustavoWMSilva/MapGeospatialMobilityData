"""
Cria CSVs minificados com apenas código, lat, lon
Reduz de ~450 KB para ~200 KB
"""
import pandas as pd
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

print("🔄 Minificando arquivos de coordenadas...\n")

# 1. MSOA centroids
msoa_input = os.path.join(project_root, "data/lookup/areas_centroids.csv")
msoa_output = os.path.join(project_root, "public/data/lookup/areas_centroids.csv")

print(f"📂 Processando MSOA centroids...")
msoa = pd.read_csv(msoa_input)
print(f"   Original: {len(msoa):,} linhas, {msoa.columns.tolist()}")

# Manter apenas código, lat, lon
msoa_mini = msoa[['code', 'lat', 'lon']]
msoa_mini.to_csv(msoa_output, index=False, float_format='%.6f')

size_original = os.path.getsize(msoa_input) / 1024
size_mini = os.path.getsize(msoa_output) / 1024
print(f"   ✅ Minificado: {len(msoa_mini):,} linhas, {msoa_mini.columns.tolist()}")
print(f"   📊 Tamanho: {size_original:.1f} KB → {size_mini:.1f} KB ({(1-size_mini/size_original)*100:.1f}% menor)")

# 2. LTLA centroids
ltla_input = os.path.join(project_root, "data/lookup/ltla_centroids.csv")
ltla_output = os.path.join(project_root, "public/data/lookup/ltla_centroids.csv")

print(f"\n📂 Processando LTLA centroids...")
ltla = pd.read_csv(ltla_input)
print(f"   Original: {len(ltla):,} linhas, {ltla.columns.tolist()}")

# Manter apenas código, lat, lon
ltla_mini = ltla[['code', 'lat', 'lon']]
ltla_mini.to_csv(ltla_output, index=False, float_format='%.6f')

size_original = os.path.getsize(ltla_input) / 1024
size_mini = os.path.getsize(ltla_output) / 1024
print(f"   ✅ Minificado: {len(ltla_mini):,} linhas, {ltla_mini.columns.tolist()}")
print(f"   📊 Tamanho: {size_original:.1f} KB → {size_mini:.1f} KB ({(1-size_mini/size_original)*100:.1f}% menor)")

# 3. Resumo
print("\n" + "="*60)
print("📊 RESUMO:")

total_original = sum([
    os.path.getsize(msoa_input),
    os.path.getsize(ltla_input)
]) / 1024

total_mini = sum([
    os.path.getsize(msoa_output),
    os.path.getsize(ltla_output)
]) / 1024

print(f"   Total original: {total_original:.1f} KB")
print(f"   Total minificado: {total_mini:.1f} KB")
print(f"   Economia: {(total_original - total_mini):.1f} KB ({(1-total_mini/total_original)*100:.1f}%)")

print("\n✅ Arquivos minificados criados em public/data/lookup/")
print("\n📋 Próximos passos:")
print("   1. git add public/data/lookup/*.csv")
print("   2. git commit -m 'Add minified coordinate CSVs'")
print("   3. git push")
