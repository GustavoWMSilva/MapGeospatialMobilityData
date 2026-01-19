"""
API simples para servir fluxos MSOA sob demanda
Carrega do Parquet e filtra apenas os dados necessários
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import os

app = Flask(__name__)
CORS(app)  # Permite requisições do React

# Carregar dados na inicialização (apenas uma vez)
print("🔄 Carregando dados do Parquet...")
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
parquet_path = os.path.join(project_root, "data/interim/odwp01ew.parquet")
lookup_path = os.path.join(project_root, "data/lookup/areas_centroids.csv")

df = pd.read_parquet(parquet_path)
print(f"✅ Carregado: {len(df):,} fluxos MSOA")

# Carregar centróides
lut = pd.read_csv(lookup_path, dtype={"code":"string"})
lut = lut.rename(columns={"code":"code_area", "name":"area_name"})

# Fazer merge uma vez
df = df.merge(lut.add_prefix("o_"), left_on="origin_code", right_on="o_code_area", how="left")
df = df.merge(lut.add_prefix("d_"), left_on="dest_code", right_on="d_code_area", how="left")
df = df.dropna(subset=["o_lat","o_lon","d_lat","d_lon"])

print(f"✅ Pronto para servir dados!")

@app.route('/api/flows/<area_code>')
def get_flows(area_code):
    """Retorna fluxos MSOA que chegam ou saem de uma área específica"""
    direction = request.args.get('direction', 'incoming')  # incoming ou outgoing
    limit = int(request.args.get('limit', 1000))
    
    print(f"📊 Requisição: {area_code}, direção: {direction}, limit: {limit}")
    
    # Filtrar fluxos MSOA
    if direction == 'incoming':
        filtered = df[df['dest_code'] == area_code]
    else:
        filtered = df[df['origin_code'] == area_code]
    
    # Ordenar por contagem e limitar
    filtered = filtered.sort_values('count', ascending=False).head(limit)
    
    print(f"✅ Encontrados {len(filtered)} fluxos")
    
    # Converter para GeoJSON
    features = []
    for _, row in filtered.iterrows():
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
                    [float(row['o_lon']), float(row['o_lat'])],
                    [float(row['d_lon']), float(row['d_lat'])]
                ]
            }
        })
    
    return jsonify({
        "type": "FeatureCollection",
        "features": features
    })

@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "total_flows": len(df)})

if __name__ == '__main__':
    print("\n🚀 Servidor rodando em http://localhost:5000")
    print("📡 Endpoints disponíveis:")
    print("   - GET /api/flows/<area_code>?direction=incoming&limit=1000")
    print("   - GET /api/health")
    app.run(debug=True, port=5000)
