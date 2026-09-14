-- 4c) 10 melhores clientes por valor total negociado.
-- Filtros de produto, cartão, data, status e geografia entram no WHERE (comentados).
-- Para filtrar por MOTIVO DE VENDA, troque a fonte por rpt_sales_by_reason e
-- adicione: and sales_reason_name = 'Promotion'
select
    customer_name,
    customer_type,
    count(distinct sales_order_id)  as numero_pedidos,
    sum(order_qty)                  as quantidade_comprada,
    round(sum(gross_amount), 2)     as valor_total_negociado
from {{ ref('rpt_sales') }}
where 1 = 1
  -- and product_name = 'Mountain-200 Black, 38'
  -- and card_type = 'Vista'
  -- and status_name = 'Shipped'
  -- and country_region_name = 'United States'
  -- and order_date between '2013-01-01' and '2013-12-31'
group by customer_name, customer_type
order by valor_total_negociado desc
limit 10
