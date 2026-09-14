with source as (

    select * from {{ source('adventure_works', 'stateprovince') }}

),

renamed as (

    select
        stateprovinceid     as state_province_id,
        stateprovincecode   as state_province_code,
        name                as state_province_name,
        countryregioncode   as country_region_code
    from source

)

select * from renamed
