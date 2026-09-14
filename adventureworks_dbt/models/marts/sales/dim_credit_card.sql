with credit_card as (

    select
        credit_card_id,
        card_type
    from {{ ref('stg_adventure_works__credit_card') }}

    union all

    -- membro "desconhecido" para pedidos sem cartão (chave -1).
    -- Mantém a integridade referencial da fato (todo pedido acha um cartão).
    select
        -1        as credit_card_id,
        'N/A'     as card_type

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['credit_card_id']) }} as credit_card_key,
        credit_card_id,
        card_type
    from credit_card

)

select * from final
