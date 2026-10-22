# Adventure Works — Data Warehouse de Vendas (dbt + Databricks)

Projeto de Engenharia de Analytics da **Certificação em Analytics Engineer (Indicium)**.
Transforma os dados brutos do ERP transacional (AdventureWorks OLTP, schema
`adventure_works` no Databricks) em um **modelo dimensional (star schema)** de vendas,
pronto para responder às perguntas de negócio da diretoria em uma ferramenta de BI.

Stack: **Databricks** (data warehouse) + **dbt Core** (transformação, adapter `dbt-databricks`).

---

## 1. Arquitetura

```
  adventure_works (raw, Databricks)
          │
          ▼
  staging/  ── 1 view por tabela-fonte (rename snake_case, casts, limpeza leve)
          │
          ▼
  marts/sales/ ── modelo dimensional (star schema)
          ├── fct_sales               (grão: item de pedido / salesorderdetail)
          ├── dim_product
          ├── dim_customer
          ├── dim_credit_card
          ├── dim_sales_reason  + br_order_sales_reason (ponte M:N)
          ├── dim_order_status
          ├── dim_geography
          ├── dim_date
          ├── rpt_sales               (tabela larga p/ BI — totais exatos, sem fan-out)
          └── rpt_sales_by_reason     (grão item × motivo — análises por motivo, ex. 4f)
```

### Star schema

| Dimensão | Grão | Fontes (schema `adventure_works`) |
|---|---|---|
| `dim_product` | produto | `product`, `productsubcategory`, `productcategory` |
| `dim_customer` | cliente | `customer`, `person` |
| `dim_credit_card` | cartão | `creditcard` |
| `dim_sales_reason` | motivo de venda | `salesreason` |
| `dim_order_status` | status | derivada de `salesorderheader.status` |
| `dim_geography` | endereço | `address`, `stateprovince`, `countryregion` |
| `dim_date` | dia | gerada (`dbt_utils.date_spine`) |
| `br_order_sales_reason` | pedido × motivo | `salesorderheadersalesreason` (ponte M:N) |
| **`fct_sales`** | **item de pedido** | `salesorderdetail` + `salesorderheader` |

**Medidas da fato:** `order_qty`, `unit_price`, `gross_amount` (= `unit_price*order_qty`,
o "valor total negociado"/vendas brutas), `discount_amount`, `net_amount`
(= bruto × (1 − desconto), equivalente ao `linetotal` computado do OLTP).
Número de pedidos = `count(distinct sales_order_id)` (medida não-aditiva, calculada no BI).

> **Motivo de venda é M:N.** Um pedido pode ter vários motivos. Por isso o motivo **não**
> fica na fato (inflaria as medidas); fica na ponte `br_order_sales_reason`, usada no BI
> apenas quando se filtra/agrupa por motivo (join por `sales_order_id`).

---

## 2. Pré-requisitos

- Um workspace **Databricks** com um **SQL Warehouse** ativo.
- Os dados do AdventureWorks já ingeridos no schema **`adventure_works`** (etapa EL —
  ver seção 3.1).
- **Python 3.9+** e o adapter do dbt para Databricks:
  ```bash
  pip install dbt-databricks
  ```

---

## 3. Como rodar (passo a passo)

### 3.1. Ingestão dos dados (EL)
Siga as instruções do repositório de datasources da Indicium para carregar o
AdventureWorks no Databricks, **usando somente o schema `adventure_works`**:
<https://bitbucket.org/indiciumtech/databricks-datasources/src/main/>

### 3.2. Configurar a conexão (profiles)
Este projeto foi feito para o **Databricks Free Edition** (grátis, sem cartão):
<https://www.databricks.com/learn/free-edition>

Copie `profiles.example.yml` para `~/.dbt/profiles.yml` e preencha `host` e `http_path`
(SQL Warehouses → *Serverless Starter Warehouse* → *Connection details*). O `catalog`
é `fea_academy` (o mesmo onde a ingestão criou o `adventure_works`); o `schema`
(ex.: `dbt_arthur`) é criado pelo dbt.

Autenticação: o template usa **OAuth** (`auth_type: oauth`) — no primeiro `dbt debug`
abre o navegador para você logar, sem precisar gerar token. Se preferir Personal Access
Token, troque para `token: "{{ env_var('DBT_DATABRICKS_TOKEN') }}"` e exporte a variável:
```bash
export DBT_DATABRICKS_TOKEN="dapi....seu_token"
```

### 3.3. Instalar dependências do dbt
```bash
dbt deps
```

### 3.4. Estrutura dos dados brutos no Databricks
A ingestão da Indicium cria o schema em `fea_academy.adventure_works`, com 68 tabelas
cujo nome físico é prefixado pelo schema de origem do Postgres
(ex.: `sales_salesorderheader`, `production_product`, `person_address`). Confira com:
```sql
SHOW TABLES IN fea_academy.adventure_works;
```
O mapeamento nome lógico → nome físico já está feito via `identifier` em
`models/staging/adventure_works/_adventure_works__sources.yml`; os modelos usam
sempre o nome lógico (`source('adventure_works', 'salesorderheader')`).

### 3.5. Rodar e testar
```bash
dbt run                       # constrói staging + marts
dbt test --select source:*    # testes nas sources (item 3b)
dbt test                      # todos os testes: PKs, relacionamentos e teste de dado
```

### 3.6. Documentação navegável
```bash
dbt docs generate
dbt docs serve
```

---

## 4. Testes (garantia de qualidade)

| Requisito | Onde | O quê |
|---|---|---|
| Testes de source (3b) | `_adventure_works__sources.yml` | `not_null`, `unique`, `relationships`, `accepted_values` nas tabelas brutas |
| PKs de dimensões e fato (3c) | `_sales__models.yml` | `unique` + `not_null` em cada surrogate key e em `sales_order_detail_id` |
| Integridade referencial | `_sales__models.yml` | `relationships` de cada FK da `fct_sales` para as dimensões |
| **Teste de dado (3d)** | `tests/assert_gross_sales_2011.sql` | Garante **vendas brutas de 2011 = US$ 12.646.112,16** (pedido do Carlos) |

O teste de dado é um teste **singular**: soma `gross_amount` para `year(order_date)=2011`,
arredonda a 2 casas e falha se divergir do valor auditado (parametrizado na var
`gross_sales_2011_expected` do `dbt_project.yml`).

---

## 5. Como o modelo responde às perguntas de negócio (item 4)

**Painel interativo (público):** <https://arthur-eiji.github.io/CEA_AW_ArthurEiji/>

O painel é uma aplicação web estática versionada junto com o código (`docs/index.html`,
publicada via GitHub Pages) e construída sobre a mart `rpt_sales`: o script
`scripts/build_dashboard_data.py` compacta o export da mart (24 MB) em um JSON
dicionário-codificado (`docs/data/sales.json`, 4,6 MB), e a página agrega os 121 mil itens
de pedido no navegador. Decisões de BI-as-code: sem dependência de licença ou de
compartilhamento, filtros numa única linha acima de todos os gráficos, um eixo por gráfico
(a série mensal vira três gráficos pequenos), uma cor por série, versão em tabela de todo
gráfico (acessibilidade), modo escuro e selo de reconciliação com a auditoria calculado ao vivo.
As queries SQL equivalentes a cada pergunta estão em `analyses/q4a…q4f.sql`. Todas descem do grão da `fct_sales`
+ dimensões conformadas:

- **4a** nº pedidos / qtd / valor por produto, cartão, motivo, data, cliente, status, cidade/estado/país → `fct_sales` × todas as dims (motivo via ponte).
- **4b** ticket médio (`(bruto − desconto)/nº pedidos`) por mês/ano/cidade/estado/país → `net_amount` ÷ `count(distinct sales_order_id)`.
- **4c** top 10 clientes por valor negociado → `dim_customer` + `sum(gross_amount)`.
- **4d** top 5 cidades por valor negociado → `dim_geography` + `sum(gross_amount)`.
- **4e** série temporal (nº pedidos, qtd, valor por mês/ano) → `dim_date`.
- **4f** produto com maior qtd para motivo **"Promotion"** → `fct_sales` × `br_order_sales_reason` × `dim_sales_reason` (filtro `Promotion`) + `sum(order_qty)`.

---

## 6. Estrutura do projeto

```
adventureworks_dbt/
├── dbt_project.yml
├── packages.yml                 # dbt_utils
├── profiles.example.yml         # template de conexão (copiar p/ ~/.dbt/)
├── models/
│   ├── staging/adventure_works/
│   │   ├── _adventure_works__sources.yml   # sources + testes de source
│   │   └── stg_adventure_works__*.sql      # 13 views de staging
│   └── marts/sales/
│       ├── _sales__models.yml              # docs + testes (PKs, relationships)
│       ├── dim_*.sql / br_*.sql            # dimensões + ponte
│       └── fct_sales.sql                   # tabela fato
├── analyses/
│   └── q4a…q4f_*.sql                       # queries que respondem as perguntas de negócio
└── tests/
    ├── assert_gross_sales_2011.sql         # teste de dado (US$ 12.646.112,16)
    └── assert_rpt_sales_no_fanout.sql      # rpt_sales == fct_sales (linhas e total)
```

Na raiz do repositório:

```
CEA_AW_ArthurEiji/
├── adventureworks_dbt/          # este projeto dbt
├── docs/
│   ├── index.html               # painel de BI (GitHub Pages)
│   ├── data/sales.json          # dados compactados da mart rpt_sales
│   ├── modelo_conceitual_dw.pdf # diagrama conceitual (+ .drawio editável)
│   └── roteiro_video.md         # roteiro da apresentação
├── scripts/build_dashboard_data.py
└── entrega/                     # pasta de entrega (links + PDF)
```
