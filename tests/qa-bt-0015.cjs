// AKX-2026-0015 · 82.35.18: лазер по порядку (как v81): поле не открыто, выбрана стена — замер в её длину, выбор переходит к следующей незамеренной стене по номеру.
require('./qa-h-0015.cjs')(process.argv[3], 9371).then(async h => {
  const {ok, W, tap, M, doc, tool, finish} = h; const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  for (const [x, y] of [[60, 200], [330, 200], [330, 420], [60, 420], [60, 200]]) await tap(x, y); await tool('sel');
  const pkt = mm => { const b = new ArrayBuffer(11), v = new DataView(b); v.setUint8(0, 0xC0); v.setUint8(1, 0x55); v.setUint8(2, 0x10); v.setFloat32(7, mm / 1000, true); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(' '); };
  const len = (d, w) => { const a = d.nodes.find(n => n.id === w.a), b = d.nodes.find(n => n.id === w.b); return Math.round(Math.hypot(b.x - a.x, b.y - a.y)); };
  let d = await doc(); const ws = d.walls.slice().sort((a, b) => a.gn - b.gn);
  await M('MeasureCore.sel = null'); await M(`akrixBtPkt('${pkt(3000)}')`); await W(150);
  ok('ничего не выбрано — подсказка, стены не тронуты', (await M("document.getElementById('cToast').textContent")).includes('коснись стены'));
  await M(`MeasureCore.sel = {t: 'wall', id: '${ws[0].id}'}`);
  ok('С1 выбрана', JSON.stringify(await M('MeasureCore.sel')) === JSON.stringify({t: 'wall', id: ws[0].id}), await M('MeasureCore.sel'));
  await M(`akrixBtPkt('${pkt(3456)}')`); await W(150); d = await doc(); let w1 = d.walls.find(w => w.id === ws[0].id);
  ok('С1 = 3456 (лазер без поля)', w1.fx && len(d, w1) === 3456, [w1.fx, len(d, w1)]);
  ok('выбор перешёл на С2', JSON.stringify(await M('MeasureCore.sel')) === JSON.stringify({t: 'wall', id: ws[1].id}), await M('MeasureCore.sel'));
  ok('подсказка «С1 = 3456 → С2»', (await M("document.getElementById('cToast').textContent")).includes('С' + ws[0].gn + ' = 3456 → С' + ws[1].gn));
  await M(`akrixBtPkt('${pkt(2100)}')`); await W(150); d = await doc(); const w2 = d.walls.find(w => w.id === ws[1].id);
  ok('С2 = 2100, выбор на С3', w2.fx && len(d, w2) === 2100 && (await M('MeasureCore.sel')).id === ws[2].id, [len(d, w2), await M('MeasureCore.sel')]);
  await finish();
});
