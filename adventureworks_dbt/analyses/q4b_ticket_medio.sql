-- 4b) Quais os produtos com maior ticket médio por mês, ano, cidade, estado e país?
--
-- ticket médio = (faturamento bruto − descontos do produto) ÷ nº de pedidos no período
--              = sum(net_amount) ÷ count(distinct sales_order_id)
--
-- A consulta calcula o ticket médio de cada produto em cada combinação de mês e cidade e
-- devolve as 50 maiores. Para analisar em um nível mais agregado (só por ano, só por país
-- etc.), retire do SELECT e do GROUP BY as colunas que não interessam. No painel, o mesmo
-- resultado sai do ranking de produtos por ticket médio combinado com os filtros de
-- período e geografia.
--
-- Executar: dbt show --select q4b_ticket_medio --limit 50
with ticket_por_produto as (

    select
        year_number,
        year_month,
        country_region_name,
        state_province_name,
        city,
        product_name,
        count(distinct sales_order_id)                              as numero_pedidos,
        round(sum(net_amount), 2)                                   as valor_liquido,
        round(sum(net_amount) / count(distinct sales_order_id), 2)  as ticket_medio
    from {{ ref('rpt_sales') }}
    group by year_number, year_month, country_region_name, state_province_name, city, product_name

),

ranking as (

    select
        row_number() over (order by ticket_medio desc, year_month, city, product_name) as posicao,
        *
    from ticket_por_produto

)

select *
from ranking
where posicao <= 50
order by posicao
