with sales_reason as (

    select * from {{ ref('stg_adventure_works__sales_reason') }}

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['sales_reason_id']) }} as sales_reason_key,
        sales_reason_id,
        sales_reason_name,
        reason_type
    from sales_reason

)

select * from final
