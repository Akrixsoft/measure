#!/usr/bin/env python3
"""Measure 82.18 (AKX-2026-0012, инженер C): фото-справки — в штатном снимке шага ↶ ↷; история стены переживает перезапуск.

Точные замены в inline v81 внутри web/experimental.html (web/v81.html не меняется):
  1. snap / unsnap / zState: в снимок добавлено refs: S.refs (фото-справки стены и подложки холста);
  2. undo: снимок с refs возвращает S.refs (выбор фото снимается, если фото больше нет);
  3. doSave: в базу пишутся все шаги-снимки (без шагов-замыканий ZA), а не только шаги после последнего ZA —
     удаление и добавление фото (lab-history.js переводит их со ZA на snap) переживают перезапуск;
  4. dmGeo: на подложке холста (sess.kind === 'board') длина без масштаба не показывается — «?» до ввода значения.
Запуск: python3 scripts/undo-patch.py [web/experimental.html] — до подключения lab-history.js (scripts/c8218-patch.py).
Повторный запуск не меняет файл (маркер «AKX-2026-0012 undo»)."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / 'web/experimental.html'
text = path.read_text()
MARK = '/* AKX-2026-0012 undo */'
if MARK in text:
    print('undo-patch: already applied')
    raise SystemExit(0)


def replace(old, new, n=1):
    global text
    c = text.count(old)
    if c != n:
        raise SystemExit(f'undo-patch: expected {n} exact match(es), found {c}: {old[:110]}')
    text = text.replace(old, new)


OLD = '{ lines: S.lines, els: S.els, man: S.man, notes: S.notes, dms: S.dms, drw: S.drw, rts: S.rts, polys: S.polys }'
NEW = '{ lines: S.lines, els: S.els, man: S.man, notes: S.notes, dms: S.dms, drw: S.drw, rts: S.rts, polys: S.polys, refs: S.refs || [] }'
# snap, unsnap, zState — один и тот же снимок (3 места)
replace('S.und.push(JSON.stringify(' + OLD + '));', 'S.und.push(JSON.stringify(' + NEW + ')); ' + MARK)
replace("t === JSON.stringify(" + OLD + ")) S.und.pop()", "t === JSON.stringify(" + NEW + ")) S.und.pop()")
replace('const zState = () => JSON.stringify(' + OLD + ');', 'const zState = () => JSON.stringify(' + NEW + ');   ' + MARK)
# undo: фото-справки из снимка
replace("if (o.polys) S.polys = o.polys; if (S.dsel && !zdGet(S.dsel)) S.dsel = null;",
        "if (o.polys) S.polys = o.polys; if (o.refs) { S.refs = o.refs; if (S.rsel && !(S.refs || []).some(r => r.id === S.rsel)) S.rsel = null } " + MARK + " if (S.dsel && !zdGet(S.dsel)) S.dsel = null;")
# doSave: снимки — все (без несохраняемых ZA), последние 40
replace("und: S.und.slice(S.und.map(t => t.startsWith('ZA:')).lastIndexOf(true) + 1).slice(-40),",
        "und: S.und.filter(t => !t.startsWith('ZA:')).slice(-40), " + MARK)
# dmGeo: подложка холста — без масштаба
replace("const dmGeo = q => { const W = wf(),", "const dmGeo = q => { if (S.sess && S.sess.kind === 'board') return null; " + MARK + " const W = wf(),")
replace("el.placeholder = '≈' + dmGeo(q);", "el.placeholder = dmGeo(q) == null ? '?' : '≈' + dmGeo(q);")
replace('placeholder="≈${dmGeo(q)}"', 'placeholder="${dmGeo(q) == null ? \'?\' : \'≈\' + dmGeo(q)}"')
path.write_text(text)
print('undo-patch: refs in snap/unsnap/zState/undo, persisted snapshots, dmGeo on board')
