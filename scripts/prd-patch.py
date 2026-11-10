"""AKX-2026-0013: подключение web/lab-prd.js (+ .css) — мебельные конструкции (изделия) на плане, выгрузка o.prd (З7).
Ставится сразу после lab-v012.js (зоны-комнаты). web/v81.html не меняется; правится только web/experimental.html.
Повторный запуск ничего не меняет."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()
tag = '<link rel="stylesheet" href="lab-prd.css">\n<script src="lab-prd.js"></script>\n'
if 'src="lab-prd.js"' not in html:
    anchor = '<script src="lab-v012.js"></script>\n'
    if html.count(anchor) != 1:
        raise SystemExit('Expected exactly one lab-v012.js include')
    html = html.replace(anchor, anchor + tag)
    path.write_text(html)
    print('lab-prd included after lab-v012.js')
else:
    print('lab-prd already included')
