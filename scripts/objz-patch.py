#!/usr/bin/env python3
"""Measure 82.18 (AKX-2026-0009 / 0013, инженер C): глубина Z объёма стены — в выгрузку «для Akrix» (v3, wl[k].els[]).

Необязательное поле d (мм, > 0, от плоскости стены в помещение) у элементов листа t col / beam / box (выступ уходит как box) —
согласовано с конструктором (AKX-2026-0013, questions-constructor.md, З2): значение поля Z (sess.els[].D, без знака) или глубина
по умолчанию развёртки v81 (W3VK). Ниша — без d (уходит в стену). Остальные поля и контракт v3 — без изменений. Точная замена в inline v81 web/experimental.html; web/v81.html не меняется. Повторный запуск не меняет файл."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'web/experimental.html'
text = path.read_text()
MARK = '/* AKX-2026-0013 D */'
if MARK in text:
    print('objz-patch: already applied')
    raise SystemExit(0)
old = "y0: e.y, y1: r1(e.y + (e.H || 0)), note: e.note || '', ...(e.apx ? { apx: e.apx } : {})"
if text.count(old) != 1:
    raise SystemExit('objz-patch: expected exactly one anchor')
new = ("y0: e.y, y1: r1(e.y + (e.H || 0)), note: e.note || '', ...(['kol', 'rig', 'kor', 'vys'].includes(e.kind) ? { d: Math.abs(+e.D || W3VK[e.kind][2]) } : {}) " + MARK
       + ", ...(e.apx ? { apx: e.apx } : {})")
text = text.replace(old, new)
path.write_text(text)
print('objz-patch: wl[].els[].d (depth Z) in export')
