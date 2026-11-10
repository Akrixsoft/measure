// Measure 82.18 (AKX-2026-0009 F2, Z, длины плана; AKX-2026-0012 §6 авторазмеры) — инженер C.
// Ш / В / Z / отступы пером и пальцем при активном инструменте и при «выборе»; авторазмеры до граней ±0,5 мм без повторов;
// план: П-форма 512 / 2364 / 585 и прямоугольник — длины = введённым ±0,5 мм.
// Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 node tests/qa-v8218-objects.cjs
const {start} = require('./qa-v011-harness.cjs');
(async () => {
  const h = await start(); const {p, check} = h; const tag = `${process.env.QA_VW || 412}x${process.env.QA_VH || 915}`;
  const room = (L, H) => p.evaluate(async ([L, H]) => { await PM.newRoom('QA8218obj', 'R' + L); Object.assign(S.room.ms, {pts: [[0, 0], [L, 0], [L, 3000], [0, 3000]], closed: true, H, dims: [L, 3000, L, 3000].map((v, i) => ({id: 'q' + i, a: {p: i}, b: {p: (i + 1) % 4}, v}))}); PM.gnFix(); await PM.openWall(0); PM.bwSet(L, H); PM.tool('mk'); PM.zmSet('mk'); document.body.classList.remove('tz'); PM.PEN.mode = 'off'; PM.fit(); PM.draw(); }, [L, H]);
  const el = () => p.evaluate(() => { const e = S.els[0]; if (!e) return null; const v = w3Vols(w3Model()).find(x => x.id === e.id); return {k: e.k, W: +e.W, H: +e.H, D: +e.D || 0, x0: v && v.x0, x1: v && v.x1, y0: v && v.y0, y1: v && v.y1, vD: v && v.D, sel: S.sel, mk: S.mk}; });
  // поле на холсте по смыслу (w3FKind) → координаты CSS
  const fieldAt = q => p.evaluate(q => { draw(); const d = devicePixelRatio, r = cv.getBoundingClientRect(), e = S.els[0];
    const l = S.w3L.find(x => { const k = w3FKind(x); if (!k) return false; if (q.t === 'el') return k.t === 'el' && k.id === e.id && k.ax === q.ax; if (q.t === 'off') return k.t === 'off' && k.side === q.side; if (q.t === 'txt') return x.t === q.txt; return false; });
    return l ? [l.c[0] / d + r.left, l.c[1] / d + r.top] : null; }, q);
  const tapAt = async (type, c) => { await h.down(type, c); await h.up(type, c); await p.waitForTimeout(120); };
  const typeIn = async v => { await p.keyboard.press('Control+A'); await p.keyboard.type(String(v)); await p.keyboard.press('Enter'); await p.waitForTimeout(150); };
  const w3fOpen = () => p.evaluate(() => { const i = $('w3f'); return i.classList.contains('on') && i._k ? {t: i._k.t, ax: i._k.ax, side: i._k.side, focus: document.activeElement === i} : null; });
  const saved = () => p.evaluate(async () => { await flushAll(); const o = await dbGet('sess', S.sess.id); const e = o.els[0]; return {W: +e.W, H: +e.H, D: +e.D || 0, k: e.k}; });
  const near = (a, b) => Math.abs(a - b) <= 0.5;
  try {
    // ── ригель инструментом «ригель»: инструмент остаётся активным ──
    await room(4000, 2700);
    await p.evaluate(() => PM.pickTool('rig')); await h.drag('pen', [600, 2300], [2600, 2690]);
    let s = await el(); check(s && s.k === 'rig' && s.mk === 'rig' && s.sel, 'beam placed, tool stays active', s);
    // Z — поле глубины на развёртке (w3FHit) пером при активном инструменте
    { const c = await fieldAt({t: 'el', ax: 'D'}); if (c) { await tapAt('pen', c); const o = await w3fOpen(); check(o && o.ax === 'D', 'canvas depth field opens (tool active)', o); await typeIn(350); s = await el(); check(near(s.D, 350) && near(s.vD, 350), 'canvas Z = 350', s); await p.evaluate(() => { S.els[0].D = ''; saveSess(); draw(); }); } else check(false, 'canvas depth field present'); }
    for (const [type, ax, val] of [['pen', 'H', 500], ['touch', 'W', 1800]]) {
      const c = await fieldAt({t: 'el', ax}); await tapAt(type, c); const o = await w3fOpen();
      check(o && o.ax === ax && o.focus, `${type}: ${ax} field opens with tool «ригель» active`, o);
      await typeIn(val); s = await el(); check(near(ax === 'H' ? s.H : s.W, val) && s.mk === 'rig', `${type}: ${ax} = ${val} entered`, s);
    }
    let sv = await saved(); check(near(sv.H, 500) && near(sv.W, 1800), 'W/H saved', sv);
    // ручка размера: перо тянет левый нижний угол — размер меняется, правый край на месте (не перенос)
    s = await el(); const x1 = s.x1;
    const corner = await p.evaluate(() => { const e = S.els[0], R = elRect(e), d = devicePixelRatio, r = cv.getBoundingClientRect(); return R.map(q => toScr(...q)).map(q => [q[0] / d + r.left, q[1] / d + r.top]); });
    const free = await p.evaluate(C => { const d = devicePixelRatio, r = cv.getBoundingClientRect(); return C.map(c => !w3FHit([(c[0] - r.left) * d, (c[1] - r.top) * d])); }, corner);
    const ci = [3, 0, 2, 1].find(i => free[i]) ?? 0, BL = corner[ci], opp = corner[(ci + 2) % 4];
    const oppW = await p.evaluate(o => { const d = devicePixelRatio, r = cv.getBoundingClientRect(); return toW(toPl((o[0] - r.left) * d, (o[1] - r.top) * d), wf()); }, opp);
    const dir = [Math.sign(BL[0] - opp[0]) || 1, Math.sign(BL[1] - opp[1]) || 1];
    await h.drag('pen', BL, [BL[0] + 30 * dir[0], BL[1] + 15 * dir[1]], {css: true}); s = await el(); void x1;
    const oppNow = await p.evaluate(([ci]) => { const R = elRect(S.els[0]); return toW(R[(ci + 2) % 4], wf()); }, [ci]);
    check(s.W > 1800 + 50 && Math.hypot(oppNow[0] - oppW[0], oppNow[1] - oppW[1]) <= 3 && s.mk === 'rig', 'pen drags size handle with tool active (resize, opposite corner fixed)', {s, oppW, oppNow, ci});
    // перенос — протяжкой тела
    const body = await p.evaluate(() => { const e = S.els[0], q = toScr(...e.c), d = devicePixelRatio, r = cv.getBoundingClientRect(); return [q[0] / d + r.left, q[1] / d + r.top]; });
    const w0 = s.W, cx0 = (s.x0 + s.x1) / 2; await h.drag('pen', body, [body[0] + 40, body[1]], {css: true}); s = await el();
    check(near(s.W, w0) && (s.x0 + s.x1) / 2 > cx0 + 100, 'body drag moves object', s);
    // Z — поле в плашке #pp: перо и палец, ввод с клавиатуры
    for (const [type, val] of [['pen', 250], ['touch', -1]]) {
      const box = await p.evaluate(() => { const i = document.querySelector('#pp [data-lab-z]'); if (!i) return null; const r = i.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      check(!!box, `${type}: Z field in panel`, box); if (!box) continue;
      await tapAt(type, box);
      const f = await p.evaluate(() => document.activeElement && document.activeElement.matches('[data-lab-z]'));
      check(f, `${type}: Z field focused`, f);
      if (val > 0) { await typeIn(val); s = await el(); check(near(s.D, val) && near(s.vD, val), `Z = ${val}: depth and volume`, s); }
      else { await p.keyboard.press('Escape'); await p.evaluate(() => document.activeElement && document.activeElement.blur()); }
    }
    sv = await saved(); check(near(sv.D, 250), 'Z saved', sv);
    // выступ: Z −120 → ниша, объём −120
    await p.evaluate(() => { S.els[0].k = 'vys'; saveSess(); S.sel = S.els[0].id; mkPanel(); draw(); });
    await p.evaluate(() => { const i = document.querySelector('#pp [data-lab-z]'); i.focus(); i.value = '-120'; i.dispatchEvent(new Event('change')); });
    s = await el(); check(s.k === 'nis' && near(s.D, 120) && near(s.vD, -120), 'Z − on ledge → niche, volume −120', s);
    await p.evaluate(() => zUndo()); s = await el(); check(s.k === 'vys' && near(s.D, 250), 'Z change is one undo step', s);
    // ── выбор («sel»): тот же ввод ──
    await p.evaluate(() => { S.els[0].k = 'rig'; PM.pickTool('sel'); S.sel = S.els[0].id; mkPanel(); draw(); });
    { const c = await fieldAt({t: 'el', ax: 'H'}); await tapAt('touch', c); const o = await w3fOpen(); check(o && o.ax === 'H', 'sel tool: H field opens (touch)', o); await typeIn(420); s = await el(); check(near(s.H, 420), 'sel tool: H = 420', s); }
    // ── авторазмеры до граней ──
    const ad = (L, H, list) => p.evaluate(([L, H, list]) => { S.els = []; for (const [k, x0, y0, w, hh] of list) S.els.push({id: 'a' + k + x0, k, c: fromW([x0 + w / 2, y0 + hh / 2], wf()), W: w, H: hh, D: ''}); PM.pickTool('sel'); S.sel = null; PM.fit(); draw();
      return S.w3L.map(l => { const k = w3FKind(l) || {}; return {t: l.t, k: k.t, ax: k.ax, mode: k.mode, side: k.side, v: k.v}; }); }, [L, H, list]);
    const cnt = (L, t) => L.filter(x => x.t === t).length;
    await room(2364, 2700); let A = await ad(2364, 2700, [['rig', 0, 2319, 2364, 381]]); await p.screenshot({path: `/tmp/cq/objects-${tag}-beam.png`});
    check(cnt(A, '2 319') === 2 && cnt(A, '381') === 2 && cnt(A, '2 364') === 1 && cnt(A, '2 700') === 0, 'beam at ceiling: «2 319 + 381» both sides, 2 364 once, no 2 700', A.map(x => x.t));
    check(A.filter(x => x.t === '2 319').every(x => near(x.v, 2319)) && A.filter(x => x.t === '381').every(x => near(x.v, 381)), 'beam chain values ±0.5', A.filter(x => /2 319|381/.test(x.t)));
    // правка «2 319» → H стены, ригель остаётся у потолка
    { const c = await fieldAt({t: 'txt', txt: '2 319'}); await tapAt('pen', c); const o = await w3fOpen(); check(o && o.t === 'adH', '«2 319» opens wall height edit', o); await typeIn(2419);
      const r = await p.evaluate(() => { const M = w3Model(), v = w3Vols(M)[0]; return {H: M.H, y0: v.y0, y1: v.y1}; }); check(near(r.H, 2800) && near(r.y1, 2800) && near(r.y0, 2419), '«2 319»→2 419: H = 2 800, beam 381 at ceiling', r); }
    await room(3000, 2700); A = await ad(3000, 2700, [['kol', 1300, 0, 400, 2700]]); await p.screenshot({path: `/tmp/cq/objects-${tag}-column.png`});
    check(cnt(A, '1 300') === 2 && cnt(A, '400') >= 1 && A.filter(x => x.t === '400' && x.ax === 'W').length === 1 && cnt(A, '3 000') === 0, 'column middle: 1 300 · 400 · 1 300, no 3 000', A.map(x => x.t));
    check(A.filter(x => x.t === '2 700').length <= 2 && !A.some(x => x.t === '2 700' && x.k === 'el'), 'column: height not repeated on column', A.map(x => x.t + ':' + x.k));
    // отступ «до грани» при активном инструменте: 1 300 → 1 000
    await p.evaluate(() => { PM.pickTool('kol'); S.sel = S.els[0].id; draw(); });
    { const c = await fieldAt({t: 'off', side: 0}); await tapAt('pen', c); const o = await w3fOpen(); check(o && o.t === 'off', 'offset field opens with tool active', o); await typeIn(1000); s = await el(); check(near(s.x0, 1000) && near(s.x1 - s.x0, 400), 'offset left = 1 000 ±0.5', s); }
    await room(3000, 2700); A = await ad(3000, 2700, [['kor', 0, 0, 3000, 250]]);
    check(cnt(A, '2 450') === 2 && cnt(A, '250') === 2 && cnt(A, '3 000') === 1 && cnt(A, '2 700') === 0, 'box at floor: «250 + 2 450» both sides, 3 000 once', A.map(x => x.t));
    // ── план: длины перестраивают эскиз ──
    const setL = async (i, n, type) => {   // штатно: стена выбрана → касание поля длины на плане (S.plFld) → #w3f → ввод
      const c = await p.evaluate(i => { S.psel = {t: 's', i}; PL.tool = 'sel'; PM.fit(); mkPanel(); draw(); const f = S.plFld, d = devicePixelRatio, r = cv.getBoundingClientRect(); return f && f.i === i ? [f.c[0] / d + r.left, f.c[1] / d + r.top] : null; }, i);
      if (!c) return false; await tapAt(type, c); const o = await w3fOpen(); if (!o || o.t !== 'plL') return false; await typeIn(n); return true; };
    const lens = () => p.evaluate(() => { const m = S.room.ms; return [...Array(plN(m)).keys()].map(k => { const [a, b] = plSeg(m, k); return Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * 10) / 10; }); });
    await p.evaluate(async () => { await PM.newRoom('QA8218plan', 'П'); Object.assign(S.room.ms, {pts: [[0, 0], [0, 750], [2300, 750], [2300, 0]], closed: false, H: 2700, dims: [], shp: [{t: 'box', pts: [[2000, 450], [2300, 450], [2300, 750], [2000, 750]], note: ''}]}); PM.gnFix(); document.body.classList.remove('tz'); await PM.zmSet('plan'); PM.fit(); draw(); });
    for (const [i, n, t] of [[0, 512, 'pen'], [1, 2364, 'touch'], [2, 585, 'pen']]) check(await setL(i, n, t), `plan: L field С${i + 1} (${t})`);
    let Ls = await lens(); check(near(Ls[0], 512) && near(Ls[1], 2364) && near(Ls[2], 585), 'П-shape: lengths = entered ±0.5', Ls);
    const col = await p.evaluate(() => { const m = S.room.ms, q = m.shp[0], c = m.pts[2]; return Math.max(...q.pts.map(t => Math.hypot(t[0] - c[0], t[1] - c[1]))); });
    check(col < 430, 'plan column stays at its corner', col);
    await p.screenshot({path: `/tmp/cq/objects-${tag}-plan-p.png`});
    await p.evaluate(async () => { await PM.newRoom('QA8218plan', 'Прям'); Object.assign(S.room.ms, {pts: [[0, 0], [3000, 0], [3000, 2000], [0, 2000]], closed: true, H: 2700, dims: [], shp: []}); PM.gnFix(); await PM.zmSet('plan'); PM.fit(); draw(); });
    for (const [i, n] of [[0, 4000], [1, 2700], [2, 4000], [3, 2700]]) await setL(i, n, i % 2 ? 'touch' : 'pen');
    Ls = await lens(); check([4000, 2700, 4000, 2700].every((v, i) => near(Ls[i], v)), 'rectangle: lengths = entered ±0.5', Ls);
    await setL(0, 4500, 'pen'); const L2 = await lens(); const msg = await p.evaluate(() => document.getElementById('toast') && document.getElementById('toast').textContent);
    check(near(L2[0], 4000) && /не перестроен/.test(msg || ''), 'all walls measured: conflict — sketch kept, message', {L2, msg});
    await p.evaluate(() => zUndo()); check(await p.evaluate(() => { const d = plDim(S.room.ms, 0); return d && d.v === 4000; }), 'conflict entry undone by ↶');
    check(h.errors.length === 0, 'no page errors', h.errors);
  } finally { await h.close(); }
  const bad = h.checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-objects ${tag}: ${h.checks.length - bad.length}/${h.checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
