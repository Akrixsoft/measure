// Measure 82.18 — QA REWORK AKX-2026-0012, инженер g2: Д4, Д5, Д7, Д13, Д14, Д17 + d ниши в выгрузке.
// Телефонный режим, касания пером / пальцем через CDP, ввод полей — своя клавиатура #zkb (как владелец).
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 [QA_SHOT=<папка>] node tests/qa-v8218-g2.cjs
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const VW = +(process.env.QA_VW || 412), VH = +(process.env.QA_VH || 797), DPR = +(process.env.QA_DPR || 3), TAG = `${VW}x${VH}x${DPR}`;
const SHOT = process.env.QA_SHOT || path.join('/tmp/qa8218-g2', TAG);
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
  const checks = [], errors = [];
  p.on('pageerror', e => errors.push(String(e.stack || e)));
  const check = (ok, name, detail) => { checks.push({ok: !!ok, name, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(detail ?? '').slice(0, 600)); };
  let shotN = 0; const shot = n => p.screenshot({path: path.join(SHOT, String(++shotN).padStart(2, '0') + '-' + n + '.png')});
  const wait = ms => p.waitForTimeout(ms), ev = (fn, a) => p.evaluate(fn, a);
  const down = async (t, a) => { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: a[0], y: a[1], id: 7}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: a[0], y: a[1], pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, force: .6}); };
  const move = async (t, a, b, n = 12, dt = 0) => { for (let i = 1; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y, id: 7}]}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x, y, pointerType: 'pen', button: 'left', buttons: 1, force: .6}); if (dt) await wait(dt); } };
  const up = async (t, b) => { if (t === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: b[0], y: b[1], pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1}); await wait(80); };
  const tap = async (t, a) => { await down(t, a); await up(t, a); await wait(180); };
  const drag = async (t, a, b) => { await down(t, a); await move(t, a, b); await up(t, b); await wait(250); };
  const box = sel => ev(s => { const e = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const tapSel = async (t, sel) => { const c = await box(sel); if (!c) throw new Error('нет на экране: ' + sel); await tap(t, c); };
  const kbOn = () => ev(() => { const k = document.getElementById('zkb'); return !!(k && k.getClientRects().length && getComputedStyle(k).display !== 'none' && k.getBoundingClientRect().height > 50); });
  const typeKb = async v => { if (!(await kbOn())) throw new Error('#zkb нет'); await ev(() => { const a = KB.el; if (a && a.setSelectionRange) { const n = a.value.length; a.setSelectionRange(n, n); } }); for (let i = 0; i < 8; i++) await tapSel('touch', '#zkb [data-kk="bs"]'); for (const ch of String(v)) await tapSel('touch', `#zkb [data-kk="${ch === '.' ? ',' : ch === '-' ? 'pm' : ch}"]`); await tapSel('touch', '#zkb [data-kk="ok"]'); await wait(300); };
  const cssK = w => ev(w => { const s = MeasureLabSketch.map.toScrK(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const refAt = (id, u, v) => ev(([id, u, v]) => { const R = MeasureLabSketch.refRegion(id); return [R.x + R.w * u, R.y + R.h * v]; }, [id, u, v]).then(cssK);
  const wallPt = w => ev(w => { const s = PM.toScr(...fromW(w, wf())), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const caseTool = async sel => { const f = (await box('#zpF')) || (await box('#labPlF')); if (!f) throw new Error('футляр не виден'); await tap('touch', f); await wait(250); await tapSel('touch', '#tb.on ' + sel); await wait(250); };
  const labels = () => ev(() => { draw(); const d = devicePixelRatio, r = cv.getBoundingClientRect(); return S.w3L.map(l => ({t: l.t, x: l.c[0] / d + r.left, y: l.c[1] / d + r.top, w: (l.w || 36 * d) / d, h: (l.h || 36 * d) / d, an: l.an || 0})); });
  const field = async t => { const f = (await labels()).find(l => l.t === t); if (!f) return 'нет поля ' + t; await tap('pen', [f.x, f.y]); await wait(300); return (await kbOn()) ? 'ok' : 'нет #zkb'; };
  const st = () => ev(() => { draw(); const Md = w3Model(); return {WH: Md.H, vols: w3Vols(Md).map(v => ({k: v.k, x0: Math.round(v.x0), x1: Math.round(v.x1), y0: +v.y0.toFixed(1), y1: +v.y1.toFixed(1)})), l: S.w3L.map(l => l.t)}; });
  const rig = s => s.vols.find(v => v.k === 'rig');
  const closeField = () => ev(() => { const i = document.getElementById('w3f'); i._k = null; i.classList.remove('on'); i.blur(); });
  try {
    await p.goto(url); await wait(2500);
    // ── проект → фото → 4 угла → «▣ Стена» ──
    await tapSel('touch', '#labPrj .lp-fab'); await wait(400);
    { const inp = await ev(() => [...document.querySelectorAll('#labPrj .lp-dg.on input')].map(e => { const r = e.getBoundingClientRect(); return [r.left + 40, r.top + r.height / 2]; }));
      await tap('touch', inp[0]); await p.keyboard.type('QA g2'); await tap('touch', inp[1]); await p.keyboard.type('Кухня'); await tapSel('pen', '#labPrj .lp-dg.on .lp-pr'); await wait(1800); }
    { const fc = p.waitForEvent('filechooser', {timeout: 8000}); await caseTool('[data-lab-tb="gal"]'); await (await fc).setFiles(SAMPLE); await wait(1500); }
    if (await box('#bDone')) { await tapSel('touch', '#bDone'); await wait(500); }
    const rid = await ev(() => S.refs[0].id);
    await tap('touch', await refAt(rid, .5, .3)); await wait(400); await tapSel('touch', '#labSkPh [data-skp="cor"]');
    for (const [u, v] of [[.06, .11], [.97, .1], [.97, .89], [.08, .9]]) { await tap('pen', await refAt(rid, u, v)); await wait(150); }
    await tapSel('touch', '#labSkPh [data-skp="wall"]'); await wait(500);
    // Д17: ноль / отрицательное / не число в L, H — отказ с сообщением, окно не закрывается
    const dlgTry = async (L, H) => { await ev(([L, H]) => { const B = document.querySelector('#labSketch .sk-dlg .bx'); B.querySelector('[data-sk-l]').value = L; B.querySelector('[data-sk-h]').value = H; }, [L, H]);
      await tapSel('pen', '#labSketch .sk-dlg .bt .pr'); await wait(700);
      return ev(() => ({open: document.querySelector('#labSketch .sk-dlg').classList.contains('on'), bad: [...document.querySelectorAll('#labSketch .sk-dlg input.lab-bad')].map(i => 'skL' in i.dataset ? 'L' : 'H'), toast: (document.getElementById('toast') || {}).textContent || '', act: MeasureLabSketch.active().t})); };
    { const r = await dlgTry('2364', '-50'); check(r.open && r.bad.join() === 'H' && /больше 0/.test(r.toast) && r.act === 'board', 'Д17: H = −50 отклонено с сообщением', r); }
    { const r = await dlgTry('0', '2700'); check(r.open && r.bad.join() === 'L' && /Длина L/.test(r.toast), 'Д17: L = 0 отклонено', r); }
    { const r = await dlgTry('-1', '0'); check(r.open && r.bad.join() === 'L,H', 'Д17: L и H ≤ 0 отклонены оба', r); }
    await shot('d17-rejected');
    { const r = await dlgTry('2364', '2700'); const q = await ev(() => S.q4 && [S.q4.L, S.q4.H]); check(!r.open && r.act === 'wall' && q && q[0] === 2364 && q[1] === 2700, 'Д17: корректные L/H — стена создана 2364 × 2700', {r, q}); }
    await wait(800);

    // ── Д4: ригель у потолка — поле высоты, цепочка, зазор; H стены не меняется ──
    await caseTool('.tl[data-k="rig"]'); await drag('pen', await wallPt([0, 2319]), await wallPt([2364, 2700])); await wait(400);
    let s = await st(); check(rig(s) && rig(s).y0 === 2319 && rig(s).y1 === 2700 && s.l.includes('381') && s.l.includes('2 319') && !s.l.includes('2 700'), 'Д4: ригель 381 у потолка, цепочка 2 319 + 381', s);
    check(await field('381') === 'ok', 'Д4: касание пером поля «381» → #zkb'); await typeKb('400');
    s = await st(); check(s.WH === 2700 && rig(s).y0 === 2300 && rig(s).y1 === 2700 && s.l.includes('400') && s.l.includes('2 300') && !s.l.includes('381'), 'Д4: поле 381 → 400: ригель растёт вниз, на экране 400 / 2 300, H стены 2700', s);
    await shot('d4-rig400');
    check(await field('2 300') === 'ok', 'Д4: поле отрезка «2 300» → #zkb'); await typeKb('2319');
    s = await st(); check(s.WH === 2700 && rig(s).y0 === 2319 && rig(s).y1 === 2700 && s.l.includes('381'), 'Д4: отрезок 2 300 → 2319: ригель 381 у потолка, H стены 2700 (не 2698)', s);
    await ev(() => { const e = S.els.find(e => e.k === 'rig'), W = wf(), c = toW(e.c, W); e.c = fromW([c[0], c[1] - 1.4], W); saveSess(); draw(); });   // зазор 1,4 мм под потолком (как протяжка у QA 412×797)
    s = await st(); check(s.l.includes('1'), 'Д4: зазор над ригелем подписан «1»', s.l);
    check(await field('1') === 'ok', 'Д4: поле зазора «1» → #zkb'); await typeKb('0');
    s = await st(); check(s.WH === 2700 && rig(s).y1 === 2700 && rig(s).y0 === 2319, 'Д4: зазор 1 → 0: ригель к потолку, H стены 2700 (не 2699)', s);
    for (const [t, v] of [['381', '380'], ['2 320', '2320'], ['380', '381']]) { const r = await field(t); if (r !== 'ok') { check(false, 'Д4: поле ' + t, r); break; } await typeKb(v); }
    s = await st(); check(s.WH === 2700 && rig(s).y0 === 2319 && rig(s).y1 === 2700, 'Д4: серия правок (381→380, 2 320, 380→381) — без дрейфа на 1 мм', s);
    { const n0 = await ev(() => S.und.length); await ev(() => zUndo()); await wait(250); const u = await st(); check(rig(u).y0 === 2320 && u.WH === 2700, 'Д4: ↶ — шаг правки высоты ригеля', {n0, r: rig(u)}); await ev(() => zRedo()); await wait(250); }
    // поле высоты стены (ребро не разрезано): объём у потолка остаётся у потолка
    await ev(() => { const e = S.els.find(e => e.k === 'rig'), W = wf(), c = toW(e.c, W); e.W = 1000; e.c = fromW([1100, c[1]], W); S.sel = null; saveSess(); mkPanel(); draw(); });
    { const r = await field('2 700'); check(r === 'ok', 'Д4: поле высоты стены «2 700» (ребро не разрезано)', r); if (r === 'ok') { const n0 = await ev(() => S.und.length); await typeKb('2800'); s = await st(); const top = await ev(() => { const Md = w3Model(); return {H: Md.H, Hl: (manV('Hl') || {}).v, Hr: (manV('Hr') || {}).v, q4: S.q4 && S.q4.H}; });
      check(s.l.includes('2 800') && rig(s).y1 === s.WH && rig(s).y0 === +(s.WH - 381).toFixed(1), 'Д4: поле высоты стены меняет высоту ребра; ригель остаётся у потолка (высота 381)', {s, top});
      await ev(n0 => { while (S.und.length > n0) zUndo(); }, n0); await wait(300); s = await st(); check(s.WH === 2700 && rig(s).y1 === 2700 && !s.l.includes('2 800'), 'Д4: ↶ — высота стены и ригель как были', s); } }
    await ev(() => { const e = S.els.find(e => e.k === 'rig'), W = wf(), c = toW(e.c, W); e.W = 2364; e.c = fromW([1182, c[1]], W); saveSess(); draw(); });

    // ── Д5: розетка касанием пером на заполненной стене при обычном масштабе ──
    await caseTool('.tl[data-k="kol"]'); await drag('pen', await wallPt([1800, 0]), await wallPt([2100, 2319])); await wait(300);
    await caseTool('.tl[data-k="kor"]'); await drag('pen', await wallPt([0, 0]), await wallPt([700, 300])); await wait(300);
    await caseTool('.tl[data-k="nis"]'); await drag('pen', await wallPt([900, 1000]), await wallPt([1500, 1600])); await wait(300);
    check((await ev(() => S.els.map(e => e.k).sort().join())) === 'kol,kor,nis,rig', 'Д5: на стене ригель, колонна, короб, ниша', await ev(() => S.els.map(e => e.k)));
    if (await box('#ch [data-k="roz"]')) await tapSel('touch', '#ch [data-k="roz"]'); else await caseTool('.tl[data-k="roz"]');
    check(await ev(() => S.mk) === 'roz', 'Д5: инструмент «розетка»');
    await ev(() => { S.sel = null; mkPanel(); draw(); });
    const freeOf = async w => { const c = await wallPt(w), L = await labels(); return L.every(l => { const dx = c[0] - l.x, dy = c[1] - l.y, ca = Math.cos(l.an), sa = Math.sin(l.an), u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return Math.abs(u) > l.w / 2 + 6 || Math.abs(v) > l.h / 2 + 6; }); };
    const cand = [[300, 2000], [500, 700], [1650, 450], [1200, 600], [300, 1500], [1650, 1800], [1200, 2050], [600, 1200], [1950, 1200], [350, 150], [1300, 300], [750, 1800], [1950, 1700], [150, 1200], [1600, 1100], [1200, 1800]];
    const tries = []; let n = 0;
    for (const w of cand) { if (n >= 6) break; if (!(await freeOf(w))) continue; n++;
      const n0 = await ev(() => S.els.filter(e => e.k === 'roz').length); await tap('pen', await wallPt(w)); await wait(200);
      const r = await ev(() => ({n: S.els.filter(e => e.k === 'roz').length, sel: S.sel && (S.els.find(e => e.id === S.sel) || {}).k, f: document.getElementById('w3f').classList.contains('on')}));
      tries.push({w: w.join(','), placed: r.n - n0, sel: r.sel, field: r.f}); if (r.f) await closeField(); }
    check(tries.length >= 5 && tries.every(t => t.placed === 1 && t.sel === 'roz' && !t.field), 'Д5: каждое касание пером (≥5, свободные места и поверх колонны / короба) ставит розетку; поле не открывается, ригель не выбирается', tries);
    await shot('d5-sockets');
    { const lab = (await labels()).find(l => l.t === '2 364'); const n0 = await ev(() => S.els.filter(e => e.k === 'roz').length); await tap('pen', [lab.x, lab.y]); await wait(300);
      const r = await ev(() => ({n: S.els.filter(e => e.k === 'roz').length, f: document.getElementById('w3f').classList.contains('on')})); check(r.f && r.n === n0 && await kbOn(), 'Д5: точное касание подписи «2 364» при инструменте розетки — поле с #zkb', r); await closeField(); await wait(200); }
    { const sel = await ev(() => S.sel), c = await wallPt([1950, 600]); await tap('pen', c); const r = await ev(() => ({sel: S.sel && S.els.find(e => e.id === S.sel).k})); check(r.sel === 'roz', 'Д5: касание поверх колонны при выбранной розетке — новая розетка, колонна не выбрана', {before: sel, ...r}); }

    // ── Н8: поля размеров не на значках розеток и внутри рамки области (∠° 90 / 180 / 45) ──
    { const res = [];
      for (const a of [90, 180, 45]) { const r = await ev(a => { W3.a = a; draw(); const it = MeasureLabSketch.active(), R = MeasureLabSketch.region(it), A = MeasureLabSketch.map.toScrK(R.x, R.y), B = MeasureLabSketch.map.toScrK(R.x + R.w, R.y + R.h), F = {x0: Math.min(A[0], B[0]), x1: Math.max(A[0], B[0]), y0: Math.min(A[1], B[1]), y1: Math.max(A[1], B[1])};
        const z = w3IcZ() * 0.6, ic = S.els.filter(e => e.k === 'roz').map(e => toScr(...e.c)), over = [], out = [];
        for (const l of S.w3L) { const ca = Math.cos(l.an || 0), sa = Math.sin(l.an || 0);
          for (const c of ic) { const dx = c[0] - l.c[0], dy = c[1] - l.c[1], u = dx * ca + dy * sa, v = -dx * sa + dy * ca; if (Math.hypot(Math.max(Math.abs(u) - l.w / 2, 0), Math.max(Math.abs(v) - l.h / 2, 0)) < z * 0.8) over.push(l.t); }
          const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [l.c[0] + u * l.w / 2 * ca - v * l.h / 2 * sa, l.c[1] + u * l.w / 2 * sa + v * l.h / 2 * ca]);
          if (cs.some(q => q[0] < F.x0 - 3 || q[0] > F.x1 + 3 || q[1] < F.y0 - 3 || q[1] > F.y1 + 3)) out.push(l.t); }
        return {a, n: S.w3L.length, roz: ic.length, over, out}; }, a); res.push(r); await shot('n8-' + a); }
      await ev(() => { W3.a = 90; draw(); });
      check(res.every(r => r.roz >= 5 && r.n > 8 && !r.over.length && !r.out.length), 'Н8: поля размеров не накрывают розетки и не выходят за рамку области (∠° 90 / 180 / 45)', res); }
    // ── Д13: строки — «+» не на 7-м инструменте, ↶↷🗑 на месте после поля / выбора, первый цвет целый ──
    const rows = () => ev(() => { const R = e => e && e.getBoundingClientRect(), a = R(document.getElementById('chAll')); const tools = [...document.querySelectorAll('#ch .pb')].filter(e => e.getClientRects().length).map(R);
      const zc = document.querySelector('#zpb .zcols'), zr = zc && R(zc), first = zc && [...zc.children].filter(c => c.offsetWidth).map(R).find(r => r.right > zr.left + .5);
      const f0 = zc && zc.firstElementChild && R(zc.firstElementChild); return {plusOver: tools.filter(b => a && b.right > a.left + 1 && b.left < a.right - 1).length, zur: document.getElementById('zur').parentElement.id, firstClip: first ? +(zr.left - first.left).toFixed(1) : null, sl: zc ? zc.scrollLeft : null, black: !!(f0 && zc.firstElementChild.dataset.zc === '#1a2027' && f0.left >= zr.left - .5 && f0.right <= zr.right + .5), more: zc ? zc.scrollWidth <= zc.clientWidth + 2 || zc.classList.contains('lab-more-r') : null}; });
    await tapSel('touch', '#ch [data-k="dim"]'); await wait(400);
    { const r = await rows(); check(r.plusOver === 0, 'Д13: инструмент «размер» (плашка ∟∥↔⛓🧲) — «+» не налезает на инструменты', r);
      check(r.sl === 0 && r.black && r.more, 'Д13 / Н9: лента цветов с первого цвета (чёрный виден целиком), не помещается — явная прокрутка (lab-more-r)', r); await shot('d13-dim'); }
    await tapSel('touch', '#ch [data-k="sel"]'); await wait(300);
    check(await field('2 364') === 'ok', 'Д13: поле открыто (#zkb)'); await typeKb('2364');
    { const r = await rows(); check(r.zur === 'zpb', 'Д13: после своей клавиатуры ↶↷🗑 — в нижней строке', r); }
    { let pt = null; for (const y of [1500, 1000, 1900, 300, 2150, 700]) { const roz = await ev(() => S.els.filter(e => e.k === 'roz').map(e => toW(e.c, wf()))); if (await freeOf([1950, y]) && roz.every(c => Math.hypot(c[0] - 1950, c[1] - y) > 250)) { pt = [1950, y]; break; } }
      await tap('pen', await wallPt(pt || [1950, 1500])); await wait(400); if (await kbOn()) await closeField(); }
    { const r = await rows(), k = await ev(() => ({sel: S.sel && S.els.find(e => e.id === S.sel).k, mk: S.mk, roz: S.els.filter(e => e.k === 'roz').map(e => toW(e.c, wf()).map(Math.round))})); check(k.sel === 'kol' && r.zur === 'zpb', 'Д13: выбор объекта — ↶↷🗑 на месте', {k, ...r}); }
    await shot('d13-rows');

    // ── Н1: протяжка инструмента от подписи размера рисует объект; Z колонны полем #pp пером и пальцем ──
    { await caseTool('.tl[data-k="kol"]'); await ev(() => { S.sel = null; mkPanel(); draw(); });
      const lab = (await labels()).find(l => l.t === '2 364'), n0 = await ev(() => S.els.filter(e => e.k === 'kol').length);
      const b = [lab.x + 40, lab.y + 150]; await drag('pen', [lab.x, lab.y], b); await wait(300);
      const r = await ev(() => ({n: S.els.filter(e => e.k === 'kol').length, sel: S.sel && S.els.find(e => e.id === S.sel).k, f: document.getElementById('w3f').classList.contains('on')}));
      check(r.n === n0 + 1 && r.sel === 'kol' && !r.f, 'Н1: протяжка колонны от подписи «2 364» — колонна создана, поле не открыто', r);
      for (const [t, v] of [['pen', 300], ['touch', 250]]) {
        const zb = await box('#pp [data-lab-z]'); if (!zb) { check(false, 'Н1: поле Z в #pp (' + t + ')', 'нет поля'); break; }
        await tap(t, zb); await wait(250);
        if (await kbOn()) await typeKb(String(v)); else { await p.keyboard.press('Control+A'); await p.keyboard.type(String(v)); await p.keyboard.press('Enter'); await wait(250); }
        const D = await ev(() => +(S.els.find(e => e.id === S.sel) || {}).D); check(D === v, `Н1: Z колонны полем #pp [data-lab-z] (${t === 'pen' ? 'перо' : 'палец'}) = ${v}`, {D}); }
      await ev(() => { S.sel = null; mkPanel(); draw(); }); }
    // ── Д7: ∠° — активация стены касанием области, бегунок держится, 0–180, угол на экране ──
    await ev(() => { S.sel = null; mkPanel(); draw(); });
    await ev(() => MeasureLabSketch.activate('board')); await wait(900);
    check(await ev(() => MeasureLabSketch.active().t) === 'board' && !(await ev(() => document.body.classList.contains('w3'))), 'Д7: активна подложка (стена неактивна, ∠° нет)');
    { const it = await ev(() => { const it = MeasureLabSketch.state.items.find(i => i.t === 'wall'), R = MeasureLabSketch.region(it); return [R.x + R.w * .5, R.y + R.h * .55]; }); await tap('touch', await cssK(it)); await wait(1200); }
    check(await ev(() => MeasureLabSketch.active().t) === 'wall', 'Д7: касание области стены — стена активна');
    if (await kbOn()) await closeField();
    const poll = async (n, ms) => { let o = ''; for (let i = 0; i < n; i++) { o += await ev(() => document.body.classList.contains('w3') && !!document.querySelector('#mdT [data-w3s="a"]') && document.querySelector('#mdT [data-w3s="a"]').getClientRects().length > 0 ? '1' : '0'); await wait(ms); } return o; };
    { const s1 = await poll(25, 100); check(/^1+$/.test(s1), 'Д7: после активации касанием — ∠° и #w3p видны 2,5 с', s1); }
    await tapSel('touch', '#ch [data-k="pen"]'); { const s2 = await poll(25, 100); check(/^1+$/.test(s2), 'Д7: после касания инструмента — ∠° не пропадает', s2); }
    await tapSel('touch', '#mdT [data-w3s="a"]'); await wait(300);
    { const r = await ev(() => { const i = document.querySelector('#w3sl input'), b = i.getBoundingClientRect(); return {on: document.getElementById('w3sl').classList.contains('on'), min: +i.min, max: +i.max, a: W3.a, x0: b.left, x1: b.right, y: b.top + b.height / 2}; });
      check(r.on && r.min === 0 && r.max === 180, 'Д7: бегунок ∠° открыт, 0–180', r);
      const xa = r.x0 + (r.x1 - r.x0) * 0.5, xb = r.x1 - 1; await down('touch', [xa, r.y]); await move('touch', [xa, r.y], [xb, r.y], 30, 90); await up('touch', [xb, r.y]); await wait(400);
      const a = await ev(() => ({a: W3.a, on: document.getElementById('w3sl').classList.contains('on'), w3: document.body.classList.contains('w3')})); check(a.a === 180 && a.on && a.w3, 'Д7: протяжка пальцем 90 → 180 (≈3 с) не обрывается, бегунок открыт', a); await shot('d7-180'); }
    { const m = await ev(() => { const out = []; for (const a of [0, 30, 45, 90, 135, 180]) { W3.a = a; draw(); const Md = w3Model(), x = Md.L / 2, A = w3S([x, 0, 0]), B = w3S([x, 0, 1000]); let g = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI; /* экран: от «вправо» по часовой (y вниз) */ if (g < 0) g += 360; out.push([a, +g.toFixed(2)]); } W3.a = 90; draw(); return out; });
      check(m.every(([a, g]) => Math.abs(a - g) < 0.5), 'Д7: угол оси глубины на экране (от «вправо», по часовой) = значению ∠°: 0 → вправо, 90 → вниз, 180 → влево', m); }

    // ── Д14: колонна плана 230 у угла С1/С2 — на стене С2 ширина и глубина по одному разу ──
    { const r = await ev(async () => {
        await PM.newRoom('QA g2 col', 'К'); Object.assign(S.room.ms, {pts: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]], closed: true, H: 2700, dims: [4000, 3000, 4000, 3000].map((v, i) => ({id: 'd' + i, a: {p: i}, b: {p: (i + 1) % 4}, v})), shp: [{t: 'box', pts: [[3770, 0], [4000, 0], [4000, 230], [3770, 230]], note: ''}]});
        gnFix(); saveRoom(); await new Promise(r => setTimeout(r, 400)); await PM.openWall(1); PM.bwSet(3000, 2700); fit(); draw(); await new Promise(r => setTimeout(r, 500)); draw();
        const v = w3Vols(w3Model()).find(v => v.plan), L = S.w3L.filter(l => typeof l.a === 'string' && l.a.startsWith(v.id)).map(l => [l.t, l.a, l.b]);
        return {v: v && [v.x0, v.x1, v.D], L, all: S.w3L.map(l => l.t)}; });
      const n230 = r.all.filter(t => t === '230').length; check(r.v && n230 === 2 && r.L.filter(x => /^p0W/.test(x[1])).length === 1, 'Д14: колонна плана на С2 — «230» ширина один раз, глубина один раз (без дубля сверху / снизу)', r); await shot('d14-c2'); }

    // ── ниша: d = |Z| в выгрузке (wl[k].els[]) ──
    { const r = await ev(async () => {
        await PM.newRoom('QA g2 nis', 'К'); Object.assign(S.room.ms, {pts: [[0, 0], [3000, 0], [3000, 3000], [0, 3000]], closed: true, H: 2700, dims: [3000, 3000, 3000, 3000].map((v, i) => ({id: 'n' + i, a: {p: i}, b: {p: (i + 1) % 4}, v}))});
        gnFix(); saveRoom(); await new Promise(r => setTimeout(r, 400)); await PM.openWall(0); PM.bwSet(3000, 2700); fit(); draw(); await new Promise(r => setTimeout(r, 400));
        const W = wf(), mk = (k, x, y, w, h, D) => ({id: 'e' + k + Math.random().toString(36).slice(2, 6), k, c: fromW([x + w / 2, y + h / 2], W), W: w, H: h, D, N: '', st: '', note: ''});
        S.els.push(mk('nis', 500, 800, 600, 400, 150), mk('nis', 1500, 800, 400, 400, ''), mk('kol', 2400, 0, 300, 2700, 250)); saveSess(); await saveNow(); await flushAll();
        await zmSet('plan'); const x = await exportRoomObj(); const out = []; (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if ('x0' in o && 'y1' in o && o.t) out.push({t: o.t, w: o.x1 - o.x0, d: o.d === undefined ? 'нет' : o.d}); Object.values(o).forEach(walk); } })(x); return out; });
      const n1 = r.find(e => e.t !== 'col' && e.w === 600), n2 = r.find(e => e.t !== 'col' && e.w === 400), c = r.find(e => e.t === 'col');
      check(n1 && n1.d === 150 && n2 && n2.d === 'нет' && c && c.d === 250, 'выгрузка: ниша с глубиной Z — d = 150; ниша без глубины — без d; колонна d = 250', r); }
  } catch (e) { check(false, 'сценарий', String(e && e.stack || e).slice(0, 1500)); try { await shot('error'); } catch (x) { } }
  check(!errors.length, 'ошибок страницы нет', errors.slice(0, 5));
  const failed = checks.filter(c => !c.ok).length;
  const res = {tag: TAG, pass: checks.length - failed, fail: failed, checks};
  fs.writeFileSync(path.join(root, `tests/qa-v8218-g2-${TAG.replace(/x\d+$/, m => m)}.json`), JSON.stringify(res, null, 1));
  console.log(`${TAG}: ${checks.length - failed}/${checks.length}`);
  await browser.close(); server.close(); process.exit(failed ? 1 : 0);
})();
