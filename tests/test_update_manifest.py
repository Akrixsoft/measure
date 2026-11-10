#!/usr/bin/env python3
"""AKX-2026-0014: unit tests for scripts/web_bundle.py — staging, publish layout, manifest validation, SHA-256 verify.
Runs without Android SDK (CI step before the build). Exit code != 0 on failure."""
from pathlib import Path
import copy, hashlib, json, re, shutil, sys, tempfile, unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import web_bundle as wb  # noqa: E402
import sign_manifest, publish_guard  # noqa: E402  (82.18 аудит M3, M2)
import subprocess  # noqa: E402


class Bundle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix='akx14-'))
        cls.assets = cls.tmp / 'assets'
        cls.built = wb.stage(cls.assets, ROOT)
        cls.version, cls.code, cls.min_apk = wb.read_version(ROOT)
        cls.apk = cls.tmp / ('measure-%s.apk' % cls.version)
        cls.apk.write_bytes(b'PK\x03\x04 fake apk for manifest tests')
        cls.out = cls.tmp / 'out'
        cls.pub = wb.publish(cls.assets, cls.apk, cls.out, ROOT)
        shutil.copy2(cls.apk, cls.out / cls.apk.name)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    # ── single version source
    def test_version_single_source(self):
        text = (ROOT / 'web/lab-version.js').read_text()
        self.assertEqual(len(re.findall(r"window\.MeasureVersion\s*=", text)), 1)
        self.assertTrue(wb.VERSION_RE.match(self.version))
        self.assertEqual(self.code, int(self.version.split('.')[0]) * 1000 + int(self.version.split('.')[1]))
        self.assertLessEqual(self.min_apk, self.code, 'MeasureMinApk must not exceed the APK built from the same tree')
        gradle = (ROOT / 'android/app/build.gradle').read_text()
        self.assertIn("web/lab-version.js", gradle)
        self.assertNotRegex(gradle, r"versionCode\s+\d", 'versionCode must come from lab-version.js')
        self.assertNotRegex(gradle, r"versionName\s+'", 'versionName must come from lab-version.js')
        for f in ('web/lab-title.js', 'web/lab-update.js', 'android/app/src/main/java/ge/akrix/zamer/MainActivity.java', 'scripts/build_apk.py'):
            self.assertNotIn("'%s'" % self.version, (ROOT / f).read_text(), f + ' hardcodes the version')

    # ── staged bundle = what the page loads
    def test_stage_contains_page_and_refs(self):
        paths = {f['path'] for f in self.built['files']}
        self.assertIn('index.html', paths)
        self.assertIn('lab-version.js', paths)
        self.assertIn('lab-update.js', paths)
        self.assertIn('lab-update.css', paths)
        html = (ROOT / 'web/experimental.html').read_text()
        for ref in set(re.findall(r'(?:src|href)="([^"#:]+)"', html)):
            self.assertIn(ref, paths, 'page references a file missing from the bundle: ' + ref)
        self.assertNotIn('v81.html', paths)
        self.assertEqual(wb.validate_manifest(self.built, published=False), [])

    def test_stage_hashes(self):
        for f in self.built['files']:
            p = self.assets / f['path']
            self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(), f['sha256'])
            self.assertEqual(p.stat().st_size, f['size'])

    # ── published layout
    def test_publish_layout_and_verify(self):
        self.assertEqual(self.pub['base'], 'web/%s/' % self.version)
        self.assertEqual(self.pub['apk']['versionCode'], self.code)
        self.assertEqual(self.pub['apk']['url'], wb.REPO_RAW + self.apk.name)
        self.assertTrue(self.pub['apk']['url'].startswith('https://raw.githubusercontent.com/'))
        self.assertEqual(wb.verify(self.out), [])
        on_disk = json.loads((self.out / 'version.json').read_text())
        self.assertEqual(on_disk, self.pub)

    def test_verify_detects_tampering(self):
        out = self.tmp / 'tamper'
        shutil.copytree(self.out, out)
        target = out / self.pub['base'] / 'lab-update.js'
        target.write_text(target.read_text() + '\n// injected')
        self.assertTrue(any('lab-update.js' in e for e in wb.verify(out)))

    def test_verify_detects_missing_and_apk_change(self):
        out = self.tmp / 'missing'
        shutil.copytree(self.out, out)
        (out / self.pub['base'] / 'index.html').unlink()
        (out / self.apk.name).write_bytes(b'other')
        errors = wb.verify(out)
        self.assertTrue(any('missing file index.html' in e for e in errors))
        self.assertIn('apk hash/size mismatch', errors)

    # ── validation rules (mirrored in Updater.validManifest)
    def bad(self, mutate, expect):
        m = copy.deepcopy(self.pub)
        mutate(m)
        errors = wb.validate_manifest(m)
        self.assertTrue(any(e.startswith(expect) for e in errors), '%s not in %s' % (expect, errors))

    def test_rejects(self):
        self.bad(lambda m: m.update(format='x'), 'format')
        self.bad(lambda m: m.update(v=True), 'format')
        self.bad(lambda m: m.update(version='82.x'), 'version')
        self.bad(lambda m: m.update(minApk=0), 'minApk')
        self.bad(lambda m: m.update(minApk=True), 'minApk')
        self.bad(lambda m: m.update(files=[]), 'files')
        self.bad(lambda m: m['files'].append(dict(m['files'][0])), 'duplicate')
        self.bad(lambda m: m['files'][0].update(path='../x.js'), 'path')
        self.bad(lambda m: m['files'][0].update(path='/abs.js'), 'path')
        self.bad(lambda m: m['files'][0].update(path='a\\b.js'), 'path')
        self.bad(lambda m: m['files'][0].update(path='version.json'), 'path')
        self.bad(lambda m: m['files'][0].update(sha256='ABC'), 'sha256')
        self.bad(lambda m: m['files'][0].update(size=-1), 'size')
        self.bad(lambda m: m['files'][0].update(size=wb.MAX_FILE + 1), 'size')
        self.bad(lambda m: m.update(files=[f for f in m['files'] if f['path'] != 'index.html']), 'missing index.html')
        self.bad(lambda m: m.update(base='web/other/'), 'base')
        self.bad(lambda m: m['apk'].update(url='http://raw.githubusercontent.com/Akrixsoft/measure/measure-lab-apk/measure-82.17.apk'), 'apk.url')
        self.bad(lambda m: m['apk'].update(url='https://evil.example/Akrixsoft/measure/measure-lab-apk/measure-82.17.apk'), 'apk.url')
        self.bad(lambda m: m['apk'].update(url=wb.REPO_RAW + '../main/measure-82.17.apk'), 'apk.url')
        self.bad(lambda m: m['apk'].update(url=wb.REPO_RAW + 'payload.apk'), 'apk.url')
        self.bad(lambda m: m['apk'].update(sha256='0' * 63), 'apk.sha256')
        self.bad(lambda m: m['apk'].update(versionCode=0), 'apk.versionCode')
        self.bad(lambda m: m['apk'].update(size=0), 'apk.size')

    def test_apk_optional(self):
        m = copy.deepcopy(self.pub); del m['apk']
        self.assertEqual(wb.validate_manifest(m), [])

    # ── Java mirror stays in sync with Python rules
    def test_java_mirror_constants(self):
        java = (ROOT / 'android/app/src/main/java/ge/akrix/zamer/Updater.java').read_text()
        self.assertIn('"https://" + HOST + "/Akrixsoft/measure/measure-lab-apk/"', java)
        self.assertEqual(wb.REPO_RAW, 'https://raw.githubusercontent.com/Akrixsoft/measure/measure-lab-apk/')
        self.assertIn('static final String FORMAT = "%s"' % wb.FORMAT, java)
        self.assertIn('MAX_FILE = 20L << 20', java)
        self.assertIn('MAX_FILES = %d' % wb.MAX_FILES, java)
        for name, rx in (('VERSION', wb.VERSION_RE), ('PATH', wb.PATH_RE), ('SHA', wb.SHA_RE), ('APK_NAME', wb.APK_RE)):
            m = re.search(r'static final Pattern %s = Pattern\.compile\("((?:[^"\\]|\\.)*)"\)' % name, java) or \
                re.search(r'\b%s = Pattern\.compile\("((?:[^"\\]|\\.)*)"\)' % name, java)
            self.assertIsNotNone(m, name)
            self.assertEqual(m.group(1).replace('\\\\', '\\'), rx.pattern, name)

    def test_workflow_publishes_manifest(self):
        wf = (ROOT / '.github/workflows/lab-apk.yml').read_text()
        self.assertIn('artifacts/update/version.json', wf)
        self.assertIn('scripts/web_bundle.py verify /tmp/pub', wf)
        self.assertIn('tests/test_update_manifest.py', wf)
        self.assertIn('measure-lab-apk', wf)

        # 82.18 M2: публикация только по тегу measure-v* / вручную, перед ней — publish_guard; подпись рядом с манифестом
        self.assertIn("tags: ['measure-v*']", wf)
        self.assertEqual(wf.count("if: github.event_name == 'workflow_dispatch' || startsWith(github.ref, 'refs/tags/measure-v')"), 2)
        self.assertIn('scripts/publish_guard.py artifacts/update/version.json', wf)
        self.assertIn('version.json.sig /tmp/pub/', wf)
        self.assertIn('scripts/web_bundle.py verify /tmp/pub --signed', wf)
        self.assertIn('scripts/build-experimental.py --check', wf)
        self.assertLess(wf.index('Publish guard'), wf.index('git push'))

    # ── 82.18 M3: CI-скрипт подписи (scripts/sign_manifest.py → ManifestSign.java) с тестовым keystore
    def test_ci_signature_script(self):
        ks, pw = self.tmp / 'ci-test.jks', 'ci-test-pass'
        if not ks.exists():
            subprocess.run(['keytool', '-genkeypair', '-keystore', str(ks), '-storetype', 'JKS', '-alias', 'akrix', '-keyalg', 'RSA', '-keysize', '2048',
                            '-validity', '30', '-storepass', pw, '-keypass', pw, '-dname', 'CN=CI test'], check=True, capture_output=True)
        out = self.tmp / 'signed'; shutil.rmtree(out, ignore_errors=True); shutil.copytree(self.out, out)
        self.assertIn('missing version.json.sig', wb.verify(out, require_sig=True))
        sig = sign_manifest.sign(out / 'version.json', str(ks), pw, 'akrix')
        self.assertTrue(sig.is_file() and len(sig.read_bytes()) > 300)
        self.assertEqual(wb.verify(out, require_sig=True), [])
        self.assertTrue(sign_manifest.verify(out / 'version.json', str(ks), pw, 'akrix'))
        raw = (out / 'version.json').read_bytes()
        (out / 'version.json').write_bytes(raw.replace(b'"minApk": ', b'"minApk":  '))   # одна лишняя пробельная литера — подпись уже неверна
        self.assertFalse(sign_manifest.verify(out / 'version.json', str(ks), pw, 'akrix'))
        (out / 'version.json').write_bytes(raw); (out / 'version.json.sig').unlink()
        self.assertFalse(sign_manifest.verify(out / 'version.json', str(ks), pw, 'akrix'))
        # пароль из окружения (CI: env:AK_PW), alias по умолчанию akrix при AK_KS
        import os
        old = {k: os.environ.get(k) for k in ('AK_KS', 'AK_PW')}
        try:
            os.environ['AK_KS'], os.environ['AK_PW'] = str(ks), pw
            sign_manifest.sign(out / 'version.json'); self.assertTrue(sign_manifest.verify(out / 'version.json'))
        finally:
            for k, v in old.items():
                if v is None: os.environ.pop(k, None)
                else: os.environ[k] = v

    # ── 82.18 M2: publish_guard
    def test_publish_guard(self):
        m = copy.deepcopy(self.pub); v = m['version']
        self.assertIsNone(publish_guard.check(m, None))
        self.assertIsNone(publish_guard.check(m, copy.deepcopy(m)))
        changed = copy.deepcopy(m); changed['files'][0]['sha256'] = 'f' * 64
        self.assertIn('другим содержимым', publish_guard.check(changed, m))
        apk = copy.deepcopy(m); apk['apk']['sha256'] = 'e' * 64
        self.assertIn('другим содержимым', publish_guard.check(apk, m))
        higher = copy.deepcopy(m); higher['version'] = v + '.1'
        self.assertIsNone(publish_guard.check(changed | {'version': v + '.1'}, m))
        self.assertIn('ниже', publish_guard.check(m, higher))
        self.assertIsNone(publish_guard.check(m, None, 'refs/tags/measure-v' + v))
        self.assertIn('тег', publish_guard.check(m, None, 'refs/tags/measure-v0.1'))
        self.assertIsNone(publish_guard.check(m, None, 'refs/heads/measure-lab'))
        p = self.tmp / 'guard'; p.mkdir(exist_ok=True); (p / 'new.json').write_text(json.dumps(changed)); (p / 'cur.json').write_text(json.dumps(m))
        r = subprocess.run([sys.executable, str(ROOT / 'scripts/publish_guard.py'), str(p / 'new.json'), str(p / 'cur.json')], capture_output=True, text=True)
        self.assertEqual(r.returncode, 1); self.assertIn('::error::', r.stderr)
        r = subprocess.run([sys.executable, str(ROOT / 'scripts/publish_guard.py'), str(p / 'new.json'), str(p / 'missing.json')], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)


if __name__ == '__main__':
    r = unittest.main(exit=False, verbosity=2).result
    sys.exit(0 if r.wasSuccessful() else 1)
