// Measure 82.18 r2 (AKX-2026-0012, QA Н2): длинная история (> 50 шагов: подложка + план) — ↶ ×30 → перезапуск → ↶ ×5 → ↷ до «Повторять нечего»:
// возвращаются все 35 шагов, проект как до отмен; ↷ гаснет, когда повторять нечего.
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 node tests/qa-v8218-redo50.cjs
const {start} = require('./qa-v011-harness.cjs');
(async () => {
  const h = await start(); const {p, check} = h; const tag = `${process.env.QA_VW || 412}x${process.env.QA_VH || 915}`;
  const PRJ = 'QA8218 Н2 — Redo';
  const dig = () => p.evaluate(async () => { try { await flushAll(); } catch (e) { } try { await MeasureLabSketch.saveNow(); } catch (e) { }
    const K = MeasureLabSketch.state, b = await dbGet('sess', K.board), rooms = (await dbAll('sess')).filter(o => o.kind === 'room' && !o.del && o.oid === K.pid);
    return JSON.stringify({drw: (b.drw || []).map(d => d.id), pts: rooms.map(r => r.ms.pts)}); });
  const toasts = () => p.evaluate(() => (window.__tl || []).slice(-1)[0] || '');
  const hook = () => p.evaluate(() => { if (window.__th) return; window.__th = 1; window.__tl = []; const t0 = toast; toast = function (t) { __tl.push(String(t)); return t0.apply(this, arguments); }; });
  const press = async dir => { await p.evaluate(dir => (window.__tl.length = 0, dir < 0 ? zUndo() : zRedo()), dir); await p.waitForTimeout(120); };
  const reopen = async () => { await p.evaluate(async () => { await PM.flushAll(); await MeasureLabSketch.saveNow(); MeasureLabHistory.flush(); }); await p.reload();
    await p.waitForFunction(() => window.MeasureLabSketch && window.MeasureLabHistory); await p.evaluate(async n => { document.body.classList.remove('tz'); PM.PEN.mode = 'off'; if (!MeasureLabSketch.isOpen()) await MeasureLabSketch.open(n); }, PRJ); await p.waitForTimeout(500); await hook(); };
  try {
    await p.evaluate(async n => { document.body.classList.remove('tz'); PM.PEN.mode = 'off'; await MeasureLabSketch.open(n); }, PRJ); await p.waitForTimeout(300); await hook();
    // помещение проекта и план (как «Новое помещение» холста)
    await p.evaluate(async () => { const K = MeasureLabSketch.state; await newRoom(K.obj, 'Кухня', true); S.room.oid = K.pid; S.room.ms.pts = [[0, 0], [3000, 0], [3000, 2500]]; gnFix(); saveRoom(); await flushAll(); await MeasureLabSketch.loadRooms(); await MeasureLabSketch.goPlan(); });
    await p.waitForTimeout(400);
    const D0 = await dig();
    // 25 шагов подложки (линии) и 30 шагов плана (сдвиг точки), вперемешку блоками — всего 55
    await p.evaluate(() => MeasureLabSketch.activate('board')); await p.waitForTimeout(300);
    for (let i = 0; i < 25; i++) await p.evaluate(i => { snap(); S.drw.push({id: 'qn2' + i, k: 'ln', a: [i * 40, 0], b: [i * 40, 300], c: '#d33'}); saveSess(); }, i);
    await p.evaluate(() => MeasureLabSketch.goPlan()); await p.waitForTimeout(300);
    for (let i = 0; i < 30; i++) await p.evaluate(i => { plSnap(); S.room.ms.pts[2] = [3000 + (i + 1) * 10, 2500]; saveRoom(); draw(); }, i);
    const END = await dig();
    check(await p.evaluate(() => MeasureLabHistory.size()) >= 55, 'подготовка: история ≥ 55 шагов', await p.evaluate(() => MeasureLabHistory.size()));
    for (let i = 0; i < 30; i++) await press(-1);
    await reopen();
    for (let i = 0; i < 5; i++) await press(-1);
    const mid = await dig();
    let n = 0, last = ''; for (; n < 80; n++) { await press(1); last = await toasts(); if (/нечего/.test(last)) break; }
    const fin = await dig();
    check(fin === END, '↷ после перезапуска возвращает все 35 шагов: проект как до отмен', {redo: n, mid: JSON.parse(mid).drw.length, fin: JSON.parse(fin), end: JSON.parse(END)});
    const dis = await p.evaluate(() => { zLay(); const b = document.getElementById('bRed'); return b ? b.classList.contains('dis') : null; });
    check(dis === true, '↷ неактивна, когда повторять нечего', dis);
    check(D0 !== END, 'подготовка: данные менялись', null);
    check(h.errors.length === 0, 'no page errors', h.errors);
  } finally { await h.close(); }
  const bad = h.checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-redo50 ${tag}: ${h.checks.length - bad.length}/${h.checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
