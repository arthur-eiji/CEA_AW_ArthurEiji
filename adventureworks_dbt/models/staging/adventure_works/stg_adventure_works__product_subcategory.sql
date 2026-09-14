with source as (

    select * from {{ source('adventure_works', 'productsubcategory') }}

),

renamed as (

    select
        productsubcategoryid  as product_subcategory_id,
        productcategoryid     as product_category_id,
        name                  as subcategory_name
    from source

)

select * from renamed
