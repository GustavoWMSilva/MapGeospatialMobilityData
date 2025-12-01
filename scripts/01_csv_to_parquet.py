import pandas as pd
import pyarrow as pa, pyarrow.parquet as pq
import yaml, os

# Obter o diretório do script e ir para a raiz do projeto
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
os.chdir(project_root)

# O config.yaml está na raiz do projeto
cfg = yaml.safe_load(open("config.yaml"))

csv_path = cfg["paths"]["raw_csv"]
parquet_path = cfg["paths"]["parquet"]
os.makedirs(os.path.dirname(parquet_path), exist_ok=True)

# Colunas reais do arquivo CSV
usecols = [
    "Middle layer Super Output Areas code",
    "Middle layer Super Output Areas label",
    "MSOA of workplace code",
    "MSOA of workplace label",
    "Count"
]

df = pd.read_csv(csv_path, usecols=usecols)
print("Primeiras 5 linhas do CSV:")
print(df.head())
print(f"\nTotal de linhas: {len(df)}")

# Renomear colunas para nomes mais simples
df = df.rename(columns={
    "Middle layer Super Output Areas code": "origin_code",
    "Middle layer Super Output Areas label": "origin_name",
    "MSOA of workplace code": "dest_code",
    "MSOA of workplace label": "dest_name",
    "Count": "count"
})

# Tipos
df["count"] = pd.to_numeric(df["count"], errors="coerce").fillna(0).astype("int32")
for c in ["origin_code","origin_name","dest_code","dest_name"]:
    df[c] = df[c].astype("string")

# Salvar em Parquet
table = pa.Table.from_pandas(df)
pq.write_table(table, parquet_path)
print(f"\n✅ Parquet salvo em: {parquet_path}")
print(f"📊 Total de linhas: {len(df)}")
print(f"💾 Tamanho do arquivo: {os.path.getsize(parquet_path) / (1024*1024):.2f} MB")
