#!/usr/bin/env python3
"""Apply narrowly scoped field-layout fixes to an exact v81 copy.

Usage: python scripts/ui-patch.py web/experimental.html
The original web/v81.html is never touched by integration.
"""
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
changes = [
    (
        'const w = q.w, h = fs + 5 * d; let an = Math.atan2(q.B2[1] - q.A2[1], q.B2[0] - q.A2[0]);',
        'const w = Math.max(q.w, (window.MeasureLabSettings ? window.MeasureLabSettings.current.fieldPx : 10) * d), h = window.MeasureLabSettings ? Math.max(window.MeasureLabSettings.current.fieldPx, window.MeasureLabSettings.current.textPx + 2) * d : fs + 5 * d; let an = Math.atan2(q.B2[1] - q.A2[1], q.B2[0] - q.A2[0]);',
        1,
    ),
]
for old, new, expected in changes:
    actual = text.count(old)
    if actual != expected:
        raise SystemExit(f'UI patch refused: expected {expected} exact matches, got {actual}: {old[:90]}')
for old, new, _ in changes:
    text = text.replace(old, new)
path.write_text(text)
print('Measure Lab UI patch: field height and minimum width applied')
