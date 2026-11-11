# Adventure Works — Data Warehouse e Painel de Vendas

Projeto da **Certificação em Analytics Engineer (Indicium)**. A partir dos dados brutos do
ERP da Adventure Works, o projeto constrói um data warehouse dimensional de vendas com
**dbt Core** no **Databricks** e um painel interativo que responde às perguntas de negócio
da diretoria.

| Entregável | Onde está |
|---|---|
| Diagrama conceitual do data warehouse | [docs/modelo_conceitual_dw.pdf](docs/modelo_conceitual_dw.pdf) (fonte editável em `.drawio`) |
| Projeto dbt: staging, marts, testes e documentação | [adventureworks_dbt/](adventureworks_dbt/) |
| SQL de apoio das perguntas de negócio | [adventureworks_dbt/analyses/](adventureworks_dbt/analyses/) |
| Painel de BI | <https://arthur-eiji.github.io/CEA_AW_ArthurEiji/> |
| Vídeo de apresentação (9 min) | <https://youtu.be/osQUnATmJE0> |

## Arquitetura

```
ERP (PostgreSQL)  ──EL──▶  Databricks: fea_academy.adventure_works (dados brutos)
                                        │
                                        ▼  dbt
                           staging   14 views, uma por tabela-fonte, sem joins:
                                     nomes padronizados, tipos fixados, defeitos corrigidos
                                        │
                                        ▼
                           marts     star schema: fct_sales + 6 dimensões + ponte N:N
                                        │
                                        ▼
                           consumo   rpt_sales e rpt_sales_by_reason (tabelas largas para o BI)
                                        │
                                        ▼
                           painel    página estática publicada pelo GitHub Pages
```

## Modelo dimensional

| Tabela | Grão | Fontes (`fea_academy.adventure_works`) |
|---|---|---|
| **`fct_sales`** | item de pedido | `sales_salesorderdetail`, `sales_salesorderheader` |
| `dim_product` | produto | `production_product`, `production_productsubcategory`, `production_productcategory` |
| `dim_customer` | cliente | `sales_customer`, `person_person`, `sales_store` |
| `dim_credit_card` | cartão | `sales_creditcard` |
| `dim_order_status` | status do pedido | derivada de `sales_salesorderheader.status` |
| `dim_geography` | endereço de entrega | `person_address`, `person_stateprovince`, `person_countryregion` |
| `dim_date` | dia | gerada no dbt (`dbt_utils.date_spine`) |
| `dim_sales_reason` | motivo de venda | `sales_salesreason` |
| `br_order_sales_reason` | pedido × motivo (ponte N:N) | `sales_salesorderheadersalesreason` |

A fato fica no grão de item de pedido, o mais fino, e guarda as medidas aditivas
(`order_qty`, `gross_amount`, `discount_amount`, `net_amount`). O número de pedidos é
`count(distinct sales_order_id)`. O motivo de venda é N:N com o pedido, por isso fica em
uma tabela-ponte em vez de entrar na fato, o que inflaria as medidas.

## Qualidade dos dados

O projeto tem **117 testes**; o resultado esperado de `dbt test` é
`PASS=115 WARN=2 ERROR=0`.

- **Sources:** chaves não nulas e únicas, relacionamentos e domínios nos dados brutos.
- **Marts:** chave primária de toda dimensão e da fato, relacionamento de toda chave
  estrangeira e valores aceitos nas colunas de domínio.
- **Reconciliação com a auditoria:** um teste garante que as vendas brutas de 2011 somam
  exatamente **US$ 12.646.112,16**, o valor confirmado pela contabilidade.
- **Dois avisos intencionais:** os testes de source documentam dois defeitos reais da
  origem, corrigidos na staging: o código `NA` da Namíbia, que a ingestão transforma em
  nulo, e o motivo `Television  Advertisement`, gravado com dois espaços no ERP.

A ingestão também entrega como `double` as colunas de inteiros que contêm nulos; a staging
converte as chaves para `bigint`, o que mantém as surrogate keys consistentes entre a fato
e as dimensões.

## Perguntas de negócio

Os resultados abaixo valem para a base completa, sem filtros. No painel, todos respondem
aos filtros de período, produto, tipo de cartão, motivo de venda, status, cliente, país,
estado e cidade.

| Pergunta | Onde ver no painel | SQL de apoio | Resultado |
|---|---|---|---|
| **4a** Pedidos, quantidade e valor por dimensão | abas Produto, Cliente e pagamento, Geografia e Motivo de venda | [q4a](adventureworks_dbt/analyses/q4a_metricas_por_dimensao.sql) | as três métricas para cada dimensão |
| **4b** Produtos com maior ticket médio | Produto → Top 10 produtos por ticket médio | [q4b](adventureworks_dbt/analyses/q4b_ticket_medio.sql) | Mountain-100 Black, 38: US$ 5.726,48 por pedido |
| **4c** 10 melhores clientes | Cliente e pagamento → Top 10 clientes | [q4c](adventureworks_dbt/analyses/q4c_top10_clientes.sql) | 1º Brakes and Gears: US$ 882.276,50 |
| **4d** 5 melhores cidades | Geografia → Top 5 cidades | [q4d](adventureworks_dbt/analyses/q4d_top5_cidades.sql) | Toronto, London, Paris, Seattle e Burnaby |
| **4e** Série temporal por mês e ano | Visão geral → Evolução das vendas | [q4e](adventureworks_dbt/analyses/q4e_serie_temporal.sql) | pico de valor em março de 2014: US$ 7,24 milhões |
| **4f** Produto mais comprado no motivo "Promotion" | Motivo de venda → resposta em destaque | [q4f](adventureworks_dbt/analyses/q4f_produto_on_promotion.sql) | **Water Bottle - 30 oz., 546 unidades** |

Sobre a pergunta 4f: no ERP o motivo se chama **`On Promotion`** (`Promotion` é o valor de
`reason_type` desse motivo). O painel, o SQL de apoio e a documentação usam o mesmo filtro,
`sales_reason_name = 'On Promotion'`, e um teste garante que esse nome continua existindo
com vendas.

## Painel

O painel é uma página estática, versionada com o código em [docs/](docs/) e publicada pelo
GitHub Pages. Ele lê uma extração da tabela de consumo `rpt_sales` e agrega os 121 mil
itens de pedido no navegador, sem bibliotecas externas.

- **Uma página por tema:** Visão geral, Produto, Cliente e pagamento, Geografia e Motivo de
  venda.
- **Indicadores em três níveis:** o valor total negociado em destaque, as métricas
  principais (pedidos, quantidade e ticket médio) e os indicadores de apoio.
- **As três métricas em todas as dimensões:** cada gráfico mostra valor negociado, número
  de pedidos e quantidade lado a lado, cada um com o próprio eixo, e pode ser ordenado por
  qualquer uma delas.
- **Cores fixas por métrica** (valor, pedidos e quantidade), validadas para daltonismo nos
  temas claro e escuro.
- **Alturas padronizadas** e versão em tabela de todo gráfico.

## Como reproduzir

O passo a passo completo está no [README do projeto dbt](adventureworks_dbt/README.md). Em
resumo, com os dados já ingeridos no Databricks:

```bash
cd adventureworks_dbt
pip install dbt-databricks        # adapter do dbt para Databricks
dbt deps                          # instala o pacote dbt_utils
dbt run                           # constrói staging, marts e tabelas de consumo
dbt test --select "source:*"      # testes nos dados brutos
dbt test                          # todos os testes
```

## Estrutura do repositório

```
├── adventureworks_dbt/           projeto dbt
│   ├── models/staging/           views de staging, sources e documentação
│   ├── models/marts/sales/       fato, dimensões, ponte e tabelas de consumo
│   ├── analyses/                 SQL de apoio das perguntas de negócio e extração do painel
│   └── tests/                    testes de dado
├── docs/                         painel (GitHub Pages) e diagrama conceitual
│   ├── index.html, assets/       página, estilos e código do painel
│   ├── data/sales.json           extração de rpt_sales usada pelo painel
│   └── modelo_conceitual_dw.pdf  diagrama conceitual (e a fonte .drawio)
└── scripts/
    └── build_dashboard_data.py   compacta a extração de rpt_sales para o painel
```
