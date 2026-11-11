// Measure 82.18 — исправления по независимой QA (AKX-2026-0012, measure-engineer-g3): Д2, Д8, Д9, Д10, Д16, Д18.
// Телефонный режим (без body.tz), касания пером/пальцем через CDP. Каждый дефект — отдельный блок проверок.
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 node tests/qa-v8218-g3.cjs
//   QA_ONLY=d2,d9 — только выбранные блоки; QA_SHOT=<папка> — скриншоты; QA_AKRIX=<akrix-furniture.html> — конструктор v898.
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const VW = +(process.env.QA_VW || 412), VH = +(process.env.QA_VH || 797), DPR = +(process.env.QA_DPR || 3), TAG = `${VW}x${VH}x${DPR}`;
const SHOT = process.env.QA_SHOT || path.join('/tmp/qa8218-g3', TAG);
const AKRIX = process.env.QA_AKRIX || '/home/claude/akrix-soft/Akrix/akrix-furniture.html';
const SAMPLE = path.join(root, 'prototypes/sketch/sample.jpg');
const ONLY = (process.env.QA_ONLY || '').split(',').filter(Boolean);
const OLD = process.env.QA_OLD || '51923bf';   // 82.17 для миграции (Д8)
fs.mkdirSync(SHOT, {recursive: true});

(async () => {
  const old = new Map();
  const server = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]).slice(1);
    const ct = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.json') ? 'application/json' : 'text/html';
    try { r.setHeader('Content-Type', ct);
      if (f.startsWith('old/')) { f = f.slice(4); if (!old.has(f)) old.set(f, cp.execFileSync('git', ['show', OLD + ':' + f], {cwd: root, maxBuffer: 3e7, stdio: ['ignore', 'pipe', 'ignore']})); r.end(old.get(f)); }
      else r.end(fs.readFileSync(path.join(root, f))); } catch { r.writeHead(404).end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`, url = base + '/web/experimental.html';
  const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox']});
  const checks = [], info = {}; let errors = [];
  const check = (ok, name, detail) => { checks.push({ok: !!ok, name, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(detail ?? '').slice(0, 600)); };
  let ctx, p, cdp, shotN = 0;
  async function fresh() {   // чистый профиль
    if (ctx) await ctx.close();
    ctx = await browser.newContext({viewport: {width: VW, height: VH}, deviceScaleFactor: DPR, isMobile: true, hasTouch: true});
    await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', {get: () => false}));
    p = await ctx.newPage(); cdp = await ctx.newCDPSession(p); p.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 800)));
  }
  const shot = n => p.screenshot({path: path.join(SHOT, String(++shotN).padStart(2, '0') + '-' + n + '.png')});
  const wait = ms => p.waitForTimeout(ms);
  async function down(t, a) { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: a[0], y: a[1], id: 5}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: a[0], y: a[1], pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, force: .6}); }
  async function up(t, b) { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: b[0], y: b[1], pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1}); await wait(80); }
  async function move(t, a, b) { for (let i = 1; i <= 12; i++) { const x = a[0] + (b[0] - a[0]) * i / 12, y = a[1] + (b[1] - a[1]) * i / 12; if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y, id: 5}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, pointerType: 'pen', button: 'left', buttons: 1, force: .6}); } }
  const wallPt = w => p.evaluate(w => { const s = PM.toScr(...fromW(w, wf())), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const tap = async (t, a) => { await down(t, a); await up(t, a); await wait(150); };
  const box = sel => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const tapSel = async (t, sel) => { const c = await box(sel); if (!c) throw new Error('нет на экране: ' + sel); await tap(t, c); };
  const tapText = async (t, txt, scope = 'body') => { const c = await p.evaluate(([txt, scope]) => { const e = [...document.querySelectorAll(scope + ' button,' + scope + ' [role=button],' + scope + ' .lp-it')].find(e => e.getClientRects().length && e.textContent.trim().includes(txt)); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, [txt, scope]); if (!c) throw new Error('нет текста: ' + txt); await tap(t, c); };
  const plPt = w => p.evaluate(w => { const s = PM.toScr(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const cssK = w => p.evaluate(w => { const s = MeasureLabSketch.map.toScrK(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  async function caseTool(sel) { const f = (await box('#zpF')) || (await box('#labPlF')); if (!f) throw new Error('футляр не виден'); await tap('touch', f); await wait(250); await tapSel('touch', '#tb.on ' + sel); await wait(250); }
  const run = k => !ONLY.length || ONLY.includes(k);
  const toastT = () => p.evaluate(() => [document.getElementById('toast').textContent, (document.querySelector('#labPrj .lp-to.on span') || {}).textContent || '']);

  /* ── фикстура: проект «Сидоровы · Кухня-гостиная» через список (＋), фото → ⌗ → ▣ стена «Кухня» 2364 × 2700, план 4 стены,
        две зоны, три конструкции (как у QA: общая стена в нескольких конструкциях) ── */
  async function project(client = 'Сидоровы', name = 'Кухня-гостиная') {
    await p.goto(url); await p.waitForSelector('#labPrj.on', {timeout: 20000}); await wait(400);
    await tapSel('touch', '#labPrj .lp-fab'); await p.waitForSelector('#labPrj .lp-dg.on');
    await tapSel('touch', '#labPrj [data-c]'); await p.keyboard.type(client);
    await tapSel('touch', '#labPrj [data-n]'); await p.keyboard.type(name);
    await tapSel('pen', '#labPrj .lp-bt .lp-pr');
    await p.waitForFunction(() => window.MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 10000}); await wait(500);
    { const fc = p.waitForEvent('filechooser', {timeout: 8000}); await caseTool('[data-lab-tb="gal"]'); await (await fc).setFiles(SAMPLE); }
    await p.waitForFunction(() => S.refs && S.refs.length === 1, null, {timeout: 10000}); await wait(300);
    return p.evaluate(async () => {
      const ref = S.refs[0]; ref.q = [[ref.iw * .06, ref.ih * .9], [ref.iw * .96, ref.ih * .9], [ref.iw * .96, ref.ih * .1], [ref.iw * .06, ref.ih * .1]]; ref.qUser = 1; ref.labCor = 1; saveSess();
      const w = await MeasureLabSketch.createWall(ref.id, {name: 'Кухня'}, {L: 2364, H: 2700});
      await MeasureLabSketch.goPlan();
      const r = S.room, m = r.ms; m.pts = [[0, 0], [2364, 0], [2364, -3000], [0, -3000]]; m.closed = true;
      m.dims = [2364, 3000, 2364, 3000].map((v, i) => ({id: 'gd' + i, a: {p: i}, b: {p: (i + 1) % 4}, v})); gnFix(r); wIdFix(r);
      const W = k => r.wid[k];
      m.labRooms = [{id: 'zA', name: 'Кухня', zn: 1, pts: [[0, 0], [2364, 0], [2364, -1500], [0, -1500]], walls: [W(0), W(1)]},
        {id: 'zB', name: 'Гостиная', zn: 2, pts: [[0, -1500], [2364, -1500], [2364, -3000], [0, -3000]], walls: [W(2), W(3)]}];
      r.prd = [{id: 'pq1', no: 1, type: 'Кухня', n: '', room: 'zA', w: [{wid: W(0)}, {wid: W(1)}]}, {id: 'pq2', no: 2, type: 'Шкаф', n: '', room: 'zA', w: [{wid: W(0)}]},
        {id: 'pq3', no: 3, type: 'Шкаф', n: '', room: 'zB', w: [{wid: W(0)}, {wid: W(3)}]}];
      r.prdT = Date.now(); r.prdHi = 3; saveRoom(); await flushAll(); await MeasureLabSketch.saveNow();
      return {pid: MeasureLabSketch.pid(), room: r.id, wall: w, wid: {...r.wid}};
    });
  }
  // выгрузка «для Akrix» штатным путём v81-холста: ⇪ поделиться → appSave (AkrixApp.save)
  async function exportAkrix() {
    await p.evaluate(() => { window.__saved = null; window.AkrixApp = Object.assign(window.AkrixApp || {}, {save: (fn, type, txt) => { window.__saved = {fn, txt}; }}); });
    const r = await p.evaluate(async () => { try { await cvShare81(); } catch (e) { return String(e); } return window.__saved ? null : 'нет файла: ' + document.getElementById('toast').textContent; });
    if (r) return {err: r};
    return JSON.parse(await p.evaluate(() => window.__saved.txt));
  }
  const norm = o => { if (!o || o.err) return o; const c = JSON.parse(JSON.stringify(o)); delete c.date; for (const R of c.rooms || []) delete R.date; return JSON.stringify(c); };
  const sum = o => o && !o.err ? {rooms: (o.rooms || []).length, walls: (o.rooms || []).reduce((s, R) => s + Object.keys(R.ms.wl || {}).length, 0), zn: (o.rooms || []).flatMap(R => (R.ms.labRooms || []).map(q => q.zn)), prd: (o.prd || []).map(q => q.no + ':' + q.type + ':' + q.walls.length), no: (o.rooms || []).flatMap(R => Object.values(R.ms.wl || {}).flatMap(W => (W.els || []).map(e => e.no)))} : o;

  try {
    /* ════ Д2: выгрузка «для Akrix» из плана, стены, холста и списка проектов — один и тот же полный файл ════ */
    if (run('d2')) {
      await fresh(); errors = [];
      const F = await project();
      // элемент на стене (ригель) — els[].no / d в выгрузке
      await p.evaluate(async () => { const it = [...MeasureLabSketch.state.items].find(i => i.t === 'wall'); await MeasureLabSketch.activate(it); MeasureLabSketch.fitRegion(it); MeasureLabSketch.map.syncToS(it); draw(); }); await wait(400);
      await caseTool('.tl[data-k="rig"]'); { const a = await wallPt([4, 2319]), b = await wallPt([2362, 2699]); await down('pen', a); await move('pen', a, b); await up('pen', b); await wait(300); }
      info.d2rig = await p.evaluate(async () => { saveNow(); await flushAll(); return {els: S.els.map(e => e.k), act: MeasureLabSketch.active().t, tool: S.tool, mk: S.mk}; }); await shot('d2-rig');
      const ex = {};
      await p.evaluate(() => MeasureLabSketch.goPlan()); await wait(300); ex.plan = await exportAkrix();
      await p.evaluate(() => MeasureLabSketch.activate([...MeasureLabSketch.state.items].find(i => i.t === 'wall'))); await wait(300); ex.wall = await exportAkrix();
      info.d2wall = await p.evaluate(() => ({mode: S.mode, act: MeasureLabSketch.active().t, room: !!S.room, room0: !!S.room0}));
      await p.evaluate(() => MeasureLabSketch.activate('board')); await wait(300); ex.board = await exportAkrix();
      info.d2board = await p.evaluate(() => ({mode: S.mode, act: MeasureLabSketch.active().t, room: !!S.room, room0: !!S.room0, kind: S.sess && S.sess.kind}));
      await p.evaluate(() => MeasureLabProjects.show()); await wait(400); ex.list = await exportAkrix();
      info.d2 = Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, sum(v)]));
      const P = ex.plan;
      check(P && !P.err && P.prd && P.prd.length === 3 && sum(P).zn.join() === '1,2' && sum(P).no.length === 1 && Number.isInteger(sum(P).no[0]), 'Д2: выгрузка из плана — prd 3, labRooms zn 1,2, els[].no', info.d2.plan);
      for (const k of ['wall', 'board', 'list']) check(norm(ex[k]) === norm(P), `Д2: выгрузка из режима «${k}» = выгрузке из плана (кроме date)`, info.d2[k]);
      // путь через интерфейс: ⋮ → ⇪ Выгрузка для Akrix → «поделиться» при активной стене
      await p.evaluate(() => MeasureLabProjects.hide()); await p.evaluate(() => MeasureLabSketch.activate([...MeasureLabSketch.state.items].find(i => i.t === 'wall'))); await wait(400);
      await p.evaluate(() => { window.__saved = null; });
      await tapSel('touch', '#bMore'); await wait(200); await tapSel('touch', '#bExp'); await wait(400); await shot('d2-exp-wall');
      await tapSel('touch', '[data-zx="o"]'); await p.waitForFunction(() => window.__saved, null, {timeout: 15000});
      const ui = JSON.parse(await p.evaluate(() => window.__saved.txt));
      check(norm(ui) === norm(P), 'Д2: ⋮ → ⇪ → «поделиться» со стены (касания) — тот же файл, prd 3', sum(ui));
      // перезапуск на подложке (последнего открытого помещения в памяти нет) → ⋮ → ⇪: в окне есть «поделиться», файл тот же
      await p.evaluate(async () => { await MeasureLabSketch.activate('board'); try { await flushAll(); } catch (e) { } await MeasureLabSketch.saveNow(); });
      await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && MeasureLabSketch.isOpen(), null, {timeout: 20000}); await wait(1200);
      await p.evaluate(() => MeasureLabSketch.activate('board')); await wait(300);
      info.d2restart = await p.evaluate(() => ({act: MeasureLabSketch.active().t, room: !!S.room, room0: !!S.room0}));
      await p.evaluate(() => { window.__saved = null; window.AkrixApp = Object.assign(window.AkrixApp || {}, {save: (fn, type, txt) => { window.__saved = {fn, txt}; }}); });
      await tapSel('touch', '#bMore'); await wait(200); await tapSel('touch', '#bExp'); await wait(400); await shot('d2-exp-board-restart');
      await tapSel('touch', '[data-zx="o"]'); await p.waitForFunction(() => window.__saved, null, {timeout: 15000});
      const rs = JSON.parse(await p.evaluate(() => window.__saved.txt));
      check(info.d2restart.act === 'board' && norm(rs) === norm(P), 'Д2: после перезапуска с подложки (касания ⋮ → ⇪ → «поделиться») — тот же файл', {st: info.d2restart, f: sum(rs)});
      fs.writeFileSync(path.join(SHOT, 'd2-export.json'), JSON.stringify(P, null, 1));
      check(errors.length === 0, 'Д2: нет ошибок страницы', errors);
    }
    /* ════ Д10: системная «назад» — двойное нажатие для выхода и в корне списка проектов ════ */
    if (run('d10')) {
      await fresh(); errors = [];
      // чистый старт: список проектов без холста
      await p.goto(url); await p.waitForSelector('#labPrj.on', {timeout: 20000}); await wait(400);
      const a = await p.evaluate(() => ({r1: AkrixBack(), t: (document.querySelector('#labPrj .lp-to.on span') || {}).textContent || ''}));
      await shot('d10-exit-toast');
      const vis = await p.evaluate(() => { const e = document.querySelector('#labPrj .lp-to.on'); if (!e) return null; const r = e.getBoundingClientRect(), c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return {top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, front: !!(c && e.contains(c))}; });
      const b = await p.evaluate(() => AkrixBack());
      check(a.r1 === true && /Ещё раз — выход/.test(a.t) && vis && vis.front && vis.bottom <= vis.vh && b === false, 'Д10: корень списка (без холста): 1-е «назад» — тост «Ещё раз — выход» (виден), 2-е — false (оболочка)', {a, vis, b});
      // через > 2 с — снова первое нажатие
      await p.evaluate(() => AkrixBack()); await wait(2300); const c = await p.evaluate(() => AkrixBack());
      check(c === true, 'Д10: пауза > 2 с — снова тост, а не выход', c);
      // проект → холст → «назад» ×2 → список → «назад» ×2 → false; окно поверх списка закрывается первым
      info.d10fab = await p.evaluate(() => { const e = document.querySelector('#labPrj .lp-fab'), r = e.getBoundingClientRect(), c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return {r: r.toJSON(), at: c && (c.className || c.tagName), on: document.getElementById('labPrj').className}; });
      await tapSel('touch', '#labPrj .lp-fab'); await p.waitForSelector('#labPrj .lp-dg.on', {timeout: 5000});
      const dlg = await p.evaluate(() => ({r: AkrixBack(), open: document.querySelector('#labPrj .lp-dg.on') !== null}));
      await wait(600); info.d10fab2 = await p.evaluate(() => { const e = document.querySelector('#labPrj .lp-fab'), r = e.getBoundingClientRect(), c = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return {at: c && (c.className || c.tagName), dg: document.querySelector('#labPrj .lp-dg').className}; });
      await tapSel('touch', '#labPrj .lp-fab'); await p.waitForSelector('#labPrj .lp-dg.on');
      await tapSel('touch', '#labPrj [data-c]'); await p.keyboard.type('Назад'); await tapSel('pen', '#labPrj .lp-bt .lp-pr');
      await p.waitForFunction(() => MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 10000}); await wait(400);
      const d = await p.evaluate(() => { document.activeElement && document.activeElement.blur(); const r = []; for (let i = 0; i < 6 && !document.getElementById('toast').textContent.includes('Ещё раз'); i++) r.push(AkrixBack()); r.push(AkrixBack()); return {r}; });
      await wait(600); d.list = await p.evaluate(() => MeasureLabProjects.isOpen() && MeasureLabSketch.isOpen());
      const e2 = await p.evaluate(() => ({r1: AkrixBack(), t: (document.querySelector('#labPrj .lp-to.on span') || {}).textContent || '', r2: AkrixBack()}));
      check(dlg.r === true && !dlg.open && d.list && d.r.every(x => x === true) && e2.r1 === true && /Ещё раз — выход/.test(e2.t) && e2.r2 === false, 'Д10: окно поверх списка — закрывается; холст → «Ещё раз — к проектам» → список → «Ещё раз — выход» → false', {dlg, d, e2});
      check(errors.length === 0, 'Д10: нет ошибок страницы', errors);
    }
    /* ════ Д18: в меню холста нет старого диалога «Помещения / группы стен» и «Отдельной плоскости»; новое помещение — плитка футляра ════ */
    if (run('d18')) {
      await fresh(); errors = [];
      await project('Меню', 'Д18');
      await tapSel('touch', '#bMore'); await wait(300); await shot('d18-menu');
      const m = await p.evaluate(() => ({items: [...document.querySelectorAll('#zMenu.on button')].filter(b => b.getClientRects().length).map(b => b.textContent.trim()),
        plane: [...document.querySelectorAll('button')].filter(b => b.getClientRects().length && /Отдельная плоскость|Помещения \/ группы/.test(b.textContent)).length}));
      check(m.items.length > 0 && !m.items.some(t => /Помещения \/ группы стен|плоскость/i.test(t)) && m.plane === 0, 'Д18: ⋮ холста — без «Помещения / группы стен» и «Отдельная плоскость»', m);
      await p.evaluate(() => document.getElementById('zMenu').classList.remove('on'));
      await p.evaluate(() => MeasureLabSketch.activate('board')); await wait(200);
      const n0 = await p.evaluate(async () => (await dbAll('sess')).filter(r => r.kind === 'room' && !r.del).length);
      await caseTool('[data-lab-tb="room"]'); await wait(400); await shot('d18-room-dlg'); await tapSel('pen', '#labSketch .sk-dlg.on .bt .pr'); await wait(800);
      const n1 = await p.evaluate(async () => (await dbAll('sess')).filter(r => r.kind === 'room' && !r.del).length);
      check(n1 === n0 + 1, 'Д18: плитка «Новое помещение» футляра — помещение создано', {n0, n1});
      check(errors.length === 0, 'Д18: нет ошибок страницы', errors);
    }
    /* ════ Д16: в зонах один способ назначить стены — «Стены зоны · N»; «Выбирать стены» (правка стен плана) не путается с ним ════ */
    if (run('d16')) {
      await fresh(); errors = [];
      const F = await project('Зоны', 'Д16');
      await p.evaluate(async () => { const r = S.room; r.ms.labRooms[0].walls = []; saveRoom(); await flushAll(); });
      await p.evaluate(() => MeasureLabSketch.goPlan()); await wait(300);
      await p.evaluate(() => { const it = MeasureLabSketch.state.items.find(i => i.t === 'plan'); MeasureLabSketch.fitRegion(it); MeasureLabSketch.map.syncToS(it); draw(); });
      await caseTool('[data-lab-tb="zone"]'); await wait(300);
      const btn = () => p.evaluate(() => [...document.querySelectorAll('#lab12-plan [data-lab12]')].filter(b => b.getClientRects().length).map(b => b.dataset.lab12 + ':' + b.textContent.trim()));
      const b0 = await btn();
      await tap('pen', await plPt([1182, -750])); await wait(300);
      const b1 = await btn(); await shot('d16-zone-selected');
      check(b1.some(t => t.startsWith('assign:Стены зоны · 0')) && !b1.some(t => /Выбирать стены|^walls:/.test(t)), 'Д16: выбрана зона — для стен одна кнопка «Стены зоны · 0», «Выбирать стены» нет', {b0, b1});
      await tapSel('touch', '[data-lab12="assign"]'); await wait(200);
      await tap('touch', await plPt([1182, 0])); await tap('touch', await plPt([2364, -750])); await wait(200); await shot('d16-assign');
      await tapSel('touch', '[data-lab12="assigned"]'); await wait(200);
      const z = await p.evaluate(w => { const q = S.room.ms.labRooms.find(q => q.id === 'zA'); return {walls: q.walls, ok: q.walls.includes(w[0]) && q.walls.includes(w[1]) && q.walls.length === 2}; }, [F.wid[0], F.wid[1]]);
      const b2 = await btn();
      check(z.ok && b2.some(t => t.startsWith('assign:Стены зоны · 2')), 'Д16: «Стены зоны» → касания стен пальцем → «Готово» — стены назначены зоне (2)', {z, b2});
      // без выбранной зоны: «Правка стен» — правка геометрии (Сдвиг / Разбить), зоне стены не назначает
      await tap('pen', await plPt([1182, 600])); await wait(300);
      const b3 = await btn();
      check(b3.some(t => t === 'walls:Правка стен') && !b3.some(t => /Выбирать стены/.test(t)), 'Д16: без выбранной зоны — «Правка стен» (понятное название правки геометрии)', b3);
      check(errors.length === 0, 'Д16: нет ошибок страницы', errors);
    }
    /* ════ Д9: импорт своей выгрузки из списка проектов — проект «клиент · проект», холст проекта; повтор — обновить по oid (подтверждение) ════ */
    if (run('d9')) {
      await fresh(); errors = [];
      await project();
      await p.evaluate(() => MeasureLabSketch.goPlan()); await wait(300);
      const src = await exportAkrix(); const FILE = path.join(SHOT, 'd9-source.json'); fs.writeFileSync(FILE, JSON.stringify(src, null, 1));
      await fresh();
      await p.goto(url); await p.waitForSelector('#labPrj.on', {timeout: 20000}); await wait(400);
      const restore = async () => { await tapSel('touch', '#labPrj [data-lp="menu"]'); await wait(300); const fc = p.waitForEvent('filechooser', {timeout: 8000}); await tapText('touch', 'Восстановить из копии', '#labPrj'); await (await fc).setFiles(FILE); };
      const state = () => p.evaluate(async () => { const L = (await MeasureLabStore.projects()).filter(P => !P.del && !P.purged), all = await dbAll('sess'), K = MeasureLabSketch.state;
        return {prj: L.map(P => ({id: P.id, client: P.client, name: P.name, obj: P.obj, rooms: all.filter(r => r.kind === 'room' && !r.del && r.oid === P.id).length})), open: MeasureLabSketch.isOpen(), list: MeasureLabProjects.isOpen(), pid: MeasureLabSketch.pid(),
          title: (document.getElementById('labPrjT') || {}).textContent, items: K.items.map(i => i.t), act: MeasureLabSketch.active() && MeasureLabSketch.active().t, prd: Math.max(0, ...all.filter(r => r.kind === 'room' && !r.del && r.oid === K.pid).map(r => (r.prd || []).length)),
          zones: all.filter(r => r.kind === 'room' && !r.del && r.oid === K.pid).flatMap(r => (r.ms.labRooms || []).map(q => q.zn)), dlg: !!document.querySelector('#labPrj .lp-dg.on')}; });
      await restore(); await p.waitForFunction(() => MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 20000}); await wait(800);
      let s1 = await state(); await shot('d9-imported');
      check(s1.prj.length === 1 && s1.prj[0].id === src.oid && s1.prj[0].client === 'Сидоровы' && s1.prj[0].name === 'Кухня-гостиная' && s1.prj[0].obj === src.obj && s1.title === 'Сидоровы · Кухня-гостиная',
        'Д9: импорт из списка — проект «Сидоровы · Кухня-гостиная» (клиент и проект раздельно, id = oid файла)', s1.prj.concat([s1.title]));
      check(s1.open && !s1.list && s1.pid === src.oid && s1.items.includes('plan') && s1.items.filter(t => t === 'wall').length === 1, 'Д9: открыт холст проекта (не экран v81): план и область стены С1', s1);
      check(s1.prd === 3 && s1.zones.join() === '1,2' && s1.prj[0].rooms === 1, 'Д9: данные целы — 3 конструкции, зоны zn 1,2', s1);
      await p.evaluate(() => MeasureLabSketch.goPlan()); await wait(300);
      const back = await exportAkrix();
      check(JSON.stringify(sum(back)) === JSON.stringify(sum(src)) && back.oid === src.oid && back.obj === src.obj, 'Д9: повторная выгрузка импортированного проекта = исходной (prd, zn, стены, oid, obj)', {src: sum(src), back: sum(back)});
      // повтор того же файла: окно «уже есть» → «Обновить» → проект один, помещение одно (прежнее — в «Удалённые»)
      await p.evaluate(() => MeasureLabProjects.show()); await wait(400);
      await restore(); await p.waitForSelector('#labPrj .lp-dg.on', {timeout: 8000}); await wait(200); await shot('d9-ask');
      const askT = await p.evaluate(() => document.querySelector('#labPrj .lp-dg.on').textContent);
      await tapText('pen', 'Обновить', '#labPrj .lp-dg.on'); await p.waitForFunction(() => MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 20000}); await wait(800);
      const s2 = await state(); await shot('d9-updated');
      check(/уже есть/.test(askT) && s2.prj.length === 1 && s2.prj[0].rooms === 1 && s2.open && s2.pid === src.oid && s2.items.filter(t => t === 'wall').length === 1 && s2.prd === 3, 'Д9: тот же oid — подтверждение, «Обновить»: проект один, помещение одно, холст открыт', {askT, s2});
      // ещё раз → «Новым проектом» → второй проект «(2)»
      await p.evaluate(() => MeasureLabProjects.show()); await wait(400);
      await restore(); await p.waitForSelector('#labPrj .lp-dg.on', {timeout: 8000}); await tapText('pen', 'Новым проектом', '#labPrj .lp-dg.on');
      await p.waitForFunction(() => MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 20000}); await wait(800);
      const s3 = await state();
      check(s3.prj.length === 2 && s3.pid !== src.oid && s3.prj.some(P => P.id === s3.pid && P.client === 'Сидоровы' && /Кухня-гостиная \(2\)/.test(P.name) && P.rooms === 1), 'Д9: «Новым проектом» — второй проект «Сидоровы · Кухня-гостиная (2)», открыт его холст', s3.prj);
      // отмена — ничего не меняется
      await p.evaluate(() => MeasureLabProjects.show()); await wait(400);
      await restore(); await p.waitForSelector('#labPrj .lp-dg.on', {timeout: 8000}); await tapText('pen', 'Отмена', '#labPrj .lp-dg.on'); await wait(800);
      const s4 = await state();
      check(s4.prj.length === 2 && s4.list && !s4.dlg, 'Д9: «Отмена» — проекты не меняются, список на месте', s4.prj.length);
      check(errors.length === 0, 'Д9: нет ошибок страницы', errors);
      // конструктор v898: выгрузка импортированного проекта открывается
      if (fs.existsSync(AKRIX)) {
        const EXP = path.join(SHOT, 'd9-reexport.json'); fs.writeFileSync(EXP, JSON.stringify(back, null, 1)); const out = path.join(SHOT, 'akrix'); fs.mkdirSync(out, {recursive: true});
        try { cp.execFileSync(process.execPath, [path.join(__dirname, 'akrix-imp-v898.cjs'), AKRIX, out, EXP], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000, env: process.env});
          const R = JSON.parse(fs.readFileSync(out + '/import-result.json', 'utf8'))[0]; info.akrix = {walls: (R.walls || []).length, zw: R.zw && R.zw.walls && R.zw.walls.length, errors: R.errors};
          check(R.errors.length === 0 && (R.walls || []).length >= 1, 'Д9/Д2: конструктор v898 открывает выгрузку (⇧ → ✓ В стены), ошибок нет', info.akrix);
        } catch (e) { check(false, 'конструктор v898: импорт', String(e.stderr || e).slice(0, 800)); }
      }
    }
    /* ════ Д8: миграция 82.17 → 82.18 — фото старого скетча не ложится на области стен / плана ════ */
    async function d8(variant) {
      await fresh(); errors = [];
      await p.goto(base + '/old/web/experimental.html?nolist'); await p.waitForFunction(() => window.MeasureLabSketch && window.PM, null, {timeout: 20000});
      const old = await p.evaluate(async variant => {
        await PM.newRoom('Иванов', 'Кухня'); Object.assign(S.room.ms, {pts: [[0, 0], [3000, 0], [3000, 2500], [0, 2500]], closed: true, H: 2700, dims: [3000, 2500, 3000, 2500].map((v, i) => ({id: 'qd' + i, a: {p: i}, b: {p: (i + 1) % 4}, v}))});
        PM.gnFix(); await PM.flushAll(); const r1 = S.room.id;
        await PM.openWall(3); PM.bwSet(2500, 2700); S.els.push({id: 'qa-rig', k: 'roz', c: [600, 300], N: 1}); await PM.saveNow();
        await MeasureLabSketch.open('Иванов');
        const blob = await (await fetch('/prototypes/sketch/sample.jpg')).blob();
        await MeasureLabSketch.addPhotos([new File([blob], 'sample.jpg', {type: 'image/jpeg'})]);
        const K = MeasureLabSketch.state; K.cor = null;
        if (variant === 'a') { K.items = K.items.filter(i => i.t === 'photo'); Object.assign(K.items[0], {x: 760, y: 0}); } else { const ph = K.items.find(i => i.t === 'photo'), w = K.items.find(i => i.t === 'wall'); Object.assign(ph, {x: w.ax + 800, y: w.ay - 600}); }   // как у QA: в скетче 82.17 — только фото и заметка (областей стен / плана нет)
        K.items.push({id: 'nqa8', t: 'note', x: 40, y: -300, tx: 'узел ригеля'}); await MeasureLabSketch.saveNow();
        return {items: K.items.map(i => ({t: i.t, x: Math.round(i.x || i.ax || 0), y: Math.round(i.y || i.ay || 0), w: Math.round(i.w || 0)}))};
      }, variant);
      info['d8old' + variant] = old;
      await p.goto(url); await p.waitForFunction(() => window.MeasureLabSketch && (MeasureLabSketch.isOpen() || (window.MeasureLabProjects && MeasureLabProjects.isOpen())), null, {timeout: 20000}); await wait(1500);
      if (await p.evaluate(() => MeasureLabProjects.isOpen())) { await p.evaluate(async () => { const P = (await MeasureLabStore.projects()).find(x => x.client === 'Иванов' || /Иванов/.test(x.obj)); await MeasureLabProjects.open(P.id); }); await wait(1200); }
      await p.evaluate(() => { MeasureLabSketch.fitAll(); draw(); }); await wait(300); await shot('d8' + variant + '-migrated');
      const ov = await p.evaluate(() => { const K = MeasureLabSketch.state, R = K.items.map(i => ({t: i.t, id: i.id, r: MeasureLabSketch.region(i)})), refs = (S.sess && S.sess.kind === 'board' ? S.refs : K.boardRec.refs || []).map(r => ({id: r.id, r: MeasureLabSketch.refRegion(r.id)}));
        const o = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        return {items: R.map(x => ({t: x.t, r: Object.fromEntries(Object.entries(x.r).map(([k, v]) => [k, Math.round(v)]))})), refs: refs.map(x => ({r: Object.fromEntries(Object.entries(x.r || {}).map(([k, v]) => [k, Math.round(v)]))})), hits: refs.flatMap(f => R.filter(x => f.r && o(f.r, x.r)).map(x => x.t))}; });
      info['d8' + variant] = ov;
      check(ov.refs.length === 1 && ov.items.some(i => i.t === 'wall') && ov.hits.length === 0, 'Д8' + variant + ': после миграции фото 82.17 не перекрывает области стены / плана (' + (variant === 'a' ? 'в скетче только фото и заметка' : 'фото у области стены 82.17 — область 82.18 шире') + ')', ov);
      // активная стена видна (не под фото): касание области стены → стена активна, фото не над ней
      check(errors.length === 0, 'Д8' + variant + ': нет ошибок страницы', errors);
    }
    if (run('d8')) { await d8('a'); await d8('b'); }
  } catch (e) {
    check(false, 'сценарий прерван', String(e && e.stack || e)); try { await shot('abort'); } catch (x) { }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  fs.writeFileSync(path.join(root, 'tests', `qa-v8218-g3-${TAG}.json`), JSON.stringify({checks, errors, info}, null, 2));
  const bad = checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-g3 ${TAG}: ${checks.length - bad.length}/${checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
