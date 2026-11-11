#!/usr/bin/env python3
"""Measure 82.18 (AKX-2026-0009 / 0013, инженер C): глубина Z объёма стены — в выгрузку «для Akrix» (v3, wl[k].els[]).

Необязательное поле d (мм, > 0, от плоскости стены в помещение) у элементов листа t col / beam / box (выступ уходит как box) —
согласовано с конструктором (AKX-2026-0013, questions-constructor.md, З2): значение поля Z (sess.els[].D, без знака) или глубина
по умолчанию развёртки v81 (W3VK). Ниша — d = |Z| (глубина в стену), только если задана (82.18 g2, QA: d = null у ниши). Остальные поля и контракт v3 — без изменений. Точная замена в inline v81 web/experimental.html; web/v81.html не меняется. Повторный запуск не меняет файл."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'web/experimental.html'
text = path.read_text()
MARK = '/* AKX-2026-0013 D2 */'   # 82.18 g2: + ниша (d = |Z|, только если глубина задана)
if MARK in text:
    print('objz-patch: already applied')
    raise SystemExit(0)
NEW = ("...(['kol', 'rig', 'kor', 'vys'].includes(e.kind) ? { d: Math.abs(+e.D || W3VK[e.kind][2]) } : e.kind === 'nis' && Math.abs(+e.D) > 0 ? { d: Math.abs(+e.D) } : {}) " + MARK)
OLD1 = "...(['kol', 'rig', 'kor', 'vys'].includes(e.kind) ? { d: Math.abs(+e.D || W3VK[e.kind][2]) } : {}) /* AKX-2026-0013 D */"
old = "y0: e.y, y1: r1(e.y + (e.H || 0)), note: e.note || '', ...(e.apx ? { apx: e.apx } : {})"
if text.count(OLD1) == 1:   # уже стояла первая версия (без ниши) — обновить
    text = text.replace(OLD1, NEW)
elif text.count(old) == 1:
    text = text.replace(old, "y0: e.y, y1: r1(e.y + (e.H || 0)), note: e.note || '', " + NEW + ", ...(e.apx ? { apx: e.apx } : {})")
else:
    raise SystemExit('objz-patch: expected exactly one anchor')
path.write_text(text)
print('objz-patch: wl[].els[].d (depth Z) in export, niche included')
