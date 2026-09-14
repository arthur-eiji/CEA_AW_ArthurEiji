-- Tabela larga (one big table) para o BI.
-- Grão: 1 linha por item de pedido (igual à fct_sales), já unida a todas as
-- dimensões. Os totais aqui são EXATOS (sem fan-out) e reconciliam com a
-- auditoria (vendas brutas 2011 = US$ 12.646.112,16).
-- O motivo de venda é M:N com o pedido, por isso aparece apenas como lista
-- concatenada informativa (sales_reasons). Para análises POR motivo, use
-- rpt_sales_by_reason.
with sales as (

    select * from {{ ref('fct_sales') }}

),

product as (

    select * from {{ ref('dim_product') }}

),

customer as (

    select * from {{ ref('dim_customer') }}

),

credit_card as (

    select * from {{ ref('dim_credit_card') }}

),

order_status as (

    select * from {{ ref('dim_order_status') }}

),

dates as (

    select * from {{ ref('dim_date') }}

),

geography as (

    select * from {{ ref('dim_geography') }}

),

-- Motivos agregados por pedido (1 linha por pedido -> não gera fan-out)
order_reasons as (

    select
        bridge.sales_order_id,
        concat_ws(', ', sort_array(collect_set(reason.sales_reason_name))) as sales_reasons,
        count(distinct reason.sales_reason_key)                            as n_sales_reasons
    from {{ ref('br_order_sales_reason') }} as bridge
    inner join {{ ref('dim_sales_reason') }} as reason
        on bridge.sales_reason_key = reason.sales_reason_key
    group by bridge.sales_order_id

),

final as (

    select
        -- chaves
        sales.sales_order_detail_id,
        sales.sales_order_id,

        -- data de venda
        sales.order_date,
        dates.year_number,
        dates.quarter_number,
        dates.month_number,
        dates.month_name,
        dates.year_month,

        -- produto
        product.product_id,
        product.product_name,
        product.subcategory_name,
        product.category_name,

        -- cliente
        customer.customer_id,
        customer.customer_name,
        customer.customer_type,

        -- cartão
        credit_card.card_type,

        -- status
        order_status.status_code,
        order_status.status_name,

        -- geografia de entrega
        geography.city,
        geography.state_province_name,
        geography.country_region_name,

        -- motivos de venda (informativo, M:N)
        coalesce(order_reasons.sales_reasons, 'Sem motivo informado') as sales_reasons,
        coalesce(order_reasons.n_sales_reasons, 0)                    as n_sales_reasons,

        -- medidas
        sales.order_qty,
        sales.unit_price,
        sales.unit_price_discount,
        sales.gross_amount,
        sales.discount_amount,
        sales.net_amount

    from sales
    left join product
        on sales.product_key = product.product_key
    left join customer
        on sales.customer_key = customer.customer_key
    left join credit_card
        on sales.credit_card_key = credit_card.credit_card_key
    left join order_status
        on sales.order_status_key = order_status.order_status_key
    left join dates
        on sales.order_date_key = dates.date_key
    left join geography
        on sales.ship_geography_key = geography.geography_key
    left join order_reasons
        on sales.sales_order_id = order_reasons.sales_order_id

)

select * from final
