#!/usr/bin/env python3
"""Measure 82.18: собрать web/experimental.html от неизменной web/v81.html всеми патч-скриптами в утверждённом порядке.

Порядок (отчёт интеграции AKX-2026-0012, бывший /tmp/intb/build.sh):
  integrate.py (v81 + ui/geometry/manual/placement/labels/comms/appearance/routes/floor-routes/angle)
  -> v012 -> v013 -> sketch -> icon -> title -> undo -> autodim -> objz -> s8218 -> update -> prd
canvas-patch.py / c8218-patch.py после s8218-patch.py — no-op (их теги переносит s8218), поэтому не вызываются.

  python3 scripts/build-experimental.py           пересобрать web/experimental.html на месте
  python3 scripts/build-experimental.py --check   собрать во временной копии и сравнить побайтно с web/experimental.html;
                                                  расхождение -> код 1 (CI / build_apk.py)
Каждый скрипт пишет только web/experimental.html своей копии (пути — от расположения скрипта)."""
from pathlib import Path
import hashlib, shutil, subprocess, sys, tempfile

ROOT = Path(__file__).resolve().parents[1]
CHAIN = ['integrate.py', 'v012-patch.py', 'v013-patch.py', 'sketch-patch.py', 'icon-patch.py', 'title-patch.py',
         'undo-patch.py', 'autodim-patch.py', 'objz-patch.py', 's8218-patch.py', 'update-patch.py', 'prd-patch.py']


def build(root):
    for name in CHAIN:
        script = root / 'scripts' / name
        if not script.exists():
            raise SystemExit(f'build-experimental: нет scripts/{name}')
        subprocess.run([sys.executable, str(script)], check=True, cwd=root, stdout=subprocess.DEVNULL)
    return root / 'web/experimental.html'


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    if '--check' in sys.argv:
        cur = ROOT / 'web/experimental.html'
        with tempfile.TemporaryDirectory(prefix='measure-exp-') as tmp:
            t = Path(tmp)
            shutil.copytree(ROOT / 'scripts', t / 'scripts', ignore=shutil.ignore_patterns('__pycache__'))
            shutil.copytree(ROOT / 'web', t / 'web')
            out = build(t)
            if out.read_bytes() != cur.read_bytes():
                print(f'FAIL web/experimental.html не совпадает с пересборкой от v81: в репозитории {sha(cur)[:16]}, пересборка {sha(out)[:16]}.'
                      ' Пересоберите: python3 scripts/build-experimental.py', file=sys.stderr)
                return 1
            print(f'OK web/experimental.html = пересборка от v81 ({sha(cur)})')
            return 0
    out = build(ROOT)
    print(f'web/v81.html {sha(ROOT / "web/v81.html")}\nweb/experimental.html {sha(out)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
