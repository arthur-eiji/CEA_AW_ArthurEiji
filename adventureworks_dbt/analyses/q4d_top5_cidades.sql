-- 4d) Quais as 5 melhores cidades em valor total negociado, por produto, tipo de cartão,
--     motivo de venda, data de venda, cliente, status, cidade, estado e país?
--
-- A cidade é a do endereço de entrega do pedido. Estado e país entram no agrupamento
-- porque há cidades homônimas. Os filtros seguem a mesma lógica da q4c; para filtrar por
-- motivo de venda, troque a fonte por rpt_sales_by_reason e acrescente, por exemplo:
-- and sales_reason_name = 'On Promotion'
--
-- Executar: dbt show --select q4d_top5_cidades --limit 5
with cidades as (

    select
        city,
        state_province_name,
        country_region_name,
        count(distinct sales_order_id)  as numero_pedidos,
        sum(order_qty)                  as quantidade_comprada,
        round(sum(gross_amount), 2)     as valor_total_negociado
    from {{ ref('rpt_sales') }}
    where 1 = 1
      -- and product_name = 'Mountain-200 Black, 38'
      -- and card_type = 'Vista'
      -- and customer_name = 'Brakes and Gears'
      -- and status_name = 'Shipped'
      -- and order_date between '2013-01-01' and '2013-12-31'
    group by city, state_province_name, country_region_name

),

ranking as (

    select
        row_number() over (
            order by valor_total_negociado desc, city, state_province_name
        ) as posicao,
        *
    from cidades

)

select *
from ranking
where posicao <= 5
order by posicao
