// AKX-2026-0015 Б4 — коммуникации на развёртке. Запуск: node tests/qa-b4-0015.cjs <фото> <скриншоты>
require('./qa-h-0015.cjs')(process.argv[3], 9354).then(async h => {
  const {p, ok, W, tap, drag, M, btn, key, ctxBtn, doc, scr, shot, tool, finish} = h;
  // стена плана и развёртка
  await btn('#mdT [data-md=plan]'); await tool('st'); await drag([90, 200], [300, 202]);
  let d = await doc(); ok('стена плана', d.walls.length === 1);
  const wl = await M('MeasureCore.labels()[0]'); await tap(wl.x + wl.w / 2, wl.y + wl.h / 2 + 48); await key('4000ok');
  await btn('#mdT [data-md=wall]'); await tool('sel'); const s0 = await scr(...(await M('(()=>{const d=MeasureCore.doc,a=d.nodes[0],b=d.nodes[1];return [(a.x+b.x)/2,a.y]})()'))); await tap(s0[0], s0[1]);
  const eb = await ctxBtn('на холст'); await tap(eb[0], eb[1]); await key('2700ok'); await W(200);
  d = await doc(); ok('развёртка 4000 × 2700', d.elev.length === 1 && d.H === 2700);
  await M('MeasureCore.fitAll()'); await W(200);
  const R = await M('MeasureCore.elevRect(MeasureCore.doc.elev[0])'), at = (x, y) => scr(R.x + x, R.y + R.h - y);
  // розетка — касание, посты
  await tool('roz'); let s = await at(800, 300); await tap(s[0], s[1]);
  d = await doc(); let c = d.com.slice(-1)[0]; ok('розетка поставлена касанием', c && c.k === 'roz' && Math.abs(c.x - 800) < 40 && Math.abs(c.y - 300) < 40, c);
  const p3 = await ctxBtn('3 — шаг'); ok('посты 1…5 в строке', !!p3); await tap(p3[0], p3[1]); d = await doc(); ok('3 поста', d.com[0].N === 3); { const P = await M(`MeasureCore.endPos({t:'com',id:'${d.com[0].id}',i:0})`), P2 = await M(`MeasureCore.endPos({t:'com',id:'${d.com[0].id}',i:2})`); ok('отсчёт от центра первого подрозетника, шаг 71', Math.abs(P2.x - P.x - 142) < 0.5 && Math.abs(P.x - R.x - d.com[0].x) < 0.5); }
  for (const [k, x, y] of [['vyk', 600, 900], ['svet', 2000, 2600], ['hvs', 3000, 500], ['wire', 1500, 1200]]) { await tool(k); s = await at(x, y); await tap(s[0], s[1]); }
  d = await doc(); ok('выключатель, свет, ХВС, провод', ['vyk', 'svet', 'hvs', 'wire'].every(k => d.com.some(c => c.k === k)));
  // не сверлить — касание; зона — протяжка
  await tool('znd'); s = await at(2500, 1500); await tap(s[0], s[1]); d = await doc(); c = d.com.slice(-1)[0]; ok('не сверлить — касание 300×300', c.k === 'znd' && c.w === 300 && c.h === 300);
  await tool('zon'); await drag(await at(200, 2000), await at(1200, 1500)); d = await doc(); c = d.com.slice(-1)[0]; ok('зона — протяжкой', c.k === 'zon' && Math.abs(c.w - 1000) < 40 && Math.abs(c.h - 500) < 40, c);
  // электрощит, Z
  await tool('shield'); await drag(await at(3000, 1900), await at(3500, 1300)); d = await doc(); c = d.com.slice(-1)[0]; ok('электрощит', c.k === 'shield');
  const zb = await ctxBtn('Z — глубина'); await tap(zb[0], zb[1]); await key('150pmok'); d = await doc(); ok('Z = −150 (ниша/вглубь со знаком)', d.com.slice(-1)[0].D === -150, d.com.slice(-1)[0].D);
  // отступ справа — держится при смене L
  const of = await M('(()=>{const L=document.getElementById("cCv");return null})()');
  await W(100); const ofR = await M(`(()=>{for(let y=0;y<800;y+=3)for(let x=0;x<412;x+=3){const h=MeasureCore.hit(x,y);if(h&&h.t==='cofl'&&h.side==='R')return [x,y]}return null})()`);
  ok('отступ → у выбранного', !!ofR); const top = await M('document.getElementById("cCv").getBoundingClientRect().top'); await tap(ofR[0], ofR[1] + top); await key('200ok');
  d = await doc(); c = d.com.slice(-1)[0]; ok('отступ справа 200, привязка к правому краю', c.ex === 'R' && c.xv === 200);
  await btn('#mdT [data-md=plan]'); const wl2 = await M('MeasureCore.labels()[0]'); await tap(wl2.x + wl2.w / 2, wl2.y + wl2.h / 2 + top); await key('4600ok'); await btn('#mdT [data-md=wall]');
  const rr = await M(`MeasureCore.cRect('${c.id}')`); ok('L 4600 — щит в 200 от правого края', Math.abs(rr.R.w - 4600) < 1 && Math.abs(rr.R.w - rr.x - rr.w - 200) < 1, rr);
  // трасса — протяжка, тип
  await M('MeasureCore.fitAll()'); await W(150); const R2 = await M('MeasureCore.elevRect(MeasureCore.doc.elev[0])'), at2 = (x, y) => scr(R2.x + x, R2.y + R2.h - y);
  await tool('wrt'); s = await at2(500, 150); const s2 = await at2(2500, 150); await drag(s, [s2[0], s2[1] + 3]);
  d = await doc(); c = d.com.slice(-1)[0]; ok('трасса 0°', c.k === 'wrt' && c.a[1] === c.b[1] && c.t === 'el', c);
  const tb = await ctxBtn('Тип трассы'); await tap(tb[0], tb[1]); d = await doc(); ok('тип трассы меняется (СС)', d.com.slice(-1)[0].t === 'lo');
  await shot('comms');
  // размер: от угла развёртки (пол) до поста розетки — по геометрии
  await tool('dim'); const roz = d.com[0], pA = await at2(0, 0), pB = await scr(R2.x + roz.x, R2.y + R2.h - roz.y);
  await drag(pA, pB); d = await doc(); const dm = d.dims.slice(-1)[0]; const val = await M(`MeasureCore.dimVal(MeasureCore.doc.dims.slice(-1)[0])`);
  ok('размер цепляется за пост розетки', dm && dm.b.t === 'com' && dm.b.id === roz.id && dm.b.i === 0, dm && dm.b); ok('значение — по геометрии', val.kind === 'geo', val);
  // перенос развёртки — объекты следуют
  await tool('sel'); const e0 = d.elev[0], mid = await at2(1800, 2300); await drag(mid, [mid[0], mid[1] - 60]);
  const e1 = (await doc()).elev[0], pw = await M(`(()=>{const c=MeasureCore.doc.com[0],e=MeasureCore.elevRect(MeasureCore.doc.elev[0]);return e.y})()`);
  ok('развёртка перенесена', e1.y !== e0.y); ok('объекты в мм стены не изменились', JSON.stringify((await doc()).com.map(c => [c.x, c.y])) === JSON.stringify(d.com.map(c => [c.x, c.y])));
  await btn('#bUnd');
  // угол зоны — тянуть
  const zn = d.com.find(c => c.k === 'zon'), zc = await at2(zn.x + zn.w / 2, zn.y + zn.h / 2); await tap(zc[0], zc[1]); ok('касание зоны — выбрана', (await M('MeasureCore.sel && MeasureCore.sel.id')) === zn.id);
  const g = await M(`MeasureCore.comPx('${zn.id}')`); await drag([g.box[2], g.box[3] + top], [g.box[2] + 20, g.box[3] + 20 + top]);
  d = await doc(); const zn2 = d.com.find(c => c.id === zn.id); ok('угол зоны тянется', zn2.w > zn.w + 50 && zn2.y < zn.y - 50, [zn, zn2]);
  // удалить и ↶
  const n0 = d.com.length; await btn('#bDelS'); ok('🗑 зона', (await doc()).com.length === n0 - 1); await btn('#bUnd'); ok('↶ вернулась', (await doc()).com.length === n0);
  await M('MeasureCore.save()'); await p.reload(); await p.waitForFunction('window.MeasureCore && MeasureCore.ready');
  d = await doc(); ok('перезапуск: объекты сохранены', d.com.length === n0 && d.com.find(c => c.k === 'shield').D === -150);
  await finish();
});
