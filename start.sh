#!/bin/bash

echo "🚀 Iniciando aplicação completa..."
echo ""

# Inicia a API em background
echo "📡 Iniciando API Flask..."
source venv/Scripts/activate
python api/flows_api.py &
API_PID=$!

# Espera a API iniciar
sleep 3

# Inicia o frontend
echo ""
echo "⚛️  Iniciando frontend React..."
npm run dev

# Quando o frontend é encerrado, mata a API também
kill $API_PID
