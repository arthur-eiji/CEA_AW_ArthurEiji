-- =====================================================================
-- TESTE DE DADO: o motivo de venda da pergunta 4f existe e tem vendas
-- ---------------------------------------------------------------------
-- A pergunta de negócio 4f fala em motivo "Promotion", mas no ERP o
-- motivo chama-se 'On Promotion' ('Promotion' é o reason_type dele).
-- Um filtro com o nome errado não gera erro: só devolve zero linhas.
-- Este teste transforma esse silêncio em falha: ele quebra se o filtro
-- usado na consulta de apoio (analyses/q4f_produto_on_promotion.sql) e
-- no painel deixar de encontrar vendas.
--
-- Convenção do dbt: o teste passa quando a consulta retorna 0 linhas.
-- =====================================================================
with on_promotion as (

    select count(*) as itens_de_pedido
    from {{ ref('rpt_sales_by_reason') }}
    where sales_reason_name = 'On Promotion'

)

select itens_de_pedido
from on_promotion
where itens_de_pedido = 0
