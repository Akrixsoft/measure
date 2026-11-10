// Measure 82.14 — «Скетч»: холст объекта поверх штатного холста v81 (решение владельца 10.11.2026).
// Стены и план — области холста, правятся ОБЩИМ набором инструментов; вне активной области — холст (фото, заметки, перемещение).
// Mobile Chromium 412×915, DPR 2; перо — CDP pointerType pen.
const assert = require('node:assert/strict');
const path = require('path');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p, check} = h;
  const SAMPLE = path.resolve(__dirname, '../prototypes/sketch/sample.jpg');
  const COR = [[52, 118], [832, 112], [833, 972], [66, 978]];
  const near = (a, b, t = 2) => Math.abs(a - b) <= t;
  const shot = async n => { if (process.env.QA_SHOT) await p.screenshot({path: path.join(process.env.QA_SHOT, n + '.png')}); };
  const cssK = w => p.evaluate(w => { const s = MeasureLabSketch.map.toScrK(...w), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, w);
  const cssImg = (id, q) => p.evaluate(([id, q]) => { const K = MeasureLabSketch.state, it = K.items.find(i => i.id === id), R = MeasureLabSketch.region(it), s = MeasureLabSketch.map.toScrK(R.x + q[0] * R.w / it.iw, R.y + q[1] * R.w / it.iw), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; }, [id, q]);
  const tapAt = async pt => { await h.down('pen', pt); await h.up('pen', pt); };
  const aligned = () => p.evaluate(() => { const a = MeasureLabSketch.active(); if (!a) return null; const M = MeasureLabSketch.map, P = a.t === 'plan' ? (S.room.ms.pts[0] || [0, 0]) : [0, 0], s = toScr(...P), k = M.toScrK(...M.nat2k(a, ...P)); return Math.hypot(s[0] - k[0], s[1] - k[1]); });
  try {
    const ic = await p.evaluate(() => { const b = document.querySelector('#mdT [data-rz]'); return {svg: !!b.querySelector('svg circle'), emoji: b.textContent.includes('📐')}; });
    check(ic.svg && !ic.emoji, 'icon: кнопка «Коммуникации и размеры» — вариант 2, без угольника', ic);
    const ti = await p.evaluate(() => ({ver: $('zVer').textContent, badge: $('zVerB').textContent, plane: !$('bNew').hidden, room: !!$('bNewR')}));
    check(/^Measure 82\.\d+$/.test(ti.ver) && ti.ver !== 'Measure v81' && ti.badge !== 'v81' && !ti.plane && ti.room, 'title: на титуле актуальная версия; «＋ Плоскость» убрана, «＋ Помещение» есть', ti);
    const ent = await p.evaluate(() => ({ss: !!document.querySelector('#ss .nw [data-sk-open]'), menu: !!document.querySelector('#zMenu [data-sk-open]')}));
    check(ent.ss && ent.menu, 'entry: «✎ Скетч» в списке замеров и в меню «Ещё»', ent);
    // ── холст объекта
    await p.evaluate(() => MeasureLabSketch.open('QA8214'));
    const op = await p.evaluate(async () => { const row = document.querySelector('.sk-row'), zf = $('zf'), kids = [...zf.children].filter(e => e.getBoundingClientRect().height > 0), i = kids.indexOf(row), nx = kids[i + 1];
      return {on: MeasureLabSketch.isOpen(), inZf: row.parentNode === zf, gap: nx ? Math.round(nx.getBoundingClientRect().top - row.getBoundingClientRect().bottom) : null, own: document.querySelectorAll('#labSketch .sk-bar,#labSketch .sk-panel').length, rec: !!(await MeasureLabSketch.db.get('sk', 'QA8214'))}; });
    check(op.on && op.inZf && op.gap != null && op.gap <= 6 && op.own === 0 && op.rec, 'canvas: строка холста — в штатном стеке строк (#zf), без зазора; своих инструментов чертежа нет', op);
    // ── фото и 4 угла
    await p.locator('#labSketch [data-skf="gal"]').setInputFiles(SAMPLE);
    await p.waitForFunction(() => MeasureLabSketch.state.items.some(i => i.t === 'photo' && MeasureLabSketch.state.imgs[i.id]));
    const pid = await p.evaluate(() => MeasureLabSketch.state.items.find(i => i.t === 'photo').id);
    const ph = await p.evaluate(async id => { const K = MeasureLabSketch.state, it = K.items.find(i => i.id === id), b = await MeasureLabSketch.db.get('img', id); return {iw: it.iw, ih: it.ih, blob: b ? b.size : 0, cor: !!K.cor, btn: !!document.querySelector('.sk-row [data-sa="cor"].on')}; }, pid);
    check(ph.iw === 857 && ph.blob > 10000 && ph.cor && ph.btn, 'photo: на холсте, файл в базе холста, сразу «⌗ Углы» в строке холста', ph);
    for (const c of COR) await tapAt(await cssImg(pid, c));
    let cor = await p.evaluate(id => MeasureLabSketch.state.items.find(i => i.id === id).cor, pid);
    check(cor && cor.every((c, i) => near(c[0], COR[i][0], 3) && near(c[1], COR[i][1], 3)), 'corners: 4 касания пером — ЛВ ПВ ПН ЛН', cor);
    await h.drag('pen', await cssImg(pid, COR[2]), await cssImg(pid, [845, 985]), {css: true});
    cor = await p.evaluate(id => MeasureLabSketch.state.items.find(i => i.id === id).cor, pid);
    check(near(cor[2][0], 845, 4) && near(cor[2][1], 985, 4), 'corners: угол тянется пером', cor[2]);
    await h.drag('pen', await cssImg(pid, [845, 985]), await cssImg(pid, COR[2]), {css: true});
    // ── «▣ Стена» из строки холста: новое помещение, L, H
    await p.locator('.sk-row [data-sa="wall"]').click();
    await p.selectOption('#labSketch [data-sk-room]', '');
    await p.locator('#labSketch [data-sk-name]').fill('Кухня');
    await p.evaluate(() => { const B = document.querySelector('#labSketch .sk-dlg'); B.querySelector('[data-sk-l]').value = '2391'; B.querySelector('[data-sk-h]').value = '2700'; });
    await p.locator('#labSketch .sk-dlg .bt .pr').click();
    await p.waitForFunction(() => { const a = MeasureLabSketch.active(); return a && a.t === 'wall' && S.mosaic && S.q4 && S.q4.ok; }, null, {timeout: 15000});
    await p.waitForTimeout(400);
    const w1 = await p.evaluate(async id => { const K = MeasureLabSketch.state, a = MeasureLabSketch.active(), ph = K.items.find(i => i.id === id), Rw = MeasureLabSketch.region(a), Rp = MeasureLabSketch.region(ph), o = await dbGet('sess', S.sess.id), r = await dbGet('sess', S.room0.id);
      return {wid: a.id, sid: S.sess.id, seg: S.sess.seg, room: S.room0.name, q4: [S.q4.L, S.q4.H, S.q4.aL, S.q4.aH], above: Rw.y + Rw.h <= Rp.y + 1, link: ph.wall === a.id, ref: (S.refs || []).length === 0, out: !!o.out, dims: r.ms.dims.map(d => d.v), H: r.ms.H, plan: K.items.filter(i => i.t === 'plan').length}; }, pid);
    check(w1.seg === 0 && w1.room === 'Кухня' && w1.q4[0] === 2391 && w1.q4[1] === 2700 && !w1.q4[2] && !w1.q4[3], 'wall: стена С1 «Кухня» 2391 × 2700 (замер), открыта штатно', w1);
    check(w1.above && w1.link, 'wall: область стены — над фото', {above: w1.above});
    check(w1.ref && w1.out && w1.dims[0] === 2391 && w1.H === 2700 && w1.plan === 1, 'wall: стена без заливки фото (фото рядом на холсте), план L/H, снимок для выгрузки, область плана на холсте', {dims: w1.dims, H: w1.H});
    check(await aligned() < 0.5, 'align: вид v81 совмещён с местом стены на холсте', await aligned());
    await shot('8214-1-wall');
    // ── общий набор: штатный инструмент коммуникаций внутри области стены
    await p.evaluate(() => { PM.rzToggle(true); localStorage.removeItem('measure.lab13.posts'); });
    await p.locator('[data-lab-rz-comm="roz"]').click();
    const n0 = await p.evaluate(() => S.els.length);
    const inW = await p.evaluate(() => { const s = toScr(800, 1100), r = cv.getBoundingClientRect(); return [s[0] / devicePixelRatio + r.left, s[1] / devicePixelRatio + r.top]; });
    await tapAt(inW);
    const e1 = await p.evaluate(() => S.els.map(e => ({k: e.k, c: e.c})));
    check(e1.length === n0 + 1 && e1[e1.length - 1].k === 'roz' && near(e1[e1.length - 1].c[0], 800, 60) && near(e1[e1.length - 1].c[1], 1100, 60), 'tools: штатная розетка ставится пером в области стены на холсте (общий набор)', e1);
    await p.evaluate(() => PM.rzToggle(false));
    // ── вне области: холст
    const v0 = await p.evaluate(() => ({...MeasureLabSketch.state.view}));
    const A = await p.evaluate(() => { const K = MeasureLabSketch.state, r = cv.getBoundingClientRect(), d = devicePixelRatio; for (let y = 160; y < 600; y += 30) for (let x = 30; x < 380; x += 25) { const w = MeasureLabSketch.map.toK(x * d, (y - r.top) * d); if (!K.items.some(i => { const R = MeasureLabSketch.region(i); return w[0] >= R.x - 30 && w[0] <= R.x + R.w + 30 && w[1] >= R.y - 60 && w[1] <= R.y + R.h + 30; })) return [x, y]; } return null; });   // свободное место холста на экране
    await h.drag('pen', A, [A[0] - 60, A[1] + 40], {css: true});
    const v1 = await p.evaluate(() => ({...MeasureLabSketch.state.view}));
    check(near(v1.ox - v0.ox, -60, 3) && near(v1.oy - v0.oy, 40, 3) && await aligned() < 0.5, 'pan: протяжка вне областей двигает весь холст, вид стены — вместе', {dx: v1.ox - v0.ox, dy: v1.oy - v0.oy});
    await tapAt(await cssImg(pid, [430, 600]));
    const s1 = await p.evaluate(() => ({sel: MeasureLabSketch.state.sel, els: S.els.length, btn: !!document.querySelector('.sk-row [data-sa="wall"]')}));
    check(s1.sel === pid && s1.els === n0 + 1 && s1.btn, 'photo: касание фото — выбор на холсте, в строке «⌗ Углы», «▣ Стена»; v81 касание не получил', s1);
    // ── заметка на холсте
    await p.locator('.sk-row [data-sa="note"]').click(); await p.locator('#labSketch [data-sk-tx]').fill('узел ригеля'); await p.locator('#labSketch .sk-dlg .bt .pr').click();
    check(await p.evaluate(() => MeasureLabSketch.state.items.some(i => i.t === 'note' && i.tx === 'узел ригеля')), 'note: заметка на холсте', null);
    // ── план помещений
    const planC = await p.evaluate(() => { const it = MeasureLabSketch.state.items.find(i => i.t === 'plan'); MeasureLabSketch.fitRegion(it); MeasureLabSketch.map.syncToS(MeasureLabSketch.active()); MeasureLabSketch.draw(); const R = MeasureLabSketch.region(it); return [R.x + R.w / 2, R.y + R.h / 2]; });
    await tapAt(await cssK(planC)); await p.waitForFunction(() => S.mode === 'plan', null, {timeout: 8000}); await p.waitForTimeout(200);
    const pl = await p.evaluate(id => ({act: MeasureLabSketch.active() && MeasureLabSketch.active().t, room: S.room.name, pts: S.room.ms.pts.length, snap: !!MeasureLabSketch.state.snaps[id]}), w1.wid);
    check(pl.act === 'plan' && pl.room === 'Кухня' && pl.pts === 2 && pl.snap && await aligned() < 0.5, 'plan: касание области — штатный план помещения на холсте, совмещён; стена — снимком', pl);
    await shot('8214-2-plan');
    // ── перемещение неактивной области стены
    const wc = await p.evaluate(id => { const it = MeasureLabSketch.state.items.find(i => i.id === id), R = MeasureLabSketch.region(it); MeasureLabSketch.fitRegion(it); MeasureLabSketch.map.syncToS(MeasureLabSketch.active()); MeasureLabSketch.draw(); return {c: [R.x + R.w / 2, R.y + R.h / 2], ax: it.ax}; }, w1.wid);
    const B0 = await cssK(wc.c); await h.drag('pen', B0, [B0[0] + 50, B0[1]], {css: true});
    const ax1 = await p.evaluate(id => MeasureLabSketch.state.items.find(i => i.id === id).ax, w1.wid);
    check(ax1 > wc.ax, 'move: неактивная стена перетаскивается по холсту', {ax0: wc.ax, ax1});
    // ── касание стены — снова вид стены
    const wc2 = await p.evaluate(id => { const R = MeasureLabSketch.region(MeasureLabSketch.state.items.find(i => i.id === id)); return [R.x + R.w / 2, R.y + R.h / 2]; }, w1.wid);
    await tapAt(await cssK(wc2)); await p.waitForFunction(sid => S.mode !== 'plan' && S.sess && S.sess.id === sid && S.mosaic, w1.sid, {timeout: 8000}); await p.waitForTimeout(200);
    check(await p.evaluate(sid => S.sess.id === sid && S.els.some(e => e.k === 'roz'), w1.sid) && await aligned() < 0.5, 'switch: касание области стены — штатный вид стены, розетка на месте, вид совмещён', null);
    // ── «Готово» со стены — план
    await p.evaluate(() => $('bDone').click()); await p.waitForFunction(() => S.mode === 'plan', null, {timeout: 8000}); await p.waitForTimeout(200);
    check(await p.evaluate(() => MeasureLabSketch.state.items.filter(i => i.t === 'plan').length === 1 && MeasureLabSketch.active().t === 'plan'), 'done: «Готово» со стены — план на своём месте на холсте', null);
    // ── стена из плана без фото — область на холсте
    const ad = await p.evaluate(async () => { const n0 = MeasureLabSketch.state.items.filter(i => i.t === 'wall').length; const m = S.room.ms; m.pts.push([m.pts[1][0], m.pts[1][1] + 1800]); m.dims.push({id: 'qd2', a: {p: 1}, b: {p: 2}, v: 1800}); gnFix(); saveRoom(); await openWall(1); bwSet(1800, 2700); await new Promise(z => setTimeout(z, 400)); draw();
      const a = MeasureLabSketch.active(); return {n0, n1: MeasureLabSketch.state.items.filter(i => i.t === 'wall').length, act: a && a.t, seg: S.sess.seg}; });
    check(ad.n1 === ad.n0 + 1 && ad.act === 'wall' && ad.seg === 1 && await aligned() < 0.5, 'adopt: стена С2 из плана — новая область холста, вид совмещён', ad);
    await shot('8214-3-all');
    // ── сохранение и восстановление
    await p.evaluate(() => MeasureLabSketch.saveNow());
    const before = await p.evaluate(() => JSON.stringify(MeasureLabSketch.state.items.map(i => [i.t, i.sid || '', Math.round(i.ax || i.x || 0)])));
    await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && window.MeasureLabComms);
    await p.evaluate(() => MeasureLabSketch.open('QA8214'));
    const after = await p.evaluate(() => ({items: JSON.stringify(MeasureLabSketch.state.items.map(i => [i.t, i.sid || '', Math.round(i.ax || i.x || 0)])), snaps: Object.keys(MeasureLabSketch.state.snaps).length, img: Object.keys(MeasureLabSketch.state.imgs).length}));
    check(after.items === before && after.snaps >= 2 && after.img === 1, 'storage: после перезагрузки — фото, стены, план, заметка, снимки областей', after);
    // ── перенос JSON
    const js = await p.evaluate(async () => { const o = await MeasureLabSketch.exportObj(), t = JSON.stringify(o); await MeasureLabSketch.open('QA8214-copy'); await MeasureLabSketch.importJson(JSON.parse(t)); const K = MeasureLabSketch.state, ph = K.items.find(i => i.t === 'photo'), b = ph && await MeasureLabSketch.db.get('img', ph.id); const r = {fmt: o.format, v: o.v, n: K.items.length, blob: b ? b.size : 0}; await MeasureLabSketch.open('QA8214'); return r; });
    check(js.fmt === 'measure-sketch' && js.v === 2 && js.n === 2 && js.blob > 10000, 'json: фото и заметки переносятся в другой холст (стены — штатной выгрузкой)', js);
    // ── выгрузка помещения v81
    const rid = await p.evaluate(() => MeasureLabSketch.state.rooms[0].id);
    const ex = await p.evaluate(async rid => { await openRoom(rid); const o = await exportRoomAsObj(), t = JSON.stringify(o); return {size: t.length, ph: !/"ph":\[\{/.test(t), roz: /"t":"so"/.test(t), noLab: !/labSketch/.test(t)}; }, rid);
    check(ex.size > 1000 && ex.ph && ex.roz && ex.noLab, 'export: выгрузка помещения v81 со стеной и розеткой, без фото холста (контракт без изменений)', ex);
    // ── закрыть холст
    await p.evaluate(() => MeasureLabSketch.close());
    check(await p.evaluate(() => !MeasureLabSketch.isOpen() && !document.querySelector('#zf .sk-row') && !document.body.classList.contains('lab-sketch')), 'close: холст закрыт, строка убрана, обычный вид', null);
    check(h.errors.length === 0, 'no page errors', h.errors);
    const fails = h.checks.filter(c => !c.ok);
    h.save('qa-v8214-sketch.json', {total: h.checks.length, failed: fails.length});
    console.log(`QA 82.14 sketch: ${h.checks.length - fails.length}/${h.checks.length}`);
    assert.equal(fails.length, 0);
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
