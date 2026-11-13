// AKX-2026-0015 · 82.35.19: лазер — в тронутое поле без выделения объекта; поле закрылось касанием до замера (ничего не набрано) — замер идёт в него (как btField в v81).
require('./qa-h-0015.cjs')(process.argv[3], 9371).then(async h => {
  const {ok, W, tap, M, doc, tool, key, finish} = h; const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y); await tool('sel');
  let d = await doc(); const w1 = d.walls[0];
  await M(`(() => { const D = MeasureCore.doc, k = D.elev.find(e => e.wall === '${w1.id}'); D.elev = [k]; const R0 = MeasureCore.elevRect(k); D.com.push({id: 'kx', k: 'kor', e: k.id, x: Math.round(R0.w) - 600, y: 0, w: 600, h: 900, D: 500});
    const r = MeasureCore.elevRect(k), V = MeasureCore.view; V.s = 0.13; V.ox = 206 - (r.x + r.w / 2) * V.s; V.oy = 420 - (r.y + r.h / 2) * V.s; MeasureCore.sel = null; })()`); await W(200);
  const pkt = mm => { const b = new ArrayBuffer(11), v = new DataView(b); v.setUint8(0, 0xC0); v.setUint8(1, 0x55); v.setUint8(2, 0x10); v.setFloat32(7, mm / 1000, true); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(' '); };
  const len = (d, w) => { const a = d.nodes.find(n => n.id === w.a), b = d.nodes.find(n => n.id === w.b); return Math.round(Math.hypot(b.x - a.x, b.y - a.y)); };
  const fld = async k => (await M('MeasureCore.edl()')).find(o => o.k === k && o.r.w > 0);
  let o = await fld('L'); await tap(o.r.x + o.r.w / 2, o.r.y + o.r.h / 2 + top); await W(150);
  ok('касание поля длины — ввод открыт, стена не выделена', (await M('MeasureCore.kb')).t === 'wall' && !(await M('MeasureCore.sel')), [await M('MeasureCore.kb'), await M('MeasureCore.sel')]);
  await M(`akrixBtPkt('${pkt(3456)}')`); await W(150); d = await doc(); let w = d.walls.find(q => q.id === w1.id);
  ok('лазер → длина стены 3456', w.fx && len(d, w) === 3456, len(d, w));
  o = await fld('cH'); await tap(o.r.x + o.r.w / 2, o.r.y + o.r.h / 2 + top); await W(150);
  ok('касание поля высоты короба — без выделения короба', (await M('MeasureCore.kb')).t === 'cH' && !(await M('MeasureCore.sel')), await M('MeasureCore.sel'));
  await tap(395, 330); await W(150); ok('случайное касание холста закрыло поле', !(await M('MeasureCore.kb')), await M('MeasureCore.kb'));
  await M(`akrixBtPkt('${pkt(1200)}')`); await W(150); d = await doc();
  ok('лазер после закрытия → в последнее поле (высота короба 1200)', d.com.find(c => c.id === 'kx').h === 1200, d.com.find(c => c.id === 'kx'));
  o = await fld('L'); await tap(o.r.x + o.r.w / 2, o.r.y + o.r.h / 2 + top); await W(100); await key('3000ok'); await W(150);
  await M(`akrixBtPkt('${pkt(999)}')`); await W(150); d = await doc(); w = d.walls.find(q => q.id === w1.id);
  ok('введено вручную и закрыто — следующий замер поле не трогает', len(d, w) === 3000 && (await M("document.getElementById('cToast').textContent")).includes('коснись значения'), len(d, w));
  await finish();
});
