with source as (

    select * from {{ source('adventure_works', 'salesreason') }}

),

renamed as (

    select
        salesreasonid  as sales_reason_id,
        -- Correção de qualidade: o ERP grava "Television  Advertisement" com dois
        -- espaços. Normalizamos espaços repetidos para que o nome do motivo seja
        -- estável em filtros e rótulos (a pergunta 4f filtra o motivo 'On Promotion').
        regexp_replace(trim(name), ' +', ' ')  as sales_reason_name,
        reasontype     as reason_type
    from source

)

select * from renamed
