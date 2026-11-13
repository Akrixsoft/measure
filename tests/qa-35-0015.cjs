// AKX-2026-0015 · 82.35 — модификаторы точки, точка по введённому размеру, жёлтое выделение, цвет размера, поля v81, настройки. node tests/qa-35-0015.cjs <скриншоты>
require('./qa-h-0015.cjs')(process.argv[2], 9358).then(async h => {
  const {p, ok, W, tap, M, btn, key, doc, shot, finish} = h;
  await M(`(() => { const D = MeasureCore.doc; D.H = 2700;
    D.nodes.push({id:'n1',x:0,y:0},{id:'n2',x:3000,y:0},{id:'n3',x:3000,y:2000},{id:'n4',x:0,y:2000});
    D.walls.push({id:'w1',a:'n1',b:'n2',gn:1},{id:'w2',a:'n2',b:'n3',gn:2},{id:'w4',a:'n4',b:'n1',gn:4});
    D.elev.push({id:'e1',wall:'w1',x:0,y:-3200},{id:'e2',wall:'w2',x:3600,y:-3200},{id:'e4',wall:'w4',x:-2600,y:-3200});
    D.com.push({id:'c1',k:'roz',e:'e1',x:800,y:300,N:2},{id:'c2',k:'vyk',e:'e1',x:2200,y:900},{id:'c3',k:'roz',e:'e2',x:500,y:300},{id:'c4',k:'kol',e:'e1',x:1400,y:0,w:300,h:2700});
    D.dims.push({id:'d1',k:'dim',a:{t:'elev',id:'e1',u:0,v:1},b:{t:'com',id:'c1',i:0},v:''});
    MeasureCore.fitAll(); { const V = MeasureCore.view, r = MeasureCore.elevRect(D.elev.find(e => e.id === 'e1')); if (V.s < 0.14) { V.s = 0.14; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 420 - (r.y + r.h / 2) * V.s; } }   /* 82.35.14: на обзоре всего проекта поля скрыты — приблизить к С1 */
    MeasureCore.draw(); })()`); await W(300);
  await shot('setup');
  // точка по введённому размеру
  const A = await M(`MeasureCore.endPos({t:'elev',id:'e1',u:0,v:1})`), B0 = await M(`MeasureCore.endPos({t:'com',id:'c1',i:0})`);
  const L0 = Math.hypot(B0.x - A.x, B0.y - A.y);
  const dl = (await M('MeasureCore.dlabels()')).find(o => o.id === 'd1'); const t = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await tap(dl.x, dl.y + t); await W(200); await key('1000ok'); await W(300);
  await M('MeasureCore.fitAll(); MeasureCore.draw()'); await W(200);   /* 82.35.14: дальше — обзор как раньше */
  const B1 = await M(`MeasureCore.endPos({t:'com',id:'c1',i:0})`), L1 = Math.hypot(B1.x - A.x, B1.y - A.y);
  ok('точка встала на введённый размер 1000', Math.abs(L1 - 1000) < 1.5, {L0: Math.round(L0), L1: Math.round(L1)});
  ok('направление сохранено', Math.abs((B1.x - A.x) / L1 - (B0.x - A.x) / L0) < 0.01);
  // выбор точки: жёлтый, модификаторы
  await M(`(() => { const c = MeasureCore.doc.com.find(c => c.id === 'c1'); })()`);
  const pb = await M(`MeasureCore.comPx('c1').box`); await tap(200, 130 + t); await W(200); console.log('SEL0', JSON.stringify(await M('MeasureCore.sel')), t); await tap(pb[2] - 4, pb[1] + 4 + t); await W(300);
  console.log('DBG', pb, await M(`JSON.stringify([MeasureCore.sel, MeasureCore.kb, MeasureCore.hit ? MeasureCore.hit(${pb[2] - 4}, ${pb[1] + 4}) : 0])`));
  ok('точка выбрана', (await M('MeasureCore.sel && MeasureCore.sel.id')) === 'c1');
  const mods = await M(`[...document.querySelectorAll('#zMods button')].filter(b => b.offsetParent).map(b => b.textContent.trim())`);
  ok('модификаторы точки: вид ▾, ↔, +⏻, посты «N ▾» (82.35.20 — одна кнопка со списком)', ['розетка ▾', '↔', '+⏻'].every(s => mods.some(m => m.includes(s))) && mods.filter(m => /^[1-5] ▾$/.test(m)).length === 1, mods);
  await shot('point-selected-yellow');
  const cl = async s => { const b = await M(`(() => { const b = [...document.querySelectorAll('#zMods button')].find(b => b.offsetParent && b.textContent.includes(${JSON.stringify(s)})); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); if (b) await tap(b[0], b[1]); return !!b; };
  await cl('+⏻'); let c1 = (await doc()).com.find(c => c.id === 'c1'); ok('+⏻ → rv, постов +1', c1.k === 'rv' && c1.N === 3, c1);
  await cl('↔'); c1 = (await doc()).com.find(c => c.id === 'c1'); ok('↕ вертикально', c1.o === 'v');
  await shot('rv-vertical');
  const ex = await M('MeasureCore.exportAkrix()'); const wl = JSON.stringify(ex).match(/"t":"sw"/g); ok('выгрузка rv: розетки + выключатель', !!wl);
  await cl('▾'); await W(200); ok('лист «Вид точки»', await M(`document.getElementById('ptK').classList.contains('on')`));
  await M(`document.querySelector('#ptK [data-pk=hvs]').click()`); await W(100);
  { const bb = await M(`(() => { const b = document.querySelector('#ptK [data-pk=hvs]'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); await tap(bb[0], bb[1]); }
  c1 = (await doc()).com.find(c => c.id === 'c1'); ok('вид сменён на ХВС, посты сняты', c1.k === 'hvs' && !c1.N && !c1.o, c1);
  // настройки
  await btn('#bMore'); await W(150); const cf = await M(`(() => { const b = document.getElementById('bCfg'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); await tap(cf[0], cf[1]); await W(200);
  ok('⋮ → Настройки открыто', await M(`document.getElementById('cfgS').classList.contains('on')`));
  await shot('settings-view');
  await M(`(() => { const i = document.querySelector('#cfgS input[type=range][data-cf=textPx]'); i.value = 20; i.oninput(); })()`);
  ok('текст 20 сохранён', (await M(`JSON.parse(localStorage.getItem('akx-core-cfg')).textPx`)) === 20);
  await M(`document.querySelector('#cfgS [data-tab=c]').click()`); await W(100);
  { const b = await M(`(() => { const r = document.querySelector('#cfgS [data-tab=c]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); await tap(b[0], b[1]); }
  await shot('settings-canvas');
  await M(`document.querySelectorAll('#cfgS [data-x]')[0].click()`);
  { const b = await M(`(() => { const e = document.querySelector('#cfgS .hd [data-x]'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`); await tap(b[0], b[1]); }
  await M(`(() => { MeasureCore.draw(); })()`); await W(200); await shot('canvas-text20');
  // стрелка и размер рисуются; после рисования — без выделения
  for (const k of ['arr', 'dim']) { const n0 = (await doc()).dims.length; await h.tool(k); await h.drag([120, 250], [300, 250]); const D2 = await doc();
    ok(k + ' нарисован, не выделен', D2.dims.length === n0 + 1 && D2.dims[D2.dims.length - 1].k === k && !(await M('MeasureCore.sel')), {n: D2.dims.length, sel: await M('MeasureCore.sel')}); }
  { await h.tool('arr'); await h.drag([120, 200], [300, 150]); const D3 = await doc(), q = D3.dims[D3.dims.length - 1], A = await M(`MeasureCore.endPos(${JSON.stringify(q.a)})`), B = await M(`MeasureCore.endPos(${JSON.stringify(q.b)})`);
    ok('∟ вкл: стрелка по диагонали → горизонтально', Math.abs(A.y - B.y) < 0.5, [A, B]); }
  { const P = await M(`(() => { const e = MeasureCore.doc.elev.find(x => x.id === 'e1'), R = MeasureCore.elevRect(e); return {R, a: MeasureCore.toS(R.x + 2200, R.y + R.h - 900), b: MeasureCore.toS(R.x + R.w + 300, R.y + R.h - 950)}; })()`), t0 = await M('document.getElementById("cCv").getBoundingClientRect().top');
    await h.tool('arr'); await h.drag([P.a[0], P.a[1] + t0], [P.b[0], P.b[1] + t0]); const D4 = await doc(), q = D4.dims[D4.dims.length - 1], B = await M(`MeasureCore.endPos(${JSON.stringify(q.b)})`);
    ok('стрелка за край стены → конец на грани стены', q.b.t === 'elev' && Math.abs(q.b.u - 1) < 1e-6 && Math.abs(B.x - (P.R.x + P.R.w)) < 0.5, q.b); }
  await shot('arrow-dim');
  await M(`localStorage.removeItem('akx-core-cfg')`);
  await finish();
});
