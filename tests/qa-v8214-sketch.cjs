// Measure 82.14 — режим «Скетч»: холст объекта → фото → углы → размеры/объекты/точки → вид сверху → чертёж → «Создать стену».
// Mobile Chromium 412×915, DPR 2; перо — события CDP pointerType pen; ввод — штатное поле #w3f и клавиатура v81 #zkb.
const assert = require('node:assert/strict');
const path = require('path');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p, check} = h;
  const SAMPLE = path.resolve(__dirname, '../prototypes/sketch/sample.jpg');
  const COR = [[52, 118], [832, 112], [833, 972], [66, 978]];             // ЛВ ПВ ПН ЛН — углы по потолку и полу (фото владельца)
  const css = (kind, a, pid) => p.evaluate(([kind, a, pid]) => { const K = MeasureLabSketch.state, Lt = MeasureLabSketch.layout, ph = K.photos.find(x => x.id === pid) || K.photos[0];
    const w = kind === 'img' ? Lt.imgToW(ph, a) : kind === 'mm' ? Lt.mmToW(Lt.elev(ph), a) : kind === 'pl' ? Lt.plToW(Lt.planBox(ph), a) : a; const s = Lt.toScr(w); return [s[0] / devicePixelRatio, s[1] / devicePixelRatio]; }, [kind, a, pid]);
  const focus = (kind, a, s = 1) => p.evaluate(([kind, a, s]) => { const K = MeasureLabSketch.state, Lt = MeasureLabSketch.layout, ph = K.photos[0]; K.sel = null; MeasureLabSketch.panel();
    const w = kind === 'img' ? Lt.imgToW(ph, a) : kind === 'mm' ? Lt.mmToW(Lt.elev(ph), a) : kind === 'pl' ? Lt.plToW(Lt.planBox(ph), a) : a; K.view.s = s; K.view.ox = innerWidth / 2 - w[0] * s; K.view.oy = innerHeight * .45 - w[1] * s; MeasureLabSketch.draw(); }, [kind, a, s]);
  const tap = async (kind, a) => { const pt = await css(kind, a); await h.down('pen', pt); await h.up('pen', pt); };
  const tapW = async (c, get) => { await focus('w', c, 1); if (get) c = await p.evaluate(get); const pt = await css('w', c); await h.down('pen', pt); await h.up('pen', pt); };   // подписи зависят от масштаба — позиция после фокуса   // касание подписи/поля в мировых координатах
  const drag = async (kind, a, b) => h.drag('pen', await css(kind, a), await css(kind, b), {css: true});
  const tool = t => p.evaluate(t => MeasureLabSketch.tool(t), t);
  const unsel = () => p.evaluate(() => { MeasureLabSketch.state.sel = null; MeasureLabSketch.panel(); MeasureLabSketch.fitAll(); });   // вид — весь столбец фото/чертёж/вид сверху
  const kk = async k => { const r = await p.evaluate(k => { const b = document.querySelector(`#zkb [data-kk="${k}"]`).getBoundingClientRect(); return b.width > 0 ? [b.x + b.width / 2, b.y + b.height / 2] : null; }, k); assert(r, 'keyboard v81 visible'); await p.mouse.click(r[0], r[1]); };
  const keys = async str => { for (const ch of str) await kk(ch === '-' ? 'pm' : ch); await kk('ok'); await p.waitForTimeout(60); };   // касания клавиатуры v81
  const fieldOn = () => p.evaluate(() => $('w3f').classList.contains('on') && document.activeElement === $('w3f') && document.body.classList.contains('kb'));
  const M = () => p.evaluate(() => { const K = MeasureLabSketch.state, ph = K.photos[0], m = MeasureLabSketch.build(ph); return {L: m.L, H: m.H, exact: m.exact, objs: m.objs.map(o => ({id: o.id, k: o.k, x0: o.x0, x1: o.x1, y0: o.y0, y1: o.y1, D: o.D, n: o.n, man: o.man, pt: o.pt})), dims: m.dims.map(d => ({v: d.e.v, st: d.st, ax: d.ax, sp: d.e.sp}))}; });
  const near = (a, b, t = 2) => Math.abs(a - b) <= t;
  const shot = async n => { if (process.env.QA_SHOT) await p.screenshot({path: path.join(process.env.QA_SHOT, n + '.png')}); };
  try {
    // ── вход и холст объекта
    const ent = await p.evaluate(() => ({ss: !!document.querySelector('#ss .nw [data-sk-open]'), menu: !!document.querySelector('#zMenu [data-sk-open]'), api: !!window.MeasureLabSketch}));
    const ic = await p.evaluate(() => { const b = document.querySelector('#mdT [data-rz]'); return {svg: !!b.querySelector('svg circle'), emoji: b.textContent.includes('📐'), aria: b.getAttribute('aria-label')}; });
    check(ic.svg && !ic.emoji && ic.aria === 'Коммуникации и размеры', 'icon: кнопка режима «Коммуникации и размеры» — вариант 2 (точка + два направления), без угольника', ic);
    check(ent.ss && ent.menu && ent.api, 'entry: «✎ Скетч» в списке замеров и в меню «Ещё»', ent);
    await p.evaluate(() => MeasureLabSketch.open('QA8214'));
    const op = await p.evaluate(async () => ({vis: !$('labSketch').hidden && getComputedStyle($('labSketch')).display !== 'none', obj: MeasureLabSketch.state.obj, rec: !!(await MeasureLabSketch.db.get('sk', 'QA8214')), cam: document.querySelector('#labSketch [data-skf="cam"]').getAttribute('capture'), gal: document.querySelector('#labSketch [data-skf="gal"]').multiple}));
    check(op.vis && op.obj === 'QA8214' && op.rec && op.cam === 'environment' && op.gal, 'open: экран, запись объекта в IndexedDB, камера (capture) и галерея (multiple)', op);
    // ── фото из галереи
    await p.locator('#labSketch [data-skf="gal"]').setInputFiles(SAMPLE);
    await p.waitForFunction(() => MeasureLabSketch.state.photos.length === 1 && MeasureLabSketch.state.photos[0].iw > 0);
    const ph = await p.evaluate(async () => { const q = MeasureLabSketch.state.photos[0], b = await MeasureLabSketch.db.get('img', q.id); return {iw: q.iw, ih: q.ih, blob: b ? b.size : 0, tool: MeasureLabSketch.state.tool}; });
    check(ph.iw === 857 && ph.ih === 1092 && ph.blob > 10000 && ph.tool === 'cor', 'photo: добавлено, файл в базе скетча, сразу инструмент «Углы»', ph);
    // ── 4 угла пером
    await unsel(); for (const c of COR) await tap('img', c);
    let cor = await p.evaluate(() => MeasureLabSketch.state.photos[0].cor);
    check(cor && cor.length === 4 && cor.every((c, i) => near(c[0], COR[i][0], 3) && near(c[1], COR[i][1], 3)), 'corners: 4 касания пером — ЛВ ПВ ПН ЛН', cor);
    await tool('pan'); await unsel(); await drag('img', [833, 972], [845, 985]);
    cor = await p.evaluate(() => MeasureLabSketch.state.photos[0].cor);
    check(near(cor[2][0], 845, 4) && near(cor[2][1], 985, 4), 'corners: угол тянется пером', cor[2]);
    await drag('img', [845, 985], [833, 972]);
    // ── размер по фото: низ от края до края = длина L
    await tool('dim'); await unsel(); await drag('img', [70, 970], [828, 962]);
    check(await fieldOn(), 'dim: после протяжки открыто штатное поле #w3f и клавиатура v81', null);
    await keys('2391');
    let m = await M();
    check(m.exact.L && near(m.L, 2391, .01) && m.dims[0].v === 2391, 'dim: ввод клавиатурой v81 → размер от края до края задаёт L точно', {L: m.L, exact: m.exact});
    // ── высота на чертеже от пола до потолка
    await unsel(); await drag('mm', [80, 30], [80, m.H - 30]);
    await keys('2700'); m = await M();
    check(m.exact.H && near(m.H, 2700, .01), 'dim: на чертеже снизу доверху задаёт H точно', {H: m.H, exact: m.exact});
    const lbl = await p.evaluate(() => { const e = MeasureLabSketch.state.photos[0].els.find(x => x.v === 2700), s = e._segE; return {vert: Math.abs(s[0][0] - s[1][0]) < 1}; });
    check(lbl.vert, 'dim: вертикальный размер на чертеже — вертикальная стрелка', lbl);
    // ── объект на фото, привязка размера к краю
    await tool('obj'); await unsel(); await p.evaluate(() => { MeasureLabSketch.state.kind = 'rig'; });
    await drag('img', [170, 125], [600, 205]);
    const rig = (await M()).objs.find(o => o.k === 'rig');
    await tool('dim'); await focus('mm', [200, 2600], 1.2); await drag('mm', [5, 2600], [rig.x0 - 3, 2600]); await keys('300');
    m = await M(); let r2 = m.objs.find(o => o.k === 'rig');
    check(near(r2.x0, 300, .5) && m.dims.find(d => d.v === 300).st === 'ok', 'bind: размер от стены до края ригеля ставит его край (300)', {x0: r2.x0, rig0: rig.x0});
    await focus('mm', [(r2.x0 + r2.x1) / 2, 2550], .6); await drag('mm', [r2.x0 + 3, 2550], [r2.x1 - 3, 2550]); await keys('1538');
    m = await M(); r2 = m.objs.find(o => o.k === 'rig');
    check(near(r2.x1 - r2.x0, 1538, .5) && near(r2.x0, 300, .5), 'bind: размер от края до края объекта — его ширина, левый край держится', {x0: r2.x0, w: r2.x1 - r2.x0, dims: m.dims, els: await p.evaluate(() => MeasureLabSketch.state.photos[0].els.filter(e => e.t === 'dim').map(e => [e.sp, e.a, e.b, e.v, e.bind]))});
    // ── Z объекта: касание поля Z, выступ +
    const zc = await p.evaluate(() => { const ph = MeasureLabSketch.state.photos[0]; return ph._zlab[0].c; });
    await tapW(zc, () => MeasureLabSketch.state.photos[0]._zlab[0].c);
    check(await fieldOn(), 'Z: касание поля Z открывает штатное поле', null); await keys('250');
    m = await M(); check(m.objs.find(o => o.k === 'rig').D === 250, 'Z: ригель — выступ +250', m.objs.find(o => o.k === 'rig').D);
    // ── ниша на чертеже руками: Z → −; размеры не двигают, конфликт ≠
    await tool('obj'); await p.evaluate(() => { MeasureLabSketch.state.kind = 'nis'; }); await unsel();
    await drag('mm', [1700, 300], [2100, 900]);
    m = await M(); const nis0 = m.objs.find(o => o.k === 'nis');
    await p.evaluate(() => { const ph = MeasureLabSketch.state.photos[0], e = ph.els.find(x => x.k === 'nis'); e.man = 1; MeasureLabSketch.draw(); });
    await tool('dim'); await focus('mm', [(nis0.x1 + 2391) / 2, 600], 1.5); await drag('mm', [nis0.x1 + 3, 600], [2388, 600]); await keys('150');
    m = await M(); const nis1 = m.objs.find(o => o.k === 'nis'), dn = m.dims.find(d => d.v === 150);
    check(near(nis1.x1, nis0.x1, .5) && dn.st === 'bad', 'manual: объект, поставленный руками на чертеже, размер не двигает — красное «≠»', {x1: nis1.x1, st: dn.st});
    const zn = await p.evaluate(() => { const ph = MeasureLabSketch.state.photos[0], e = ph.els.find(x => x.k === 'nis'), z = ph._zlab.find(q => q.id === e.id); return z.c; });
    await tapW(zn, () => { const ph = MeasureLabSketch.state.photos[0], e = ph.els.find(x => x.k === 'nis'); return ph._zlab.find(q => q.id === e.id).c; }); await keys('120');
    m = await M(); check(m.objs.find(o => o.k === 'nis').D === -120, 'Z: ниша — минус (−120)', m.objs.find(o => o.k === 'nis').D);
    // ── точка: розетка ×3 от центра первого подрозетника
    await tool('pt'); await p.evaluate(() => { MeasureLabSketch.state.ptk = 'roz'; MeasureLabSketch.state.posts = 3; }); await focus('mm', [600, 300], 1);
    await tap('mm', [600, 300]);
    m = await M(); const roz = m.objs.find(o => o.pt);
    check(roz && roz.k === 'roz' && roz.n === 3, 'point: розетка с 3 постами', roz);
    await tool('dim'); await focus('mm', [250, 320], 1); await drag('mm', [5, 320], [roz.x0 + 1, 320]); await keys('500');
    m = await M(); check(near(m.objs.find(o => o.pt).x0, 500, .5), 'point: размер от стены до центра первого подрозетника', m.objs.find(o => o.pt).x0);
    // ── заметки: на фото и на холсте
    await tool('txt'); await unsel(); await tap('img', [430, 600]);
    await p.locator('#labSketch [data-sk-tx]').fill('проверить откос'); await p.locator('#labSketch .sk-dlg .bt .pr').click();
    const offc = await p.evaluate(() => { const ph = MeasureLabSketch.state.photos[0]; return [ph.x + ph.w + 120, ph.y + 100]; });
    await tap('w', offc); await p.locator('#labSketch [data-sk-tx]').fill('общая заметка объекта'); await p.locator('#labSketch .sk-dlg .bt .pr').click();
    const nt = await p.evaluate(() => ({ph: MeasureLabSketch.state.photos[0].els.filter(e => e.t === 'txt').map(e => e.tx), cv: MeasureLabSketch.state.notes.map(n => n.tx)}));
    check(nt.ph[0] === 'проверить откос' && nt.cv[0] === 'общая заметка объекта', 'notes: заметка на фото и на холсте объекта', nt);
    // ── вид сверху: ломаная, длина участка; колонна с привязкой грани
    await tool('plan'); await unsel();
    await tap('pl', [0, 0]); await tap('pl', [1200, 0]); await tap('pl', [1200, 250]); await focus('pl', [1500, 125], .2); await tap('pl', [2391, 250]);
    let pl = await p.evaluate(() => MeasureLabSketch.state.photos[0].plan);
    check(pl.pts.length === 4 && pl.pts[1][1] === 0 && pl.pts[2][0] === pl.pts[1][0], 'plan: ломаная 4 точки, притяжка к прямой', pl.pts);
    const seg0 = await p.evaluate(() => MeasureLabSketch.state.photos[0]._plab.find(q => q.kind === 'seg' && q.i === 0).c);
    await tool('pan'); await unsel(); await tapW(seg0, () => MeasureLabSketch.state.photos[0]._plab.find(q => q.kind === 'seg' && q.i === 0).c); await keys('1150');
    pl = await p.evaluate(() => MeasureLabSketch.state.photos[0].plan);
    check(pl.len[0] === 1150 && near(pl.pts[1][0], 1150, .5) && near(pl.pts[3][0] - pl.pts[2][0], 2391 - 1200, 1), 'plan: длина участка 1150 — излом и следующие сдвинуты', pl.pts);
    await tool('pcol'); await unsel();
    let hl = null; await h.drag('pen', await css('pl', [1500, 270]), await css('pl', [1900, 670]), {css: true, preview: () => p.evaluate(() => (MeasureLabSketch.state.plHl || {hl: []}).hl.length)}).then(v => { hl = v; });
    pl = await p.evaluate(() => MeasureLabSketch.state.photos[0].plan);
    const col = pl.cols[0];
    check(col && near(col.z, 250, .5) && hl > 0, 'plan: колонна — грань притянута к стене (z = 250), подсветка привязки', {col, hl});
    const cw = await p.evaluate(() => MeasureLabSketch.state.photos[0]._plab.find(q => q.kind === 'cw').c);
    await tool('pan'); await unsel(); await tapW(cw, () => MeasureLabSketch.state.photos[0]._plab.find(q => q.kind === 'cw').c); await keys('400');
    const cd = await p.evaluate(() => MeasureLabSketch.state.photos[0]._plab.find(q => q.kind === 'cd').c);
    await tapW(cd, () => MeasureLabSketch.state.photos[0]._plab.find(q => q.kind === 'cd').c); await keys('350');
    pl = await p.evaluate(() => MeasureLabSketch.state.photos[0].plan);
    check(pl.cols[0].w === 400 && pl.cols[0].d === 350 && pl.cols[0].wx && pl.cols[0].dx, 'plan: ввод ширины и глубины колонны', pl.cols[0]);
    // ── перемещение объекта на чертеже (правка руками) и растягивание за угол
    await tool('pan'); await unsel(); m = await M(); const ri = m.objs.find(o => o.k === 'rig');
    await focus('mm', [ri.x0 + 250, ri.y0 + 60], .8); await drag('mm', [ri.x0 + 250, ri.y0 + 60], [ri.x0 + 290, ri.y0 + 60]);
    m = await M(); const ri2 = m.objs.find(o => o.k === 'rig');
    check(ri2.man && near(ri2.x0 - ri.x0, 40, 15), 'elev: объект двигается на чертеже, становится «поставлен руками»', {dx: ri2.x0 - ri.x0, man: ri2.man});
    await focus('mm', [ri2.x1, ri2.y0], .8); await p.evaluate(id => { const K = MeasureLabSketch.state; K.sel = {p: K.photos[0].id, e: id}; MeasureLabSketch.draw(); }, ri2.id); await drag('mm', [ri2.x1, ri2.y0], [ri2.x1 + 60, ri2.y0]);
    m = await M(); const ri3 = m.objs.find(o => o.k === 'rig');
    check(near(ri3.x1 - ri2.x1, 60, 15) && near(ri3.x0, ri2.x0, .5), 'elev: растягивание за угловой маркер', {dx1: ri3.x1 - ri2.x1});
    await p.evaluate(() => MeasureLabSketch.undo()); await p.evaluate(() => MeasureLabSketch.undo());
    m = await M(); check(near(m.objs.find(o => o.k === 'rig').x0, ri.x0, .5), 'undo: ↶ возвращает объект', null);
    await unsel(); await shot('8214-1-sketch'); await focus('mm', [1200, 1300], .38); await shot('8214-2-elev');
    // ── отрисовка по настройкам Lab 0.12
    const met = await p.evaluate(() => { const c = MeasureLabSettings.current, k = {...c}; Object.assign(c, {textPx: 6, fieldPx: 10, linePx: 4, arrowPx: 16, pointPx: 2}); const f0 = W3.f; W3.f = 0.3; const a = MeasureLabSketch.metrics(); W3.f = 1.6; const b = MeasureLabSketch.metrics(); W3.f = f0; Object.assign(c, k); MeasureLabSketch.draw(); return {a, b}; });
    check(met.a.text >= 6 && met.a.field >= 10 && met.b.text > met.a.text && met.b.line > met.a.line && met.b.arrow > met.a.arrow && met.b.point > met.a.point, 'settings: текст ≥ 6, поля ≥ 10; Aa (W3.f) и толщины/наконечники/точки из настроек Lab', met);
    // ── сохранение в IndexedDB и восстановление после перезагрузки
    await p.evaluate(() => MeasureLabSketch.saveNow());
    const before = await p.evaluate(() => JSON.stringify(MeasureLabSketch.state.photos.map(q => [q.cor, q.els.length, q.plan && q.plan.pts.length, q.plan && q.plan.cols.length])));
    await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && window.MeasureLabComms);
    await p.evaluate(() => MeasureLabSketch.open('QA8214'));
    await p.waitForFunction(() => MeasureLabSketch.state.photos.length === 1 && MeasureLabSketch.state.imgs[MeasureLabSketch.state.photos[0].id]);
    const after = await p.evaluate(() => JSON.stringify(MeasureLabSketch.state.photos.map(q => [q.cor, q.els.length, q.plan && q.plan.pts.length, q.plan && q.plan.cols.length])));
    check(before === after, 'storage: после перезагрузки — фото, углы, элементы, вид сверху', {after});
    // ── перенос JSON
    const js = await p.evaluate(async () => { const o = await MeasureLabSketch.exportObj(); const t = JSON.stringify(o); await MeasureLabSketch.open('QA8214-copy'); await MeasureLabSketch.importJson(JSON.parse(t)); const K = MeasureLabSketch.state; await new Promise(r => setTimeout(r, 100)); const b = await MeasureLabSketch.db.get('img', K.photos[0].id); const res = {fmt: o.format, n: K.photos.length, els: K.photos[0].els.length, blob: b ? b.size : 0, notes: K.notes.length, size: t.length}; await MeasureLabSketch.open('QA8214'); return res; });
    check(js.fmt === 'measure-sketch' && js.n === 1 && js.els > 8 && js.blob > 10000 && js.notes === 1, 'json: перенос объекта с фото в другой холст', js);
    // ── «Создать стену»: новое помещение
    const sessBefore = await p.evaluate(async () => (await dbAll('sess')).length);
    const res = await p.evaluate(async () => { const K = MeasureLabSketch.state, ph = K.photos[0]; const W = MeasureLabSketch.wallData(ph); const r = await MeasureLabSketch.createWall(ph, W, {obj: 'QA8214', name: 'Кухня'}); await new Promise(z => setTimeout(z, 400)); return {r, W: {L: W.L, H: W.H, els: W.els.length, dms: W.dms.length}}; });
    const st = await p.evaluate(async () => { const Md = w3Model(), V = Md ? w3Vols(Md) : [], r = await dbGet('sess', S.room0.id);
      return {out: !!(await dbGet('sess', S.sess.id)).out, open: !MeasureLabSketch.isOpen(), mode: S.mode, seg: S.sess.seg, room: S.room0.name, obj: S.room0.obj, pts: r.ms.pts, dims: r.ms.dims.map(d => d.v), H: r.ms.H, segs: r.segs, q4: {L: S.q4.L, H: S.q4.H, blank: S.q4.blank, aL: S.q4.aL, aH: S.q4.aH},
        els: S.els.map(e => ({k: e.k, c: e.c, W: e.W, H: e.H, D: e.D, N: e.N, st: e.st})), vols: V.map(v => ({k: v.k, x0: Math.round(v.x0), x1: Math.round(v.x1), D: v.D})), dms: S.dms.map(d => ({vm: d.vm, a: d.a, b: d.b})), notes: S.notes.map(n => n.tx), refs: S.refs.map(f => ({on: f.on, q: f.q, qUser: f.qUser, iw: f.iw})), mos: !!S.mosaic, link: S.sess.labSketch}; });
    check(st.out && st.open && st.mode !== 'plan' && st.seg === 0 && st.room === 'Кухня' && st.obj === 'QA8214', 'wall: новое помещение «Кухня», открыт вид стены С1, снимок для выгрузки (out) записан', {mode: st.mode, seg: st.seg});
    check(st.pts.length === 2 && near(Math.hypot(st.pts[1][0] - st.pts[0][0], st.pts[1][1] - st.pts[0][1]), 2391, 1) && st.dims[0] === 2391 && st.H === 2700, 'wall: стена плана L = 2391 (замер), H помещения 2700', {pts: st.pts, dims: st.dims, H: st.H});
    check(st.q4.L === 2391 && st.q4.H === 2700 && st.q4.blank === 1 && !st.q4.aL && !st.q4.aH, 'wall: вид стены L × H 2391 × 2700, не «≈»', st.q4);
    const KD_OK = await p.evaluate(() => Object.keys(KD));
    const colD = await p.evaluate(() => { const pl = MeasureLabSketch.state.photos[0].plan, c = pl.cols[0], zb = Math.min(...pl.pts.map(q => q[1])); return Math.round(c.z + c.d - zb); });
    const vRig = st.vols.find(v => v.k === 'rig'), vNis = st.vols.find(v => v.k === 'nis'), vKol = st.vols.find(v => v.k === 'kol' && v.D !== 250), vVys = st.vols.find(v => v.k === 'kol' && v.D === 250);
    check(st.els.every(e => KD_OK.includes(e.k)) && vRig && vRig.D === 250 && vRig.x0 === 300 && vNis && vNis.D === -120 && vKol && vKol.D === colD && vVys && vVys.D === 250, 'wall: объёмы w3Vols — ригель D+250 от 300, ниша −120, колонна вида сверху (D от линии стены), участок ломаной — выступ (колонна) 250, все виды — из KINDS v81', {vols: st.vols, colD});
    const eR = st.els.find(e => e.k === 'roz');
    check(eR && eR.N === 3 && eR.st === 71 && near(eR.c[0], 500 + 71, .5), 'wall: розетка — коммуникация с 3 постами, шаг 71, центр блока = первый пост + 71', eR);
    check(st.dms.length >= 6 && st.dms.every(d => d.vm > 0) && st.dms.some(d => d.vm === 300 && near(d.a[0], 0, .5) && near(d.b[0], 300, .5)), 'wall: размеры → ручные стрелки (vm, концы на краях)', st.dms.slice(0, 4));
    check(st.notes.includes('проверить откос'), 'wall: заметка с фото — выноска стены', st.notes);
    check(st.refs.length === 1 && st.refs[0].on === 1 && st.refs[0].qUser === 1 && st.refs[0].q.length === 4 && st.link && st.link.obj === 'QA8214', 'wall: фото прикреплено к стене (на стене, 4 угла ЛН ПН ПВ ЛВ), связь со скетчем', st.refs);
    await p.waitForFunction(() => S.mosaic && S.mosaic.rf, null, {timeout: 8000}).catch(() => {});
    await p.evaluate(() => { try { fit(); } catch (e) { } draw(); }); await p.waitForTimeout(300); await shot('8214-3-wall');
    const mos = await p.evaluate(() => ({rf: S.mosaic && S.mosaic.rf, ref: S.refs[0] && S.refs[0].id, W: S.mosaic && S.mosaic.W}));
    check(mos.rf === mos.ref && mos.W > 100, 'wall: фото выпрямлено по углам и лежит фоном стены (S.mosaic)', mos);
    const ex = await p.evaluate(async () => { await openRoom(S.room0.id); const o = await exportRoomAsObj(); const t = JSON.stringify(o); return {v: o.v || o.ver || o.format, walls: JSON.stringify(o).length, hasEls: /"els"/.test(t), noLab: !/labSketch/.test(t), wallL: /2391/.test(t), nEl: (t.match(/"x0"/g) || []).length, pts: (t.match(/"N":3/g) || []).length, size: t.length}; });
    check(ex.size > 2000 && ex.hasEls && ex.noLab && ex.wallL && ex.nEl >= 4 && ex.pts === 1, 'export: выгрузка помещения v81 содержит стену с объектами (контракт без изменений)', ex);
    // ── вторая стена в то же помещение (продолжение открытой ломаной)
    const res2 = await p.evaluate(async rid => { await MeasureLabSketch.open('QA8214'); const K = MeasureLabSketch.state, ph = K.photos[0]; const r = await MeasureLabSketch.createWall(ph, null, {id: rid, k: 'new'}); await new Promise(z => setTimeout(z, 300)); const rr = await dbGet('sess', rid); return {r, pts: rr.ms.pts, segs: Object.keys(rr.segs), seg: S.sess.seg}; }, res.r.room);
    check(res2.pts.length === 3 && res2.segs.length === 2 && res2.seg === 1, 'wall: существующее помещение — новая стена плана С2', res2);
    // ── замена вида существующей стены: старый вид — в удалённые
    const res3 = await p.evaluate(async rid => { await MeasureLabSketch.open('QA8214'); const ph = MeasureLabSketch.state.photos[0], old = (await dbGet('sess', rid)).segs[0]; const r = await MeasureLabSketch.createWall(ph, null, {id: rid, k: 0}); await new Promise(z => setTimeout(z, 300)); const rr = await dbGet('sess', rid), o = await dbGet('sess', old); return {now: rr.segs[0], old, oldDel: !!o.del, pts: rr.ms.pts.length}; }, res.r.room);
    check(res3.now !== res3.old && res3.oldDel && res3.pts === 3, 'wall: «заменить вид стены» — новый вид, прежний помечен удалённым, план не меняется', res3);
    const sessAfter = await p.evaluate(async () => (await dbAll('sess')).length);
    check(sessAfter === sessBefore + 4, 'storage: в базе замеров только помещение и 3 вида стен (скетч хранится отдельно)', {sessBefore, sessAfter});
    check(h.errors.length === 0, 'no page errors', h.errors);
    void res; void cw;
    const fails = h.checks.filter(c => !c.ok);
    h.save('qa-v8214-sketch.json', {total: h.checks.length, failed: fails.length});
    console.log(`QA 82.14 sketch: ${h.checks.length - fails.length}/${h.checks.length}`);
    assert.equal(fails.length, 0);
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
