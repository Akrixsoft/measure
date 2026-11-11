// Measure 82.18 (AKX-2026-0012, QA Д1): длинная цепочка ↶ / ↷ через все поверхности проекта, в т.ч. с перезапуском посередине.
// Сценарий (касания пером/пальцем через CDP, телефонный режим): новый проект → фото на подложке → размер на фото + ввод → стрелка на подложке →
// ⌗ 4 угла → ▣ стена над фото → ригель, колонна (Z) на стене → план: длина стены → зона → конструкция.
// После каждого шага — снимок данных проекта из базы (подложка, стены, помещение, области холста). Затем стоя на плане ↶ до «Отменять нечего»:
// пройдены все снимки в обратном порядке, итог = пустой проект; перезапуск посередине не теряет шаги. Затем ↷ до конца (перезапуск посередине):
// итог = конечный снимок, областей-дублей нет.
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 node tests/qa-v8218-undochain.cjs
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const VW = +(process.env.QA_VW || 412), VH = +(process.env.QA_VH || 797), DPR = +(process.env.QA_DPR || 3), TAG = `${VW}x${VH}x${DPR}`;
const SHOT = process.env.QA_SHOT || path.join('/tmp/qa8218-undochain', TAG);
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
  // ── снимок данных проекта (база после сброса): подложка, стены (не удалённые), помещения, конструкции, области холста
  const digest = () => p.evaluate(async () => {
    try { await flushAll(); } catch (e) { } try { await MeasureLabSketch.saveNow(); } catch (e) { }
    const K = MeasureLabSketch.state, all = await dbAll('sess'), rooms = all.filter(o => o.kind === 'room' && !o.del && o.oid === K.pid), rid = new Set(rooms.map(r => r.id));
    const n = v => typeof v === 'number' ? Math.round(v) : v, R = o => JSON.parse(JSON.stringify(o == null ? null : o, (k, v) => typeof v === 'number' ? Math.round(v) : v));
    const b = all.find(o => o.id === K.board) || {};
    const surf = o => ({els: (o.els || []).map(e => [e.k, n(+e.W), n(+e.H), n(+e.D || 0), n(+e.x || 0), n(+e.y || 0)]), dms: (o.dms || []).map(d => [d.id, n(+d.vm || 0)]), drw: (o.drw || []).length, notes: (o.notes || []).map(q => q.t || q.txt || ''), txt: (o.txt || []).length});
    const out = {board: {refs: (b.refs || []).map(r => [r.id, !!r.q, !!r.labWall]), ...surf(b)},
      walls: all.filter(o => o.room && rid.has(o.room) && !o.del && o.kind !== 'room').map(o => ({name: o.name, ...surf(o)})).sort((a, c) => a.name < c.name ? -1 : 1),
      rooms: rooms.map(r => ({name: r.name, pts: R(r.ms && r.ms.pts), dims: ((r.ms && r.ms.dims) || []).map(d => n(d.v)), segs: Object.keys(r.segs || {}).length, zones: ((r.ms && r.ms.labRooms) || []).map(z => z.name), prd: (r.prd || []).map(q => q.type + ':' + (q.walls || q.w || []).length)})),
      items: K.items.map(i => i.t + ':' + (i.t === 'wall' ? i.sid : '')).sort()};
    return JSON.stringify(out);
  });
  const CP = [];   // контрольные снимки после шагов
  const cp = async name => { const d = await digest(); CP.push({name, d}); console.log('CP', CP.length - 1, name); return d; };
  const lastToast = () => p.evaluate(() => window.__toastLog ? window.__toastLog.slice(-1)[0] : '');
  const hookToast = () => p.evaluate(() => { if (window.__toastHook) return; window.__toastHook = 1; window.__toastLog = []; const t0 = toast; toast = function (t) { __toastLog.push(String(t)); return t0.apply(this, arguments); }; });
  const PRJ = 'Цепочка · Кухня';
  async function reopen() {
    await p.evaluate(async () => { try { await flushAll(); } catch (e) { } try { await MeasureLabSketch.saveNow(); } catch (e) { } try { MeasureLabHistory.flush(); } catch (e) { } dispatchEvent(new Event('pagehide')); });
    await wait(300); await p.reload();
    await p.waitForFunction(() => window.MeasureLabSketch && MeasureLabSketch.isOpen() && !(window.MeasureLabProjects && MeasureLabProjects.isOpen()), null, {timeout: 20000}); await wait(1200);
    await hookToast();
  }
  let refId;
  try {
    await p.goto(url); await p.waitForSelector('#labPrj.on', {timeout: 20000}); await wait(400);
    await tapSel('touch', '#labPrj .lp-fab'); await p.waitForSelector('#labPrj .lp-dg.on');
    await tapSel('touch', '#labPrj [data-c]'); await p.keyboard.type('Цепочка');
    await tapSel('touch', '#labPrj [data-n]'); await p.keyboard.type('Кухня');
    await tapSel('pen', '#labPrj .lp-bt .lp-pr');
    await p.waitForFunction(() => window.MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 10000}); await wait(500);
    await hookToast();
    await cp('пустой проект');
    // 1. фото на подложке
    { const fc = p.waitForEvent('filechooser', {timeout: 8000}); await caseTool('[data-lab-tb="gal"]'); await (await fc).setFiles(SAMPLE); }
    await p.waitForFunction(() => S.refs && S.refs.length === 1, null, {timeout: 10000}); await wait(500);
    refId = await p.evaluate(() => S.refs[0].id);
    await p.evaluate(() => { MeasureLabSketch.fitAll(); draw(); }); await wait(200);
    await cp('фото');
    // 2. размер на фото + значение
    await caseTool('.tl[data-k="dim"]');
    await p.evaluate(() => { zo('dim').sn = 0; zo('dim').L = 0; zo('dim').P = 0; });
    await drag('pen', await refAt(refId, .2, .5), await refAt(refId, .8, .5));
    await cp('размер на фото');
    const dmId = await p.evaluate(() => S.dms[0] && S.dms[0].id);
    const lab = await p.evaluate(id => { draw(); const a = MeasureLabGeometry.dimensionLabels.get(id), r = cv.getBoundingClientRect(); return a ? [a[4] / devicePixelRatio + r.left, a[5] / devicePixelRatio + r.top] : null; }, dmId);
    if (lab) { await tap('pen', lab); await typeIn(1250); }
    check(await p.evaluate(() => S.dms[0] && S.dms[0].vm === 1250), 'подготовка: размер на фото 1250');
    await cp('значение размера');
    // 2б. стрелка на подложке (рисунок)
    await caseTool('.tl[data-k="arr"]');
    await drag('pen', await refAt(refId, .3, .75), await refAt(refId, .7, .65));
    check(await p.evaluate(() => S.drw.some(d => d.k === 'arr')), 'подготовка: стрелка на подложке');
    await cp('стрелка');
    // 3. ⌗ 4 угла
    await caseTool('.tl[data-k="sel"]').catch(async () => { await p.evaluate(() => { document.getElementById('tb').classList.remove('on'); pickTool('sel'); }); });
    await tap('touch', await refAt(refId, .5, .25)); await wait(200);
    await tapSel('touch', '#labSkPh [data-skp="cor"]');
    for (const [u, v] of [[.06, .11], [.97, .1], [.97, .89], [.08, .9]]) await tap('pen', await refAt(refId, u, v));
    await cp('4 угла');
    // 4. ▣ стена над фото
    await tapSel('touch', '#labSkPh [data-skp="wall"]'); await wait(300);
    await p.selectOption('#labSketch [data-sk-room]', '');
    await tapSel('touch', '#labSketch [data-sk-name]'); await p.keyboard.press('Control+A'); await p.keyboard.type('Кухня');
    for (const [s, v] of [['[data-sk-l]', 2364], ['[data-sk-h]', 2700]]) { await tapSel('touch', '#labSketch .sk-dlg ' + s); await p.keyboard.press('Control+A'); await p.keyboard.type(String(v)); }
    await tapSel('pen', '#labSketch .sk-dlg .bt .pr');
    await p.waitForFunction(() => { const a = MeasureLabSketch.active(); return a && a.t === 'wall' && S.mosaic && S.q4 && S.q4.ok; }, null, {timeout: 15000}); await wait(600);
    await cp('стена по фото');
    // 5. ригель у потолка
    await caseTool('.tl[data-k="rig"]');
    await drag('pen', await wallPt([4, 2319]), await wallPt([2362, 2699]));
    check(await p.evaluate(() => S.els.some(e => e.k === 'rig')), 'подготовка: ригель');
    await cp('ригель');
    // 6. колонна + Z 300
    await caseTool('.tl[data-k="kol"]');
    await drag('pen', await wallPt([1000, 20]), await wallPt([1400, 2300]));
    const col = await p.evaluate(() => S.els.find(e => e.k === 'kol') && S.els.find(e => e.k === 'kol').id);
    await cp('колонна');
    await p.evaluate(id => { S.sel = id; mkPanel(); draw(); }, col);
    const zb = await box('#pp [data-lab-z]'); if (zb) { await tap('pen', zb); await typeIn(300); }
    check(await p.evaluate(id => +(S.els.find(x => x.id === id) || {}).D === 300, col), 'подготовка: колонна Z 300');
    await cp('Z колонны');
    // 7. план: длина стены
    await p.evaluate(() => { S.sel = null; mdGo('plan'); }); await wait(600);
    const fld = await p.evaluate(() => { S.psel = {t: 's', i: 0}; PL.tool = 'sel'; mkPanel(); draw(); const f = S.plFld, d = devicePixelRatio, r = cv.getBoundingClientRect(); return f ? [f.c[0] / d + r.left, f.c[1] / d + r.top] : null; });
    if (fld) { await tap('pen', fld); await typeIn(2400); }
    check(await p.evaluate(() => (plDim(S.room.ms, 0) || {}).v === 2400), 'подготовка: длина стены плана 2400');
    await cp('длина на плане');
    // 8. зона
    await p.evaluate(() => { S.psel = null; draw(); });
    await caseTool('[data-lab-tb="zone"]');
    await tapSel('touch', '[data-lab12="manual"]');
    const seg = await p.evaluate(() => plSeg(S.room.ms, 0)), ax = seg[0], bx = seg[1], nx = [-(bx[1] - ax[1]), bx[0] - ax[0]], ln = Math.hypot(...nx) || 1, nn = [nx[0] / ln, nx[1] / ln];
    const magOn = await p.evaluate(() => WS.mag !== 0); if (magOn) await tapSel('touch', '[data-pm="m"]');
    for (const sg of [1, -1]) {
      const zp = [[0.15, 250], [0.85, 250], [0.85, 650], [0.15, 650]].map(([u, o]) => [ax[0] + (bx[0] - ax[0]) * u + nn[0] * o * sg, ax[1] + (bx[1] - ax[1]) * u + nn[1] * o * sg]);
      for (const q of zp) await tap('pen', await plPt(q));
      if (await box('[data-lab12="commit"]')) await tapSel('touch', '[data-lab12="commit"]');
      if (await p.evaluate(() => MeasureLab012.regions().length)) break;
      const c = await box('[data-lab12="cancel"]'); if (c) await tap('touch', c); await tapSel('touch', '[data-lab12="manual"]');
    }
    if (magOn) await tapSel('touch', '[data-pm="m"]').catch(() => {});
    check(await p.evaluate(() => MeasureLab012.regions().length === 1), 'подготовка: зона');
    await tapSel('touch', '[data-lab12="toggle"]').catch(() => p.evaluate(() => MeasureLab012.close()));
    await cp('зона');
    // 9. конструкция
    await caseTool('[data-lab-tb="prd"]');
    await tapSel('touch', '#labprd-plan [data-labprd="add"]'); await tapSel('touch', '#labprd-plan [data-labprd="type"][data-type="Кухня"]');
    await tap('pen', await plPt([(ax[0] + bx[0]) / 2, (ax[1] + bx[1]) / 2]));
    check(await p.evaluate(() => MeasureLabPrd.list().length === 1), 'подготовка: конструкция');
    await tapSel('touch', '#labprd-plan [data-labprd="close"]').catch(() => p.evaluate(() => MeasureLabPrd.close()));
    await cp('конструкция');
    await shot('end');
    // QA Д15 (телефонный режим): касание пальцем подписи поля неактивной стены — только активация, без поля и клавиатуры
    { await p.evaluate(() => MeasureLabSketch.activate(MeasureLabSketch.state.items.find(i => i.t === 'wall'))); await wait(400);
      const lp = await p.evaluate(() => { MeasureLabSketch.fitAll(); pickTool('sel'); draw(); const d = devicePixelRatio, r = cv.getBoundingClientRect(), css = l => [l.c[0] / d + r.left, l.c[1] / d + r.top]; const l = S.w3L.find(x => { try { const c = css(x); return !!w3FKind(x) && c[0] > 20 && c[0] < innerWidth - 20 && c[1] > 90 && c[1] < innerHeight - 220; } catch (e) { return false; } }); return l ? {c: css(l), t: l.t} : null; });
      await p.evaluate(() => MeasureLabSketch.activate('board')); await wait(400);
      if (lp) await tap('touch', lp.c); await wait(500);
      const a15 = await p.evaluate(() => { const f = document.getElementById('w3f'); return {act: MeasureLabSketch.active().t, w3f: !!(f && f.classList.contains('on')), focus: document.activeElement && document.activeElement.tagName}; });
      check(!!lp && a15.act === 'wall' && !(await kbOn()) && !a15.w3f && a15.focus !== 'INPUT', 'Д15: первое касание подписи поля неактивной стены — только активация, без клавиатуры', {lp, ...a15});
      await p.evaluate(() => { try { KB && KB.el && KB.el.blur(); } catch (e) { } document.activeElement && document.activeElement.blur && document.activeElement.blur(); mdGo('plan'); }); await wait(500);
      const dd = await digest(); check(dd === CP[CP.length - 1].d, 'после Д15: данные не изменились', null); }
    info.cp = CP.map(c => c.name);
    const D = CP.map(c => c.d), END = D[D.length - 1];
    // ── ↶ до начала (стоя на плане), перезапуск посередине
    const press = async dir => { await p.evaluate(dir => { window.__toastLog.length = 0; return dir < 0 ? zUndo() : zRedo(); }, dir); await wait(350); if (process.env.QA_DEBUG) console.log('DBG', dir, JSON.stringify(await p.evaluate(() => { const E = MeasureLabHistory.entries(), a = MeasureLabSketch.active(); return {act: a && a.t, mode: S.mode, sid: S.sess && S.sess.id, und: (S.und || []).map(t => String(t).startsWith('ZA:') ? t : 'S'), pund: (S.pund || []).map(t => String(t).slice(0, 3)), j: E.j.map(e => e.t + (e.n || '') + (e.op || '') + ':' + (e.sid || e.rid || '').slice(-4)), r: E.r.map(e => e.t + (e.n || '') + (e.op || ''))}; }))); return {d: await digest(), t: await lastToast()}; };
    const walk = async (dir, reloadAt) => {
      const seen = [], log = []; let prev = await digest(), same = 0;
      for (let i = 0; i < 90; i++) {
        if (i === reloadAt) { await reopen(); log.push('↻'); }
        const r = await press(dir); log.push(r.t);
        if (r.d !== prev) { seen.push(r.d); same = 0; } else if (++same >= 3 || /нечего/.test(r.t)) break;
        prev = r.d;
      }
      const items = JSON.parse(prev).items, dup = items.length !== new Set(items).size;
      return {seen, log, last: prev, dup};
    };
    const subseq = (seq, want) => { let k = 0; const miss = []; for (const w of want) { const j = seq.indexOf(w.d, k); if (j < 0) miss.push(w.name); else k = j + 1; } return miss; };
    const u = await walk(-1, +(process.env.QA_RELOAD_U || 6));
    info.undoLog = u.log;
    const missU = subseq(u.seen, CP.slice(0, -1).reverse());
    check(u.last === D[0], '↶ до начала (с перезапуском посередине): данные = пустой проект', {last: JSON.parse(u.last), want: JSON.parse(D[0]), steps: u.log.length});
    check(missU.length === 0, '↶: пройдены все шаги всех поверхностей в обратном порядке', {missing: missU});
    check(!u.dup, '↶: без дублей областей');
    await shot('undone');
    const r = await walk(1, +(process.env.QA_RELOAD_R || 7));
    info.redoLog = r.log;
    const missR = subseq(r.seen, CP.slice(1));
    check(r.last === END, '↷ до конца (с перезапуском посередине): данные = конечные', {last: JSON.parse(r.last), want: JSON.parse(END)});
    check(missR.length === 0, '↷: пройдены все шаги в прямом порядке', {missing: missR});
    check(!r.dup, '↷: без дублей областей (одна область С1)', JSON.parse(r.last).items);
    await shot('redone');
    await reopen();
    const after = await digest();
    check(after === END && !(JSON.parse(after).items.length !== new Set(JSON.parse(after).items).size), 'после перезапуска: данные = конечные, без дублей');
    check(errors.length === 0, 'нет ошибок страницы', errors);
  } catch (e) {
    check(false, 'сценарий прерван', String(e && e.stack || e)); try { await shot('abort'); } catch (x) { }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  fs.writeFileSync(path.join(root, 'tests', `qa-v8218-undochain-${TAG}.json`), JSON.stringify({checks, errors, info, cp: CP.map(c => ({name: c.name, d: JSON.parse(c.d)}))}, null, 2));
  const bad = checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-undochain ${TAG}: ${checks.length - bad.length}/${checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
