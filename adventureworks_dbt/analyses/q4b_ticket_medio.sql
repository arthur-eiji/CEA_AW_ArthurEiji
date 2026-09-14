-- 4b) Produtos com maior ticket médio por mês, ano, cidade, estado e país.
-- ticket médio = (faturamento bruto − descontos do produto) / nº de pedidos no período
--              = sum(net_amount) / count(distinct sales_order_id)
select
    year_number,
    year_month,
    country_region_name,
    state_province_name,
    city,
    product_name,
    count(distinct sales_order_id)                                    as numero_pedidos,
    round(sum(net_amount), 2)                                         as faturamento_liquido,
    round(sum(net_amount) / count(distinct sales_order_id), 2)        as ticket_medio
from {{ ref('rpt_sales') }}
group by 1, 2, 3, 4, 5, 6
order by ticket_medio desc
limit 50
