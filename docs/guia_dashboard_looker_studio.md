# Guia — Painel de BI no Looker Studio

Passo a passo para montar o painel do item 4 no **Looker Studio** (ex-Google Data Studio),
a partir das tabelas de reporting do dbt. Entrega final = **link compartilhável**.

**Por que duas tabelas?**
- `rpt_sales` — 1 linha por item de pedido, já com todas as dimensões. Totais **exatos**
  (reconcilia com a auditoria). Alimenta a página principal.
- `rpt_sales_by_reason` — 1 linha por item × motivo de venda. Como um pedido pode ter vários
  motivos (M:N), ela **infla de propósito** — só serve para análises *por* motivo ou
  *filtradas* por motivo (item 4f). Alimenta a página "Motivo de Venda".

---

## Etapa 1 — Exportar os dados do Databricks (2 arquivos CSV)

No **SQL Editor** do Databricks, rode a query 1, clique no botão de **download** do painel de
resultados (ícone ⬇ → *Download CSV*) e salve como `rpt_sales.csv`. Depois repita com a query 2
→ `rpt_sales_by_reason.csv`.

**Query 1 — `rpt_sales.csv`** (só as colunas que o painel usa, ~121 mil linhas):
```sql
SELECT
    sales_order_detail_id, sales_order_id, order_date, year_number, month_number, year_month,
    product_name, subcategory_name, category_name,
    customer_name, customer_type, card_type, status_name,
    city, state_province_name, country_region_name, sales_reasons,
    order_qty, gross_amount, discount_amount, net_amount
FROM fea_academy.dbt_arthur.rpt_sales;
```

**Query 2 — `rpt_sales_by_reason.csv`:**
```sql
SELECT
    sales_reason_name, sales_order_detail_id, sales_order_id, order_date, year_month,
    product_name, category_name, customer_name, card_type, status_name,
    city, state_province_name, country_region_name,
    order_qty, gross_amount, net_amount
FROM fea_academy.dbt_arthur.rpt_sales_by_reason;
```

> **Se o download vier truncado** (ex.: só 10.000 linhas): divida por ano, adicionando
> `WHERE year_number = 2011` (depois 2012, 2013, 2014) e baixando 4 arquivos. O conector
> *File Upload* do Looker Studio aceita **vários arquivos na mesma fonte** desde que tenham as
> mesmas colunas — é só subir os 4.

---

## Etapa 2 — Criar as fontes de dados no Looker Studio

1. Acesse **https://lookerstudio.google.com** (conta Google) → **Criar → Fonte de dados**.
2. Escolha o conector **Upload de arquivo** (*File Upload*) → arraste `rpt_sales.csv`.
3. Quando a lista de campos aparecer, **confira os tipos** (isso evita 90% dos erros):

| Campo | Tipo correto | Por quê |
|---|---|---|
| `order_date` | pode ficar como **Texto** — a data usável vem do campo calculado `data_pedido` (passo 5); converter direto no dropdown costuma falhar no *File Upload* | série temporal e filtro de período |
| `sales_order_id` | **Texto** | se ficar como Número o Looker tenta somar; como Texto o `COUNT_DISTINCT` funciona certo |
| `sales_order_detail_id` | Texto | idem |
| `year_number`, `month_number` | Número (sem agregação) ou Texto | são rótulos, não somas |
| `gross_amount`, `net_amount`, `discount_amount` | **Número → Moeda (USD)** | formatação nos gráficos |
| `order_qty` | Número | soma = quantidade comprada |
| demais | Texto | dimensões |

4. Renomeie a fonte para **`vendas`** → **Conectar**.
5. Ainda na fonte `vendas`, crie **campos calculados** (*Adicionar um campo*):

| Nome | Fórmula |
|---|---|
| `numero_pedidos` | `COUNT_DISTINCT(sales_order_id)` |
| `ticket_medio` | `SUM(net_amount) / COUNT_DISTINCT(sales_order_id)` |
| `data_pedido` | `DATE(CAST(SUBSTR(order_date, 1, 4) AS NUMBER), CAST(SUBSTR(order_date, 6, 2) AS NUMBER), CAST(SUBSTR(order_date, 9, 2) AS NUMBER))` — sem aspas nem traços (evita o autocorretor do Mac trocar `"` por aspas curvas, que gera "fórmula inválida"). Alternativa: `PARSE_DATE("%Y-%m-%d", SUBSTR(order_date, 1, 10))`, desde que as aspas sejam retas. Use `data_pedido` (e não `order_date`) na série temporal e no controle de período |

   O `ticket_medio` é exatamente a definição do enunciado: *(faturamento bruto − descontos) /
   nº de pedidos*.

6. Repita os passos 1–5 para `rpt_sales_by_reason.csv` → fonte **`vendas_por_motivo`**
   (mesmos tipos; crie também `numero_pedidos`).

> **Alternativa ao vivo (opcional):** no passo 2, procure o conector parceiro **Databricks**.
> Ele pede *Server hostname*, *HTTP path* e autenticação (token ou OAuth). Se funcionar no
> seu Free Edition, aponte para `fea_academy.dbt_arthur.rpt_sales` e pule os CSVs. Se travar,
> volte ao *File Upload* — nada muda no resto do guia.

---

## Etapa 3 — Relatório · Página 1 **"Visão Geral"** (fonte: `vendas`)

**Criar → Relatório** → adicione a fonte `vendas`. Renomeie o relatório para
**"Adventure Works — Vendas"** e a página para "Visão Geral".

### 3.1 Controles (linha de cima) — *Adicionar um controle*

| Controle | Tipo | Campo |
|---|---|---|
| Período | Controle de período | `data_pedido` |
| País | Lista suspensa | `country_region_name` |
| Estado | Lista suspensa | `state_province_name` |
| Cidade | Lista suspensa | `city` |
| Categoria | Lista suspensa | `category_name` |
| Produto | Lista suspensa (com pesquisa) | `product_name` |
| Tipo de cartão | Lista suspensa | `card_type` |
| Status | Lista suspensa | `status_name` |
| Cliente | Lista suspensa (com pesquisa) | `customer_name` |

Controles filtram todos os gráficos da página que usam a mesma fonte.

### 3.2 Gráficos — *Adicionar um gráfico*

| # | Título | Tipo | Configuração | Responde |
|---|---|---|---|---|
| 1 | Nº de pedidos | Cartão de indicador | métrica `numero_pedidos` | 4a |
| 2 | Quantidade comprada | Cartão de indicador | `SUM(order_qty)` | 4a |
| 3 | Valor total negociado | Cartão de indicador | `SUM(gross_amount)` (moeda) | 4a |
| 4 | Ticket médio | Cartão de indicador | `ticket_medio` | 4b |
| 5 | Evolução mensal | Série temporal | dimensão `data_pedido` (granularidade **Mês**) · métricas `gross_amount`, `numero_pedidos`, `order_qty` (use eixo direito para as 2 últimas) | **4e** |
| 6 | Valor por categoria | Barras | dim `category_name` · métrica `gross_amount` | 4a |
| 7 | Valor por produto | Barras horizontais | dim `product_name` · `gross_amount` · classificar desc · **Barras: 15** | 4a |
| 8 | Valor por tipo de cartão | Pizza/Rosca | `card_type` · `gross_amount` | 4a |
| 9 | Pedidos por status | Barras | `status_name` · `numero_pedidos` | 4a |
| 10 | Valor por país | Barras (ou Mapa geográfico) | `country_region_name` · `gross_amount` | 4a |
| 11 | **Top 10 clientes** | Tabela | dim `customer_name` · métricas `gross_amount`, `numero_pedidos` · ordenar `gross_amount` desc · **Linhas por página: 10** | **4c** |
| 12 | **Top 5 cidades** | Barras horizontais | dim `city` · `gross_amount` · desc · **Barras: 5** | **4d** |
| 13 | Ticket médio por produto | Tabela | dim `product_name` · métricas `ticket_medio`, `numero_pedidos` · ordenar `ticket_medio` desc | **4b** |

> Com os controles de 3.1 ativos, os gráficos 11 e 12 viram "top 10 clientes / top 5 cidades
> **filtrado por** produto, cartão, data, status, cidade, estado e país" — o que 4c e 4d pedem.

---

## Etapa 4 — Página 2 **"Motivo de Venda"** (fonte: `vendas_por_motivo`)

**Página → Nova página**. Nos gráficos desta página, selecione a fonte `vendas_por_motivo`.

- Controle extra: **Motivo de venda** — lista suspensa em `sales_reason_name`.
- Repita os controles de período, país, produto, cartão e status (nesta fonte).
- **Adicionar texto** no topo: *"Grão: pedido × motivo. Um pedido com mais de um motivo é contado
  em cada motivo. Para totais exatos, use a página Visão Geral."*

| # | Título | Tipo | Configuração | Responde |
|---|---|---|---|---|
| 14 | Valor / quantidade / pedidos por motivo | Barras | dim `sales_reason_name` · métricas `gross_amount`, `order_qty`, `numero_pedidos` | 4a (motivo) |
| 15 | **Produto mais comprado em "Promotion"** | Barras horizontais | dim `product_name` · `SUM(order_qty)` · desc · Barras: 10 · **filtro do gráfico**: *Adicionar um filtro → Incluir → `sales_reason_name` Igual a `Promotion`* | **4f** — a 1ª barra é a resposta |
| 16 | Top 10 clientes por motivo | Tabela | `customer_name` · `gross_amount` · 10 linhas | 4c (motivo) |
| 17 | Top 5 cidades por motivo | Barras | `city` · `gross_amount` · Barras: 5 | 4d (motivo) |

---

## Etapa 5 — Compartilhar (a entrega)

1. Botão **Compartilhar** (canto superior direito) → **Gerenciar acesso**.
2. Em *Acesso ao link*, escolha **"Qualquer pessoa com o link"** → papel **Leitor**.
3. **Copiar link** → cole no arquivo `LINK_PAINEL.txt` da entrega.
4. Teste: abra o link numa **janela anônima** — tem que abrir sem pedir login.

Observação: com *File Upload* os dados são um snapshot; para atualizar, basta subir um novo CSV
na mesma fonte. Para a certificação, um snapshot é suficiente.

---

## Acabamento (conta na avaliação de "painel completo e bem estruturado")

- Tema: *Tema e layout* → escolha um tema limpo; títulos em português; moeda em USD.
- Um título no topo de cada página: "Adventure Works — Visão Geral de Vendas" / "— Motivo de Venda".
- Ordene os controles na mesma ordem em que as perguntas citam as dimensões.

## Checklist — pergunta → gráfico

| Pergunta | Gráficos |
|---|---|
| 4a | 1, 2, 3, 6–10, 14 (+ controles) |
| 4b | 4, 13 |
| 4c | 11 (e 16 por motivo) |
| 4d | 12 (e 17 por motivo) |
| 4e | 5 |
| 4f | 15 |
