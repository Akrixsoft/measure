// Measure 82.18 (AKX-2026-0012 инженер C, AKX-2026-0009): футляр в каждом режиме, блок фото в нижней строке, одна 🗑, без 📐, строки без «ступенек».
// Телефонный интерфейс: body.tz снят. Запуск: NODE_PATH=/opt/npm-tools/node_modules QA_VW=412 QA_VH=797 QA_DPR=3 node tests/qa-v8218-tools.cjs
const {start} = require('./qa-v011-harness.cjs');
(async () => {
  const h = await start(); const {p, check} = h; const tag = `${process.env.QA_VW || 412}x${process.env.QA_VH || 915}`;
  const shot = n => p.screenshot({path: `/tmp/cq/tools-${tag}-${n}.png`});
  // строки стека #zf: видимые дети (и #zopt внутри #zb), вертикальные зазоры, «ступеньки» (неполные строки)
  const rows = () => p.evaluate(() => {
    const zf = document.getElementById('zf'), Z = zf.getBoundingClientRect(), vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden'; };
    const R = [...zf.children].filter(vis).map(e => { const r = e.getBoundingClientRect(); return {id: e.id || e.className, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width)}; });
    const gaps = []; for (let i = 1; i < R.length; i++) gaps.push(R[i].t - R[i - 1].b);
    const partial = R.filter(x => x.id !== 'pp' && x.w < Z.width * 0.9).map(x => x.id);   // #pp — штатная плашка выбранного (v81)
    const fixedFloating = [...document.querySelectorAll('body > *')].filter(e => vis(e) && getComputedStyle(e).position === 'fixed' && /lab/.test(e.id || e.className) && !/labModal|labSketch|toast/.test(e.id)).map(e => e.id || e.className);
    const out = R.length ? Math.max(0, R[R.length - 1].b - innerHeight) : 0;
    return {R, gaps, maxGap: gaps.length ? Math.max(...gaps) : 0, partial, fixedFloating, out, zf: [Math.round(Z.left), Math.round(Z.right)]};
  });
  const layoutOk = async (name) => { const r = await rows(); check(r.maxGap <= 6 && r.gaps.every(g => g >= 0), `${name}: rows without holes (gap ≤ 6)`, r.gaps); check(!r.partial.length, `${name}: no partial («step») rows`, r.R); check(!r.fixedFloating.length, `${name}: no floating Lab plates`, r.fixedFloating); check(r.out <= 0, `${name}: rows inside screen`, r.out); return r; };
  const noRuler = async name => check(await p.evaluate(() => !document.body.innerText.includes('\u{1F4D0}') && ![...document.querySelectorAll('[title]')].some(e => e.title.includes('\u{1F4D0}'))), `${name}: no 📐`);
  const oneTrash = async name => { const L = await p.evaluate(() => [...document.querySelectorAll('button, i, [role=button]')].filter(e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || getComputedStyle(e).visibility === 'hidden') return false; if (e.closest('#tb,#ss,#labModal,#labPrj')) return false; const t = (e.title || '') + ' ' + e.textContent; return e.id !== 'bDelS' && (/(^|\s)Удал/.test(e.title || '') || /🗑/.test(e.textContent) || e.querySelector('use[href="#h-trash"]')); }).map(e => e.id || e.title || e.textContent.trim()));
    check(!L.length, `${name}: only #bDelS deletes`, L); };
  const tiles = () => p.evaluate(() => { const t = document.getElementById('tb'); const T = [...t.querySelectorAll('.tl')].filter(x => x.getBoundingClientRect().width > 0); const lab = T.filter(x => x.dataset.labTb);
    const sz = T.slice(0, 3).concat(lab).map(x => { const r = x.getBoundingClientRect(), s = x.querySelector('svg'), q = s && s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), q ? Math.round(q.width) : 0]; });
    return {on: t.classList.contains('on'), lab: lab.map(x => x.dataset.labTb), sz, wire: t.querySelectorAll('.tl[data-k=wire]').length, shield: t.querySelectorAll('.tl[data-k=shield]').length, bad: t.querySelectorAll('[data-lab-tb=open],[data-lab-tb=obj],[data-lab-tb=close]').length}; });
  const closeTb = () => p.evaluate(() => document.getElementById('tb').classList.remove('on'));
  const sizeOk = (T, name) => check(T.sz.length && T.sz.every(([w, h2, s]) => w === 36 && h2 === 36 && s === 22), `${name}: tiles 36×36, icon 22 (as v81 case)`, T.sz);
  try {
    // ── план ──
    await p.evaluate(async () => { await PM.newRoom('QA8218', 'Кухня'); Object.assign(S.room.ms, {pts: [[0, 0], [4000, 0], [4000, 2700], [0, 2700]], closed: true, H: 2700, dims: [4000, 2700, 4000, 2700].map((v, i) => ({id: 'q' + i, a: {p: i}, b: {p: (i + 1) % 4}, v}))}); PM.gnFix(); document.body.classList.remove('tz'); await PM.zmSet('plan'); PM.fit(); zLay(); mkChips(); mkPanel(); PM.draw(); });
    await p.waitForTimeout(300); await shot('1-plan');
    let r = await layoutOk('plan'); check(await p.evaluate(() => { const o = document.getElementById('zopt'); return !o.classList.contains('on') || o.parentNode.id === 'zb'; }), 'plan: L/🧲 in tool row (not own row)');
    check(await p.evaluate(() => { const ch = [...document.querySelectorAll('#ch [data-pk]')].map(x => x.dataset.pk); return [...document.querySelectorAll('#plb [data-pb]')].filter(x => x.getBoundingClientRect().width > 0).every(x => !ch.includes(x.dataset.pb)); }), 'plan: no duplicates #plb ↔ #ch');
    await noRuler('plan');
    await p.locator('#labPlF').click(); await p.waitForTimeout(150); let T = await tiles(); await shot('2-plan-tb');
    check(T.on, 'plan: case opens from #labPlF', T); sizeOk(T, 'plan case'); check(T.lab.includes('fdim') && T.bad === 0, 'plan case: Lab tiles, no open/obj/close', T.lab);
    check(await p.evaluate(() => !window.MeasureLabPrd || !!document.querySelector('#tb [data-lab-tb=prd]')), 'plan case: «Изделие» tile when MeasureLabPrd present');
    await p.locator('#tb [data-lab-tb=fdim]').click(); await p.waitForTimeout(150);
    check(await p.evaluate(() => PL.tool === 'labFloorDim' && !!document.querySelector('#ch [data-lab-fdim].on')), 'plan: «Размер пола» from case, shown active in row');
    await layoutOk('plan floor-dim');
    if (await p.evaluate(() => !!(window.MeasureLab012 && MeasureLab012.open))) {   // зоны (AKX-2026-0010): плитка «Зона» → строка стека, без своих 🗑
      await p.evaluate(() => { PL.tool = 'sel'; mkChips(); }); await p.locator('#labPlF').click(); await p.waitForTimeout(100); await p.locator('#tb [data-lab-tb=zone]').click(); await p.waitForTimeout(300);
      const z = await p.evaluate(() => { const e = document.getElementById('lab12-plan'); return {open: MeasureLab012.isOpen(), par: e.parentElement.id, pos: getComputedStyle(e).position}; });
      check(z.open && z.par === 'zf' && z.pos === 'static', 'zones: tile «Зона» opens zones, panel is a row of #zf', z); await layoutOk('plan zones'); await oneTrash('plan zones'); await shot('2b-zones');
      await p.evaluate(() => { MeasureLab012.close(); mkPanel(); draw(); zLay(); });
    }
    // трасса пола: строка модификаторов на всю ширину; выход — L / 🧲 снова (F1)
    await p.evaluate(() => { PL.tool = 'prt'; mkChips(); mkPanel(); zLay(); draw(); }); await p.waitForTimeout(150); await shot('3-plan-route');
    r = await layoutOk('plan route');
    await p.evaluate(() => { PL.tool = 'sel'; mkChips(); mkPanel(); zLay(); draw(); }); await p.waitForTimeout(150);
    check(await p.evaluate(() => !document.getElementById('labRouteType') && document.querySelectorAll('#zopt [data-pm]').length === 2), 'F1: after route — native L/🧲 back, no route type');
    // ── стена ⌖ ──
    await h.wall(); await p.evaluate(() => { PM.pickTool('sel'); zLay(); mkChips(); }); await p.waitForTimeout(200); await shot('4-wall');
    await layoutOk('wall'); await noRuler('wall');
    await p.locator('#zpF').click(); await p.waitForTimeout(150); T = await tiles(); await shot('5-wall-tb');
    check(T.on && T.wire === 1 && T.shield === 1 && T.bad === 0, 'wall: case, wire/shield once, no open/obj/close', T); sizeOk(T, 'wall case'); await closeTb();
    // размер: опции — справа в ряду инструментов (без «ступеньки»)
    await p.evaluate(() => { PM.pickTool('dim'); zLay(); }); await p.waitForTimeout(150); await layoutOk('wall dim');
    // выбранные объекты: в плашке нет своей кнопки удаления
    await p.evaluate(() => PM.pickTool('kol')); await h.drag('pen', [1600, 200], [2000, 2500]);
    await p.evaluate(() => { S.sel = S.els[0].id; PM.pickTool('sel'); S.sel = S.els[0].id; mkPanel(); draw(); zLay(); }); await p.waitForTimeout(150); await shot('6-wall-sel');
    await oneTrash('wall element selected'); await layoutOk('wall element selected');
    await p.evaluate(() => PM.pickTool('dim')); await h.drag('pen', [500, 600], [2500, 600]);
    await p.evaluate(() => { PM.pickTool('sel'); S.dsel = S.dms[0] && S.dms[0].id; S.sel = null; mkPanel(); draw(); zLay(); }); await oneTrash('wall dim selected');
    await p.evaluate(() => PM.pickTool('vyn')); await h.drag('pen', [800, 2000], [1400, 2300]);
    await p.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); PM.pickTool('sel'); S.nsel = S.notes[0] && S.notes[0].id; mkPanel(); draw(); zLay(); }); await oneTrash('wall note selected');
    await p.evaluate(() => { S.nsel = null; S.dsel = null; S.sel = null; mkPanel(); draw(); zLay(); });
    // ── фото выбрано: блок в нижней строке ──
    const jpg = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = '#3070d0'; g.fillRect(0, 0, 320, 240); return c.toDataURL('image/jpeg', .9).split(',')[1]; });
    await p.setInputFiles('#fRG', {name: 'b.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpg, 'base64')});
    await p.waitForFunction(() => (S.refs || []).length === 1, null, {timeout: 8000}); await p.waitForTimeout(400);
    await p.evaluate(() => { if (document.getElementById('rfr').classList.contains('on')) fwClose(); PM.fit(); });
    // касание фото пальцем — выбор
    const c = await p.evaluate(() => { const r = S.refs[0], q = toScr(r.x + r.w / 2, r.y - rfH(r) / 2), b = cv.getBoundingClientRect(); return [q[0] / devicePixelRatio + b.left, q[1] / devicePixelRatio + b.top]; });
    await h.down('touch', c); await h.up('touch', c); await p.waitForTimeout(250); await shot('7-photo');
    const ph = await p.evaluate(() => { const g = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? [Math.round(r.left), Math.round(r.right), Math.round(r.top), Math.round(r.bottom)] : null; };
      const B = [...document.querySelectorAll('#labPh>button')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; });
      const gaps = B.slice(1).map((x, i) => x[0] - B[i][1]); const cl = document.querySelector('#zpb .zcols');   // лента цветов (прокручивается — первый цвет может быть под краем)
      return {sel: S.rsel, zpb: g('#zpb'), zpF: g('#zpF'), B, gaps, cl: cl ? g('#zpb .zcols') : null, und: g('#bUnd'), rfb: g('#rfb'), zur: document.getElementById('zur').parentElement.id, zfB: Math.round(document.getElementById('zf').getBoundingClientRect().bottom)}; });
    check(ph.sel && ph.zpb && ph.B.length >= 2, 'photo: block in bottom row', ph);
    check(ph.zpF && ph.zpF[1] <= ph.B[0][0] && ph.B[ph.B.length - 1][1] <= (ph.cl ? ph.cl[0] : 1e9) && (ph.cl ? ph.cl[1] : 0) <= ph.und[0], 'photo: order 🖍 < tools < colours < ↶', ph);
    check(ph.gaps.every(g => g >= 0 && g <= 6), 'photo: tools without gaps (≤ 6)', ph.gaps);
    check(!ph.rfb && ph.zur === 'zpb' && Math.abs(ph.zpb[3] - ph.zfB) <= 1, 'photo: no floating #rfb, ↶↷🗑 in the same bottom row', ph);
    await layoutOk('photo selected'); await oneTrash('photo selected');
    await p.locator('#labPh [data-lab-ph=full]').click(); await p.waitForTimeout(200);
    check(await p.evaluate(() => document.getElementById('rfv').classList.contains('on')), 'photo: ⤢ from block opens viewer');
    await p.evaluate(() => { try { document.getElementById('rfv').classList.remove('on'); } catch (e) { } });
    // касание пустого места — выбор снят, ↶ ↷ 🗑 на штатном месте
    const e0 = await h.xy([200, 2600]); await h.down('touch', e0); await h.up('touch', e0); await p.waitForTimeout(200);
    check(await p.evaluate(() => !S.rsel && !document.body.classList.contains('lab-ph') && !document.getElementById('labPh')), 'photo deselected: block gone');
    // ── «Коммуникации и размеры» ──
    await p.evaluate(() => { PM.rzToggle(true); zLay(); }); await p.waitForTimeout(200); await shot('8-rz');
    await layoutOk('rz');
    check(await p.evaluate(() => { const t = document.getElementById('rzT'); return !t || getComputedStyle(t).position !== 'absolute'; }), 'F7: #rzT in flow');
    await p.locator('#zpF').click(); await p.waitForTimeout(150); T = await tiles(); check(T.on && T.bad === 0, 'rz: case from 🖍', T); await closeTb(); await noRuler('rz');
    await p.evaluate(() => { PM.rzToggle(false); zLay(); });
    // ── холст (контракт 82.18: группа «Холст» без open/obj/close) ──
    const sk = await p.evaluate(async () => { if (!window.MeasureLabSketch) return null; await MeasureLabSketch.open('QA011'); await new Promise(r => setTimeout(r, 300)); tbOpen(); return [...document.querySelectorAll('#tb [data-lab-tb]')].map(x => x.dataset.labTb); });
    check(sk && ['cam', 'gal', 'note', 'room', 'plan', 'exp', 'imp'].every(a => sk.includes(a)) && !sk.some(a => ['open', 'obj', 'close'].includes(a)), 'canvas case: «Холст» tiles without open/obj/close', sk);
    await shot('9-canvas-tb'); await closeTb();
    check(h.errors.length === 0, 'no page errors', h.errors);
  } finally { await h.close(); }
  const bad = h.checks.filter(c => !c.ok); console.log(`${bad.length ? 'FAIL' : 'PASS'} qa-v8218-tools ${tag}: ${h.checks.length - bad.length}/${h.checks.length}`); if (bad.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
