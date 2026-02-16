# 🚀 Início Rápido

## Para testar AGORA (localhost):

```bash
# Terminal 1: API Flask (opcional - só se quiser testar MSOA)
python api/flows_api_duckdb.py

# Terminal 2: Frontend
npm run dev
```

Abra: http://localhost:5173

**O que testar:**

1. Painel "🦆 DuckDB-WASM Test" (canto inferior direito)
2. Clique "Inicializar" → "Testar Query"
3. Selecione uma área no mapa
4. Veja os fluxos aparecerem

---

## Para produção (GitHub Releases):

### 1. Upload do Parquet:

1. Acesse: https://github.com/GustavoWMSilva/MapGeospatialMobilityData/releases/new

2. Configure:

   - Tag: `v1.0.0-data`
   - Title: `Data Files`

3. Arraste: `ODWP01EW_MSOA.parquet` (7.5 MB, está na raiz do projeto)

4. Publique

### 2. Testar localmente:

```bash
npm run build
npm run preview
```

Abra: http://localhost:4173

Deve carregar do GitHub! 🌐

### 3. Deploy final:

```bash
vercel --prod
```

✅ **100% gratuito, infinitamente escalável!**

---

## 📚 Documentação Completa:

- `TESTING_GUIDE.md` - Todos os testes
- `GITHUB_RELEASES_SETUP.md` - Passo a passo do upload
- `IMPLEMENTATION_COMPLETE.md` - Resumo completo
- `DUCKDB_OPTIMIZATION.md` - Performance

---

## ❓ Problemas?

**Erro ao inicializar DuckDB:**

- Aguarde 10 segundos
- Tente novamente

**Nenhum fluxo no mapa:**

- Verifique console (F12)
- Confirme que selecionou uma área

**API não responde:**

- Inicie: `python api/flows_api_duckdb.py`
- Porta 5000 deve estar livre

---

## 🎯 Status Atual:

✅ DuckDB-WASM instalado  
✅ Serviço de dados criado  
✅ FlowsVisualization integrado  
✅ Componente de teste adicionado  
✅ Coordenadas em /public  
✅ Parquet preparado

⏳ **Aguardando:** Upload no GitHub Releases

Depois do upload: **Tudo funcionando!** 🎉
