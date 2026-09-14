-- 4a) Número de pedidos, quantidade comprada e valor total negociado por dimensão.
-- Exemplo agrupado por produto. Para as outras dimensões, troque o GROUP BY por:
--   card_type | status_name | customer_name | city | state_province_name |
--   country_region_name | year_month (data de venda)
-- Para "motivo de venda", use rpt_sales_by_reason (ver q4f).
select
    product_name,
    count(distinct sales_order_id)  as numero_pedidos,
    sum(order_qty)                  as quantidade_comprada,
    round(sum(gross_amount), 2)     as valor_total_negociado
from {{ ref('rpt_sales') }}
group by product_name
order by valor_total_negociado desc
