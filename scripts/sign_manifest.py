#!/usr/bin/env python3
"""Measure 82.18 (аудит M3): подписать / проверить version.json ключом подписи APK (scripts/ManifestSign.java, JDK 11+).

  sign_manifest.py sign   <version.json> [<keystore> <password|env:VAR> <alias|->]
  sign_manifest.py verify <version.json> [<keystore> <password|env:VAR> <alias|->]
Без keystore: CI-ключ из AK_KS / env:AK_PW / alias akrix (как signingConfigs.prod), иначе локальный тестовый
.signing/measure-lab.jks / .signing/password / measurelab (signingConfigs.debug) — тот же, которым build_apk.py подписывает APK."""
from pathlib import Path
import os, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
SIGNER = ROOT / 'scripts/ManifestSign.java'


def key_args():
    if os.environ.get('AK_KS'):
        return [os.environ['AK_KS'], 'env:AK_PW', 'akrix']
    pw = (ROOT / '.signing/password').read_text().strip()
    return [str(ROOT / '.signing/measure-lab.jks'), pw, 'measurelab']


def run(mode, manifest, ks=None, pw=None, alias=None):
    args = [ks, pw, alias or '-'] if ks else key_args()
    env = {k: v for k, v in os.environ.items() if k != 'JAVA_TOOL_OPTIONS'}
    r = subprocess.run(['java', str(SIGNER), mode, *args, str(manifest)], env=env, capture_output=True, text=True)
    sys.stdout.write(r.stdout); sys.stderr.write(r.stderr)
    return r.returncode


def sign(manifest, *key):
    if run('sign', manifest, *key) != 0:
        raise SystemExit('sign_manifest: подпись не создана: ' + str(manifest))
    return Path(str(manifest) + '.sig')


def verify(manifest, *key):
    return run('verify', manifest, *key) == 0


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) not in (2, 5) or a[0] not in ('sign', 'verify'):
        raise SystemExit(__doc__)
    if a[0] == 'sign':
        sign(*a[1:])
    else:
        sys.exit(0 if verify(*a[1:]) else 1)
