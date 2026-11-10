-- Grão: 1 linha por item de pedido × motivo de venda.
-- Um pedido com N motivos gera N linhas (fan-out INTENCIONAL). Use esta tabela
-- apenas para análises POR motivo ou FILTRADAS por motivo (ex.: item 4f —
-- produto com maior quantidade para o motivo "On Promotion"). Não some totais sem filtrar
-- por motivo; para totais exatos use rpt_sales.
with sales as (

    select * from {{ ref('rpt_sales') }}

),

bridge as (

    select * from {{ ref('br_order_sales_reason') }}

),

reason as (

    select * from {{ ref('dim_sales_reason') }}

),

final as (

    select
        reason.sales_reason_name,
        reason.reason_type,
        sales.*
    from sales
    inner join bridge
        on sales.sales_order_id = bridge.sales_order_id
    inner join reason
        on bridge.sales_reason_key = reason.sales_reason_key

)

select * from final
