#!/usr/bin/env python3
"""Use one centered tangent label layout in experimental manual arrows only."""
from pathlib import Path
import sys
p=Path(sys.argv[1]);text=p.read_text()
changes=[
("    const t = String(dmVal(q)), tw = cx.measureText(t).width, M = [(A[0] + B[0]) / 2 + n[0] * 11 * d, (A[1] + B[1]) / 2 + n[1] * 11 * d];\n    cx.fillStyle = 'rgba(255,255,255,.92)'; cx.fillRect(M[0] - tw / 2 - 3 * d, M[1] - 8 * d, tw + 6 * d, 16 * d); cx.fillStyle = c; cx.fillText(t, M[0] - tw / 2, M[1]);", '    if (window.MeasureLabGeometry) MeasureLabGeometry.drawLabel(q);'),
("  if (o.lab) { cx.font = `700 ${12 * d}px system-ui`; const tw = cx.measureText(o.lab).width, bw = tw + 10 * d, bh = 17 * d, vert = Math.abs(v[1]) > Math.abs(v[0]), zi = w3IcZ(), sh = l < (vert ? bh : bw) + zi && l > 0.5, m = sh ? add(B, [(A[0] - B[0]) / l, (A[1] - B[1]) / l], zi / 2 + (vert ? bh : bw) / 2 + 4 * d) : [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], c = vert ? [m[0] + 13 * d, m[1]] : [m[0], m[1] - 13 * d];   /* короткая — подпись сдвинута к опоре (за неё), не на значке коммуникации */\n    cx.translate(c[0], c[1]); if (vert) cx.rotate(-Math.PI / 2); cx.fillStyle = '#fff'; cx.strokeStyle = o.col; cx.lineWidth = (o.sel ? 1.6 : 1) * d; cx.beginPath(); if (cx.roundRect) cx.roundRect(-bw / 2, -bh / 2, bw, bh, 3 * d); else cx.rect(-bw / 2, -bh / 2, bw, bh); cx.fill(); cx.stroke();\n    cx.fillStyle = o.col; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(o.lab, 0, 1 * d); const hw = (vert ? bh : bw) / 2 + 4 * d, hh = (vert ? bw : bh) / 2 + 4 * d; r = [c[0] - hw, c[1] - hh, c[0] + hw, c[1] + hh, c[0], c[1]] }", '  if (o.lab && window.MeasureLabGeometry) r = MeasureLabGeometry.drawRzLabel(A,B,o);'),
]
for old,new in changes:
 if text.count(old)!=1:raise SystemExit('Expected one exact centered label patch: '+old[:80])
 text=text.replace(old,new)
p.write_text(text)
print('Applied centered tangent measurement labels')
