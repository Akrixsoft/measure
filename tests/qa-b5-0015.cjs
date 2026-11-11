// AKX-2026-0015 Б5 — проёмы и элементы на развёртке, фасон; план: контур касаниями, проём. Запуск: node tests/qa-b5-0015.cjs - <скриншоты>
require('./qa-h-0015.cjs')(process.argv[3], 9355).then(async h => {
  const {p, ok, W, tap, drag, M, btn, key, ctxBtn, doc, scr, shot, tool, finish} = h;
  const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  // контур 4 касаниями + замыкание
  await btn('#mdT [data-md=plan]'); await tool('ct'); ok('инструмент «контур»', (await M('MeasureCore.tool')) === 'ct');
  for (const [x, y] of [[80, 200], [300, 202], [302, 420], [82, 418], [81, 201]]) await tap(x, y);
  let d = await doc(); ok('контур: 4 стены, замкнут (4 узла)', d.walls.length === 4 && d.nodes.length === 4, [d.walls.length, d.nodes.length]);
  ok('углы 0/90°', d.walls.every(w => { const a = d.nodes.find(n => n.id === w.a), b = d.nodes.find(n => n.id === w.b); return a.x === b.x || a.y === b.y; }));
  // проём двумя касаниями
  const w1 = d.walls[0], a = d.nodes.find(n => n.id === w1.a), b = d.nodes.find(n => n.id === w1.b);
  await tool('op'); const s1 = await scr(a.x + (b.x - a.x) * 0.3, a.y + (b.y - a.y) * 0.3), s2 = await scr(a.x + (b.x - a.x) * 0.6, a.y + (b.y - a.y) * 0.6); await tap(s1[0], s1[1]); await tap(s2[0], s2[1]);
  d = await doc(); ok('проём на стене', d.ops.length === 1 && d.ops[0].wall === w1.id && Math.abs(d.ops[0].s1 - d.ops[0].s0 - 0.3) < 0.03, d.ops[0]);
  await shot('plan');
  // правка длины — проём следует (доли)
  const lb = (await M('MeasureCore.labels()')).find(l => l.id === w1.id); await tap(lb.x + lb.w / 2, lb.y + lb.h / 2 + top); await key('3000ok');
  ok('L стены 3000, проём 900', Math.abs((await doc()).ops[0].s1 - (await doc()).ops[0].s0) * 3000 > 800);
  // развёртка стены 1
  await tool('sel'); { const dd = await doc(), ww = dd.walls[0], A = dd.nodes.find(n => n.id === ww.a), B = dd.nodes.find(n => n.id === ww.b), sm = await scr(A.x + (B.x - A.x) * 0.85, A.y + (B.y - A.y) * 0.85); await tap(sm[0], sm[1]); }
  const eb = await ctxBtn('на холст'); ok('стена выбрана → «на холст»', !!eb); await tap(eb[0], eb[1]); await key('2700ok'); await W(200);
  await btn('#mdT [data-md=wall]'); await M('MeasureCore.fitAll()'); await W(200);
  d = await doc(); const er = await M(`MeasureCore.elevRect(MeasureCore.doc.elev[0])`), at = (x, y) => scr(er.x + x, er.y + er.h - y);
  ok('развёртка 3000 × 2700', er.w === 3000 && er.h === 2700);
  // элементы протяжкой
  for (const [k, x0, y0, x1, y1] of [['win', 300, 900, 1200, 2100], ['door', 1500, 0, 2300, 2000], ['kor', 2500, 2400, 2950, 2700]]) { await tool(k); await drag(await at(x0, y1), await at(x1, y0)); }
  d = await doc(); ok('окно, дверь, короб', ['win', 'door', 'kor'].every(k => d.com.some(c => c.k === k)));
  const dr = d.com.find(c => c.k === 'door'); ok('дверь от пола (магнит к полу)', dr.y === 0, dr);
  const kr = d.com.find(c => c.k === 'kor'); ok('короб к потолку (магнит)', kr.y + kr.h === 2700, kr);
  // ниша — Z со знаком
  await tool('nis'); await drag(await at(400, 600), await at(1000, 200)); const zb = await ctxBtn('Z — глубина'); await tap(zb[0], zb[1]); await key('200pmok');
  d = await doc(); ok('ниша Z −200', d.com.find(c => c.k === 'nis').D === -200);
  for (const [k, x] of [['kol', 2500], ['rig', 2800], ['znt', 2500], ['znf', 2800]]) { await M('AkrixBack()'); await tool(k); const s = await at(x, k[2] === 't' || k === 'znf' ? 400 : 1200); await tap(s[0], s[1]); }
  d = await doc(); ok('колонна, ригель, техника, фартук — касанием', ['kol', 'rig', 'znt', 'znf'].every(k => d.com.some(c => c.k === k)));
  // фасон — касания и замыкание
  await tool('poly'); for (const [x, y] of [[1300, 2200], [1900, 2200], [1900, 2500], [1500, 2400], [1300, 2200]]) { const s = await at(x, y); await tap(s[0], s[1]); }
  d = await doc(); const pg = d.com.find(c => c.k === 'poly'); ok('фасон — 4 точки, замкнут касанием первой', pg && pg.pts.length === 4, pg);
  await shot('elements');
  // размер от края стены до окна — по геометрии
  await tool('dim'); const wn = d.com.find(c => c.k === 'win'); await drag(await at(0, 0), await at(wn.x, wn.y));
  const v = await M('MeasureCore.dimVal(MeasureCore.doc.dims.slice(-1)[0])'); ok('размер до угла окна — по геометрии', v.kind === 'geo', v);
  // выбрать проём на плане и удалить, ↶
  await btn('#mdT [data-md=plan]'); await tool('sel'); await M('MeasureCore.fitAll()'); await W(150); d = await doc();
  const o = d.ops[0], ww = d.walls.find(x => x.id === o.wall), na = d.nodes.find(n => n.id === ww.a), nb = d.nodes.find(n => n.id === ww.b), t = (o.s0 + o.s1) / 2;
  const so = await scr(na.x + (nb.x - na.x) * t, na.y + (nb.y - na.y) * t); await tap(so[0], so[1]); ok('касание проёма — выбран', (await M('MeasureCore.sel && MeasureCore.sel.t')) === 'op');
  await btn('#bDelS'); ok('🗑 проём', (await doc()).ops.length === 0); await btn('#bUnd'); ok('↶ проём вернулся', (await doc()).ops.length === 1);
  await M('MeasureCore.save()'); await p.reload(); await p.waitForFunction('window.MeasureCore && MeasureCore.ready');
  d = await doc(); ok('перезапуск: план, проём, элементы', d.walls.length === 4 && d.ops.length === 1 && d.com.length >= 9);
  await finish();
});
