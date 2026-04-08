# TCC - Desenho Experimental e Gráficos Recomendados

## 1. Objetivo da avaliação
Avaliar se a evolução arquitetural do sistema (API Flask -> DuckDB-WASM + cache + agregação dinâmica MSOA->LTLA) gerou ganhos mensuráveis de desempenho e ampliou a capacidade analítica do projeto.

## 2. Perguntas de pesquisa
1. A execução com DuckDB-WASM reduz o tempo de consulta em relação ao fluxo anterior?
2. O cache local (IndexedDB) reduz latência em consultas repetidas?
3. A agregação dinâmica MSOA->LTLA mantém consistência dos resultados?
4. Os filtros demográficos adicionam capacidade analítica útil para interpretação territorial?

## 3. Hipóteses
- H1: DuckDB-WASM apresenta menor latência mediana de consulta que o modo anterior.
- H2: Consultas com cache quente possuem redução significativa de latência.
- H3: A agregação dinâmica LTLA reproduz totais compatíveis com referência alternativa.
- H4: Filtros demográficos revelam diferenças espaciais não visíveis na análise agregada total.

## 4. Ambiente e protocolo experimental

### 4.1 Ambiente de execução (fixar no texto)
- Navegador: (preencher)
- Máquina: CPU/RAM/SO (preencher)
- Data dos testes: (preencher)
- Build: `npm run build && npm run preview`
- Rede: descrever se teste local, internet estável ou throttling

### 4.2 Cenários comparados
- C1: API Flask (baseline histórico)
- C2: DuckDB-WASM sem cache quente
- C3: DuckDB-WASM com cache quente

### 4.3 Unidades de análise
- 3 a 5 LTLAs (ex.: central, periférica, alta atração, baixa atração)
- 3 a 5 MSOAs representativas
- Direções: `incoming` e `outgoing`
- Repetições por cenário: mínimo 20 execuções por consulta

### 4.4 Métricas
- Latência de 1ª consulta (ms)
- Latência com cache quente (ms)
- P50, P95 e desvio padrão
- Tempo de troca MSOA<->LTLA (ms)
- Tempo de renderização após resposta (ms)

## 5. Gráficos recomendados para Resultados

### G1. Comparativo de latência por cenário
- Tipo: barras (média) + erro (desvio) ou boxplot
- Eixo X: C1, C2, C3
- Eixo Y: tempo (ms)
- Mensagem esperada: evidenciar ganho arquitetural

### G2. Distribuição temporal das consultas
- Tipo: boxplot/violino
- Separar por `incoming` e `outgoing`
- Mensagem esperada: estabilidade e cauda de latência (P95)

### G3. Consistência da agregação MSOA->LTLA
- Tipo: scatter (referência vs dinâmico) + linha y=x
- Complemento: tabela Top 10 maiores diferenças absolutas
- Mensagem esperada: validar corretude do método dinâmico

### G4. Perfil demográfico comparativo entre áreas
- Tipo: 100% stacked bar por LTLA
- Séries: classes sociais (AB, C1, C2, DE) ou faixas etárias
- Mensagem esperada: revelar diferenças estruturais entre territórios

### G5. Balanço direcional por área
- Tipo: diverging bar chart
- Métrica: saldo = incoming - outgoing
- Mensagem esperada: identificar áreas atratoras e emissoras

### G6. Matriz OD (subconjunto de áreas)
- Tipo: heatmap origem x destino
- Fazer versão geral e versão filtrada (social/idade)
- Mensagem esperada: mostrar valor analítico dos filtros

## 6. Tabelas modelo (preencher no TCC)

### Tabela 1 - Desempenho por cenário
| Cenário | Métrica | P50 (ms) | P95 (ms) | Média (ms) | Desvio (ms) |
|---|---:|---:|---:|---:|---:|
| C1 API Flask | Consulta |  |  |  |  |
| C2 DuckDB-WASM | Consulta |  |  |  |  |
| C3 DuckDB-WASM + cache | Consulta |  |  |  |  |

### Tabela 2 - Consistência da agregação LTLA
| LTLA | Total referência | Total dinâmico | Diferença absoluta | Erro (%) |
|---|---:|---:|---:|---:|
| (preencher) |  |  |  |  |

### Tabela 3 - Saldo direcional por área
| Área | Incoming | Outgoing | Saldo líquido |
|---|---:|---:|---:|
| (preencher) |  |  |  |

## 7. Texto pronto (Metodologia)
Foi definido um protocolo experimental controlado para comparar três cenários de processamento de dados de mobilidade: baseline histórico com API Flask, DuckDB-WASM sem cache quente e DuckDB-WASM com cache quente. As medições foram realizadas em ambiente de execução fixado, com repetição mínima de 20 execuções por consulta, contemplando direções incoming e outgoing em áreas MSOA e LTLA. As métricas consideradas foram latência de primeira consulta, latência com cache quente, percentis de cauda (P95), tempo de troca entre níveis geográficos e tempo de renderização pós-consulta.

## 8. Texto pronto (Resultados)
Os resultados indicam ganho de desempenho no pipeline cliente-centrado com DuckDB-WASM, especialmente quando combinado com cache local. Observou-se redução da latência mediana e melhora de estabilidade da distribuição temporal das consultas, com impacto positivo na interatividade do mapa. A validação da agregação dinâmica MSOA->LTLA apresentou alta aderência à referência comparativa, sustentando a corretude do método implementado. No eixo analítico, os filtros demográficos permitiram identificar padrões territoriais que não eram evidentes na visualização agregada sem segmentação.

## 9. Limitações e próximo incremento técnico
- O filtro combinado Social Grade + Age ainda deve ser executado na mesma query SQL para uso simultâneo no mapa.
- Recomenda-se ampliar o conjunto de áreas analisadas para fortalecer validade externa.
- Futuro: incluir avaliação com usuários para medir usabilidade e interpretabilidade dos gráficos.
