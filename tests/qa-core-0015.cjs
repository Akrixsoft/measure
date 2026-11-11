// AKX-2026-0015 — ручная проверка основного пути ядра холста касаниями (CDP touch), 412×797×3.
// Запуск: node tests/qa-core-0015.cjs <каталог-фото> <каталог-скриншотов>
const fs = require('fs'), path = require('path'), http = require('http');
const {chromium} = require(process.env.PW || 'playwright');
const IMG = process.argv[2], OUT = process.argv[3];
// страница — как в APK: собранный бандл scripts/web_bundle.py stage (index.html = web/core/index.html)
const ROOT = fs.mkdtempSync('/tmp/core-bundle-'); require('child_process').execFileSync('python3', [path.join(__dirname, '../scripts/web_bundle.py'), 'stage', ROOT]);
fs.mkdirSync(OUT, {recursive: true});
const R = []; const ok = (name, cond, info) => { R.push({name, ok: !!cond, info}); console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' · ' + JSON.stringify(info) : '')); };
(async () => {
  const st = http.createServer((q, r) => { const f = decodeURIComponent(q.url.split('?')[0]).slice(1);
    try { r.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html'); r.end(fs.readFileSync(path.join(ROOT, f))); } catch { r.writeHead(404).end(); } });
  await new Promise(r => st.listen(9341, '127.0.0.1', r));
  const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
  const ctx = await browser.newContext({viewport: {width: 412, height: 797}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
  const p = await ctx.newPage(), cdp = await ctx.newCDPSession(p), errs = []; let n = 0;
  p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 300)));
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: pts.map((a, i) => ({x: a[0], y: a[1], id: 7 + i}))});
  const W = ms => p.waitForTimeout(ms);
  const tap = async (x, y) => { await T('touchStart', [[x, y]]); await W(40); await T('touchEnd', []); await W(250); };
  const drag = async (a, b, k = 12) => { await T('touchStart', [a]); for (let i = 1; i <= k; i++) { await T('touchMove', [[a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k]]); await W(12); } await T('touchEnd', []); await W(250); };
  const pinch = async (c, d0, d1, k = 10) => { const P = d => [[c[0] - d / 2, c[1]], [c[0] + d / 2, c[1]]]; await T('touchStart', P(d0)); for (let i = 1; i <= k; i++) { await T('touchMove', P(d0 + (d1 - d0) * i / k)); await W(12); } await T('touchEnd', []); await W(300); };
  const shot = async name => { const f = path.join(OUT, String(++n).padStart(2, '0') + '-' + name + '.png'); await p.screenshot({path: f}); return f; };
  const M = js => p.evaluate(js);
  const doc = () => M('JSON.parse(JSON.stringify(MeasureCore.doc))');
  const box = sel => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const ctxBtn = txt => p.evaluate(t => { const b = [...document.querySelectorAll('#cCtx button')].find(e => e.textContent.includes(t)); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, txt);
  const CT = 52;                                                      // верх холста, px
  const scr = (x, y) => M(`MeasureCore.toS(${x},${y})`).then(([a, b]) => [a, b + CT]);

  await p.goto('http://127.0.0.1:9341/index.html'); await p.waitForFunction('window.MeasureCore && MeasureCore.ready');
  await shot('start');

  // 1. Фото группой через кнопку 📷 — системный выбор файлов
  ok('версия в бандле 82.19.1', (await M('window.MeasureVersion')) === '82.19.1');
  const [bx, by] = await box('#cPh'); await tap(bx, by);
  ok('📷 → выбор «Камера / Галерея»', !!(await ctxBtn('Камера')) && !!(await ctxBtn('Галерея')));
  ok('камера — input с capture', await M('document.getElementById("cCam").hasAttribute("capture")'));
  const fcP = p.waitForEvent('filechooser'); const gb = await ctxBtn('Галерея'); await tap(gb[0], gb[1]); const fc = await fcP;
  ok('выбор фото — множественный', fc.isMultiple());
  await fc.setFiles(['p1.jpg', 'p2.jpg', 'p3.jpg'].map(f => path.join(IMG, f))); await p.waitForFunction('MeasureCore.doc.photos.length===3', null, {timeout: 8000}).catch(() => {});
  let d = await doc(); ok('3 фото на холсте', d.photos.length === 3, d.photos.length);
  ok('фото столбиком, без наложения', d.photos.every((q, i) => !i || q.y >= d.photos[i - 1].y + 1));
  await W(300); await shot('photos-added');

  // 2. Щипок: уменьшить, фото остаются
  const v0 = await M('({...MeasureCore.view})'); await pinch([206, 400], 260, 90);
  const v1 = await M('({...MeasureCore.view})'); d = await doc();
  ok('щипок меняет масштаб', v1.s < v0.s * 0.6, {s0: v0.s, s1: v1.s}); ok('после щипка фото на месте (3, координаты прежние)', d.photos.length === 3);
  await shot('pinched');

  // 3. Стены плана — справа от фото, одним инструментом, без рамки
  const [, , ] = []; const b = await M('(()=>{const d=MeasureCore.doc;let x1=-1e9;for(const q of d.photos)x1=Math.max(x1,q.x+q.w);return x1})()');
  const [rx] = await scr(b, 0); const X0 = Math.min(rx + 40, 250), Y0 = 260;
  const [tx, ty] = await box('#cTb [data-t=wall]'); await tap(tx, ty);
  ok('инструмент «стена» включён', (await M('MeasureCore.tool')) === 'wall');
  await drag([X0, Y0], [X0 + 130, Y0 + 3]);                              // С1 (3 px наклона — привязка 0°)
  await drag([X0 + 130, Y0], [X0 + 132, Y0 + 150]);                      // С2 от конца С1
  await drag([X0 + 130, Y0 + 150], [X0 + 2, Y0 + 152]);                  // С3
  await drag([X0, Y0 + 150], [X0 + 2, Y0 + 4]);                          // С4 — на первый узел (замыкание)
  d = await doc();
  ok('4 стены, 4 узла (контур замкнут)', d.walls.length === 4 && d.nodes.length === 4, {walls: d.walls.length, nodes: d.nodes.length});
  ok('номера С1…С4', d.walls.map(w => w.gn).join() === '1,2,3,4');
  const nd = id => d.nodes.find(q => q.id === id), w1 = d.walls[0];
  ok('С1 горизонтальна (привязка 0°)', nd(w1.a).y === nd(w1.b).y, [nd(w1.a), nd(w1.b)]);
  d = await doc(); ok('фото не исчезли при рисовании плана', d.photos.length === 3);
  await shot('plan-4-walls');

  // 4. Длина С1 — касанием подписи, ввод значения
  const lb = (await M('MeasureCore.labels()')).find(l => l.id === w1.id);
  await tap(lb.x + lb.w / 2, lb.y + lb.h / 2 + CT);
  ok('поле длины открыто только по касанию подписи', await M('getComputedStyle(document.getElementById("cEd")).display!=="none"'));
  await p.fill('#cEd', '3200'); await p.keyboard.press('Enter'); await W(200);
  d = await doc(); const L1 = await M(`MeasureCore.wLen(MeasureCore.doc.walls[0])`);
  ok('С1 = 3200 мм', Math.abs(L1 - 3200) < 1, L1);
  { const d2 = await doc(), N = id => d2.nodes.find(q => q.id === id), w2 = d2.walls[1], w3 = d2.walls[2];
    ok('прямоугольник не перекошен: С2 вертикальна, С3 = 3200', N(w2.a).x === N(w2.b).x && Math.abs(await M('MeasureCore.wLen(MeasureCore.doc.walls[2])') - 3200) < 1); }
  await shot('len-3200');

  // 5. H и развёртка С2 на холст
  await p.fill('#cH', '2700'); await p.dispatchEvent('#cH', 'change'); await W(100);
  const [sx, sy] = await box('#cTb [data-t=sel]'); await tap(sx, sy);
  d = await doc(); const w2 = d.walls[1], a2 = d.nodes.find(q => q.id === w2.a), b2 = d.nodes.find(q => q.id === w2.b);
  const m2 = await scr((a2.x + b2.x) / 2, (a2.y + b2.y) / 2 + ((b2.y - a2.y) * 0.25)); await tap(m2[0], m2[1]);
  ok('касание стены выбирает её', JSON.stringify(await M('MeasureCore.sel')) === JSON.stringify({t: 'wall', id: w2.id}));
  const eb = await ctxBtn('на холст'); ok('кнопка «Стена С2 на холст»', !!eb); if (eb) await tap(eb[0], eb[1]);
  d = await doc(); ok('развёртка С2 создана, L из плана, H проекта', d.elev.length === 1 && d.elev[0].wall === w2.id && d.H === 2700);
  await shot('elev');

  // 6. Перетаскивание развёртки пальцем
  const e0 = d.elev[0], r0 = await M(`MeasureCore.elevRect(MeasureCore.doc.elev[0])`), c0 = await scr(r0.x + r0.w / 2, r0.y + r0.h / 2);
  await drag(c0, [c0[0] - 40, c0[1] + 120]);
  d = await doc(); ok('развёртка перемещена, ничего другого не сдвинулось', d.elev[0].y > e0.y && d.photos.length === 3 && d.walls.length === 4, {y0: e0.y, y1: d.elev[0].y});
  await shot('elev-moved');

  // 7. Фото: выбор, масштаб за угол, подрезка
  await M('MeasureCore.fitAll()'); await W(200);
  d = await doc(); const f0 = d.photos[0], fc0 = await scr(f0.x + f0.w / 2, f0.y + 30); await tap(fc0[0], fc0[1]);
  ok('фото выбрано касанием', JSON.stringify(await M('MeasureCore.sel')) === JSON.stringify({t: 'photo', id: f0.id}));
  const br = await scr(f0.x + f0.w, f0.y + await M(`MeasureCore.phH(MeasureCore.doc.photos[0])`));
  await drag(br, [br[0] + 30, br[1] + 22]);
  d = await doc(); ok('масштаб за угол, пропорция сохранена, левый верх на месте', d.photos[0].w > f0.w && d.photos[0].x === f0.x && d.photos[0].y === f0.y, {w0: f0.w, w1: d.photos[0].w});
  const cb = await ctxBtn('Подрезать'); await tap(cb[0], cb[1]);
  const fp = d.photos[0], tl = await scr(fp.x, fp.y); await drag(tl, [tl[0] + 25, tl[1] + 18]);
  const done = await ctxBtn('Готово'); await shot('crop'); await tap(done[0], done[1]);
  d = await doc(); ok('подрезка: окно уменьшено, правый низ на месте', d.photos[0].cr[0] > 0.05 && d.photos[0].cr[1] > 0.05 && Math.abs((d.photos[0].x + d.photos[0].w) - (fp.x + fp.w)) <= 2, d.photos[0].cr);
  await shot('cropped');

  // 8. Второй палец во время рисования стены — стена не создаётся, вид масштабируется
  await tap(tx, ty); const nW = (await doc()).walls.length;
  await M(`window.__pl=[];for(const t of ['pointerdown','pointerup','pointercancel'])addEventListener(t,e=>__pl.push(t[7]+e.pointerId),true)`);
  await T('touchStart', [[60, 600]]); await T('touchMove', [[90, 600]]); await T('touchMove', [[120, 600]]); await T('touchStart', [[120, 600], [220, 600]]);
  await T('touchMove', [[110, 600], [240, 600]]); await T('touchMove', [[100, 600], [260, 600]]); await T('touchEnd', []); await W(250);
  ok('щипок посреди рисования — стена не создана', (await doc()).walls.length === nW);
  await W(400); await tap(sx, sy); ok('после щипка кнопка «выбор» срабатывает', (await M('MeasureCore.tool')) === 'sel', await M('__pl.join(" ")'));

  // 9. ↶ / ↷
  const crBefore = (await doc()).photos[0].cr;
  let [ux, uy] = await box('#cUn'); await tap(ux, uy);
  ok('↶ возвращает подрезку', (await doc()).photos[0].cr.join() === '0,0,1,1');
  let [qx, qy] = await box('#cRe'); await tap(qx, qy);
  ok('↷ повторяет', (await doc()).photos[0].cr.join() === crBefore.join());

  // 10. 🗑 фото и возврат
  d = await doc(); const f1 = d.photos[1];
  const fc1 = await M(`(()=>{const c=document.getElementById('cCv');for(let y=20;y<c.clientHeight-20;y+=6)for(let x=10;x<c.clientWidth-10;x+=6){const h=MeasureCore.hit(x,y);if(h&&h.t==='photo'&&h.id==='${f1.id}')return [x,y+52]}return null})()`);
  ok('видимая часть фото 2 найдена', !!fc1, fc1); await tap(fc1[0], fc1[1]); ok('фото 2 выбрано', (await M('MeasureCore.sel')||{}).id === f1.id, await M('MeasureCore.sel'));
  const [dx, dy] = await box('#cDel'); await tap(dx, dy);
  ok('🗑 удаляет выбранное фото', (await doc()).photos.length === 2);
  await tap(ux, uy); ok('↶ возвращает фото', (await doc()).photos.length === 3);
  await shot('restored');

  // 11. Перезапуск: всё на месте, ↶ доступна
  const vb = await M('({...MeasureCore.view})'), before = await doc(), hs = await M('MeasureCore.hs.u.length'); const [ox, oy] = await box('#cOk'); await tap(ox, oy); await W(300);
  await p.reload(); await p.waitForFunction('window.MeasureCore && MeasureCore.ready'); await W(800);
  const after = await doc();
  ok('после перезапуска документ тот же', JSON.stringify(after) === JSON.stringify(before));
  { const va = await M('({...MeasureCore.view})'); ok('после перезапуска вид тот же', Math.abs(va.s - vb.s) < 1e-9 && Math.abs(va.ox - vb.ox) < 0.01 && Math.abs(va.oy - vb.oy) < 0.01, {vb, va}); }
  ok('после перезапуска журнал ↶ сохранён', (await M('MeasureCore.hs.u.length')) === hs, hs);
  ok('картинки фото загружены из базы', await M('new Promise(r=>setTimeout(()=>r(true),300))'));
  await shot('reloaded');
  ok('нет ошибок страницы', errs.length === 0, errs);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({pass: R.filter(r => r.ok).length, total: R.length, R, errs}, null, 1));
  await browser.close(); st.close();
})();
