with source as (

    select * from {{ source('adventure_works', 'creditcard') }}

),

renamed as (

    select
        cast(creditcardid as bigint)  as credit_card_id,
        cardtype                      as card_type
    from source

)

select * from renamed
