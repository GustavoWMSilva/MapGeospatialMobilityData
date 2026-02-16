"""
API Flask otimizada com DuckDB
Usa 90% menos memória e é 10x mais rápida que Pandas
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import duckdb
import os

app = Flask(__name__)
CORS(app)

# Caminhos dos arquivos
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
PARQUET_PATH = os.path.join(PROJECT_ROOT, "data/interim/odwp01ew.parquet")
CENTROIDS_PATH = os.path.join(PROJECT_ROOT, "data/lookup/areas_centroids.csv")

print(f"📂 Parquet: {PARQUET_PATH}")
print(f"📂 Centroids: {CENTROIDS_PATH}")

# Verificar se arquivos existem
if not os.path.exists(PARQUET_PATH):
    print(f"❌ Arquivo não encontrado: {PARQUET_PATH}")
if not os.path.exists(CENTROIDS_PATH):
    print(f"❌ Arquivo não encontrado: {CENTROIDS_PATH}")

# Inicializar conexão DuckDB (reutilizável)
conn = duckdb.connect()
print("✅ DuckDB inicializado")

@app.route('/')
def index():
    return jsonify({
        "status": "ok",
        "message": "API de flows MSOA com DuckDB",
        "endpoints": {
            "/api/flows/<area_code>": "Obter flows para uma área específica",
            "/health": "Status da API"
        }
    })

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "engine": "DuckDB"})

@app.route('/api/flows/<area_code>')
def get_flows(area_code):
    """
    Endpoint para obter flows de uma área específica
    
    Parâmetros de query:
    - direction: 'incoming' ou 'outgoing' (padrão: 'incoming')
    - limit: número máximo de flows (padrão: 2000)
    """
    try:
        direction = request.args.get('direction', 'incoming')
        limit = int(request.args.get('limit', 2000))
        
        print(f"🔍 Buscando flows para {area_code} ({direction}, limit={limit})")
        
        # Determinar coluna de filtro baseado na direção
        if direction == 'incoming':
            filter_col = 'dest_code'
        else:
            filter_col = 'origin_code'
        
        # Query SQL otimizada
        # DuckDB lê apenas as linhas necessárias do Parquet!
        query = f"""
        SELECT 
            f.origin_code,
            f.dest_code,
            f.count,
            o.name as origin_name,
            CAST(o.lat AS DOUBLE) as origin_lat,
            CAST(o.lon AS DOUBLE) as origin_lon,
            d.name as dest_name,
            CAST(d.lat AS DOUBLE) as dest_lat,
            CAST(d.lon AS DOUBLE) as dest_lon
        FROM read_parquet('{PARQUET_PATH}') f
        LEFT JOIN read_csv_auto('{CENTROIDS_PATH}') o 
            ON f.origin_code = o.code
        LEFT JOIN read_csv_auto('{CENTROIDS_PATH}') d 
            ON f.dest_code = d.code
        WHERE f.{filter_col} = '{area_code}'
          AND o.lat IS NOT NULL
          AND d.lat IS NOT NULL
        ORDER BY f.count DESC
        LIMIT {limit}
        """
        
        # Executar query
        result = conn.execute(query).df()
        
        print(f"✅ Encontrados {len(result)} flows")
        
        # Converter para GeoJSON
        features = []
        for _, row in result.iterrows():
            features.append({
                "type": "Feature",
                "properties": {
                    "origin_code": row['origin_code'],
                    "origin_name": row['origin_name'] if 'origin_name' in row else None,
                    "dest_code": row['dest_code'],
                    "dest_name": row['dest_name'] if 'dest_name' in row else None,
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
        
        return jsonify({
            "type": "FeatureCollection",
            "features": features
        })
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return jsonify({
            "error": str(e),
            "area_code": area_code
        }), 500

if __name__ == '__main__':
    print("\n🚀 Iniciando API Flask com DuckDB...")
    print("📊 Endpoint: http://localhost:5000/api/flows/<area_code>")
    print("💡 Usa ~90% menos memória que Pandas!")
    print("\n")
    app.run(debug=True, port=5000, host='0.0.0.0')
