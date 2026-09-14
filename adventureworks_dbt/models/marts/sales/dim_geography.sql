with address as (

    select * from {{ ref('stg_adventure_works__address') }}

),

state_province as (

    select * from {{ ref('stg_adventure_works__state_province') }}

),

country_region as (

    select * from {{ ref('stg_adventure_works__country_region') }}

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['address.address_id']) }} as geography_key,
        address.address_id,
        address.city,
        address.postal_code,
        state_province.state_province_name,
        state_province.state_province_code,
        country_region.country_region_name,
        country_region.country_region_code
    from address
    left join state_province
        on address.state_province_id = state_province.state_province_id
    left join country_region
        on state_province.country_region_code = country_region.country_region_code

)

select * from final
