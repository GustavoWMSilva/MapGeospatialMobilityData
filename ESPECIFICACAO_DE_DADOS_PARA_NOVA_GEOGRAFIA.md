# Especificacao de Dados Para Nova Geografia

## Objetivo

Este documento e a especificacao que pode ser enviada para quem vai gerar novos dados para o projeto.

O objetivo e deixar claro:

- quais arquivos precisam ser gerados;
- quais nomes de colunas devem ser usados;
- quais tipos cada coluna deve ter;
- quais validacoes devem ser feitas antes da entrega.

## Resumo Rapido

Para o sistema conseguir consumir uma nova base, o produtor dos dados deve entregar pelo menos:

1. um arquivo principal de fluxos origem-destino;
2. um arquivo de centroides da geografia base.

Se tambem existir agregacao entre dois niveis geograficos, deve entregar:

3. um arquivo de lookup entre geografia detalhada e geografia agregada;
4. um arquivo de centroides da geografia agregada.

## Arquivo 1: Fluxo Principal

Este e o arquivo obrigatorio.

Formato recomendado:

- `Parquet`

Nome sugerido:

- `NOME_DO_DATASET.parquet`

Schema obrigatorio:

| Coluna        | Tipo    | Obrigatoria | Descricao                        |
| ------------- | ------- | ----------- | -------------------------------- |
| `origin_code` | string  | sim         | identificador da area de origem  |
| `origin_name` | string  | sim         | nome legivel da area de origem   |
| `dest_code`   | string  | sim         | identificador da area de destino |
| `dest_name`   | string  | sim         | nome legivel da area de destino  |
| `count`       | integer | sim         | quantidade de pessoas no fluxo   |

### Regras

- `origin_code` e `dest_code` devem usar o mesmo sistema de identificacao da geografia base.
- `count` deve ser inteiro nao negativo.
- Cada linha representa um fluxo agregado entre uma origem e um destino.
- `origin_name` e `dest_name` devem ser consistentes com os codigos.

### Exemplo real do projeto atual

```csv
origin_code,origin_name,dest_code,dest_name,count
E02000001,City of London 001,-8,Does not apply,2653
E02000001,City of London 001,999999999,Workplace is outside the UK,35
E02000001,City of London 001,E02000001,City of London 001,3871
E02000001,City of London 001,E02000016,Barking and Dagenham 015,2
```

### Tipos observados no projeto atual

```text
origin_code=string
origin_name=string
dest_code=string
dest_name=string
count=int32
```

## Arquivo 2: Centroides da Geografia Base

Este arquivo e obrigatorio para o mapa desenhar pontos e linhas.

Formato recomendado:

- `CSV`

Caminho usado hoje no projeto:

- `public/data/lookup/areas_centroids.csv`

Schema obrigatorio:

| Coluna | Tipo   | Obrigatoria | Descricao              |
| ------ | ------ | ----------- | ---------------------- |
| `code` | string | sim         | identificador da area  |
| `name` | string | sim         | nome legivel da area   |
| `lat`  | number | sim         | latitude do centroide  |
| `lon`  | number | sim         | longitude do centroide |

### Regras

- `code` deve corresponder aos valores usados em `origin_code` e `dest_code`.
- `lat` e `lon` devem estar em WGS84, em graus decimais.
- Cada codigo deve aparecer uma unica vez.

### Exemplo real do projeto atual

```csv
code,name,lat,lon
E02000001,City of London 001,51.5191496645381,-0.0947193383413515
E02000002,Barking and Dagenham 001,51.584148214959,0.134590789218884
E02000003,Barking and Dagenham 002,51.5721474476484,0.139425953910365
E02000004,Barking and Dagenham 003,51.5604546947569,0.177227525339084
```

## Arquivo 3: Lookup Entre Geografia Base e Geografia Agregada

Este arquivo so e necessario se o projeto for trabalhar com dois niveis geograficos.

Exemplo do projeto atual:

- geografia base: `MSOA`
- geografia agregada: `LTLA`

Formato recomendado:

- `CSV`

Caminho usado hoje no projeto:

- `public/data/lookup/ltla_lookup.csv`

Schema usado atualmente:

| Coluna     | Tipo   | Obrigatoria | Descricao                   |
| ---------- | ------ | ----------- | --------------------------- |
| `msoa21cd` | string | sim         | codigo da unidade detalhada |
| `msoa21nm` | string | nao         | nome da unidade detalhada   |
| `ltla22cd` | string | sim         | codigo da unidade agregada  |
| `ltla22nm` | string | nao         | nome da unidade agregada    |

### Regra importante para nova geografia

Se a nova base usar outra hierarquia geografica, o projeto pode continuar usando a mesma ideia, mas o codigo atual ainda esta nomeado para `MSOA -> LTLA`.

Entao, para quem for gerar dados, a orientacao e:

- entregar um lookup com uma coluna de codigo da geografia base;
- entregar uma coluna de codigo da geografia agregada;
- manter tambem os nomes, se possivel.

Se a nova geografia substituir completamente a estrutura atual, depois o codigo do projeto pode ser adaptado para refletir os nomes reais dessa hierarquia.

### Exemplo real do projeto atual

```csv
msoa21cd,msoa21nm,ltla22cd,ltla22nm
S02001237,,S12000033,Aberdeen City
S02001296,,S12000034,Aberdeenshire
S02001236,,S12000033,Aberdeen City
S02001250,,S12000033,Aberdeen City
```

## Arquivo 4: Centroides da Geografia Agregada

Este arquivo so e necessario se houver visualizacao agregada.

Formato recomendado:

- `CSV`

Caminho usado hoje no projeto:

- `public/data/lookup/ltla_centroids.csv`

Schema obrigatorio:

| Coluna | Tipo   | Obrigatoria | Descricao                      |
| ------ | ------ | ----------- | ------------------------------ |
| `code` | string | sim         | identificador da area agregada |
| `name` | string | sim         | nome legivel da area agregada  |
| `lat`  | number | sim         | latitude do centroide          |
| `lon`  | number | sim         | longitude do centroide         |

## Datasets Categoricos Opcionais

Se a nova base incluir recortes analiticos, como sexo, faixa etaria, renda ou setor economico, o recomendado e manter o mesmo padrao:

| Coluna            | Tipo              | Obrigatoria |
| ----------------- | ----------------- | ----------- |
| `origin_code`     | string            | sim         |
| `dest_code`       | string            | sim         |
| `count`           | integer           | sim         |
| `categoria_code`  | string ou integer | sim         |
| `categoria_label` | string            | sim         |

### Exemplo generico

```csv
origin_code,dest_code,sex_code,sex_label,count
X0001,X0002,1,Male,120
X0001,X0002,2,Female,98
X0003,X0004,1,Male,55
```

## Validacoes Que Devem Ser Feitas Antes da Entrega

Quem gerar a base deve validar pelo menos estes pontos:

1. Nao existem colunas com nomes diferentes do especificado para os campos obrigatorios.
2. `origin_code` e `dest_code` estao preenchidos em todas as linhas.
3. `count` e numerico inteiro e maior ou igual a zero.
4. Todos os codigos usados no fluxo existem no arquivo de centroides da geografia base, exceto codigos especiais que forem deliberadamente mantidos.
5. Nao existem coordenadas nulas em `areas_centroids.csv`.
6. Se houver agregacao, todos os codigos da geografia base possuem correspondencia no lookup.
7. Nao existem duplicidades indevidas no arquivo de centroides.

## Tratamento de Codigos Especiais

O dataset atual possui exemplos como:

- `-8`
- `999999999`

Eles representam casos especiais e nem sempre possuem coordenadas validas para mapa.

Recomendacao para nova base:

- se esses registros forem importantes analiticamente, podem ser mantidos no arquivo bruto;
- se o objetivo principal for visualizacao geografica, e melhor separar ou documentar esses casos;
- qualquer codigo especial precisa ser claramente documentado.

## Convencoes Recomendadas

Para reduzir retrabalho na integracao:

- usar `snake_case` nos nomes das colunas;
- usar `string` para todos os codigos geograficos;
- usar `UTF-8`;
- usar ponto como separador decimal;
- evitar nomes de coluna dependentes do ano da geografia, exceto no lookup oficial, quando isso ajudar na rastreabilidade.

## O Que Ja Funciona Sem Mudanca de Codigo

O projeto atual consome diretamente bases que respeitem:

- colunas `origin_code`, `origin_name`, `dest_code`, `dest_name`, `count`;
- centroides com `code`, `name`, `lat`, `lon`.

Ou seja, se a nova base mantiver esse contrato e continuar no mesmo modelo de geografia que o projeto espera, a entrada de dados fica simples.

## O Que Provavelmente Vai Exigir Adaptacao no Codigo

Se a nova base usar outra geografia, estes pontos provavelmente vao precisar de ajuste:

- [src/utils/duckdb.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/duckdb.ts)
- [src/utils/dataService.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/utils/dataService.ts)
- [src/types/index.ts](/c:/Users/gusta/Documents/CriandoTCC/meu-projeto-tailwind/src/types/index.ts)

Motivo:

- hoje o projeto tem regras explicitas para `MSOA` e `LTLA`;
- a deteccao de codigos e os lookups foram implementados com essa hierarquia em mente.

## Entrega Minima

Se for enviar esta especificacao para quem vai produzir a base, o pacote minimo ideal e:

1. `fluxos.parquet`
2. `areas_centroids.csv`
3. `lookup_agregacao.csv` se houver dois niveis
4. `areas_agregadas_centroids.csv` se houver visualizacao agregada
5. um arquivo curto de metadados explicando:
   - o nome da geografia;
   - o significado dos codigos;
   - a unidade de medida de `count`;
   - a existencia de codigos especiais;
   - a cobertura temporal da base.

## Checklist Final Para Producao dos Dados

- O arquivo principal usa exatamente `origin_code`, `origin_name`, `dest_code`, `dest_name`, `count`.
- Os codigos estao como `string`.
- `count` esta como inteiro.
- Existe um centroide para cada unidade geografica mapeavel.
- O sistema de coordenadas esta em latitude e longitude.
- Se houver agregacao, o lookup cobre todas as unidades de origem.
- Casos especiais estao documentados.
