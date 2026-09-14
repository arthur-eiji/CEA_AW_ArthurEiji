with source as (

    select * from {{ source('adventure_works', 'store') }}

),

renamed as (

    select
        cast(businessentityid as bigint)  as business_entity_id,
        name                              as store_name,
        cast(salespersonid as bigint)     as salesperson_id
    from source

)

select * from renamed
