-- Tabela fato de vendas.
-- Grão: 1 linha por item de pedido (salesorderdetail).
-- Traz FKs (surrogate keys) para todas as dimensões conformadas e as medidas
-- aditivas. Contagem de pedidos é feita no BI via count(distinct sales_order_id),
-- pois é uma medida não-aditiva.
with detail as (

    select * from {{ ref('stg_adventure_works__sales_order_detail') }}

),

header as (

    select * from {{ ref('stg_adventure_works__sales_order_header') }}

),

final as (

    select
        -- PK do fato
        detail.sales_order_detail_id,

        -- degenerate dimension (para contar pedidos distintos)
        detail.sales_order_id,

        -- foreign keys (surrogate keys que casam com as dimensões)
        {{ dbt_utils.generate_surrogate_key(['detail.product_id']) }}                   as product_key,
        {{ dbt_utils.generate_surrogate_key(['header.customer_id']) }}                  as customer_key,
        {{ dbt_utils.generate_surrogate_key(['coalesce(header.credit_card_id, -1)']) }} as credit_card_key,
        {{ dbt_utils.generate_surrogate_key(['header.status_code']) }}                  as order_status_key,
        {{ dbt_utils.generate_surrogate_key(['header.order_date']) }}                   as order_date_key,
        {{ dbt_utils.generate_surrogate_key(['header.ship_to_address_id']) }}           as ship_geography_key,

        -- data crua (degenerate) para séries temporais diretas no BI
        header.order_date,

        -- medidas aditivas
        detail.order_qty,
        detail.unit_price,
        detail.unit_price_discount,
        cast(detail.unit_price * detail.order_qty as decimal(38,6))
            as gross_amount,                                             -- valor total negociado (bruto)
        cast(detail.unit_price * detail.order_qty * detail.unit_price_discount as decimal(38,6))
            as discount_amount,                                          -- desconto do item
        cast(detail.unit_price * detail.order_qty * (1 - detail.unit_price_discount) as decimal(38,6))
            as net_amount                                               -- valor total negociado líquido
    from detail
    inner join header
        on detail.sales_order_id = header.sales_order_id

)

select * from final
