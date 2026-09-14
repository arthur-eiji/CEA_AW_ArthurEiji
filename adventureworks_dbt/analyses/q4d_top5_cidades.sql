-- 4d) 5 melhores cidades em valor total negociado.
-- Mesma lógica de filtros da q4c; para motivo de venda use rpt_sales_by_reason.
select
    city,
    state_province_name,
    country_region_name,
    count(distinct sales_order_id)  as numero_pedidos,
    sum(order_qty)                  as quantidade_comprada,
    round(sum(gross_amount), 2)     as valor_total_negociado
from {{ ref('rpt_sales') }}
where 1 = 1
  -- and product_name = '...'
  -- and card_type = '...'
  -- and customer_name = '...'
  -- and status_name = '...'
group by city, state_province_name, country_region_name
order by valor_total_negociado desc
limit 5
