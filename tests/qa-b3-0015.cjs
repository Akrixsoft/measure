// AKX-2026-0015 Б3 — рисование и пометки. Запуск: node tests/qa-b3-0015.cjs <фото> <скриншоты>
const path = require('path'); const IMG = process.argv[2], OUT = process.argv[3];
require('./qa-h-0015.cjs')(OUT, 9353).then(async h => {
  const {p, ok, W, tap, drag, path: pth, M, btn, ctxBtn, doc, scr, shot, tool, addPhotos, finish} = h;
  await addPhotos([path.join(IMG, 'p1.jpg')]); await M('MeasureCore.fitAll()'); await W(200);
  let d = await doc(); const P = d.photos[0], hh = await M('MeasureCore.phH(MeasureCore.doc.photos[0])');
  const at = (u, v) => scr(P.x + P.w * u, P.y + hh * v), last = async () => (await doc()).drw.slice(-1)[0];
  // перо
  await tool('pen'); const pp = []; for (let i = 0; i <= 10; i++) pp.push(await at(0.1 + i * 0.03, 0.1 + 0.05 * Math.sin(i)));
  await pth(pp); let q = await last(); ok('перо → рисунок на фото', q && q.k === 'pen' && q.h && q.h.t === 'photo' && q.p.length > 3, q && q.p.length);
  // линия 0/90°
  await tool('ln'); const l0 = await at(0.1, 0.3), l1 = await at(0.6, 0.31); await drag(l0, [l1[0], l0[1] + 3]);
  q = await last(); let Wp = await M(`MeasureCore.drwPts('${q.id}')`); ok('линия, привязка 0°', q.k === 'ln' && Math.abs(Wp[0].y - Wp[1].y) < 0.5, Wp);
  // прямоугольник, круг
  await tool('rect'); await drag(await at(0.15, 0.4), await at(0.4, 0.55)); q = await last(); ok('прямоугольник', q.k === 'rect');
  await tool('circ'); await drag(await at(0.7, 0.45), await at(0.8, 0.45)); q = await last(); ok('круг', q.k === 'circ');
  // дуга — 3 касания
  await tool('arc'); for (const [u, v] of [[0.1, 0.65], [0.25, 0.6], [0.4, 0.65]]) { const s = await at(u, v); await tap(s[0], s[1]); }
  q = await last(); ok('дуга — 3 касания', q.k === 'arc' && q.p.length === 3); ok('инструмент остаётся', (await M('MeasureCore.tool')) === 'arc');
  // ломаная — касание последней точки
  await tool('pl'); for (const [u, v] of [[0.5, 0.65], [0.7, 0.66], [0.7, 0.8]]) { const s = await at(u, v); await tap(s[0], s[1]); }
  const pl3 = await at(0.7, 0.8); ok('ломаная: ✓ в строке', !!(await ctxBtn('Ломаная'))); await tap(pl3[0], pl3[1]);
  q = await last(); Wp = await M(`MeasureCore.drwPts('${q.id}')`); ok('ломаная — 3 точки, 0/90°', q.k === 'pl' && q.p.length === 3 && Math.abs(Wp[0].y - Wp[1].y) < 0.5 && Math.abs(Wp[1].x - Wp[2].x) < 0.5, Wp);
  // текст
  await tool('txt'); const t0 = await at(0.15, 0.88); await tap(t0[0], t0[1]);
  ok('текст: поле ввода открыто', await M('document.getElementById("cTx").classList.contains("on")'));
  await p.keyboard.type('Розетки 2 шт'); await btn('#cTxOk'); q = await last(); ok('текст сохранён', q.k === 'txt' && q.tx === 'Розетки 2 шт', q.tx);
  ok('поле закрыто', !(await M('document.getElementById("cTx").classList.contains("on")')));
  // пин №
  await tool('pin'); for (const u of [0.6, 0.75]) { const s = await at(u, 0.9); await tap(s[0], s[1]); await btn('#cTxOk'); }
  d = await doc(); const pins = d.drw.filter(x => x.k === 'pin'); ok('пины 1, 2', pins.length === 2 && pins[0].n === 1 && pins[1].n === 2, pins.map(x => x.n));
  // выноска
  await tool('vyn'); await drag(await at(0.85, 0.2), await at(0.95, 0.05)); await p.keyboard.type('кран'); await btn('#cTxOk');
  q = await last(); ok('выноска с подписью', q.k === 'vyn' && q.tx === 'кран' && q.p.length === 2);
  await shot('drawings');
  // цвет: новый рисунок и выбранный
  await btn('#zpb [data-zc="#d93025"]'); await tool('ln'); await drag(await at(0.1, 0.95), await at(0.5, 0.95)); q = await last(); ok('цвет нового рисунка', q.c === '#d93025', q.c);
  await btn('#zpb [data-zc="#e07a00"]'); q = await last(); ok('цвет выбранного меняется', q.c === '#e07a00', q.c);
  await btn('#bUnd'); q = await last(); ok('↶ — цвет вернулся', q.c === '#d93025');
  // толщина
  await M(`(()=>{const i=document.getElementById('tbLw');i.value=6;i.dispatchEvent(new Event('input'));i.dispatchEvent(new Event('change'))})()`); ok('толщина 6', (await M('MeasureCore.lw')) === 6);
  // перенос фото — рисунки следуют
  d = await doc(); const pen0 = await M(`MeasureCore.drwPts('${d.drw[0].id}')[0]`);
  await tool('sel'); const c0 = await at(0.95, 0.5); await drag(c0, [c0[0] + 40, c0[1] + 30]);
  const pen1 = await M(`MeasureCore.drwPts('${d.drw[0].id}')[0]`), ph1 = (await doc()).photos[0];
  ok('фото перенесено — рисунки следуют', Math.abs((pen1.x - pen0.x) - (ph1.x - P.x)) < 1 && Math.abs((pen1.y - pen0.y) - (ph1.y - P.y)) < 1, {d: [pen1.x - pen0.x, ph1.x - P.x]});
  await btn('#bUnd');
  // выбор рисунка и перенос, угол
  const lnq = (await doc()).drw.find(x => x.k === 'ln'), lp = await M(`MeasureCore.drwPts('${lnq.id}')`), lm = await scr((lp[0].x + lp[1].x) / 2, lp[0].y);
  await tap(lm[0], lm[1]); ok('касание линии — выбрана', (await M('MeasureCore.sel && MeasureCore.sel.id')) === lnq.id);
  const e1 = await scr(lp[1].x, lp[1].y); await drag(e1, [e1[0], e1[1] + 30]); const lp2 = await M(`MeasureCore.drwPts('${lnq.id}')`);
  ok('конец линии тянется', lp2[1].y > lp[1].y + 100 && Math.abs(lp2[0].y - lp[0].y) < 1);
  const cp = await ctxBtn('Копия'); await tap(cp[0], cp[1]); ok('⧉ копия', (await doc()).drw.filter(x => x.k === 'ln').length === 3);
  const ds = await ctxBtn('Пунктир'); await tap(ds[0], ds[1]); ok('┄ пунктир', !!(await last()).dash);
  // ластик
  const nDr = (await doc()).drw.length; await tool('er'); const penp = await M(`MeasureCore.drwPts('${d.drw[0].id}')`);
  const ea = await scr(penp[3].x, penp[3].y - 300), eb = await scr(penp[3].x, penp[3].y + 300); await drag(ea, eb);
  ok('ластик протяжкой стёр перо', !(await doc()).drw.some(x => x.id === d.drw[0].id) && (await doc()).drw.length === nDr - 1);
  await btn('#bUnd'); ok('↶ — перо вернулось', (await doc()).drw.some(x => x.id === d.drw[0].id));
  // фото скрыто
  await btn('#zpE'); ok('фото скрыты', await M('MeasureCore.phHide')); await shot('photo-hidden');
  const ph = await at(0.5, 0.5); ok('скрытое фото не берётся касанием', !(await M(`(()=>{const h=MeasureCore.hit(${ph[0]},${ph[1]}-document.getElementById('cCv').getBoundingClientRect().top);return h&&h.t==='photo'})()`)));
  await btn('#zpE'); ok('фото снова видны', !(await M('MeasureCore.phHide')));
  // группа: рамка берёт рисунки
  await tool('rsel'); await drag(await at(0.05, 0.36), await at(0.5, 0.58)); const ms = await M('MeasureCore.msel.map(m=>m.t)');
  ok('рамка выделения берёт рисунки', ms.includes('drw'), ms);
  await M('MeasureCore.save()'); await p.reload(); await p.waitForFunction('window.MeasureCore && MeasureCore.ready');
  d = await doc(); ok('перезапуск: рисунки сохранены', d.drw.length >= 12, d.drw.length);
  await finish();
});
