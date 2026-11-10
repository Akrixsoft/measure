// Measure 82.18 (AKX-2026-0012, инженер C): ↶ ↷ — фото с изображением, стена, выноска; после перезапуска.
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 node tests/qa-v8218-undo.cjs
const {start} = require('./qa-v011-harness.cjs');
(async () => {
  const h = await start(); const {p, check} = h; const tag = `${process.env.QA_VW || 412}x${process.env.QA_VH || 915}`;
  const st = () => p.evaluate(() => ({refs: (S.refs || []).map(r => r.id), els: S.els.length, notes: S.notes.length, und: S.und.length, sess: S.sess && S.sess.id}));
  const click = async sel => { await p.locator(sel).click(); await p.waitForTimeout(150); };
  const reopen = async sid => { await p.evaluate(() => PM.flushAll()); await p.reload(); await p.waitForFunction(() => window.MeasureLabHistory);
    await p.evaluate(async sid => { await openSess(sid); document.body.classList.remove('tz'); PM.zmSet('mk'); PM.fit(); PM.draw(); }, sid); await p.waitForTimeout(400); };
  const red = async id => p.evaluate(async id => {   // изображение фото: Blob в базе и отрисованный пиксель внутри фото (не фон)
    const b = await dbGet('img', 'ref:' + id); const r = S.refs.find(x => x.id === id); if (!r) return {blob: b instanceof Blob, px: null};
    PM.fit(); for (let i = 0; i < 30 && !(rfImg(r)); i++) await new Promise(z => setTimeout(z, 50)); draw();
    const c = toScr(r.x + r.w / 2, r.y - rfH(r) / 2), d = cx.getImageData(Math.round(c[0]), Math.round(c[1]), 1, 1).data; return {blob: b instanceof Blob, px: [d[0], d[1], d[2]]};
  }, id);
  try {
    await h.wall();
    await p.evaluate(() => { PM.pickTool('sel'); });
    const sid = (await st()).sess;
    // фото — штатный выбор файла (🖼 стены)
    const jpg = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#d01010'; g.fillRect(0, 0, 320, 240); return c.toDataURL('image/jpeg', .9).split(',')[1]; });
    await p.setInputFiles('#fRG', {name: 'red.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64')});
    await p.waitForFunction(() => (S.refs || []).length === 1, null, {timeout: 8000}); await p.waitForTimeout(500);
    await p.evaluate(() => { if (document.getElementById('rfr').classList.contains('on')) fwClose(); });
    const id = (await st()).refs[0];
    let s = await st(); check(s.refs.length === 1, 'photo added', s);
    let im = await red(id); check(im.blob && im.px && im.px[0] > 150 && im.px[1] < 90, 'photo image drawn', im);
    // ↶ отменяет добавление фото, ↷ возвращает (шаг-снимок, не ZA)
    await click('#bUnd'); s = await st(); check(s.refs.length === 0, 'undo photo add', s);
    await click('#bRed'); s = await st(); check(s.refs.length === 1, 'redo photo add', s);
    // 🗑 — единственная кнопка удаления: выбрать фото → #bDelS
    await p.evaluate(id => { S.rsel = id; S.sel = null; draw(); zLay(); }, id);
    check(await p.evaluate(() => !document.querySelector('#rfbD') || getComputedStyle(document.querySelector('#rfbD')).display === 'none'), 'no second trash on photo bar');
    await click('#bDelS'); s = await st(); check(s.refs.length === 0, 'photo deleted by 🗑', s);
    check(await p.evaluate(async id => (await dbGet('img', 'ref:' + id)) instanceof Blob, id), 'image kept in db after delete');
    // перезапуск → ↶ → фото и изображение на месте
    await reopen(sid); s = await st(); check(s.refs.length === 0 && s.und > 0, 'after reload: deleted, history kept', s);
    await click('#bUnd'); s = await st(); check(s.refs.includes(id), 'undo after reload returns photo', s);
    im = await red(id); check(im.blob && im.px && im.px[0] > 150 && im.px[1] < 90, 'returned photo image drawn', im);
    await p.screenshot({path: `/tmp/cq/undo-photo-${tag}.png`});
    await click('#bRed'); s = await st(); check(s.refs.length === 0, 'redo deletes again', s);
    await click('#bUnd'); s = await st(); check(s.refs.includes(id), 'undo again', s);
    await reopen(sid); s = await st(); check(s.refs.includes(id), 'restored photo survives reload', s);
    // стена: колонна пером → 🗑 → перезапуск → ↶
    await p.evaluate(() => { PM.pickTool('kol'); });
    await h.drag('pen', [1600, 200], [2000, 2500]);
    s = await st(); check(s.els === 1, 'column placed', s);
    await p.evaluate(() => { S.sel = S.els[0].id; PM.pickTool('sel'); S.sel = S.els[0].id; draw(); zLay(); });
    await click('#bDelS'); s = await st(); check(s.els === 0, 'column deleted', s);
    await reopen(sid); await click('#bUnd'); s = await st(); check(s.els === 1, 'column back after reload', s);
    await click('#bRed'); s = await st(); check(s.els === 0, 'redo column delete', s);
    await click('#bUnd'); s = await st(); check(s.els === 1, 'undo column delete again', s);
    // выноска (заметка стены): два касания инструментом → 🗑 → ↶ после перезапуска
    await p.evaluate(() => { PM.pickTool('vyn'); });
    await h.drag('pen', [800, 2000], [1400, 2300]);
    s = await st(); check(s.notes === 1, 'note placed', s);
    await p.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); S.nsel = S.notes[0].id; draw(); zLay(); });
    await click('#bDelS'); s = await st(); check(s.notes === 0, 'note deleted', s);
    await reopen(sid); await click('#bUnd'); s = await st(); check(s.notes === 1 && s.els === 1 && s.refs.includes(id), 'note back after reload, others intact', s);
    // картинки не удаляются сразу: фото выноски (nAttach) и подложка плана (ulAdd) — старый ключ в корзину записи; навсегда — sessPurge
    const bin = await p.evaluate(async () => {
      const mk = async c => { const k = document.createElement('canvas'); k.width = 40; k.height = 30; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 40, 30); return new File([await new Promise(r => k.toBlob(r, 'image/jpeg'))], 'p.jpg', {type: 'image/jpeg'}); };
      const n = S.notes[0]; await nAttach(n, 'ph', await mk('#00f')); const k1 = n.ph; await nAttach(n, 'ph', await mk('#0f0')); const k2 = n.ph;
      const kept1 = (await dbGet('img', k1)) instanceof Blob, inBin = (S.sess.labBin || []).includes(k1);
      await zmSet('plan'); await ulAdd(await mk('#f00')); const u1 = S.room.ul.key; await ulAdd(await mk('#ff0')); const u2 = S.room.ul.key;
      const keptU = (await dbGet('img', u1)) instanceof Blob, inRoomBin = (S.room.bin || []).includes(u1);
      await flushAll(); const w = await dbGet('sess', S.room.segs[0]); const purgeKeys = [...(w.labBin || [])];
      await sessPurge(await dbGet('sess', S.room.id)); const gone = await Promise.all([k1, u1, ...purgeKeys].map(async k => !(await dbGet('img', k))));
      return {kept1, inBin, keptU, inRoomBin, k2: k2 !== k1, u2: u2 !== u1, purged: gone.every(Boolean), n: purgeKeys.length};
    });
    check(bin.kept1 && bin.inBin && bin.k2, 'note photo replaced: old image kept in sess.labBin', bin);
    check(bin.keptU && bin.inRoomBin && bin.u2, 'plan underlay replaced: old image kept in room.bin', bin);
    check(bin.purged && bin.n >= 2, 'sessPurge deletes binned images', bin);
    check(h.errors.length === 0, 'no page errors', h.errors);
  } finally { await h.close(); }
  const bad = h.checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-undo ${tag}: ${h.checks.length - bad.length}/${h.checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
