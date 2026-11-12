// AKX-2026-0015 · 82.35.14: сцена как С7 владельца — ригель 300×200 во всю стену у потолка + короб 389×2400×200 справа под ригелем.
// Проверки: размеры объёмов — только на лицевых рёбрах (нет дублей на линии стены), поле — по центру своего ребра, масштаб с холстом, невведённое — «?».
require('./qa-h-0015.cjs')(process.argv[3], 9358).then(async h => {
  const {ok, W, tap, drag, M, btn, key, doc, scr, shot, tool, finish} = h;
  const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y);
  let d = await doc(); const w1 = d.walls[0];
  await M(`(() => { const D = MeasureCore.doc, w = D.walls.find(w => w.id === '${w1.id}'); w.H = 2700; const k = D.elev.find(e => e.wall === w.id); D.elev = [k];
    const nA = D.nodes.find(n => n.id === w.a), nB = D.nodes.find(n => n.id === w.b), L = Math.hypot(nB.x - nA.x, nB.y - nA.y), f = 1506 / L; nB.x = nA.x + (nB.x - nA.x) * f; nB.y = nA.y + (nB.y - nA.y) * f; w.fx = 1;
    const R = MeasureCore.elevRect(k), Wd = Math.round(R.w);
    D.com.push({id: 'crig', k: 'rig', e: k.id, x: 0, y: 2400, w: Wd, h: 300, D: 200, fwy: 1});
    D.com.push({id: 'ckor', k: 'kor', e: k.id, x: Wd - 389, y: 0, w: 389, h: 2400, D: 200});
    MeasureCore.draw(); })()`);
  const fitWall = async s => { await M(`(() => { const D = MeasureCore.doc, r = MeasureCore.elevRect(D.elev[0]), V = MeasureCore.view; V.s = ${s}; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 400 - (r.y + r.h / 2) * V.s; MeasureCore.draw(); })()`); await W(200); };
  await fitWall(0.15); await shot('c7-close');
  const fl = await M(`(() => { const o = MeasureCore.edl(); return o.map(q => ({k: q.k, v: q.s ? Math.round(q.s.v) : null, ax: q.s ? q.s.ax : null, r: q.r})); })()`);
  const sy = fl.filter(o => o.k === 'seg' && o.ax === 'y'), mid = await M('(() => { const r = MeasureCore.elevRect(MeasureCore.doc.elev[0]); return MeasureCore.toS(r.x + r.w / 2, 0)[0]; })()');
  ok('на линии стены: слева 2400 (пол → ригель), справа у короба и 300 ригеля — нет', sy.length === 1 && sy[0].v === 2400 && sy[0].r.x < mid, sy.map(o => [o.v, Math.round(o.r.x)]));
  ok('высота ригеля и короба — на 2 лицевых рёбрах каждого (cH × 4)', fl.filter(o => o.k === 'cH').length === 4, fl.map(o => o.k));
  ok('глубина — на боковых рёбрах (D ≥ 2)', fl.filter(o => o.k === 'D').length >= 2);
  const sz0 = fl.find(o => o.k === 'cH').r; await fitWall(0.07); const fl2 = await M('MeasureCore.edl().map(o => ({k: o.k, r: o.r}))'); const sz1 = fl2.find(o => o.k === 'cH').r;
  ok('отдаление ×0,47 → поле меньше (масштаб с холстом)', sz1.h < sz0.h * 0.6 && sz1.h > sz0.h * 0.35, [sz0.h, sz1.h]); await shot('c7-far');
  await fitWall(0.02); ok('далеко — поля скрыты', (await M('MeasureCore.edl().filter(o => o.r.w > 0).length')) === 0); await shot('c7-very-far');
  await finish();
});
