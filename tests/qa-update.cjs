// AKX-2026-0014 — Playwright: JS part of auto-update (menu button, toasts, mocked AkrixUpdate bridge, ready signal),
// title = loaded web version, native back JS (BACK_JS from MainActivity), same-origin data survival when the bundle source changes.
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), os = require('os');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..'), checks = [];
function chk(ok, name, details) { checks.push({ok: !!ok, name, details}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(details ?? '')); }
const type = f => f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.json') || f.endsWith('.webmanifest') ? 'application/json' : f.endsWith('.png') ? 'image/png' : 'text/html';
const MOCK = () => {
  window.__upd = {calls: []};
  window.AkrixUpdate = {
    ready: v => __upd.calls.push(['ready', v]), check: () => __upd.calls.push(['check']),
    restart: () => __upd.calls.push(['restart', window.__flushed || 0]), downloadApk: () => __upd.calls.push(['downloadApk']),
    state: () => '{}'};
};
(async () => {
  const version = fs.readFileSync(path.join(root, 'web/lab-version.js'), 'utf8').match(/window\.MeasureVersion\s*=\s*'([^']+)'/)[1];
  const server = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); try { r.setHeader('Content-Type', type(f)); r.end(fs.readFileSync(f)); } catch { r.writeHead(404).end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/web/experimental.html?nolist`;
  const b = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox']});
  const ctx = await b.newContext({viewport: {width: 412, height: 915}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
  const errors = [];
  try {
    // ── with mocked bridge
    const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(MOCK);
    await p.goto(url); await p.waitForFunction(() => window.MeasureLabUpdate && window.MeasureLabUI);
    await p.waitForFunction(() => __upd.calls.some(c => c[0] === 'ready'), null, {timeout: 15000});
    const t = await p.evaluate(() => ({zVer: zVer.textContent, zVerB: zVerB.textContent, zVer2: zVer2.textContent, ready: __upd.calls.filter(c => c[0] === 'ready')}));
    chk(t.zVer === 'Measure ' + version && t.zVerB === version && t.zVer2 === 'Measure ' + version, 'title shows loaded web version (lab-version.js)', t);
    chk(t.ready.length === 1 && t.ready[0][1] === version, 'ready signal sent once with MeasureVersion after IndexedDB opened', t.ready);
    chk(await p.evaluate(() => typeof DB !== 'undefined' && !!DB.db), 'ready only after DB.db is open');
    chk(await p.evaluate(async () => ['MeasureLabStore', 'MeasureLabSketch', 'MeasureLabProjects', 'MeasureLabHistory', 'MeasureLabBoard', 'MeasureLabCtx'].every(n => window[n]) && !((await MeasureLabStore.migrate()) || {}).error), 'ready only after Lab modules are up and the 82.18 migration finished (audit m6)');
    { // модуль lab-* бросает исключение при загрузке — ready не уходит (натив откатит бандл)
      const pe = await ctx.newPage(); await pe.addInitScript(MOCK);
      await pe.route('**/web/lab-prd.js', r => r.fulfill({status: 200, contentType: 'application/javascript', body: "throw new Error('qa: broken lab module');"}));
      await pe.goto(url); await pe.waitForFunction(() => window.MeasureLabUpdate); await pe.waitForTimeout(4000);
      chk(await pe.evaluate(() => !__upd.calls.some(c => c[0] === 'ready')), 'broken lab-*.js at startup: ready is NOT sent (audit m6)'); await pe.close();
    }

    await p.click('#bMore');
    const btn = p.locator('#zMenu #bLabUpd');
    chk(await btn.isVisible(), '«Проверить обновления» in ⋮ menu', await btn.textContent());
    await btn.click();
    chk(await p.evaluate(() => __upd.calls.some(c => c[0] === 'check') && !zMenu.classList.contains('on')), 'menu button calls AkrixUpdate.check() and closes menu');

    const toastAfter = async ev => { await p.evaluate(() => { toast(''); $('toast').classList.remove('on'); }); await p.evaluate(e => akrixUpdateEvent(JSON.stringify(e)), ev); return p.evaluate(() => ({text: $('toast').textContent, on: $('toast').classList.contains('on')})); };
    let r = await toastAfter({type: 'none', manual: true, version});
    chk(r.on && r.text.includes('последняя версия ' + version), 'manual check: «up to date» toast', r);
    r = await toastAfter({type: 'none', manual: false, version});
    chk(!r.on, 'background check: no toast when nothing found', r);
    r = await toastAfter({type: 'offline', manual: false, reason: 'UnknownHost'});
    chk(!r.on && !(await p.evaluate(() => document.querySelector('#labUpd.on'))), 'offline background check is silent', r);
    r = await toastAfter({type: 'offline', manual: true});
    chk(r.on && r.text.includes('Нет связи'), 'offline manual check: toast, current version keeps working', r);
    r = await toastAfter({type: 'error', manual: true, reason: 'манифест: base'});
    chk(r.on && r.text.includes('манифест'), 'manifest error reported on manual check', r);
    await p.evaluate(() => akrixUpdateEvent('not json')); await p.evaluate(() => akrixUpdateEvent('{"type":5}'));

    // web-ready → «Перезапустить»: saves first, then native restart
    await p.evaluate(() => { const f = PM.flushAll; PM.flushAll = async () => { window.__flushed = (window.__flushed || 0) + 1; return f && f(); }; });
    await p.evaluate(() => akrixUpdateEvent(JSON.stringify({type: 'web-ready', manual: false, version: '82.99'})));
    const card = p.locator('#labUpd.on');
    chk(await card.isVisible() && (await card.textContent()).includes('82.99'), 'web-ready (even background): sticky card with version', await card.textContent());
    await p.locator('#labUpd .lab-upd-a').click();
    await p.waitForFunction(() => __upd.calls.some(c => c[0] === 'restart'));
    const rs = await p.evaluate(() => __upd.calls.find(c => c[0] === 'restart'));
    chk(rs[1] >= 1 && !(await p.evaluate(() => document.querySelector('#labUpd.on'))), '«Перезапустить» saves (PM.flushAll) before AkrixUpdate.restart()', rs);

    // APK
    await p.evaluate(() => akrixUpdateEvent(JSON.stringify({type: 'apk-available', manual: false, versionCode: 82018, versionName: '82.18', size: 5242880})));
    const txt = await p.locator('#labUpd').textContent();
    chk(txt.includes('82.18') && txt.includes('5.0 МБ') && (await p.locator('#labUpd .lab-upd-a').textContent()) === 'Обновить', 'apk-available card: version, size, «Обновить»', txt);
    await p.locator('#labUpd .lab-upd-a').click();
    chk(await p.evaluate(() => __upd.calls.some(c => c[0] === 'downloadApk')), '«Обновить» → AkrixUpdate.downloadApk()');
    await p.evaluate(() => akrixUpdateEvent(JSON.stringify({type: 'apk-progress', manual: true, pct: 40})));
    chk((await p.locator('#labUpd').textContent()).includes('40%') && await p.locator('#labUpd .lab-upd-a').isHidden(), 'progress shown without action button');
    await p.evaluate(() => akrixUpdateEvent(JSON.stringify({type: 'apk-failed', manual: true, reason: 'SHA-256 не совпадает'})));
    chk((await p.locator('#labUpd').textContent()).includes('SHA-256'), 'apk SHA failure reported');
    await p.evaluate(() => akrixUpdateEvent(JSON.stringify({type: 'apk-denied', manual: true})));
    chk((await p.locator('#labUpd').textContent()).includes('неизвестных') && (await p.locator('#labUpd .lab-upd-a').textContent()) === 'Повторить', 'install permission denied: hint + «Повторить»');
    await p.locator('#labUpd .lab-upd-x').click();
    chk(!(await p.evaluate(() => document.querySelector('#labUpd.on'))), 'card closes with ✕');

    // native back JS (exact string from MainActivity [BLOCK BACK-BRIDGE])
    const java = fs.readFileSync(path.join(root, 'android/app/src/main/java/ge/akrix/zamer/MainActivity.java'), 'utf8');
    const BACK = JSON.parse(java.match(/static final String BACK_JS=("(?:[^"\\]|\\.)*");/)[1]);
    const back = await p.evaluate(code => { const out = {}; delete window.AkrixBack; out.none = eval(code); window.AkrixBack = () => true; out.yes = eval(code); window.AkrixBack = () => false; out.no = eval(code);
      window.AkrixBack = () => 'true'; out.truthy = eval(code); window.AkrixBack = () => { throw Error('x'); }; out.thrown = eval(code); delete window.AkrixBack; return out; }, BACK);
    chk(back.none === false && back.yes === true && back.no === false && back.truthy === false && back.thrown === false, 'BACK_JS: true only when AkrixBack() === true', back);
    chk(!fs.readFileSync(path.join(root, 'web/lab-update.js'), 'utf8').includes('AkrixBack'), 'update module does not define AkrixBack (canvas engineer owns the JS chain)');
    await p.close();

    // ── without bridge (desktop browser)
    const q = await ctx.newPage(); q.on('pageerror', e => errors.push(e.message));
    await q.goto(url); await q.waitForFunction(() => window.MeasureLabUpdate && window.MeasureLabUI);
    await q.click('#bMore'); await q.click('#bLabUpd');
    chk((await q.evaluate(() => $('toast').textContent)).includes('только в приложении'), 'no bridge: button explains Android-only, no errors');
    await q.close();

    // ── same origin, different bundle source: data survives (Android serves https://experimental.measure-lab.local/ from assets or filesDir/web-<ver>/)
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'akx14-qa-'));
    cp.execFileSync('python3', [path.join(root, 'scripts/web_bundle.py'), 'stage', path.join(stage, 'builtin')]);
    fs.cpSync(path.join(stage, 'builtin'), path.join(stage, 'dl'), {recursive: true});
    fs.writeFileSync(path.join(stage, 'dl/lab-version.js'), fs.readFileSync(path.join(stage, 'dl/lab-version.js'), 'utf8').replace(/MeasureVersion = '[^']+'/, "MeasureVersion = '82.99'"));
    let source = 'builtin';
    await ctx.route('https://experimental.measure-lab.local/**', async route => { const u = new URL(route.request().url()); const f = path.join(stage, source, u.pathname === '/' ? 'index.html' : u.pathname.slice(1)); try { await route.fulfill({status: 200, contentType: type(f), body: fs.readFileSync(f)}); } catch { await route.fulfill({status: 404, body: ''}); } });
    const o = await ctx.newPage(); o.on('pageerror', e => errors.push(e.message)); await o.addInitScript(MOCK);
    await o.goto('https://experimental.measure-lab.local/index.html?nolist'); await o.waitForFunction(() => window.MeasureLabUI && window.PM && DB.db);
    await o.evaluate(async () => { await PM.newRoom('QA update keeps data', 'Room'); localStorage.setItem('qa-upd', 'kept'); if (PM.flushAll) await PM.flushAll(); });
    source = 'dl'; await o.reload(); await o.waitForFunction(() => window.MeasureLabUI && window.PM && DB.db && __upd.calls.some(c => c[0] === 'ready'));
    const after = await o.evaluate(async () => ({objs: (await PM.dbAll('sess')).map(s => s.obj), ls: localStorage.getItem('qa-upd'), title: zVer.textContent, ready: __upd.calls.find(c => c[0] === 'ready')[1]}));
    chk(after.objs.includes('QA update keeps data') && after.ls === 'kept', 'same origin: IndexedDB + localStorage intact after bundle switch', after);
    chk(after.title === 'Measure 82.99' && after.ready === '82.99', 'title and ready reflect the downloaded bundle', after);
    await o.close(); fs.rmSync(stage, {recursive: true, force: true});
  } catch (e) { errors.push(String(e && e.stack || e)); }
  chk(errors.length === 0, 'no page errors', errors);
  fs.writeFileSync(path.join(root, 'tests/qa-update-result.json'), JSON.stringify({checks, errors}, null, 2));
  await b.close(); server.close();
  process.exitCode = checks.some(c => !c.ok) ? 1 : 0;
})();
