with source as (

    select * from {{ source('adventure_works', 'customer') }}

),

renamed as (

    select
        -- personid/storeid têm NULL (cliente é pessoa OU loja) e chegam como double
        cast(customerid as bigint)   as customer_id,
        cast(personid as bigint)     as person_id,
        cast(storeid as bigint)      as store_id,
        cast(territoryid as bigint)  as territory_id
    from source

)

select * from renamed
