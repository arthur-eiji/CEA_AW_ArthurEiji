with source as (

    select * from {{ source('adventure_works', 'salesorderheader') }}

),

renamed as (

    select
        -- chaves
        -- Casts explícitos para bigint: a ingestão (pandas) converte colunas de
        -- inteiros que contêm NULL em double (ex.: creditcardid 5 -> 5.0). Sem o
        -- cast, a surrogate key (md5 do texto) não casa com a dimensão ('5.0' <> '5').
        cast(salesorderid as bigint)              as sales_order_id,
        cast(customerid as bigint)                as customer_id,
        cast(salespersonid as bigint)             as salesperson_id,
        cast(territoryid as bigint)               as territory_id,
        cast(billtoaddressid as bigint)           as bill_to_address_id,
        cast(shiptoaddressid as bigint)           as ship_to_address_id,
        cast(creditcardid as bigint)              as credit_card_id,

        -- atributos
        cast(orderdate as date)                   as order_date,
        cast(duedate as date)                     as due_date,
        cast(shipdate as date)                    as ship_date,
        cast(status as int)                       as status_code,
        onlineorderflag                           as is_online_order,

        -- medidas do cabeçalho (referência/reconciliação)
        cast(subtotal as decimal(19,4))           as subtotal,
        cast(taxamt as decimal(19,4))             as tax_amount,
        cast(freight as decimal(19,4))            as freight,
        cast(totaldue as decimal(19,4))           as total_due

    from source

)

select * from renamed
