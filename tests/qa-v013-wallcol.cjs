const assert = require('node:assert/strict');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p} = h;
  try {
    await p.evaluate(async () => {
      await PM.newRoom('QA 013 wall column', 'К');
      Object.assign(S.room.ms, {pts: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]], closed: true, H: 2700,
        dims: [4000, 3000, 4000, 3000].map((v, i) => ({id: 'd' + i, a: {p: i}, b: {p: (i + 1) % 4}, v})),
        shp: [{t: 'box', pts: [[1000, 0], [1400, 0], [1400, 300], [1000, 300]], note: ''}]});
      gnFix(); saveRoom(); await new Promise(r => setTimeout(r, 400));
      await PM.openWall(0); PM.bwSet(4000, 2700); fit(); draw();
      await new Promise(r => setTimeout(r, 400));   // 82.18 int: отложенный saveRoom (250 мс) открытия стены — до правок, как у человека; иначе он перезаписывал правки lab-v013 (нестабильно и на 51923bf)
    });
    // ввод через штатное поле #w3f (как пользователь): open → value → change
    // поле выбирается по смыслу: f — off|W|D|H, side — 0 лево / 1 право
    const set = (f, side, n) => p.evaluate(([f, side, n]) => {
      draw(); const l = S.w3L.find(x => { const k = w3FKind(x); return k && (f === 'H' ? k.why === 'col-h' : k.t === 'pvol' && k.f === f && (side == null || k.side === side)); });
      if (!l) return 'nofield'; w3FOpen(l);
      const i = $('w3f'); if (!i._k) return 'closed'; i.value = String(n); i.dispatchEvent(new Event('change')); return i._k ? 'open' : 'ok';
    }, [f, side, n]);
    const box = () => p.evaluate(() => S.room0.ms.shp[0]);
    assert.equal(await set('off', 0, 2000), 'ok');
    let q = await box();
    assert.deepEqual(q.pts.map(x => x[0]).sort((a, b) => a - b), [1600, 1600, 2000, 2000], 'offset ' + JSON.stringify(q.pts));
    assert.equal(await set('W', null, 500), 'ok');
    q = await box();
    assert.deepEqual([Math.min(...q.pts.map(x => x[0])), Math.max(...q.pts.map(x => x[0]))], [1500, 2000], 'width, left edge kept ' + JSON.stringify(q.pts));
    assert.equal(q.W, 500);
    assert.equal(await set('D', null, 350), 'ok');
    q = await box();
    assert.deepEqual([Math.min(...q.pts.map(x => x[1])), Math.max(...q.pts.map(x => x[1]))], [0, 350], 'depth from wall');
    // объём на развёртке совпадает с введённым
    const v = await p.evaluate(() => w3Vols(w3Model()).find(x => x.id === 'p0'));
    assert.deepEqual([v.x0, v.x1, v.D], [2000, 2500, 350]);
    // правый отступ
    assert.equal(await set('off', 1, 1200), 'ok');
    const v2 = await p.evaluate(() => w3Vols(w3Model()).find(x => x.id === 'p0'));
    assert.deepEqual([v2.x0, v2.x1], [2300, 2800]);
    // ↶ возвращает шаг
    await p.evaluate(() => $('zur').querySelectorAll('button')[0].click());
    const v3 = await p.evaluate(() => w3Vols(w3Model()).find(x => x.id === 'p0'));
    assert.deepEqual([v3.x0, v3.x1], [2000, 2500], 'undo');
    await p.evaluate(() => $('zur').querySelectorAll('button')[1].click()); assert.deepEqual(await p.evaluate(() => { const v = w3Vols(w3Model()).find(x => x.id === 'p0'); return [v.x0, v.x1]; }), [2300, 2800], 'redo');
    // высота колонны плана — сообщение, не ввод
    assert.ok(['closed', 'nofield'].includes(await set('H', null, 1000)));   // 82.18 авторазмеры: высота колонны от пола до потолка = H стены — не повторяется (поля нет)
    // сохранено в базе
    const saved = await p.evaluate(async () => (await dbGet('sess', S.room0.id)).ms.shp[0].pts);
    assert(saved.every(x => x[1] === 0 || x[1] === 350));
    assert.deepEqual(h.errors, []);
    console.log('PASS plan column fields on wall view: offset L/R, width, depth, undo, persistence');
    // сценарий скриншота 0.12: уступы у краёв стены (авто-выступы общих стен), 374×317 слева, 701×514 справа
    await p.evaluate(async () => {
      await PM.newRoom('QA 013 ledges', 'С20');
      Object.assign(S.room.ms, {pts: [[0, 0], [2600, 0], [2600, 3000], [0, 3000]], closed: true, H: 2700,
        dims: [2600, 3000, 2600, 3000].map((v, i) => ({id: 'e' + i, a: {p: i}, b: {p: (i + 1) % 4}, v})),
        shp: [{t: 'box', auto: 1, note: 'выступ', pts: [[2226, 0], [2600, 0], [2600, 317], [2226, 317]]},
              {t: 'box', auto: 1, note: 'выступ', pts: [[0, 0], [701, 0], [701, 300], [400, 300], [400, 514], [0, 514]]}]});
      gnFix(); saveRoom(); await new Promise(r => setTimeout(r, 400));
      await PM.openWall(0); PM.bwSet(2600, 2700); fit(); draw();
    });
    const vols = () => p.evaluate(() => w3Vols(w3Model()).map(v => [v.id, Math.round(v.x0), Math.round(v.x1), Math.round(v.D)]));
    let V = await vols();
    assert.deepEqual(V, [['p0', 0, 374, 317], ['p1', 1899, 2600, 514]], JSON.stringify(V));
    const setId = (id, f, n) => p.evaluate(([id, f, n]) => {
      draw(); const l = S.w3L.find(x => { const k = w3FKind(x); return k && k.t === 'pvol' && k.id === id && k.f === f; });
      if (!l) return 'nofield'; w3FOpen(l); const i = $('w3f'); if (!i._k) return 'closed'; i.value = String(n); i.dispatchEvent(new Event('change')); return 'ok';
    }, [id, f, n]);
    assert.equal(await setId('p0', 'W', 400), 'ok');
    assert.equal(await setId('p0', 'D', 320), 'ok');
    assert.equal(await setId('p1', 'W', 700), 'ok');      // у правого края — правый край на месте
    assert.equal(await setId('p1', 'D', 500), 'ok');      // фасонный контур — растяжение по глубине
    V = await vols();
    assert.deepEqual(V, [['p0', 0, 400, 320], ['p1', 1900, 2600, 500]], JSON.stringify(V));
    const poly = await p.evaluate(() => S.room0.ms.shp[1].pts);
    assert.equal(poly.length, 6);
    assert.deepEqual(h.errors, []);
    console.log('PASS ledges at wall ends (screenshot 0.12): width/depth input, polygon ledge scaled');
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
