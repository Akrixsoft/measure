#!/usr/bin/env python3
"""Measure 82.18 (AKX-2026-0012, engineer A): script/style tags in web/experimental.html.

Order (architect.md §8.1, adjusted to engineer B's and C's tested order): lab-store -> lab-sketch -> (lab-icons, lab-title) ->
lab-ctx -> lab-board -> lab-history -> lab-tb -> lab-obj -> lab-update -> lab-projects -> lab-autodim.  Tags of c8218-patch.py (C)
already in the file are moved into the slots too.  Replaces scripts/canvas-patch.py (B) — tags of
canvas-patch.py / update-patch.py already in the file are moved into these slots, so the scripts may run in any order;
canvas-patch.py after this script refuses (exit 1, «Already integrated») — expected, nothing changes.  AKX-2026-0014 (auto-update): lab-version.js — before every lab-* script (own one-line slot
before lab-ui.js); lab-update.css/.js — right after lab-title.js.  Tags already inserted by scripts/update-patch.py are
moved into these slots, so the two scripts can run in either order (update-patch.py is a no-op once lab-update.js is connected).  Tags are emitted only for files that exist in web/; a missing module of engineer B/C
leaves a marker comment in its slot, so re-running the script after B/C add their files connects them in place.

Inline (exact, verified): [S8218-BOOT] the v81 start line (lastOpen / sessList(true)) waits for DOMContentLoaded, i.e. until
every lab-* module is loaded — otherwise the IndexedDB open could resolve between external script loads and the original
lastOpen/sessList would run before lab-projects.js replaces them.  Behaviour otherwise unchanged.

Idempotent: the first run replaces the exact 82.17 tag block (verified, must occur once); later runs rebuild the block
between the S8218 markers.  web/v81.html is never touched.  Usage: python3 scripts/s8218-patch.py [--check]
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'
HTML = WEB / 'experimental.html'

OLD = ('<link rel="stylesheet" href="lab-sketch.css">\n'
       '<script src="lab-sketch.js"></script>\n'
       '<script src="lab-icons.js"></script>\n'
       '<script src="lab-title.js"></script>\n')
BEGIN, END = '<!-- [BLOCK S8218-TAGS] begin -->\n', '<!-- [BLOCK S8218-TAGS] end -->\n'

# (owner, file) in load order; css before its js
SLOTS = [
    ('A', 'lab-store.js'),
    ('B', 'lab-sketch.css'),
    ('B', 'lab-sketch.js'),
    ('-', 'lab-icons.js'),
    ('A', 'lab-title.js'),
    ('B', 'lab-ctx.js'),     # B: после lab-title (порядок проверен инженером B, scripts/canvas-patch.py)
    ('B', 'lab-board.js'),
    # C — после lab-board (integration 82.18): lab-history оборачивает rfAdd/rfDel подложки lab-board,
    # иначе удаление фото подложки остаётся замыканием ZA (отчёт C); порядок как у scripts/c8218-patch.py.
    ('C', 'lab-history.js'),
    ('C', 'lab-tb.css'),
    ('C', 'lab-tb.js'),
    ('C', 'lab-obj.js'),
    ('U', 'lab-update.css'),
    ('U', 'lab-update.js'),
    ('A', 'lab-projects.css'),
    ('A', 'lab-projects.js'),
    ('C', 'lab-autodim.js'),
]
REQUIRED = {'lab-store.js', 'lab-sketch.css', 'lab-sketch.js', 'lab-icons.js', 'lab-title.js', 'lab-projects.css', 'lab-projects.js'}


def block():
    out = [BEGIN]
    for owner, f in SLOTS:
        if not (WEB / f).exists():
            if f in REQUIRED:
                sys.exit(f'missing required file web/{f}')
            out.append(f'<!-- slot {owner}: {f} -->\n')
        elif f.endswith('.css'):
            out.append(f'<link rel="stylesheet" href="{f}">\n')
        else:
            out.append(f'<script src="{f}"></script>\n')
    out.append(END)
    return ''.join(out)


VER_ANCHOR = '<script src="lab-ui.js"></script>\n'
VER_TAG = '<script src="lab-version.js"></script>\n'
MOVED = ['<script src="lab-version.js"></script>\n', '<link rel="stylesheet" href="lab-update.css">\n', '<script src="lab-update.js"></script>\n',
         '<script src="lab-ctx.js"></script>\n', '<script src="lab-board.js"></script>\n',   # update-patch.py, canvas-patch.py
         '<script src="lab-history.js"></script>\n', '<link rel="stylesheet" href="lab-tb.css">\n', '<script src="lab-tb.js"></script>\n',
         '<script src="lab-obj.js"></script>\n', '<script src="lab-autodim.js"></script>\n']   # c8218-patch.py (C)


BOOT_OLD = "dbOpen().then(async () => { if (!/[?&]nolist/.test(location.search)) { if (/[?&]list/.test(location.search) || !(await lastOpen())) sessList(true) } });"
BOOT_NEW = ("dbOpen().then(() => new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r, { once: true }) : r()))   /* 82.18 [S8218-BOOT]: старт — после загрузки модулей Lab */"
            ".then(async () => { if (!/[?&]nolist/.test(location.search)) { if (/[?&]list/.test(location.search) || !(await lastOpen())) sessList(true) } });")


def main():
    src = HTML.read_text(encoding='utf-8')
    work = src
    if BOOT_NEW not in work:
        if work.count(BOOT_OLD) != 1:
            sys.exit(f'boot anchor found {work.count(BOOT_OLD)} times, expected 1')
        work = work.replace(BOOT_OLD, BOOT_NEW)
    if BEGIN not in work:   # tags of update-patch.py (if it ran first) -> into our slots
        for t in MOVED:
            if work.count(t) > 1:
                sys.exit(f'{t.strip()} connected more than once')
            work = work.replace(t, '')
    elif VER_TAG in work.split(BEGIN)[1]:
        sys.exit('lab-version.js inside S8218 block')
    if BEGIN in work:
        if work.count(BEGIN) != 1 or work.count(END) != 1:
            sys.exit('S8218 markers must occur exactly once')
        new = re.sub(re.escape(BEGIN) + r'.*?' + re.escape(END), lambda m: block(), work, flags=re.S)
    else:
        if work.count(OLD) != 1:
            sys.exit(f'anchor (82.17 tag block) found {work.count(OLD)} times, expected 1')
        new = work.replace(OLD, block())
    if work.count(VER_ANCHOR) != 1:
        sys.exit('anchor lab-ui.js must occur once')
    has_ver = VER_TAG + VER_ANCHOR in new
    if (WEB / 'lab-version.js').exists() and not has_ver:
        new = new.replace(VER_ANCHOR, VER_TAG + VER_ANCHOR)
    elif not (WEB / 'lab-version.js').exists() and not has_ver and '<!-- slot U: lab-version.js -->' not in new:
        new = new.replace(VER_ANCHOR, '<!-- slot U: lab-version.js -->\n' + VER_ANCHOR)
    if (WEB / 'lab-version.js').exists():
        new = new.replace('<!-- slot U: lab-version.js -->\n', '')
    # every lab file is connected exactly once
    for _, f in SLOTS + [('U', 'lab-version.js')]:
        n = new.count(f'href="{f}"') + new.count(f'src="{f}"')
        if n > 1 or ((WEB / f).exists() and n != 1):
            sys.exit(f'{f}: connected {n} times')
    if '--check' in sys.argv:
        print('ok (unchanged)' if new == src else 'would change')
        return
    if new != src:
        HTML.write_text(new, encoding='utf-8')
        print('patched web/experimental.html')
    else:
        print('already up to date')


if __name__ == '__main__':
    main()
