#!/usr/bin/env python3
"""AKX-2026-0014: compile the real Updater.java against JVM stubs (tests/updater_jvm/stubs) and run UpdaterTest.
Needs only a JDK (javac/java, 11+). The network is pinned to a dead proxy so the offline path is exercised deterministically."""
from pathlib import Path
import os, shutil, subprocess, sys, tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import web_bundle as wb  # noqa: E402


def main():
    tmp = Path(tempfile.mkdtemp(prefix='akx14-jvm-'))
    try:
        assets = tmp / 'assets'
        wb.stage(assets / 'experimental', ROOT)
        version, _, _ = wb.read_version(ROOT)
        apk = tmp / ('measure-%s.apk' % version); apk.write_bytes(b'fake')
        out = tmp / 'out'; wb.publish(assets / 'experimental', apk, out, ROOT)
        classes = tmp / 'classes'
        sources = [str(p) for p in (ROOT / 'tests/updater_jvm').rglob('*.java')]
        sources.append(str(ROOT / 'android/app/src/main/java/ge/akrix/zamer/Updater.java'))
        subprocess.run(['javac', '-nowarn', '-encoding', 'UTF-8', '-d', str(classes)] + sources, check=True)
        env = {k: v for k, v in os.environ.items() if k != 'JAVA_TOOL_OPTIONS'}
        r = subprocess.run(['java', '-Dhttps.proxyHost=127.0.0.1', '-Dhttps.proxyPort=1', '-cp', str(classes),
                            'ge.akrix.zamer.UpdaterTest', str(assets), str(out)], env=env)
        return r.returncode
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
