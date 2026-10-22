#!/usr/bin/env python3
"""
Compacta o export da mart `rpt_sales` (CSV, ~24 MB) em um JSON leve e
dicionário-codificado para o painel web (docs/index.html).

Estrutura de saída:
  dates[]           -> 'YYYY-MM-DD'
  categories[], subcategories[]
  products[]        -> [nome, subcategoria_idx, categoria_idx]
  customer_types[], customers[] -> [nome, tipo_idx]
  card_types[], statuses[], countries[], states[]
  geos[]            -> [cidade, estado_idx, pais_idx]
  reasons[]         -> nomes dos motivos de venda (bitmask por pedido)
  orders[]          -> [date_idx, order_id, customer_idx, card_idx, status_idx, geo_idx, reasons_mask]
  lines[]           -> [order_idx, product_idx, qty, gross, net]

Uso:
  python3 -I scripts/build_dashboard_data.py docs/rpt_sales.csv docs/data/sales.json
"""
import csv
import json
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal


class Dict:
    """Codificador de dicionário: valor -> índice inteiro estável."""

    def __init__(self):
        self.idx = {}
        self.vals = []

    def get(self, value):
        i = self.idx.get(value)
        if i is None:
            i = len(self.vals)
            self.idx[value] = i
            self.vals.append(value)
        return i


def num(text):
    """Converte '3578.270000' em 3578.27 sem lixo de ponto flutuante."""
    d = Decimal(text).normalize()
    return int(d) if d == d.to_integral_value() else float(d)


def main(src, dst):
    d_date, d_cat, d_subcat, d_ctype, d_card = Dict(), Dict(), Dict(), Dict(), Dict()
    d_status, d_country, d_state, d_reason = Dict(), Dict(), Dict(), Dict()
    d_prod, d_cust, d_geo = Dict(), Dict(), Dict()
    products, customers, geos = [], [], []
    order_index = {}
    orders, lines = [], []
    gross_2011 = Decimal(0)

    with open(src, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            # ---- data: aceita 'YYYY-MM-DD' ou 'YYYYMMDD' (export alternativo) e normaliza
            raw_date = row['order_date'].strip()
            if len(raw_date) == 8 and raw_date.isdigit():
                order_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
            else:
                order_date = raw_date[:10]
            row['order_date'] = order_date

            # ---- dimensões de produto (1 linha por produto)
            pname = row['product_name']
            if pname not in d_prod.idx:
                d_prod.get(pname)
                products.append([
                    pname,
                    d_subcat.get(row['subcategory_name'] or 'Sem subcategoria'),
                    d_cat.get(row['category_name'] or 'Sem categoria'),
                ])
            prod_idx = d_prod.idx[pname]

            # ---- pedido (atributos constantes por pedido)
            oid = int(row['sales_order_id'])
            o_idx = order_index.get(oid)
            if o_idx is None:
                cname = row['customer_name'] or '(cliente sem nome)'
                if cname not in d_cust.idx:
                    d_cust.get(cname)
                    customers.append([cname, d_ctype.get(row['customer_type'])])
                geo_key = (row['city'], row['state_province_name'], row['country_region_name'])
                if geo_key not in d_geo.idx:
                    d_geo.get(geo_key)
                    geos.append([
                        row['city'],
                        d_state.get(row['state_province_name']),
                        d_country.get(row['country_region_name']),
                    ])
                mask = 0
                reasons_txt = row['sales_reasons']
                if reasons_txt and reasons_txt != 'Sem motivo informado':
                    for r in reasons_txt.split(', '):
                        mask |= 1 << d_reason.get(r)
                o_idx = len(orders)
                order_index[oid] = o_idx
                orders.append([
                    d_date.get(row['order_date']),
                    oid,
                    d_cust.idx[cname],
                    d_card.get(row['card_type']),
                    d_status.get(row['status_name']),
                    d_geo.idx[geo_key],
                    mask,
                ])

            # ---- linha (item de pedido)
            gross = Decimal(row['gross_amount'])
            if row['order_date'].startswith('2011'):
                gross_2011 += gross
            lines.append([
                o_idx,
                prod_idx,
                int(row['order_qty']),
                num(row['gross_amount']),
                num(row['net_amount']),
            ])

    out = {
        'meta': {
            'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'source': 'fea_academy.dbt_arthur.rpt_sales (dbt mart)',
            'rows': len(lines),
            'orders': len(orders),
            'gross_2011': float(gross_2011.quantize(Decimal('0.01'))),
        },
        'dates': d_date.vals,
        'categories': d_cat.vals,
        'subcategories': d_subcat.vals,
        'products': products,
        'customer_types': d_ctype.vals,
        'customers': customers,
        'card_types': d_card.vals,
        'statuses': d_status.vals,
        'countries': d_country.vals,
        'states': d_state.vals,
        'geos': geos,
        'reasons': d_reason.vals,
        'orders': orders,
        'lines': lines,
    }

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))

    size_mb = os.path.getsize(dst) / 1e6
    print(f"ok: {len(lines)} linhas, {len(orders)} pedidos, {len(products)} produtos, "
          f"{len(customers)} clientes, {len(geos)} geografias, {len(d_reason.vals)} motivos")
    print(f"vendas brutas 2011 = {out['meta']['gross_2011']:,.2f}")
    print(f"arquivo: {dst} ({size_mb:.1f} MB)")


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
