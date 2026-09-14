with source as (

    select * from {{ source('adventure_works', 'countryregion') }}

),

renamed as (

    select
        -- Correção de qualidade: a ingestão converteu o código "NA" (Namíbia) em NULL
        -- (armadilha clássica de leitura de CSV, onde "NA" vira NaN/NULL).
        -- Reparamos pelo nome do país; qualquer código ainda nulo é descartado abaixo.
        coalesce(
            countryregioncode,
            case when name = 'Namibia' then 'NA' end
        )                  as country_region_code,
        name               as country_region_name
    from source

),

final as (

    select * from renamed
    where country_region_code is not null

)

select * from final
