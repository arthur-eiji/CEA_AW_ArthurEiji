-- Dimensão derivada: decodifica o status numérico do pedido
-- (salesorderheader.status) em rótulos legíveis.
with statuses as (

    select 1 as status_code, 'In process'  as status_name union all
    select 2 as status_code, 'Approved'    as status_name union all
    select 3 as status_code, 'Backordered' as status_name union all
    select 4 as status_code, 'Rejected'    as status_name union all
    select 5 as status_code, 'Shipped'     as status_name union all
    select 6 as status_code, 'Cancelled'   as status_name

),

final as (

    select
        {{ dbt_utils.generate_surrogate_key(['status_code']) }} as order_status_key,
        status_code,
        status_name
    from statuses

)

select * from final
