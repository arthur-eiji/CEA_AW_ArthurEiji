with source as (

    select * from {{ source('adventure_works', 'person') }}

),

renamed as (

    select
        businessentityid  as business_entity_id,
        persontype        as person_type,
        firstname         as first_name,
        middlename        as middle_name,
        lastname          as last_name,
        -- concat_ws ignora nulos, evitando " " extra quando não há middle name
        trim(concat_ws(' ', firstname, middlename, lastname)) as full_name
    from source

)

select * from renamed
