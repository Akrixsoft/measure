#!/usr/bin/env python3
"""AKX-2026-0014: compile the real Updater.java against JVM stubs (tests/updater_jvm/stubs) and run UpdaterTest.
Needs only a JDK (javac/java, 11+). The network is pinned to a dead proxy so the offline path is exercised deterministically."""
from pathlib import Path
import os, shutil, subprocess, sys, tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import web_bundle as wb  # noqa: E402
import sign_manifest  # noqa: E402  (аудит M3: CI-скрипт подписи version.json)


def main():
    tmp = Path(tempfile.mkdtemp(prefix='akx14-jvm-'))
    try:
        assets = tmp / 'assets'
        wb.stage(assets / 'experimental', ROOT)
        version, _, _ = wb.read_version(ROOT)
        apk = tmp / ('measure-%s.apk' % version); apk.write_bytes(b'fake')
        out = tmp / 'out'; wb.publish(assets / 'experimental', apk, out, ROOT)
        # тестовый keystore (как ключ APK): подпись version.json CI-скриптом, сертификат — «подпись установленного приложения» для stub PackageManager
        ks, pw = tmp / 'test.p12', 'test-pass'
        subprocess.run(['keytool', '-genkeypair', '-keystore', str(ks), '-storetype', 'PKCS12', '-alias', 'akrix', '-keyalg', 'RSA', '-keysize', '2048',
                        '-validity', '30', '-storepass', pw, '-keypass', pw, '-dname', 'CN=Measure test'], check=True, capture_output=True)
        sign_manifest.sign(out / 'version.json', str(ks), pw, 'akrix')
        cert = tmp / 'app-cert.der'
        if sign_manifest.run('cert', cert, str(ks), pw, 'akrix') != 0: raise SystemExit('cert export failed')
        classes = tmp / 'classes'
        sources = [str(p) for p in (ROOT / 'tests/updater_jvm').rglob('*.java')]
        sources.append(str(ROOT / 'android/app/src/main/java/ge/akrix/zamer/Updater.java'))
        subprocess.run(['javac', '-nowarn', '-encoding', 'UTF-8', '-d', str(classes)] + sources, check=True)
        env = {k: v for k, v in os.environ.items() if k != 'JAVA_TOOL_OPTIONS'}
        r = subprocess.run(['java', '-Dhttps.proxyHost=127.0.0.1', '-Dhttps.proxyPort=1', '-cp', str(classes),
                            'ge.akrix.zamer.UpdaterTest', str(assets), str(out), str(ks), pw, str(cert)], env=env)
        return r.returncode
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
