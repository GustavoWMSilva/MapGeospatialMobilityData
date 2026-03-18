# Como Adicionar Novos Dados ao Modelo

## Objetivo

Este guia documenta como outra pessoa da area, com conhecimento basico de programacao, pode:

- atualizar os dados atuais;
- adicionar novos arquivos com o mesmo formato;
- incluir uma nova dimensao analitica, como sexo, renda ou setor economico.

A ideia central do projeto e simples: o frontend nao le CSV bruto direto. Ele trabalha sobre um pequeno conjunto de contratos de dados bem definidos.

Se a necessidade for passar uma especificacao fechada para quem vai produzir uma nova base, consulte tambem [ESPECIFICACAO_DE_DADOS_PARA_NOVA_GEOGRAFIA.md](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/ESPECIFICACAO_DE_DADOS_PARA_NOVA_GEOGRAFIA.md).

## Visao Geral da Arquitetura

Hoje o projeto consome tres camadas de dados:

1. **Fluxo base OD**
   Arquivo principal com origem, destino e quantidade de pessoas.

2. **Arquivos de lookup geografico**
   Arquivos auxiliares com centroides e relacao MSOA -> LTLA.

3. **Datasets opcionais por categoria**
   Arquivos com o mesmo par origem-destino, mas quebrados por algum atributo demografico.

Na pratica, isso significa que a forma mais facil de adicionar novos dados e manter o mesmo padrao de chaves:

- `origin_code`
- `dest_code`
- `count`

Se os novos dados mantiverem essas chaves, a extensao do sistema fica simples.

## O Contrato Minimo dos Dados

### 1. Dataset principal de fluxos

O caminho mais seguro e seguir o mesmo schema usado hoje no projeto:

| Coluna | Tipo esperado | Funcao |
| --- | --- | --- |
| `origin_code` | texto | codigo da area de origem |
| `origin_name` | texto | nome da area de origem |
| `dest_code` | texto | codigo da area de destino |
| `dest_name` | texto | nome da area de destino |
| `count` | inteiro | quantidade de pessoas |

Observacao:

- Para o frontend em producao, o essencial e `origin_code`, `dest_code` e `count`.
- Para scripts e API local, manter tambem `origin_name` e `dest_name` evita retrabalho.

### 2. Arquivo de centroides MSOA

Arquivo usado pelo mapa para desenhar linhas:

`public/data/lookup/areas_centroids.csv`

Schema esperado:

| Coluna | Tipo esperado |
| --- | --- |
| `code` | texto |
| `name` | texto |
| `lat` | numero |
| `lon` | numero |

### 3. Arquivo de lookup MSOA -> LTLA

Arquivo usado para agregacao automatica no nivel LTLA:

`public/data/lookup/ltla_lookup.csv`

Schema seguro:

| Coluna | Tipo esperado |
| --- | --- |
| `msoa21cd` | texto |
| `msoa21nm` | texto |
| `ltla22cd` | texto |
| `ltla22nm` | texto |

### 4. Arquivo de centroides LTLA

`public/data/lookup/ltla_centroids.csv`

Schema esperado:

| Coluna | Tipo esperado |
| --- | --- |
| `code` | texto |
| `name` | texto |
| `lat` | numero |
| `lon` | numero |

## Onde o Projeto Le Esses Dados

Os pontos centrais de extensao sao estes:

- [src/utils/dataService.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/dataService.ts): escolhe a fonte de dados e transforma resultados em GeoJSON.
- [src/utils/duckdb.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/duckdb.ts): registra os arquivos Parquet e executa as consultas.
- [src/types/index.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/types/index.ts): define os tipos de dados usados na aplicacao.
- [src/components/FlowsVisualization.tsx](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/components/FlowsVisualization.tsx): renderiza os fluxos no mapa.

Essa separacao ajuda no TCC porque mostra que a logica de negocio ficou concentrada em poucos pontos.

## Caso 1: Atualizar os Dados Atuais Sem Mudar o Codigo

Este e o caso mais simples.

Se a nova base continuar usando as mesmas colunas:

- `origin_code`
- `origin_name`
- `dest_code`
- `dest_name`
- `count`

entao basta substituir o arquivo fonte e regenerar os artefatos.

### Passo a passo

1. Colocar o CSV bruto em `data/raw/`.
2. Ajustar o caminho em [config.yaml](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/config.yaml), se necessario.
3. Executar o script [scripts/01_csv_to_parquet.py](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/scripts/01_csv_to_parquet.py).
4. Se a geografia mudou, regenerar centroides e lookups.
5. Publicar o novo Parquet em `public/data/processed/` ou no repositorio/CDN usado em producao.

### Quando isso funciona sem alterar o app

Funciona diretamente quando:

- os codigos continuam no mesmo padrao geografico;
- existe correspondencia entre os codigos dos fluxos e os arquivos de centroides;
- a medida principal continua sendo `count`.

## Caso 2: Adicionar Um Novo Dataset Categorizado

Este e o caso ideal para extensao do projeto por terceiros.

Hoje o sistema ja faz isso com:

- `ODWP09EW_MSOA.parquet` para social grade;
- `ODWP04EW_MSOA.parquet` para age.

O mesmo padrao pode ser repetido para qualquer outra categoria.

### Exemplo de novo dataset

Suponha um arquivo de sexo:

| Coluna | Tipo esperado |
| --- | --- |
| `origin_code` | texto |
| `dest_code` | texto |
| `sex_code` | inteiro ou texto |
| `sex_label` | texto |
| `count` | inteiro |

### O que precisa ser feito

1. **Criar o novo Parquet**

   O arquivo deve manter `origin_code`, `dest_code` e `count`.

2. **Registrar o arquivo em DuckDB**

   Em [src/utils/duckdb.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/duckdb.ts), incluir o novo nome em `DATASETS` e carregar a tabela como dataset opcional, do mesmo jeito que hoje acontece com social grade e age.

3. **Criar um tipo novo**

   Em [src/types/index.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/types/index.ts), adicionar a interface correspondente.

4. **Criar a funcao de consulta**

   Ainda em [src/utils/duckdb.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/duckdb.ts), criar uma funcao no padrao:

   - `getMSOAFlowsBySex(...)`

5. **Conectar ao servico de dados**

   Em [src/utils/dataService.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/dataService.ts), adicionar o caminho que transforma o resultado em GeoJSON.

6. **Expor no frontend**

   Se a ideia for permitir filtro pelo usuario, criar o controle na interface.
   Se a ideia for apenas usar o dataset em um grafico novo, basta chamar a funcao diretamente no componente analitico.

### Regra pratica

Se o novo dado respeita a estrutura:

- origem;
- destino;
- categoria;
- quantidade;

entao a extensao e pequena e localizada.

## Caso 3: Adicionar Dados em Outra Geografia

Este e o caso que exige mais cuidado.

O sistema atual foi desenhado para trabalhar principalmente com:

- MSOA;
- LTLA.

Se alguem quiser adicionar outra geografia, como LSOA ou regioes administrativas diferentes, sera preciso revisar:

- arquivos de centroides;
- lookup entre niveis geograficos;
- deteccao de tipo de codigo;
- agregacoes em [src/utils/dataService.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/dataService.ts) e [src/utils/duckdb.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/duckdb.ts).

Para o TCC, a mensagem correta e:

- **adicionar novos dados na mesma geografia e facil**;
- **adicionar uma geografia nova e possivel, mas demanda mais adaptacao estrutural**.

## Fluxo Recomendado Para Outra Pessoa Reutilizar o Projeto

Se o objetivo for facilitar manutencao por terceiros, o fluxo recomendado e este:

1. Preparar o CSV com colunas padronizadas.
2. Converter para Parquet.
3. Garantir que os codigos existam nos arquivos de centroides e lookup.
4. Publicar o novo arquivo de dados.
5. Se houver nova categoria analitica, adicionar uma funcao nova em `duckdb.ts` e ligar ao frontend.

## Por Que Isso E Facil de Manter

Do ponto de vista de engenharia, o projeto ja tem algumas caracteristicas que facilitam extensao:

- o formato principal dos fluxos e pequeno e previsivel;
- a transformacao para GeoJSON esta centralizada;
- os datasets opcionais seguem o mesmo desenho do dataset principal;
- a agregacao LTLA depende de lookup separado, sem misturar regra geografica com visualizacao;
- a visualizacao do mapa trabalha sobre um formato unico de feature.

Em outras palavras: quem quiser adicionar dados novos nao precisa reescrever o mapa. Normalmente precisa apenas preparar o arquivo e, em casos analiticos novos, adicionar uma consulta nova.

## Limites Atuais Que Vale Citar No TCC

Para a documentacao ficar honesta, vale registrar estes limites:

- o projeto assume chaves geograficas compativeis com MSOA/LTLA;
- a agregacao automatica depende da qualidade do `ltla_lookup.csv`;
- novos datasets categoricos sao faceis de adicionar, mas precisam manter o par origem-destino;
- a interface atual ja esta pronta para `social grade` e `age`; outras categorias exigem um controle novo no frontend.

## Checklist Rapido

Se a pessoa quiser adicionar um novo dado com o menor esforco possivel, ela deve verificar:

- O arquivo tem `origin_code`, `dest_code` e `count`?
- Os codigos existem em `areas_centroids.csv`?
- Se houver LTLA, os codigos estao cobertos em `ltla_lookup.csv` e `ltla_centroids.csv`?
- O novo dado segue a mesma geografia dos dados atuais?
- Se houver uma nova categoria, existe uma funcao de consulta correspondente em `duckdb.ts`?

## Sugestao de Texto Para o TCC

Voce pode descrever assim:

> O modelo foi estruturado para facilitar extensoes por outros desenvolvedores. A aplicacao depende de um contrato de dados simples, baseado em pares origem-destino e uma medida agregada de fluxo. Quando um novo dataset preserva essas chaves, sua incorporacao exige apenas a conversao para Parquet e o registro do arquivo no modulo central de acesso a dados. Categorias analiticas adicionais, como idade ou perfil socioeconomico, seguem o mesmo padrao e demandam alteracoes localizadas, sem necessidade de reestruturar a visualizacao do mapa.

## Arquivos Mais Importantes Para Quem Vai Estender

- [config.yaml](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/config.yaml)
- [scripts/01_csv_to_parquet.py](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/scripts/01_csv_to_parquet.py)
- [scripts/02_build_centroids.py](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/scripts/02_build_centroids.py)
- [src/utils/dataService.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/dataService.ts)
- [src/utils/duckdb.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/duckdb.ts)
- [src/types/index.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/types/index.ts)
