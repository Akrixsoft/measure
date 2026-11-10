#!/usr/bin/env python3
"""Measure 82.18 (AKX-2026-0012 §6, инженер C): авторазмеры стены цепочкой до граней элементов.

Одна точная вставка в w3Draw (inline v81 в web/experimental.html; web/v81.html не меняется): перед раскладкой полей
очередь полей LQ передаётся модулю web/lab-autodim.js (MeasureLabAutodim.chain), который режет рёбра стены объёмами,
добавляет цепочки «до грани» и убирает повторяющиеся подписи. Раскладка без наложений и отрисовка — штатные (w3Place).
Якорь не пересекается с правками наклона ∠° (angle-patch.py: w3Model / проекция). Повторный запуск не меняет файл."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'web/experimental.html'
text = path.read_text()
MARK = '/* AKX-2026-0012 autodim */'
if MARK in text:
    print('autodim-patch: already applied')
    raise SystemExit(0)
old = '  /* v71: раскладка полей — рёбра стены первыми; не налезают на уже поставленные поля и на кольца видимых углов */\n'
if text.count(old) != 1:
    raise SystemExit('autodim-patch: expected exactly one anchor')
new = ('  if (window.MeasureLabAutodim) try { MeasureLabAutodim.chain(LQ, { Md, VV, P, F, fv, cen, nf, d }) } catch (e) { console.error(e) }   ' + MARK + '\n') + old
text = text.replace(old, new)
path.write_text(text)
print('autodim-patch: w3Draw → MeasureLabAutodim.chain(LQ)')
