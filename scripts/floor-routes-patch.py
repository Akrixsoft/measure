#!/usr/bin/env python3
"""Guarded baseline-only hook: plan routes painted once by the Lab module."""
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text()
a = "  (m.rt || []).forEach((q, i) => { zpPath(q.pts);"
b = "  (m.rt || []).forEach((q, i) => { if (window.MeasureLabFloorRoutes) return; zpPath(q.pts);"
if s.count(a) != 1:
    raise SystemExit('floor-routes-patch: expected exactly one native floor route painter')
p.write_text(s.replace(a, b))
print('floor route painter hook applied')
