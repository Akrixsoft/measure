const assert = require('node:assert/strict');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p} = h;
  const button = name => p.locator('[data-lab12="' + name + '"]');
  async function tap(w) {
    const a = await h.xy(w);
    await h.down('pen', a);
    await h.up('pen', a);
  }
  try {
    await p.evaluate(async () => {
      await PM.newRoom('QA 012 plan', 'Обмер');
      Object.assign(S.room.ms, {pts: [[0, 1500], [0, 0], [6000, 0], [6000, 3000], [0, 3000], [0, 1500]],
        closed: false});
      // The exterior is an open polyline; two interior divisions have no walls.
      gnFix(); PEN.mode = 'off'; WS.mag = 1; fit(); draw();
    });
    await button('toggle').click();
    for (const x of [2000, 4000]) {
      await button('divider').click();
      await tap([x, 0]); await tap([x, 3000]);
    }
    assert.equal(await p.evaluate(() => S.room.ms.labDividers.length), 2);
    for (const x of [1000, 3000, 5000]) {
      await button('fill').click(); await tap([x, 1500]);
    }
    assert.equal(await p.evaluate(() => MeasureLab012.regions().length), 3);
    assert.equal(await p.evaluate(() => S.room.ms.closed), false);
    await button('manual').click();
    for (const q of [[1000, 500], [3000, 500], [3000, 2400], [1000, 2400]]) await tap(q);
    await button('commit').click();
    assert.equal(await p.evaluate(() => MeasureLab012.regions().length), 3);
    await button('cancel').click();
    await tap([1000, 1500]);
    const name = p.getByRole('textbox', {name: 'Имя зоны', exact: true});   // AKX-2026-0010 Д10: поле зоны переименовано
    await name.fill('Прихожая'); await name.press('Tab');
    await button('assign').click(); await tap([1000, 0]); await tap([0, 800]);
    await button('assigned').click();
    await button('edit').click();
    for (const q of [[0, 0], [1900, 0], [1900, 3000], [0, 3000]]) await tap(q);
    await button('commit').click();
    const saved = await p.evaluate(async () => {
      await PM.flushAll();
      const assigned = MeasureLab012.regions().find(({q}) => q.name === 'Прихожая').q;
      return {id: S.room.id, assigned, exported: await PM.exportObjObj()};
    });
    assert.equal(saved.assigned.walls.length, 2);
    assert.equal(saved.assigned.pts.length, 4);
    assert.equal(saved.exported.rooms[0].ms.labRooms.length, 3);
    assert.equal(saved.exported.rooms[0].ms.labDividers.length, 2);
    await p.reload(); await p.waitForFunction(() => window.MeasureLab012);
    await p.evaluate(id => PM.openRoom(id), saved.id);
    assert.equal(await p.evaluate(() => MeasureLab012.regions().length), 3);
    await p.evaluate(o => zImpExp(o), saved.exported);
    assert.equal(await p.evaluate(() => MeasureLab012.regions().find(({q}) => q.name === 'Прихожая').q.walls.length), 2);
    assert.deepEqual(h.errors, []);
    console.log('PASS three open-plan rooms, overlap rejection, edit, wall assignment, persistence and JSON');

    const stable = await p.evaluate(async () => {
      await PM.newRoom('QA 012 walls', 'Распознанный контур');
      const r = S.room;
      Object.assign(r.ms, {pts: [[0, 0], [1600, 0], [1850, 300], [3000, 300], [3000, 2200], [0, 2200]],
        closed: true, ul: 1});
      gnFix(); fit(); draw();
      return r.wid[3];
    });
    await button('toggle').click(); await button('walls').click();
    await p.evaluate(() => { S.psel = {t: 's', i: 3}; draw(); });
    await button('shift').click(); await tap([3120, 1250]);
    const x = await p.evaluate(() => S.room.ms.pts[3][0]);
    assert(Math.abs(x - 3120) < 3);
    await button('split-wall').click();
    assert.equal(await p.evaluate(() => plN(S.room.ms)), 7);
    await p.evaluate(() => { S.psel = {t: 's', i: 4}; draw(); });
    await p.locator('#bDelS').click();   // 82.18: удаление — только штатная 🗑 (кнопка «Удалить участок» убрана, тот же zDelSel)
    assert.equal(await p.evaluate(() => plN(S.room.ms)), 6);
    assert(await p.evaluate(id => S.room.ms.labManualWalls && Object.values(S.room.wid).includes(id), stable));
    const column = await p.evaluate(() => {
      const W = [[[0, 0], [3000, 0]], [[0, 0], [0, 2000]]];
      const face = MeasureLab012.column([900, 21], [1450, 520], W, 80);
      const corner = MeasureLab012.column([31, 25], [500, 450], W, 80);
      const diagonal = MeasureLab012.column([500, 515], [900, 540], [[[0, 0], [1000, 1000]]], 80);
      const other = {id: 'neighbor', ms: {pts: [[105, 100], [300, 200]], closed: false}};
      S.objRooms.push(other);
      const node = MeasureLab012.snapNode(toScr(110, 103), S.room, 0);
      return {face, corner, diagonal, node};
    });
    assert.deepEqual(column.face.slice(0, 2), [[900, 0], [1450, 0]]);
    assert.deepEqual(column.corner[0], [0, 0]);
    assert(column.corner.some(([x, y]) => x === 0 && y > 0));
    assert(Math.abs(column.diagonal[0][0] - column.diagonal[0][1]) < 1e-6);
    assert.deepEqual(column.node, [105, 100]);
    await p.evaluate(async () => {
      await PM.newRoom('QA 012 column gesture', 'Колонны');
      Object.assign(S.room.ms, {pts: [[0, 2600], [0, 0], [4000, 0]], closed: false});
      gnFix(); PEN.mode = 'off'; WS.mag = 1; S.zm = 'plan'; document.body.classList.remove('tz'); fit(); plPick('shp');
    });
    await h.drag('pen', [800, 16], [1450, 500]);
    await h.drag('pen', [25, 24], [500, 480]);
    const placed = await p.evaluate(() => S.room.ms.shp.map(q => q.pts));
    assert.equal(placed.length, 2);
    assert(placed[0].filter(q => Math.abs(q[1]) < 1e-6).length === 2);
    assert(placed[1].some(q => Math.hypot(...q) < 1e-6));
    assert.deepEqual(h.errors, []);
    console.log('PASS recognized polyline shift, add and delete, column wall/corner/diagonal and wall node snap');
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
