// AKX-2026-0015 · 82.35.6 — развёртки по номерам от плана, вкл / выкл развёртки стены, план ⇄ развёртка. node tests/qa-vw-0015.cjs <скриншоты>
require('./qa-h-0015.cjs')(process.argv[2], 9365).then(async h => { const {M, W, ok, doc, tap, shot, finish, tool, btn} = h;
  await tool('ct'); for (const [x, y] of [[60, 220], [330, 220], [330, 420], [60, 420], [60, 220]]) await tap(x, y); await W(200);
  let d = await doc(); ok('4 стены — 4 развёртки', d.walls.length === 4 && d.elev.length === 4);
  const ord = () => doc().then(d => d.elev.slice().sort((a, b) => a.y - b.y).map(e => d.walls.find(w => w.id === e.wall).gn).join());
  ok('развёртки от плана вниз по номерам', (await ord()) === '1,2,3,4', await ord());
  const maxNy = Math.max(...d.nodes.map(n => n.y)); ok('первая — ниже плана', Math.min(...d.elev.map(e => e.y)) > maxNy, [maxNy, d.elev.map(e => e.y)]);
  // фото в ряду С3 — едет вместе с рядом
  const e3 = d.elev.find(e => d.walls.find(w => w.id === e.wall).gn === 3);
  await M(`(() => { MeasureCore.doc.photos.push({id: 'pz', img: 'none', x: ${e3.x} + 4000, y: ${e3.y} + 200, w: 1000, iw: 1000, ih: 800, cr: [0, 0, 1, 1]}); })()`);
  await tool('sel'); await M('MeasureCore.fitAll()'); await W(200);
  const w2 = d.walls.find(w => w.gn === 2), a = d.nodes.find(n => n.id === w2.a), b = d.nodes.find(n => n.id === w2.b);
  const t = await M('document.getElementById("cCv").getBoundingClientRect().top'), s = await M(`MeasureCore.toS(${(a.x + b.x) / 2}, ${(a.y + b.y) * 0.5 + (b.y - a.y) * 0.2})`); await M(`(() => { MeasureCore.sel = {t: 'wall', id: '${w2.id}'}; })()`); await W(200);
  ok('С2 выбрана на плане', JSON.stringify(await M('MeasureCore.sel')).includes(w2.id));
  await btn('#vwOff'); await W(200); d = await doc();
  ok('С2 — развёртка выключена', d.walls.find(w => w.gn === 2).off === 1);
  ok('ряды: 1,3,4 (С2 пропущена)', (await ord()) !== '' && d.elev.filter(e => !d.walls.find(w => w.id === e.wall).off).sort((a, b) => a.y - b.y).map(e => d.walls.find(w => w.id === e.wall).gn).join() === '1,3,4');
  const e3b = d.elev.find(e => e.id === e3.id), pz = d.photos.find(p => p.id === 'pz'); ok('фото ряда С3 поднялось вместе с ним', Math.abs((pz.y - e3b.y) - 200) < 1, [pz.y, e3b.y]);
  ok('С2 нет во вкладках', !(await M(`[...document.querySelectorAll('#wChips button')].some(b => b.textContent === 'С2')`)));
  await shot('plan-c2-off');
  await btn('#vwOff'); d = await doc(); ok('повторно — С2 снова в работе', !d.walls.find(w => w.gn === 2).off && (await ord()) === '1,2,3,4');
  // план ⇄ развёртка
  const w1 = d.walls.find(w => w.gn === 1); await M(`(() => { MeasureCore.sel = {t: 'wall', id: '${w1.id}'}; })()`);
  await btn('#vwGo'); await W(200); const sel1 = await M('MeasureCore.sel'); ok('кнопка 1: к развёртке С1', sel1 && sel1.t === 'elev');
  await shot('elev-c1');
  await btn('#vwGo'); await W(200); const sel2 = await M('MeasureCore.sel'); ok('кнопка 1 ещё раз: к С1 на плане', sel2 && sel2.t === 'wall' && sel2.id === w1.id);
  await finish(); });
