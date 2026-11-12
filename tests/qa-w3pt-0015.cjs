// AKX-2026-0015 · 82.35.4 — 4 угла v81: плоскости, окно «Угол» (X, Y, Z, угольник), выгрузка angs. node tests/qa-w3pt-0015.cjs <скриншоты>
require('./qa-h-0015.cjs')(process.argv[2], 9362).then(async h => { const {M, W, shot, finish, tap, ok, doc, key} = h;
  await M(`(() => { const D = MeasureCore.doc; D.H = 2700;
    D.nodes.push({id:'n1',x:0,y:0},{id:'n2',x:3000,y:0},{id:'n3',x:3000,y:2000},{id:'n4',x:0,y:2000});
    D.walls.push({id:'w1',a:'n1',b:'n2',gn:1},{id:'w2',a:'n2',b:'n3',gn:2},{id:'w3',a:'n3',b:'n4',gn:3},{id:'w4',a:'n4',b:'n1',gn:4});
    D.elev.push({id:'e1',wall:'w1',x:0,y:-4200});
    D.com.push({id:'c4',k:'kol',e:'e1',x:1400,y:0,w:300,h:2700});
    MeasureCore.fitAll(); MeasureCore.draw(); })()`); await W(300);
  await h.tool('pts'); await M('MeasureCore.fitAll()'); await W(200);
  ok('4 угла: без выбранной плоскости маркеров нет', (await M('MeasureCore.w3px()')).length === 0);
  { const t0 = await M('document.getElementById("cCv").getBoundingClientRect().top'), R = await M(`MeasureCore.elevRect(MeasureCore.doc.elev[0])`), c = await M(`MeasureCore.toS(${R.x} + 400, ${R.y} + 600)`); await tap(c[0], c[1] + t0); await W(200); }
  ok('касание стены — плоскость выбрана, 4 маркера', (await M('MeasureCore.w3px()')).map(o => o.k).sort().join() === 'A,B,C,D', await M('MeasureCore.w3px()'));
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
  // высота стены: слева третьим рядом
  await h.tool('sel'); await W(200); { const t0 = await M('document.getElementById("cCv").getBoundingClientRect().top'), R = await M(`MeasureCore.elevRect(MeasureCore.doc.elev[0])`), c = await M(`MeasureCore.toS(${R.x} + 400, ${R.y} + 600)`); await tap(c[0], c[1] + t0); await W(200); }
  ok('выбрана стена — поле H слева', await M(`document.getElementById('wHf').classList.contains('on')`), await M(`document.getElementById('wHf').innerText`));
  await h.btn('#wHf button'); await key('2500ok'); ok('H стены 2500', (await doc()).walls[0].H === 2500 && (await M(`MeasureCore.elevRect(MeasureCore.doc.elev[0]).h`)) === 2500);
  await shot('wall-H');
  const ex = await M('MeasureCore.exportAkrix()'); ok('выгрузка angs', JSON.stringify(ex).includes('"angs":{"'), JSON.stringify(ex).match(/"angs":\{[^}]*\}*/));
  await finish(); });
