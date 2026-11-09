#!/usr/bin/env python3
"""Aa scales measurement annotations, never communication glyphs or world data.
Run after ui, geometry, labels and comms patches on the experimental copy only.
"""
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
def replace(old,new):
 global s
 if s.count(old)!=1: raise SystemExit(f'appearance: expected one exact match ({s.count(old)}): {old[:110]}')
 s=s.replace(old,new)
replace("function w3IcZ() { let f = 1; try { f = W3.f || 1 } catch (e) { } return 22 * (devicePixelRatio || 1) * f }", "function w3IcZ() { return 22 * (devicePixelRatio || 1) }")
replace("const w = Math.max(q.w, (window.MeasureLabSettings ? window.MeasureLabSettings.current.fieldPx : 10) * d), h = window.MeasureLabSettings ? Math.max(window.MeasureLabSettings.current.fieldPx, window.MeasureLabSettings.current.textPx + 2) * d : fs + 5 * d;", "const w = Math.max(q.w, (window.MeasureLabAppearance ? MeasureLabAppearance.fieldPx() : 10) * d), h = window.MeasureLabAppearance ? MeasureLabAppearance.fieldPx() * d : fs + 5 * d;")
# Scale the native annotation strokes explicitly at their use sites; zLW/zdW
# also serve physical object outlines and must not inherit Aa globally.
replace("cx.fillStyle = c; cx.lineWidth = zdW(1.6, sel);", "cx.fillStyle = c; cx.lineWidth = zdW(1.6, sel) * (window.MeasureLabAppearance ? MeasureLabAppearance.scale() : 1);")
replace("cx.fillStyle = c; cx.lineWidth = zdW(2.2, sel);", "cx.fillStyle = c; cx.lineWidth = zdW(2.2, sel) * (q.k === 'arr' && window.MeasureLabAppearance ? MeasureLabAppearance.scale() : 1);")
replace("lw = (o.sel ? 2.4 : 1.6) * d, v = sub(B, A)", "lw = (o.sel ? 2.4 : 1.6) * d * (window.MeasureLabAppearance ? MeasureLabAppearance.strokeFactor() : 1), v = sub(B, A)")
# Existing automatic communication dimensions share the same Aa contract.
start=s.index("function dimLine(a, b, side, txt, col)");end=s.index("function drawDims()",start)
prefix,suffix=s[:start],s[end:];s=s[start:end]
replace("B2 = add(B, n, o);\n  cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = 1.2 * d;", "B2 = add(B, n, o);\n  cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = 1.2 * d * (window.MeasureLabAppearance ? MeasureLabAppearance.strokeFactor() : 1);")
replace("add(add(P, u, 9 * d), n, 3 * d)", "add(add(P, u, 9 * d * (window.MeasureLabAppearance ? MeasureLabAppearance.scale() : 1)), n, 3 * d * (window.MeasureLabAppearance ? MeasureLabAppearance.scale() : 1))")
replace("add(add(P, u, 9 * d), n, -3 * d)", "add(add(P, u, 9 * d * (window.MeasureLabAppearance ? MeasureLabAppearance.scale() : 1)), n, -3 * d * (window.MeasureLabAppearance ? MeasureLabAppearance.scale() : 1))")
replace("cx.fillRect(-tw / 2 - 4 * d, -9 * d, tw + 8 * d, 18 * d);", "const fieldH = (window.MeasureLabAppearance ? MeasureLabAppearance.fieldPx() : 18) * d, fieldW = Math.max(tw + 8 * d, fieldH); cx.fillRect(-fieldW / 2, -fieldH / 2, fieldW, fieldH);")
replace("const hw = Math.max(tw / 2 + 6 * d, 20 * d), hh = 13 * d", "const hw = Math.max(fieldW / 2 + 2 * d, 20 * d), hh = Math.max(fieldH / 2 + 2 * d, 13 * d)")
s=prefix+s+suffix
p.write_text(s)
print('Applied Aa appearance contract, fixed glyph size and scoped annotation strokes')
