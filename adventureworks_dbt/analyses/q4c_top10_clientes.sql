-- 4c) Quais os 10 melhores clientes por valor total negociado, filtrado por produto, tipo
--     de cartão, motivo de venda, data de venda, status, cidade, estado e país?
--
-- O agrupamento usa customer_id porque clientes diferentes podem ter o mesmo nome.
-- Os filtros entram no WHERE; os exemplos abaixo estão comentados.
-- Para filtrar por MOTIVO DE VENDA, troque a fonte por rpt_sales_by_reason e acrescente,
-- por exemplo: and sales_reason_name = 'On Promotion'
--
-- Executar: dbt show --select q4c_top10_clientes --limit 10
with clientes as (

    select
        customer_id,
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
      -- and city = 'Toronto'
      -- and state_province_name = 'Ontario'
      -- and country_region_name = 'Canada'
      -- and order_date between '2013-01-01' and '2013-12-31'
    group by customer_id, customer_name, customer_type

),

ranking as (

    select
        row_number() over (order by valor_total_negociado desc, customer_id) as posicao,
        *
    from clientes

)

select *
from ranking
where posicao <= 10
order by posicao
