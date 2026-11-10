-- Tabela-ponte (N:N): liga cada pedido aos seus motivos de venda.
-- Usada pelo BI SOMENTE quando se filtra/agrupa por motivo de venda.
-- ATENÇÃO: fazer join da fato com esta ponte SEM filtrar por um único motivo
-- duplica pedidos que têm mais de um motivo (fan-out) e infla as medidas.
with bridge as (

    select * from {{ ref('stg_adventure_works__sales_order_header_sales_reason') }}

),

final as (

    select
        bridge.sales_order_id,
        {{ dbt_utils.generate_surrogate_key(['bridge.sales_reason_id']) }} as sales_reason_key,
        bridge.sales_reason_id
    from bridge

)

select * from final
