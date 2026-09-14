with product as (

    select * from {{ ref('stg_adventure_works__product') }}

),

subcategory as (

    select * from {{ ref('stg_adventure_works__product_subcategory') }}

),

category as (

    select * from {{ ref('stg_adventure_works__product_category') }}

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['product.product_id']) }} as product_key,
        product.product_id,
        product.product_name,
        product.product_number,
        product.color,
        product.product_line,
        subcategory.subcategory_name,
        category.category_name,
        product.standard_cost,
        product.list_price
    from product
    left join subcategory
        on product.product_subcategory_id = subcategory.product_subcategory_id
    left join category
        on subcategory.product_category_id = category.product_category_id

)

select * from final
