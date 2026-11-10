#!/usr/bin/env python3
"""
Compacta a extração da tabela de consumo `rpt_sales` em um JSON leve para o painel
de vendas (docs/index.html).

A extração mantém o grão da fato (1 linha por item de pedido) e o painel agrega no
navegador. Para caber em poucos MB, os textos viram dicionários (cada valor distinto
é gravado uma vez) e as linhas guardam só índices e medidas.

Entrada (detectada pelo conteúdo do arquivo):
  - JSON gerado por `dbt show --output json` a partir da análise
    adventureworks_dbt/analyses/painel_export_rpt_sales.sql (caminho recomendado); ou
  - CSV exportado do SQL Editor do Databricks com as mesmas colunas.

Uso, a partir da pasta adventureworks_dbt:
  dbt show --quiet --select painel_export_rpt_sales --limit 200000 --output json > /tmp/rpt_sales.json
  python3 ../scripts/build_dashboard_data.py /tmp/rpt_sales.json ../docs/data/sales.json

Estrutura de saída:
  meta            informações da extração e totais de conferência
  dates[]         datas dos pedidos, 'AAAA-MM-DD', em ordem cronológica
  categories[], subcategories[], customer_types[], card_types[], statuses[],
  countries[], states[], reasons[]            dicionários de texto
  products[]      [nome, subcategoria_idx, categoria_idx, product_id]
  customers[]     [nome, tipo_idx, customer_id]
  geos[]          [cidade, estado_idx, pais_idx]
  orders[]        [data_idx, sales_order_id, cliente_idx, cartao_idx, status_idx,
                   geo_idx, mascara_de_motivos]
  lines[]         [pedido_idx, produto_idx, quantidade, valor_bruto, valor_liquido]

A máscara de motivos é um inteiro em que o bit i indica que o pedido tem o motivo
reasons[i]; um pedido pode ter vários motivos e a máscara 0 significa "sem motivo".
"""
import csv
import json
import math
import os
import sys
from datetime import datetime

NO_REASON = "Sem motivo informado"
REQUIRED = [
    "sales_order_id", "order_date", "product_name", "subcategory_name", "category_name",
    "customer_name", "customer_type", "card_type", "status_name", "city",
    "state_province_name", "country_region_name", "sales_reasons",
    "order_qty", "gross_amount", "net_amount",
]


def read_rows(path):
    """Lê a extração (JSON do `dbt show` ou CSV) como lista de dicionários."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    start = text.find("{")
    if start != -1 and '"show"' in text[start:start + 4000] or text.lstrip().startswith("{"):
        return json.loads(text[start:])["show"]
    return list(csv.DictReader(text.splitlines()))


def iso_date(value):
    """Aceita 'AAAA-MM-DD', 'AAAAMMDD' ou data com hora e devolve 'AAAA-MM-DD'."""
    s = str(value).strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    return s[:10]


def number(value):
    """Converte para número sem ruído de ponto flutuante (3578.270000 -> 3578.27)."""
    x = round(float(value), 6)
    return int(x) if x == int(x) else x


def index_of(values):
    """Dicionário ordenado: lista de valores distintos e mapa valor -> índice."""
    ordered = sorted(values)
    return ordered, {v: i for i, v in enumerate(ordered)}


def main(src, dst):
    rows = read_rows(src)
    if not rows:
        sys.exit("Extração vazia.")
    missing = [c for c in REQUIRED if c not in rows[0]]
    if missing:
        sys.exit(f"Colunas ausentes na extração: {missing}")
    has_ids = "customer_id" in rows[0] and "product_id" in rows[0]

    # ---- normalização linha a linha
    for r in rows:
        r["order_date"] = iso_date(r["order_date"])
        r["sales_order_id"] = int(r["sales_order_id"])
        r["subcategory_name"] = r["subcategory_name"] or "Sem subcategoria"
        r["category_name"] = r["category_name"] or "Sem categoria"
        r["customer_name"] = r["customer_name"] or "(cliente sem nome)"
        reasons = str(r["sales_reasons"] or "")
        r["_reasons"] = [] if reasons in ("", NO_REASON) else [x.strip() for x in reasons.split(", ")]
        # identidade: ID do ERP quando a extração traz; senão o nome
        r["_cust"] = int(r["customer_id"]) if has_ids else r["customer_name"]
        r["_prod"] = int(r["product_id"]) if has_ids else r["product_name"]
        r["_geo"] = (r["country_region_name"], r["state_province_name"], r["city"])

    # ---- dicionários (ordenados para a saída ser determinística)
    dates, date_ix = index_of({r["order_date"] for r in rows})
    categories, cat_ix = index_of({r["category_name"] for r in rows})
    subcategories, sub_ix = index_of({r["subcategory_name"] for r in rows})
    customer_types, ctype_ix = index_of({r["customer_type"] for r in rows})
    card_types, card_ix = index_of({r["card_type"] for r in rows})
    statuses, status_ix = index_of({r["status_name"] for r in rows})
    countries, country_ix = index_of({r["country_region_name"] for r in rows})
    states, state_ix = index_of({r["state_province_name"] for r in rows})
    reasons, reason_ix = index_of({x for r in rows for x in r["_reasons"]})

    prod_info, cust_info = {}, {}
    for r in rows:
        prod_info.setdefault(r["_prod"], (r["product_name"], r["subcategory_name"], r["category_name"]))
        cust_info.setdefault(r["_cust"], (r["customer_name"], r["customer_type"]))
    prod_keys = sorted(prod_info, key=lambda k: (prod_info[k][0], str(k)))
    cust_keys = sorted(cust_info, key=lambda k: (cust_info[k][0], str(k)))
    prod_ix = {k: i for i, k in enumerate(prod_keys)}
    cust_ix = {k: i for i, k in enumerate(cust_keys)}
    products = [[prod_info[k][0], sub_ix[prod_info[k][1]], cat_ix[prod_info[k][2]], k if has_ids else None]
                for k in prod_keys]
    customers = [[cust_info[k][0], ctype_ix[cust_info[k][1]], k if has_ids else None] for k in cust_keys]

    geo_keys, geo_ix = index_of({r["_geo"] for r in rows})
    geos = [[city, state_ix[state], country_ix[country]] for (country, state, city) in geo_keys]

    # ---- pedidos e itens, ordenados por pedido (o painel conta pedidos distintos
    #      varrendo os itens em sequência)
    rows.sort(key=lambda r: (r["sales_order_id"], prod_ix[r["_prod"]]))
    orders, order_ix, lines = [], {}, []
    for r in rows:
        oid = r["sales_order_id"]
        o = order_ix.get(oid)
        if o is None:
            mask = 0
            for name in r["_reasons"]:
                mask |= 1 << reason_ix[name]
            o = order_ix[oid] = len(orders)
            orders.append([date_ix[r["order_date"]], oid, cust_ix[r["_cust"]], card_ix[r["card_type"]],
                           status_ix[r["status_name"]], geo_ix[r["_geo"]], mask])
        lines.append([o, prod_ix[r["_prod"]], int(r["order_qty"]),
                      number(r["gross_amount"]), number(r["net_amount"])])

    gross_total = math.fsum(l[3] for l in lines)
    gross_2011 = math.fsum(l[3] for l in lines if dates[orders[l[0]][0]].startswith("2011"))
    exported_at = datetime.fromtimestamp(os.path.getmtime(src)).strftime("%Y-%m-%d")

    out = {
        "meta": {
            "source": "fea_academy.dbt_arthur.rpt_sales (tabela de consumo do dbt)",
            "exported_at": exported_at,
            "rows": len(lines),
            "orders": len(orders),
            "gross_total": round(gross_total, 2),
            "gross_2011": round(gross_2011, 2),
            "identity": "id" if has_ids else "name",
        },
        "dates": dates,
        "categories": categories,
        "subcategories": subcategories,
        "products": products,
        "customer_types": customer_types,
        "customers": customers,
        "card_types": card_types,
        "statuses": statuses,
        "countries": countries,
        "states": states,
        "geos": geos,
        "reasons": reasons,
        "orders": orders,
        "lines": lines,
    }

    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"itens de pedido: {len(lines):,} | pedidos: {len(orders):,} | produtos: {len(products):,} | "
          f"clientes: {len(customers):,} | cidades: {len(geos):,} | motivos: {len(reasons)}")
    print(f"valor bruto total: {gross_total:,.2f} | vendas brutas 2011: {gross_2011:,.2f}")
    print(f"identidade de cliente e produto: {'ID do ERP' if has_ids else 'nome (extração sem IDs)'}")
    print(f"arquivo: {dst} ({os.path.getsize(dst) / 1e6:.1f} MB) | extração de {exported_at}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
