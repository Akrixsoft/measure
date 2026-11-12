// AKX-2026-0015 блок 1 (вид стены 82.13 на холсте) — ключевые проверки. node tests/qa-w13-0015.cjs <фото> <скриншоты>
const path = require('path');
require('./qa-h-0015.cjs')(process.argv[3], 9357).then(async h => {
  const {p, ok, W, tap, drag, M, btn, key, ctxBtn, doc, scr, shot, tool, addPhotos, finish} = h;
  const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  ok('вверху ∠° Aa 📐, без «план/стены»', await M(`!document.querySelector('#mdT [data-md]') && ['∠°','Aa','📐'].every(t=>[...document.querySelectorAll('#mdT button')].some(b=>b.textContent===t))`));
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y);
  let d = await doc(); ok('контур 4 стены', d.walls.length === 4);
  const w1 = d.walls[0], lb = (await M('MeasureCore.labels()')).find(l => l.id === w1.id); await tap(lb.x + lb.w / 2, lb.y + lb.h / 2 + top); await key('3000ok');
  d = await doc(); ok('длина введена → стена фиксирована', d.walls[0].fx === 1);
  await tool('sel'); const n0 = d.nodes.find(n => n.id === w1.a), s0 = await scr(n0.x, n0.y); await drag(s0, [s0[0] + 40, s0[1] + 30]);
  d = await doc(); const n1 = d.nodes.find(n => n.id === w1.a); ok('узел фиксированной стены не тянется', n1.x === n0.x && n1.y === n0.y);
  const w3 = d.walls[2], a3 = d.nodes.find(n => n.id === w3.a), b3 = d.nodes.find(n => n.id === w3.b), m3 = await scr((a3.x + b3.x) / 2, (a3.y + b3.y) / 2);
  const v0 = await M('JSON.stringify(MeasureCore.view)'); await drag(m3, [m3[0] + 30, m3[1] + 40]); d = await doc();
  ok('невыбранная стена протяжкой не двигается — сдвиг холста', JSON.stringify(d.nodes) === JSON.stringify((await doc()).nodes) && d.nodes.find(n => n.id === w3.a).x === a3.x && (await M('JSON.stringify(MeasureCore.view)')) !== v0);
  // развёртка С1
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await W(100);
  { const A = d.nodes.find(n => n.id === w1.a), B = d.nodes.find(n => n.id === w1.b), s = await scr(A.x + (B.x - A.x) * 0.7, A.y + (B.y - A.y) * 0.7); await tap(s[0], s[1]); }
  const eb = await ctxBtn('на холст'); ok('модификатор «на холст» — в блоке модификаторов', !!eb && (await M(`!!document.querySelector('#zMods.on button')`))); await tap(eb[0], eb[1]); await key('2700ok'); await W(200);
  d = await doc(); ok('развёртка С1 3000 × 2700', d.elev.length === 1);
  const ed = await M('MeasureCore.edl()'); ok('без объёмов: L один, H на обеих боковых гранях', ed.filter(o => o.k === 'L').length === 1 && ed.filter(o => o.k === 'H').length === 2, ed.map(o => o.k));
  ok('подписи «С№ · L × H» нет', (await M('MeasureCore.elabels().length')) === 0);
  const hf = ed.find(o => o.k === 'H'); await tap(hf.r.x + hf.r.w / 2, hf.r.y + hf.r.h / 2 + top); ok('касание поля H → ввод H', (await M('MeasureCore.kb && MeasureCore.kb.t')) === 'H'); await key('2650ok');
  ok('H 2650', (await doc()).H === 2650);
  // колонна, W×H, цепочка низа
  const R = await M('MeasureCore.elevRect(MeasureCore.doc.elev[0])'), at = (x, y) => scr(R.x + x, R.y + R.h - y);
  await tool('kol'); await drag(await at(2000, 2600), await at(2400, 100));
  const wh = await ctxBtn('Ширина колонны'); ok('модификатор W (колонна — во всю высоту)', !!wh); await tap(wh[0], wh[1]); await key('400ok');
  d = await doc(); let c = d.com.find(x => x.k === 'kol'); ok('колонна 400, во всю высоту', c.w === 400 && (await M(`MeasureCore.cRect('${c.id}')`)).h === 2650, c);
  let e2 = await M('MeasureCore.edl()'); const segs = e2.filter(o => o.k === 'seg'); ok('колонна: одна цепочка до граней (3 звена), общего L нет', segs.length === 3 && !e2.some(o => o.k === 'L'), e2.map(o => o.k + ':' + (o.s && Math.round(o.s.v))));
  const g0 = segs[0]; await tap(g0.r.x + g0.r.w / 2, g0.r.y + g0.r.h / 2 + top); await key('500ok'); d = await doc(); c = d.com.find(x => x.k === 'kol');
  ok('звено «до колонны» = 500 → колонна сдвинута', c.x === 500, c.x);
  // ригель у потолка во всю ширину → бока «2 269 + 381»
  await tool('rig'); await drag(await at(20, 2630), await at(2980, 2269)); d = await doc(); const rg = d.com.find(x => x.k === 'rig'); ok('ригель во всю ширину у потолка', rg && rg.x === 0 && rg.w === 3000 && rg.y + rg.h === 2650, rg);
  if (rg.h !== 381) { await M(`(()=>{const c=MeasureCore.doc.com.find(x=>x.k==='rig');c.h=381;c.y=2650-381})()`); await M('MeasureCore.draw && MeasureCore.draw()'); await W(100); }
  let e3 = await M('MeasureCore.edl()'); const side = e3.filter(o => o.k === 'seg' && o.s.ax === 'y').map(o => Math.round(o.s.v)).sort((a, b) => a - b);
  ok('бока: 381 + 2 269 (слева и справа), H общего нет', JSON.stringify(side) === JSON.stringify([381, 381, 2269, 2269]) && !e3.some(o => o.k === 'H'), side);
  const s381 = e3.find(o => o.k === 'seg' && o.s.ax === 'y' && Math.round(o.s.v) === 381); await tap(s381.r.x + s381.r.w / 2, s381.r.y + s381.r.h / 2 + top); await key('400ok');
  d = await doc(); const rg2 = d.com.find(x => x.k === 'rig'); ok('поле 381 → 400: ригель растёт вниз, верх у потолка', rg2.h === 400 && rg2.y === 2250, rg2);
  await tool('sel'); { const s = await at(700, 1200); await tap(s[0], s[1]); }
  const zb = await ctxBtn('Z — глубина'); await tap(zb[0], zb[1]); await key('300ok'); ok('Z колонны 300', (await doc()).com.find(x => x.k === 'kol').D === 300);
  await M('MeasureCore.fitAll()'); await W(200); await shot('wall-82-13');
  // фото: 4 угла по диагонали → стена над фото
  await addPhotos([path.join(process.argv[2], 'p1.jpg')]); d = await doc(); const P = d.photos[0];
  await M(`MeasureCore.view.s=0.08;MeasureCore.view.ox=${-P.x}*0.08+30;MeasureCore.view.oy=${-P.y}*0.08+260`); await W(150);
  const ph = await M('MeasureCore.phH(MeasureCore.doc.photos[0])');
  await tool('pts'); await drag(await scr(P.x + P.w * 0.15, P.y + ph * 0.2), await scr(P.x + P.w * 0.85, P.y + ph * 0.8));
  d = await doc(); ok('4 угла — рамка одной протяжкой', d.frames.length === 1); ok('сразу ввод L', (await M('MeasureCore.kb && MeasureCore.kb.t')) === 'fL');
  await key('2400ok'); await W(200); d = await doc(); const e = d.elev.find(x => x.wall === d.frames[0].wall), P2 = d.photos[0];
  ok('стена по рамке создана', !!e); ok('развёртка над фото', e && e.y + 2650 < P2.y, e && [e.y, P2.y]);
  await M('MeasureCore.fitAll()'); await W(200); await shot('frame-wall-above');
  ok('меню ⋮: стилус, слои, резервная копия', await M(`['bPenM','bLay','bBak','bRes','bRms'].every(id=>document.getElementById(id))`));
  await finish();
});
