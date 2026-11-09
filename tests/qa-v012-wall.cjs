const assert = require('node:assert/strict');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p} = h;
  const state = () => p.evaluate(() => S.els.find(e => e.id === S.sel));
  async function field(key, value) {
    const input = p.locator('[data-lab12-size="' + key + '"]');
    await input.fill(String(value));
    await input.press('Tab');
  }
  try {
    await h.wall();
    await p.evaluate(() => PM.rzToggle(true));
    await p.locator('[data-lab-rz-comm="zon"]').click();
    await p.locator('#zopt [data-zo=sn]').click();
    await h.drag('pen', [30, 1750], [1150, 2200]);
    assert.equal((await state()).k, 'zon');
    assert.equal((await state()).labEdges.x, 'L');
    await field('W', 740); await field('H', 380); await field('D', 140);
    await field('R', 200);
    await field('W', 810);
    let e = await state();
    assert.deepEqual([e.W, e.H, e.D], [810, 380, 140]);
    assert.equal(e.labEdges.x, 'R');
    assert.equal(await p.locator('[data-lab12-size="R"]').inputValue(), '200');
    await p.evaluate(() => bwSet(4100, 2700));
    assert.equal(await p.locator('[data-lab12-size="R"]').inputValue(), '200');
    await p.locator('[data-lab-rz-comm="shield"]').click();
    await h.drag('pen', [1350, 1200], [1780, 1670]);
    assert.equal((await state()).k, 'shield');
    await field('W', 520); await field('H', 610); await field('D', 95); await field('F', 430);
    e = await state();
    assert.deepEqual([e.W, e.H, e.D], [520, 610, 95]);
    assert.equal(e.labEdges.y, 'F');
    await p.locator('[data-lab-rz-comm="wire"]').click();
    const pt = await h.xy([2400, 1200]);
    await h.down('pen', pt); await h.up('pen', pt);
    assert.equal((await state()).k, 'wire');
    const result = await p.evaluate(async () => {
      await PM.saveNow(); return PM.exportObjObj();
    });
    const wall = result.rooms.flatMap(r => Object.values(r.ms.wl)).find(w => w.zn?.length === 2);
    assert.equal(wall.zn.find(z => z.t === 'shield').D, 95);
    assert.equal(wall.zn.find(z => !z.t).D, 140);
    assert(wall.pts.some(z => z.t === 'wire'));
    await p.evaluate(async o => { await zImpExp(o); await PM.openWall(0); }, result);
    const restored = await p.evaluate(() => S.els.filter(e => ['zon', 'shield', 'wire'].includes(e.k)));
    assert.deepEqual(restored.map(e => [e.k, e.D]).sort(), [['shield', 95], ['wire', ''], ['zon', 140]]);
    assert.deepEqual(h.errors, []);
    console.log('PASS zone and shield dimensions, edge binding, wire point and JSON roundtrip');
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
