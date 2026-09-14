with source as (

    select * from {{ source('adventure_works', 'productcategory') }}

),

renamed as (

    select
        productcategoryid  as product_category_id,
        name               as category_name
    from source

)

select * from renamed
