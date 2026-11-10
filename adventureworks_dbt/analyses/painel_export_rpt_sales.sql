-- Extração que alimenta o painel de vendas (docs/index.html).
--
-- Lê a tabela de consumo rpt_sales e traz só as colunas que o painel usa. O painel agrega
-- os itens de pedido no navegador, por isso a extração mantém o grão da fato.
--
-- Como atualizar os dados do painel (a partir da pasta adventureworks_dbt):
--   dbt show --quiet --select painel_export_rpt_sales --limit 200000 --output json > /tmp/rpt_sales.json
--   python3 ../scripts/build_dashboard_data.py /tmp/rpt_sales.json ../docs/data/sales.json
select
    sales_order_id,
    order_date,
    product_id,
    product_name,
    subcategory_name,
    category_name,
    customer_id,
    customer_name,
    customer_type,
    card_type,
    status_name,
    city,
    state_province_name,
    country_region_name,
    sales_reasons,
    order_qty,
    gross_amount,
    net_amount
from {{ ref('rpt_sales') }}
