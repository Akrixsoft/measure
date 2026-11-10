#!/usr/bin/env python3
"""Measure 82.18 (аудит M2): проверка перед публикацией обновления в ветку measure-lab-apk.

  publish_guard.py <new version.json> <current version.json | -> [<git ref>]

  - current «-» или файла нет (первая публикация) → OK;
  - новая версия ниже текущей → ошибка;
  - та же версия, другое содержимое (файлы веб-части path/sha256/size, minApk, APK sha256/versionCode) → ошибка: нужно поднять версию;
  - та же версия, то же содержимое → OK (повтор публикации ничего не меняет);
  - ref refs/tags/measure-v<X> → X обязан совпадать с версией манифеста.
Код 0 — публиковать можно, 1 — нельзя (сообщение в stderr, ::error для GitHub Actions)."""
from pathlib import Path
import json, sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import web_bundle as wb  # noqa: E402


def content(m):
    apk = m.get('apk') or {}
    return {'minApk': m.get('minApk'), 'files': sorted((f['path'], f['sha256'], f['size']) for f in m.get('files') or []),
            'apk': (apk.get('versionCode'), apk.get('sha256'), apk.get('size')) if apk else None}


def check(new, cur, ref=''):
    v = new['version']
    if ref.startswith('refs/tags/measure-v') and ref[len('refs/tags/measure-v'):] != v:
        return 'тег %s не совпадает с версией манифеста %s' % (ref[len('refs/tags/'):], v)
    if not cur:
        return None
    c = cur.get('version')
    if not isinstance(c, str) or not wb.VERSION_RE.match(c):
        return None   # прежний манифест повреждён — заменяется
    if wb.vkey(v) < wb.vkey(c):
        return 'версия %s ниже опубликованной %s' % (v, c)
    if wb.vkey(v) == wb.vkey(c) and content(new) != content(cur):
        return 'версия %s уже опубликована с другим содержимым — поднимите версию (web/lab-version.js)' % v
    return None


def main(argv):
    if len(argv) not in (2, 3):
        raise SystemExit(__doc__)
    new = json.loads(Path(argv[0]).read_text())
    p = Path(argv[1]) if argv[1] != '-' else None
    cur = json.loads(p.read_text()) if p and p.is_file() and p.stat().st_size else None
    err = check(new, cur, argv[2] if len(argv) == 3 else '')
    if err:
        print('::error::publish_guard: ' + err, file=sys.stderr)
        return 1
    print('publish_guard: OK %s (опубликована: %s)' % (new['version'], cur.get('version') if cur else '—'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
