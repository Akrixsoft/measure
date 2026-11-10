#!/usr/bin/env python3
"""Measure 82.18 (AKX-2026-0012, инженер C): подключение модулей «инструменты, отмена, размеры» после lab-title.js.
Порядок: lab-history.js (журнал ↶ ↷, фото в снимке) → lab-tb.css / lab-tb.js (футляр, нижняя строка, одна 🗑, без 📐)
→ lab-obj.js (поля объектов: ручки и поля при любом инструменте, Z, длины плана) → lab-autodim.js (авторазмеры до граней).
Перед этим скриптом: scripts/undo-patch.py, scripts/autodim-patch.py (точные замены inline v81; web/v81.html не меняется).
Если модуль холста (инженер A, s8218-patch.py) подключает теги сам — этот скрипт не нужен: порядок тот же, после lab-title.js."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()
TAGS = ('<script src="lab-history.js"></script>\n<link rel="stylesheet" href="lab-tb.css">\n<script src="lab-tb.js"></script>\n'
        '<script src="lab-obj.js"></script>\n<script src="lab-autodim.js"></script>\n')
if 'src="lab-history.js"' in html:
    print('c8218: already integrated')
    raise SystemExit(0)
for f in ('lab-history.js', 'lab-tb.css', 'lab-tb.js', 'lab-obj.js', 'lab-autodim.js'):
    if not (path.parent / f).exists():
        raise SystemExit('c8218: missing ' + f)
old = '<script src="lab-title.js"></script>\n'
if html.count(old) != 1:
    raise SystemExit('c8218: expected exactly one match: ' + old)
html = html.replace(old, old + TAGS)
path.write_text(html)
print('c8218: lab-history, lab-tb, lab-obj, lab-autodim attached after lab-title.js')
