# TCC - Atualizações do Projeto e Próximos Passos

## Contexto
Este documento resume as principais modificações no projeto desde aproximadamente **16 de dezembro de 2025** (cerca de 2 meses antes de hoje, 16 de fevereiro de 2026), com base no histórico Git e nas alterações locais atuais.

## Principais modificações desde o relatório anterior

### 1. Migração da arquitetura de dados para DuckDB-WASM (frontend)
Período principal: **19 a 20 de janeiro de 2026**

- Introdução de processamento analítico no navegador com DuckDB-WASM.
- Estratégia híbrida no `dataService`: ambiente local usando API Flask e produção usando DuckDB no cliente.
- Ajustes de origem de dados (local, GitHub Releases e jsDelivr) para contornar problemas de CORS e deploy.

Impacto:
- Redução da dependência de backend para consultas analíticas.
- Melhor base para escalabilidade e redução de custo operacional.

Arquivos/commits relacionados:
- `src/utils/duckdb.ts`
- `src/utils/dataService.ts`
- Commits: `0641490`, `66c8e51`, `fe2ed60`, `50f96fa`, `8757834`

### 2. Agregação dinâmica MSOA -> LTLA
Período principal: **20 de janeiro de 2026**

- Implementada agregação dinâmica de fluxos LTLA a partir de MSOA, removendo dependência rígida de GeoJSON estático.
- Melhora na flexibilidade para consultas por nível geográfico.

Impacto:
- Modelo mais coerente para análises comparativas MSOA/LTLA.
- Menor acoplamento com arquivos pré-agregados fixos.

Arquivos/commits relacionados:
- `src/utils/dataService.ts`
- Commit: `634cfd6`

### 3. Melhorias de deploy e confiabilidade de assets
Período principal: **19 a 22 de janeiro de 2026**

- Várias correções em `.vercelignore` para garantir disponibilidade de CSVs/lookup em produção.
- Inclusão e ajuste de boundaries (limites administrativos) no mapa.

Impacto:
- Menos falhas 401/asset not found em produção.
- Melhor contexto geográfico na visualização.

Arquivos/commits relacionados:
- `.vercelignore`
- `src/components/InteractiveMap.tsx`
- `src/components/CityBoundaries.tsx`
- Commits: `461077d`, `4945a8c`, `65548ed`, `b71bf8f`, `4796a32`

### 4. Cache em IndexedDB para performance de troca de modo
Período principal: **22 de janeiro de 2026**

- Implementação de cache local para reduzir latência ao alternar entre MSOA/LTLA e consultas repetidas.

Impacto:
- Melhor experiência de uso em interações recorrentes.
- Menor custo de recomputação/consulta.

Arquivos/commits relacionados:
- `src/utils/cacheService.ts`
- `src/components/CacheDebugPanel.tsx`
- `CACHE_SYSTEM.md`
- Commit: `2c95000`

### 5. Nova camada analítica demográfica (Census 2021)
Período principal: **8 de fevereiro de 2026**

- Adicionados datasets de **Social Grade (NS-SeC)** e **Age Groups** em Parquet.
- Criação de dashboard analítico com filtros e gráficos dedicados.
- Suporte a direção de fluxo (incoming/outgoing).

Impacto:
- O projeto evolui de visualização de fluxos para análise socioespacial mais rica.
- Geração de hipóteses e comparações por perfil demográfico.

Arquivos/commits relacionados:
- `ODWP04EW_MSOA.parquet`
- `ODWP09EW_MSOA.parquet`
- `src/components/analytics/AnalyticsDashboard.tsx`
- `src/components/analytics/SocialGradePieChart.tsx`
- `src/components/analytics/AgeBarChart.tsx`
- Commit: `067c808`

### 6. Alterações locais atuais (ainda não commitadas)
Data observada: **16 de fevereiro de 2026**

- Integração de filtros demográficos do dashboard diretamente no mapa (`socialGrade`, `ageGroup`).
- Nova função `loadFlowsFiltered()` em `dataService` para carregar fluxos já filtrados.
- Suporte explícito a LTLA nas consultas demográficas (conversão LTLA -> lista de MSOAs no `duckdb.ts`).
- Ajustes de estado no `App.tsx` para sincronizar seleção e nome de área entre MSOA/LTLA.
- Inclusão de componentes auxiliares de diagnóstico/disponibilidade no analytics.

Impacto:
- Alinhamento entre análise visual (mapa) e análise estatística (dashboard).
- Melhor depuração de problemas de dados e direção de fluxo.

Arquivos modificados:
- `src/App.tsx`
- `src/components/FlowFilters.tsx`
- `src/components/FlowsVisualization.tsx`
- `src/components/InteractiveMap.tsx`
- `src/components/analytics/*`
- `src/utils/dataService.ts`
- `src/utils/duckdb.ts`

## Próximos passos recomendados (roadmap prático)

### Prioridade 1 - Fechar estabilidade técnica
- Consolidar as mudanças locais em commits pequenos e temáticos (ex.: filtros demográficos no mapa, LTLA demográfico, debug).
- Reduzir logs de debug em produção e padronizar tratamento de erro no dashboard.
- Validar fluxo completo em `incoming` e `outgoing` para MSOA e LTLA.

### Prioridade 2 - Completar lacunas funcionais
- Implementar filtro combinado **Social Grade + Age** na mesma query (hoje há priorização de Social Grade quando ambos estão ativos no mapa).
- Documentar claramente limites atuais e comportamento esperado quando dados demográficos estão ausentes.

### Prioridade 3 - Evidência experimental para o TCC
- Medir e registrar métricas antes/depois (latência de consulta, tempo de renderização, tempo de troca MSOA/LTLA, uso de cache).
- Executar estudo de caso com 3 a 5 LTLAs e 3 a 5 MSOAs representativas.
- Produzir tabelas e gráficos comparativos para seção de resultados.

### Prioridade 4 - Qualidade e reprodutibilidade
- Adicionar testes mínimos para `dataService` e funções SQL de `duckdb.ts`.
- Criar checklist de deploy e integridade de datasets (arquivos Parquet/CSV obrigatórios e opcionais).
- Garantir instruções de execução end-to-end (dev e produção) atualizadas no README.

### Prioridade 5 - Escrita final do TCC
- Atualizar capítulos de Metodologia e Implementação destacando:
  - Arquitetura cliente-centrada com DuckDB-WASM.
  - Estratégia de agregação dinâmica MSOA -> LTLA.
  - Módulo demográfico e filtros direcionais.
  - Otimizações de performance (cache).
- Incluir seção de limitações atuais e trabalhos futuros (filtro combinado, validação ampliada, avaliação com usuários).

## Estrutura sugerida para virar seção do relatório
1. Linha do tempo de evolução (dez/2025 -> fev/2026)
2. Mudanças arquiteturais
3. Novas funcionalidades analíticas
4. Otimizações de performance
5. Avaliação e resultados preliminares
6. Limitações e trabalhos futuros

## Resumo executivo
Desde o relatório anterior, o projeto avançou de uma visualização de fluxos para uma plataforma analítica mais completa: processa dados com DuckDB-WASM, agrega MSOA/LTLA de forma dinâmica, introduz filtros e gráficos demográficos e já possui base para avaliação experimental sólida no TCC. O próximo foco deve ser fechar estabilidade, produzir métricas comparativas e transformar os resultados técnicos em evidências formais no texto final.
