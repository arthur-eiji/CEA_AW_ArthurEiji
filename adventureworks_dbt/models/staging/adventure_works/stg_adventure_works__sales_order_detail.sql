with source as (

    select * from {{ source('adventure_works', 'salesorderdetail') }}

),

renamed as (

    select
        -- chaves (cast explícito para bigint, ver comentário em sales_order_header)
        cast(salesorderdetailid as bigint)        as sales_order_detail_id,
        cast(salesorderid as bigint)              as sales_order_id,
        cast(productid as bigint)                 as product_id,
        cast(specialofferid as bigint)            as special_offer_id,

        -- medidas
        -- Obs.: `linetotal` é coluna computada no SQL Server original e NÃO existe
        -- no port PostgreSQL de onde os dados foram ingeridos. A fato reproduz a
        -- mesma fórmula (unit_price * order_qty * (1 - desconto)) como net_amount.
        cast(orderqty as int)                     as order_qty,
        cast(unitprice as decimal(19,4))          as unit_price,
        cast(unitpricediscount as decimal(19,4))  as unit_price_discount

    from source

)

select * from renamed
