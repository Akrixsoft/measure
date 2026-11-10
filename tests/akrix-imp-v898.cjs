// Копия AKX-2026-0013/scripts/imp.cjs (ai-team) для qa-v8218-prd: импорт выгрузки Замера в конструктор v898 штатным путём.
// AKX-2026-0013: импорт выгрузок Замера в конструктор v898 штатным путём (Холст → 📐 лист замера → ⇧ → выбор файла)
// Usage: node imp.cjs <page.html> <outdir> <file1.json> [file2.json ...]
const fs = require('fs'), path = require('path'), {chromium} = require('playwright');
const [PAGE, OUT, ...FILES] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox']});
  const all = [];
  for (const F of FILES) {
    const tag = path.basename(F, '.json'), r = {file: path.basename(F), steps: []};
    const ctx = await b.newContext({viewport: {width: 1400, height: 900}}), p = await ctx.newPage(), errs = [], cons = [];
    p.on('pageerror', e => errs.push(String(e.stack || e).slice(0, 600))); p.on('console', m => { if (['error', 'warning'].includes(m.type())) cons.push(m.type() + ': ' + m.text().slice(0, 300)); });
    await p.goto('file://' + PAGE); await p.waitForTimeout(2500);
    // тосты — перехват текста
    await p.evaluate(() => { window.__toasts = []; const t0 = window.toast; window.toast = function (m) { window.__toasts.push(String(m)); return t0.apply(this, arguments); }; });
    r.toolbarTitles = await p.evaluate(() => [...document.querySelectorAll('header button, .top button, #hdr button')].map(x => x.title).filter(Boolean).slice(0, 30));
    // 1) неверный, но очевидный путь: «Открыть проект из файла»
    r.projectOpen = await p.evaluate(() => { window.__toasts = []; return typeof prjFileIn === 'function'; });
    try { const [fc] = await Promise.all([p.waitForEvent('filechooser', {timeout: 4000}), p.evaluate(() => prjFileIn())]); r.projectOpenAccept = await fc.element().getAttribute('accept'); await fc.setFiles(F); await p.waitForTimeout(1200); r.projectOpenToasts = await p.evaluate(() => window.__toasts.slice()); } catch (e) { r.projectOpenErr = String(e).slice(0, 300); }
    // 2) штатный путь: Холст → 📐 → ⇧
    await p.evaluate(() => { window.__toasts = []; });
    await p.click('text=Холст'); await p.waitForTimeout(1500);
    const bb = await p.evaluate(() => { const x = [...document.querySelectorAll('[data-tip]')].find(x => x.offsetParent && x.dataset.tip.startsWith('Помещение: показ')); const q = x.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    await p.mouse.click(bb[0], bb[1]); await p.waitForTimeout(800);
    const cb = await p.evaluate(() => { const m = document.querySelector('[data-sb=msh]').closest('.gg').querySelector('[data-ggm]'); const q = m.getBoundingClientRect(); return [q.right - 4, q.bottom - 4]; });
    await p.mouse.click(cb[0], cb[1]); await p.waitForTimeout(600);
    r.mshVisible = await p.isVisible('[data-sb=msh]');
    await p.screenshot({path: path.join(OUT, `imp-${tag}-0-canvas.png`)});
    await p.click('[data-sb=msh]'); await p.waitForTimeout(800);
    r.impVisible = await p.isVisible('[data-ms=imp]');
    const [fc] = await Promise.all([p.waitForEvent('filechooser', {timeout: 5000}), p.click('[data-ms=imp]')]);
    r.impAccept = await fc.element().getAttribute('accept');
    await fc.setFiles(F); await p.waitForTimeout(2500);
    r.toasts = await p.evaluate(() => window.__toasts.slice());
    await p.screenshot({path: path.join(OUT, `imp-${tag}-1-sheet.png`)});
    r.state = await p.evaluate(() => { const sk = prod().sk, m = sk && sk.ms, Z = P.zam;
      return {ms: m ? {npts: (m.pts || []).length, closed: m.closed, nseg: msNSeg(m), wlKeys: Object.keys(m.wl || {}), zam: m.zam || null, geo: !!(m.geo && m.geo.walls), shp: (m.shp || []).length, wid: m.wid || null, gn: m.gn || null} : null,
        zam: Z ? {obj: Z.obj, oid: Z.oid, rooms: Z.rooms.map(q => ({id: q.id, name: q.name, nseg: msNSeg(q.ms)}))} : null, tabZw: !!document.getElementById('tabZw')}; });
    // 3) ✓ В стены
    await p.evaluate(() => { window.__toasts = []; });
    const go = await p.$('[data-mst=go]'); if (go) { await go.click(); await p.waitForTimeout(2000); }
    r.buildToasts = await p.evaluate(() => window.__toasts.slice());
    await p.screenshot({path: path.join(OUT, `imp-${tag}-2-built.png`)});
    r.walls = await p.evaluate(() => { const sk = prod().sk, ws = wlWalls(sk);
      return ws.map(w => { const els = (w.els || w.ob || []); return {id: w.id, L: w.L, H: w.H, zid: w.zid || null, zg: w.zg ?? null, ms: w.ms || null, lbl: (() => { try { return wlLbl(sk, w.id); } catch (e) { return null; } })(), keys: Object.keys(w)}; }); });
    r.room = await p.evaluate(() => { try { const R = wlRm(prod().sk); return {keys: Object.keys(R), shp: (R.shp || []).length}; } catch (e) { return String(e); } });
    // объекты на стенах — всё, что конструктор хранит по стене
    r.wallObjs = await p.evaluate(() => { const sk = prod().sk; return wlWalls(sk).map(w => ({id: w.id, lbl: (() => { try { return wlLbl(sk, w.id); } catch (e) { return null; } })(), ob: JSON.stringify(Object.fromEntries(Object.entries(w).filter(([k]) => !['x', 'z', 'A', 'L', 'H', 'T', 'id'].includes(k)))).slice(0, 2500)})); });
    r.roomEls = await p.evaluate(() => { const sk = prod().sk, R = wlRm(sk), lb = id => { try { return wlLbl(sk, id); } catch (e) { return id; } }; return (R.els || []).map(e => ({...e, wl: lb(e.w)})); });
    r.zphKeys = await p.evaluate(() => { const out = []; const sk = prod().sk; Object.entries((sk.ms || {}).wl || {}).forEach(([k, W]) => (W.ph || []).forEach(q => out.push({k, id: q.id, key: q.k || null, jpg: !!q.jpg}))); return out; });
    // путь 🧩 (общий план → изделие): новое изделие, назначить стены С1–С4 и построить (zwBuild — через API, как в t893)
    r.zw = await p.evaluate(() => { try { msClose(); } catch (e) {} const q = newProduct('QA13 zw'); q.showSk = true; P.products.push(q); P.active = P.products.length - 1; renderTabs(); renderProduct();
      const i = P.active, sk = (P.products[i].sk = P.products[i].sk || newSketch()); const Z = P.zam, m = Z.rooms[0].ms; sk.zw = Object.keys(m.wl).map(k => zwKey(m, +k)); const o = zwBuild(i); save();
      const lb = id => { try { return wlLbl(sk, id); } catch (e) { return id; } };
      return {zwKeys: sk.zw, o, walls: wlWalls(sk).map(w => ({id: w.id, lbl: lb(w.id), zid: w.zid || null, zg: w.zg ?? null, L: w.L, H: w.H})), els: (wlRm(sk).els || []).map(e => ({...e, wl: lb(e.w)})), shp: (wlRm(sk).shp || []).length}; });
    await p.waitForTimeout(800); await p.screenshot({path: path.join(OUT, `imp-${tag}-4-zw.png`)});
    try { await p.evaluate(() => msClose()); await p.waitForTimeout(800); await p.screenshot({path: path.join(OUT, `imp-${tag}-3-canvas.png`)}); } catch (e) {}
    r.errors = errs; r.console = cons.slice(0, 20); all.push(r);
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'import-result.json'), JSON.stringify(all, null, 1));
  for (const r of all) console.log(r.file, JSON.stringify({proj: r.projectOpenToasts, accept: r.impAccept, toasts: r.toasts, ms: r.state && r.state.ms && {n: r.state.ms.nseg, wl: r.state.ms.wlKeys.length, shp: r.state.ms.shp}, zam: r.state && r.state.zam, build: r.buildToasts, walls: r.walls && r.walls.length, errs: r.errors.length, err0: r.errors[0]}));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
