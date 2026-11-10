const assert = require('node:assert/strict');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p} = h;
  const tap = async w => { const pt = await h.xy(w); await h.down('pen', pt); await h.up('pen', pt); };
  const st = () => p.evaluate(() => ({sel: S.sel, els: S.els.map(e => ({id: e.id, k: e.k, N: +e.N || 1}))}));
  const btn = i => p.evaluate(i => $('zur').querySelectorAll('button')[i].click(), i);
  try {
    await h.wall();
    await p.evaluate(() => { localStorage.removeItem('measure.lab13.posts'); PM.rzToggle(true); });
    await p.locator('[data-lab-rz-comm="roz"]').click();
    await tap([2000, 1200]);
    let s = await st(); const first = s.sel; assert.equal(s.els.length, 1);
    await tap([3000, 600]);                      // пустое при выделении — только снять
    assert.equal((await st()).sel, null);
    await tap([3000, 600]);                      // пустое без выделения — новый объект
    s = await st(); const second = s.sel; assert.equal(s.els.length, 2);
    await tap([2000, 1200]);                     // касание другого объекта в инструменте — выбрать его
    s = await st(); assert.equal(s.sel, first, 'select other object with tool active'); assert.equal(s.els.length, 2);
    // посты: 3 у выбранной — запоминаются для следующих розеток
    await p.evaluate(() => $('pp').querySelector('[data-e81n="3"]').click());
    assert.equal((await st()).els.find(e => e.id === first).N, 3);
    await tap([3500, 2300]); await tap([1000, 2000]);    // снять, затем новая
    s = await st(); assert.equal(s.els.length, 3); assert.equal(s.els[2].N, 3, 'posts remembered');
    // общий 🗑 / ↶ / ↷ на объекте стены
    await btn(2); s = await st(); assert.equal(s.els.length, 2, 'delete');
    await btn(0); s = await st(); assert.equal(s.els.length, 3, 'undo delete'); assert.equal(s.els[2].N, 3);
    await btn(1); s = await st(); assert.equal(s.els.length, 2, 'redo delete');
    // перемещение выбранного пером сохраняет прежнее правило 0.4
    await tap([2000, 1200]); assert.equal((await st()).sel, first);
    const c0 = await p.evaluate(id => S.els.find(e => e.id === id).c.slice(), first);
    await h.drag('pen', [2000, 1200], [2400, 1500]);
    const c1 = await p.evaluate(id => S.els.find(e => e.id === id).c.slice(), first);
    assert(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 100, 'moved');
    void second;
    assert.deepEqual(h.errors, []);
    console.log('PASS wall objects: select by tap in tool, posts memory, delete/undo/redo, move');
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
