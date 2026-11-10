-- 4e) Qual o número de pedidos, quantidade comprada e valor total negociado por mês e ano?
--
-- Série de tempo mensal, a mesma dos gráficos de linha do painel. Para a visão anual,
-- agrupe apenas por year_number. Os anos de 2011 e 2014 são parciais: as vendas da base
-- vão de 2011-05-31 a 2014-06-30.
--
-- Executar: dbt show --select q4e_serie_temporal --limit 50
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
