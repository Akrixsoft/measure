// AKX-2026-0015 · 82.35.22: значки точек — в своих габаритах (71 / 60 мм) на любом масштабе, стоят на местах постов.
require('./qa-h-0015.cjs')(process.argv[3], 9374).then(async h => {
  const {ok, W, tap, M, doc, tool, shot, finish} = h;
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y);
  const w1 = (await doc()).walls[0];
  const R = await M(`(() => { const D = MeasureCore.doc, k = D.elev.find(e => e.wall === '${w1.id}'); D.elev = [k];
    D.com.push({id: 'p1', k: 'roz', e: k.id, x: 300, y: 300, N: 3}, {id: 'p2', k: 'roz', e: k.id, x: 300, y: 600, N: 3, o: 'v'}); MeasureCore.sel = null; return MeasureCore.elevRect(k); })()`);
  const fit = async s => { await M(`(() => { const V = MeasureCore.view, r = ${JSON.stringify(R)}; V.s = ${s}; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 400 - (r.y + r.h / 2) * V.s; MeasureCore.draw(); })()`); await W(150); };
  for (const s of [0.05, 0.12, 0.4]) { await fit(s); await shot('pts-' + s);
    const g = await M(`(() => { const c = MeasureCore.doc.com.find(q => q.id === 'p1'), r = ${JSON.stringify(R)}, a = MeasureCore.toS(r.x + c.x, r.y + r.h - c.y), b = MeasureCore.toS(r.x + c.x + 142, r.y + r.h - c.y); return {span: Math.round(b[0] - a[0]), s: MeasureCore.view.s}; })()`);
    ok('масштаб ' + s + ': 3 поста = 142 мм между крайними центрами → ' + Math.round(142 * s) + ' px', Math.abs(g.span - 142 * s) <= 1, g); }
  await finish();
});
