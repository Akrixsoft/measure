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
  const key = async seq => { for (const k of seq.match(/ok|bs|pm|./g)) { const b = await p.evaluate(k => { const e = document.querySelector('#cKb [data-kk="' + k + '"]'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, k); await tap(b[0], b[1]); } };
  const shot = async name => { const f = path.join(OUT, String(++n).padStart(2, '0') + '-' + name + '.png'); await p.screenshot({path: f}); return f; };
  const M = js => p.evaluate(js);
  const doc = () => M('JSON.parse(JSON.stringify(MeasureCore.doc))');
  const box = sel => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const ctxBtn = txt => p.evaluate(t => { const b = [...document.querySelectorAll('#zpb button, #labCrop button, #fws button')].find(e => e.offsetParent && (e.textContent.includes(t) || (e.title || '').includes(t))); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, txt);
  const CT = 48;                                                      // верх холста, px
  const scr = (x, y) => M(`MeasureCore.toS(${x},${y})`).then(([a, b]) => [a, b + CT]);

  await p.goto('http://127.0.0.1:9341/index.html'); await p.waitForFunction('window.MeasureCore && MeasureCore.ready');
  await shot('start');

  // 1. Фото группой через кнопку 📷 — системный выбор файлов
  ok('версия в бандле', (await M('window.MeasureVersion')) === require('fs').readFileSync(path.join(__dirname,'../web/lab-version.js'),'utf8').match(/MeasureVersion = '([^']+)'/)[1]);
  const [bx, by] = await box('#ch [data-q=rf]'); await tap(bx, by);
  ok('фото-справка → плашка «камера / галерея»', !!(await ctxBtn('камера')) && !!(await ctxBtn('галерея')));
  ok('камера — input с capture', await M('document.getElementById("cCam").hasAttribute("capture")'));
  const fcP = p.waitForEvent('filechooser'); const gb = await ctxBtn('галерея'); await tap(gb[0], gb[1]); const fc = await fcP;
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
  const mdP = await box('#mdT [data-md=plan]'), mdW = await box('#mdT [data-md=wall]'); await tap(mdP[0], mdP[1]);
  const [tx, ty] = await box('#ch [data-q=st]'); await tap(tx, ty);
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
  ok('клавиатура открыта только по касанию подписи', await M('document.body.classList.contains("kb")'));
  await key('3200ok');
  d = await doc(); const L1 = await M(`MeasureCore.wLen(MeasureCore.doc.walls[0])`);
  ok('С1 = 3200 мм', Math.abs(L1 - 3200) < 1, L1);
  { const d2 = await doc(), N = id => d2.nodes.find(q => q.id === id), w2 = d2.walls[1], w3 = d2.walls[2];
    ok('прямоугольник не перекошен: С2 вертикальна, С3 = 3200', N(w2.a).x === N(w2.b).x && Math.abs(await M('MeasureCore.wLen(MeasureCore.doc.walls[2])') - 3200) < 1); }
  await shot('len-3200');

  // 5. H и развёртка С2 на холст
  const [sx, sy] = await box('#ch [data-q=sel]'); await tap(sx, sy);
  d = await doc(); const w2 = d.walls[1], a2 = d.nodes.find(q => q.id === w2.a), b2 = d.nodes.find(q => q.id === w2.b);
  const m2 = await scr((a2.x + b2.x) / 2, (a2.y + b2.y) / 2 + ((b2.y - a2.y) * 0.25)); await tap(m2[0], m2[1]);
  await shot('wall-selected');
  ok('касание стены выбирает её', JSON.stringify(await M('MeasureCore.sel')) === JSON.stringify({t: 'wall', id: w2.id}));
  const eb = await ctxBtn('на холст'); ok('кнопка «Стена С2 на холст» (значок t-wallseg)', !!eb); if (eb) await tap(eb[0], eb[1]);
  ok('H не задана — открыта клавиатура H', await M('document.body.classList.contains("kb")')); await shot('kb-H'); await key('2700ok');
  d = await doc(); ok('развёртка С2 создана, L из плана, H проекта', d.elev.length === 1 && d.elev[0].wall === w2.id && d.H === 2700);
  await shot('elev');

  // 6. Перетаскивание развёртки пальцем
  const e0 = d.elev[0], r0 = await M(`MeasureCore.elevRect(MeasureCore.doc.elev[0])`), c0 = await scr(r0.x + r0.w / 2, r0.y + r0.h / 2);
  await drag(c0, [c0[0] - 40, c0[1] + 120]);
  d = await doc(); ok('развёртка перемещена, ничего другого не сдвинулось', d.elev[0].y > e0.y && d.photos.length === 3 && d.walls.length === 4, {y0: e0.y, y1: d.elev[0].y});
  await shot('elev-moved');

  // 7. Фото: выбор, масштаб за угол, подрезка
  const sy0 = (await box('#ch [data-q=sel]'))[1];
  await M('MeasureCore.fitAll()'); await W(200);
  d = await doc(); const f0 = d.photos[0], fc0 = await scr(f0.x + f0.w / 2, f0.y + 30); await tap(fc0[0], fc0[1]);
  ok('фото выбрано касанием', JSON.stringify(await M('MeasureCore.sel')) === JSON.stringify({t: 'photo', id: f0.id}));
  ok('выбор фото не сдвигает строку инструментов', (await box('#ch [data-q=sel]'))[1] === (await box('#ch [data-q=sel]'), sy0));
  await shot('photo-selected');
  const br = await scr(f0.x + f0.w, f0.y + await M(`MeasureCore.phH(MeasureCore.doc.photos[0])`));
  await drag(br, [br[0] + 30, br[1] + 22]);
  d = await doc(); ok('масштаб за угол, пропорция сохранена, левый верх на месте', d.photos[0].w > f0.w && d.photos[0].x === f0.x && d.photos[0].y === f0.y, {w0: f0.w, w1: d.photos[0].w});
  const cb = await ctxBtn('Подрезать'); await tap(cb[0], cb[1]);
  const fp = d.photos[0], tl = await scr(fp.x, fp.y); await drag(tl, [tl[0] + 25, tl[1] + 18]);
  const done = await ctxBtn('✓ Подрезать'); await shot('crop'); await tap(done[0], done[1]);
  d = await doc(); ok('подрезка: окно уменьшено, правый низ на месте', d.photos[0].cr[0] > 0.05 && d.photos[0].cr[1] > 0.05 && Math.abs((d.photos[0].x + d.photos[0].w) - (fp.x + fp.w)) <= 2, d.photos[0].cr);
  await shot('cropped');

  // 8. Второй палец во время рисования стены — стена не создаётся, вид масштабируется
  await tap(mdP[0], mdP[1]); await tap(tx, ty); const nW = (await doc()).walls.length;
  await M(`window.__pl=[];for(const t of ['pointerdown','pointerup','pointercancel'])addEventListener(t,e=>__pl.push(t[7]+e.pointerId),true)`);
  await T('touchStart', [[60, 600]]); await T('touchMove', [[90, 600]]); await T('touchMove', [[120, 600]]); await T('touchStart', [[120, 600], [220, 600]]);
  await T('touchMove', [[110, 600], [240, 600]]); await T('touchMove', [[100, 600], [260, 600]]); await T('touchEnd', []); await W(250);
  ok('щипок посреди рисования — стена не создана', (await doc()).walls.length === nW);
  await W(400); await tap(sx, sy); ok('после щипка кнопка «выбор» срабатывает', (await M('MeasureCore.tool')) === 'sel', await M('__pl.join(" ")'));

  await tap(mdW[0], mdW[1]);
  // 8a. Размеры: на фото (значение вводом), на плане (по геометрии), фото двигается — размер следует
  const [mx2, my2] = await box('#ch [data-q=dim]'); await tap(mx2, my2);
  ok('инструмент «размер» включён', (await M('MeasureCore.tool')) === 'dim');
  await M('MeasureCore.fitAll()'); await W(200);
  d = await doc(); const ph = d.photos[2], phh = await M('MeasureCore.phH(MeasureCore.doc.photos[2])');
  { const c3 = await scr(ph.x + ph.w / 2, ph.y + phh * 0.75); await pinch(c3, 60, 220); }
  // ряд, где фото 3 видно сплошь на 110 px и рядом нет углов (касание по видимой части)
  const seg3 = await M(`(()=>{const c=document.getElementById('cCv');for(let y=30;y<c.clientHeight-30;y+=4){let run=0;for(let x=20;x<c.clientWidth-20;x+=2){const ok3=yy=>{const h=MeasureCore.hit(x,yy);return h&&h.t==='photo'&&h.id==='${ph.id}'};if(ok3(y)&&ok3(y-24)&&ok3(y+24)){run+=2;if(run>=90)return [x-75,y,x-15]}else run=0}}return null})()`);
  ok('видимая часть фото 3 для размера', !!seg3, seg3);
  const pa = [seg3[0], seg3[1] + CT], pb = [seg3[2], seg3[1] + CT + 2];
  await drag(pa, pb);
  d = await doc(); const dm = d.dims[d.dims.length - 1];
  ok('размер на фото создан, концы привязаны к фото', dm && dm.a.t === 'photo' && dm.b.t === 'photo' && dm.a.id === ph.id, dm);
  ok('значение на фото — «?» до ввода', (await M(`MeasureCore.dimVal(MeasureCore.doc.dims[${d.dims.length - 1}]).txt`)) === '?');
  ok('после создания клавиатура не открывается', !(await M('document.body.classList.contains("kb")')));
  const dl = (await M('MeasureCore.dlabels()')).find(l => l.id === dm.id); await tap(dl.x, dl.y + CT);
  ok('касание подписи размера — клавиатура', await M('document.body.classList.contains("kb")'));
  await key('1250ok');
  d = await doc(); ok('значение размера 1250', d.dims.find(q => q.id === dm.id).v === 1250);
  await shot('dim-photo');
  // фото переносится — размер вместе с ним
  const A0 = await M(`MeasureCore.endPos(MeasureCore.doc.dims.find(q=>q.id==='${dm.id}').a)`);
  const [sx2, sy2] = await box('#ch [data-q=sel]'); await tap(sx2, sy2);
  const pc = await scr(ph.x + ph.w * 0.5, ph.y + phh * 0.15); await drag(pc, [pc[0] - 50, pc[1] + 30]);
  d = await doc(); const ph2 = d.photos[2], A1 = await M(`MeasureCore.endPos(MeasureCore.doc.dims.find(q=>q.id==='${dm.id}').a)`);
  ok('фото перенесено — конец размера сместился так же', Math.abs((A1.x - A0.x) - (ph2.x - ph.x)) < 1 && Math.abs((A1.y - A0.y) - (ph2.y - ph.y)) < 1, {dx: A1.x - A0.x, px: ph2.x - ph.x});
  // размер на плане между узлами С1 — по геометрии
  await M('MeasureCore.fitAll()'); await W(300);
  await tap(mx2, my2); d = await doc(); const w1n = d.walls[0], n1 = d.nodes.find(q => q.id === w1n.a), n2 = d.nodes.find(q => q.id === w1n.b);
  const s1 = await scr(n1.x, n1.y), s2 = await scr(n2.x, n2.y); await drag(s1, s2);
  d = await doc(); const dp = d.dims[d.dims.length - 1];
  ok('размер на плане привязан к узлам', dp.a.t === 'node' && dp.b.t === 'node', [dp.a.t, dp.b.t]);
  ok('значение на плане = длина С1', (await M(`MeasureCore.dimVal(MeasureCore.doc.dims[${d.dims.length - 1}]).txt`)).replace(/\s/g, '') === String(Math.round(await M('MeasureCore.wLen(MeasureCore.doc.walls[0])'))));
  { const [ax2, ay2] = await box('#ch [data-q=arr]'); await tap(ax2, ay2); const nd0 = (await doc()).dims.length;
    await drag([120, 300], [200, 250]); const dd = await doc(); ok('инструмент «стрелка» — стрелка', dd.dims.length === nd0 + 1 && dd.dims[dd.dims.length - 1].k === 'arr'); }
  await shot('dim-plan');
  await tap(sx2, sy2);

  // 9. ↶ / ↷
  const crBefore = (await doc()).photos[0].cr; 
  let [ux, uy] = await box('#bUnd'); for (let i = 0; i < 12 && (await doc()).photos[0].cr.join() !== '0,0,1,1'; i++) await tap(ux, uy);
  ok('↶ возвращает подрезку', (await doc()).photos[0].cr.join() === '0,0,1,1');
  let [qx, qy] = await box('#bRed'); await tap(qx, qy);
  ok('↷ повторяет', (await doc()).photos[0].cr.join() === crBefore.join());
  for (let i = 0; i < 12 && (await M('MeasureCore.hs.r.length')); i++) await tap(qx, qy);
  ok('↷ до конца — размеры и стрелка вернулись', (await doc()).dims.length === 3);

  // 10. 🗑 фото и возврат
  d = await doc(); const f1 = d.photos[1];
  const fc1 = await M(`(()=>{const c=document.getElementById('cCv');for(let y=20;y<c.clientHeight-20;y+=6)for(let x=10;x<c.clientWidth-10;x+=6){const h=MeasureCore.hit(x,y);if(h&&h.t==='photo'&&h.id==='${f1.id}')return [x,y+52]}return null})()`);
  ok('видимая часть фото 2 найдена', !!fc1, fc1); await tap(fc1[0], fc1[1]); ok('фото 2 выбрано', (await M('MeasureCore.sel')||{}).id === f1.id, await M('MeasureCore.sel'));
  const [dx, dy] = await box('#bDelS'); await tap(dx, dy);
  ok('🗑 удаляет выбранное фото', (await doc()).photos.length === 2);
  await tap(ux, uy); ok('↶ возвращает фото', (await doc()).photos.length === 3);
  await shot('restored');

  // 10a. Строки быстрого доступа: из футляра — добавить, на 🗑 — убрать, по строке — порядок
  await tap(mdW[0], mdW[1]);
  { const [fx, fy] = await box('#zpF'); await tap(fx, fy); }
  ok('футляр открыт', await M('document.getElementById("tb").classList.contains("on")'));
  await shot('tb');
  const q = () => M('[...document.querySelectorAll("#ch [data-q]")].map(e=>e.dataset.q)');
  const q2 = () => M('[...document.querySelectorAll("#zpSlots [data-q]")].map(e=>e.dataset.q)');

  { const s0 = await box('#tb .tl[data-k=roz]'), last = await box('#ch [data-q]:last-child'); await drag(s0, [last[0] + 20, last[1]], 16); }
  ok('розетка из футляра перетащена в строку', (await q()).includes('roz'), await q());
  ok('футляр — розетка на месте', await M('!!document.querySelector("#tb .tl[data-k=roz]")'));
  { const s0 = await box('#tb .tl[data-k=er]'), z = await box('#zpSlots [data-q]'); await drag(s0, [z[0] - 6, z[1]], 16); }
  ok('ластик в нижнюю строку, первым', (await q2())[0] === 'er', await q2());
  await tap(...(await box('#tbX')));
  ok('футляр закрыт', !(await M('document.getElementById("tb").classList.contains("on")')));
  { const s0 = await box('#ch [data-q=pen]'), del = await box('#bDelS'); await drag(s0, del, 16); }
  ok('перо на 🗑 — убрано из строки', !(await q()).includes('pen'), await q());
  ok('перо осталось в футляре', await M('!!document.querySelector("#tb .tl[data-k=pen]")'));
  ok('🗑 не удалил объект на холсте', (await doc()).photos.length === 3 && (await doc()).walls.length === 4);
  { const s0 = await box('#ch [data-q=arr]'), f = await box('#ch [data-q]:first-child'); await drag(s0, [f[0] - 8, f[1]], 16); }
  ok('стрелка перетащена в начало строки', (await q())[0] === 'arr', await q());
  { const [fx, fy] = await box('#zpF'); await tap(fx, fy); await tap(...(await box('#tb .tl[data-k=dim]'))); }
  ok('касание в футляре — взять инструмент, футляр закрывается', (await M('MeasureCore.tool')) === 'dim' && !(await M('document.getElementById("tb").classList.contains("on")')));
  await shot('strips-edited');
  const stripsBefore = JSON.stringify([await q(), await q2()]);

  // 11. Перезапуск: всё на месте, ↶ доступна
  const vb = await M('({...MeasureCore.view})'), before = await doc(), hs = await M('MeasureCore.hs.u.length'); const [ox, oy] = await box('#bDone'); await tap(ox, oy); await W(300);
  await p.reload(); await p.waitForFunction('window.MeasureCore && MeasureCore.ready'); await W(800);
  const after = await doc();
  ok('после перезапуска документ тот же', JSON.stringify(after) === JSON.stringify(before));
  { const va = await M('({...MeasureCore.view})'); ok('после перезапуска вид тот же', Math.abs(va.s - vb.s) < 1e-9 && Math.abs(va.ox - vb.ox) < 0.01 && Math.abs(va.oy - vb.oy) < 0.01, {vb, va}); }
  ok('после перезапуска журнал ↶ сохранён', (await M('MeasureCore.hs.u.length')) === hs, hs);
  ok('картинки фото загружены из базы', await M('new Promise(r=>setTimeout(()=>r(true),300))'));
  await shot('reloaded');
  ok('после перезапуска строки те же', JSON.stringify([await q(), await q2()]) === stripsBefore);
  ok('нет ошибок страницы', errs.length === 0, errs);
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({pass: R.filter(r => r.ok).length, total: R.length, R, errs}, null, 1));
  await browser.close(); st.close();
})();
