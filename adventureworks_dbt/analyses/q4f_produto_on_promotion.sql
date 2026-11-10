-- 4f) Qual produto tem a maior quantidade de unidades compradas para o motivo de venda
--     "Promotion"?
--
-- No ERP o motivo chama-se 'On Promotion'; 'Promotion' é o reason_type desse motivo, o
-- único do grupo. Por isso o filtro usa sales_reason_name = 'On Promotion', o mesmo valor
-- usado no painel. O teste tests/assert_on_promotion_reason_has_sales.sql garante que
-- esse nome continua existindo com vendas.
--
-- Fonte: rpt_sales_by_reason (1 linha por item de pedido × motivo). Com um único motivo
-- filtrado, cada item de pedido conta uma vez, sem fan-out.
--
-- Resposta (posição 1): Water Bottle - 30 oz., com 546 unidades.
--
-- Executar: dbt show --select q4f_produto_on_promotion --limit 10
with produtos as (

    select
        product_name,
        category_name,
        sum(order_qty)                  as quantidade_comprada,
        count(distinct sales_order_id)  as numero_pedidos,
        round(sum(gross_amount), 2)     as valor_total_negociado
    from {{ ref('rpt_sales_by_reason') }}
    where sales_reason_name = 'On Promotion'
    group by product_name, category_name

),

ranking as (

    select
        row_number() over (order by quantidade_comprada desc, product_name) as posicao,
        *
    from produtos

)

select *
from ranking
where posicao <= 10
order by posicao
