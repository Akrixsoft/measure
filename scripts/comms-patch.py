#!/usr/bin/env python3
"""RZ arrow colors: native renderer and additive export/import metadata only."""
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
def replace(old,new,count=1):
 global s
 n=s.count(old)
 if n!=count: raise SystemExit(f'comms patch: expected {count}, found {n}: {old[:90]}')
 s=s.replace(old,new)
replace("cx.strokeStyle = cx.fillStyle = '#1F6FD1'; cx.lineWidth = lw;", "cx.strokeStyle = cx.fillStyle = o.col || '#1F6FD1'; cx.lineWidth = lw;")
replace("cx.fillStyle = '#fff'; cx.strokeStyle = '#1F6FD1'; cx.lineWidth = 2 * d;", "cx.fillStyle = '#fff'; cx.strokeStyle = o.col || '#1F6FD1'; cx.lineWidth = 2 * d;")
replace("col: bad ? '#E0442B' : '#1F6FD1'", "col: q.c || (bad ? '#E0442B' : '#1F6FD1')")
replace("col: '#1F6FD1', ext: G.ext ? G.ext.map(P) : null", "col: (v.q && v.q.c) || (window.MeasureLabComms && MeasureLabComms.color) || '#1F6FD1', ext: G.ext ? G.ext.map(P) : null")
replace("  o.txt = rzTxt(o); return o;", "  if (/^#[0-9a-f]{6}$/i.test(q.c || '')) o.c = q.c; o.txt = rzTxt(o); return o;")
replace("return z.ok && +q.v > 0 ? { t: 'from', rz: { ...r, ts: 1 }, vm: +q.v } : { t: 'from', rz: r, vm: undefined }", "return z.ok && +q.v > 0 ? { t: 'from', rz: { ...r, ts: 1 }, vm: +q.v, ...(/^#[0-9a-f]{6}$/i.test(z.c || '') ? {c:z.c} : {}) } : { t: 'from', rz: r, vm: undefined, ...(/^#[0-9a-f]{6}$/i.test(z.c || '') ? {c:z.c} : {}) }")
replace('data-rz title="Размеры коммуникаций: стрелка-размер с полем (свой набор внизу)"', 'data-rz aria-label="Коммуникации и размеры" title="Коммуникации и размеры: размещение элементов и ручные размеры"')
replace('📐 Размеры коммуникаций: касание у розетки / вывода или протяжка со стороны', 'Коммуникации и размеры: выберите элемент или стрелку')
replace('Размеры коммуникаций — на стене (вид стены)', 'Коммуникации и размеры доступны в виде стены')
replace("KINDS.filter(k => k.pt).map(k => k.k), 'znd', 'wrt'", "KINDS.filter(k => k.pt).map(k => k.k), 'znd', 'wrt', 'zon'")
replace("['Зоны и геометрия', ['zon', 'znt', 'znf', 'poly']]", "['Зоны и геометрия', ['znt', 'znf', 'poly']]")
p.write_text(s)
print('RZ color patch applied')
