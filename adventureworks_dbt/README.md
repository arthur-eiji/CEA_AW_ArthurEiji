# Projeto dbt — Data Warehouse de Vendas da Adventure Works

Transforma os dados brutos do ERP (schema `fea_academy.adventure_works` no Databricks) em
um modelo dimensional de vendas, testado e documentado, e nas tabelas de consumo usadas
pelo painel de BI.

Stack: **Databricks** (data warehouse) e **dbt Core** com o adapter `dbt-databricks`.
A visão geral do projeto e as respostas às perguntas de negócio estão no
[README da raiz](../README.md).

---

## 1. Camadas

```
  adventure_works (dados brutos)
          │
          ▼
  models/staging/adventure_works/     14 views, uma por tabela-fonte, sem joins
          │                           nomes em snake_case, tipos fixados, defeitos corrigidos
          ▼
  models/marts/sales/                 modelo dimensional (tabelas)
          ├── fct_sales                   grão: item de pedido
          ├── dim_product, dim_customer, dim_credit_card, dim_order_status,
          │   dim_geography, dim_date, dim_sales_reason
          ├── br_order_sales_reason       ponte N:N entre pedido e motivo de venda
          ├── rpt_sales                   tabela larga para o BI (mesmo grão da fato)
          └── rpt_sales_by_reason         grão item × motivo, para análises por motivo
```

### Modelo dimensional

| Tabela | Grão | Fontes (nome físico em `adventure_works`) |
|---|---|---|
| **`fct_sales`** | item de pedido | `sales_salesorderdetail`, `sales_salesorderheader` |
| `dim_product` | produto | `production_product`, `production_productsubcategory`, `production_productcategory` |
| `dim_customer` | cliente | `sales_customer`, `person_person`, `sales_store` |
| `dim_credit_card` | cartão | `sales_creditcard` |
| `dim_order_status` | status do pedido | derivada de `sales_salesorderheader.status` |
| `dim_geography` | endereço de entrega | `person_address`, `person_stateprovince`, `person_countryregion` |
| `dim_date` | dia | gerada com `dbt_utils.date_spine` |
| `dim_sales_reason` | motivo de venda | `sales_salesreason` |
| `br_order_sales_reason` | pedido × motivo | `sales_salesorderheadersalesreason` |

**Medidas da fato:** `order_qty` (quantidade comprada), `gross_amount` (valor total
negociado, `unit_price × order_qty`), `discount_amount` e `net_amount` (valor líquido,
`gross_amount − discount_amount`). O número de pedidos é `count(distinct sales_order_id)`,
uma medida não aditiva calculada na consulta. O ticket médio é
`sum(net_amount) ÷ count(distinct sales_order_id)`.

**Motivo de venda é N:N com o pedido.** Um pedido pode ter vários motivos e muitos não têm
nenhum. Por isso o motivo não entra na fato, o que repetiria itens e inflaria as medidas;
ele fica na ponte `br_order_sales_reason`, usada apenas para filtrar ou agrupar por motivo.

### Correções feitas na staging

A ingestão não preserva os tipos do ERP e traz alguns defeitos. Tudo é tratado na staging,
para que os marts não precisem conhecer as particularidades da origem:

| Defeito na origem | Tratamento | Onde |
|---|---|---|
| Código `NA` da Namíbia chega nulo | código restaurado a partir do nome do país | `stg_adventure_works__country_region` |
| `Television  Advertisement` gravado com dois espaços | espaços repetidos removidos do nome do motivo | `stg_adventure_works__sales_reason` |
| Inteiros com nulos chegam como `double` (`5.0`) | chaves convertidas para `bigint` | modelos de pedido, cliente, produto e cartão |
| Datas chegam como texto | convertidas para `date` | `stg_adventure_works__sales_order_header` |
| `productline` com espaço à direita | `trim` | `stg_adventure_works__product` |
| Coluna `linetotal` não existe na base ingerida | valor líquido recalculado na fato (`net_amount`) | `fct_sales` |

Os dois primeiros defeitos também são registrados por testes de source em nível de aviso
(`WARN`), para que fiquem visíveis a cada execução.

### Documentação

Todas as tabelas e colunas estão descritas nos arquivos YAML:

- `models/staging/adventure_works/_adventure_works__sources.yml`: tabelas-fonte e colunas usadas;
- `models/staging/adventure_works/_adventure_works__models.yml`: modelos de staging;
- `models/marts/sales/_sales__models.yml`: fato, dimensões, ponte e tabelas de consumo, com
  o significado de negócio, a origem e a regra de cálculo de cada coluna.

Para navegar pela documentação e pela linhagem: `dbt docs generate` e `dbt docs serve`.

---

## 2. Como rodar

### 2.1. Pré-requisitos

- Workspace **Databricks** com um SQL Warehouse. O projeto foi desenvolvido no
  [Databricks Free Edition](https://www.databricks.com/learn/free-edition).
- Dados do AdventureWorks ingeridos no schema `adventure_works`, conforme o repositório de
  datasources da Indicium: <https://bitbucket.org/indiciumtech/databricks-datasources/src/main/>.
  A ingestão cria 68 tabelas em `fea_academy.adventure_works`, com o nome prefixado pelo
  schema de origem (por exemplo `sales_salesorderheader`). O mapeamento entre o nome lógico
  usado nos modelos e o nome físico está nos `identifier` do arquivo de sources.
- Python 3.9 ou superior e o adapter do dbt:

```bash
pip install dbt-databricks
```

### 2.2. Conexão

Copie `profiles.example.yml` para `~/.dbt/profiles.yml` e preencha `host` e `http_path`
(em SQL Warehouses → Connection details). O `catalog` é `fea_academy`; o `schema` de
destino, por exemplo `dbt_arthur`, é criado pelo dbt.

O modelo usa autenticação OAuth (`auth_type: oauth`): na primeira execução o navegador
abre para o login, sem token gravado em arquivo. Para usar um token de acesso pessoal,
troque por `token: "{{ env_var('DBT_DATABRICKS_TOKEN') }}"` e exporte a variável de
ambiente.

### 2.3. Construir e testar

```bash
dbt deps                        # instala o pacote dbt_utils
dbt debug                       # confere a conexão
dbt run                         # constrói as 14 views de staging e as 11 tabelas dos marts
dbt test --select "source:*"    # 47 testes nos dados brutos
dbt test                        # todos os 117 testes
```

Resultado esperado de `dbt test`: `PASS=115 WARN=2 ERROR=0`. Os dois avisos são os
defeitos da origem descritos acima.

---

## 3. Testes

| O que é garantido | Tipo de teste | Onde |
|---|---|---|
| Chaves dos dados brutos não nulas e únicas; pedidos, itens e produtos relacionados; status entre 1 e 6 | `not_null`, `unique`, `relationships`, `accepted_values` | `_adventure_works__sources.yml` |
| Defeitos conhecidos da origem ficam registrados | `not_null` e `expression_is_true` com severidade `warn` | `_adventure_works__sources.yml` |
| Chave primária de cada dimensão e da fato | `unique` e `not_null` | `_sales__models.yml` |
| Toda chave estrangeira da fato e da ponte encontra a sua dimensão | `relationships` | `_sales__models.yml` |
| Domínios: tipo de cliente, nome e tipo do motivo de venda | `accepted_values` | `_sales__models.yml` |
| Quantidade e valor bruto nunca negativos; grãos compostos sem duplicidade | `dbt_utils.expression_is_true`, `dbt_utils.unique_combination_of_columns` | `_sales__models.yml` |
| **Vendas brutas de 2011 = US$ 12.646.112,16**, o valor confirmado pela auditoria | teste de dado singular | `tests/assert_gross_sales_2011.sql` |
| A tabela larga do BI tem as mesmas linhas e o mesmo total da fato (sem fan-out) | teste de dado singular | `tests/assert_rpt_sales_no_fanout.sql` |
| O motivo `On Promotion`, usado na pergunta 4f, existe e tem vendas | teste de dado singular | `tests/assert_on_promotion_reason_has_sales.sql` |

O valor auditado de 2011 é um parâmetro do projeto (`gross_sales_2011_expected` em
`dbt_project.yml`).

---

## 4. SQL de apoio das perguntas de negócio

As consultas da pasta `analyses/` respondem às perguntas de negócio a partir das tabelas de
consumo. Cada uma pode ser executada direto pelo dbt:

| Pergunta | Consulta | Execução |
|---|---|---|
| **4a** Pedidos, quantidade e valor por produto, tipo de cartão, motivo de venda, data, cliente, status, cidade, estado e país | `q4a_metricas_por_dimensao.sql` | `dbt show --select q4a_metricas_por_dimensao --limit 100000` |
| **4b** Produtos com maior ticket médio por mês, ano, cidade, estado e país | `q4b_ticket_medio.sql` | `dbt show --select q4b_ticket_medio --limit 50` |
| **4c** 10 melhores clientes por valor negociado | `q4c_top10_clientes.sql` | `dbt show --select q4c_top10_clientes --limit 10` |
| **4d** 5 melhores cidades por valor negociado | `q4d_top5_cidades.sql` | `dbt show --select q4d_top5_cidades --limit 5` |
| **4e** Pedidos, quantidade e valor por mês e ano | `q4e_serie_temporal.sql` | `dbt show --select q4e_serie_temporal --limit 50` |
| **4f** Produto com mais unidades compradas no motivo "Promotion" | `q4f_produto_on_promotion.sql` | `dbt show --select q4f_produto_on_promotion --limit 10` |

**Pergunta 4f e o motivo `On Promotion`.** A pergunta fala em motivo "Promotion", mas no ERP
o motivo se chama `On Promotion`; `Promotion` é o valor de `reason_type` desse motivo, o
único do grupo. A consulta, o painel e a documentação usam o mesmo filtro:

```sql
where sales_reason_name = 'On Promotion'
```

Resposta: **Water Bottle - 30 oz., com 546 unidades**.

As consultas de ranking (4b, 4c, 4d e 4f) usam `row_number()` em vez de `limit`, porque o
`dbt show` acrescenta o seu próprio `limit` ao final da consulta.

---

## 5. Dados do painel

O painel (`../docs/index.html`) lê uma extração da tabela de consumo `rpt_sales`. Para
atualizá-la depois de um `dbt run`:

```bash
dbt show --quiet --select painel_export_rpt_sales --limit 200000 --output json > /tmp/rpt_sales.json
python3 ../scripts/build_dashboard_data.py /tmp/rpt_sales.json ../docs/data/sales.json
```

A consulta `analyses/painel_export_rpt_sales.sql` traz só as colunas usadas pelo painel, e
o script grava os textos como dicionários para reduzir o arquivo a poucos megabytes.

---

## 6. Estrutura

```
adventureworks_dbt/
├── dbt_project.yml
├── packages.yml                    dbt_utils
├── profiles.example.yml            modelo de conexão, para copiar em ~/.dbt/
├── models/
│   ├── staging/adventure_works/
│   │   ├── _adventure_works__sources.yml    sources, descrições e testes de source
│   │   ├── _adventure_works__models.yml     descrições dos modelos de staging
│   │   └── stg_adventure_works__*.sql       14 views de staging
│   └── marts/sales/
│       ├── _sales__models.yml               descrições e testes dos marts
│       ├── fct_sales.sql                    tabela fato
│       ├── dim_*.sql                        dimensões
│       ├── br_order_sales_reason.sql        ponte N:N
│       └── rpt_*.sql                        tabelas de consumo para o BI
├── analyses/
│   ├── q4a … q4f                            SQL de apoio das perguntas de negócio
│   └── painel_export_rpt_sales.sql          extração que alimenta o painel
└── tests/
    ├── assert_gross_sales_2011.sql
    ├── assert_rpt_sales_no_fanout.sql
    └── assert_on_promotion_reason_has_sales.sql
```
