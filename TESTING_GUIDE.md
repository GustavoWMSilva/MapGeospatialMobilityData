# Guia de Testes - DuckDB-WASM

## 🧪 Teste 1: Componente de Teste Visual

### Iniciar o servidor:

```bash
npm run dev
```

### O que você verá:

1. **Canto inferior direito:** Painel "🦆 DuckDB-WASM Test"

2. **Passos:**
   - Clique em "Inicializar"
   - Aguarde (pode demorar 5-10s na primeira vez)
   - Status muda para "Pronto" ✅
   - Clique em "Testar Query"
   - Veja 3 flows de exemplo

### Console logs esperados:

```
🚀 Inicializando DuckDB-WASM...
✅ DuckDB-WASM inicializado!
🔍 Carregando 10 flows incoming para E02000001...
✅ Carregados 10 flows
```

---

## 🧪 Teste 2: Verificar Fonte de Dados

Abra o **Console do navegador** (F12) e observe:

### **Localhost (Desenvolvimento):**

```
📡 Carregando da API: http://localhost:5000/...
```

→ Usa Flask API

### **Produção (após build):**

```
🦆 Carregando com DuckDB-WASM...
```

→ Usa GitHub Releases

---

## 🧪 Teste 3: Fluxos no Mapa

1. Selecione uma área MSOA ou LTLA

2. Observe os logs no console:

```
🎯 FlowsVisualization useEffect disparado...
🔄 Carregando flows para E02000001 (msoa)...
✅ Fluxos carregados: 250
```

3. Linhas devem aparecer no mapa

---

## 🧪 Teste 4: Performance

### Medir tempo de carregamento:

**Console:**

```javascript
console.time("load");
// Selecione uma área
console.timeEnd("load");
```

**Esperado:**

- **Localhost + API:** ~100-200ms
- **Produção + DuckDB:** ~200-500ms (primeira vez), ~50ms (cache)

---

## 🧪 Teste 5: GitHub Releases (após upload)

### 1. Fazer upload do Parquet:

- Siga `GITHUB_RELEASES_SETUP.md`
- Tag: `v1.0.0-data`
- Arquivo: `ODWP01EW_MSOA.parquet`

### 2. Testar URL:

```javascript
fetch(
  "https://github.com/GustavoWMSilva/MapGeospatialMobilityData/releases/download/v1.0.0-data/ODWP01EW_MSOA.parquet"
).then((r) => console.log("✅ Parquet acessível!", r.status));
```

### 3. Build de produção:

```bash
npm run build
npm run preview
```

Abra: http://localhost:4173

Deve carregar do GitHub Releases! 🌐

---

## 🧪 Teste 6: Network Tab

Abra **DevTools → Network**

### Localhost:

- Verá: `XHR` para `http://localhost:5000/api/flows/...`

### Produção:

- Verá: `parquet` para `github.com/.../ODWP01EW_MSOA.parquet`
- Tamanho: ~7.5 MB
- Tempo: ~2-5s (primeira vez)
- Cache: 🟢 (próximas vezes)

---

## 🔍 Troubleshooting

### ❌ Erro: "Cannot read parquet"

**Solução:** Arquivo não foi feito upload corretamente

- Verifique a URL do GitHub Releases
- Confirme que a release foi publicada

### ❌ Erro: "CORS policy"

**Solução:** GitHub Releases permite CORS automaticamente

- Limpe o cache do navegador
- Tente em modo anônimo

### ❌ Erro: "DuckDB not initialized"

**Solução:**

- Aguarde alguns segundos
- Clique em "Inicializar" novamente

### ❌ Nenhum fluxo aparece

**Solução:**

- Verifique console para erros
- Confirme que `areas_centroids.csv` está em `/public/data/lookup/`
- Verifique se o código da área existe nos dados

---

## ✅ Checklist de Validação

- [ ] Componente DuckDBTest aparece no canto inferior direito
- [ ] Botão "Inicializar" funciona
- [ ] Botão "Testar Query" retorna dados
- [ ] Console mostra logs de DuckDB
- [ ] Fluxos aparecem no mapa ao selecionar área
- [ ] Localhost usa API Flask
- [ ] Build de produção usa DuckDB-WASM
- [ ] GitHub Releases URL acessível
- [ ] Performance aceitável (<1s)

---

## 📊 Comparação Esperada

| Métrica             | API Flask | DuckDB-WASM         |
| ------------------- | --------- | ------------------- |
| **Primeira carga**  | ~200ms    | ~3s (baixa Parquet) |
| **Próximas cargas** | ~200ms    | ~50ms (cache)       |
| **Memória**         | ~0        | ~100MB              |
| **Offline**         | ❌        | ✅ (após cache)     |

---

## 🎯 Próximo Passo

Após confirmar que tudo funciona:

1. **Remover componente de teste:**

   - Deletar `<DuckDBTest />` de `App.tsx`

2. **Fazer deploy:**

   ```bash
   npm run build
   vercel --prod
   ```

3. **Celebrar!** 🎉
   - 100% gratuito
   - Escalável infinitamente
   - Sem servidor para manter
