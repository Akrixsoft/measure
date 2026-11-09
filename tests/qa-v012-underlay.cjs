const assert = require('node:assert/strict');
const {start} = require('./qa-v011-harness.cjs');

(async () => {
  const h = await start();
  const {p} = h;
  try {
    const prepared = await p.evaluate(async () => {
      await PM.newRoom('QA 012 scan', 'Исходная заливка');
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 640, 360);
      ctx.strokeStyle = '#000'; ctx.lineWidth = 12; ctx.beginPath();
      for (const [i, pt] of [[65, 65], [570, 65], [570, 290], [530, 290], [530, 300], [65, 300]].entries())
        i ? ctx.lineTo(...pt) : ctx.moveTo(...pt);
      ctx.closePath(); ctx.stroke();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await ulAdd(new File([blob], 'qa-v012-plan.png', {type: 'image/png'}));
      const u = ulGet().ul;
      const world = (x, y) => [u.x0 + x * u.s, u.y0 - y * u.s];
      await ulTap(toScr(...world(300, 175)));
      return {seed: [world(105, 160), world(325, 160), world(535, 160)],
        cuts: [[world(225, 65), world(225, 300)], [world(430, 65), world(430, 300)]],
        walls: plN(S.room.ms), status: document.getElementById("toast").textContent};
    });
    assert(prepared.walls >= 4, JSON.stringify(prepared));
    await p.locator('[data-lab12="toggle"]').click();
    await p.locator('[data-lab12="base"]').click();
    const result = await p.evaluate(async ({seed, cuts}) => {
      for (const cut of cuts) MeasureLab012.divider(...cut);
      for (const q of seed) await ulTap(toScr(...q));
      const before = MeasureLab012.regions().length;
      await ulTap(toScr(...seed[1]));
      return {before, after: MeasureLab012.regions().length, walls: plN(S.room.ms),
        names: MeasureLab012.regions().map(({q}) => q.name)};
    }, prepared);
    assert.equal(result.before, 3);
    assert.equal(result.after, 3);
    assert.equal(result.walls, prepared.walls);
    assert.equal(new Set(result.names).size, 3);
    assert.deepEqual(h.errors, []);
    console.log('PASS native scanned envelope and three virtual flood fills with repeat selection');
  } finally { await h.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
