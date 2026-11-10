#!/usr/bin/env python3
"""∠° view tilt (AKX-2026-0009): the v81 isometric view shift with a true screen angle.

Owner decision 11.11.2026: the slider tilts the whole wall view as in v81 —
side walls, floor, volumes (w3Vols) and labels move together through the one
shared projection w3PlD; nothing is opened/folded per wall (the 0.11
"display-only opening" by cos/sin is withdrawn). Side walls are again built by
native v81 w3Model from the plan/measured angles; the local floor of 0.6
(geometry-patch.py) is kept and is projected by the same function.

v81 projection of wall point (x, y, z) [z = depth toward the viewer, mm]:
    X = x + z * KX * ((2x/L - 1) + T),   Y = y - KP * z,   KX = KP = 0.6
with T = (90 - a) / 45. The depth axis at the wall middle (x = L/2) is then
(KX*T, -KP) per mm: 90 deg at a = 90 and 45/135 deg at a = 45/135, but only
~153/27 deg at a = 180/0, and a true 0/180 is unreachable with a constant KP.

Here the middle depth axis is rotated with constant length 0.6:
    T(a) = cos a,   Ky(a) = KP * sin a,   Y = y - Ky(a) * z
so on screen the angle from the front wall's floor line (+x) to the depth
direction at the wall middle (and the local floor centre line) equals a:
    atan2(KP sin a, KX cos a) = a          (KX = KP)
a = 90 is bit-identical to the v81 default; 45/135 give the same angles as v81.
The v81 fan around the middle stays: left/right edges at 90 + a/2 and a/2.
Only display/hit/inverse helpers change; room plan, measured angles, photo
transform, saved data and export are untouched.
"""
from pathlib import Path
import sys
path=Path(sys.argv[1]);text=path.read_text()
def replace(old,new):
 global text
 count=text.count(old)
 if count!=1:raise SystemExit(f'angle: expected one exact match, found {count}: {old[:110]}')
 text=text.replace(old,new)
# Depth shift at the wall middle = cos a; vertical depth factor = KP * sin a.
replace("w3T = () => Math.max(-2, Math.min(2, (90 - W3.a) / 45))",
"w3Ar = () => { const a = +W3.a; return (Number.isFinite(a) ? Math.max(0, Math.min(180, a)) : 90) * Math.PI / 180 }, w3T = () => { const c = Math.cos(w3Ar()); return Math.abs(c) < 1e-12 ? 0 : c } /* Measure Lab AKX-2026-0009: ∠° = true screen angle of the depth axis */, w3Ky = () => { const s = Math.sin(w3Ar()); return W3KP * (Math.abs(s) < 1e-12 ? 0 : s) }")
# Every consumer of the projection uses the same vertical factor: drawing,
# face visibility, the hit ray and the face-point -> wall inverse.
replace("p[1] - W3KP * p[2]", "p[1] - w3Ky() * p[2]")
replace("n[1] * W3KP + n[2] > 0.02", "n[1] * w3Ky() + n[2] > 0.02")
replace("const dr = [-w3Dx(p[0]), W3KP, 1];", "const dr = [-w3Dx(p[0]), w3Ky(), 1];")
replace("y = Q[1] + W3KP * z", "y = Q[1] + w3Ky() * z")
replace("w3T, w3Dx, w3DimOk", "w3T, w3Ky, w3Dx, w3DimOk")
# Native v81 slider (title, 0..180 step 1, labels, value) is kept; only an
# accessible name is added.
replace("const sp = sl.querySelectorAll('.t span'), up = () =>", "i.setAttribute('aria-label', t === 'a' ? 'Угол вида' : 'Размер полей и текста');\n  const sp = sl.querySelectorAll('.t span'), up = () =>")
path.write_text(text)
print('Applied ∠° view tilt: v81 shared projection, screen angle of depth axis = slider value')
