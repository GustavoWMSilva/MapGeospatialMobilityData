"""
Script para verificar códigos mais usados e sugerir filtros interessantes
"""
import pandas as pd
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
os.chdir(project_root)

print("🔍 Analisando dados para sugerir filtros interessantes...\n")

df = pd.read_parquet("data/interim/odwp01ew.parquet")

# Top origens por volume total
print("📊 Top 10 ORIGENS com mais deslocamentos:")
top_origins = df.groupby(['origin_code', 'origin_name'])['count'].sum().sort_values(ascending=False).head(10)
for (code, name), count in top_origins.items():
    print(f"   {code} - {name}: {count:,} pessoas")

print("\n📊 Top 10 DESTINOS com mais deslocamentos:")
top_dests = df.groupby(['dest_code', 'dest_name'])['count'].sum().sort_values(ascending=False).head(10)
for (code, name), count in top_dests.items():
    print(f"   {code} - {name}: {count:,} pessoas")

print("\n💡 Sugestões de cenários para o config.yaml:")
print("\n" + "="*70)

# Pegar o código da área com mais origem
top_origin_code = top_origins.index[0][0]
top_origin_name = top_origins.index[0][1]

# Pegar o código da área com mais destino
top_dest_code = top_dests.index[0][0]
top_dest_name = top_dests.index[0][1]

print(f"""
  scenarios:
    - name: "top1000-geral"
      filter: {{}}
      top_n: 1000
    
    - name: "{top_origin_name.lower().replace(' ', '-')}-outflows-top500"
      filter: {{ origin_code: "{top_origin_code}" }}
      top_n: 500
    
    - name: "{top_dest_name.lower().replace(' ', '-')}-inflows-top500"
      filter: {{ dest_code: "{top_dest_code}" }}
      top_n: 500
""")
print("="*70)
