-- Dimensão de calendário gerada (não existe tabela de datas no OLTP).
-- Intervalo cobre os dados de vendas do AdventureWorks (2011–2014).
with date_spine as (

    {{ dbt_utils.date_spine(
        datepart="day",
        start_date="cast('2011-01-01' as date)",
        end_date="cast('2015-01-01' as date)"
    ) }}

),

-- No Databricks o date_spine gera TIMESTAMP. Fixamos o tipo DATE aqui, ANTES de
-- derivar a surrogate key, para que o hash case com o de fct_sales.order_date
-- (md5 de '2011-05-31', e não de '2011-05-31 00:00:00').
dates as (

    select cast(date_day as date) as date_day
    from date_spine

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['date_day']) }} as date_key,
        date_day,
        year(date_day)                      as year_number,
        quarter(date_day)                   as quarter_number,
        month(date_day)                     as month_number,
        date_format(date_day, 'MMMM')       as month_name,
        date_format(date_day, 'yyyy-MM')    as year_month,
        day(date_day)                       as day_of_month,
        dayofweek(date_day)                 as day_of_week,
        date_format(date_day, 'EEEE')       as day_name
    from dates

)

select * from final
