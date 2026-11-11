// Measure 82.18 r3 (AKX-2026-0012, QA-3 М1–М3): холст реального проекта читаем — выгрузка QA «Сидоровы» (2 помещения, 6 + 4 стены, зоны,
// конструкции) + 3 фото и текст на подложке. После ✓, вкладки С№ при отдалённом холсте (М3), ↶ ↷, перезапуска, изменения высоты окна (клавиатура; приложение — только книжная, решение владельца),
// импорта «Обновить»: рамки и заголовки в экране, без наложений между собой и с фото, снимки в рамке, не устарели и без ручек, фото с пропорциями
// и того же размера в мм, масштаб областей один (k), снимки после изменения окна не мельче. Скриншоты — QA_SHOT.
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
  // ── снимок данных проекта (база после сброса): подложка, стены (не удалённые), помещения, конструкции, области холста

  const FIX = path.join(root, 'tests/fixtures/qa3-sidorovy-2rooms.json');
  const hookToast = () => p.evaluate(() => { if (window.__toastHook) return; window.__toastHook = 1; window.__toastLog = []; const t0 = toast; toast = function (t) { __toastLog.push(String(t)); return t0.apply(this, arguments); }; });
  // ── проверка читаемости: рамки/заголовки в экране, без пересечений (между собой и с фото), снимок в рамке и не устарел, без ручек, фото с пропорциями, масштаб областей один
  const geo = () => p.evaluate(() => { const K = MeasureLabSketch.state, R = MeasureLabSketch.region, d = devicePixelRatio, cr = cv.getBoundingClientRect(), fh = (typeof zFreeH === 'function' ? zFreeH() : cv.height) / d, act = MeasureLabSketch.active();
    const scr = r => { const a = MeasureLabSketch.map.toScrK(r.x, r.y), b = MeasureLabSketch.map.toScrK(r.x + r.w, r.y + r.h); return {x: a[0] / d, y: a[1] / d, w: (b[0] - a[0]) / d, h: (b[1] - a[1]) / d}; };
    const ov = (a, b) => a.x < b.x + b.w - .5 && a.x + a.w > b.x + .5 && a.y < b.y + b.h - .5 && a.y + a.h > b.y + .5;
    const B = K.items.map(it => { const r = scr(R(it)), t = scr(MeasureLabSketch.titleBox(it)); return {id: it.id, t: it.t, nm: it.name || it.t, box: {x: Math.min(r.x, t.x), y: t.y, w: Math.max(r.x + r.w, t.x + t.w) - Math.min(r.x, t.x), h: r.y + r.h - t.y}}; });
    const refs = ((act && act.t === 'board' ? S.refs : (K.boardRec || {}).refs) || []);
    const RB = refs.map(q => scr(MeasureLabSketch.refRegion(q.id))).concat((MeasureLabSketch.textBoxes ? MeasureLabSketch.textBoxes() : []).map(scr));   // фото и надписи подложки
    const out = [], hit = [], snap = [], handles = [];
    for (const b of B) { const q = b.box; if (q.x < -1 || q.x + q.w > cr.width + 1 || (q === B[0].box && q.y < -1)) out.push(b.nm);   // колонна: по ширине экрана, ниже — сдвиг
      RB.forEach((r, j) => { if (ov(q, r)) hit.push(b.nm + (j < refs.length ? '×фото' + (j + 1) : '×надпись')); }); for (const c of B) if (c.id > b.id && ov(q, c.box)) hit.push(b.nm + '×' + c.nm);
      const it = K.items.find(i => i.id === b.id); if (it === act || !(it.t === 'wall' || it.t === 'plan')) continue; const sn = K.snaps[b.id], rr = R(it);
      const inside = sn && sn.img && sn.x >= rr.x - rr.w * .02 && sn.y >= rr.y - rr.h * .02 && sn.x + sn.w <= rr.x + rr.w * 1.02 && sn.y + sn.h <= rr.y + rr.h * 1.02;
      if (!sn || !sn.img || MeasureLabSketch.snapStale(b.id) || !inside) { snap.push(b.nm + (!sn || !sn.img ? ' заглушка' : ' устарел/вне рамки')); continue; }
      try { const g = sn.img.getContext('2d').getImageData(0, 0, sn.img.width, sn.img.height).data; let n = 0; for (let i = 0; i < g.length; i += 4) if (g[i] > 225 && g[i + 1] > 115 && g[i + 1] < 160 && g[i + 2] < 40) n++; if (n > 40) handles.push(b.nm + ':' + n); } catch (e) { } }
    for (const q of (MeasureLabSketch.textBoxes ? MeasureLabSketch.textBoxes() : []).map(scr)) if (q.x < -1 || q.x + q.w > cr.width + 1 || q.y + q.h > fh + 1) out.push('надпись подложки');   // м1: текст целиком в экране
    const ar = refs.filter(q => q.iw && q.ih).map(q => { const r = MeasureLabSketch.refRegion(q.id); return Math.abs((r.w / r.h) / (q.iw / q.ih) - 1); }), photo = ar.every(x => x < .02);
    const ks = K.items.filter(i => i.t === 'wall' || i.t === 'plan').map(i => +i.k), scale = ks.length ? Math.max(...ks) / Math.min(...ks) : 1;
    // колонна: элементы (области и фото) друг под другом; связанное фото — над своей стеной, шириной стены
    const E = B.map(b => ({k: 'a', id: b.id, nm: b.nm, y: b.box.y, x: b.box.x, w: b.box.w})).concat(refs.map((q, j) => ({k: 'p', id: q.id, nm: 'фото' + (j + 1), lw: q.labWall, y: RB[j].y, x: RB[j].x, w: RB[j].w, mm: q.w}))).sort((a, b) => a.y - b.y);
    const col = [], cw = Math.max(...E.map(e => e.x + e.w)) - Math.min(...E.map(e => e.x));
    E.forEach((e, i) => { if (e.k !== 'p' || !e.lw) return; const it = K.items.find(t => t.t === 'wall' && (t.wid === e.lw || t.sid === e.lw)); const nx = E[i + 1];
      if (!it || !nx || nx.id !== it.id) col.push(e.nm + ' не над своей стеной'); else if (Math.abs(e.mm - (+it.L) * it.k) > 1) col.push(e.nm + ' ширина ' + Math.round(e.mm) + ' ≠ ' + Math.round((+it.L) * it.k)); });
    { const nums = E.filter(e => e.k === 'a' && /С\d+$/.test(e.nm)).map(e => +/С(\d+)$/.exec(e.nm)[1]); if (nums.some((v, i) => i && v < nums[i - 1])) col.push('стены не по порядку С№: ' + nums.join(',')); if (E[0] && E[0].nm !== 'plan' && K.items.some(i => i.t === 'plan')) col.push('план не первым: ' + E[0].nm); }
    if (cw > cr.width * 1.02 || cw < cr.width * .6) col.push('ширина колонны ' + Math.round(cw) + ' при экране ' + Math.round(cr.width));
    return {out, hit, snap, handles, col, photo, scale: Math.round(scale * 100) / 100, n: B.length, refsW: refs.map(q => Math.round(q.w))}; });
  const readable = async (name, fit = true) => { if (fit) { await tapSel('touch', '#bDone'); await wait(1500); } await p.evaluate(() => document.getElementById('toast').classList.remove('on')); const g = await geo(); await shot(name);
    check(!g.out.length && !g.hit.length && !g.snap.length && !g.handles.length && !g.col.length && g.photo && g.scale <= 1.01, 'М1: ' + name + ' — читаемо (колонна по ширине экрана: фото над своей стеной шириной стены; без наложений, снимки без ручек, фото с пропорциями, масштаб один)', g); return g; };
  const restore = async how => { await p.evaluate(() => MeasureLabProjects.show()); await wait(400); await tapSel('touch', '#labPrj [data-lp="menu"]'); await wait(300);
    const fc = p.waitForEvent('filechooser', {timeout: 8000});
    const c = await p.evaluate(() => { const e = [...document.querySelectorAll('#labPrj button,#labPrj [role=button],#labPrj .lp-it')].find(e => e.getClientRects().length && e.textContent.includes('Восстановить из копии')); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await tap('touch', c); await (await fc).setFiles(FIX); await wait(900);
    if (how) { const nb = await p.evaluate(h => { const e = [...document.querySelectorAll('#labPrj .lp-dg.on button')].find(e => e.textContent.includes(h)); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, how); if (nb) await tap('pen', nb); }
    await p.waitForFunction(() => MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 20000}); await wait(1500); };
  try {
    await p.goto(url); await p.waitForSelector('#labPrj.on', {timeout: 20000}); await wait(400);
    // реальный проект: выгрузка QA «Сидоровы» — 2 помещения (6 + 4 стены, зоны, конструкции)
    await p.evaluate(() => MeasureLabProjects.hide()); await restore(null); await hookToast();
    const st0 = await p.evaluate(async () => { const K = MeasureLabSketch.state, rooms = (await dbAll('sess')).filter(o => o.kind === 'room' && !o.del && o.oid === K.pid); return {items: K.items.map(i => i.t), rooms: rooms.length, segs: rooms.reduce((n, r) => n + r.ms.pts.length - (r.ms.closed ? 0 : 1), 0), title: document.getElementById('labPrjT').textContent}; });
    check(st0.items.filter(t => t === 'wall').length >= 3 && st0.items.includes('plan') && st0.segs >= 10, 'подготовка: импорт — 2 помещения (10 стен плана), области С1–С3 и план', st0);
    // 3 фото на подложке и текст рядом
    await p.evaluate(() => MeasureLabSketch.activate('board')); await wait(400);
    { const fc = p.waitForEvent('filechooser', {timeout: 8000}); await caseTool('[data-lab-tb="gal"]'); await (await fc).setFiles([SAMPLE, SAMPLE, SAMPLE]); }
    await p.waitForFunction(() => S.refs && S.refs.length === 3, null, {timeout: 15000}); await wait(600);
    await p.evaluate(() => { MeasureLabSketch.fitAll(); pickTool('txt'); draw(); });
    const id2 = await p.evaluate(() => S.refs[1].id);
    await tap('touch', await refAt(id2, 1.15, .1)); await wait(200);
    await p.evaluate(() => { const i = document.getElementById('pp').querySelector('[data-zt]'); if (i) { i.value = 'Холодильник справа'; i.dispatchEvent(new Event('input', {bubbles: true})); i.dispatchEvent(new Event('change', {bubbles: true})); i.blur(); } pickTool('sel'); });
    // фото 1 → С1, фото 2 → С2 (связь фото → стена, как после «▣ Стена»), фото 3 — без стены
    await p.evaluate(() => { const K = MeasureLabSketch.state, w = n => K.items.find(i => i.t === 'wall' && new RegExp('С' + n + '$').test(i.name)); S.refs[0].labWall = w(1).wid || w(1).sid; S.refs[1].labWall = w(2).wid || w(2).sid; saveSess(); });
    // последний шаг перед ✓ — на плане (сдвиг точки Прихожей)
    await p.evaluate(async () => { await MeasureLabSketch.goPlan(); const r = (await dbAll('sess')).find(o => o.kind === 'room' && !o.del && o.oid === MeasureLabSketch.state.pid && o.name === 'Прихожая'); await openRoom(r.id, null, true); plSnap(); S.room.ms.pts[0] = [S.room.ms.pts[0][0] - 50, S.room.ms.pts[0][1]]; saveRoom(); draw(); }); await wait(500);
    await readable('01-импорт, 3 фото, шаг плана, ✓');
    // снимок экрана всей колонны (вид временно уменьшен, затем возвращён)
    await p.evaluate(() => { const K = MeasureLabSketch.state; window.__v = {...K.view}; MeasureLabSketch.fitAll0 ? 0 : 0; const B = K.items.map(MeasureLabSketch.region).concat(S.refs.map(r => MeasureLabSketch.refRegion(r.id))); const y0 = Math.min(...B.map(b => b.y)) - 200, y1 = Math.max(...B.map(b => b.y + b.h)), fh = (typeof zFreeH === 'function' ? zFreeH() : cv.height) / devicePixelRatio; const s = Math.min(K.view.s, (fh - 20) / (y1 - y0)); K.view = {s, ox: K.view.ox + 0, oy: 10 - y0 * s}; K.view.ox = (cv.getBoundingClientRect().width - (K.view.s * (Math.max(...B.map(b => b.x + b.w)) - Math.min(...B.map(b => b.x))))) / 2 - Math.min(...B.map(b => b.x)) * s; MeasureLabSketch.map.syncToS(MeasureLabSketch.active()); draw(); });
    await wait(300); await shot('01a-колонна целиком');
    await p.evaluate(() => { MeasureLabSketch.state.view = window.__v; MeasureLabSketch.map.syncToS(MeasureLabSketch.active()); draw(); });
    const refsW0 = await p.evaluate(() => S.refs.map(r => Math.round(r.w)));
    // ↶ после ✓ — переход на область вписывает её
    { let a = null; for (let i = 0; i < 8; i++) { await p.evaluate(() => zUndo()); await wait(600); a = await p.evaluate(() => { const x = MeasureLabSketch.active(); return x && x.t; }); if (a === 'plan' || a === 'wall') break; }
      const u = await p.evaluate(() => { const a = MeasureLabSketch.active(), r = MeasureLabSketch.region(a), d = devicePixelRatio, A = MeasureLabSketch.map.toScrK(r.x, r.y), Bq = MeasureLabSketch.map.toScrK(r.x + r.w, r.y + r.h), cr = cv.getBoundingClientRect();
        return {t: a.t, w: Math.round((Bq[0] - A[0]) / d), h: Math.round((Bq[1] - A[1]) / d), x: Math.round(A[0] / d), cw: Math.round(cr.width)}; });
      await shot('01b-↶ после ✓');
      check((u.t === 'plan' || u.t === 'wall') && u.w >= u.cw * .6 && u.x >= -2 && u.x + u.w <= u.cw + 2, '↶ после ✓ — активированная область вписана в экран', u);
      for (let i = 0; i < 8; i++) { await p.evaluate(() => zRedo()); await wait(400); } }
    // «Стены в плоскости» с плана: выбрана Прихожая, отрезок С1 — открывается её стена, вписана
    { await p.evaluate(async () => { await MeasureLabSketch.goPlan(); const r = (await dbAll('sess')).find(o => o.kind === 'room' && !o.del && o.oid === MeasureLabSketch.state.pid && o.name === 'Прихожая'); await openRoom(r.id, null, true); S.psel = {t: 's', i: 1}; draw(); }); await wait(600);
      await tapSel('touch', '#mdT [data-md="wall"]'); await wait(1800);
      const m4 = await p.evaluate(() => { const a = MeasureLabSketch.active(), r = a && a.t === 'wall' && MeasureLabSketch.region(a), d = devicePixelRatio, cr = cv.getBoundingClientRect(); if (!r) return {t: a && a.t};
        const A = MeasureLabSketch.map.toScrK(r.x, r.y), Bq = MeasureLabSketch.map.toScrK(r.x + r.w, r.y + r.h); return {t: a.t, name: a.name, room: S.room0 && S.room0.name, x0: Math.round(A[0] / d), x1: Math.round(Bq[0] / d), w: Math.round((Bq[0] - A[0]) / d), cw: Math.round(cr.width)}; });
      await shot('01c-стены в плоскости');
      check(m4.t === 'wall' && m4.room === 'Прихожая' && m4.x0 >= -2 && m4.x1 <= m4.cw + 2 && m4.w >= m4.cw * .6, 'М4: «Стены в плоскости» с плана — стена выбранного помещения, вписана в экран', m4); }
    // М3: холст отдалён (после ✓) → стена вкладкой С№ — холст приближается к ней
    await p.evaluate(async () => { const it = MeasureLabSketch.state.items.find(i => i.t === 'wall' && /С1$/.test(i.name)); await MeasureLabSketch.activate(it); }); await wait(600);
    await p.evaluate(() => wGo(1)); await wait(1800);
    const m3 = await p.evaluate(() => { const a = MeasureLabSketch.active(), r = MeasureLabSketch.region(a), d = devicePixelRatio, A = MeasureLabSketch.map.toScrK(r.x, r.y), Bq = MeasureLabSketch.map.toScrK(r.x + r.w, r.y + r.h), cw = cv.getBoundingClientRect().width;
      return {t: a && a.t, name: a && a.name, w: Math.round((Bq[0] - A[0]) / d), h: Math.round((Bq[1] - A[1]) / d), cw: Math.round(cw)}; });
    await shot('02-вкладка С2');
    check(m3.t === 'wall' && (m3.w >= m3.cw * .6 || m3.h >= 300), 'М3: стена, открытая вкладкой при отдалённом холсте, вписана в экран', m3);
    // ↶ ×3 / ↷ ×3 → ✓
    for (let i = 0; i < 3; i++) { await p.evaluate(() => zUndo()); await wait(400); } for (let i = 0; i < 3; i++) { await p.evaluate(() => zRedo()); await wait(400); }
    await readable('03-↶ ↷, ✓');
    // перезапуск → ✓
    await p.evaluate(async () => { try { await flushAll(); } catch (e) { } try { await MeasureLabSketch.saveNow(); } catch (e) { } });
    await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && MeasureLabSketch.isOpen(), null, {timeout: 20000}); await wait(3500); await hookToast();
    await readable('04-перезапуск, ✓');
    // окно меняет высоту (клавиатура, разделённый экран; приложение — только книжная): снимки не пересоздаются в промежуточном виде, после ✓ — читаемо
    const q0 = await p.evaluate(() => Object.fromEntries(MeasureLabSketch.state.items.map(i => [i.id, MeasureLabSketch.state.snaps[i.id] && MeasureLabSketch.state.snaps[i.id].img ? MeasureLabSketch.state.snaps[i.id].img.width / MeasureLabSketch.state.snaps[i.id].w : 0])));
    const v0 = await p.evaluate(() => ({...MeasureLabSketch.state.view}));
    await p.setViewportSize({width: VW, height: Math.round(VH * .55)}); await wait(1200);
    const vk = await p.evaluate(() => ({...MeasureLabSketch.state.view}));
    check(Math.abs(vk.s - v0.s) < 1e-9, 'окно ниже (клавиатура) — холст не перевписывается', {v0, vk});
    await p.setViewportSize({width: VW, height: VH}); await wait(2600); await readable('05-высота окна туда-обратно, ✓');
    const q1 = await p.evaluate(() => Object.fromEntries(MeasureLabSketch.state.items.map(i => [i.id, MeasureLabSketch.state.snaps[i.id] && MeasureLabSketch.state.snaps[i.id].img ? MeasureLabSketch.state.snaps[i.id].img.width / MeasureLabSketch.state.snaps[i.id].w : 0])));
    const worse = Object.keys(q0).filter(k => q0[k] > 0 && q1[k] > 0 && q1[k] < q0[k] * .7);
    check(!worse.length, 'изменение высоты окна — снимки не перестроены в мелком масштабе', {worse, q0, q1});
    // импорт той же выгрузки → «Обновить» → ✓
    await restore('Обновить');
    const g9 = await readable('07-импорт «Обновить», ✓');
    check(JSON.stringify(g9.refsW) === JSON.stringify(refsW0), 'М1: после «Обновить» фото того же размера (мм, по раскладке)', {before: refsW0, after: g9.refsW});
    check(errors.length === 0, 'нет ошибок страницы', errors);
  } catch (e) {
    check(false, 'сценарий прерван', String(e && e.stack || e)); try { await shot('abort'); } catch (x) { }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  fs.writeFileSync(path.join(root, 'tests', `qa-v8218-real-${TAG}.json`), JSON.stringify({checks, errors, info}, null, 2));
  const bad = checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-real ${TAG}: ${checks.length - bad.length}/${checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
