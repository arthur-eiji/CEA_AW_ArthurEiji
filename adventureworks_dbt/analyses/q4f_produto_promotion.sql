-- 4f) Qual produto tem a maior quantidade de unidades compradas para o motivo
--     de venda "Promotion"?
-- Usa rpt_sales_by_reason (grão item × motivo). Como filtramos por UM motivo,
-- cada item de pedido conta uma única vez — sem fan-out.
select
    product_name,
    category_name,
    sum(order_qty)                  as quantidade_comprada,
    count(distinct sales_order_id)  as numero_pedidos,
    round(sum(gross_amount), 2)     as valor_total_negociado
from {{ ref('rpt_sales_by_reason') }}
where sales_reason_name = 'Promotion'
group by product_name, category_name
order by quantidade_comprada desc
limit 10   -- o 1º da lista é a resposta; os demais dão contexto no painel
