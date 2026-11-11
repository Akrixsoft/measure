// Measure 82.18 — единый холст проекта (AKX-2026-0012, инженер B); заменяет qa-v8214-sketch.
// Фото → размер на фото пером с вводом значения → текст и линия вне областей → 4 угла → стена над фото → футляр в стене и на подложке →
// передача жеста между поверхностями → план / стена / фото без «закрытия» → 🗑 области и ↶ → AkrixBack по цепочке → перезапуск — всё на месте.
// Экран: QA_VW × QA_VH × QA_DPR (обвязка qa-v011-harness); перо — CDP pointerType pen. QA_SHOT=<папка> — снимки экрана.
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p, check} = h;
  const SAMPLE = path.resolve(__dirname, '../prototypes/sketch/sample.jpg');
  const tag = `${process.env.QA_VW || 412}x${process.env.QA_VH || 915}x${process.env.QA_DPR || 2}`;
  const shot = async n => { if (process.env.QA_SHOT) await p.screenshot({path: path.join(process.env.QA_SHOT, `8218-${tag}-${n}.png`)}); };
  const cssK = w => p.evaluate(w => { const s = MeasureLabSketch.map.toScrK(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const cssB = (X, Y) => cssK([X, -Y]);                                         // мм подложки (ось y вверх) → px CSS
  const refAt = (u, v) => p.evaluate(([u, v]) => { const R = MeasureLabSketch.refRegion((window.__ref || {}).id); return [R.x + R.w * u, -(R.y + R.h * v)]; }, [u, v]);   // доли фото → мм подложки
  const tap = async a => { await h.down('pen', a); await h.up('pen', a); };
  const st = () => p.evaluate(() => { const a = MeasureLabSketch.active(); return {on: MeasureLabSketch.isOpen(), act: a && (a.t === 'board' ? 'board' : a.t), sid: S.sess && S.sess.id, kind: S.sess && S.sess.kind, mode: S.mode, tool: S.tool, list: $('ss').classList.contains('on')}; });
  const settle = (ms = 250) => p.waitForTimeout(ms);
  const fitAll = () => p.evaluate(() => { MeasureLabSketch.fitAll(); draw(); });
  const gap = () => p.evaluate(() => { const vis = e => e && e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'none';   // нижние строки: без зазоров и наложений, внутри экрана
    const L = [...$('zf').children].filter(vis).map(e => e.getBoundingClientRect()).sort((a, b) => a.top - b.top); let worst = 0, over = 0;
    for (let i = 1; i < L.length; i++) { const g = L[i].top - L[i - 1].bottom; if (g > worst) worst = g; if (g < -1) over++; } const b = L.length ? L[L.length - 1].bottom : 0;
    return {rows: L.length, worst: Math.round(worst), over, inside: b <= innerHeight + 1, bottom: Math.round(innerHeight - b)}; });
  try {
    await p.evaluate(() => { document.body.classList.remove('tz'); PM.PEN.mode = 'off'; });
    // ── 0. проект: холст открыт, подложка активна, своих строк / ✕ / «Объект» нет
    await p.evaluate(() => MeasureLabSketch.open('QA8218 Клиент — Кухня'));
    let s = await st();
    const ui0 = await p.evaluate(() => ({close: document.querySelectorAll('[data-sa="close"],[data-sa="obj"],[data-lab-tb="close"],[data-lab-tb="obj"],[data-lab-tb="open"],.sk-row').length, menu: !!document.querySelector('#zMenu [data-sk-open]'), back: typeof window.AkrixBack, rec: !!MeasureLabSketch.state.board}));
    check(s.on && s.act === 'board' && s.kind === 'board' && s.tool === 'mk', 'open: холст проекта, активна подложка (штатная поверхность в разметке)', s);
    check(ui0.close === 0 && !ui0.menu && ui0.back === 'function', 'ui: нет ✕ / «Объект» / «Закрыть» / своей строки; window.AkrixBack есть', ui0);
    check(await p.evaluate(() => MeasureLabSketch.close() === false && MeasureLabSketch.isOpen()), 'close: api.close не закрывает холст', null);
    // ── 1. фото на подложку (футляр → 🖼 → файл)
    await p.locator('#labSketch [data-skf="gal"]').setInputFiles(SAMPLE);
    await p.waitForFunction(() => S.refs && S.refs.length === 1);
    await settle(400);
    const ref = await p.evaluate(async () => { const r = S.refs[0]; window.__ref = r; const b = await dbGet('img', 'ref:' + r.id); return {id: r.id, w: r.w, blob: b ? b.size : 0, rsel: S.rsel === r.id, rfr: $('rfr').classList.contains('on'), bar: !!document.querySelector('#zpb #labSkPh [data-skp="cor"]'), rfb: getComputedStyle($('rfb')).display}; });
    check(ref.blob > 10000 && ref.w === 600 && ref.rsel && !ref.rfr && ref.bar && ref.rfb === 'none', 'photo: фото — справка подложки (картинка в базе), без экрана распознавания; ⌗ в нижней строке, плавающей плашки нет', ref);
    await fitAll();
    // ── 2. футляр на подложке
    const tb1 = await p.evaluate(() => { const f = $('zpF'), ok = !!f && f.getBoundingClientRect().height > 0; if (ok) f.click(); const on = $('tb').classList.contains('on'); $('tb').classList.remove('on'); return {zpF: ok, tb: on}; });
    check(tb1.zpF && tb1.tb, 'case: футляр 🖍 на подложке открывается', tb1);
    // ── 3. размер-стрелка на фото пером, значение — штатным полем
    await p.evaluate(() => { pickTool('dim'); zo('dim').sn = 0; zo('dim').L = 0; zo('dim').P = 0; S.rsel = null; draw(); });
    await h.drag('pen', await cssB(...await refAt(.2, .5)), await cssB(...await refAt(.8, .5)), {css: true});
    const dim = await p.evaluate(() => ({n: S.dms.length, id: S.dms[0] && S.dms[0].id, ref: S.refs[0].x, kind: S.sess.kind}));
    check(dim.n === 1 && dim.kind === 'board', 'dim: размер на фото пером — в подложке (фото не сдвинуто)', dim);
    const lab = await p.evaluate(id => { draw(); const a = MeasureLabGeometry.dimensionLabels.get(id), r = cv.getBoundingClientRect(); return a ? [a[4] / devicePixelRatio + r.left, a[5] / devicePixelRatio + r.top] : null; }, dim.id);
    await tap(lab);
    const fld = await p.evaluate(() => ({on: $('w3f').classList.contains('on'), k: $('w3f')._k && $('w3f')._k.t}));
    await p.locator('#w3f').fill('1250'); await p.locator('#w3f').dispatchEvent('change'); await p.evaluate(() => document.activeElement.blur());
    const vm = await p.evaluate(() => S.dms[0].vm);
    check(fld.on && fld.k === 'lab-dim' && vm === 1250, 'dim: касание подписи → штатное поле #w3f → 1250 мм', {fld, vm});
    await p.evaluate(() => zUndo()); const u1 = await p.evaluate(() => S.dms[0] && S.dms[0].vm); await p.evaluate(() => zRedo()); const r1 = await p.evaluate(() => S.dms[0] && S.dms[0].vm);
    check(!(u1 > 0) && r1 === 1250, 'dim: ↶ снимает значение, ↷ возвращает', {u1, r1});
    // ── 4. текст и линия вне областей (подложка)
    await p.evaluate(() => { const K = MeasureLabSketch.state; K.view = {s: K.view.s * .6, ox: K.view.ox + 30, oy: K.view.oy + 60}; MeasureLabSketch.map.syncToS(MeasureLabSketch.active()); draw(); });
    const free = await refAt(1.08, .2);
    await p.evaluate(() => { pickTool('txt'); draw(); });
    await tap(await cssB(...free)); await settle(150);
    const ti = await p.evaluate(() => { const i = $('pp').querySelector('[data-zt]'); if (!i) return false; i.value = 'узел ригеля'; i.dispatchEvent(new Event('input', {bubbles: true})); i.dispatchEvent(new Event('change', {bubbles: true})); i.blur(); return true; });
    await p.evaluate(() => { pickTool('ln'); draw(); });
    await h.drag('pen', await cssB(...await refAt(1.06, .5)), await cssB(...await refAt(1.4, .5)), {css: true});
    const bd = await p.evaluate(() => ({txt: S.drw.filter(q => q.k === 'txt').map(q => q.tx), ln: S.drw.filter(q => q.k === 'ln').length, kind: S.sess.kind}));
    check(ti && bd.txt.includes('узел ригеля') && bd.ln === 1 && bd.kind === 'board', 'board: текст и линия вне фото — штатными инструментами в подложке', bd);
    await shot('1-board');
    // ── 5. ⌗ 4 угла → ▣ стена над фото
    await p.evaluate(() => { pickTool('sel'); S.rsel = __ref.id; draw(); MeasureLabSketch.cmd('cor'); });
    for (const [u, v] of [[.06, .11], [.97, .1], [.97, .89], [.08, .9]]) await tap(await cssB(...await refAt(u, v)));
    const cq = await p.evaluate(() => ({q: S.refs[0].q && S.refs[0].q.length, user: S.refs[0].qUser, cor: MeasureLabSketch.state.cor, wall: !!document.querySelector('#labSkPh [data-skp="wall"]')}));
    check(cq.q === 4 && cq.user && !cq.cor && cq.wall, 'corners: 4 касания пером → ref.q (формат v81), «▣ Стена» в нижней строке', cq);
    await p.locator('#labSkPh [data-skp="wall"]').click();
    await p.selectOption('#labSketch [data-sk-room]', '');
    await p.locator('#labSketch [data-sk-name]').fill('Кухня');
    await p.evaluate(() => { const B = document.querySelector('#labSketch .sk-dlg'); B.querySelector('[data-sk-l]').value = '2391'; B.querySelector('[data-sk-h]').value = '2700'; });
    await p.locator('#labSketch .sk-dlg .bt .pr').click();
    await p.waitForFunction(() => { const a = MeasureLabSketch.active(); return a && a.t === 'wall' && S.mosaic && S.q4 && S.q4.ok; }, null, {timeout: 15000});
    await settle(400);
    const w1 = await p.evaluate(async () => { const K = MeasureLabSketch.state, a = MeasureLabSketch.active(), Rw = MeasureLabSketch.region(a), Rp = MeasureLabSketch.refRegion(__ref.id), brd = await dbGet('sess', K.board);
      return {wid: a.id, room: a.room, w: a.wid, sid: S.sess.id, q4: [S.q4.L, S.q4.H], above: Rw.y + Rw.h <= Rp.y + 1, link: (brd.refs[0] || {}).labWall === a.wid, tool: S.tool, plan: K.items.filter(i => i.t === 'plan').length, zf: $('zf').className}; });
    check(w1.q4[0] === 2391 && w1.q4[1] === 2700 && w1.above && w1.link && w1.w && w1.plan === 1, 'wall: стена С1 «Кухня» 2391 × 2700 над фото, связь фото → wid, область плана', w1);
    const tb2 = await p.evaluate(() => { const f = $('zpF'), ok = !!f && f.getBoundingClientRect().height > 0; if (ok) f.click(); const on = $('tb').classList.contains('on'); $('tb').classList.remove('on'); return {zpF: ok, tb: on, tool: S.tool}; });
    check(tb2.zpF && tb2.tb && tb2.tool === 'mk', 'case: стена холста — в разметке, футляр 🖍 открывается', tb2);
    // подложка под активной стеной — векторно, S не меняется
    const cx1 = await p.evaluate(() => { const d0 = MeasureLabCtx.digest(), n0 = MeasureLabGeometry.dimensionLabels.size; draw(); const Rp = MeasureLabSketch.refRegion(__ref.id), c = MeasureLabSketch.map.toScrK(Rp.x + Rp.w * .5, Rp.y + Rp.h * .3), px = cx.getImageData(Math.round(c[0]), Math.round(c[1]), 1, 1).data;
      return {same: d0 === MeasureLabCtx.digest(), labels: n0 === MeasureLabGeometry.dimensionLabels.size, px: [...px].slice(0, 3), bg: [233, 236, 240]}; });
    check(cx1.same && cx1.labels && cx1.px.some((v, i) => Math.abs(v - cx1.bg[i]) > 12), 'ctx: фото и рисунки подложки видны при активной стене; S и поля стены не изменены', cx1);
    await fitAll(); await shot('2-wall');
    // ── 6. передача жеста: стена активна, инструмент «размер», жест на фото → подложка активна и размер — за один жест
    await p.evaluate(() => { pickTool('dim'); zo('dim').sn = 0; zo('dim').L = 0; zo('dim').P = 0; draw(); });
    const nB = await p.evaluate(async () => (await dbGet('sess', MeasureLabSketch.state.board)).dms.length);
    await h.drag('pen', await cssB(...await refAt(.25, .75)), await cssB(...await refAt(.75, .75)), {css: true}); await settle(300);
    const fw1 = await p.evaluate(() => ({act: MeasureLabSketch.active().t, dms: S.dms.length, kind: S.sess.kind}));
    check(fw1.act === 'board' && fw1.dms === nB + 1, 'forward: касание фото при активной стене — подложка активна, размер поставлен тем же жестом', {nB, ...fw1});
    const wr = await p.evaluate(() => { const a = MeasureLabSketch.state.items.find(i => i.t === 'wall'), m = MeasureLabSketch.map.nat2k; return [m(a, 400, 1300), m(a, 1900, 1300)]; });
    const nW = await p.evaluate(async sid => (await dbGet('sess', sid)).dms.length, w1.sid);
    await h.drag('pen', await cssK(wr[0]), await cssK(wr[1]), {css: true}); await settle(300);
    const fw2 = await p.evaluate(() => ({act: MeasureLabSketch.active().t, dms: S.dms.length, sid: S.sess.id}));
    check(fw2.act === 'wall' && fw2.sid === w1.sid && fw2.dms === nW + 1, 'forward: жест в области стены при активной подложке — стена активна, размер на стене тем же жестом', {nW, ...fw2});
    // ── 6б (QA Д6). стена активна, инструмент коммуникации «розетка» → касание фото: подложка активна, фото выбрано, на подложке ничего не создано
    const roz = await p.evaluate(() => { const k = (typeof KINDS !== 'undefined' ? KINDS : []).find(x => x.pt) || null; return k ? k.k : null; });
    await p.evaluate(sid => MeasureLabSketch.activate(MeasureLabSketch.state.items.find(i => i.t === 'wall' && i.sid === sid)), w1.sid); await settle(300);
    if (roz) await p.evaluate(k => pickTool(k), roz);
    const b6 = await p.evaluate(async () => { const b = await dbGet('sess', MeasureLabSketch.state.board); return {els: (b.els || []).length, dms: (b.dms || []).length, drw: (b.drw || []).length}; });
    const mk6 = await p.evaluate(() => S.mk);
    await tap(await cssB(...await refAt(.5, .4))); await settle(500);
    const a6 = await p.evaluate(() => ({act: MeasureLabSketch.active().t, rsel: S.rsel, ref: (window.__ref || {}).id, els: (S.els || []).length, dms: S.dms.length, drw: S.drw.length, mk: S.mk}));
    check(roz && mk6 === roz && a6.act === 'board' && a6.rsel === a6.ref && a6.els === b6.els && a6.dms === b6.dms && a6.drw === b6.drw && a6.mk === 'sel', 'Д6: касание фото при активной стене с «розеткой» — подложка активна, фото выбрано, объект не создан, инструмент «выбор»', {roz, mk6, b6, a6});
    // ── 6в (QA Д15). подложка активна, касание пальцем по подписи размера маленькой неактивной стены — только активация, без поля и клавиатуры
    await p.evaluate(sid => MeasureLabSketch.activate(MeasureLabSketch.state.items.find(i => i.t === 'wall' && i.sid === sid)), w1.sid); await settle(300);
    const lp = await p.evaluate(() => { pickTool('sel'); draw(); const l = S.w3L.find(x => { try { return !!w3FKind(x); } catch (e) { return false; } }), d = devicePixelRatio, r = cv.getBoundingClientRect(); return l ? {c: [l.c[0] / d + r.left, l.c[1] / d + r.top], t: l.t} : null; });
    await p.evaluate(() => MeasureLabSketch.activate('board')); await settle(300);
    await p.evaluate(() => { pickTool('sel'); S.rsel = null; draw(); });
    if (lp) { await h.down('touch', lp.c); await h.up('touch', lp.c); } await settle(500);
    const a15 = await p.evaluate(() => { const k = $('zkb'), f = $('w3f'); return {act: MeasureLabSketch.active().t, kb: !!(k && k.getClientRects().length && getComputedStyle(k).display !== 'none' && k.getBoundingClientRect().height > 50), w3f: !!(f && f.classList.contains('on')), dmIn: $('dmIn').classList.contains('on'), focus: document.activeElement && document.activeElement.tagName}; });
    check(!!lp && a15.act === 'wall' && !a15.kb && !a15.w3f && !a15.dmIn && a15.focus !== 'INPUT', 'Д15: первое касание неактивной стены по подписи поля — только активация (без поля размера и клавиатуры)', {lp, ...a15});
    // ── 7. переходы план / стена / фото без «закрытия»
    await p.evaluate(() => mdGo('plan')); await settle(300); s = await st();
    check(s.on && s.act === 'plan' && !s.list, 'nav: ⌂ — план внутри холста', s);
    const tb3 = await p.evaluate(() => { const f = $('labPlF') || $('zpF'); return {f: !!f}; });
    await p.evaluate(() => wGo(0)); await settle(300); s = await st();
    check(s.on && s.act === 'wall' && s.sid === w1.sid && s.tool === 'mk', 'nav: ряд С1 — стена внутри холста, в разметке', s);
    await p.evaluate(() => zmSet('plan')); await settle(300); s = await st();
    check(s.on && s.act === 'plan', 'nav: «План» v81 (zmSet) — план внутри холста', s);
    await p.evaluate(() => MeasureLabSketch.cmd('plan')); await p.evaluate(() => MeasureLabSketch.activate('board')); await settle(200); s = await st();
    check(s.on && s.act === 'board', 'nav: подложка снова активна', s);
    // ── 7б (QA Н7). план активен, открыта панель «Изделия» → сдвиг пальцем с пустой подложки: холст сдвинут, план и панель остаются
    await p.evaluate(() => MeasureLabSketch.goPlan()); await settle(400);
    const prdOk = await p.evaluate(() => { try { if (window.MeasureLabPrd && MeasureLabPrd.open) { MeasureLabPrd.open(); return true; } } catch (e) { } return false; }); await settle(300);
    const empty = await p.evaluate(() => { const K = MeasureLabSketch.state, d = devicePixelRatio, r = cv.getBoundingClientRect(), fh = (typeof zFreeH === 'function' ? zFreeH() : cv.height) / d;
      for (let y = 120; y < fh - 40; y += 23) for (let x = 30; x < r.width - 30; x += 23) { const w = MeasureLabSketch.map.toK(x * d, y * d); if (MeasureLabSketch.hitArea(w[0], w[1]) !== 'board') continue;
        if ((K.boardRec && K.boardRec.refs || []).some(q => { const R = MeasureLabSketch.refRegion(q.id); return R && w[0] >= R.x && w[0] <= R.x + R.w && w[1] >= R.y && w[1] <= R.y + R.h; })) continue; return [x + r.left, y + r.top]; } return null; });
    const v7 = await p.evaluate(() => ({...MeasureLabSketch.state.view}));
    const panel = () => p.evaluate(() => { const e = document.getElementById('labprd-plan'); return !!(e && !e.hidden && e.getBoundingClientRect().height > 0); });
    const pan0 = await panel();
    if (empty) await h.drag('touch', empty, [empty[0] + 40, empty[1] + 60], {css: true}); await settle(400);
    const a7 = await p.evaluate(() => ({act: MeasureLabSketch.active().t, mode: S.mode, view: {...MeasureLabSketch.state.view}}));
    const pan1 = await panel();
    check(empty && a7.act === 'plan' && a7.mode === 'plan' && Math.abs(a7.view.ox - v7.ox - 40) < 2 && Math.abs(a7.view.oy - v7.oy - 60) < 2 && (!prdOk || !pan0 || pan1), 'Н7: сдвиг пальцем с пустой подложки — холст сдвинут, план и панель «Изделия» остаются', {empty, prdOk, pan0, pan1, v7, a7});
    await p.evaluate(() => { try { MeasureLabPrd.close(); } catch (e) { } }); await p.evaluate(() => MeasureLabSketch.activate('board')); await settle(300);
    await p.evaluate(() => zDone()); await settle(200); s = await st();
    check(s.on && !s.list, 'nav: ✓ — сохранить и показать весь холст, холст открыт', s);
    void tb3;
    // ── 8. 🗑 области стены (выбор за заголовок) и ↶
    const tt = await p.evaluate(() => { const a = MeasureLabSketch.state.items.find(i => i.t === 'wall'), R = MeasureLabSketch.region(a); return [R.x + 20 / MeasureLabSketch.state.view.s, R.y - 14 / MeasureLabSketch.state.view.s]; });
    await tap(await cssK(tt));
    const sel = await p.evaluate(() => ({sel: MeasureLabSketch.state.sel, has: zSelHas()}));
    await p.evaluate(() => $('bDelS') ? $('bDelS').click() : zDelSel()); await settle(300);
    const del = await p.evaluate(async sid => ({walls: MeasureLabSketch.state.items.filter(i => i.t === 'wall').length, del: !!(await dbGet('sess', sid)).del}), w1.sid);
    await p.evaluate(() => zUndo()); await settle(300);
    const und = await p.evaluate(async sid => ({walls: MeasureLabSketch.state.items.filter(i => i.t === 'wall').length, del: !!(await dbGet('sess', sid)).del}), w1.sid);
    check(sel.sel && sel.has && del.walls === 0 && del.del && und.walls === 1 && !und.del, '🗑: область стены выбрана заголовком → удалена (вид стены в «Удалённые») → ↶ на месте', {sel, del, und});
    // ── 9. системная «назад»: поле → начатое действие → выделение → двойное нажатие — к проектам
    const bk = await p.evaluate(async () => { const out = [];
      await MeasureLabSketch.activate('board');
      const i = $('ptx'); i.classList.add('on'); i.focus(); out.push(['field', AkrixBack(), document.activeElement !== i]);
      MeasureLabSketch.state.cor = {id: S.refs[0].id, pts: []}; out.push(['cor', AkrixBack(), !MeasureLabSketch.state.cor]);
      $('tb').classList.add('on'); out.push(['case', AkrixBack(), !$('tb').classList.contains('on')]);
      S.rsel = S.refs[0].id; out.push(['sel', AkrixBack(), !S.rsel]);
      out.push(['first', AkrixBack(), MeasureLabSketch.isOpen() && !$('ss').classList.contains('on')]);
      out.push(['second', AkrixBack(), true]);
      return out; });
    await settle(300);
    /* Д10 (решение владельца, g3): в корне списка — тоже двойное нажатие: первое — тост «Ещё раз — выход» (true), второе — false (оболочка) */
    const bk2 = await p.evaluate(() => ({list: $('ss').classList.contains('on'), open: MeasureLabSketch.isOpen(), arm: AkrixBack(), toast: (document.querySelector('#labPrj .lp-to.on span') || {}).textContent, off: AkrixBack()}));
    check(bk.every(x => x[1] === true && x[2]) && bk2.list && bk2.open && bk2.arm === true && /Ещё раз — выход/.test(bk2.toast || '') && bk2.off === false, 'back: поле → угол → футляр → выделение → «Ещё раз — к проектам» → список (холст открыт); из списка — «Ещё раз — выход», затем false (оболочка)', {bk, bk2});
    const pid = await p.evaluate(() => MeasureLabSketch.pid());
    await p.evaluate(p => MeasureLabSketch.open(p), pid); await settle(200); s = await st();
    check(s.on && !s.list && s.act === 'board', 'back: из списка — тот же проект, та же поверхность', s);
    const g1 = await gap(); check(g1.over === 0 && g1.worst <= 6 && g1.inside, 'layout: нижние строки без зазоров и наложений, внутри экрана', g1);
    await shot('3-board-final');
    // ── 9б (QA Д12). поворот экрана: области вписываются заново — внутри кадра, ниже плашек сверху, выше нижних строк
    const inView = () => p.evaluate(() => { const K = MeasureLabSketch.state, d = devicePixelRatio, cvr = cv.getBoundingClientRect(), fh = (typeof zFreeH === 'function' ? zFreeH() : cv.height) / d;
      const R = K.items.map(i => MeasureLabSketch.region(i)), out = [];
      for (const r of R) { const a = MeasureLabSketch.map.toScrK(r.x, r.y), b = MeasureLabSketch.map.toScrK(r.x + r.w, r.y + r.h); out.push([a[0] / d, a[1] / d, b[0] / d, b[1] / d].map(Math.round)); }
      const W = cvr.width; return {W: Math.round(W), fh: Math.round(fh), out, ok: out.every(q => q[0] >= -2 && q[2] <= W + 2 && q[1] >= 0 && q[3] <= fh + 2)}; });
    const VW0 = +(process.env.QA_VW || 412), VH0 = +(process.env.QA_VH || 915);
    await p.setViewportSize({width: VH0, height: VW0}); await settle(900);
    const land = await inView();
    await p.setViewportSize({width: VW0, height: VH0}); await settle(900);
    const port = await inView();
    check(land.ok && port.ok, 'Д12: поворот экрана (альбом и обратно) — области вписаны в кадр выше нижних строк', {land, port});
    // ── 10. перезапуск — всё на месте
    await p.evaluate(() => { MeasureLabSketch.activate('board'); });
    await settle(200);
    await p.evaluate(async () => { await flushAll(); await MeasureLabSketch.saveNow(); });
    const before = await p.evaluate(() => ({items: JSON.stringify(MeasureLabSketch.state.items.map(i => [i.t, i.room || '', i.wid || '', Math.round(i.ax)])), view: MeasureLabSketch.state.view, act: MeasureLabSketch.state.act.t}));
    await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && window.MeasureLabComms);
    await p.evaluate(() => { document.body.classList.remove('tz'); });
    await p.evaluate(p => MeasureLabSketch.open(p), pid); await settle(500);
    const after = await p.evaluate(async () => { const K = MeasureLabSketch.state, b = await dbGet('sess', K.board), im = b.refs[0] && await dbGet('img', 'ref:' + b.refs[0].id);
      return {items: JSON.stringify(K.items.map(i => [i.t, i.room || '', i.wid || '', Math.round(i.ax)])), view: K.view, act: K.act.t, refs: b.refs.length, img: im instanceof Blob, vm: b.dms.map(d => d.vm), txt: b.drw.filter(q => q.k === 'txt').map(q => q.tx), snaps: Object.keys(K.snaps).length, kind: S.sess && S.sess.kind}; });
    check(after.items === before.items && Math.abs(after.view.s - before.view.s) < 1e-6 && after.act === before.act, 'restart: раскладка, вид и активная поверхность — как были', {before, after: {items: after.items, view: after.view, act: after.act}});
    check(after.refs === 1 && after.img && after.vm.includes(1250) && after.txt.includes('узел ригеля') && after.snaps >= 1, 'restart: фото (картинка), размер 1250, текст, снимки областей — на месте', after);
    // перенос холста v3
    const js = await p.evaluate(async () => { const o = await MeasureLabSketch.exportObj(); return {v: o.v, app: o.app, refs: o.board.refs.length, img: Object.keys(o.images).length, dms: o.board.dms.length, layout: o.layout.length}; });
    check(js.v === 3 && /^Measure \d/.test(js.app) && js.refs === 1 && js.img === 1 && js.dms >= 2 && js.layout >= 2, 'export: перенос холста measure-sketch v3 — раскладка, подложка, картинки', js);
    // v81 неизменен
    const v81 = cp.execFileSync('git', ['show', '51923bf:web/v81.html'], {cwd: h.root, maxBuffer: 20e6}).equals(fs.readFileSync(path.join(h.root, 'web/v81.html')));
    check(v81, 'v81: web/v81.html побайтно равен 51923bf', null);
    check(h.errors.length === 0, 'errors: нет ошибок страницы', h.errors.slice(0, 3));
  } catch (e) { console.error(e); check(false, 'exception', String(e && e.stack || e)); }
  finally { h.save(`qa-v8218-canvas-${tag}.json`); await h.close(); const bad = h.checks.filter(c => !c.ok).length; console.log(`${h.checks.length - bad}/${h.checks.length} passed`); process.exitCode = bad ? 1 : 0; }
})();
