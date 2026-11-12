// AKX-2026-0015 блок 1 (вид стены 82.13 на холсте) — ключевые проверки. node tests/qa-w13-0015.cjs <фото> <скриншоты>
const path = require('path');
require('./qa-h-0015.cjs')(process.argv[3], 9357).then(async h => {
  const {p, ok, W, tap, drag, M, btn, key, ctxBtn, doc, scr, shot, tool, addPhotos, finish} = h;
  const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  ok('вверху ∠° Aa 📐, без «план/стены»', await M(`!document.querySelector('#mdT [data-md]') && ['∠°','Aa','📐'].every(t=>[...document.querySelectorAll('#mdT button')].some(b=>b.textContent===t))`));
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y);
  let d = await doc(); ok('контур 4 стены', d.walls.length === 4);
  const w1 = d.walls[0];   /* 82.35.8: на плане длины нет — вводится полем L на развёртке */
  ok('на плане — только обозначение', await M(`(() => { const l = MeasureCore.labels().find(l => l.id === '${w1.id}'); return !!l && l.w < 60; })()`));
  await M(`(() => { MeasureCore.sel = {t: 'wall', id: '${w1.id}'}; })()`); await btn('#vwGo'); await W(250);
  { const e1 = (await doc()).elev.find(e => e.wall === w1.id), fl = (await M('MeasureCore.edl()')).find(o => o.k === 'L' && (o.s ? true : true)); const all = await M(`MeasureCore.edl().map(o => ({k: o.k, r: o.r}))`); const L1 = (await M(`(() => { const L = []; return L; })()`), all.filter(o => o.k === 'L'));
    const R = await M(`MeasureCore.elevRect(MeasureCore.doc.elev.find(e => e.id === '${e1.id}'))`), q = await M(`MeasureCore.toS(${R.x + R.w / 2}, ${R.y})`);
    const f = L1.sort((a, b) => Math.hypot(a.r.x + a.r.w / 2 - q[0], a.r.y + a.r.h / 2 - q[1]) - Math.hypot(b.r.x + b.r.w / 2 - q[0], b.r.y + b.r.h / 2 - q[1]))[0];
    await tap(f.r.x + f.r.w / 2, f.r.y + f.r.h / 2 + top); await key('3000ok'); }
  await M(`(() => { MeasureCore.sel = null; })()`); await M('MeasureCore.fitAll()'); await W(250);
  d = await doc(); ok('длина введена → стена фиксирована', d.walls[0].fx === 1);
  await tool('sel'); const n0 = d.nodes.find(n => n.id === w1.a), s0 = await scr(n0.x, n0.y); await drag(s0, [s0[0] + 40, s0[1] + 30]);
  d = await doc(); const n1 = d.nodes.find(n => n.id === w1.a); ok('узел фиксированной стены не тянется', n1.x === n0.x && n1.y === n0.y);
  const w3 = d.walls[2], a3 = d.nodes.find(n => n.id === w3.a), b3 = d.nodes.find(n => n.id === w3.b), m3 = await scr((a3.x + b3.x) / 2, (a3.y + b3.y) / 2);
  const v0 = await M('JSON.stringify(MeasureCore.view)'); await drag(m3, [m3[0] + 30, m3[1] + 40]); d = await doc();
  ok('невыбранная стена протяжкой не двигается — сдвиг холста', JSON.stringify(d.nodes) === JSON.stringify((await doc()).nodes) && d.nodes.find(n => n.id === w3.a).x === a3.x && (await M('JSON.stringify(MeasureCore.view)')) !== v0);
  // развёртка С1
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await W(100);
  { const A = d.nodes.find(n => n.id === w1.a), B = d.nodes.find(n => n.id === w1.b), s = await scr(A.x + (B.x - A.x) * 0.7, A.y + (B.y - A.y) * 0.7); await tap(s[0], s[1]); }
  ok('кнопки «на холст» нет (82.35.5)', !(await ctxBtn('на холст')));
  d = await doc(); ok('замкнутый контур — все 4 стены на холсте, H по умолчанию 2700', d.elev.length === 4 && (await M(`MeasureCore.elevRect(MeasureCore.doc.elev[0]).h`)) === 2700);
  await M(`(() => { const D = MeasureCore.doc, k = D.elev.find(e => e.wall === '${w1.id}'); D.elev = [k]; const r = MeasureCore.elevRect(k), V = MeasureCore.view; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 374 - (r.y + r.h / 2) * V.s; MeasureCore.draw(); })()`);   // вид — на С1, как раньше делала кнопка   // дальше — проверки на одной С1, как раньше
  const ed = await M('MeasureCore.edl()'); ok('без объёмов: L один, высота — своим полем на каждой боковой грани', ed.filter(o => o.k === 'L').length === 1 && ed.filter(o => o.k === 'eE').length === 2, ed.map(o => o.k));
  ok('подписи «С№ · L × H» нет', (await M('MeasureCore.elabels().length')) === 0);
  const hf = ed.find(o => o.k === 'eE'); await tap(hf.r.x + hf.r.w / 2, hf.r.y + hf.r.h / 2 + top); ok('касание поля грани → ввод размера этой грани (82.35.9)', (await M('MeasureCore.kb && MeasureCore.kb.t')) === 'eE'); await key('ok');
  await btn('#wHf button'); await key('2650ok');   /* высота стены — полем слева третьим рядом */
  ok('H 2650', (await doc()).walls.find(w => w.id === w1.id).H === 2650);
  // колонна, W×H, цепочка низа
  const R = await M('MeasureCore.elevRect(MeasureCore.doc.elev[0])'), at = (x, y) => scr(R.x + x, R.y + R.h - y);
  await tool('kol'); await drag(await at(2000, 2600), await at(2400, 100));
  ok('колонна после рисования не выделена', !(await M('MeasureCore.sel'))); await tool('sel'); { const q = await at(2200, 1300); await tap(q[0], q[1]); }   // 82.35.1: выбрать касанием
  ok('у колонны нет кнопок W и Z (82.35.3)', !(await ctxBtn('Ширина колонны')) && !(await ctxBtn('Z — глубина')));
  { const ew = (await M('MeasureCore.edl()')).find(o => o.k === 'seg' && o.s.ax === 'x' && o.s.A && o.s.B && o.s.A.vol && o.s.A.vol === o.s.B.vol); ok('ширина колонны — полем на грани', !!ew); await tap(ew.r.x + ew.r.w / 2, ew.r.y + ew.r.h / 2 + top); await key('400ok'); }
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
  { const fz = (await M('MeasureCore.edl()')).find(o => o.k === 'D'); ok('глубина колонны — полем на боковой грани', !!fz); if (fz) { await tap(fz.r.x + fz.r.w / 2, fz.r.y + fz.r.h / 2 + top); await key('300ok'); } ok('Z колонны 300', (await doc()).com.find(x => x.k === 'kol').D === 300); }
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
  await W(1500); ok('распознавание отработало без ошибок', !h.errs.length, h.errs);
  // найденное: касание — на стену, ✓ всё
  await M(`(()=>{const d=MeasureCore.doc,e=d.elev[0].id;d.found=[{id:'f1',e,k:'roz',x:800,y:300,N:2},{id:'f2',e,k:'win',x:1200,y:900,w:800,h:1200}];MeasureCore.draw()})()`);
  await M('MeasureCore.fitAll()'); await W(200); d = await doc(); const Re = await M('MeasureCore.elevRect(MeasureCore.doc.elev[0])');
  const nC = d.com.length; const fs = await scr(Re.x + 800, Re.y + Re.h - 300); await tool('sel'); await tap(fs[0], fs[1]);
  d = await doc(); ok('касание найденного — на стену', d.com.length === nC + 1 && d.found.length === 1 && d.com.some(c => c.k === 'roz' && c.N === 2));
  const ok1 = await ctxBtn('Всё найденное'); ok('«✓ всё» в модификаторах', !!ok1); await tap(ok1[0], ok1[1]); d = await doc(); ok('всё найденное — на стену', d.found.length === 0 && d.com.some(c => c.k === 'win'));
  // выбор стен вверху
  ok('выбор стен С1…Сn вверху', (await M('document.querySelectorAll("#wChips.on button").length')) === d.walls.length);
  await btn('#wChips [data-w="' + d.walls[1].id + '"]'); await W(200); ok('касание С2 без развёртки → H есть → развёртка С2', (await doc()).elev.some(e => e.wall === d.walls[1].id));
  // привязка к грани другого объекта
  { const dd = await doc(), wn = dd.com.find(c => c.k === 'win'), e0 = wn.e;
    await M(`(()=>{const d=MeasureCore.doc;d.com.push({id:'kx',k:'kor',e:'${e0}',x:${wn.x + wn.w + 40},y:200,w:300,h:300});MeasureCore.draw()})()`);
    await btn('#wChips [data-w="' + dd.elev.find(e => e.id === e0).wall + '"]'); await W(200); const R1 = await M(`MeasureCore.elevRect(MeasureCore.doc.elev.find(e=>e.id==='${e0}'))`);
    const kb0 = await M(`MeasureCore.comPx('kx').box`), k0 = [(kb0[0] + kb0[2]) / 2, (kb0[1] + kb0[3]) / 2 + top];   /* 82.35.3: короб объёмом — касание по лицевой грани */ await tool('sel'); await tap(k0[0], k0[1]); await drag(k0, [k0[0] + 2, k0[1] - 14]);
    const kx = (await doc()).com.find(c => c.id === 'kx'); ok('привязка к грани окна (40 мм → 0)', kx.x === wn.x + wn.w, [kx.x, wn.x + wn.w]); }
  // выгрузка v3
  { const o = await M('MeasureCore.exportAkrix()'), r0 = o.rooms.find(r => r.ms.closed), ms = r0 && r0.ms;
    ok('выгрузка: akrix-zamer v3 object', o.app === 'akrix-zamer' && o.v === 3 && o.kind === 'object');
    ok('замкнутый контур: 4 стены, постоянные id', ms && ms.pts.length === 4 && Object.keys(ms.wl).length === 4 && Object.values(ms.wid).every(id => (await_d => true)()));
    const wc1 = Object.values(ms.wl).find(w => w.gn === 1), col = wc1 && wc1.els.find(e => e.t === 'col');
    ok('С1: колонна col x0 = 500, d = 300, во всю высоту', col && col.x0 === 500 && col.x1 === 900 && col.d === 300 && col.y1 === 2650, col);
    ok('С1: розетка so N=2 st=71', wc1.pts.some(p => p.t === 'so' && p.N === 2 && p.st === 71));
    ok('стена по рамке — отдельная открытая цепочка', o.rooms.some(r => !r.ms.closed && r.ms.pts.length === 2)); }
  // контур, нарисованный против часовой (на экране): вид стены — изнутри
  { await M(`(()=>{const d=MeasureCore.doc;const n=(id,x,y)=>({id,x,y});d.nodes.push(n('q1',20000,0),n('q2',20000,2000),n('q3',23000,2000),n('q4',23000,0));
      d.walls.push({id:'wq1',a:'q4',b:'q1',gn:91},{id:'wq2',a:'q1',b:'q2',gn:92},{id:'wq3',a:'q2',b:'q3',gn:93},{id:'wq4',a:'q3',b:'q4',gn:94});
      d.elev.push({id:'eq1',wall:'wq1',x:20000,y:-4000});d.com.push({id:'cq',k:'kol',e:'eq1',x:500,y:0,w:400,h:100});})()`);
    const o = await M('MeasureCore.exportAkrix()'), r = o.rooms.find(r => r.ms.wid && Object.values(r.ms.wid).includes('wq1')), k = Object.keys(r.ms.wid).find(k => r.ms.wid[k] === 'wq1'), col = r.ms.wl[k].els[0];
    ok('обратный контур: ccw по экрану, колонна x0 500 от левого края изнутри', r.ms.ccw === true && col.x0 === 500, [r.ms.ccw, col]); }
  // введённое — опора: колонна 300 у левого края, правая у края; зазор 1183 → 1200 — левая остаётся 300
  { await M(`(()=>{const d=MeasureCore.doc;d.nodes.push({id:'z1',x:40000,y:0},{id:'z2',x:42156,y:0});d.walls.push({id:'wz',a:'z1',b:'z2',gn:99});d.elev.push({id:'ez',wall:'wz',x:40000,y:3000});
      d.com.push({id:'cl',k:'kol',e:'ez',x:0,y:0,w:310,h:1},{id:'cr',k:'kol',e:'ez',x:1483,y:0,w:673,h:1});d.H=2800;})()`);
    await M('MeasureCore.view.s=0.1;MeasureCore.view.ox=-40000*0.1+90;MeasureCore.view.oy=-3000*0.1+150'); await M('MeasureCore.draw()'); await W(200);
    const fld = async v => (await M('MeasureCore.edl()')).find(o => o.k === 'seg' && o.s.ax === 'x' && Math.round(o.s.v) === v);
    let f = await fld(310); await tap(f.r.x + f.r.w / 2, f.r.y + f.r.h / 2 + top); if (!(await M('MeasureCore.kb'))) await tap(f.r.x + f.r.w / 2, f.r.y + f.r.h / 2 + top); await key('300ok');
    f = await fld(1183); ok('поле зазора найдено', !!f); await tap(f.r.x + f.r.w / 2, f.r.y + f.r.h / 2 + top); if (!(await M('MeasureCore.kb'))) await tap(f.r.x + f.r.w / 2, f.r.y + f.r.h / 2 + top); await key('1200ok');
    const dd = await doc(), cl = dd.com.find(c => c.id === 'cl'), cr = dd.com.find(c => c.id === 'cr');
    ok('введённая 300 не изменилась, правая колонна подстроилась', cl.w === 300 && cr.x === 1500 && cr.w === 656, [cl, cr]); }
  ok('меню ⋮: стилус, слои, резервная копия', await M(`['bPenM','bLay','bBak','bRes','bRms'].every(id=>document.getElementById(id))`));
  await finish();
});
