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
    // 82.18 g2 (QA Д5): при инструменте касание мимо выбранного снимает выбор и ставит новый объект (v81: одним касанием)
    await tap([3000, 600]);
    s = await st(); const second = s.sel; assert.equal(s.els.length, 2, 'tap outside selected places next'); assert.notEqual(second, first);
    await tap([2000, 1200]);                     // поверх другого объекта в инструменте — новый объект, другой не выбирается
    s = await st(); assert.equal(s.els.length, 3, 'tap over other object places'); assert.notEqual(s.sel, first, 'other object not selected with tool active');
    const third = s.sel;
    await tap([2000, 1200]);                     // касание выбранного — остаётся выбранным, нового нет
    s = await st(); assert.equal(s.els.length, 3); assert.equal(s.sel, third, 'tap on selected keeps it');
    // посты: 3 у выбранной — запоминаются для следующих розеток
    await p.evaluate(() => $('pp').querySelector('[data-e81n="3"]').click());
    assert.equal((await st()).els.find(e => e.id === third).N, 3);
    await tap([1000, 2000]);                     // новая
    s = await st(); assert.equal(s.els.length, 4); assert.equal(s.els[3].N, 3, 'posts remembered');
    // общий 🗑 / ↶ / ↷ на объекте стены
    await btn(2); s = await st(); assert.equal(s.els.length, 3, 'delete');
    await btn(0); s = await st(); assert.equal(s.els.length, 4, 'undo delete'); assert.equal(s.els[3].N, 3);
    await btn(1); s = await st(); assert.equal(s.els.length, 3, 'redo delete');
    // перемещение выбранного пером сохраняет прежнее правило 0.4
    await tap([3000, 600]); const mv = (await st()).sel; assert.ok(mv);
    const c0 = await p.evaluate(id => S.els.find(e => e.id === id).c.slice(), mv);
    await h.drag('pen', [3000, 600], [3400, 900]);
    const c1 = await p.evaluate(id => S.els.find(e => e.id === id).c.slice(), mv);
    assert(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 100, 'moved');
    void second; void first;
    assert.deepEqual(h.errors, []);
    console.log('PASS wall objects: tap in tool places (outside / over other), tap on selected keeps, posts memory, delete/undo/redo, move');
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
