# Roteiro do vídeo — Certificação Analytics Engineer (Adventure Works)

**Duração alvo: 9 min 30 s** (limite: 10 min). Cobre, na ordem, as 8 demonstrações exigidas
pelo enunciado. Cada bloco tem **TELA** (o que mostrar) e **FALA** (o que dizer).
Fale no seu ritmo natural; o texto é guia, não script pra ler.

---

## Preparação (antes de gravar)

**Janelas abertas, nesta ordem (cmd+tab entre elas):**
1. PDF do diagrama conceitual (`docs/modelo_conceitual_dw.pdf`)
2. Terminal na pasta do projeto, venv ativado, fonte grande (cmd + até ficar legível)
3. VS Code (ou editor) com o projeto dbt aberto
4. Databricks: aba **SQL Editor** com as 2 queries abaixo já coladas
5. Navegador: painel web aberto em <https://arthur-eiji.github.io/CEA_AW_ArthurEiji/> (aba Visão Geral, sem filtros)

**Queries prontas no SQL Editor (cole antes de gravar):**

```sql
-- (A) Fato + joins com as dimensões
SELECT
    d.date_day, p.product_name, c.customer_name, cc.card_type, s.status_name,
    g.city, g.country_region_name,
    f.order_qty, f.gross_amount, f.discount_amount, f.net_amount
FROM fea_academy.dbt_arthur.fct_sales f
JOIN fea_academy.dbt_arthur.dim_product      p  ON f.product_key        = p.product_key
JOIN fea_academy.dbt_arthur.dim_customer     c  ON f.customer_key       = c.customer_key
JOIN fea_academy.dbt_arthur.dim_credit_card  cc ON f.credit_card_key    = cc.credit_card_key
JOIN fea_academy.dbt_arthur.dim_order_status s  ON f.order_status_key   = s.order_status_key
JOIN fea_academy.dbt_arthur.dim_date         d  ON f.order_date_key     = d.date_key
JOIN fea_academy.dbt_arthur.dim_geography    g  ON f.ship_geography_key = g.geography_key
LIMIT 10;
```

```sql
-- (B) Teste de dado: vendas brutas 2011 (auditoria = 12.646.112,16)
SELECT ROUND(SUM(gross_amount), 2) AS vendas_brutas_2011
FROM fea_academy.dbt_arthur.fct_sales
WHERE YEAR(order_date) = 2011;
```

**Antes de dar REC:** rode `dbt run` uma vez "às escuras" pra aquecer o warehouse (a 1ª execução
do dia é mais lenta). Feche notificações (Foco/Não perturbe).

**Gravação:** QuickTime Player → *Arquivo → Nova Gravação de Tela* (já vem no Mac, grátis), ou OBS.
Grave a tela inteira + microfone.

---

## 0:00 – 0:45 · Abertura — objetivo e resultado esperado

**TELA:** PDF do diagrama (ou slide de título, se preferir).

**FALA:**
> "Esse é o projeto de Engenharia de Analytics da Adventure Works, uma indústria de bicicletas
> com mais de 500 produtos, 20 mil clientes e 31 mil pedidos. O objetivo foi construir uma
> plataforma moderna de dados, começando pela área de vendas, para responder às perguntas da
> diretoria com dados confiáveis. O resultado esperado tem duas partes: um data warehouse
> dimensional testado e documentado — atendendo ao pedido do CEO de garantir a veracidade dos
> números frente à auditoria — e um painel interativo em cima dele.
> A stack: dados brutos do ERP no Databricks, transformação com dbt Core, e um painel web
> interativo publicado junto com o código, no GitHub Pages. Tudo versionado no GitHub."

---

## 0:45 – 2:00 · Modelo dimensional — dimensões e relação com a fato

**TELA:** PDF do diagrama, apontando com o mouse.

**FALA:**
> "O modelo é um star schema. No centro, a `fct_sales`, com grão de **item de pedido** — cada
> linha é um produto dentro de um pedido. Escolhi esse grão porque é o mais fino: dele consigo
> responder qualquer pergunta por produto, cliente, cartão, status, data ou geografia.
> Em volta, seis dimensões conformadas, cada uma com surrogate key:
> `dim_product` vem de product, subcategoria e categoria; `dim_customer` de customer e person —
> e, para revendedores, o nome da loja; `dim_credit_card` do cartão, com um membro 'N/A' para
> pedidos sem cartão; `dim_order_status` decodifica o status numérico; `dim_date` é gerada no
> dbt; e `dim_geography` une address, state province e country region — cidade, estado e país.
> Um ponto de modelagem importante: **motivo de venda é muitos-para-muitos** com o pedido — um
> pedido pode ter vários motivos. Se eu colasse isso na fato, ela inflaria. Então usei uma
> **tabela-ponte**, `br_order_sales_reason`, que o painel usa só quando filtra por motivo."

---

## 2:00 – 3:15 · `dbt run` — todos os modelos rodando

**TELA:** Terminal. Digite `dbt run` e deixe rodar (~30 s). Enquanto roda, fale.

**FALA:**
> "Aqui o `dbt run` constrói tudo. O projeto tem duas camadas: **staging**, uma view por tabela
> fonte, onde eu padronizo nomes, fixo tipos e corrijo defeitos da ingestão; e **marts**, as
> dimensões, a fato e duas tabelas largas para o BI.
> A staging foi importante porque a ingestão trouxe alguns defeitos reais: o código 'NA' da
> Namíbia virou nulo — clássico de leitura de CSV; IDs com nulos chegaram como double; e a
> coluna `linetotal`, que é computada no SQL Server, não existe no port PostgreSQL. Tudo isso
> tratado na staging, sem os marts precisarem saber."

**TELA:** Mostrar o final: `Completed successfully` — 25 modelos.

> "25 modelos, todos com sucesso."

---

## 3:15 – 4:00 · Testes de source

**TELA:** Terminal: `dbt test --select source:*`

**FALA:**
> "Os testes de source validam os dados brutos antes de qualquer transformação: não-nulo e
> unicidade nas chaves, relacionamentos entre tabelas, valores aceitos no status.
> Todos passam, com **um warning** — que eu deixei de propósito: é justamente a linha da
> Namíbia com código nulo. O teste documenta o defeito na fonte, e a staging o repara. Prefiro
> um warning honesto a fingir que o dado bruto é perfeito."

---

## 4:00 – 4:45 · Testes nos modelos

**TELA:** Terminal: `dbt test` → `Done. PASS=112 WARN=1 ERROR=0`.

**FALA:**
> "Agora todos os testes do projeto: 112 passando. Nas dimensões e na fato, testes de chave
> primária — único e não-nulo — e testes de **relacionamento**: toda chave estrangeira da
> fato encontra sua dimensão, o que garante que nenhum join no BI perde linha. Tem também
> um teste que garante que a tabela larga do painel tem exatamente as mesmas linhas e o mesmo
> total da fato — ou seja, zero fan-out."

---

## 4:45 – 5:45 · Fato, joins e métricas

**TELA:** Databricks SQL Editor → rodar a query **(A)**.

**FALA:**
> "Aqui a fato com o join em todas as dimensões — uma linha por item de pedido, já com data,
> produto, cliente, cartão, status, cidade e país.
> As métricas da fato seguem o dicionário da empresa: `order_qty` é a quantidade comprada;
> `gross_amount` é `unit_price × order_qty`, o **valor total negociado**; `discount_amount` e
> `net_amount`, o valor líquido após desconto — necessário para o ticket médio, que a diretoria
> define como faturamento menos descontos dividido pelo número de pedidos. Número de pedidos é
> `count distinct` do `sales_order_id`, que fica na fato como *degenerate dimension* — é uma
> medida não-aditiva, então calculo no BI, não armazeno."

---

## 5:45 – 6:30 · Teste de dado (pedido do Carlos)

**TELA:** VS Code: abrir `tests/assert_gross_sales_2011.sql`. Depois SQL Editor: rodar **(B)**.

**FALA:**
> "O CEO pediu garantia de que as vendas brutas de 2011 batem com a auditoria:
> 12 milhões, 646 mil, 112 dólares e 16 centavos. Esse é um teste singular do dbt: ele soma o
> `gross_amount` de 2011 e **falha se divergir** — no dbt, um teste passa quando a query retorna
> zero linhas. Rodando a mesma soma direto no warehouse…"

**TELA:** resultado `12646112.16`.

> "…exatamente o número da auditoria. Se um dia alguém mudar a lógica da fato e esse número
> mudar, o `dbt test` quebra e ninguém publica um painel errado sem saber."

---

## 6:30 – 9:15 · Painel

**TELA:** Painel web, aba **Visão Geral**, sem filtros.

**FALA (KPIs e série):**
> "O painel é uma aplicação web publicada no GitHub Pages, construída diretamente sobre a mart
> `rpt_sales` do dbt — a mesma tabela que reconcilia com a auditoria — e é pública por link.
> Escolhi esse formato por três motivos: fica versionado junto com o código, não depende de
> licença nem de compartilhamento de conta, e me deu controle total sobre as boas práticas de
> visualização: um eixo por gráfico, uma cor por série, filtros numa única linha acima de tudo,
> e todo gráfico tem uma versão em tabela.
> Tem duas páginas. Na 'Visão Geral': número de pedidos, quantidade comprada, valor total
> negociado — reparem no selo verde: as vendas brutas de 2011 calculadas ao vivo aqui batem com
> a auditoria — e o ticket médio. Os três gráficos de série mensal mostram valor, pedidos e
> quantidade por mês e ano — a pergunta 4e."

**TELA:** Apontar os visuais de categoria, cartão, status, país.

> "As quebras por produto, tipo de cartão, status e geografia respondem a 4a."

**TELA:** Aplicar **dois filtros** (ex.: País = United States, Ano = 2013) e mostrar os visuais mudando.

> "Todos os filtros — período, país, estado, cidade, categoria, produto, cartão, status e
> cliente — atuam em todos os visuais. Com eles, o **Top 10 clientes** e o **Top 5 cidades**
> viram exatamente as perguntas 4c e 4d: filtrados por qualquer combinação."

**TELA:** Gráfico "Top 15 produtos por ticket médio"; clicar em **Tabela** num card qualquer.

> "E o ticket médio por produto — que com os filtros de período e geografia vira a pergunta 4b.
> Qualquer gráfico pode ser lido como tabela, pra acessibilidade e conferência."

**TELA:** Aba **Motivo de Venda** (o motivo "On Promotion" já vem selecionado).

> "Na segunda aba, motivo de venda — em grão pedido × motivo, por causa do muitos-para-muitos;
> a nota no topo explica por que esses totais não somam com a Visão Geral.
> A pergunta 4f: qual produto tem a maior quantidade comprada com motivo 'Promotion'?
> Com 'On Promotion' selecionado, cada pedido conta uma única vez…"

**TELA:** Barra de produtos ordenada; apontar o 1º.

> "…é o **Water Bottle - 30 oz.**, com **546 unidades** em 546 pedidos, entre os 3.515 pedidos
> com esse motivo. Faz sentido: promoção gira acessório de baixo valor e alto volume — a garrafa,
> o suporte de garrafa e o boné lideram; a primeira bicicleta aparece só em 4º."

---

## 9:15 – 9:45 · Encerramento

**TELA:** GitHub do projeto (README aberto).

**FALA:**
> "Resumindo: data warehouse dimensional no Databricks, transformado com dbt, com documentação,
> 113 testes — incluindo o de reconciliação com a auditoria — e um painel interativo que responde
> às seis perguntas da diretoria. Tudo está no repositório do GitHub, com README e guia de
> reprodução. Como próximos passos, o mesmo padrão se estende às outras áreas — compras,
> produção, RH — e às fontes de CRM e web analytics. Obrigado."

---

## Checklist final (pra não esquecer nada que o enunciado exige)

- [ ] Objetivo e resultados esperados (0:00)
- [ ] Dimensões e relação com a fato (0:45)
- [ ] `dbt run` com sucesso (2:00)
- [ ] `dbt test --select source:*` (3:15)
- [ ] `dbt test` (4:00)
- [ ] Fato + joins + métricas e por quê (4:45)
- [ ] Teste de dado (5:45)
- [ ] Painel: filtros, visuais, análises, **resposta do 4f** (6:30)
- [ ] Duração ≤ 10 min
- [ ] Upload no YouTube (não listado) ou Drive, link copiado
