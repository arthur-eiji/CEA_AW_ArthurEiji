-- 4e) Número de pedidos, quantidade comprada e valor total negociado por mês e ano
-- (série de tempo para o gráfico de linha do painel).
select
    year_number,
    month_number,
    year_month,
    count(distinct sales_order_id)  as numero_pedidos,
    sum(order_qty)                  as quantidade_comprada,
    round(sum(gross_amount), 2)     as valor_total_negociado
from {{ ref('rpt_sales') }}
group by year_number, month_number, year_month
order by year_number, month_number
