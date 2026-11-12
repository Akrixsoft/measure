// AKX-2026-0015 · 82.35.10 — каждая грань — свой размер (углы с отклонениями). node tests/qa-edge-0015.cjs <скриншоты>
require('./qa-h-0015.cjs')(process.argv[2], 9367).then(async h => { const {M, W, shot, finish, ok, doc, key, tap} = h;
  await M(`(() => { const D = MeasureCore.doc;
    D.nodes.push({id:'n1',x:0,y:0},{id:'n2',x:2000,y:0},{id:'n3',x:2000,y:2000},{id:'n4',x:0,y:2000});
    D.walls.push({id:'w1',a:'n1',b:'n2',gn:1},{id:'w2',a:'n2',b:'n3',gn:2},{id:'w4',a:'n4',b:'n1',gn:4});
    D.elev.push({id:'e1',wall:'w1',x:0,y:2600}); D.elev[0].w3d = {B: [0, 96, 0]};
    MeasureCore.fitAll(); { const V = MeasureCore.view, r = MeasureCore.elevRect(D.elev[0]); if (V.s < 0.13) { V.s = 0.13; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 420 - (r.y + r.h / 2) * V.s; } }   /* 82.35.14: на обзоре проекта поля скрыты */
    MeasureCore.draw(); })()`); await W(300);
  const E = await M('MeasureCore.edl().map(o => ({k: o.k, r: o.r}))'); console.log(JSON.stringify(E.map(o => o.k)));
  await shot('dev');
  const t = await M('document.getElementById("cCv").getBoundingClientRect().top'), fr = (await M('MeasureCore.edl()')).filter(o => o.k === 'eE').sort((a, b) => b.r.x - a.r.x)[0];
  await tap(fr.r.x + fr.r.w / 2, fr.r.y + fr.r.h / 2 + t); await W(150); await key('2800ok');
  ok('правая грань 2800', JSON.stringify((await doc()).elev[0].w3d) === '{"B":[0,100,0]}', JSON.stringify((await doc()).elev[0].w3d));
  await shot('dev2');
  await finish(); });
