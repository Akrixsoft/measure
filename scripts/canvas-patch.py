"""82.18 (AKX-2026-0012, инженер B): attach lab-ctx.js (подмена состояния для отрисовки подложки) and
lab-board.js (поведение подложки kind:'board') after lab-title.js. lab-sketch.js is already attached (sketch-patch.py).
Inline v81 code is not changed. Idempotent: a second run is refused (exact single anchor)."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()
old = '<script src="lab-title.js"></script>\n'
if 'lab-board.js' in html:
    raise SystemExit('Already integrated: lab-board.js')
if html.count(old) != 1:
    raise SystemExit('Expected exactly one match: ' + old.strip())
html = html.replace(old, old + '<script src="lab-ctx.js"></script>\n<script src="lab-board.js"></script>\n')
path.write_text(html)
print('82.18 canvas (lab-ctx, lab-board) integrated')
