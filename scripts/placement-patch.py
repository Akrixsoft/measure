#!/usr/bin/env python3
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
changes=[
("    if (zdrStart(p, e)) return;", "    if (window.MeasureLabPlacement && MeasureLabPlacement.begin(p, e)) return;\n    if (zdrStart(p, e)) return;"),
("} else if (ptr.size === 2) { const [a, b] = [...ptr.values()]; gest = { pinch: true,", "} else if (ptr.size === 2) { if (window.MeasureLabPlacement) MeasureLabPlacement.pinch(gest); const [a, b] = [...ptr.values()]; gest = { pinch: true,"),
("function pend(e) {\n  if (!ptr.has(e.pointerId)) return; const d = devicePixelRatio || 1, p = ptr.get(e.pointerId); ptr.delete(e.pointerId);", "function pend(e) {\n  if (!ptr.has(e.pointerId)) return; const d = devicePixelRatio || 1, p = ptr.get(e.pointerId); ptr.delete(e.pointerId);\n  if (window.MeasureLabPlacement && MeasureLabPlacement.cancel(e, gest)) { if (!ptr.size) gest = null; draw(); return; }")
]
for old,new in changes:
 n=s.count(old)
 if n!=1:raise SystemExit(f'Placement patch refused, expected1 got{n}: {old[:90]}')
 s=s.replace(old,new)
p.write_text(s)
print('Applied select-move-deselect-place gesture gate')
