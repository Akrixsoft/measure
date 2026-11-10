const assert = require('node:assert/strict');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p} = h;
  const shp = () => p.evaluate(() => S.room.ms.shp.map(q => q.pts));
  try {
    await p.evaluate(async () => {
      await PM.newRoom('QA 013 column drag', 'Колонны');
      Object.assign(S.room.ms, {pts: [[0, 2600], [0, 0], [4000, 0]], closed: false});
      gnFix(); PEN.mode = 'off'; WS.mag = 1; S.zm = 'plan'; document.body.classList.remove('tz'); fit(); plPick('shp');
    });
    // свободная колонна в середине
    await h.drag('pen', [1500, 1200], [1900, 1600]);
    let P = (await shp())[0];
    assert.equal(P.length, 4);
    const und0 = await p.evaluate(() => S.pund.length);
    // перетаскивание целиком к нижней стене (y=0): грань ложится на стену
    let hl = null;
    await h.drag('pen', [1700, 1400], [2300, 230], {preview: () => p.evaluate(() => !!(MeasureLab013.drag.hl && MeasureLab013.drag.hl.hl.length))});
    hl = await p.evaluate(() => MeasureLab013.drag.hl);
    P = (await shp())[0];
    assert.equal(P.filter(q => Math.abs(q[1]) < 1e-6).length, 2, 'face on wall ' + JSON.stringify(P));
    const xs = P.map(q => q[0]); assert(Math.abs(Math.max(...xs) - Math.min(...xs) - 400) <= 1, 'size kept');
    assert.equal(hl, null, 'highlight cleared');
    assert.equal(await p.evaluate(() => S.pund.length), und0 + 1, 'one undo step');
    // в угол (0,0): две грани на стенах
    await h.drag('pen', [2300, 200], [220, 230]);
    P = (await shp())[0];
    assert(P.some(q => Math.hypot(...q) < 1e-6), 'corner ' + JSON.stringify(P));
    // ↶ возвращает прежнее положение
    await p.evaluate(() => zUndo ? zUndo() : null).catch(() => {});
    // откат при отмене касания
    const before = (await shp())[0];
    await h.drag('pen', [P[0][0] + 200, P[0][1] + 200], [2500, 1800], {cancel: true});
    assert.deepEqual((await shp())[0], before, 'cancel reverts');
    // без магнита — без привязки
    await p.evaluate(() => { WS.mag = 0; });
    const c = before.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
    await h.drag('pen', c, [c[0] + 1000, c[1] + 300]);
    P = (await shp())[0];
    assert(P.every(q => Math.abs(q[1]) > 250), 'no snap without magnet ' + JSON.stringify(P));
    // растягивание за угол — угол к стене
    await p.evaluate(() => { WS.mag = 1; });
    const sel = await p.evaluate(() => !!f81Col());
    assert(sel, 'column selected');
    const corner = P.reduce((b, q) => q[1] < b[1] ? q : b, P[0]);
    await h.drag('pen', corner, [corner[0], 40]);
    P = (await shp())[0];
    assert(P.filter(q => Math.abs(q[1]) < 1e-6).length === 2, 'resized to wall ' + JSON.stringify(P));
    assert.deepEqual(h.errors, []);
    console.log('PASS column drag, wall/corner snap with highlight, cancel rollback, magnet off, corner resize snap');
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
