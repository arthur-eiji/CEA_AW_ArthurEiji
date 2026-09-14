-- =====================================================================
-- TESTE DE DADO (pedido do Carlos, CEO)
-- ---------------------------------------------------------------------
-- A equipe de auditoria da contabilidade confirmou que as VENDAS BRUTAS
-- de 2011 foram de US$ 12.646.112,16. Este teste garante que o número
-- produzido pela nossa fato bate exatamente com esse valor auditado.
--
-- Convenção do dbt: um teste PASSA quando a query retorna 0 linhas.
-- Retornamos linha(s) apenas se o valor calculado divergir do esperado.
--
-- "Vendas brutas" = valor total negociado = sum(unit_price * order_qty),
-- que corresponde à medida gross_amount da fato.
--
-- Se por acaso o número auditado casar com o valor LÍQUIDO (após desconto)
-- em vez do bruto, troque `gross_amount` por `net_amount`.
-- =====================================================================
with gross_2011 as (

    select
        round(sum(gross_amount), 2) as gross_sales_2011
    from {{ ref('fct_sales') }}
    where year(order_date) = 2011

)

select
    gross_sales_2011,
    {{ var('gross_sales_2011_expected') }} as expected_value
from gross_2011
where gross_sales_2011 <> {{ var('gross_sales_2011_expected') }}
