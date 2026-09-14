with source as (

    select * from {{ source('adventure_works', 'product') }}

),

renamed as (

    select
        cast(productid as bigint)            as product_id,
        name                                 as product_name,
        productnumber                        as product_number,
        -- productsubcategoryid tem NULL (componentes sem subcategoria) -> chega como double
        cast(productsubcategoryid as bigint) as product_subcategory_id,
        color                                as color,
        productline                          as product_line,
        cast(standardcost as decimal(19,4))  as standard_cost,
        cast(listprice as decimal(19,4))     as list_price
    from source

)

select * from renamed
