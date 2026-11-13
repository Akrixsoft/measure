// AKX-2026-0015 · 82.35.20: размер от точки коммуникации — по направлению взмаха до ближайшей грани (край стены / грань объекта).
require('./qa-h-0015.cjs')(process.argv[3], 9372).then(async h => {
  const {ok, W, tap, drag, M, doc, tool, shot, finish} = h; const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y);
  let d = await doc(); const w1 = d.walls[0];
  const ek = await M(`(() => { const D = MeasureCore.doc, k = D.elev.find(e => e.wall === '${w1.id}'); D.elev = [k]; const R0 = MeasureCore.elevRect(k), W0 = Math.round(R0.w);
    D.com.push({id: 'kx', k: 'kor', e: k.id, x: W0 - 600, y: 0, w: 600, h: 2000, D: 400}); D.com.push({id: 'p1', k: 'roz', e: k.id, x: 1000, y: 1200});
    const r = MeasureCore.elevRect(k), V = MeasureCore.view; V.s = 0.13; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 420 - (r.y + r.h / 2) * V.s; MeasureCore.sel = null; MeasureCore.draw(); return {id: k.id, W: W0, R: r}; })()`); await W(200);
  const S = async (x, y) => { const p = await M(`MeasureCore.toS(${ek.R.x + x}, ${ek.R.y + ek.R.h - y})`); return [p[0], p[1] + top]; };
  await tool('dim'); const P = await S(1000, 1200); const n0 = (await doc()).dims.length;
  const last = async () => { const dd = (await doc()).dims; return dd.length > n0 ? dd[dd.length - 1] : null; };
  const endW = async e => M(`(() => { const p = MeasureCore.endPos(${JSON.stringify(e)}); const r = MeasureCore.elevRect(MeasureCore.doc.elev[0]); return {x: Math.round(p.x - r.x), y: Math.round(r.y + r.h - p.y)}; })()`);
  await drag(P, await S(650, 1200)); let dm = await last(); let b = dm && await endW(dm.b);
  ok('взмах влево (на треть) → до левого края стены, x = 0, по горизонтали', dm && b.x === 0 && b.y === 1200, [dm && dm.a, dm && dm.b, b, await M('MeasureCore.tool')]);
  await drag(P, await S(1000, 800)); dm = (await doc()).dims.slice(-1)[0]; b = await endW(dm.b);
  ok('взмах вниз → до пола, y = 0', b.y === 0 && b.x === 1000, b);
  await drag(P, await S(1400, 1200)); dm = (await doc()).dims.slice(-1)[0]; b = await endW(dm.b);
  ok('взмах вправо → до грани короба', b.x === ek.W - 600 && b.y === 1200, [b, ek.W - 600]);
  await drag(P, await S(1000, 1600)); dm = (await doc()).dims.slice(-1)[0]; b = await endW(dm.b);
  ok('взмах вверх → до потолка', b.y === Math.round(ek.R.h) && b.x === 1000, [b, ek.R.h]);
  // 82.35.20: модификаторы — размером как кнопки нижних рядов; посты — одна кнопка «N ▾» со списком
  await tool('sel'); await M("MeasureCore.sel = {t: 'com', id: 'p1'}; MeasureCore.ui && MeasureCore.ui()"); await W(200);
  const mb = await M(`(() => { const z = document.getElementById('zMods'), bs = [...z.querySelectorAll('button')], ch = document.querySelector('#ch .pb'); return {h: bs.map(b => Math.round(b.getBoundingClientRect().height)), ref: ch ? Math.round(ch.getBoundingClientRect().height) : null, t: bs.map(b => b.textContent.trim()), right: Math.round(Math.max(...bs.map(b => b.getBoundingClientRect().right))), vw: innerWidth}; })()`);
  ok('кнопки третьего ряда — высотой как нижние (28)', mb.h.length && mb.h.every(x => x === mb.ref), mb);
  ok('посты — одна кнопка «1 ▾», ряд влезает в экран', mb.t.filter(t => /^\d ▾$/.test(t)).length === 1 && !mb.t.some(t => /^[2-5]$/.test(t)) && mb.right <= mb.vw, mb.t);
  await shot('mods');
  await h.btn('#zMods button:nth-child(' + (mb.t.findIndex(t => /^\d ▾$/.test(t)) + 1) + ')'); await W(200); await shot('posts'); { const g = await M(`(() => { const a = document.getElementById('ptN').getBoundingClientRect(), z = document.getElementById('zf').getBoundingClientRect(); return {b: Math.round(a.bottom), t: Math.round(a.top), zt: Math.round(z.top), H: innerHeight}; })()`); ok('окно «Количество постов» — снизу, над рядами кнопок', g.b <= g.zt && g.b >= g.zt - 12 && g.t > g.H / 3, g); }
  await h.btn('#ptN [data-pn="3"]'); await W(200);
  ok('выбор 3 из списка → 3 поста', (await doc()).com.find(c => c.id === 'p1').N === 3);
  await h.btn('#zMods button:nth-child(1)'); await W(200); await shot('kinds');
  { const g = await M(`(() => { const a = document.getElementById('ptK').getBoundingClientRect(), z = document.getElementById('zf').getBoundingClientRect(); return {on: document.getElementById('ptK').classList.contains('on'), b: Math.round(a.bottom), zt: Math.round(z.top)}; })()`); ok('окно «Вид точки» — снизу, над рядами кнопок', g.on && g.b <= g.zt && g.b >= g.zt - 12, g); }
  await finish();
});
