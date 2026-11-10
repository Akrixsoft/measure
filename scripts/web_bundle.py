#!/usr/bin/env python3
"""Measure web bundle + update manifest (AKX-2026-0014).

Single version source: web/lab-version.js (MeasureVersion, MeasureMinApk).

  web_bundle.py version                       -> prints version, versionCode, minApk
  web_bundle.py stage <dir>                   -> experimental bundle (index.html, lab-*, shared) + built-in version.json
  web_bundle.py publish <assets> <apk> <out>  -> <out>/version.json + <out>/web/<ver>/... (for branch measure-lab-apk)
  web_bundle.py verify <out>                  -> validate published manifest and SHA-256/size of every file

The validation rules here mirror android/.../Updater.java (validManifest)."""
from pathlib import Path
import hashlib, json, re, shutil, sys

ROOT = Path(__file__).resolve().parents[1]
REPO_RAW = 'https://raw.githubusercontent.com/Akrixsoft/measure/measure-lab-apk/'
FORMAT = 'measure-web-bundle'
MAX_FILE = 20 * 1024 * 1024
MAX_APK = 200 * 1024 * 1024
MAX_FILES = 500
VERSION_RE = re.compile(r'^\d{1,4}(\.\d{1,4}){1,3}$')
PATH_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,127}(/[A-Za-z0-9][A-Za-z0-9._-]{0,127}){0,3}$')
SHA_RE = re.compile(r'^[0-9a-f]{64}$')
APK_RE = re.compile(r'^measure-\d{1,4}(\.\d{1,4}){1,3}\.apk$')


def read_version(root=ROOT):
    text = (Path(root) / 'web/lab-version.js').read_text(encoding='utf-8')
    v = re.findall(r"window\.MeasureVersion\s*=\s*'([^']*)'", text)
    m = re.findall(r'window\.MeasureMinApk\s*=\s*(\d+)', text)
    if len(v) != 1 or len(m) != 1 or not VERSION_RE.match(v[0]):
        raise SystemExit('web/lab-version.js: expected exactly one MeasureVersion and MeasureMinApk')
    return v[0], version_code(v[0]), int(m[0])


def version_code(version):
    parts = [int(x) for x in version.split('.')]
    if len(parts) < 2 or parts[1] >= 1000:
        raise SystemExit('Bad version ' + version)
    return parts[0] * 1000 + parts[1]


def vkey(version):
    return tuple(int(x) for x in version.split('.'))


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 16), b''):
            h.update(chunk)
    return h.hexdigest()


def stage(target, root=ROOT):
    """Exactly what the experimental page loads, laid out like assets/experimental/."""
    root, target = Path(root), Path(target)
    target.mkdir(parents=True, exist_ok=True)
    for item in target.iterdir():
        if item.is_file():
            item.unlink()
    shutil.copy2(root / 'web/experimental.html', target / 'index.html')
    shared = root / 'web/shared'
    if shared.exists():
        for item in shared.iterdir():
            if item.is_file():
                shutil.copy2(item, target / item.name)
    for pattern in ('lab-*.js', 'lab-*.css'):
        for item in (root / 'web').glob(pattern):
            shutil.copy2(item, target / item.name)
    version, _, min_apk = read_version(root)
    manifest = bundle_manifest(target, version, min_apk)
    (target / 'version.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')
    return manifest


def bundle_manifest(directory, version, min_apk):
    directory = Path(directory)
    files = []
    for f in sorted(p for p in directory.rglob('*') if p.is_file()):
        rel = f.relative_to(directory).as_posix()
        if rel == 'version.json':
            continue
        files.append({'path': rel, 'sha256': sha256(f), 'size': f.stat().st_size})
    return {'format': FORMAT, 'v': 1, 'version': version, 'minApk': min_apk, 'files': files}


def validate_manifest(m, published=True):
    """Return a list of errors (empty = valid)."""
    e = []
    if not isinstance(m, dict):
        return ['manifest is not an object']
    if m.get('format') != FORMAT or m.get('v') != 1:
        e.append('format/v')
    ver = m.get('version')
    if not isinstance(ver, str) or not VERSION_RE.match(ver):
        e.append('version')
        ver = None
    if not isinstance(m.get('minApk'), int) or isinstance(m.get('minApk'), bool) or m['minApk'] < 1:
        e.append('minApk')
    files = m.get('files')
    if not isinstance(files, list) or not 0 < len(files) <= MAX_FILES:
        e.append('files')
        files = []
    seen = set()
    for f in files:
        if not isinstance(f, dict):
            e.append('file entry'); continue
        p, s, n = f.get('path'), f.get('sha256'), f.get('size')
        if not isinstance(p, str) or not PATH_RE.match(p) or '..' in p or p == 'version.json':
            e.append('path %r' % (p,))
        elif p in seen:
            e.append('duplicate %s' % p)
        else:
            seen.add(p)
        if not isinstance(s, str) or not SHA_RE.match(s):
            e.append('sha256 %r' % (p,))
        if not isinstance(n, int) or isinstance(n, bool) or not 0 <= n <= MAX_FILE:
            e.append('size %r' % (p,))
    for required in ('index.html', 'lab-version.js'):
        if files and required not in seen:
            e.append('missing ' + required)
    if published:
        if ver and m.get('base') != 'web/' + ver + '/':
            e.append('base')
        apk = m.get('apk')
        if apk is not None:
            if not isinstance(apk, dict):
                e.append('apk')
            else:
                url = apk.get('url')
                if not isinstance(apk.get('versionCode'), int) or isinstance(apk.get('versionCode'), bool) or apk['versionCode'] < 1:
                    e.append('apk.versionCode')
                if not isinstance(apk.get('versionName'), str) or not VERSION_RE.match(apk['versionName']):
                    e.append('apk.versionName')
                if not isinstance(url, str) or not url.startswith(REPO_RAW) or not APK_RE.match(url[len(REPO_RAW):]):
                    e.append('apk.url')
                if not isinstance(apk.get('sha256'), str) or not SHA_RE.match(apk['sha256']):
                    e.append('apk.sha256')
                if not isinstance(apk.get('size'), int) or isinstance(apk.get('size'), bool) or not 0 < apk['size'] <= MAX_APK:
                    e.append('apk.size')
    return e


def publish(assets, apk, out, root=ROOT):
    """Write <out>/version.json and <out>/web/<ver>/<files> from the staged experimental assets."""
    assets, apk, out = Path(assets), Path(apk), Path(out)
    built = json.loads((assets / 'version.json').read_text())
    errors = validate_manifest(built, published=False)
    if errors:
        raise SystemExit('Built-in manifest invalid: %s' % errors)
    version = built['version']
    web = out / 'web' / version
    if web.exists():
        shutil.rmtree(web)
    for f in built['files']:
        src = assets / f['path']
        if sha256(src) != f['sha256'] or src.stat().st_size != f['size']:
            raise SystemExit('Asset changed after staging: ' + f['path'])
        dst = web / f['path']
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    vname = apk.name[len('measure-'):-len('.apk')]
    manifest = dict(built, base='web/' + version + '/', apk={
        'versionCode': version_code(vname), 'versionName': vname,
        'url': REPO_RAW + apk.name, 'sha256': sha256(apk), 'size': apk.stat().st_size})
    errors = validate_manifest(manifest)
    if errors:
        raise SystemExit('Published manifest invalid: %s' % errors)
    (out / 'version.json').write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + '\n')
    return manifest


def verify(out):
    out = Path(out)
    m = json.loads((out / 'version.json').read_text())
    errors = validate_manifest(m)
    for f in m.get('files') or []:
        p = out / m.get('base', '') / str(f.get('path'))
        if not p.is_file():
            errors.append('missing file ' + str(f.get('path')))
        elif sha256(p) != f.get('sha256') or p.stat().st_size != f.get('size'):
            errors.append('hash/size mismatch ' + str(f.get('path')))
    apk = m.get('apk')
    if isinstance(apk, dict) and isinstance(apk.get('url'), str):
        p = out / apk['url'].rsplit('/', 1)[-1]
        if not p.is_file() or sha256(p) != apk.get('sha256') or p.stat().st_size != apk.get('size'):
            errors.append('apk hash/size mismatch')
    return errors


def main(argv):
    if argv[:1] == ['version']:
        print(*read_version())
    elif argv[:1] == ['stage'] and len(argv) == 2:
        m = stage(argv[1]); print('staged', m['version'], len(m['files']), 'files')
    elif argv[:1] == ['publish'] and len(argv) == 4:
        m = publish(*argv[1:]); print('published', m['version'], 'apk', m['apk']['versionCode'])
    elif argv[:1] == ['verify'] and len(argv) == 2:
        errors = verify(argv[1])
        if errors:
            raise SystemExit('Manifest verification failed: %s' % errors)
        print('verified', argv[1])
    else:
        raise SystemExit(__doc__)


if __name__ == '__main__':
    main(sys.argv[1:])
