-- Ponte M:N: um pedido pode ter vários motivos de venda.
with source as (

    select * from {{ source('adventure_works', 'salesorderheadersalesreason') }}

),

renamed as (

    select
        salesorderid   as sales_order_id,
        salesreasonid  as sales_reason_id
    from source

)

select * from renamed
