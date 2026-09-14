-- Garante que a tabela larga rpt_sales NÃO sofreu fan-out nos joins com as
-- dimensões: precisa ter exatamente o mesmo nº de linhas e o mesmo total bruto
-- da fct_sales. Se qualquer dimensão tivesse chave duplicada, este teste falharia.
with fact as (

    select
        count(*)                     as n_rows,
        round(sum(gross_amount), 2)  as gross_total
    from {{ ref('fct_sales') }}

),

rpt as (

    select
        count(*)                     as n_rows,
        round(sum(gross_amount), 2)  as gross_total
    from {{ ref('rpt_sales') }}

)

select
    fact.n_rows       as fact_rows,
    rpt.n_rows        as rpt_rows,
    fact.gross_total  as fact_gross,
    rpt.gross_total   as rpt_gross
from fact
cross join rpt
where fact.n_rows <> rpt.n_rows
   or fact.gross_total <> rpt.gross_total
