// AKX-2026-0015 Б2 — рамка выделения (группа) и «4 угла» → стена по фото. Запуск: node tests/qa-b2-0015.cjs <фото> <скриншоты>
const path = require('path'); const IMG = process.argv[2], OUT = process.argv[3];
require('./qa-h-0015.cjs')(OUT, 9352).then(async h => {
  const {ok, W, tap, drag, M, btn, key, ctxBtn, doc, scr, shot, tool, addPhotos, finish} = h;
  await addPhotos(['p1.jpg', 'p2.jpg'].map(f => path.join(IMG, f)));
  await M('MeasureCore.fitAll()'); await W(200);
  let d = await doc(); ok('2 фото', d.photos.length === 2);
  const P = d.photos, ph = q => M(`MeasureCore.phH(MeasureCore.doc.photos[${q}])`), h0 = await ph(0), h1 = await ph(1);
  // рамка выделения через оба фото
  await tool('rsel'); ok('инструмент «рамка выделения»', (await M('MeasureCore.tool')) === 'rsel');
  const a = await scr(P[0].x - 100, P[0].y + h0 * 0.5), b = await scr(P[1].x + P[1].w * 0.5, P[1].y + h1 * 0.5);
  await drag(a, b); let ms = await M('MeasureCore.msel.map(m=>m.t)');
  ok('рамка задела оба фото → группа 2', ms.length === 2 && ms.every(t => t === 'photo'), ms); await shot('group');
  // перенос группы
  const c = await scr(P[0].x + P[0].w * 0.5, P[0].y + h0 * 0.3); await drag(c, [c[0] + 60, c[1] + 40]);
  d = await doc(); const dx0 = d.photos[0].x - P[0].x, dx1 = d.photos[1].x - P[1].x, dy0 = d.photos[0].y - P[0].y, dy1 = d.photos[1].y - P[1].y;
  ok('перенос группы — оба фото на одно смещение', dx0 > 0 && Math.abs(dx0 - dx1) <= 1 && Math.abs(dy0 - dy1) <= 1, {dx0, dx1, dy0, dy1});
  await btn('#bUnd'); d = await doc(); ok('↶ — группа на месте', d.photos[0].x === P[0].x && d.photos[1].y === P[1].y);
  // касание в «рамке» — убрать из группы
  const t1 = await scr(P[1].x + P[1].w * 0.5, P[1].y + h1 * 0.6); await tap(t1[0], t1[1]);
  ms = await M('MeasureCore.msel.length'); ok('касание члена группы — убран (1)', ms === 1, ms);
  await tap(t1[0], t1[1]); ok('касание ещё раз — добавлен (2)', (await M('MeasureCore.msel.length')) === 2);
  // рамка внутри фото — не берёт (сначала снять группу касанием пустого места)
  { const e0 = await scr(P[0].x - 150, P[0].y + h0 * 0.5); await tap(e0[0], e0[1]); ok('касание пустого — группа снята', (await M('MeasureCore.msel.length')) === 0); }
  const i0 = await scr(P[0].x + P[0].w * 0.3, P[0].y + h0 * 0.3), i1 = await scr(P[0].x + P[0].w * 0.6, P[0].y + h0 * 0.6); await drag(i0, i1);
  ok('рамка внутри фото — фото не взято', (await M('MeasureCore.msel.length')) === 0);
  // 🗑 группы и ↶
  await drag(a, b); await btn('#bDelS'); d = await doc(); ok('🗑 — группа удалена целиком', d.photos.length === 0);
  await btn('#bUnd'); d = await doc(); ok('↶ — оба фото вернулись', d.photos.length === 2);
  // «4 угла» по фото 1
  await tool('pts'); ok('инструмент «4 угла»', (await M('MeasureCore.tool')) === 'pts');
  const F = [[0.20, 0.22], [0.82, 0.18], [0.80, 0.85], [0.22, 0.80]];
  for (const [u, v] of [F[2], F[0], F[3], F[1]]) { const s = await scr(P[0].x + P[0].w * u, P[0].y + h0 * v); await tap(s[0], s[1]); }
  d = await doc(); ok('4 касания → рамка', d.frames.length === 1, d.frames.length);
  const q = d.frames[0].q; ok('углы по порядку ЛВ, ПВ, ПН, ЛН', q[0][0] < 0.3 && q[0][1] < 0.3 && q[1][0] > 0.7 && q[1][1] < 0.3 && q[2][0] > 0.7 && q[2][1] > 0.7 && q[3][0] < 0.3 && q[3][1] > 0.7, q);
  ok('рамка выбрана', (await M('MeasureCore.sel && MeasureCore.sel.t')) === 'frame'); await shot('frame');
  // угол рамки — тянуть
  const Q = await M('MeasureCore.frPts(MeasureCore.doc.frames[0])'); const s1 = await scr(Q[1].x, Q[1].y); await drag(s1, [s1[0] + 6, s1[1] - 10]);
  d = await doc(); ok('угол рамки двигается', d.frames[0].q[1][1] < q[1][1], [q[1], d.frames[0].q[1]]);
  // стена по рамке
  const wb = await ctxBtn('Стена по рамке'); ok('кнопка «Стена по рамке»', !!wb); await tap(wb[0], wb[1]);
  ok('ввод L', (await M('MeasureCore.kb && MeasureCore.kb.t')) === 'fL'); await key('3000ok'); await W(200);
  ok('H проекта не задан → ввод H', (await M('MeasureCore.kb && MeasureCore.kb.t')) === 'H'); await key('2700ok'); await W(300);
  d = await doc(); const w = d.walls[0], e = d.elev[0];
  ok('стена плана создана', d.walls.length === 1 && w.gn === 1); ok('развёртка создана', d.elev.length === 1 && e.wall === w.id); ok('рамка связана со стеной', d.frames[0].wall === w.id);
  const Q2 = await M('MeasureCore.frPts(MeasureCore.doc.frames[0])'), wf = (Math.hypot(Q2[1].x - Q2[0].x, Q2[1].y - Q2[0].y) + Math.hypot(Q2[2].x - Q2[3].x, Q2[2].y - Q2[3].y)) / 2;
  ok('фото под рамку: ширина рамки = L', Math.abs(wf - 3000) < 3, wf);
  const r = await M('MeasureCore.elevRect(MeasureCore.doc.elev[0])'), ph0 = d.photos[0];
  ok('развёртка L×H справа от фото, низ — по низу рамки', r.w === 3000 && r.h === 2700 && r.x > ph0.x + ph0.w && Math.abs(r.y + r.h - (Q2[2].y + Q2[3].y) / 2) < 2, r);
  ok('другие фото не сдвинуты', d.photos[1].x === P[1].x && d.photos[1].y === P[1].y);
  await M('MeasureCore.fitAll()'); await W(200); await shot('wall-by-frame');
  // повтор — показать, не создавать
  await M(`(()=>{})()`); const fs0 = await scr(...(await M('(()=>{const Q=MeasureCore.frPts(MeasureCore.doc.frames[0]);return [(Q[0].x+Q[2].x)/2,(Q[0].y+Q[2].y)/2]})()')));
  await tool('sel'); await tap(fs0[0], fs0[1]); ok('касание рамки — выбрана', (await M('MeasureCore.sel && MeasureCore.sel.t')) === 'frame');
  const wb2 = await ctxBtn('Стена С1'); ok('кнопка «Стена С1 — показать»', !!wb2); if (wb2) await tap(wb2[0], wb2[1]);
  ok('повтор не создаёт вторую стену', (await doc()).walls.length === 1);
  // ↶ шаги
  await btn('#bUnd'); d = await doc(); ok('↶ — стена по рамке отменена целиком, фото прежнего размера', d.walls.length === 0 && d.elev.length === 0 && d.photos[0].w === P[0].w && !d.frames[0].wall);
  await btn('#bRed'); d = await doc(); ok('↷ — вернулась', d.walls.length === 1 && d.elev.length === 1);
  // перезапуск
  await M('MeasureCore.save()'); await h.p.reload(); await h.p.waitForFunction('window.MeasureCore && MeasureCore.ready');
  d = await doc(); ok('перезапуск: рамка и стена сохранены', d.frames.length === 1 && d.frames[0].wall === d.walls[0].id);
  await finish();
});
