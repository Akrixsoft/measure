// Measure 82.18 r5 (AKX-2026-0012, правила владельца 1–7): реальный проект (выгрузка QA «Сидоровы», 2 помещения, 6 + 4 стены) + фото на подложке.
// Данные холста (места и размеры областей, фото, разметки) НЕ меняются после ✓ (сохранить и выйти в список), повторного открытия, перезапуска,
// импорта «Обновить»; фото группой из галереи — все, последовательно вертикально ниже последнего объекта; одно фото — ниже; выделение рамкой и
// перенос группы (с разметкой) с ↶ ↷; масштаб фото за угол (разметка — вместе) и щипком (по пустому месту — вид); подрезка ✓ + ↶ ↷, исходник цел;
// ▣ Стена по рамке: рамка = L × H области, область — в свободном месте, ↶ ↷; ↶ и «Стены в плоскости» вписывают вид; снимки без ручек. Скриншоты — QA_SHOT.
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 node tests/qa-v8218-real.cjs
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const VW = +(process.env.QA_VW || 412), VH = +(process.env.QA_VH || 797), DPR = +(process.env.QA_DPR || 3), TAG = `${VW}x${VH}x${DPR}`;
const SHOT = process.env.QA_SHOT || path.join('/tmp/qa8218-real', TAG);
const SAMPLE = path.join(root, 'prototypes/sketch/sample.jpg');
fs.mkdirSync(SHOT, {recursive: true});

(async () => {
  const server = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).slice(1);
    try { r.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.jpg') ? 'image/jpeg' : 'text/html'); r.end(fs.readFileSync(path.join(root, f))); } catch { r.writeHead(404).end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/web/experimental.html`;
  const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox']});
  const ctx = await browser.newContext({viewport: {width: VW, height: VH}, deviceScaleFactor: DPR, isMobile: true, hasTouch: true});
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', {get: () => false}));
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  const checks = [], errors = [], info = {};
  p.on('pageerror', e => errors.push(String(e.stack || e)));
  const check = (ok, name, detail) => { checks.push({ok: !!ok, name, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(detail ?? '').slice(0, 900)); };
  let shotN = 0; const shot = n => p.screenshot({path: path.join(SHOT, String(++shotN).padStart(2, '0') + '-' + n + '.png')});
  const wait = ms => p.waitForTimeout(ms);
  async function down(t, a) { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: a[0], y: a[1], id: 5}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: a[0], y: a[1], pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, force: .6}); }
  async function move(t, a, b) { for (let i = 1; i <= 12; i++) { const x = a[0] + (b[0] - a[0]) * i / 12, y = a[1] + (b[1] - a[1]) * i / 12; if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y, id: 5}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, pointerType: 'pen', button: 'left', buttons: 1, force: .6}); } }
  async function up(t, b) { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: b[0], y: b[1], pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1}); await wait(80); }
  const tap = async (t, a) => { await down(t, a); await up(t, a); await wait(150); };
  const drag = async (t, a, b) => { await down(t, a); await move(t, a, b); await up(t, b); await wait(200); };
  const box = sel => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const tapSel = async (t, sel) => { const c = await box(sel); if (!c) throw new Error('нет на экране: ' + sel); await tap(t, c); };
  const kbOn = () => p.evaluate(() => { const k = document.getElementById('zkb'); return !!(k && k.getClientRects().length && getComputedStyle(k).display !== 'none' && k.getBoundingClientRect().height > 50); });
  const typeIn = async v => {
    if (await kbOn()) { await p.evaluate(() => { const a = KB.el; if (a) { const n = a.value.length; a.setSelectionRange(n, n); } }); for (let i = 0; i < 7; i++) await tapSel('touch', '#zkb [data-kk="bs"]');
      for (const ch of String(Math.abs(v))) await tapSel('touch', `#zkb [data-kk="${ch === '.' ? ',' : ch}"]`); await tapSel('touch', '#zkb [data-kk="ok"]'); await wait(200); return; }
    await p.keyboard.press('Control+A'); await p.keyboard.type(String(v)); await p.keyboard.press('Enter'); await wait(200); };
  const cssK = w => p.evaluate(w => { const s = MeasureLabSketch.map.toScrK(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const refAt = (id, u, v) => p.evaluate(([id, u, v]) => { const R = MeasureLabSketch.refRegion(id); return [R.x + R.w * u, R.y + R.h * v]; }, [id, u, v]).then(cssK);
  const wallPt = w => p.evaluate(w => { const s = PM.toScr(...fromW(w, wf())), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const plPt = w => p.evaluate(w => { const s = PM.toScr(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  async function caseTool(sel) { const f = (await box('#zpF')) || (await box('#labPlF')); await tap('touch', f); await wait(200); await tapSel('touch', '#tb.on ' + sel); await wait(200); }
  const fieldAt = q => p.evaluate(q => { draw(); const d = devicePixelRatio, r = cv.getBoundingClientRect(), e = q.id ? S.els.find(x => x.id === q.id) : null;
    const l = S.w3L.find(x => { const k = w3FKind(x); if (!k) return false; if (q.t === 'el') return k.t === 'el' && k.id === e.id && k.ax === q.ax; return false; });
    return l ? [l.c[0] / d + r.left, l.c[1] / d + r.top] : null; }, q);
  const FIX = path.join(root, 'tests/fixtures/qa3-sidorovy-2rooms.json');
  const hookToast = () => p.evaluate(() => { if (window.__toastHook) return; window.__toastHook = 1; window.__toastLog = []; const t0 = toast; toast = function (t) { __toastLog.push(String(t)); return t0.apply(this, arguments); }; });
  const restore = async how => { await p.evaluate(() => MeasureLabProjects.show()); await wait(400); await tapSel('touch', '#labPrj [data-lp="menu"]'); await wait(300);
    const fc = p.waitForEvent('filechooser', {timeout: 8000});
    const c = await p.evaluate(() => { const e = [...document.querySelectorAll('#labPrj button,#labPrj [role=button],#labPrj .lp-it')].find(e => e.getClientRects().length && e.textContent.includes('Восстановить из копии')); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await tap('touch', c); await (await fc).setFiles(FIX); await wait(900);
    if (how) { const nb = await p.evaluate(h => { const e = [...document.querySelectorAll('#labPrj .lp-dg.on button')].find(e => e.textContent.includes(h)); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, how); if (nb) await tap('pen', nb); }
    await p.waitForFunction(() => MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 20000}); await wait(1500); };
  // ── данные холста из базы (после сохранения): области (ax, ay, k), фото (x, y, w, iw, ih, подрезка), разметка подложки (точки)
  const data = () => p.evaluate(async () => { try { await flushAll(); } catch (e) { } try { await MeasureLabSketch.saveNow(); } catch (e) { }
    const K = MeasureLabSketch.state, b = (await dbGet('sess', K.board)) || {}, R = n => Math.round(n * 100) / 100;
    return {items: Object.fromEntries(K.items.map(i => [i.id, [i.t, R(i.ax), R(i.ay), R(i.k)].join(' ')])),
      refs: Object.fromEntries((b.refs || []).map(r => [r.id, [R(r.x), R(r.y), R(r.w), R(r.iw), R(r.ih), r.crop ? JSON.stringify(r.crop) : '-'].join(' ')])),
      mk: Object.fromEntries(['drw', 'dms', 'rts', 'polys'].flatMap(k => (b[k] || []).map(q => [q.id, JSON.stringify([q.a, q.b, q.pts])])))}; });
  const diff = (A, B, skip = []) => { const out = []; for (const g of ['items', 'refs', 'mk']) for (const id of Object.keys(A[g])) { if (skip.includes(id)) continue; if (!(id in B[g])) out.push(g + ':' + id + ' нет'); else if (A[g][id] !== B[g][id]) out.push(g + ':' + id + ' ' + A[g][id] + ' → ' + B[g][id]); } return out; };
  const same = (name, A, B, skip) => { const d = diff(A, B, skip); check(!d.length, name, d.length ? d.slice(0, 12) : {items: Object.keys(B.items).length, refs: Object.keys(B.refs).length, mk: Object.keys(B.mk).length}); };
  const ref = id => p.evaluate(id => { const r = (MeasureLabSketch.active() && MeasureLabSketch.active().t === 'board' ? S.refs : (MeasureLabSketch.state.boardRec || {}).refs || []).find(x => x.id === id); return r && JSON.parse(JSON.stringify(r)); }, id);
  const pinch = async (a1, b1, a2, b2) => { const T = (type, P) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: P.map((q, i) => ({x: q[0], y: q[1], id: 11 + i}))});
    await T('touchStart', [a1]); await wait(40); await T('touchStart', [a1, b1]); await wait(40);
    for (let i = 1; i <= 10; i++) { const f = i / 10, m = (u, v) => [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f]; await T('touchMove', [m(a1, a2), m(b1, b2)]); await wait(16); }
    await T('touchEnd', [a2]); await wait(30); await T('touchEnd', []); await wait(400); };
  const viewOnRefs = ids => p.evaluate(ids => { const B = ids.map(id => MeasureLabSketch.refRegion(id)), x0 = Math.min(...B.map(b => b.x)), y0 = Math.min(...B.map(b => b.y)), x1 = Math.max(...B.map(b => b.x + b.w)), y1 = Math.max(...B.map(b => b.y + b.h)), m = (x1 - x0) * .35;
    MeasureLabSketch.showRect(x0 - m, y0 - m * .3, x1 + m, y1 + m * .3); }, ids);
  const settle = async () => { await wait(200); await p.waitForFunction(() => !MeasureLabSketch.bgBusy(), null, {timeout: 30000}); await p.evaluate(async () => { await MeasureLabSketch.activate('board'); await MeasureLabSketch.snapMissing(MeasureLabSketch.active()); await MeasureLabSketch.activate('board'); }); await wait(300); await p.waitForFunction(() => !MeasureLabSketch.bgBusy(), null, {timeout: 30000}); };   // снимки свежие — фоновые снимки не перехватывают жест
  const toList = async () => { await tapSel('touch', '#bDone'); await p.waitForFunction(() => MeasureLabProjects.isOpen(), null, {timeout: 10000}); await wait(600); };
  const reopen = async () => { const pid = await p.evaluate(() => MeasureLabSketch.state.pid); await p.evaluate(pid => MeasureLabProjects.open(pid), pid); await p.waitForFunction(() => MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 20000}); await wait(1500); };
  try {
    await p.goto(url); await p.waitForSelector('#labPrj.on', {timeout: 20000}); await wait(400);
    // реальный проект: выгрузка QA «Сидоровы» — 2 помещения (6 + 4 стены)
    await p.evaluate(() => { MeasureLabProjects.hide(); window.__prep = []; new MutationObserver(() => { const e = document.getElementById('labPrep'); if (e) __prep.push(e.textContent); }).observe(document.body, {childList: true, subtree: true, characterData: true}); });
    await restore(null); await hookToast();
    // решение Master: после импорта — экран «Подготовка холста… N/M» до работы, затем все снимки есть; касание сразу после — туда, куда коснулись
    { const pr = await p.evaluate(() => ({log: [...new Set(__prep)], left: !!document.getElementById('labPrep'), stale: MeasureLabSketch.state.items.filter(i => MeasureLabSketch.snapStale(i.id)).map(i => i.name || i.t), act: MeasureLabSketch.active() && MeasureLabSketch.active().t}));
      check(pr.log.some(t => /Подготовка холста… \d+\/\d+/.test(t)) && !pr.left && !pr.stale.length, 'импорт: экран «Подготовка холста… N/M», затем снимки всех областей есть', pr);
      const tgt = await p.evaluate(() => { const K = MeasureLabSketch.state, a = MeasureLabSketch.active(), d = devicePixelRatio, H = cv.getBoundingClientRect().height, W = cv.getBoundingClientRect().width;
        const L = K.items.filter(i => i.t === 'wall' && i !== a).map(it => { const r = MeasureLabSketch.region(it), c = [r.x + r.w / 2, r.y + r.h / 2], q = MeasureLabSketch.map.toScrK(...c); return {id: it.id, c, q: [q[0] / d, q[1] / d]}; });
        return L.find(o => o.q[0] > 20 && o.q[0] < W - 20 && o.q[1] > 130 && o.q[1] < H - 220) || L[0]; });   // область, видимая на экране
      await tap('touch', await cssK(tgt.c)); await wait(1500);
      const a2 = await p.evaluate(() => MeasureLabSketch.active() && MeasureLabSketch.active().id); check(a2 === tgt.id, 'касание области сразу после подготовки — активна она', {tgt: tgt.id, act: a2}); }
    const st0 = await p.evaluate(async () => { const K = MeasureLabSketch.state, rooms = (await dbAll('sess')).filter(o => o.kind === 'room' && !o.del && o.oid === K.pid); return {items: K.items.map(i => i.t), rooms: rooms.length, segs: rooms.reduce((n, r) => n + r.ms.pts.length - (r.ms.closed ? 0 : 1), 0)}; });
    check(st0.items.filter(t => t === 'wall').length >= 3 && st0.items.includes('plan') && st0.segs >= 10, 'подготовка: импорт — 2 помещения (10 стен плана), области стен и план', st0);
    const D0 = await data();
    // 1. фото группой из галереи (3 файла) — все добавлены, вертикально друг за другом ниже последнего объекта; существующие объекты на месте
    await p.evaluate(() => MeasureLabSketch.activate('board')); await wait(400);
    const bot0 = await p.evaluate(() => MeasureLabSketch.below());
    { const fc = p.waitForEvent('filechooser', {timeout: 8000}); await caseTool('[data-lab-tb="gal"]'); await (await fc).setFiles([SAMPLE, SAMPLE, SAMPLE]); }
    await p.waitForFunction(() => S.refs && S.refs.length === 3, null, {timeout: 15000}); await wait(600); await shot('01-группа из галереи');
    const col = async n0 => p.evaluate(([n0, y0]) => { const B = S.refs.slice(n0).map(r => MeasureLabSketch.refRegion(r.id)); const bad = []; B.forEach((b, i) => { if (b.y < (i ? B[i - 1].y + B[i - 1].h : y0) - .5) bad.push(i + n0 + 1); if (i && Math.abs(b.x - B[0].x) > .5) bad.push('x' + (i + n0 + 1)); }); return {n: S.refs.length, bad, ys: B.map(b => Math.round(b.y)), y0: Math.round(y0)}; }, [n0, (bot0 || {y: -1e9}).y]);
    { const c = await col(0); check(c.n === 3 && !c.bad.length, 'правило 3: 3 фото из галереи — все добавлены, друг под другом ниже последнего объекта', c); }
    const D1 = await data(); same('правило 1: добавление фото не сдвинуло области', D0, D1);
    // одно фото — ниже последнего объекта (теперь — ниже 3-го фото)
    { const b1 = await p.evaluate(() => MeasureLabSketch.below()); const fc = p.waitForEvent('filechooser', {timeout: 8000}); await caseTool('[data-lab-tb="gal"]'); await (await fc).setFiles([SAMPLE]);
      await p.waitForFunction(() => S.refs && S.refs.length === 4, null, {timeout: 15000}); await wait(500);
      const r4 = await p.evaluate(() => MeasureLabSketch.refRegion(S.refs[3].id)); check(r4.y >= b1.y - .5, 'правило 3: одно фото — ниже последнего объекта холста', {top: Math.round(r4.y), below: Math.round(b1.y)}); }
    const ids = await p.evaluate(() => S.refs.map(r => r.id));
    // текст на фото 2 (разметка на фото)
    await viewOnRefs([ids[1], ids[2]]); await wait(300);
    await p.evaluate(() => pickTool('txt')); await tap('touch', await refAt(ids[1], .3, .3)); await wait(250);
    await p.evaluate(() => { const i = document.getElementById('pp').querySelector('[data-zt]'); if (i) { i.value = 'Холодильник справа'; i.dispatchEvent(new Event('input', {bubbles: true})); i.dispatchEvent(new Event('change', {bubbles: true})); i.blur(); } pickTool('sel'); }); await wait(200);
    const txtId = await p.evaluate(id => { const q = (S.drw || []).find(x => x.k === 'txt' && x.tx === 'Холодильник справа'); return q && q.id; }, ids[1]);
    check(!!txtId && (await p.evaluate(([id, t]) => MeasureLabBoard.attached(id).some(q => q.id === t), [ids[1], txtId])), 'подготовка: текст на фото 2 — разметка фото', {txtId});
    // 2. ✓ — сохранить и выйти в список; повторное открытие — данные те же
    const D2 = await data(); await toList(); await shot('02-✓ список проектов');
    check(await p.evaluate(() => MeasureLabProjects.isOpen()), 'правило 2: ✓ — выход в список проектов', null);
    const D2b = await data(); same('правило 1: ✓ не изменил данные холста', D2, D2b);
    await reopen(); same('правило 1: открытие проекта не изменило данные холста', D2, await data());
    // 3. выделение рамкой (фото 2 и 3) и перенос группы с разметкой; ↶ ↷
    await settle(); await viewOnRefs([ids[1], ids[2]]); await wait(300);
    await p.evaluate(() => pickTool('rsel')); await wait(150);
    { const a = await refAt(ids[1], -.15, .2), b = await refAt(ids[2], .5, .5); await drag('touch', a, b); await wait(300); }
    const grp = await p.evaluate(() => MeasureLabBoard.group());
    check(grp.length === 2 && grp.includes(ids[1]) && grp.includes(ids[2]), 'правило 3: рамка выделения — группа фото 2 и 3', grp);
    const G0 = await data(), t0 = await p.evaluate(t => JSON.stringify(S.drw.find(x => x.id === t).a), txtId);
    { const a = await refAt(ids[1], .6, .6); await drag('touch', a, [a[0] + 70, a[1] + 40]); await wait(300); } await shot('03-перенос группы');
    const G1 = await data();
    const mv = await p.evaluate(([i1, i2, i0]) => { const r = id => S.refs.find(x => x.id === id); return {d1: [r(i1).x, r(i1).y], d2: [r(i2).x, r(i2).y], p0: [r(i0).x, r(i0).y]}; }, [ids[1], ids[2], ids[0]]);
    { const p1 = G0.refs[ids[1]].split(' ').map(Number), p2 = G0.refs[ids[2]].split(' ').map(Number), q1 = G1.refs[ids[1]].split(' ').map(Number), q2 = G1.refs[ids[2]].split(' ').map(Number), ta = JSON.parse(t0), tb = await p.evaluate(t => S.drw.find(x => x.id === t).a, txtId);
      const dx = q1[0] - p1[0], dy = q1[1] - p1[1];
      check(Math.abs(dx) > 5 && Math.abs(q2[0] - p2[0] - dx) < .5 && Math.abs(q2[1] - p2[1] - dy) < .5 && Math.abs(tb[0] - ta[0] - dx) < .5 && Math.abs(tb[1] - ta[1] - dy) < .5, 'правило 3: группа перенесена целиком, текст на фото — вместе', {dx, dy, txt: [tb[0] - ta[0], tb[1] - ta[1]]});
      same('правило 3: перенос группы — остальные объекты на месте', G0, G1, [ids[1], ids[2], txtId]); }
    await p.evaluate(() => zUndo()); await wait(500); same('перенос группы: ↶ — на прежнем месте', G0, await data());
    await p.evaluate(() => zRedo()); await wait(500); same('перенос группы: ↷ — снова перенесена', G1, await data());
    // 4. масштаб фото 2 за угол (ПН): ЛВ на месте, пропорции, текст масштабируется вместе; ✓ → открыть — размер сохранён
    await settle(); await p.evaluate(() => { MeasureLabBoard.setGroup([]); pickTool('sel'); }); await viewOnRefs([ids[1]]); await wait(300);
    await tap('touch', await refAt(ids[1], .5, .8)); await wait(300);
    const s0 = await ref(ids[1]), tu0 = await p.evaluate(([id, t]) => { const r = S.refs.find(x => x.id === id), a = S.drw.find(x => x.id === t).a, h = r.w * r.ih / r.iw; return [(a[0] - r.x) / r.w, (r.y - a[1]) / h]; }, [ids[1], txtId]);
    { const c = await refAt(ids[1], 1, 1); await drag('touch', [c[0] + 6, c[1] + 6], [c[0] - 40, c[1] - 50]); await wait(300); } await shot('04-масштаб за угол');
    const s1 = await ref(ids[1]), tu1 = await p.evaluate(([id, t]) => { const r = S.refs.find(x => x.id === id), a = S.drw.find(x => x.id === t).a, h = r.w * r.ih / r.iw; return [(a[0] - r.x) / r.w, (r.y - a[1]) / h]; }, [ids[1], txtId]);
    check(s1.w < s0.w * .97 && Math.abs(s1.x - s0.x) < .01 && Math.abs(s1.y - s0.y) < .01 && Math.abs(tu1[0] - tu0[0]) < .005 && Math.abs(tu1[1] - tu0[1]) < .005, 'правило 4: масштаб за угол — противоположный угол на месте, текст на фото — вместе', {w0: s0.w, w1: s1.w, tu0, tu1});
    await p.evaluate(() => zUndo()); await wait(400); check(Math.abs((await ref(ids[1])).w - s0.w) < .01, 'масштаб за угол: ↶ — прежний размер', null);
    await p.evaluate(() => zRedo()); await wait(400);
    // щипок по выделенному фото 3 — масштаб фото; по пустому месту — масштаб вида
    await settle(); await p.evaluate(() => pickTool('sel')); await viewOnRefs([ids[2]]); await wait(300); await tap('touch', await refAt(ids[2], .5, .5)); await wait(300);
    { const Dz = await data(), u0 = await p.evaluate(() => MeasureLabSketch.state.view.s), a = await refAt(ids[2], -.2, .35), b = await refAt(ids[2], -.2, .65);   // слева от фото 3 — пусто
      await pinch(a, b, [a[0] - 8, a[1] - 40], [b[0] + 8, b[1] + 40]);
      const u2 = await p.evaluate(() => MeasureLabSketch.state.view.s); check(Math.abs(u2 - u0) / u0 > .05, 'правило 4: щипок по пустому месту — масштаб вида', {s0: u0, s1: u2, at: [a, b]}); same('щипок по пустому месту — данные не изменились', Dz, await data());
      await viewOnRefs([ids[2]]); await wait(300); }
    const z0 = await ref(ids[2]), v0 = await p.evaluate(() => MeasureLabSketch.state.view.s);
    { const a = await refAt(ids[2], .45, .4), b = await refAt(ids[2], .55, .6); await pinch(a, b, [a[0] - 25, a[1] - 35], [b[0] + 25, b[1] + 35]); }
    const z1 = await ref(ids[2]), v1 = await p.evaluate(() => MeasureLabSketch.state.view.s);
    check(z1.w > z0.w * 1.2 && Math.abs(v1 - v0) / v0 < .01, 'правило 4: щипок по выделенному фото — масштаб фото, вид не меняется', {w0: z0.w, w1: z1.w, s0: v0, s1: v1});
    // 5. подрезка фото 3: рамка ✓ → вырез; исходник цел; ↶ ↷
    await settle(); await viewOnRefs([ids[2]]); await wait(300); await tap('touch', await refAt(ids[2], .5, .5)); await wait(300);
    const c0 = await ref(ids[2]); await tapSel('touch', '#labSkPh [data-skp="crop"]'); await wait(300);
    check(!!(await p.evaluate(() => MeasureLabBoard.cropState())), 'правило 5: ✂ — рамка подрезки', null);
    { const a = await refAt(ids[2], 0, 0); await drag('touch', a, [a[0] + 30, a[1] + 40]); const b = await refAt(ids[2], 1, 1); await drag('touch', b, [b[0] - 20, b[1] - 30]); } await shot('05-рамка подрезки');
    await tapSel('touch', '#labCrOk'); await wait(400); await shot('05a-подрезано');
    const c1 = await ref(ids[2]);
    const blob = await p.evaluate(async id => { const b = await dbGet('img', 'ref:' + id); const im = await createImageBitmap(b); return [im.width, im.height]; }, ids[2]);
    { const k = c0.w / c0.iw, ok = c1.crop && c1.iw < c0.iw && c1.ih < c0.ih && Math.abs(c1.x - (c0.x + c1.crop.x * k)) < .05 && Math.abs(c1.y - (c0.y - c1.crop.y * k)) < .05 && Math.abs(c1.w / c1.iw - k) < 1e-6;
      check(ok && blob[0] === c1.crop.ow && blob[1] === c1.crop.oh, 'правило 5: подрезка — вырез на месте, масштаб тот же, исходник (img) не изменён', {crop: c1.crop, iw: c1.iw, ih: c1.ih, blob}); }
    const C1 = await data();
    await p.evaluate(() => zUndo()); await wait(500); { const r = await ref(ids[2]); check(!r.crop && Math.abs(r.w - c0.w) < .01 && Math.abs(r.x - c0.x) < .01 && r.iw === c0.iw, 'подрезка: ↶ — фото целиком', {crop: r.crop || null, w: r.w}); } await shot('05b-↶ подрезки');
    await p.evaluate(() => zRedo()); await wait(500); same('подрезка: ↷ — снова подрезано', C1, await data());
    // решение Master: 10 с простоя — активная область не переключается сама (фоновых снимков с переключением нет)
    { const tr = await p.evaluate(async () => { const out = new Set(), t0 = Date.now(); while (Date.now() - t0 < 10000) { const a = MeasureLabSketch.active(); out.add((a ? a.t + ':' + (a.id || '') : '-') + '|' + (S.sess ? S.sess.id : S.mode)); await new Promise(z => setTimeout(z, 200)); } return [...out]; });
      check(tr.length === 1, '10 с простоя — без переключений активной области', tr); }
    // 6. ▣ Стена по рамке на фото 1: рамка (аспект L / H) → фото в реальном масштабе (рамка = L × H области), область — в свободном месте; ↶ ↷
    await settle(); await p.evaluate(() => pickTool('sel')); await viewOnRefs([ids[0]]); await wait(300); await tap('touch', await refAt(ids[0], .5, .5)); await wait(300);
    const L = 3000, H = 2500; const r0 = await ref(ids[0]); const fu = .8, fv = fu * r0.iw / (L / H) / r0.ih, u0 = .1, v0q = .1;
    await tapSel('touch', '#labSkPh [data-skp="cor"]'); await wait(200);
    for (const [u, v] of [[u0, v0q], [u0 + fu, v0q], [u0 + fu, v0q + fv], [u0, v0q + fv]]) { await tap('touch', await refAt(ids[0], u, v)); await wait(150); }
    const fc0 = await p.evaluate(id => { const r = S.refs.find(x => x.id === id), k = r.w / r.iw; return r.q.reduce((m, q) => [m[0] + (r.x + q[0] * k) / 4, m[1] + (r.y - q[1] * k) / 4], [0, 0]); }, ids[0]);
    const W0 = await data();
    await tapSel('touch', '#labSkPh [data-skp="wall"]'); await wait(500);
    await p.evaluate(([L, H]) => { const B = [...document.querySelectorAll('[data-sk-room]')].pop().closest('div,section,form') || document; const s = [...document.querySelectorAll('[data-sk-room]')].pop(); s.value = ''; s.dispatchEvent(new Event('change')); [...document.querySelectorAll('[data-sk-l]')].pop().value = String(L); [...document.querySelectorAll('[data-sk-h]')].pop().value = String(H); [...document.querySelectorAll('[data-sk-name]')].pop().value = 'Кухня'; }, [L, H]);
    { const c = await p.evaluate(() => { const e = [...document.querySelectorAll('button')].filter(e => e.getClientRects().length && e.textContent.trim() === 'Создать').pop(); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await tap('touch', c); }
    await p.waitForFunction(() => { const a = MeasureLabSketch.active(); return a && a.t === 'wall' && /Кухня/.test(a.name || ''); }, null, {timeout: 20000}); await wait(1500); await shot('06-стена по рамке');
    const W1 = await data();
    const wf = await p.evaluate(async id => { const K = MeasureLabSketch.state, b = await dbGet('sess', K.board), r = b.refs.find(x => x.id === id), it = MeasureLabSketch.active(), k = r.w / r.iw, q = r.q, c = [q[3], q[2], q[1], q[0]], d = (a, b2) => Math.hypot(b2[0] - a[0], b2[1] - a[1]);
      const R = MeasureLabSketch.region, ov = (a, b2) => a.x < b2.x + b2.w - .5 && a.x + a.w > b2.x + .5 && a.y < b2.y + b2.h - .5 && a.y + a.h > b2.y + .5, ra = R(it), ta = MeasureLabSketch.titleBox(it);
      const P = b.refs.map(x => ({id: x.id, b: {x: x.x, y: -x.y, w: x.w, h: x.w * x.ih / x.iw}})), hits = P.filter(o => ov(ra, o.b) || ov(ta, o.b)).concat(K.items.filter(x => x !== it).map(x => ({id: x.id, b: R(x)})).filter(o => ov(ra, o.b))).map(o => o.id);   // заголовок — в px экрана: с областями сравнивается рамка
      return {fw: (d(c[0], c[1]) + d(c[3], c[2])) / 2 * k, fh: (d(c[0], c[3]) + d(c[1], c[2])) / 2 * k, L: it.L, H: it.H, k: it.k, w: r.w, hits, wall: it.id}; }, ids[0]);
    { const fc1 = await p.evaluate(async id => { const b = await dbGet('sess', MeasureLabSketch.state.board), r = b.refs.find(x => x.id === id), k = r.w / r.iw; return {c: r.q.reduce((m, q) => [m[0] + (r.x + q[0] * k) / 4, m[1] + (r.y - q[1] * k) / 4], [0, 0]),
        over: b.refs.some(x => x.id !== id && x.x < r.x + r.w && x.x + x.w > r.x && x.y - x.w * x.ih / x.iw < r.y && x.y > r.y - r.w * r.ih / r.iw), toast: (window.__toastLog || []).slice(-3)}; }, ids[0]);
      check(Math.hypot(fc1.c[0] - fc0[0], fc1.c[1] - fc0[1]) < .5, 'решение Master: масштаб фото по рамке — центр рамки на месте', {before: fc0, after: fc1.c});
      check(!fc1.over || fc1.toast.some(t => t.includes('Фото перекрывает соседние — перетащите')), 'увеличенное фото накрывает соседние — тост «перетащите», соседние не двигаются', fc1); }
    check(Math.abs(wf.fw - wf.L * wf.k) / (wf.L * wf.k) < .01 && Math.abs(wf.fh - wf.H * wf.k) / (wf.H * wf.k) < .01, 'правило 6: фото в реальном масштабе — рамка = L × H области стены', wf);
    check(!wf.hits.length, 'правило 6: область стены — в свободном месте (не поверх фото и областей)', wf.hits);
    same('правило 6: остальные объекты не сдвинуты', W0, W1, [ids[0], ...Object.keys(W0.mk).filter(m => false)]);
    check(!!W1.items[wf.wall], 'правило 6: создана область стены', W1.items[wf.wall]);
    await p.evaluate(() => zUndo()); await wait(1500);
    { const U = await data(); check(!U.items[wf.wall] && U.refs[ids[0]] === W0.refs[ids[0]], 'стена по рамке: ↶ — области нет, фото — прежнего размера', {ref: U.refs[ids[0]], was: W0.refs[ids[0]]}); }
    await p.evaluate(() => zRedo()); await wait(1500);
    { const U = await data(); check(!!U.items[wf.wall] && U.refs[ids[0]] === W1.refs[ids[0]], 'стена по рамке: ↷ — область и масштаб фото снова', {ref: U.refs[ids[0]], was: W1.refs[ids[0]]}); }
    // 7. ↶ после перехода — вид на активированную область (камера); «Стены в плоскости» — стена вписана; снимки без ручек
    await p.evaluate(async () => { await MeasureLabSketch.goPlan(); const r = (await dbAll('sess')).find(o => o.kind === 'room' && !o.del && o.oid === MeasureLabSketch.state.pid && o.name === 'Прихожая'); await openRoom(r.id, null, true); plSnap(); S.room.ms.pts[0] = [S.room.ms.pts[0][0] - 50, S.room.ms.pts[0][1]]; saveRoom(); draw(); }); await wait(500);
    { await p.evaluate(async () => { await MeasureLabSketch.activate('board'); MeasureLabSketch.state.view.s *= .3; MeasureLabSketch.map.syncToS(MeasureLabSketch.active()); draw(); }); await wait(300);
      const Dv = await data(); await p.evaluate(() => zUndo()); await wait(1500);
      const u = await p.evaluate(() => { const a = MeasureLabSketch.active(), r = MeasureLabSketch.region(a), d = devicePixelRatio, A = MeasureLabSketch.map.toScrK(r.x, r.y), Bq = MeasureLabSketch.map.toScrK(r.x + r.w, r.y + r.h), cr = cv.getBoundingClientRect();
        return {t: a.t, w: Math.round((Bq[0] - A[0]) / d), h: Math.round((Bq[1] - A[1]) / d), x: Math.round(A[0] / d), cw: Math.round(cr.width), fh: Math.round((typeof zFreeH === 'function' ? zFreeH() : cv.height) / d)}; });
      check((u.t === 'plan' || u.t === 'wall') && (u.w >= u.cw * .6 || u.h >= u.fh * .5) && u.x >= -2 && u.x + u.w <= u.cw + 2, 'правило 7: ↶ — вид на активированную область', u);
      await p.evaluate(() => zRedo()); await wait(1500); same('правило 7: ↶ ↷ перехода — данные холста те же', Dv, await data()); }
    { await p.evaluate(async () => { await MeasureLabSketch.goPlan(); const r = (await dbAll('sess')).find(o => o.kind === 'room' && !o.del && o.oid === MeasureLabSketch.state.pid && o.name === 'Прихожая'); await openRoom(r.id, null, true); S.psel = {t: 's', i: 1}; draw(); }); await wait(600);
      await tapSel('touch', '#mdT [data-md="wall"]'); await wait(1800);
      const m4 = await p.evaluate(() => { const a = MeasureLabSketch.active(), r = a && a.t === 'wall' && MeasureLabSketch.region(a), d = devicePixelRatio, cr = cv.getBoundingClientRect(); if (!r) return {t: a && a.t};
        const A = MeasureLabSketch.map.toScrK(r.x, r.y), Bq = MeasureLabSketch.map.toScrK(r.x + r.w, r.y + r.h); return {t: a.t, room: S.room0 && S.room0.name, x0: Math.round(A[0] / d), x1: Math.round(Bq[0] / d), w: Math.round((Bq[0] - A[0]) / d), cw: Math.round(cr.width)}; });
      await shot('07-стены в плоскости');
      check(m4.t === 'wall' && m4.room === 'Прихожая' && m4.x0 >= -2 && m4.x1 <= m4.cw + 2 && m4.w >= m4.cw * .6, 'правило 7: «Стены в плоскости» — стена выбранного помещения, вид вписан', m4); }
    // 8. перезапуск, ✓, открытие, «Обновить» — данные холста не меняются
    const D8 = await data();
    await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && MeasureLabSketch.isOpen(), null, {timeout: 20000}); await wait(3500); await hookToast();
    same('правило 1: перезапуск — данные холста те же', D8, await data()); await shot('08-перезапуск');
    { const r = await ref(ids[2]).catch(() => null); }
    await toList(); same('правило 1: ✓ после перезапуска — данные те же', D8, await data()); await reopen();
    { await p.evaluate(() => MeasureLabSketch.activate('board')); await wait(600); const r = await ref(ids[2]); check(r && r.crop && Math.abs(r.w - c1.w) < .01, 'подрезка и масштаб фото сохранены после перезапуска', r && {crop: r.crop, w: r.w}); }
    const hs = await p.evaluate(() => { const K = MeasureLabSketch.state, out = []; for (const it of K.items) { const sn = K.snaps[it.id]; if (!sn || !sn.img || !sn.img.getContext) continue; const g = sn.img.getContext('2d').getImageData(0, 0, sn.img.width, sn.img.height).data; let n = 0; for (let i = 0; i < g.length; i += 4) if (g[i] > 225 && g[i + 1] > 115 && g[i + 1] < 160 && g[i + 2] < 40) n++; if (n > 40) out.push(it.name + ':' + n); } return out; });
    check(!hs.length, 'правило 7: снимки областей без выделения и ручек', hs);
    const D9 = await data(); await restore('Обновить'); await shot('09-импорт Обновить');
    { const D10 = await data(), gone = Object.keys(D9.items).filter(id => !(id in D0.items) && !(id in D10.items)); info.updGone = gone;   // стены, которых нет в файле, «Обновить» снимает (r2c QA-2 Д9)
      same('правило 1: импорт «Обновить» — места и размеры объектов холста те же', D9, D10, gone); }
    check(errors.length === 0, 'нет ошибок страницы', errors);
  } catch (e) {
    check(false, 'сценарий прерван', String(e && e.stack || e)); try { await shot('abort'); } catch (x) { }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  fs.writeFileSync(path.join(root, 'tests', `qa-v8218-real-${TAG}.json`), JSON.stringify({checks, errors, info}, null, 2));
  const bad = checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-real ${TAG}: ${checks.length - bad.length}/${checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
