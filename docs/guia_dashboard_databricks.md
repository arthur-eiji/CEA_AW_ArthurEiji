# Guia — Painel de BI no Databricks AI/BI Dashboards

Passo a passo para montar o painel do item 4 dentro do próprio workspace
(Free Edition), em cima dos marts do dbt.

---

## 0. Pré-requisito (terminal)

```bash
dbt run && dbt test
```

Isso cria `rpt_sales` e `rpt_sales_by_reason`. Confirme no **Catalog**:
`fea_academy` → `dbt_arthur` → `rpt_sales` (≈121 mil linhas).

**Por que duas tabelas?**
- `rpt_sales` — 1 linha por item de pedido, já com todas as dimensões. Totais **exatos**;
  é a que reconcilia com a auditoria. Usada na página principal.
- `rpt_sales_by_reason` — 1 linha por item × motivo de venda. Como um pedido pode ter
  vários motivos (M:N), ela **infla de propósito** — só serve para análises *por* motivo
  ou *filtradas* por motivo (é o que o item 4f pede). Usada na página "Motivo de Venda".

---

## 1. Criar o dashboard

Menu lateral → **Dashboards** → **Create dashboard**. Renomeie para
**"Adventure Works — Vendas"**. Há duas abas: **Data** (datasets = queries SQL) e
**Canvas** (visuais e filtros).

## 2. Aba *Data* — dois datasets

Clique **+ Create from SQL** e crie (warehouse: *Serverless Starter Warehouse*):

| Nome do dataset | SQL |
|---|---|
| `vendas` | `SELECT * FROM fea_academy.dbt_arthur.rpt_sales` |
| `vendas_por_motivo` | `SELECT * FROM fea_academy.dbt_arthur.rpt_sales_by_reason` |

Clique **Run** em cada um para validar.

**Ticket médio (item 4b)** — no dataset `vendas`, use **+ Add calculation** (custom
calculation) e crie:

```
ticket_medio = SUM(net_amount) / COUNT(DISTINCT sales_order_id)
```

É exatamente a definição do enunciado: *(faturamento bruto − descontos) / nº de pedidos*.
Se o botão de calculation não aparecer na sua versão, crie um 3º dataset chamado
`ticket_medio` com a query de `analyses/q4b_ticket_medio.sql` (sem o `{{ ref }}`,
usando `fea_academy.dbt_arthur.rpt_sales`).

---

## 3. Aba *Canvas* — Página 1: **"Visão Geral"**

### 3.1 Filtros (linha de cima)
**Add → Filter**. Em cada filtro, selecione o campo **nos dois datasets**
(`vendas` e `vendas_por_motivo`) — assim o filtro vale nas duas páginas.

| Filtro | Campo | Tipo de widget |
|---|---|---|
| Período | `order_date` | Date range picker |
| País | `country_region_name` | Multi-select |
| Estado | `state_province_name` | Multi-select |
| Cidade | `city` | Multi-select |
| Categoria | `category_name` | Multi-select |
| Produto | `product_name` | Multi-select |
| Tipo de cartão | `card_type` | Multi-select |
| Status | `status_name` | Multi-select |
| Cliente | `customer_name` | Multi-select |

### 3.2 Visuais (**Add → Visualization**, dataset `vendas`)

| # | Título | Tipo | Configuração | Responde |
|---|---|---|---|---|
| 1 | Nº de pedidos | Counter | `COUNT DISTINCT sales_order_id` | 4a |
| 2 | Quantidade comprada | Counter | `SUM order_qty` | 4a |
| 3 | Valor total negociado | Counter | `SUM gross_amount` (formato moeda) | 4a |
| 4 | Ticket médio | Counter | `ticket_medio` | 4b |
| 5 | Evolução mensal | Line | X: `order_date` (agregado por *Month*) · Y: `SUM gross_amount`. Duplique o visual para `COUNT DISTINCT sales_order_id` e `SUM order_qty` | **4e** |
| 6 | Valor por categoria | Bar | X: `category_name` · Y: `SUM gross_amount` | 4a |
| 7 | Valor por produto | Bar (horizontal) | Y: `product_name` · X: `SUM gross_amount` · Sort desc · Limit 15 | 4a |
| 8 | Valor por tipo de cartão | Pie ou Bar | `card_type` · `SUM gross_amount` | 4a |
| 9 | Pedidos por status | Bar | `status_name` · `COUNT DISTINCT sales_order_id` | 4a |
| 10 | Valor por país | Bar | `country_region_name` · `SUM gross_amount` | 4a |
| 11 | **Top 10 clientes** | Bar (horizontal) | Y: `customer_name` · X: `SUM gross_amount` · Sort desc · **Limit 10** | **4c** |
| 12 | **Top 5 cidades** | Bar (horizontal) | Y: `city` · X: `SUM gross_amount` · Sort desc · **Limit 5** | **4d** |
| 13 | Ticket médio por produto | Table | `product_name`, `ticket_medio`, `COUNT DISTINCT sales_order_id` · sort por ticket desc | **4b** |

> Com os filtros de 3.1 ativos, os visuais 11 e 12 viram exatamente "top 10 clientes /
> top 5 cidades **filtrado por** produto, cartão, data, status, cidade, estado, país".

---

## 4. *Canvas* — Página 2: **"Motivo de Venda"**

**Add page**. Dataset: `vendas_por_motivo`.

- Filtro extra: **Motivo de venda** = `sales_reason_name` (multi-select) — só neste dataset.
- **Add → Text** no topo: *"Grão: pedido × motivo. Um pedido com mais de um motivo é contado
  em cada motivo. Para totais exatos, use a página Visão Geral."*

| # | Título | Tipo | Configuração | Responde |
|---|---|---|---|---|
| 14 | Valor / quantidade / pedidos por motivo | Bar | X: `sales_reason_name` · Y: `SUM gross_amount` (+ visuais gêmeos com `SUM order_qty` e `COUNT DISTINCT sales_order_id`) | 4a (motivo) |
| 15 | **Produto mais comprado em "Promotion"** | Bar (horizontal) | Y: `product_name` · X: `SUM order_qty` · Sort desc · Limit 10 · **filtro do visual**: `sales_reason_name = Promotion` (ou deixe o filtro da página em *Promotion*) | **4f** — o 1º da lista é a resposta |
| 16 | Top 10 clientes por motivo | Bar (horizontal) | `customer_name` · `SUM gross_amount` · Limit 10 | 4c (motivo) |
| 17 | Top 5 cidades por motivo | Bar (horizontal) | `city` · `SUM gross_amount` · Limit 5 | 4d (motivo) |

Para conferir a resposta do 4f no SQL Editor:
```sql
SELECT product_name, SUM(order_qty) AS quantidade
FROM fea_academy.dbt_arthur.rpt_sales_by_reason
WHERE sales_reason_name = 'Promotion'
GROUP BY product_name ORDER BY quantidade DESC LIMIT 1;
```

---

## 5. Publicar e compartilhar — **o ponto crítico da entrega**

1. Canto superior direito → **Publish** → marque **Embed credentials** (quem abrir usa as suas
   credenciais no warehouse, sem precisar de acesso próprio ao catálogo) → **Publish**.
2. Botão **Share** → anote **quais opções aparecem**:
   - (a) adicionar pessoa por e-mail;
   - (b) *"Anyone with the link"* / *"Account users"*;
   - (c) apenas usuários do workspace.
3. **Teste real:** copie o link publicado e abra numa **janela anônima**. Se abrir sem pedir
   login, está pronto. Se pedir login sem opção de convidado, o compartilhamento externo não
   está disponível no Free Edition.

**Plano B se não houver compartilhamento externo:**
- *Settings → Identity and access → Users → Add user* com o e-mail que a Indicium usar na
  correção (se o Free Edition permitir adicionar usuários); **ou**
- migrar para o Looker Studio: os `rpt_*` já são a tabela larga que ele precisa, então a
  montagem é rápida.

De qualquer forma, **grave a navegação interativa no vídeo** (filtros mudando os visuais) —
o enunciado exige acesso ao painel, mas o vídeo é a prova de interatividade.

---

## 6. Checklist — pergunta → visual

| Pergunta | Visuais |
|---|---|
| 4a | 1, 2, 3, 6–10, 14 (+ filtros) |
| 4b | 4, 13 |
| 4c | 11 (e 16 por motivo) |
| 4d | 12 (e 17 por motivo) |
| 4e | 5 |
| 4f | 15 |
