/* =====================================================================
   Adventure Works — Painel de Vendas
   ---------------------------------------------------------------------
   Lê data/sales.json (extração da tabela de consumo rpt_sales, no grão de
   item de pedido) e agrega tudo no navegador. Sem bibliotecas externas:
   os gráficos são HTML/SVG desenhados aqui.

   Organização do arquivo:
     1. utilidades e formatação      5. dica de valores (tooltip)
     2. métricas                     6. componentes (tabela, barras, linha)
     3. dados e agregação            7. páginas
     4. filtros                      8. inicialização
   ===================================================================== */
(() => {
'use strict';

/* =====================================================================
   1. Utilidades e formatação (pt-BR)
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;   // textContent: rótulos vêm dos dados
  return e;
};
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, parent, text) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
};

const NF = (min, max) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
const nf0 = NF(0, 0), nf1 = NF(1, 1), nf2 = NF(2, 2);
const fmtInt = v => nf0.format(v);
const fmtMoney = v => 'US$ ' + nf2.format(v);
const fmtDec = (v, d) => NF(d, d).format(v);
const fmtPct = (v, d = 1) => NF(d, d).format(v * 100) + '%';
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Valor compacto para rótulos: 110,37 mi · 882,3 mil · 3.491
function compact(v, money) {
  const a = Math.abs(v);
  if (a >= 1e6) return nf2.format(v / 1e6) + ' mi';
  if (a >= 1e4) return nf1.format(v / 1e3) + ' mil';
  if (money && a < 100) return nf2.format(v);
  return nf0.format(v);
}
const usd = v => 'US$ ' + compact(v, true);
// Versão curta para a ponta das barras (3 algarismos significativos): 95,2 mi · 882 mil · 9.538
function short(v, money) {
  const a = Math.abs(v);
  const d = x => (x >= 100 ? nf0 : x >= 10 ? nf1 : nf2).format(x);
  if (a >= 1e6) return d(v / 1e6) + ' mi';
  if (a >= 1e4) return (a >= 1e5 ? nf0 : nf1).format(v / 1e3) + ' mil';
  if (money && a < 100) return nf2.format(v);
  return nf0.format(v);
}

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataBR = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

// ---- eixos: valores redondos
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function ticksFor(max, target, integer) {
  let step = niceStep(max / target);
  if (integer && step < 1) step = 1;
  const n = Math.max(1, Math.ceil(max / step - 1e-9));
  return { step, n, top: n * step };
}
// eixo vertical das séries: 4 a 6 marcas
function niceTicks(max, target, integer) {
  if (!(max > 0)) return [0, 1];
  const t = ticksFor(max, target, integer);
  return Array.from({ length: t.n + 1 }, (_, i) => +(i * t.step).toPrecision(12));
}
// eixo horizontal das barras: poucas marcas e o menor topo possível
function bestTicks(max, integer) {
  if (!(max > 0)) return [0, 1];
  let best = null;
  for (const target of [2, 3, 4]) {
    const t = ticksFor(max, target, integer);
    if (!best || t.top < best.top * (1 - 1e-9) || (Math.abs(t.top - best.top) <= best.top * 1e-9 && t.n < best.n)) best = t;
  }
  return Array.from({ length: best.n + 1 }, (_, i) => +(i * best.step).toPrecision(12));
}
// Rótulos das marcas, um estilo por eixo: por extenso abaixo de 10 mil (vertical) ou
// enquanto couberem lado a lado (horizontal); compactos (mil / mi) acima disso.
function tickLabels(ticks, vertical, fitPx) {
  const max = ticks[ticks.length - 1];
  const step = ticks.length > 1 ? ticks[1] - ticks[0] : max || 1;
  const dec = x => (Number.isInteger(+x.toFixed(6)) ? 0 : Number.isInteger(+(x * 10).toFixed(6)) ? 1 : 2);
  const full = () => { const d = dec(step); return ticks.map(t => NF(d, d).format(t)); };
  const inUnit = (u, suf) => { const d = dec(step / u); return ticks.map(t => (t === 0 ? '0' : NF(d, d).format(t / u) + suf)); };
  if (max >= 1e6) return inUnit(1e6, ' mi');
  if (max < 1e4) return full();
  if (vertical) return inUnit(1e3, ' mil');
  const f = full();
  return textPx(f) <= fitPx ? f : inUnit(1e3, ' mil');
}
const textPx = labels => labels.reduce((a, x) => a + x.length * 6.2 + 12, 0);

/* =====================================================================
   2. Métricas
   Cores fixas por métrica em todo o painel (ver styles.css).
   ===================================================================== */
const MEASURES = {
  gross:  { key: 'gross',  title: 'Valor negociado', abbr: 'Valor', unit: 'US$', unitShort: 'US$', color: 'var(--m-gross)', short: v => short(v, true), named: v => usd(v), sortLabel: 'valor negociado' },
  orders: { key: 'orders', title: 'Nº de pedidos', abbr: 'Pedidos', unit: 'pedidos distintos', unitShort: 'distintos', color: 'var(--m-orders)', short: v => short(v), named: v => compact(v) + (v === 1 ? ' pedido' : ' pedidos'), sortLabel: 'nº de pedidos', integer: true },
  qty:    { key: 'qty',    title: 'Quantidade', abbr: 'Qtd.', unit: 'unidades', unitShort: 'unid.', color: 'var(--m-qty)', short: v => short(v), named: v => compact(v) + ' unidades', sortLabel: 'quantidade', integer: true },
  ticket: { key: 'ticket', title: 'Ticket médio', abbr: 'Ticket', unit: 'US$ por pedido', unitShort: 'US$/ped.', color: 'var(--m-gross)', short: v => short(v, true), named: v => usd(v), sortLabel: 'ticket médio' },
  net:    { key: 'net',    title: 'Valor líquido', abbr: 'Líquido', unit: 'US$', unitShort: 'US$', color: 'var(--m-gross)', short: v => short(v, true), named: v => usd(v), sortLabel: 'valor líquido' },
};
const BASE = ['gross', 'orders', 'qty'];   // as três métricas pedidas em todas as dimensões

/* =====================================================================
   3. Dados e agregação
   ===================================================================== */
let D;        // dicionários do JSON
let O;        // colunas por pedido (arrays tipados)
let L;        // colunas por item de pedido
let P;        // colunas por produto
let DIM;      // dimensões: como chegar do item/pedido ao membro e como rotulá-lo
let MONTHS;   // [{ ym, mon, year, short, long }]
let YEARS;
let TOTAL;    // totais da base inteira, sem filtros
const N = {};
const AUDIT_2011 = 12646112.16;   // vendas brutas de 2011 confirmadas pela auditoria

const S = { page: 'visao-geral', sort: 'gross' };
const F = { monthFrom: 0, monthTo: 0 };
const FILTERS = [
  { key: 'category',    label: 'Categoria',       dim: 'category',    level: 'p' },
  { key: 'subcategory', label: 'Subcategoria',    dim: 'subcategory', level: 'p' },
  { key: 'product',     label: 'Produto',         dim: 'product',     level: 'p' },
  { key: 'card',        label: 'Tipo de cartão',  dim: 'card',        level: 'o' },
  { key: 'reason',      label: 'Motivo de venda', dim: 'reason',      level: 'r' },
  { key: 'status',      label: 'Status',          dim: 'status',      level: 'o' },
  { key: 'ctype',       label: 'Tipo de cliente', dim: 'ctype',       level: 'o' },
  { key: 'customer',    label: 'Cliente',         dim: 'customer',    level: 'o' },
  { key: 'country',     label: 'País',            dim: 'country',     level: 'o' },
  { key: 'state',       label: 'Estado',          dim: 'state',       level: 'o' },
  { key: 'city',        label: 'Cidade',          dim: 'city',        level: 'o' },
];
FILTERS.forEach(f => { F[f.key] = new Set(); });

function prepare(raw) {
  D = raw;
  const nO = raw.orders.length, nL = raw.lines.length, nP = raw.products.length;
  N.orders = nO; N.lines = nL; N.products = nP; N.customers = raw.customers.length;

  // calendário
  const yms = [...new Set(raw.dates.map(d => d.slice(0, 7)))].sort();
  MONTHS = yms.map(ym => {
    const year = +ym.slice(0, 4), mon = +ym.slice(5, 7);
    return { ym, year, mon, short: MES[mon - 1] + '/' + String(year).slice(2), long: MES_LONGO[mon - 1] + ' de ' + year };
  });
  YEARS = [...new Set(MONTHS.map(m => m.year))];
  const mIx = new Map(yms.map((m, i) => [m, i]));
  const yIx = new Map(YEARS.map((y, i) => [y, i]));

  // pedidos
  const I32 = () => new Int32Array(nO);
  O = { month: I32(), year: I32(), cust: I32(), ctype: I32(), card: I32(), status: I32(), geo: I32(), state: I32(), country: I32(), mask: I32(), all: I32() };
  raw.orders.forEach((r, o) => {
    const d = raw.dates[r[0]];
    O.month[o] = mIx.get(d.slice(0, 7));
    O.year[o] = yIx.get(+d.slice(0, 4));
    O.cust[o] = r[2];
    O.ctype[o] = raw.customers[r[2]][1];
    O.card[o] = r[3];
    O.status[o] = r[4];
    O.geo[o] = r[5];
    O.state[o] = raw.geos[r[5]][1];
    O.country[o] = raw.geos[r[5]][2];
    O.mask[o] = r[6];
  });

  // itens de pedido (ordenados por pedido: a contagem de pedidos distintos depende disso)
  L = { n: nL, order: new Int32Array(nL), prod: new Int32Array(nL), qty: new Float64Array(nL), gross: new Float64Array(nL), net: new Float64Array(nL) };
  let prev = -1;
  raw.lines.forEach((r, i) => {
    if (r[0] < prev) throw new Error('itens de pedido fora de ordem em data/sales.json');
    prev = r[0];
    L.order[i] = r[0]; L.prod[i] = r[1]; L.qty[i] = r[2]; L.gross[i] = r[3]; L.net[i] = r[4];
  });
  raw.lines = null;

  // produtos
  P = { self: Int32Array.from({ length: nP }, (_, i) => i), sub: Int32Array.from(raw.products, p => p[1]), cat: Int32Array.from(raw.products, p => p[2]) };
  const subCat = new Map(raw.products.map(p => [p[1], p[2]]));
  const stateCountry = new Map(raw.geos.map(g => [g[1], g[2]]));
  const nameCount = new Map();
  raw.customers.forEach(c => nameCount.set(c[0], (nameCount.get(c[0]) || 0) + 1));
  const ctypeName = i => (raw.customer_types[i] === 'Store' ? 'Loja revendedora' : 'Pessoa física');
  const idTxt = v => (v == null ? '' : ' · ID ' + v);

  DIM = {
    all:   { n: 1, by: 'o', key: O.all },
    month: { n: MONTHS.length, by: 'o', key: O.month, label: i => MONTHS[i].short },
    year:  { n: YEARS.length, by: 'o', key: O.year, label: i => String(YEARS[i]) },
    category: { n: raw.categories.length, by: 'p', key: P.cat, label: i => raw.categories[i] },
    subcategory: { n: raw.subcategories.length, by: 'p', key: P.sub, label: i => raw.subcategories[i], sub: i => raw.categories[subCat.get(i)] },
    product: {
      n: nP, by: 'p', key: P.self, label: i => raw.products[i][0], sub: i => raw.categories[P.cat[i]],
      detail: i => raw.categories[P.cat[i]] + ' · ' + raw.subcategories[P.sub[i]] + idTxt(raw.products[i][3]),
    },
    card:   { n: raw.card_types.length, by: 'o', key: O.card, label: i => (raw.card_types[i] === 'N/A' ? 'N/A (sem cartão)' : raw.card_types[i]) },
    status: { n: raw.statuses.length, by: 'o', key: O.status, label: i => raw.statuses[i] },
    ctype:  { n: raw.customer_types.length, by: 'o', key: O.ctype, label: ctypeName },
    customer: {
      n: N.customers, by: 'o', key: O.cust, label: i => raw.customers[i][0],
      sub: i => (raw.customer_types[raw.customers[i][1]] === 'Store' ? 'Loja' : 'Pessoa física'),
      detail: i => ctypeName(raw.customers[i][1]) + idTxt(raw.customers[i][2]),
      // nomes repetidos entre clientes diferentes: o ID desambigua no filtro
      opt: i => (nameCount.get(raw.customers[i][0]) > 1 && raw.customers[i][2] != null ? `${raw.customers[i][0]} (ID ${raw.customers[i][2]})` : raw.customers[i][0]),
    },
    country: { n: raw.countries.length, by: 'o', key: O.country, label: i => raw.countries[i] },
    state: {
      n: raw.states.length, by: 'o', key: O.state, label: i => raw.states[i], sub: i => raw.countries[stateCountry.get(i)],
      opt: i => raw.states[i] + ' · ' + raw.countries[stateCountry.get(i)],
    },
    city: {
      n: raw.geos.length, by: 'o', key: O.geo, label: i => raw.geos[i][0],
      sub: i => raw.states[raw.geos[i][1]] + ', ' + raw.countries[raw.geos[i][2]],
      opt: i => raw.geos[i][0] + ' · ' + raw.states[raw.geos[i][1]] + ', ' + raw.countries[raw.geos[i][2]],
    },
    // motivo de venda: um pedido pode ter vários (máscara de bits em O.mask)
    reason: { n: raw.reasons.length, multi: true, label: i => raw.reasons[i] },
  };

  F.monthFrom = 0; F.monthTo = MONTHS.length - 1;
  TOTAL = totals(masks(null));
}

// Pedidos e produtos que passam pelos filtros. `except` ignora o filtro de uma dimensão
// (usado para listar as opções daquela dimensão).
function masks(except) {
  const oOK = new Uint8Array(N.orders), pOK = new Uint8Array(N.products);
  let bits = 0;
  if (except !== 'reason') for (const r of F.reason) bits |= 1 << r;
  const pick = level => FILTERS.filter(f => f.level === level && f.key !== except && F[f.key].size).map(f => [DIM[f.dim].key, F[f.key]]);
  const oF = pick('o'), pF = pick('p');
  for (let o = 0; o < N.orders; o++) {
    const m = O.month[o];
    if (m < F.monthFrom || m > F.monthTo) continue;
    if (bits && !(O.mask[o] & bits)) continue;   // pedido precisa ter ao menos um dos motivos
    let ok = 1;
    for (let j = 0; j < oF.length; j++) if (!oF[j][1].has(oF[j][0][o])) { ok = 0; break; }
    oOK[o] = ok;
  }
  for (let p = 0; p < N.products; p++) {
    let ok = 1;
    for (let j = 0; j < pF.length; j++) if (!pF[j][1].has(pF[j][0][p])) { ok = 0; break; }
    pOK[p] = ok;
  }
  return { oOK, pOK };
}

// Pedidos distintos, quantidade, valor bruto e valor líquido por membro de uma dimensão.
// Os itens estão ordenados por pedido, então "último pedido visto" por membro basta
// para contar pedidos distintos em uma única passada.
function aggregate(dim, m) {
  const n = dim.n;
  const orders = new Float64Array(n), qty = new Float64Array(n), gross = new Float64Array(n), net = new Float64Array(n);
  const last = new Int32Array(n).fill(-1);
  const { oOK, pOK } = m, Lo = L.order, Lp = L.prod, Lq = L.qty, Lg = L.gross, Ln = L.net, nL = L.n;
  if (dim.multi) {
    const mask = O.mask;
    for (let i = 0; i < nL; i++) {
      const o = Lo[i]; if (!oOK[o]) continue;
      if (!pOK[Lp[i]]) continue;
      const b = mask[o]; if (!b) continue;
      for (let k = 0; k < n; k++) {
        if (!(b & (1 << k))) continue;
        qty[k] += Lq[i]; gross[k] += Lg[i]; net[k] += Ln[i];
        if (last[k] !== o) { last[k] = o; orders[k]++; }
      }
    }
  } else {
    const key = dim.key, byOrder = dim.by === 'o';
    for (let i = 0; i < nL; i++) {
      const o = Lo[i]; if (!oOK[o]) continue;
      const p = Lp[i]; if (!pOK[p]) continue;
      const k = byOrder ? key[o] : key[p];
      qty[k] += Lq[i]; gross[k] += Lg[i]; net[k] += Ln[i];
      if (last[k] !== o) { last[k] = o; orders[k]++; }
    }
  }
  return { orders, qty, gross, net };
}

function totals(m) {
  const a = aggregate(DIM.all, m);
  const t = { orders: a.orders[0], qty: a.qty[0], gross: a.gross[0], net: a.net[0] };
  t.ticket = t.orders ? t.net / t.orders : 0;
  const sc = new Uint8Array(N.customers), sp = new Uint8Array(N.products);
  let c = 0, p = 0;
  for (let i = 0; i < L.n; i++) {
    const o = L.order[i]; if (!m.oOK[o]) continue;
    const pr = L.prod[i]; if (!m.pOK[pr]) continue;
    const cu = O.cust[o];
    if (!sc[cu]) { sc[cu] = 1; c++; }
    if (!sp[pr]) { sp[pr] = 1; p++; }
  }
  t.customers = c; t.products = p;
  return t;
}

// Membros com vendas, ordenados pela métrica escolhida (desc). Devolve até `limit`
// linhas; `rows.total` guarda quantos membros existem.
function ranked(dimName, agg, { sort = 'gross', limit = 100, only = null, natural = false } = {}) {
  const dim = DIM[dimName];
  const idx = [];
  for (let i = 0; i < dim.n; i++) if (agg.orders[i] > 0 && (!only || only.has(i))) idx.push(i);
  const val = sort === 'ticket' ? i => agg.net[i] / agg.orders[i] : i => agg[sort][i];
  if (!natural) idx.sort((a, b) => val(b) - val(a) || a - b);
  const rows = idx.slice(0, limit).map((i, r) => ({
    rank: r + 1, id: i, label: dim.label(i),
    sub: dim.sub ? dim.sub(i) : '',
    detail: dim.detail ? dim.detail(i) : (dim.sub ? dim.sub(i) : ''),
    orders: agg.orders[i], qty: agg.qty[i], gross: agg.gross[i], net: agg.net[i],
    ticket: agg.net[i] / agg.orders[i],
  }));
  rows.total = idx.length;
  return rows;
}

/* =====================================================================
   4. Filtros
   ===================================================================== */
const optLabel = (dim, i) => (dim.opt ? dim.opt(i) : dim.label(i));
function sortedIds(dim) {
  if (!dim.sorted) {
    const labels = Array.from({ length: dim.n }, (_, i) => optLabel(dim, i));
    dim.sorted = labels.map((_, i) => i).sort((a, b) => collator.compare(labels[a], labels[b]));
    dim.optLabels = labels;
    dim.optNorm = labels.map(norm);
  }
  return dim.sorted;
}
const periodIsFull = () => F.monthFrom === 0 && F.monthTo === MONTHS.length - 1;
const activeFilters = () => FILTERS.filter(f => F[f.key].size).length + (periodIsFull() ? 0 : 1);

const MS = [];
const closePanels = () => MS.forEach(m => m.close());

class MultiSelect {
  constructor(host, def) {
    this.def = def; this.dim = DIM[def.dim]; this.sel = F[def.key]; this.panel = null;
    this.root = el('div', 'ms');
    this.btn = el('button'); this.btn.type = 'button'; this.btn.setAttribute('aria-haspopup', 'listbox');
    this.btn.addEventListener('click', () => (this.panel ? this.close() : this.open()));
    this.root.appendChild(this.btn); host.appendChild(this.root);
    this.refresh();
  }
  refresh() {
    let txt = 'Todos';
    if (this.sel.size === 1) txt = optLabel(this.dim, [...this.sel][0]);
    else if (this.sel.size > 1) txt = this.sel.size + ' selecionados';
    this.btn.textContent = `${this.def.label}: ${txt} ▾`;
    this.btn.classList.toggle('on', this.sel.size > 0);
  }
  open() {
    closePanels();
    const dim = this.dim, sel = this.sel;
    // opções = membros com pedidos nos DEMAIS filtros (mais os já selecionados)
    const agg = aggregate(dim, masks(this.def.key));
    const ids = sortedIds(dim).filter(i => agg.orders[i] > 0 || sel.has(i));
    ids.sort((a, b) => sel.has(b) - sel.has(a));   // selecionados primeiro (ordenação estável)

    const panel = el('div', 'panel'); panel.setAttribute('role', 'listbox');
    if (this.btn.getBoundingClientRect().left + 330 > window.innerWidth) panel.classList.add('right');
    const inp = el('input'); inp.type = 'search'; inp.placeholder = 'Buscar ' + this.def.label.toLowerCase() + '…'; inp.setAttribute('aria-label', 'Buscar ' + this.def.label);
    const list = el('div', 'list');
    const foot = el('div', 'foot'); const info = el('span'); const clr = el('button', 'link', 'Limpar'); clr.type = 'button';
    foot.append(info, clr); panel.append(inp, list, foot);
    this.root.appendChild(panel); this.panel = panel;

    const draw = () => {
      const q = norm(inp.value.trim());
      const hit = q ? ids.filter(i => dim.optNorm[i].includes(q)) : ids;
      list.replaceChildren();
      for (const i of hit.slice(0, 300)) {
        const lab = el('label');
        const cb = el('input'); cb.type = 'checkbox'; cb.checked = sel.has(i);
        cb.addEventListener('change', () => { if (cb.checked) sel.add(i); else sel.delete(i); this.refresh(); render(); });
        const n = el('span', 'n', fmtInt(agg.orders[i])); n.title = 'pedidos nos demais filtros';
        lab.append(cb, el('span', 'nm', dim.optLabels[i]), n);
        list.appendChild(lab);
      }
      info.textContent = hit.length > 300 ? `300 de ${fmtInt(hit.length)}: digite para refinar` : `${fmtInt(hit.length)} opções · nº = pedidos`;
    };
    inp.addEventListener('input', draw);
    clr.addEventListener('click', () => { sel.clear(); this.refresh(); draw(); render(); });
    draw(); inp.focus();
  }
  close() { if (this.panel) { this.panel.remove(); this.panel = null; } }
}

function buildFilters() {
  const preset = $('#preset'), from = $('#monthFrom'), to = $('#monthTo'), sortSel = $('#sortSel');
  preset.add(new Option('Todo o período', 'all'));
  YEARS.forEach(y => preset.add(new Option(String(y), String(y))));
  preset.add(new Option('Personalizado', 'custom'));
  MONTHS.forEach((m, i) => { from.add(new Option(m.short, i)); to.add(new Option(m.short, i)); });

  const sync = () => {
    from.value = F.monthFrom; to.value = F.monthTo;
    let v = 'custom';
    if (periodIsFull()) v = 'all';
    else for (const y of YEARS) {
      const ix = MONTHS.map((m, i) => (m.year === y ? i : -1)).filter(i => i >= 0);
      if (F.monthFrom === ix[0] && F.monthTo === ix[ix.length - 1]) v = String(y);
    }
    preset.value = v;
  };
  preset.addEventListener('change', () => {
    if (preset.value === 'all') { F.monthFrom = 0; F.monthTo = MONTHS.length - 1; }
    else if (preset.value !== 'custom') {
      const ix = MONTHS.map((m, i) => (String(m.year) === preset.value ? i : -1)).filter(i => i >= 0);
      F.monthFrom = ix[0]; F.monthTo = ix[ix.length - 1];
    }
    sync(); render();
  });
  from.addEventListener('change', () => { F.monthFrom = +from.value; if (F.monthTo < F.monthFrom) F.monthTo = F.monthFrom; sync(); render(); });
  to.addEventListener('change', () => { F.monthTo = +to.value; if (F.monthFrom > F.monthTo) F.monthFrom = F.monthTo; sync(); render(); });

  const host = $('#msHost');
  FILTERS.forEach(def => MS.push(new MultiSelect(host, def)));

  BASE.forEach(k => sortSel.add(new Option(MEASURES[k].title, k)));
  sortSel.value = S.sort;
  sortSel.addEventListener('change', () => setSort(sortSel.value));

  $('#clearBtn').addEventListener('click', () => {
    FILTERS.forEach(f => F[f.key].clear());
    F.monthFrom = 0; F.monthTo = MONTHS.length - 1;
    MS.forEach(m => m.refresh()); sync(); render();
  });
  document.addEventListener('click', e => { if (!e.target.closest('.ms')) closePanels(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });
  sync();
}
function setSort(key) {
  S.sort = key; $('#sortSel').value = key; render();
}

/* =====================================================================
   5. Dica de valores: o valor lidera, o rótulo acompanha
   ===================================================================== */
const tipEl = $('#tip');
function tipShow(c, x, y) {
  tipEl.replaceChildren();
  tipEl.appendChild(el('div', 'h', c.title));
  if (c.sub) tipEl.appendChild(el('div', 'hs', c.sub));
  const rs = el('div', 'rs');
  for (const r of c.rows) {
    const row = el('div', 'r');
    const k = el('i'); if (r.color) k.style.background = r.color;
    row.append(k, el('b', null, r.value), el('span', null, r.label));
    rs.appendChild(row);
  }
  tipEl.appendChild(rs);
  tipEl.hidden = false;
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, pad = 10;
  let left = x + 16, top = y + 16;
  if (left + w + pad > window.innerWidth) left = x - w - 16;
  if (top + h + pad > window.innerHeight) top = y - h - 16;
  tipEl.style.left = Math.max(pad, left) + 'px';
  tipEl.style.top = Math.max(pad, top) + 'px';
}
const tipHide = () => { tipEl.hidden = true; };

const rowTip = (r, T) => ({
  title: r.label, sub: r.detail,
  rows: [
    { color: MEASURES.gross.color, value: fmtMoney(r.gross), label: 'valor negociado' + (T.gross ? ` (${fmtPct(r.gross / T.gross)} do total)` : '') },
    { color: MEASURES.orders.color, value: fmtInt(r.orders), label: r.orders === 1 ? 'pedido' : 'pedidos' },
    { color: MEASURES.qty.color, value: fmtInt(r.qty), label: r.qty === 1 ? 'unidade' : 'unidades' },
    { color: null, value: fmtMoney(r.ticket), label: 'ticket médio' },
  ],
});

/* =====================================================================
   6. Componentes
   ===================================================================== */
const ROW_H = 30;                 // altura de cada linha de barras
const CAP = { S: 6, L: 10 };      // linhas por cartão: alturas padronizadas
const VIEW_H = { S: 40 + 6 * ROW_H + 24, L: 40 + 10 * ROW_H + 24 };   // cabeçalho + linhas + eixo

// ---- tabela (a versão em tabela de cada gráfico)
function renderTable(host, cols, rows, note) {
  host.replaceChildren();
  if (!rows.length) { host.appendChild(el('div', 'empty', 'Sem vendas para os filtros atuais.')); return; }
  const t = el('table', 'data');
  const hr = t.createTHead().insertRow();
  for (const c of cols) { const th = el('th', c.num ? 'num' : null, c.label); th.scope = 'col'; hr.appendChild(th); }
  const tb = t.createTBody();
  for (const r of rows) {
    const tr = tb.insertRow();
    for (const c of cols) { const td = tr.insertCell(); td.textContent = c.get(r); if (c.num) td.className = 'num'; }
  }
  host.appendChild(t);
  if (note) host.appendChild(el('div', 'tnote', note));
}
const metricCols = T => [
  { label: 'Valor negociado (US$)', num: true, get: r => nf2.format(r.gross) },
  { label: 'Nº de pedidos', num: true, get: r => fmtInt(r.orders) },
  { label: 'Quantidade', num: true, get: r => fmtInt(r.qty) },
  { label: 'Ticket médio (US$)', num: true, get: r => (r.orders ? nf2.format(r.ticket) : '–') },
  { label: '% do valor', num: true, get: r => (T.gross ? fmtPct(r.gross / T.gross) : '–') },
];

// ---- barras horizontais: uma coluna por métrica, cada uma com o seu eixo
function renderBars(host, rows, o) {
  host.replaceChildren();
  if (!rows.length) { host.appendChild(el('div', 'empty', 'Sem vendas para os filtros atuais.')); return; }
  const cols = o.cols.map(k => MEASURES[k]);
  const bt = el('div', 'bt');
  bt.style.setProperty('--cols', cols.length);
  bt.setAttribute('role', 'table'); bt.setAttribute('aria-label', o.aria);
  host.appendChild(bt);

  // cabeçalho: nome da dimensão e de cada métrica (clique ordena)
  const head = el('div', 'bt-row bt-head'); head.setAttribute('role', 'row');
  const dimH = el('div', 'bt-dim', o.dimLabel); dimH.setAttribute('role', 'columnheader');
  head.appendChild(dimH);
  for (const c of cols) {
    const h = el(o.sortable ? 'button' : 'div', 'bt-colh'); h.setAttribute('role', 'columnheader');
    if (o.sortable) { h.type = 'button'; h.title = 'Ordenar por ' + c.sortLabel; h.addEventListener('click', () => setSort(c.key)); }
    const l1 = el('span', 'l1');
    const key = el('i', 'key'); key.style.background = c.color;
    l1.append(key, el('span', 'nm', c.title));
    if (o.sortKey === c.key) { l1.appendChild(el('span', 'ar', '▼')); h.setAttribute('aria-sort', 'descending'); }
    h.append(l1, el('span', 'un', c.unit));
    head.appendChild(h);
  }
  bt.appendChild(head);

  // Largura disponível: em colunas estreitas os títulos são abreviados; sem espaço para
  // as barras (celular), o componente vira uma tabela só com os valores.
  const colW = head.lastElementChild.clientWidth;
  const labW = parseFloat(getComputedStyle(bt).getPropertyValue('--lab')) || 56;
  const noBars = colW - labW < 44;
  bt.classList.toggle('novis', noBars);
  if (colW < 124) {
    head.querySelectorAll('.bt-colh').forEach((h, j) => {
      h.querySelector('.nm').textContent = cols[j].abbr;
      h.querySelector('.un').textContent = cols[j].unitShort;
    });
  }

  const body = el('div', 'bt-body'); body.style.height = o.capacity * ROW_H + 'px';
  bt.appendChild(body);
  const scales = cols.map(c => {
    const ticks = bestTicks(Math.max(0, ...rows.map(r => r[c.key])), c.integer);
    return { ticks, top: ticks[ticks.length - 1] };
  });

  // linhas de grade nas marcas de cada eixo
  const grid = el('div', 'bt-row bt-grid'); grid.appendChild(el('div'));
  for (const s of noBars ? [] : scales) {
    const g = el('div', 'bt-gcol');
    s.ticks.forEach((t, i) => { const ln = el('i', i === 0 ? 'z' : null); ln.style.left = (t / s.top) * 100 + '%'; g.appendChild(ln); });
    grid.appendChild(g);
  }
  body.appendChild(grid);

  rows.forEach((r, i) => {
    const row = el('div', 'bt-row'); row.setAttribute('role', 'row'); row.tabIndex = 0;
    if (o.emphasize) row.classList.add(i === 0 ? 'win' : 'dim');
    const lab = el('div', 'bt-label'); lab.setAttribute('role', 'rowheader');
    if (o.rank) lab.appendChild(el('span', 'rk', String(r.rank)));
    lab.appendChild(el('span', 'nm', r.label));
    if (r.sub && o.inlineSub) lab.appendChild(el('span', 'sb', r.sub));
    row.appendChild(lab);
    cols.forEach((c, j) => {
      const cell = el('div'); cell.setAttribute('role', 'cell');
      const plot = el('div', 'bt-plot');
      const pct = scales[j].top > 0 ? (r[c.key] / scales[j].top) * 100 : 0;
      const bar = el('i', 'bt-bar'); bar.style.width = pct + '%'; bar.style.background = c.color;
      const val = el('span', 'bt-val', c.short(r[c.key])); val.style.left = pct + '%';
      plot.append(bar, val); cell.appendChild(plot); row.appendChild(cell);
    });
    row.addEventListener('pointermove', e => tipShow(o.tip(r), e.clientX, e.clientY));
    row.addEventListener('pointerleave', tipHide);
    row.addEventListener('focus', () => { const b = row.getBoundingClientRect(); tipShow(o.tip(r), b.left + 60, b.bottom - 6); });
    row.addEventListener('blur', tipHide);
    body.appendChild(row);
  });

  // texto auxiliar (estado, país, tipo) só aparece quando cabe de forma legível
  body.querySelectorAll('.sb').forEach(sb => { if (sb.scrollWidth > sb.clientWidth + 1 && sb.clientWidth < 56) sb.hidden = true; });

  // eixo de cada coluna
  if (noBars) return;
  const axis = el('div', 'bt-row bt-axis'); axis.setAttribute('aria-hidden', 'true'); axis.appendChild(el('div'));
  const plot0 = body.querySelector('.bt-plot');
  const track = plot0 ? plot0.clientWidth : 120;
  for (const s of scales) {
    const ax = el('div', 'bt-ax');
    const labels = tickLabels(s.ticks, false, track);
    const crowded = textPx(labels) > track;
    s.ticks.forEach((t, i) => {
      if (crowded && i !== 0 && i !== s.ticks.length - 1) return;
      const sp = el('span', null, labels[i]); sp.style.left = (t / s.top) * 100 + '%';
      ax.appendChild(sp);
    });
    axis.appendChild(ax);
  }
  bt.appendChild(axis);
}

// ---- série temporal (SVG). Os gráficos de um grupo compartilham o cursor.
const lineGroup = {
  charts: [], tip: null,
  hover(i, e) { this.charts.forEach(c => c && c.hover(i)); if (this.tip) tipShow(this.tip(i), e.clientX, e.clientY); },
  clear() { this.charts.forEach(c => c && c.clear()); tipHide(); },
};
function renderLine(host, pts, o) {
  host.replaceChildren();
  const n = pts.length;
  if (!n || !pts.some(p => p.v > 0)) { host.appendChild(el('div', 'empty', 'Sem vendas para os filtros atuais.')); return null; }
  const c = o.measure;
  const W = Math.max(host.clientWidth, 240), H = o.height;
  const m = { t: 24, r: 18, b: 50, l: 52 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const max = Math.max(...pts.map(p => p.v));
  const ticks = niceTicks(max, 4, c.integer), top = ticks[ticks.length - 1];
  const tl = tickLabels(ticks, true);
  const X = i => m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const Y = v => m.t + ph - (v / top) * ph;
  const s = svgEl('svg', { class: 'lc', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria }, host);

  // eixo Y: grade, valores e unidade
  ticks.forEach((t, i) => {
    const y = Math.round(Y(t)) + 0.5;
    svgEl('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: i === 0 ? 'bl' : 'gl' }, s);
    svgEl('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end' }, s, tl[i]);
  });
  svgEl('text', { x: 2, y: 11, class: 'tt' }, s, o.yTitle);

  // eixo X: meses (com o ano na primeira marca e em cada janeiro)
  const step = [1, 2, 3, 6, 12].find(st => pw / Math.max(1, (n - 1) / st) >= 44) || 12;
  const marks = pts.map((p, i) => i).filter(i => (pts[i].mon - 1) % step === 0);
  const shown = marks.length ? marks : [0, n - 1].filter((v, i, a) => a.indexOf(v) === i);
  shown.forEach((i, j) => {
    const x = X(i), y0 = m.t + ph;
    svgEl('line', { x1: x, x2: x, y1: y0, y2: y0 + 4, class: 'bl' }, s);
    svgEl('text', { x, y: y0 + 16, 'text-anchor': 'middle' }, s, MES[pts[i].mon - 1]);
    if (j === 0 || pts[i].mon === 1) svgEl('text', { x, y: y0 + 29, 'text-anchor': 'middle' }, s, String(pts[i].year));
  });
  svgEl('text', { x: m.l + pw / 2, y: H - 4, 'text-anchor': 'middle', class: 'tt' }, s, o.xTitle);

  // área (10%) e linha (2px)
  const d = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  if (n > 1) {
    svgEl('path', { d: `${d} L${X(n - 1).toFixed(1)} ${Y(0).toFixed(1)} L${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z`, class: 'area', style: `fill:${c.color}` }, s);
    svgEl('path', { d, class: 'ln', style: `stroke:${c.color}` }, s);
  }
  if (n <= 24) pts.forEach((p, i) => svgEl('circle', { cx: X(i), cy: Y(p.v), r: 4, class: 'dot', style: `fill:${c.color}` }, s));

  // rótulo direto só no pico
  const imax = pts.reduce((b, p, i) => (p.v > pts[b].v ? i : b), 0);
  const px = X(imax), py = Y(pts[imax].v), right = px > W - 170;
  if (n > 24) svgEl('circle', { cx: px, cy: py, r: 4, class: 'dot', style: `fill:${c.color}` }, s);
  svgEl('text', { x: right ? px - 9 : px + 9, y: Math.max(11, py - 7), 'text-anchor': right ? 'end' : 'start', class: 'pk' }, s, `pico: ${c.named(pts[imax].v)} em ${pts[imax].short}`);

  // cursor: linha vertical no mês mais próximo do ponteiro
  const ch = svgEl('line', { x1: 0, x2: 0, y1: m.t, y2: m.t + ph, class: 'ch', visibility: 'hidden' }, s);
  const hd = svgEl('circle', { r: 5, class: 'dot', style: `fill:${c.color}`, visibility: 'hidden' }, s);
  const hit = svgEl('rect', { x: m.l - 10, y: m.t - 8, width: pw + 20, height: ph + 16, class: 'hit' }, s);
  const at = e => {
    const x = e.clientX - s.getBoundingClientRect().left;
    return n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((x - m.l) / pw) * (n - 1))));
  };
  hit.addEventListener('pointermove', e => o.group.hover(at(e), e));
  hit.addEventListener('pointerleave', () => o.group.clear());
  return {
    hover(i) {
      const x = X(i);
      ch.setAttribute('x1', x); ch.setAttribute('x2', x); ch.setAttribute('visibility', 'visible');
      hd.setAttribute('cx', x); hd.setAttribute('cy', Y(pts[i].v)); hd.setAttribute('visibility', 'visible');
    },
    clear() { ch.setAttribute('visibility', 'hidden'); hd.setAttribute('visibility', 'hidden'); },
  };
}

// ---- cartões
const CARDS = {};
function makeCard(c) {
  const fig = el('figure', `card w${c.w}` + (c.size ? ' sz-' + c.size : ''));
  const cap = el('figcaption');
  const t = el('span', 't', c.title), s = el('span', 's');
  cap.append(t, s);
  if (c.tag) { const tg = el('span', 'tag', c.tag); tg.title = 'Pergunta de negócio respondida'; cap.appendChild(tg); }
  // cartões que são só tabela rolam por dentro em telas estreitas
  const view = el('div', c.kind === 'table' ? 'view scroll' : 'view'), table = el('div', 'tview'); table.hidden = true;
  const k = { cfg: c, fig, titleEl: t, subEl: s, view, table, mode: 'chart', draw: null, tab: null };
  if (c.kind !== 'table') {
    const b = el('button', 'tbl', 'Ver tabela'); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => {
      k.mode = k.mode === 'chart' ? 'table' : 'chart';
      b.setAttribute('aria-pressed', String(k.mode === 'table'));
      b.textContent = k.mode === 'table' ? 'Ver gráfico' : 'Ver tabela';
      paint(c.id);
    });
    cap.appendChild(b);
  }
  fig.append(cap, view, table);
  CARDS[c.id] = k;
  return fig;
}
function setCard(id, spec) {
  const k = CARDS[id];
  k.draw = spec.draw; k.tab = spec.tab || null;
  if (spec.sub != null) k.subEl.textContent = spec.sub;
  if (spec.title != null) k.titleEl.textContent = spec.title;
  paint(id);
}
function paint(id) {
  const k = CARDS[id];
  const chart = k.mode === 'chart' || !k.tab;
  k.view.hidden = !chart; k.table.hidden = chart;
  if (chart) k.draw(k.view); else k.tab(k.table);
}

// Cartão de barras de uma dimensão: as três métricas, ordenadas pela métrica escolhida.
function barsCard(id, dimName, agg, T, o = {}) {
  const k = CARDS[id], cfg = k.cfg;
  const capacity = CAP[cfg.size];
  const sortKey = o.sort || S.sort;
  const all = ranked(dimName, agg, { sort: sortKey, limit: 100, only: o.only });
  const rows = all.slice(0, o.n || capacity);
  const parts = [];
  if (o.note) parts.push(o.note);
  if (all.total > rows.length) parts.push(`${rows.length} de ${fmtInt(all.total)}`);
  parts.push('ordenado por ' + MEASURES[sortKey].sortLabel);
  const cols = o.cols || BASE;
  const tcols = [{ label: '#', num: true, get: r => r.rank }, { label: o.dimLabel, get: r => r.label }, ...(o.tableCols || metricCols(T))];
  if (o.detailLabel) tcols.push({ label: o.detailLabel, get: r => r.detail });
  setCard(id, {
    sub: parts.join(' · '),
    draw: host => renderBars(host, rows, {
      cols, dimLabel: o.dimLabel, capacity, rank: !!cfg.rank, sortable: !o.sort, sortKey,
      emphasize: !!o.emphasize, inlineSub: !!o.inlineSub, aria: cfg.title, tip: r => rowTip(r, T),
    }),
    tab: host => renderTable(host, tcols, all, all.total > all.length ? `Mostrando os ${all.length} primeiros de ${fmtInt(all.total)}.` : null),
  });
  return all;
}

/* =====================================================================
   7. Páginas (uma por tema)
   ===================================================================== */
function addSection(parent, { title, desc, cards }) {
  const sec = el('div', 'sec');
  const h = el('div', 'sec-h'); h.appendChild(el('h2', null, title)); sec.appendChild(h);
  const p = el('p', 'sec-d', desc); sec.appendChild(p);
  const grid = el('div', 'grid');
  cards.forEach(c => grid.appendChild(makeCard(c)));
  sec.appendChild(grid); parent.appendChild(sec);
  return { sec, desc: p, grid };
}

const PAGES = [
  {
    id: 'visao-geral', tab: 'Visão geral',
    build(root) {
      const k = el('div', 'kpi'); k.id = 'kpi'; root.appendChild(k);
      const s = addSection(root, {
        title: 'Evolução das vendas',
        desc: 'Valor total negociado, número de pedidos e quantidade comprada por mês do pedido. Os três gráficos usam o mesmo eixo de tempo: passe o cursor em um deles para ler o mesmo mês nos três. ',
        cards: [
          { id: 'm_gross', w: 4, size: 'S', kind: 'line', title: 'Valor total negociado por mês', tag: '4e' },
          { id: 'm_orders', w: 4, size: 'S', kind: 'line', title: 'Número de pedidos por mês', tag: '4e' },
          { id: 'm_qty', w: 4, size: 'S', kind: 'line', title: 'Quantidade comprada por mês', tag: '4e' },
          { id: 'by_year', w: 12, kind: 'table', title: 'Resumo por ano', tag: '4e' },
        ],
      });
      const note = el('span'); note.id = 'timeNote'; s.desc.appendChild(note);
    },
    render: renderOverview,
  },
  {
    id: 'produto', tab: 'Produto',
    build(root) {
      addSection(root, {
        title: 'Vendas por produto',
        desc: 'Valor negociado, número de pedidos e quantidade comprada por categoria, subcategoria e produto, e os produtos de maior ticket médio. Combine com os filtros de período e de geografia para ver o ticket médio por mês, ano, cidade, estado ou país.',
        cards: [
          { id: 'by_category', w: 6, size: 'S', kind: 'bars', title: 'Por categoria', tag: '4a' },
          { id: 'top_subcategory', w: 6, size: 'S', kind: 'bars', title: 'Top 5 subcategorias', tag: '4a', rank: true },
          { id: 'top_product', w: 6, size: 'L', kind: 'bars', title: 'Top 10 produtos', tag: '4a', rank: true },
          { id: 'ticket_product', w: 6, size: 'L', kind: 'bars', title: 'Top 10 produtos por ticket médio', tag: '4b', rank: true },
        ],
      });
    },
    render: renderProduct,
  },
  {
    id: 'cliente', tab: 'Cliente e pagamento',
    build(root) {
      addSection(root, {
        title: 'Vendas por cliente',
        desc: 'Os 10 melhores clientes nos filtros atuais, com as três métricas. Clientes com o mesmo nome são tratados separadamente, pelo identificador do ERP.',
        cards: [{ id: 'top_customer', w: 12, size: 'L', kind: 'bars', title: 'Top 10 clientes', tag: '4a · 4c', rank: true }],
      });
      addSection(root, {
        title: 'Tipo de cliente e forma de pagamento',
        desc: 'Lojas revendedoras compram por meio de vendedores; pessoas físicas compram online. "N/A" reúne os pedidos pagos sem cartão de crédito.',
        cards: [
          { id: 'by_ctype', w: 6, size: 'S', kind: 'bars', title: 'Por tipo de cliente', tag: '4a' },
          { id: 'by_card', w: 6, size: 'S', kind: 'bars', title: 'Por tipo de cartão', tag: '4a' },
        ],
      });
      addSection(root, {
        title: 'Status do pedido',
        desc: 'O ERP prevê seis status (In process, Approved, Backordered, Rejected, Shipped e Cancelled). Na base carregada todos os pedidos estão como Shipped; por isso a dimensão aparece em tabela, e não em gráfico de uma barra só.',
        cards: [{ id: 'by_status', w: 12, kind: 'table', title: 'Por status do pedido', tag: '4a' }],
      });
    },
    render: renderCustomer,
  },
  {
    id: 'geografia', tab: 'Geografia',
    build(root) {
      addSection(root, {
        title: 'Vendas por geografia',
        desc: 'País, estado e cidade do endereço de entrega do pedido. Cidades homônimas são diferenciadas pelo estado e pelo país.',
        cards: [
          { id: 'by_country', w: 6, size: 'S', kind: 'bars', title: 'Por país', tag: '4a' },
          { id: 'top_city', w: 6, size: 'S', kind: 'bars', title: 'Top 5 cidades', tag: '4a · 4d', rank: true },
          { id: 'top_state', w: 12, size: 'L', kind: 'bars', title: 'Top 10 estados', tag: '4a', rank: true },
        ],
      });
    },
    render: renderGeography,
  },
  {
    id: 'motivo', tab: 'Motivo de venda',
    build(root) {
      const sec = el('div', 'sec');
      const h = el('div', 'sec-h'); h.appendChild(el('h2', null, 'Vendas por motivo de venda')); sec.appendChild(h);
      const note = el('p', 'sec-d'); note.id = 'reasonNote'; sec.appendChild(note);
      const ans = el('div', 'answer'); ans.id = 'answer'; sec.appendChild(ans);
      const grid = el('div', 'grid');
      grid.appendChild(makeCard({ id: 'by_reason', w: 6, size: 'L', kind: 'bars', title: 'Por motivo de venda', tag: '4a' }));
      grid.appendChild(makeCard({ id: 'promo_product', w: 6, size: 'L', kind: 'bars', title: 'Top 10 produtos no motivo "On Promotion"', tag: '4f', rank: true }));
      sec.appendChild(grid); root.appendChild(sec);
    },
    render: renderReason,
  },
];

// ---- indicadores em três níveis: destaque, principais e de apoio
function renderKpis(T) {
  const k = $('#kpi'); k.replaceChildren();
  const lab = (text, color) => {
    const l = el('div', 'l');
    if (color) { const d = el('i', 'key'); d.style.background = color; l.appendChild(d); }
    l.appendChild(document.createTextNode(text));
    return l;
  };
  const hero = el('div', 'box kpi-hero');
  hero.append(
    lab('Valor total negociado', MEASURES.gross.color),
    el('div', 'v', usd(T.gross)),
    el('div', 'd', fmtMoney(T.gross) + ' · preço unitário × quantidade, antes de descontos'),
    el('div', 'd2', activeFilters()
      ? `${fmtPct(TOTAL.gross ? T.gross / TOTAL.gross : 0)} do valor de toda a base (${usd(TOTAL.gross)})`
      : `Toda a base, de ${dataBR(D.dates[0])} a ${dataBR(D.dates[D.dates.length - 1])}`),
  );
  const main = el('div', 'kpi-main');
  const tile = (text, color, value, detail) => {
    const b = el('div', 'box');
    b.append(lab(text, color), el('div', 'v', value), el('div', 'd', detail));
    return b;
  };
  main.append(
    tile('Número de pedidos', MEASURES.orders.color, fmtInt(T.orders), 'pedidos distintos'),
    tile('Quantidade comprada', MEASURES.qty.color, fmtInt(T.qty), 'unidades'),
    tile('Ticket médio', MEASURES.ticket.color, fmtMoney(T.ticket), 'valor líquido ÷ número de pedidos'),
  );
  const sub = el('div', 'box kpi-sub');
  const st = (text, value, detail) => {
    const s = el('div', 'st');
    s.append(el('div', 'l', text), el('div', 'v', value), el('div', 'd', detail));
    return s;
  };
  const disc = T.gross - T.net;
  sub.append(
    st('Valor líquido', usd(T.net), 'após descontos'),
    st('Descontos', usd(disc), (T.gross ? fmtPct(disc / T.gross, 2) : '0%') + ' do valor bruto'),
    st('Unidades por pedido', T.orders ? fmtDec(T.qty / T.orders, 1) : '–', 'quantidade ÷ pedidos'),
    st('Preço médio por unidade', T.qty ? fmtMoney(T.gross / T.qty) : '–', 'valor bruto ÷ quantidade'),
    st('Clientes com pedidos', fmtInt(T.customers), 'clientes distintos'),
    st('Produtos vendidos', fmtInt(T.products), `de ${fmtInt(N.products)} com vendas na base`),
  );
  k.append(hero, main, sub);
}

function renderOverview(m, T) {
  renderKpis(T);
  const a = aggregate(DIM.month, m);
  const from = F.monthFrom, to = F.monthTo;
  const months = MONTHS.slice(from, to + 1);
  const row = j => {
    const i = from + j;
    return { label: months[j].long, gross: a.gross[i], orders: a.orders[i], qty: a.qty[i], net: a.net[i], ticket: a.orders[i] ? a.net[i] / a.orders[i] : 0 };
  };
  const monthRows = months.map((_, j) => row(j));
  const monthCols = [{ label: 'Mês do pedido', get: r => r.label }, ...metricCols(T)];

  lineGroup.charts = [];
  lineGroup.tip = j => {
    const r = row(j);
    return { title: r.label, sub: '', rows: [
      { color: MEASURES.gross.color, value: fmtMoney(r.gross), label: 'valor negociado' },
      { color: MEASURES.orders.color, value: fmtInt(r.orders), label: 'pedidos' },
      { color: MEASURES.qty.color, value: fmtInt(r.qty), label: 'unidades' },
      { color: null, value: r.orders ? fmtMoney(r.ticket) : '–', label: 'ticket médio' },
    ] };
  };
  const yTitle = { gross: 'US$', orders: 'pedidos', qty: 'unidades' };
  BASE.forEach(key => {
    const pts = months.map((mm, j) => ({ ...mm, v: a[key][from + j] }));
    setCard('m_' + key, {
      draw: host => { lineGroup.charts.push(renderLine(host, pts, { measure: MEASURES[key], height: VIEW_H.S, yTitle: yTitle[key], xTitle: 'Mês do pedido', aria: CARDS['m_' + key].cfg.title, group: lineGroup })); },
      tab: host => renderTable(host, monthCols, monthRows),
    });
  });

  // resumo anual
  const ya = aggregate(DIM.year, m);
  const years = ranked('year', ya, { natural: true });
  const first = D.dates[0], last = D.dates[D.dates.length - 1];
  setCard('by_year', {
    sub: 'os mesmos números agregados por ano',
    draw: host => renderTable(host, [{ label: 'Ano', get: r => r.label }, ...metricCols(T)], years,
      `Anos parciais: a base começa em ${dataBR(first)} e termina em ${dataBR(last)}.`),
  });

  // aviso de mês incompleto no início da série
  const firstMonthDays = D.dates.filter(d => d.startsWith(MONTHS[0].ym)).length;
  $('#timeNote').textContent = F.monthFrom === 0 && firstMonthDays < 15
    ? `Atenção: ${MONTHS[0].short} tem só ${firstMonthDays} dia${firstMonthDays > 1 ? 's' : ''} de vendas (a base começa em ${dataBR(first)}).`
    : '';
}

function renderProduct(m, T) {
  barsCard('by_category', 'category', aggregate(DIM.category, m), T, { dimLabel: 'Categoria' });
  barsCard('top_subcategory', 'subcategory', aggregate(DIM.subcategory, m), T, { dimLabel: 'Subcategoria', detailLabel: 'Categoria', n: 5 });
  const prod = aggregate(DIM.product, m);
  barsCard('top_product', 'product', prod, T, { dimLabel: 'Produto', detailLabel: 'Categoria · subcategoria · ID' });
  barsCard('ticket_product', 'product', prod, T, {
    dimLabel: 'Produto', detailLabel: 'Categoria · subcategoria · ID',
    sort: 'ticket', cols: ['ticket', 'orders', 'net'], note: 'valor líquido ÷ nº de pedidos',
    tableCols: [
      { label: 'Ticket médio (US$)', num: true, get: r => nf2.format(r.ticket) },
      { label: 'Nº de pedidos', num: true, get: r => fmtInt(r.orders) },
      { label: 'Valor líquido (US$)', num: true, get: r => nf2.format(r.net) },
      { label: 'Quantidade', num: true, get: r => fmtInt(r.qty) },
    ],
  });
}

function renderCustomer(m, T) {
  barsCard('top_customer', 'customer', aggregate(DIM.customer, m), T, { dimLabel: 'Cliente', detailLabel: 'Tipo · ID', inlineSub: true });
  barsCard('by_ctype', 'ctype', aggregate(DIM.ctype, m), T, { dimLabel: 'Tipo de cliente' });
  barsCard('by_card', 'card', aggregate(DIM.card, m), T, { dimLabel: 'Tipo de cartão' });
  const status = ranked('status', aggregate(DIM.status, m), { sort: S.sort });
  setCard('by_status', {
    sub: 'número de pedidos, quantidade e valor por status',
    draw: host => renderTable(host, [{ label: 'Status', get: r => r.label }, ...metricCols(T)], status),
  });
}

function renderGeography(m, T) {
  barsCard('by_country', 'country', aggregate(DIM.country, m), T, { dimLabel: 'País' });
  barsCard('top_city', 'city', aggregate(DIM.city, m), T, { dimLabel: 'Cidade', detailLabel: 'Estado, país', n: 5, inlineSub: true });
  barsCard('top_state', 'state', aggregate(DIM.state, m), T, { dimLabel: 'Estado', detailLabel: 'País', inlineSub: true });
}

function renderReason(m, T) {
  // por motivo: com o filtro de motivo ativo, aparecem só os motivos selecionados
  barsCard('by_reason', 'reason', aggregate(DIM.reason, m), T, { dimLabel: 'Motivo de venda', only: F.reason.size ? F.reason : null });

  // nota de leitura: relação N:N e pedidos sem motivo
  const mo = masks('reason');
  let tot = 0, none = 0, multi = 0;
  const seen = new Uint8Array(N.orders);
  for (let i = 0; i < L.n; i++) {
    const o = L.order[i];
    if (seen[o] || !mo.oOK[o] || !mo.pOK[L.prod[i]]) continue;
    seen[o] = 1; tot++;
    const b = O.mask[o];
    if (!b) none++; else if (b & (b - 1)) multi++;
  }
  $('#reasonNote').textContent = 'Um pedido pode ter vários motivos de venda e muitos não têm nenhum, por isso o motivo fica fora da tabela fato e entra pela ponte br_order_sales_reason. '
    + 'No gráfico por motivo, um pedido com dois motivos conta nos dois: as barras não somam o total geral. '
    + (tot ? `Nos demais filtros atuais, ${fmtInt(none)} de ${fmtInt(tot)} pedidos (${fmtPct(none / tot, 0)}) não têm motivo informado e ${fmtInt(multi)} têm mais de um. ` : '')
    + 'O filtro "Motivo de venda" mantém os pedidos que têm pelo menos um dos motivos escolhidos.';

  // pergunta 4f: motivo fixo em On Promotion (não depende do filtro de motivo)
  const ix = D.reasons.indexOf('On Promotion');
  const ans = $('#answer'); ans.replaceChildren();
  ans.appendChild(el('span', 'q', 'Pergunta 4f · Qual produto tem a maior quantidade de unidades compradas para o motivo de venda "Promotion"?'));
  if (ix < 0) { ans.appendChild(document.createTextNode('O motivo "On Promotion" não existe nos dados carregados.')); return; }
  const bit = 1 << ix;
  const oOK = new Uint8Array(N.orders);
  for (let o = 0; o < N.orders; o++) oOK[o] = mo.oOK[o] && (O.mask[o] & bit) ? 1 : 0;
  const mp = { oOK, pOK: mo.pOK };
  const Tp = totals(mp);
  const rows = barsCard('promo_product', 'product', aggregate(DIM.product, mp), Tp, {
    dimLabel: 'Produto', detailLabel: 'Categoria · subcategoria · ID', sort: 'qty', emphasize: true, note: 'motivo fixo',
    tableCols: [
      { label: 'Quantidade', num: true, get: r => fmtInt(r.qty) },
      { label: 'Nº de pedidos', num: true, get: r => fmtInt(r.orders) },
      { label: 'Valor negociado (US$)', num: true, get: r => nf2.format(r.gross) },
    ],
  });
  if (!rows.length) { ans.appendChild(document.createTextNode('Nenhum pedido com o motivo "On Promotion" nos filtros atuais.')); return; }
  const w = rows[0];
  const add = (txt, bold) => ans.appendChild(bold ? el('b', null, txt) : document.createTextNode(txt));
  add(w.label, true); add(', com '); add(fmtInt(w.qty) + ' unidades', true);
  add(` em ${fmtInt(w.orders)} pedidos. No ERP o motivo se chama "On Promotion" ("Promotion" é o tipo dele): são ${fmtInt(Tp.orders)} pedidos e ${fmtMoney(Tp.gross)} negociados`);
  add(activeFilters() - (F.reason.size ? 1 : 0) > 0 ? ' nos filtros atuais.' : ' em toda a base.');
}

/* =====================================================================
   8. Inicialização
   ===================================================================== */
function renderCtx(T) {
  const c = $('#ctx'); c.replaceChildren();
  c.hidden = S.page === 'visao-geral';   // nessa página os indicadores já mostram os totais
  const it = (color, value, label) => {
    const s = el('span', 'it');
    if (color) { const k = el('i', 'key'); k.style.background = color; s.appendChild(k); }
    s.append(el('b', null, value), el('span', null, label));
    return s;
  };
  c.append(
    el('span', 'it', activeFilters() ? 'Nos filtros atuais:' : 'Base completa:'),
    it(MEASURES.gross.color, fmtMoney(T.gross), 'valor negociado'),
    it(MEASURES.orders.color, fmtInt(T.orders), 'pedidos'),
    it(MEASURES.qty.color, fmtInt(T.qty), 'unidades'),
    it(null, fmtMoney(T.ticket), 'ticket médio'),
  );
}

function render() {
  if (!D) return;
  tipHide();
  const m = masks(null), T = totals(m);
  renderCtx(T);
  PAGES.find(p => p.id === S.page).render(m, T);
  const n = activeFilters(), b = $('#clearBtn');
  b.disabled = n === 0;
  b.textContent = n ? `Limpar filtros (${n})` : 'Limpar filtros';
}

function go(id, push) {
  if (!PAGES.some(p => p.id === id)) id = PAGES[0].id;
  S.page = id;
  for (const p of PAGES) {
    $('#tab-' + p.id).setAttribute('aria-selected', String(p.id === id));
    $('#page-' + p.id).hidden = p.id !== id;
  }
  if (push) history.replaceState(null, '', '#' + id);
  render();
}

function buildShell() {
  const tabs = $('#tabs'), pages = $('#pages');
  for (const p of PAGES) {
    const b = el('button', null, p.tab); b.type = 'button'; b.id = 'tab-' + p.id;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'page-' + p.id);
    b.addEventListener('click', () => go(p.id, true));
    tabs.appendChild(b);
    const sec = el('section', 'page'); sec.id = 'page-' + p.id; sec.hidden = true;
    sec.setAttribute('role', 'tabpanel'); sec.setAttribute('aria-labelledby', b.id);
    p.build(sec); pages.appendChild(sec);
  }

  const first = D.dates[0], last = D.dates[D.dates.length - 1];
  $('#subtitle').textContent = `Data warehouse dimensional (Databricks + dbt) · ${fmtInt(N.lines)} itens de pedido em ${fmtInt(N.orders)} pedidos · ${dataBR(first)} a ${dataBR(last)}`;

  // selo de reconciliação: calculado aqui, com os dados carregados (não muda com os filtros)
  const y = YEARS.indexOf(2011);
  if (y >= 0) {
    const g = Math.round(aggregate(DIM.year, masks(null)).gross[y] * 100) / 100;
    if (Math.abs(g - AUDIT_2011) < 0.005) {
      const a = $('#audit');
      a.textContent = `Vendas brutas de 2011: ${fmtMoney(g)}, valor conferido com a auditoria`;
      a.hidden = false;
    }
  }

  const f = $('#footer');
  const add = (txt, href) => {
    const e = el(href ? 'a' : 'span', null, txt);
    if (href) { e.href = href; e.target = '_blank'; e.rel = 'noopener'; }
    f.appendChild(e);
  };
  add(`Fonte: tabela de consumo rpt_sales (dbt), extraída do Databricks em ${dataBR(D.meta.exported_at)}`);
  add('Valores em dólares americanos (US$)');
  add('Repositório do projeto no GitHub', 'https://github.com/arthur-eiji/CEA_AW_ArthurEiji');
  add('Certificação em Analytics Engineer (Indicium) · Arthur Eiji');

  // tema: automático → claro → escuro
  const order = ['auto', 'light', 'dark'], names = { auto: 'automático', light: 'claro', dark: 'escuro' };
  let ti = 0;
  $('#themeBtn').addEventListener('click', () => {
    ti = (ti + 1) % 3;
    if (order[ti] === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', order[ti]);
    $('#themeBtn').textContent = 'Tema: ' + names[order[ti]];
  });

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 150); });
  window.addEventListener('hashchange', () => go(location.hash.slice(1), false));
}

async function boot() {
  const res = await fetch('data/sales.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  prepare(await res.json());
  // totais sem filtros (prepare usa DIM/masks, que dependem do período completo)
  buildShell();
  buildFilters();
  $('#status').hidden = true;
  $('#app').hidden = false;
  go(location.hash.slice(1) || PAGES[0].id, false);
}

boot().catch(err => {
  $('#status').textContent = 'Não foi possível carregar os dados do painel (' + err.message + '). Abra a página por um servidor HTTP, como o GitHub Pages.';
  console.error(err);
});
})();
