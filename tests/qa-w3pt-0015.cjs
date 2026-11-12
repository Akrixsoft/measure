// AKX-2026-0015 · 82.35.4 — 4 угла v81: плоскости, окно «Угол» (X, Y, Z, угольник), выгрузка angs. node tests/qa-w3pt-0015.cjs <скриншоты>
require('./qa-h-0015.cjs')(process.argv[2], 9362).then(async h => { const {M, W, shot, finish, tap, ok, doc, key} = h;
  await M(`(() => { const D = MeasureCore.doc; D.H = 2700;
    D.nodes.push({id:'n1',x:0,y:0},{id:'n2',x:3000,y:0},{id:'n3',x:3000,y:2000},{id:'n4',x:0,y:2000});
    D.walls.push({id:'w1',a:'n1',b:'n2',gn:1},{id:'w2',a:'n2',b:'n3',gn:2},{id:'w3',a:'n3',b:'n4',gn:3},{id:'w4',a:'n4',b:'n1',gn:4});
    D.elev.push({id:'e1',wall:'w1',x:0,y:-4200});
    D.com.push({id:'c4',k:'kol',e:'e1',x:1400,y:0,w:300,h:2700});
    MeasureCore.fitAll(); MeasureCore.draw(); })()`); await W(300);
  await shot('M');
  const t = await M('document.getElementById("cCv").getBoundingClientRect().top');
  const pts = await M('MeasureCore.w3px()'); const A = pts.find(o => o.k === 'A'); await tap(A.x, A.y + t); await W(200);
  ok('угол A выбран', JSON.stringify(await M('MeasureCore.sel')).includes('"k":"A"'));
  ok('окно «Угол» видно', await M(`document.getElementById('w3x').classList.contains('on')`), await M(`document.getElementById('w3x').innerText`));
  await shot('A-sel');
  // Z = 30 у A
  await h.btn('#w3x [data-ax=z]'); await key('30ok'); ok('Z A = 30 → отклонение', JSON.stringify((await doc()).elev[0].w3d) === '{"A":[0,0,30]}', (await doc()).elev[0].w3d);
  // зазор
  await h.btn('#w3x [data-ax=mm]'); await key('20ok'); const n = (await doc()).nodes; ok('угол по угольнику в узел', n.some(q => q.ang && q.ang.u && q.ang.u.mm === 20), n.map(q => q.ang));
  await shot('A-edit');
  for (const p of ['L', 'floor', 'obj']) { await h.btn(`#w3pl [data-p=${p}]`); await W(250); await shot('pl-' + p); }
  await h.btn('#w3pl [data-p=obj]'); await W(250); await shot('pl-obj2');
  const ex = await M('MeasureCore.exportAkrix()'); ok('выгрузка angs', JSON.stringify(ex).includes('"angs":{"'), JSON.stringify(ex).match(/"angs":\{[^}]*\}*/));
  await finish(); });
