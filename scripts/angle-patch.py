#!/usr/bin/env python3
"""Display-only sidewall opening. No room/measurement/export coordinates change.

The main wall stays on the unchanged v81 front projection. W3.a is now the
schematic opening alpha, not a camera shift: left=(cos a,0,sin a),
right=(-cos a,0,sin a). Existing saved side displacements are added afterwards.
The floor remains its independent local extrusion. Projection can make a true
3D right angle appear oblique on the screen; the control is not a protractor.
"""
from pathlib import Path
import sys
path=Path(sys.argv[1]);text=path.read_text()
def replace(old,new):
 global text
 count=text.count(old)
 if count!=1:raise SystemExit(f'angle: expected one exact match, found {count}: {old[:110]}')
 text=text.replace(old,new)
# Keep the original neighborhood lookup, span and correction offsets, but do not
# let measured/planned neighbor angles decide a purely visual fold control.
replace("    const node = m.pts.findIndex(p0 => p0[0] === Cn[0] && p0[1] === Cn[1]), aq = node >= 0 ? (m.angs || {})[node] || {} : {}, dirA = q0 => { const a = w3AnDeg(q0); if (a == null) return null; const dl = (a - 90) * Math.PI / 180; return [s1 < 0 ? -Math.sin(dl) : Math.sin(dl), Math.cos(dl)] };   /* v71: разворот угла — по угольнику */\n    const dT = dirA(aq.u) || dirA(aq.d), dB = dirA(aq.d) || dirA(aq.u);",
"    const va = Math.max(0, Math.min(180, Number(W3.a) || 0)) * Math.PI / 180, clean = n => Math.abs(n) < 1e-12 ? 0 : n;\n    const dT = [s1 < 0 ? clean(Math.cos(va)) : -clean(Math.cos(va)), clean(Math.sin(va))], dB = dT; /* Measure Lab: display-only opening; no ms/angles/measurements are written. */")
# A fold is not a camera yaw. Leave the fixed front/photo projection and inverse
# untouched and retain their existing shared use for all hits/annotations.
replace("w3T = () => Math.max(-2, Math.min(2, (90 - W3.a) / 45))", "w3T = () => 0 /* Measure Lab: fixed view while sidewalls open */")
# Selecting an invisible folded side should open both wings to a visible right
# angle; the old L135/R45 automatic camera shift no longer has valid semantics.
replace("W3.a = k === 'L' ? 135 : 45;", "W3.a = 90;")
replace('data-w3s="a" title="Угол вида"', 'data-w3s="a" title="Раскрытие боковых стен"')
replace("const sp = sl.querySelectorAll('.t span'), up = () => { sl.querySelector('.v').textContent = t === 'a' ? W3.a + '°' : Math.round(W3.f * 100) + ' %' };", "i.setAttribute('aria-label', t === 'a' ? 'Раскрытие боковых стен' : 'Размер полей и текста');\n  const sp = sl.querySelectorAll('.t span'), up = () => { sl.querySelector('.v').textContent = t === 'a' ? 'Раскрытие боковых стен · ' + W3.a + '°' : Math.round(W3.f * 100) + ' %' };")
replace("['0° · слева', '90° · прямо', '180° · справа']", "['0° · сложены', '90° · прямой угол', '180° · развёрнуты']")
replace("sl.querySelector('.v').textContent = W3.a + '°'", "sl.querySelector('.v').textContent = 'Раскрытие боковых стен · ' + W3.a + '°'")
path.write_text(text)
print('Applied display-only sidewall opening alpha; room geometry and fixed front/photo projection preserved')
