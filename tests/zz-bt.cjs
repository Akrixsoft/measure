require('./qa-h-0015.cjs')('/tmp/qbt', 9370).then(async h => {
  const {W, tap, M, doc, tool, btn} = h; const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y);
  const d = await doc(); const w1 = d.walls[0];
  await M(`(() => { const D = MeasureCore.doc, k = D.elev.find(e => e.wall === '${w1.id}'); D.elev = [k]; { const R0 = MeasureCore.elevRect(k); D.com.push({id: 'kx', k: 'kor', e: k.id, x: Math.round(R0.w) - 600, y: 0, w: 600, h: 900, D: 500}); } const r = MeasureCore.elevRect(k), V = MeasureCore.view; V.s = 0.13; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 420 - (r.y + r.h / 2) * V.s; MeasureCore.draw(); })()`); await W(200);
  const pkt = mm => { const b = new ArrayBuffer(11), v = new DataView(b); v.setUint8(0, 0xC0); v.setUint8(1, 0x55); v.setUint8(2, 0x10); v.setFloat32(7, mm / 1000, true); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(' '); };
  const E = await M('MeasureCore.edl()'); console.log('fields', JSON.stringify(E.map(o => [o.k, o.side || '', o.s ? o.s.kind + o.s.ax + Math.round(o.s.v) : '', Math.round(o.r.x), Math.round(o.r.y)])));
  for (const k of ['seg', 'cW', 'cH', 'D']) { const o = E.find(q => q.k === k && q.r.w > 0); if (!o) { console.log(k, 'нет поля'); continue; }
    await tap(o.r.x + o.r.w / 2, o.r.y + o.r.h / 2 + top); await W(150); const tg = await M('MeasureCore.kb');
    const before = JSON.stringify((await doc()).walls.find(w => w.id === w1.id));
    await M(`akrixBtPkt('${pkt(3456)}')`); await W(200); const after = (await doc()).walls.find(w => w.id === w1.id), el = (await doc()).elev[0];
    console.log(k, 'kb=', JSON.stringify({t: tg && tg.t, i: tg && tg.i}), '→ kb после', JSON.stringify(await M('MeasureCore.kb')), 'короб', JSON.stringify((await doc()).com.find(c => c.id === 'kx')), 'toast', await M("document.getElementById('cToast').textContent")); }
  process.exit(0);
});
