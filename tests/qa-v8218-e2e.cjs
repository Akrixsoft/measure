// Measure 82.18 — сквозной сценарий владельца на интегрированной сборке (AKX-2026-0012, integration).
// Касания пером/пальцем через CDP. Старт → новый проект «Клиент · Проект» → фото → размер на фото с вводом → ⌗ 4 угла → ▣ стена над фото →
// ригель 381 у потолка (авторазмеры 2 319 + 381) → колонна с Z → план, ввод длины стены → зона → 🗑 фото → ↶ → перезапуск → фото на месте →
// «назад» (AkrixBack) ×2 → список проектов → выгрузка «для Akrix» (els[].d, no, labRooms[].zn, o.prd) → импорт в конструктор v898.
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 QA_SHOT=<папка> node tests/qa-v8218-e2e.cjs
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const VW = +(process.env.QA_VW || 412), VH = +(process.env.QA_VH || 797), DPR = +(process.env.QA_DPR || 3), TAG = `${VW}x${VH}x${DPR}`;
const SHOT = process.env.QA_SHOT || path.join('/tmp/qa8218-e2e', TAG);
const AKRIX = process.env.QA_AKRIX || '/home/claude/akrix-soft/Akrix/akrix-furniture.html';
const SAMPLE = path.join(root, 'prototypes/sketch/sample.jpg');
fs.mkdirSync(SHOT, {recursive: true});

(async () => {
  const server = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).slice(1);
    try { r.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.jpg') ? 'image/jpeg' : 'text/html'); r.end(fs.readFileSync(path.join(root, f))); } catch { r.writeHead(404).end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/web/experimental.html`;
  const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox']});
  const ctx = await browser.newContext({viewport: {width: VW, height: VH}, deviceScaleFactor: DPR, isMobile: true, hasTouch: true});
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', {get: () => false}));   // телефонный режим (без body.tz режима тестов)
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p);
  const checks = [], errors = [], info = {};
  p.on('pageerror', e => errors.push(String(e.stack || e)));
  const check = (ok, name, detail) => { checks.push({ok: !!ok, name, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(detail ?? '').slice(0, 500)); };
  let shotN = 0; const shot = n => p.screenshot({path: path.join(SHOT, String(++shotN).padStart(2, '0') + '-' + n + '.png')});
  const wait = ms => p.waitForTimeout(ms);
  // ── касания (CDP): перо — pointerType pen, палец — touch
  async function down(t, a) { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: a[0], y: a[1], id: 5}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: a[0], y: a[1], pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, force: .6}); }
  async function move(t, a, b) { for (let i = 1; i <= 12; i++) { const x = a[0] + (b[0] - a[0]) * i / 12, y = a[1] + (b[1] - a[1]) * i / 12; if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y, id: 5}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, pointerType: 'pen', button: 'left', buttons: 1, force: .6}); } }
  async function up(t, b) { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: b[0], y: b[1], pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1}); await wait(80); }
  const tap = async (t, a) => { await down(t, a); await up(t, a); await wait(150); };
  const drag = async (t, a, b) => { await down(t, a); await move(t, a, b); await up(t, b); await wait(200); };
  const box = sel => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const tapSel = async (t, sel) => { const c = await box(sel); if (!c) throw new Error('нет на экране: ' + sel); await tap(t, c); };
  const kbOn = () => p.evaluate(() => { const k = document.getElementById('zkb'); return !!(k && k.getClientRects().length && getComputedStyle(k).display !== 'none' && k.getBoundingClientRect().height > 50); });
  info.keypad = [];
  const typeIn = async v => {   // телефон: своя цифровая клавиатура #zkb (касания пальцем), иначе — клавиатура
    if (await kbOn()) { info.keypad.push(v); await p.evaluate(() => { const a = KB.el; if (a) { const n = a.value.length; a.setSelectionRange(n, n); } }); for (let i = 0; i < 7; i++) await tapSel('touch', '#zkb [data-kk="bs"]');   // курсор в конец, стереть
      for (const ch of String(Math.abs(v))) await tapSel('touch', `#zkb [data-kk="${ch === '.' ? ',' : ch}"]`); if (v < 0) await tapSel('touch', '#zkb [data-kk="pm"]');
      await tapSel('touch', '#zkb [data-kk="ok"]'); await wait(200); return; }
    await p.keyboard.press('Control+A'); await p.keyboard.type(String(v)); await p.keyboard.press('Enter'); await wait(200); };
  // координаты: холст (мм подложки, ось y вверх) и активная поверхность v81 (PM.toScr)
  const cssK = w => p.evaluate(w => { const s = MeasureLabSketch.map.toScrK(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const refAt = (id, u, v) => p.evaluate(([id, u, v]) => { const R = MeasureLabSketch.refRegion(id); return [R.x + R.w * u, R.y + R.h * v]; }, [id, u, v]).then(cssK);
  const wallPt = w => p.evaluate(w => { const s = PM.toScr(...fromW(w, wf())), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  // инструмент — из футляра 🖍 (стена / подложка: #zpF; план: #labPlF)
  async function caseTool(sel) { const f = (await box('#zpF')) || (await box('#labPlF')); await tap('touch', f); await wait(200); await tapSel('touch', '#tb.on ' + sel); await wait(200); }
  const fieldAt = q => p.evaluate(q => { draw(); const d = devicePixelRatio, r = cv.getBoundingClientRect(), e = q.id ? S.els.find(x => x.id === q.id) : null;
    const l = S.w3L.find(x => { const k = w3FKind(x); if (!k) return false; if (q.t === 'el') return k.t === 'el' && k.id === e.id && k.ax === q.ax; if (q.t === 'txt') return x.t === q.txt; return false; });
    return l ? [l.c[0] / d + r.left, l.c[1] / d + r.top] : null; }, q);
  const labels = () => p.evaluate(() => { draw(); return S.w3L.map(l => l.t); });
  const gaps = () => p.evaluate(() => { const vis = e => e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none';
    const L = [...document.getElementById('zf').children].filter(vis).map(e => e.getBoundingClientRect()).sort((a, b) => a.top - b.top); let worst = 0, over = 0;
    for (let i = 1; i < L.length; i++) { const g = L[i].top - L[i - 1].bottom; worst = Math.max(worst, g); if (g < -1) over++; }
    const b = L.length ? L[L.length - 1].bottom : 0, ruler = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.getClientRects().length && /📐/.test(e.textContent)).length;
    return {rows: L.length, worst: Math.round(worst), over, bottom: Math.round(innerHeight - b), ruler}; });
  const layoutOk = async n => { const g = await gaps(); check(g.worst <= 6 && g.over === 0 && g.bottom >= -1 && g.ruler === 0, n + ': нижние строки без зазоров и наложений, 📐 нет', g); };
  let pid, refId, sid;
  try {
    // ════ 1. старт → «Проекты» → ＋ новый проект «Клиент · Проект»
    await p.goto(url); await p.waitForSelector('#labPrj.on', {timeout: 20000}); await wait(400); await shot('start');
    await tapSel('touch', '#labPrj .lp-fab'); await p.waitForSelector('#labPrj .lp-dg.on');
    await tapSel('touch', '#labPrj [data-c]'); await p.keyboard.type('Клиент');
    await tapSel('touch', '#labPrj [data-n]'); await p.keyboard.type('Проект');
    await tapSel('pen', '#labPrj .lp-bt .lp-pr');
    await p.waitForFunction(() => window.MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 10000}); await wait(500);
    const np = await p.evaluate(async () => { const P = (await MeasureLabStore.projects()).find(x => x.client === 'Клиент'); return {pid: P && P.id, name: P && P.name, t: document.getElementById('labPrjT') && document.getElementById('labPrjT').textContent, act: MeasureLabSketch.active() && MeasureLabSketch.active().t, kind: S.sess && S.sess.kind}; });
    pid = np.pid; check(np.pid && np.name === 'Проект' && np.t === 'Клиент · Проект' && np.kind === 'board', 'новый проект: холст открыт, шапка «Клиент · Проект», активна подложка', np);
    await shot('project'); await layoutOk('холст');
    // ════ 2. фото: футляр 🖍 → «Фото из галереи» (выбор файла)
    { const fc = p.waitForEvent('filechooser', {timeout: 8000}); await caseTool('[data-lab-tb="gal"]'); await (await fc).setFiles(SAMPLE); }
    await p.waitForFunction(() => S.refs && S.refs.length === 1, null, {timeout: 10000}); await wait(500);
    refId = await p.evaluate(() => S.refs[0].id);
    await p.evaluate(() => { MeasureLabSketch.fitAll(); draw(); }); await wait(200);
    const ph = await p.evaluate(async id => ({blob: ((await dbGet('img', 'ref:' + id)) || {}).size || 0, rfb: getComputedStyle(document.getElementById('rfb')).display, rfr: document.getElementById('rfr').classList.contains('on')}), refId);
    check(ph.blob > 10000 && ph.rfb === 'none' && !ph.rfr, 'фото на подложке: картинка в базе, без плавающей плашки и экрана распознавания', ph);
    await shot('photo'); await layoutOk('фото');
    // ════ 3. стрелка-размер на фото пером → касание подписи → ввод 1250
    await caseTool('.tl[data-k="dim"]');
    await p.evaluate(() => { zo('dim').sn = 0; zo('dim').L = 0; zo('dim').P = 0; });
    await drag('pen', await refAt(refId, .2, .5), await refAt(refId, .8, .5));
    const dm = await p.evaluate(() => ({n: S.dms.length, id: S.dms[0] && S.dms[0].id, kind: S.sess.kind}));
    const lab = await p.evaluate(id => { draw(); const a = MeasureLabGeometry.dimensionLabels.get(id), r = cv.getBoundingClientRect(); return a ? [a[4] / devicePixelRatio + r.left, a[5] / devicePixelRatio + r.top] : null; }, dm.id);
    if (lab) { await tap('pen', lab); await typeIn(1250); }
    const vm = await p.evaluate(() => S.dms[0] && S.dms[0].vm);
    check(dm.n === 1 && dm.kind === 'board' && vm === 1250, 'размер на фото пером, ввод значения штатным полем → 1250', {dm, vm, lab: !!lab});
    await shot('dim-on-photo');
    // ════ 4. стена над фото: выбор фото пальцем → ⌗ → 4 угла пером → ▣ → помещение «Кухня», L 2364, H 2700
    await caseTool('.tl[data-k="sel"]').catch(async () => { await p.evaluate(() => { document.getElementById('tb').classList.remove('on'); pickTool('sel'); }); });
    await tap('touch', await refAt(refId, .5, .25)); await wait(200);
    info.rsel = await p.evaluate(() => S.rsel);
    await tapSel('touch', '#labSkPh [data-skp="cor"]');
    for (const [u, v] of [[.06, .11], [.97, .1], [.97, .89], [.08, .9]]) await tap('pen', await refAt(refId, u, v));
    await shot('corners');
    await tapSel('touch', '#labSkPh [data-skp="wall"]'); await wait(300);
    await p.selectOption('#labSketch [data-sk-room]', '');
    await tapSel('touch', '#labSketch [data-sk-name]'); await p.keyboard.press('Control+A'); await p.keyboard.type('Кухня');
    for (const [s, v] of [['[data-sk-l]', 2364], ['[data-sk-h]', 2700]]) { await tapSel('touch', '#labSketch .sk-dlg ' + s); await p.keyboard.press('Control+A'); await p.keyboard.type(String(v)); }
    await tapSel('pen', '#labSketch .sk-dlg .bt .pr');
    await p.waitForFunction(() => { const a = MeasureLabSketch.active(); return a && a.t === 'wall' && S.mosaic && S.q4 && S.q4.ok; }, null, {timeout: 15000}); await wait(500);
    const w1 = await p.evaluate(async id => { const K = MeasureLabSketch.state, a = MeasureLabSketch.active(), Rw = MeasureLabSketch.region(a), Rp = MeasureLabSketch.refRegion(id), brd = await dbGet('sess', K.board); return {sid: S.sess.id, L: S.q4.L, H: S.q4.H, above: Rw.y + Rw.h <= Rp.y + 1, link: !!(brd.refs.find(r => r.id === id) || {}).labWall}; }, refId);
    sid = w1.sid; check(w1.L === 2364 && w1.H === 2700 && w1.above && w1.link, 'стена «Кухня» 2364 × 2700 над фото, фото связано со стеной', w1);
    await shot('wall'); await layoutOk('стена');
    // ════ 5. ригель у потолка: инструмент «ригель» → протяжка пером → поля Ш 2364 / В 381 пером
    await caseTool('.tl[data-k="rig"]');
    await drag('pen', await wallPt([4, 2319]), await wallPt([2362, 2699]));
    const beam = await p.evaluate(() => S.els.find(e => e.k === 'rig') && S.els.find(e => e.k === 'rig').id);
    { const v0 = await p.evaluate(id => { const v = w3Vols(w3Model()).find(x => x.id === id); return Math.round(v.x0); }, beam);   // отступ слева после протяжки → 0 (поле «до грани»)
      if (v0 > 0) { const c = await fieldAt({t: 'txt', txt: String(v0)}); if (c) { await tap('pen', c); await typeIn(0); } } }
    for (const [ax, v] of [['W', 2364], ['H', 381]]) { if (await p.evaluate(([id, ax, v]) => Math.round(+S.els.find(e => e.id === id)[ax]) === v, [beam, ax, v])) continue; const c = await fieldAt({t: 'el', id: beam, ax}); if (c) { await tap('pen', c); await typeIn(v); } else check(false, 'поле ' + ax + ' ригеля на развёртке', null); }
    const bv = await p.evaluate(id => { const v = w3Vols(w3Model()).find(x => x.id === id); return v && {x0: Math.round(v.x0), x1: Math.round(v.x1), y0: Math.round(v.y0), y1: Math.round(v.y1)}; }, beam);
    info.beam = bv;
    let L = await labels();
    check(bv && bv.x0 === 0 && bv.x1 === 2364 && bv.y1 === 2700 && bv.y0 === 2319 && L.filter(t => t === '2 319').length >= 1 && L.filter(t => t === '381').length >= 1, 'ригель 381 у потолка: авторазмеры «2 319» + «381»', {bv, L});
    await shot('beam');
    // ════ 6. колонна от пола до ригеля → Z 300 в плашке #pp пером
    await caseTool('.tl[data-k="kol"]');
    await drag('pen', await wallPt([1000, 20]), await wallPt([1400, 2300]));
    const col = await p.evaluate(() => S.els.find(e => e.k === 'kol') && S.els.find(e => e.k === 'kol').id);
    await p.evaluate(id => { S.sel = id; mkPanel(); draw(); }, col);
    const zb = await box('#pp [data-lab-z]');
    if (zb) { await tap('pen', zb); await typeIn(300); }
    const cz = await p.evaluate(id => { const e = S.els.find(x => x.id === id); return e && {D: +e.D, W: Math.round(+e.W), H: Math.round(+e.H)}; }, col);
    check(zb && cz && cz.D === 300, 'колонна: Z = 300 из поля плашки', cz);
    await shot('column'); await layoutOk('колонна');
    // ════ 7. план (⌂ → план), касание поля длины стены → ввод
    await p.evaluate(() => mdGo('plan')); await wait(500);
    const pl0 = await p.evaluate(() => ({mode: S.mode, n: plN(S.room.ms), act: MeasureLabSketch.active().t}));
    const fld = await p.evaluate(() => { S.psel = {t: 's', i: 0}; PL.tool = 'sel'; mkPanel(); draw(); const f = S.plFld, d = devicePixelRatio, r = cv.getBoundingClientRect(); return f ? [f.c[0] / d + r.left, f.c[1] / d + r.top] : null; });
    if (fld) { await tap('pen', fld); await typeIn(2364); }
    const pl1 = await p.evaluate(() => { const m = S.room.ms, [a, b] = plSeg(m, 0); return {L: Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])), d: (plDim(m, 0) || {}).v}; });
    check(pl0.mode === 'plan' && pl0.act === 'plan' && fld && pl1.d === 2364, 'план: длина стены — касание поля, ввод 2364', {pl0, pl1});
    await shot('plan');
    // ════ 8. зона: футляр плана → «Зона» → «Контур» пером → готово
    await p.evaluate(() => { S.psel = null; draw(); });
    await caseTool('[data-lab-tb="zone"]');
    const zbtn = await p.evaluate(() => [...document.querySelectorAll('#lab12-plan [data-lab12]')].map(b => b.dataset.lab12));
    info.zoneButtons = zbtn;
    info.zoneState = await p.evaluate(() => { const z = document.getElementById('lab12-plan'); return {open: MeasureLab012.isOpen(), hidden: z.hidden, cls: z.className, disp: getComputedStyle(z).display, par: z.parentElement.id, h: z.getBoundingClientRect().height, mode: S.mode, tool: PL.tool, ss: document.getElementById('ss').classList.contains('on'), body: document.body.className}; });
    await tapSel('touch', '[data-lab12="manual"]');
    const plPt = w => p.evaluate(w => { const s = PM.toScr(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
    const seg = await p.evaluate(() => { const [a, b] = plSeg(S.room.ms, 0); return [a, b]; });
    const ax = seg[0], bx = seg[1], nx = [-(bx[1] - ax[1]), bx[0] - ax[0]], ln = Math.hypot(...nx) || 1, n = [nx[0] / ln, nx[1] / ln];
    // контур внутри области плана: отступ от стены 150…600 мм — сначала по одну сторону, если точки не легли (нет «Готово») — «Отмена» и по другую
    const magOn = await p.evaluate(() => WS.mag !== 0); if (magOn) await tapSel('touch', '[data-pm="m"]');   // 🧲 выкл. — точки контура не липнут к стене
    for (const sg of [1, -1]) {
      const zp = [[0.15, 250], [0.85, 250], [0.85, 650], [0.15, 650]].map(([u, o]) => [ax[0] + (bx[0] - ax[0]) * u + n[0] * o * sg, ax[1] + (bx[1] - ax[1]) * u + n[1] * o * sg]);
      for (const q of zp) await tap('pen', await plPt(q));
      if (await box('[data-lab12="commit"]')) await tapSel('touch', '[data-lab12="commit"]');
      if (await p.evaluate(() => MeasureLab012.regions().length)) break;
      info.zoneRetry = sg; const c = await box('[data-lab12="cancel"]'); if (c) await tap('touch', c); await tapSel('touch', '[data-lab12="manual"]');
    }
    if (magOn) await tapSel('touch', '[data-pm="m"]').catch(() => {});
    const zn2 = await p.evaluate(() => MeasureLab012.regions().map(({q}) => ({name: q.name, zn: q.zn})));
    check(zn2.length === 1 && zn2[0].zn === 1, 'зона: «Зона 1» (zn 1) контуром пером', {zn2, retry: info.zoneRetry});
    await shot('zone'); await layoutOk('зона');
    await tapSel('touch', '[data-lab12="toggle"]').catch(() => p.evaluate(() => MeasureLab012.close()));
    // ════ 8б. изделие: футляр плана → «Изделие» → ＋ Конструкция → «Кухня» → стена С1 пером
    await caseTool('[data-lab-tb="prd"]');
    await tapSel('touch', '#labprd-plan [data-labprd="add"]'); await tapSel('touch', '#labprd-plan [data-labprd="type"][data-type="Кухня"]');
    await tap('pen', await plPt([(ax[0] + bx[0]) / 2, (ax[1] + bx[1]) / 2]));
    const prd = await p.evaluate(() => MeasureLabPrd.list().map(q => ({no: q.no, type: q.type, w: q.w.length})));
    check(prd.length === 1 && prd[0].type === 'Кухня' && prd[0].w === 1, 'изделие «Кухня» (плитка «Изделие»), стена С1 касанием пера', prd);
    await shot('prd'); await layoutOk('изделия');
    await tapSel('touch', '#labprd-plan [data-labprd="close"]').catch(() => p.evaluate(() => MeasureLabPrd.close()));
    // ════ 9. 🗑 фото на подложке → ↶
    await p.evaluate(() => { MeasureLabSketch.fitAll(); draw(); }); await wait(200);
    await tap('pen', await refAt(refId, .5, .25)); await wait(400);   // касание фото — подложка активна
    await caseTool('.tl[data-k="sel"]');
    await tap('touch', await refAt(refId, .5, .25)); await wait(300);
    const sel1 = await p.evaluate(() => ({act: MeasureLabSketch.active().t, rsel: S.rsel}));
    if (sel1.act !== 'board' || !sel1.rsel) { await tap('touch', await refAt(refId, .5, .25)); await wait(300); }
    const sel2 = await p.evaluate(() => ({act: MeasureLabSketch.active().t, rsel: S.rsel}));
    await shot('photo-selected');
    await tapSel('touch', '#bDelS'); await wait(400);
    const del = await p.evaluate(() => ({refs: S.refs.length, kind: S.sess.kind}));
    await tapSel('touch', '#bUnd'); await wait(500);
    const und = await p.evaluate(async id => ({refs: S.refs.map(r => r.id), blob: ((await dbGet('img', 'ref:' + id)) || {}).size || 0}), refId);
    check(sel2.act === 'board' && sel2.rsel === refId && del.refs === 0 && und.refs.includes(refId) && und.blob > 10000, '🗑 фото (выбрано пальцем) → удалено; ↶ → фото и картинка на месте', {sel1, sel2, del, und: und.refs.length});
    await shot('photo-undo');
    // ════ 10. перезапуск → фото на месте
    await p.evaluate(async () => { try { await flushAll(); } catch (e) { } try { await MeasureLabSketch.saveNow(); } catch (e) { } dispatchEvent(new Event('pagehide')); });
    await wait(300); await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && (MeasureLabSketch.isOpen() || (window.MeasureLabProjects && MeasureLabProjects.isOpen())), null, {timeout: 20000}); await wait(1200);
    const rs = await p.evaluate(async id => { const K = MeasureLabSketch.state, b = K && K.board && await dbGet('sess', K.board); return {open: MeasureLabSketch.isOpen(), list: MeasureLabProjects.isOpen(), refs: b ? b.refs.map(r => r.id) : null, blob: ((await dbGet('img', 'ref:' + id)) || {}).size || 0, t: (document.getElementById('labPrjT') || {}).textContent}; }, refId);
    check(rs.open && !rs.list && rs.refs && rs.refs.includes(refId) && rs.blob > 10000, 'перезапуск: последний проект открыт, фото и картинка на месте', rs);
    await p.evaluate(() => { MeasureLabSketch.fitAll(); draw(); }); await wait(300); await shot('restart');
    // ════ 11. «назад» дважды → список проектов
    const b1 = await p.evaluate(() => { const r = []; for (let i = 0; i < 6 && !document.getElementById('toast').textContent.includes('Ещё раз'); i++) r.push(window.AkrixBack()); return {r, toast: document.getElementById('toast').textContent}; });
    const b2r = await p.evaluate(() => window.AkrixBack()); await wait(600);
    const b2 = await p.evaluate(r => ({r, list: MeasureLabProjects.isOpen(), sk: MeasureLabSketch.isOpen(), toast: document.getElementById('toast').textContent}), b2r);
    check(/Ещё раз/.test(b1.toast) && b2.r === true && b2.list, '«назад» ×2: тост «Ещё раз — к проектам», затем список проектов', {b1, b2});
    await wait(300); await shot('back-list');
    const row = await p.evaluate(() => [...document.querySelectorAll('#labPrj .lp-row .lp-t')].map(t => t.textContent.trim()));
    check(row.some(t => t.startsWith('Клиент') && t.includes('Проект')), 'в списке строка «Клиент · Проект»', row);
    // ════ 12. открыть проект (касание строки) → выгрузка «для Akrix»: ⋮ → ⇪ → «Объект»
    await p.evaluate(() => { const r = [...document.querySelectorAll('#labPrj .lp-row')].find(r => r.textContent.includes('Клиент')); r.scrollIntoView(); });
    { const r = await p.evaluate(() => { const e = [...document.querySelectorAll('#labPrj .lp-row')].find(r => r.textContent.includes('Клиент')).querySelector('.lp-t').getBoundingClientRect(); return [e.left + 20, e.top + e.height / 2]; }); await tap('touch', r); await wait(600); }
    await p.evaluate(() => { window.AkrixApp = Object.assign(window.AkrixApp || {}, {save: (fn, type, txt) => { window.__saved = {fn, txt}; }}); });
    await p.evaluate(() => mdGo('plan')); await wait(400);
    await tapSel('touch', '#bMore'); await tapSel('touch', '#bExp'); await tapSel('touch', '[data-zx="o"]');
    await p.waitForFunction(() => window.__saved, null, {timeout: 15000});
    const saved = await p.evaluate(() => window.__saved), ex = JSON.parse(saved.txt);
    const EXPORT = path.join(SHOT, 'export-akrix.json'); fs.writeFileSync(EXPORT, saved.txt);
    const r1 = v => Math.round(v * 10) / 10, els = []; for (const r of ex.rooms || []) for (const W of Object.values((r.ms || {}).wl || {})) for (const e of W.els || []) els.push({t: e.t, d: e.d, no: e.no, W: r1(e.x1 - e.x0), H: r1(e.y1 - e.y0)});
    const zns = (ex.rooms || []).flatMap(r => ((r.ms || {}).labRooms || []).map(q => ({zn: q.zn, name: q.name})));
    info.export = {fn: saved.fn, oid: ex.oid, els, zns, prd: ex.prd};
    check(ex.app === 'akrix-zamer' && ex.v === 3 && els.find(e => e.t === 'beam' && e.d > 0) && els.find(e => e.t === 'col' && e.d === 300) && els.every(e => Number.isInteger(e.no)) && zns.length === 1 && zns[0].zn === 1 && Array.isArray(ex.prd) && ex.prd.length === 1 && ex.prd[0].type === 'Кухня' && ex.prd[0].walls.length === 1 && Number.isInteger(ex.prd[0].no),
      'выгрузка для Akrix v3: els[].d (ригель, колонна 300), els[].no, labRooms[].zn, o.prd', info.export);
    await shot('export');
    check(errors.length === 0, 'нет ошибок страницы', errors);
    // ════ 13. импорт в конструктор v898 штатным путём (tests/akrix-imp-v898.cjs = AKX-2026-0013/scripts/imp.cjs)
    if (fs.existsSync(AKRIX)) {
      const out = path.join(SHOT, 'akrix'); fs.mkdirSync(out, {recursive: true});
      try { cp.execFileSync(process.execPath, [path.join(__dirname, 'akrix-imp-v898.cjs'), AKRIX, out, EXPORT], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000, env: process.env});
        const R = JSON.parse(fs.readFileSync(out + '/import-result.json', 'utf8'))[0];
        info.akrix = {toasts: R.toasts, build: R.buildToasts, walls: (R.walls || []).length, zw: R.zw && R.zw.walls && R.zw.walls.length, errors: R.errors};
        check(R.errors.length === 0 && (R.walls || []).length >= 1 && R.zw && R.zw.walls && R.zw.walls.length >= 1, 'конструктор v898: выгрузка открывается (⇧ → ✓ В стены, 🧩), ошибок нет', info.akrix);
      } catch (e) { check(false, 'конструктор v898: импорт', String(e.stderr || e).slice(0, 800)); }
    } else check(false, 'конструктор v898: нет страницы', AKRIX);
  } catch (e) {
    check(false, 'сценарий прерван', String(e && e.stack || e)); try { await shot('abort'); } catch (x) { }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  fs.writeFileSync(path.join(root, 'tests', `qa-v8218-e2e-${TAG}.json`), JSON.stringify({checks, errors, info}, null, 2));
  const bad = checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-e2e ${TAG}: ${checks.length - bad.length}/${checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
