// AKX-2026-0015 · 82.35.22: выделенный объект тянется за грань — меняется одна сторона; за угол — две.
require('./qa-h-0015.cjs')(process.argv[3], 9375).then(async h => {
  const {ok, W, tap, drag, M, doc, tool, finish} = h; const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y);
  const w1 = (await doc()).walls[0];
  const R = await M(`(() => { const D = MeasureCore.doc, k = D.elev.find(e => e.wall === '${w1.id}'); D.elev = [k]; D.com.push({id: 'kx', k: 'shield', e: k.id, x: 800, y: 900, w: 1000, h: 800});
    const r = MeasureCore.elevRect(k), V = MeasureCore.view; V.s = 0.14; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 420 - (r.y + r.h / 2) * V.s; MeasureCore.sel = {t: 'com', id: 'kx'}; MeasureCore.draw(); return r; })()`); await W(200);
  const S = async (x, y) => { const p = await M(`MeasureCore.toS(${R.x + x}, ${R.y + R.h - y})`); return [p[0], p[1] + top]; };
  const kx = async () => (await doc()).com.find(c => c.id === 'kx'); await tool('sel');
  let a = await S(1800, 1300); await drag(a, [a[0] + 28, a[1]]); let c = await kx();
  ok('правая грань → только ширина, x и высота на месте', c.x === 800 && c.y === 900 && c.h === 800 && c.w > 1100 && c.w < 1300, c);
  const w0 = c.w; a = await S(1300, 1700); await drag(a, [a[0], a[1] - 28]); c = await kx();
  ok('верхняя грань → только высота, низ и ширина на месте', c.y === 900 && c.x === 800 && c.w === w0 && c.h > 900 && c.h < 1100, c);
  const h0 = c.h; a = await S(800 + w0, 900); await drag(a, [a[0] + 20, a[1] + 20]); c = await kx();
  ok('угол → две стороны', c.w > w0 && c.h > h0, c);
  await finish();
});
