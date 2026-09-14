with customer as (

    select * from {{ ref('stg_adventure_works__customer') }}

),

person as (

    select * from {{ ref('stg_adventure_works__person') }}

),

store as (

    select * from {{ ref('stg_adventure_works__store') }}

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['customer.customer_id']) }} as customer_key,
        customer.customer_id,
        customer.person_id,
        customer.store_id,
        customer.territory_id,
        case
            when customer.store_id is not null then 'Store'
            else 'Individual'
        end as customer_type,
        -- Nome do cliente: pessoa física (person.Name) ou, para revendedores,
        -- o nome da loja. Sem isso os maiores clientes (lojas) ficariam sem nome.
        case
            when customer.store_id is not null
                then coalesce(store.store_name, person.full_name)
            else person.full_name
        end as customer_name,
        person.first_name,
        person.last_name
    from customer
    left join person
        on customer.person_id = person.business_entity_id
    left join store
        on customer.store_id = store.business_entity_id

)

select * from final
