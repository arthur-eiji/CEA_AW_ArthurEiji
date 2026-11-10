-- 4a) Número de pedidos, quantidade comprada e valor total negociado por produto, tipo de
--     cartão, motivo de venda, data de venda, cliente, status, cidade, estado e país.
--
-- Uma consulta para todas as dimensões: cada bloco do UNION ALL projeta uma dimensão na
-- coluna `membro` e a agregação final calcula as três métricas. A coluna `dimensao` diz a
-- qual dimensão a linha pertence. O painel mostra estas mesmas métricas por dimensão.
--
-- Fontes: rpt_sales (1 linha por item de pedido, totais exatos) e, para o motivo de venda,
-- rpt_sales_by_reason (1 linha por item × motivo). Como um pedido pode ter vários motivos,
-- as linhas de "Motivo de venda" não somam o total geral.
--
-- Executar: dbt show --select q4a_metricas_por_dimensao --limit 100000
with por_dimensao as (

    select 'Produto' as dimensao, product_name as membro, sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

    union all

    select 'Tipo de cartão', card_type, sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

    union all

    select 'Motivo de venda', sales_reason_name, sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales_by_reason') }}

    union all

    select 'Data de venda', cast(order_date as string), sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

    union all

    -- o ID acompanha o nome porque clientes diferentes podem ter o mesmo nome
    select 'Cliente', concat(customer_name, ' (ID ', cast(customer_id as string), ')'),
           sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

    union all

    select 'Status', status_name, sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

    union all

    -- estado e país acompanham a cidade porque há cidades homônimas
    select 'Cidade', concat(city, ', ', state_province_name, ', ', country_region_name),
           sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

    union all

    select 'Estado', concat(state_province_name, ', ', country_region_name),
           sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

    union all

    select 'País', country_region_name, sales_order_id, order_qty, gross_amount
    from {{ ref('rpt_sales') }}

)

select
    dimensao,
    membro,
    count(distinct sales_order_id)  as numero_pedidos,
    sum(order_qty)                  as quantidade_comprada,
    round(sum(gross_amount), 2)     as valor_total_negociado
from por_dimensao
group by dimensao, membro
order by dimensao, valor_total_negociado desc
