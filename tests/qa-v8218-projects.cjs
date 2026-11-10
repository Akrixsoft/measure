// Measure 82.18 (AKX-2026-0012, инженер A) — стартовое окно «Проекты», данные проектов, миграция, выгрузка v3.
// Старые данные создаются штатным интерфейсом 82.17 (git 51923bf, тот же origin → та же IndexedDB), затем открывается 82.18.
// Экран: QA_VW × QA_VH × QA_DPR (412×797×3, 360×740×3, 412×915×2). Касания — CDP: палец (touch) и перо (pen).
// Снимки: QA_SHOT (по умолчанию /tmp/qa8218-shots/<экран>). Итог: tests/qa-v8218-projects-<экран>.json
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), os = require('os');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const VW = +(process.env.QA_VW || 412), VH = +(process.env.QA_VH || 797), DPR = +(process.env.QA_DPR || 3), TAG = `${VW}x${VH}x${DPR}`;
const SHOT = process.env.QA_SHOT || path.join('/tmp/qa8218-shots', TAG);
fs.mkdirSync(SHOT, {recursive: true});
const BASE = '51923bf';   // Measure 82.17 + запись плана до открытия стены

(async () => {
  const server = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url.split('?')[0]).slice(1), base = false;
    if (f.startsWith('base/')) { base = true; f = f.slice(5); }
    try { r.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.jpg') ? 'image/jpeg' : 'text/html');
      r.end(base ? cp.execFileSync('git', ['show', BASE + ':' + f], {cwd: root, maxBuffer: 20e6, stdio: ['ignore', 'pipe', 'ignore']}) : fs.readFileSync(path.join(root, f))); } catch { r.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox']});
  const ctx = await browser.newContext({viewport: {width: VW, height: VH}, deviceScaleFactor: DPR, isMobile: true, hasTouch: true});
  const checks = [], errors = [], info = {};
  const check = (ok, name, detail) => { checks.push({ok: !!ok, name, detail}); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + JSON.stringify(detail ?? '').slice(0, 400)); };
  let p, cdp;
  const watch = pg => pg.on('pageerror', e => errors.push(String(e.stack || e)));
  const shot = n => p.screenshot({path: path.join(SHOT, n + '.png')});
  // ── касания
  async function tap(type, x, y) {
    if (type === 'touch') { await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 7}]}); await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); }
    else { await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, force: .5}); await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1}); }
    await p.waitForTimeout(220);
  }
  async function hold(type, x, y, ms) {
    if (type === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 8}]});
    else await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x, y, pointerType: 'pen', button: 'left', buttons: 1, clickCount: 1, force: .5});
    await p.waitForTimeout(ms);
    if (type === 'touch') await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    else await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x, y, pointerType: 'pen', button: 'left', buttons: 0, clickCount: 1});
    await p.waitForTimeout(250);
  }
  async function swipe(x, y, dx, dy) {
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 9}]});
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x + dx * i / 8, y: y + dy * i / 8, id: 9}]}); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await p.waitForTimeout(250);
  }
  const box = sel => p.evaluate(s => { const e = typeof s === 'string' ? document.querySelector(s) : null; if (!e) return null; const r = e.getBoundingClientRect(); return {x: r.left, y: r.top, w: r.width, h: r.height}; }, sel);
  const center = b => [b.x + b.w / 2, b.y + b.h / 2];
  const rowSel = label => p.evaluate(l => { const r = [...document.querySelectorAll('#labPrj .lp-row')].find(r => r.querySelector('.lp-t').textContent.trim().startsWith(l)); if (!r) return null; const b = r.getBoundingClientRect(), m = r.querySelector('[data-more]'), mb = m && m.getBoundingClientRect(); return {row: {x: b.left, y: b.top, w: b.width, h: b.height}, more: mb && {x: mb.left, y: mb.top, w: mb.width, h: mb.height}, pid: r.dataset.pid, fid: r.dataset.fid}; }, label);
  const menuItems = () => p.evaluate(() => { const s = document.querySelector('#labPrj .lp-sh'); if (!s.classList.contains('on')) return null; return [...s.querySelectorAll('.lp-mi')].map(b => { const r = b.getBoundingClientRect(); return {act: b.dataset.act, t: b.textContent.trim(), y: r.top, h: r.height, b: r.bottom, w: r.width}; }); });
  const tapItem = async (type, act) => { const b = await p.evaluate(a => { const e = document.querySelector(`#labPrj .lp-sh.on .lp-mi[data-act="${a}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, act); if (!b) throw new Error('нет пункта ' + act); await tap(type, ...b); };
  const sheetOn = () => p.evaluate(() => document.querySelector('#labPrj .lp-sh').classList.contains('on'));
  const closeSheet = async () => { if (await sheetOn()) { await tap('touch', VW / 2, 30); } };
  const P = label => p.evaluate(async l => (await MeasureLabStore.projects()).find(x => MeasureLabStore.label(x).startsWith(l)) || null, label);

  try {
    // ════════ 1. старые данные — штатным интерфейсом 82.17 ════════
    p = await ctx.newPage(); watch(p); cdp = await ctx.newCDPSession(p);
    await p.goto(url + '/base/web/experimental.html?nolist'); await p.waitForFunction(() => window.MeasureLabSketch && window.PM);
    const old = await p.evaluate(async () => {
      const rect = (L, W) => ({pts: [[0, 0], [L, 0], [L, W], [0, W]], closed: true, H: 2700, dims: [L, W, L, W].map((v, i) => ({id: 'qd' + i, a: {p: i}, b: {p: (i + 1) % 4}, v}))});
      // объект 1: помещение, стена С2 с элементами (одному не выдан id), холст v2: фото → ▣ Стена С3, заметка
      await PM.newRoom('Иванов', 'Кухня'); Object.assign(S.room.ms, rect(3000, 2500)); PM.gnFix(); await PM.flushAll(); const r1 = S.room.id;
      await PM.openWall(1); PM.bwSet(2500, 2700); S.els.push({id: 'qa-e1', k: 'roz', c: [600, 300], N: 1}, {k: 'roz', c: [1400, 300], N: 2}); await PM.saveNow();
      await MeasureLabSketch.open('Иванов');
      const blob = await (await fetch('/prototypes/sketch/sample.jpg')).blob();
      await MeasureLabSketch.addPhotos([new File([blob], 'sample.jpg', {type: 'image/jpeg'})]);
      const K = MeasureLabSketch.state, ph = K.items.find(i => i.t === 'photo'); ph.cor = [[52, 118], [832, 112], [833, 972], [66, 978]]; K.cor = null;
      await MeasureLabSketch.createWall(ph, {id: r1, k: 2}, {L: 3000, H: 2700});
      K.items.push({id: 'nqa1', t: 'note', x: 40, y: -300, tx: 'узел ригеля'}); await MeasureLabSketch.saveNow();
      await MeasureLabSketch.close(); await openRoom(r1); const exp = await PM.exportObjObj();
      // объект 2: помещение и стена; холст v1 (82.14) — фото, связанное со стеной, и заметка
      await PM.newRoom('Петров', 'Спальня'); Object.assign(S.room.ms, rect(4000, 3000)); PM.gnFix(); await PM.flushAll(); const r2 = S.room.id;
      await PM.openWall(0); PM.bwSet(4000, 2700); await PM.saveNow(); const w2 = S.sess.id;
      await MeasureLabSketch.db.put('img', blob, 'pv1');
      await MeasureLabSketch.db.put('sk', {obj: 'Петров', photos: [{id: 'pv1', x: 100, y: 200, w: 500, iw: 857, ih: 1088, cor: [[10, 20], [800, 20], [800, 1000], [10, 1000]], wall: {sid: w2}}], notes: [{id: 'nv1', x: 50, y: 60, tx: 'заметка 82.14'}]});
      // отдельная плоскость
      await PM.newSess('Сидоров', 'Плоскость'); PM.bwSet(2000, 2600); await PM.saveNow(); const pl = S.sess.id;
      await PM.flushAll();
      const sess = await PM.dbAll('sess'), sk = await MeasureLabSketch.db.all('sk');
      const b64 = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
      const phWall = K.items.find(i => i.id === ph.wall);
      return {r1, r2, w2, pl, photo: ph.id, photoWallSid: phWall && phWall.sid, cor: ph.cor, exp, nSess: sess.length, sess: sess.map(o => ({id: o.id, kind: o.kind || '', obj: o.obj, oid: o.oid || null, room: o.room || null})),
        sk: sk.map(x => ({obj: x.obj, v: x.v || 1, n: (x.items || x.photos || []).length})), img: {[ph.id]: await b64(await MeasureLabSketch.db.get('img', ph.id)), pv1: await b64(blob)},
        wallItems: sk.find(x => x.obj === 'Иванов').items.filter(i => i.t === 'wall').map(i => ({id: i.id, sid: i.sid}))};
    });
    info.old = {nSess: old.nSess, sk: old.sk};
    check(old.sk.length === 2 && old.exp && old.exp.rooms.length === 1 && old.exp.oid, '82.17: данные созданы штатно (2 холста v1/v2, помещения, стены, плоскость, выгрузка v3)', {sk: old.sk, nSess: old.nSess, oid: old.exp.oid});
    await p.close();

    // ════════ 2. 82.18: старт → миграция → список ════════
    p = await ctx.newPage(); watch(p); cdp = await ctx.newCDPSession(p);
    await p.goto(url + '/web/experimental.html'); await p.waitForSelector('#labPrj.on', {timeout: 20000});
    await p.waitForFunction(async () => !!(await MeasureLabStore.db.get('meta', 'mig')));
    const mig = await p.evaluate(async o => {
      const L = await MeasureLabStore.projects(), all = await PM.dbAll('sess'), byC = c => L.find(x => x.client === c);
      const iv = byC('Иванов'), pt = byC('Петров'), sd = byC('Сидоров');
      const rooms = all.filter(x => x.kind === 'room'), boards = all.filter(x => x.kind === 'board');
      const bI = boards.find(b => b.labOid === iv.id), bP = boards.find(b => b.labOid === pt.id);
      const cI = await MeasureLabStore.cv(iv.id), cP = await MeasureLabStore.cv(pt.id), cS = await MeasureLabStore.cv(sd.id);
      const b64 = b => new Promise(r => { if (!b) return r(''); const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
      const wallOf = sid => { const w = all.find(x => x.id === sid), r = w && rooms.find(x => x.id === w.room); return r ? {room: r.id, wid: r.wid[w.seg]} : null; };
      const plane = all.find(x => x.id === o.pl), wI = all.filter(x => x.room === o.r1 && !x.del);
      const old = await new Promise(res => { const q = indexedDB.open('akrix-sketch'); q.onsuccess = () => { const d = q.result, t = d.transaction('sk').objectStore('sk').getAll(); t.onsuccess = () => { res({ver: d.version, n: t.result.length}); d.close(); }; }; });
      return {n: L.length, clients: L.map(x => [x.client, x.name, x.obj]), oidAll: rooms.every(r => r.oid && L.some(x => x.id === r.oid)), oidKeep: iv.id === o.exp.oid,
        roomOid: rooms.map(r => [r.obj, r.oid === (byC(r.obj) || {}).id]), planeOid: plane.labOid === sd.id, boards: boards.length, boardHidden: boards.every(b => b.room === '~board'),
        refI: bI.refs.map(r => ({id: r.id, q: r.q, x: r.x, y: r.y, w: r.w, labWall: r.labWall})), refIimg: await b64(await PM.dbGet('img', 'ref:' + o.photo)),
        txtI: bI.drw.filter(d => d.k === 'txt').map(d => d.tx), refP: bP.refs.map(r => ({id: r.id, labWall: r.labWall})), refPimg: await b64(await PM.dbGet('img', 'ref:pv1')), txtP: bP.drw.filter(d => d.k === 'txt').map(d => d.tx),
        cvI: cI.items.map(i => ({id: i.id, t: i.t, room: i.room, wid: i.wid, sid: i.sid})), cvP: cP.items.map(i => ({t: i.t, room: i.room, wid: i.wid})), cvS: cS.items.map(i => ({t: i.t, room: i.room, sid: i.sid})),
        wallsI: wI.map(w => ({sid: w.id, ...wallOf(w.id)})), wallP: wallOf(o.w2),
        els: (all.find(x => x.room === o.r1 && x.seg === 1) || {}).els, elHi: iv.elHi, old, mig: await MeasureLabStore.db.get('meta', 'mig')};
    }, old);
    info.migration = mig;
    check(mig.n === 3 && ['Иванов', 'Петров', 'Сидоров'].every(c => mig.clients.some(x => x[0] === c && x[1] === '' && x[2] === c)), 'миграция: 3 проекта (2 объекта + отдельная плоскость), клиент = obj', mig.clients);
    check(mig.oidAll && mig.oidKeep && mig.roomOid.every(x => x[1]) && mig.planeOid, 'миграция: oid проекта во всех помещениях (выданный 82.17 сохранён), labOid у плоскости', {oidKeep: mig.oidKeep, roomOid: mig.roomOid});
    check(mig.boards === 3 && mig.boardHidden, 'миграция: подложка холста kind:board у каждого проекта, room:~board (не видна в списке v81/82.17)', mig.boards);
    const C = old.cor, qExp = [C[3], C[2], C[1], C[0]];
    const rI = mig.refI[0] || {}, wPhoto = mig.wallsI.find(w => w.sid === old.photoWallSid);
    check(mig.refI.length === 1 && rI.id === old.photo && JSON.stringify(rI.q) === JSON.stringify(qExp) && mig.refIimg === old.img[old.photo], 'миграция v2: фото → ref подложки (тот же id, те же байты картинки, 4 угла в порядке v81)', {q: rI.q, bytes: mig.refIimg.length});
    check(wPhoto && rI.labWall === wPhoto.wid, 'миграция v2: связь фото со стеной → ref.labWall = wid', {labWall: rI.labWall, wid: wPhoto && wPhoto.wid});
    check(JSON.stringify(mig.txtI) === JSON.stringify(['узел ригеля']) && JSON.stringify(mig.txtP) === JSON.stringify(['заметка 82.14']), 'миграция: заметки v1/v2 → текст (drw txt) подложки', {I: mig.txtI, P: mig.txtP});
    const wI = mig.cvI.filter(i => i.t === 'wall');
    check(mig.cvI.some(i => i.t === 'plan') && wI.length === mig.wallsI.length && wI.every(i => mig.wallsI.some(w => w.room === i.room && w.wid === i.wid && w.sid === i.sid)) && old.wallItems.every(o2 => wI.some(i => i.id === o2.id)), 'миграция: области стен → (room, wid), все стены проекта на холсте, области 82.17 сохранили id', {cv: mig.cvI, walls: mig.wallsI});
    check(mig.refP.length === 1 && mig.refP[0].id === 'pv1' && mig.refP[0].labWall === mig.wallP.wid && mig.refPimg === old.img.pv1 && mig.cvP.some(i => i.t === 'wall' && i.wid === mig.wallP.wid), 'миграция v1 (82.14): фото → ref со связью со стеной, стена — область холста', {refP: mig.refP, cvP: mig.cvP});
    check(mig.cvS.length === 1 && mig.cvS[0].room === null && mig.cvS[0].sid === old.pl, 'миграция: отдельная плоскость — область холста по sid', mig.cvS);
    check(mig.els && mig.els.length === 2 && mig.els.every(e => e.id) && mig.els[0].id === 'qa-e1' && JSON.stringify(mig.els.map(e => e.no)) === '[1,2]' && mig.elHi === 2, 'миграция: элементам выданы id (если не было) и номера no по проекту, P.elHi', mig.els && mig.els.map(e => [e.id, e.no]));
    check(mig.old.ver === 1 && mig.old.n === 2 && mig.mig && mig.mig.v === '82.18', 'миграция: старая база akrix-sketch v1 не изменена (2 холста), признак meta.mig', {old: mig.old, mig: mig.mig});
    await shot('01-list-migrated');
    // повторный старт — ничего не меняет
    const snapDb = () => p.evaluate(async () => JSON.stringify({prj: (await MeasureLabStore.projects()).sort((a, b) => a.id < b.id ? -1 : 1), cv: (await MeasureLabStore.db.all('cv')).sort((a, b) => a.pid < b.pid ? -1 : 1), sess: (await PM.dbAll('sess')).sort((a, b) => a.id < b.id ? -1 : 1)}));
    const s1 = await snapDb(); await p.reload(); await p.waitForSelector('#labPrj.on'); await p.waitForTimeout(500); const s2 = await snapDb();
    check(s1 === s2, 'миграция идемпотентна: повторный старт не меняет проекты, холсты и записи', {len: s1.length});
    // 82.17 на той же базе открывает старые данные
    const p17 = await ctx.newPage(); watch(p17); await p17.goto(url + '/base/web/experimental.html?nolist'); await p17.waitForFunction(() => window.MeasureLabSketch);
    const back = await p17.evaluate(async () => { const K = await MeasureLabSketch.open('Иванов'); const n = K.items.length, ph = K.items.filter(i => i.t === 'photo' && K.imgs[i.id]).length; await MeasureLabSketch.close(); const rooms = (await PM.dbAll('sess')).filter(o => o.kind === 'room' && !o.del).length; return {n, ph, rooms}; });
    check(back.n >= 4 && back.ph === 1 && back.rooms === 2, 'откат: 82.17 на той же базе открывает свой холст и замеры', back);
    await p17.close();

    // ════════ 3. строки, даты, геометрия ════════
    const ymd = new Date(); const y = ymd.getFullYear();
    await p.evaluate(async y => {
      const set = async (c, t) => { const L = await MeasureLabStore.projects(), P = L.find(x => x.client === c), R = await MeasureLabStore.records(P.id); for (const o of R.all) await MeasureLabStore.zEdit(o.id, x => { x.upd = t; x.created = Math.min(x.created || t, t); }); P.upd = t; await MeasureLabStore.put(P); const c2 = await MeasureLabStore.cv(P.id); await MeasureLabStore.db.put('cv', {...c2, upd: t}); };
      await set('Петров', new Date(y, 0, 5, 10, 0).getTime()); await set('Сидоров', new Date(2024, 1, 27, 9, 0).getTime());
      await MeasureLabProjects.refresh();
    }, y);
    const rows = await p.evaluate(() => [...document.querySelectorAll('#labPrj .lp-row')].map(r => { const b = r.getBoundingClientRect(), t = r.querySelector('.lp-t').getBoundingClientRect(), d = r.querySelector('.lp-d'), m = r.querySelector('[data-more]'); return {t: r.querySelector('.lp-t').textContent.trim(), date: d && d.textContent, top: b.top, bottom: b.bottom, h: b.height, tR: t.right, dL: d && d.getBoundingClientRect().left, dR: d && d.getBoundingClientRect().right, m: m && (b => ({l: b.left, r: b.right, t: b.top, w: b.width, h: b.height}))(m.getBoundingClientRect())}; }));
    const hm = new Date(); const today = /^\d\d:\d\d$/;
    const dI = rows.find(r => r.t.startsWith('Иванов')), dP = rows.find(r => r.t.startsWith('Петров')), dS = rows.find(r => r.t.startsWith('Сидоров'));
    check(dI && today.test(dI.date) && dP && dP.date === '5 янв.' && dS && dS.date === '27.02.2024', 'даты: сегодня — ЧЧ:ММ, этот год — «5 янв.», раньше — 27.02.2024', [dI && dI.date, dP && dP.date, dS && dS.date]);
    check(rows[0].t.startsWith('Иванов') && rows[1].t.startsWith('Петров') && rows[2].t.startsWith('Сидоров'), 'сортировка по дате (по умолчанию): новые сверху', rows.map(r => r.t));
    const geo = rows.every(r => r.h >= 48 && r.m && r.m.w >= 44 && r.m.h >= 44 && r.m.l >= 0 && r.m.r <= VW && r.tR <= r.dL + 0.5 && r.dR <= r.m.l + 0.5) && rows.every((r, i) => !i || Math.abs(r.top - rows[i - 1].bottom) < 0.6);
    const hd = await box('#labPrj .lp-hd'), sub = await box('#labPrj .lp-sub'), lsb = await box('#labPrj .lp-ls'), fab = await box('#labPrj .lp-fab');
    check(geo && hd.y === 0 && Math.abs(hd.h - 56) < 0.6 && Math.abs(sub.y - hd.y - hd.h) < 0.6 && Math.abs(lsb.y - sub.y - sub.h) < 0.6 && Math.abs(lsb.y + lsb.h - VH) < 0.6 && fab.w >= 56 && fab.x + fab.w <= VW && fab.y + fab.h <= VH, 'геометрия: строки ≥ 48 без зазоров и наложений; текст · дата · ⋮ 44×44 в экране; шапка 56, «Новая папка», список до низа, ＋ 56 в экране', {rows: rows.map(r => [r.h, r.m && r.m.w]), hd, sub, lsb, fab});
    // сортировка по имени
    await tap('pen', ...center(await box('#labPrj [data-lp="sort"]')));
    const byName = await p.evaluate(() => [...document.querySelectorAll('#labPrj .lp-row[data-pid] .lp-t')].map(t => t.textContent.trim()));
    await tap('touch', ...center(await box('#labPrj [data-lp="sort"]')));
    check(byName.join('|') === ['Иванов', 'Петров', 'Сидоров'].join('|') && await p.evaluate(() => localStorage.getItem('measure.prjSort')) === 'date', 'сортировка ⇅: по имени и обратно по дате (measure.prjSort)', byName);
    // поиск: по имени помещения, без учёта регистра
    await tap('touch', ...center(await box('#labPrj [data-lp="search"]'))); await p.keyboard.type('СПАЛЬ'); await p.waitForTimeout(200);
    const found = await p.evaluate(() => [...document.querySelectorAll('#labPrj .lp-row .lp-t')].map(t => t.textContent.trim()));
    await tap('touch', ...center(await box('#labPrj [data-lp="search"]')));
    check(found.length === 1 && found[0].startsWith('Петров'), 'поиск: подстрока имени помещения, без учёта регистра', found);

    // ════════ 4. новый проект: касание ＋, холст, список поверх холста ════════
    await tap('touch', ...center(fab));
    await p.waitForSelector('#labPrj .lp-dg.on'); await shot('02-new-dialog');
    await p.fill('#labPrj [data-c]', 'Евгения, Максим'); await p.fill('#labPrj [data-n]', 'Кухня');
    await tap('pen', ...center(await box('#labPrj .lp-bt .lp-pr')));
    await p.waitForFunction(() => window.MeasureLabSketch.isOpen() && !MeasureLabProjects.isOpen(), null, {timeout: 10000}); await p.waitForTimeout(400);
    const np = await p.evaluate(async () => { const L = await MeasureLabStore.projects(), P = L.find(x => x.client === 'Евгения, Максим'), R = await MeasureLabStore.records(P.id), c = await MeasureLabStore.cv(P.id); const t = document.getElementById('labPrjT'), tb = t.getBoundingClientRect(); return {P, board: R.boards.length, cv: !!c, last: localStorage.getItem('measure.lastPrj') === P.id, t: t.textContent, tw: tb.width, tsw: t.scrollWidth, vis: getComputedStyle(t).display !== 'none', hd: getComputedStyle(document.getElementById('hdIn')).display}; });
    check(np.P && np.P.name === 'Кухня' && np.P.obj === 'Евгения, Максим — Кухня' && np.board === 1 && np.cv && np.last, 'новый проект: клиент · проект, obj через « — », подложка и холст созданы, открыт сразу', {obj: np.P && np.P.obj});
    check(np.vis && np.t === 'Евгения, Максим · Кухня' && np.hd === 'none', 'шапка холста: «клиент · проект» вместо #hdIn', {t: np.t, w: np.tw, sw: np.tsw});
    await shot('03-canvas-title');
    await p.evaluate(() => MeasureLabProjects.show());   // 📁 (инженер B) → список поверх холста
    await p.waitForSelector('#labPrj.on');
    const over = await p.evaluate(() => ({sk: MeasureLabSketch.isOpen(), ss: document.getElementById('ss').classList.contains('on'), ssVis: getComputedStyle(document.getElementById('ss')).display, ev: document.body.classList.contains('lab-prj-on')}));
    check(over.sk && over.ss && over.ssVis === 'none' && over.ev, 'список поверх открытого холста: холст не закрыт; признак видимости #ss.on (сам #ss скрыт) и body.lab-prj-on', over);
    const nr = await rowSel('Евгения'); await tap('touch', ...center(nr.row));
    const reopened = await p.evaluate(() => ({list: MeasureLabProjects.isOpen(), sk: MeasureLabSketch.isOpen(), ss: document.getElementById('ss').classList.contains('on')}));
    check(!reopened.list && reopened.sk && !reopened.ss, 'касание строки текущего проекта — снова холст', reopened);
    await p.evaluate(() => sessList(true)); await p.waitForSelector('#labPrj.on');
    check(await p.evaluate(() => MeasureLabSketch.isOpen() && MeasureLabProjects.isOpen()), 'sessList(true) из кода v81 → список проектов, холст не закрывается', null);

    // ════════ 5. меню строки: ⋮ (перо), долгое нажатие (палец), прокрутка не открывает ════════
    let r = await rowSel('Петров');
    await tap('pen', ...center(r.more));
    let mi = await menuItems(); await shot('04-menu-sheet');
    const shp = await box('#labPrj .lp-pn');
    check(mi && mi.map(m => m.act).join(',') === 'open,rename,move,arch,del' && mi.every(m => m.h >= 52 && m.w >= VW - 1) && mi.every((m, i) => !i || Math.abs(m.y - mi[i - 1].b) < 0.6) && Math.abs(shp.y + shp.h - VH) < 0.6, '⋮ пером: лист снизу, 5 пунктов по 52 px без зазоров', mi && mi.map(m => m.t));
    await closeSheet();
    check(!(await sheetOn()), 'касание вне листа — закрыть', null);
    r = await rowSel('Петров'); await hold('touch', r.row.x + 60, r.row.y + r.row.h / 2, 600);
    mi = await menuItems();
    check(mi && mi.length === 5 && await p.evaluate(() => MeasureLabSketch.state.obj) === 'Евгения, Максим — Кухня', 'долгое нажатие пальцем 450 мс → то же меню (проект не открылся)', mi && mi.map(m => m.act));
    await closeSheet();
    r = await rowSel('Петров'); await hold('pen', r.row.x + 60, r.row.y + r.row.h / 2, 600);
    mi = await menuItems(); check(mi && mi.length === 5, 'долгое нажатие пером → меню', mi && mi.length); await closeSheet();
    r = await rowSel('Петров'); await swipe(r.row.x + 80, r.row.y + r.row.h / 2, 0, 70);
    check(!(await sheetOn()) && await p.evaluate(() => MeasureLabProjects.isOpen()), 'протяжка пальцем по строке: ни меню, ни открытия', null);
    const cm = await p.evaluate(() => { const e = new MouseEvent('contextmenu', {bubbles: true, cancelable: true}); document.querySelector('#labPrj .lp-row').dispatchEvent(e); return e.defaultPrevented; });
    check(cm, 'contextmenu (перо/долгое нажатие WebView) подавлен', cm);

    // ════════ 6. папки, перемещение ════════
    await tap('touch', ...center(await box('#labPrj .lp-nf')));
    await p.fill('#labPrj [data-f]', 'Отработанное'); await tap('touch', ...center(await box('#labPrj .lp-bt .lp-pr'))); await p.waitForTimeout(200);
    let fr = await rowSel('Отработанное');
    check(fr && fr.fid && fr.row.y < (await rowSel('Иванов')).row.y, 'новая папка — сверху списка', fr && fr.fid);
    r = await rowSel('Петров'); await tap('pen', ...center(r.more)); await tapItem('pen', 'move');
    await shot('05-move-sheet');
    await tapItem('touch', 'fld:' + fr.fid); await p.waitForTimeout(250);
    const mv = await p.evaluate(async fid => ({folder: (await MeasureLabStore.projects()).find(x => x.client === 'Петров').folder === fid, inRoot: [...document.querySelectorAll('#labPrj .lp-row[data-pid] .lp-t')].some(t => t.textContent.startsWith('Петров')), cnt: [...document.querySelectorAll('#labPrj .lp-fold .lp-d')].map(d => d.textContent)[0]}), fr.fid);
    check(mv.folder && !mv.inRoot && /^1 · /.test(mv.cnt), '«В папку…» → проект в папке, в корне его нет, у папки «1 · дата»', mv);
    fr = await rowSel('Отработанное'); await tap('touch', ...center(fr.row));
    const inF = await p.evaluate(() => ({cr: document.querySelector('#labPrj .lp-cr').textContent.replace(/\s+/g, ' ').trim(), rows: [...document.querySelectorAll('#labPrj .lp-row .lp-t')].map(t => t.textContent.trim()), fab: !document.querySelector('#labPrj .lp-fab').hidden}));
    await shot('06-folder');
    check(inF.cr.replace(/\s/g, '') === 'Проекты›Отработанное' && inF.rows.length === 1 && inF.rows[0].startsWith('Петров'), 'вход в папку: крошки «Проекты › Отработанное», проект внутри', inF);
    await tap('pen', ...center(await box('#labPrj .lp-up')));
    check(await p.evaluate(() => MeasureLabProjects.state.view) === 'root', 'крошки «Проекты» — на уровень выше', null);
    fr = await rowSel('Отработанное'); await tap('touch', ...center(fr.more)); await tapItem('touch', 'del'); await p.waitForTimeout(250);
    check(await p.evaluate(async () => (await MeasureLabStore.folders()).length) === 1, 'удаление непустой папки отклонено', null);

    // ════════ 7. архив ════════
    r = await rowSel('Сидоров'); await tap('pen', ...center(r.more)); await tapItem('pen', 'arch'); await p.waitForTimeout(250);
    const ar = await p.evaluate(async () => { const P = (await MeasureLabStore.projects()).find(x => x.client === 'Сидоров'), R = await MeasureLabStore.records(P.id); return {arch: !!P.arch, noDel: R.all.every(o => !o.del), inRoot: [...document.querySelectorAll('#labPrj .lp-row[data-pid] .lp-t')].some(t => t.textContent.startsWith('Сидоров')), sec: [...document.querySelectorAll('#labPrj .lp-sec')].map(s => s.textContent.trim())}; });
    check(ar.arch && ar.noDel && !ar.inRoot && ar.sec.includes('▸ Архив (1)'), 'в архив: скрыт из списка, данные без del, «▸ Архив (1)» внизу', ar);
    await tap('touch', ...center((await rowSel('▸ Архив')).row));
    r = await rowSel('Сидоров'); check(!!r, 'Архив: проект в списке архива', !!r); await shot('07-archive');
    await tap('touch', ...center(r.more)); await tapItem('touch', 'unarch'); await p.waitForTimeout(250);
    await tap('touch', ...center(await box('#labPrj .lp-up')));
    check(!!(await rowSel('Сидоров')) && !(await P('Сидоров')).arch, '«Из архива» — снова в списке', null);

    // ════════ 8. корзина: подтверждение, ↶ Вернуть, «Вернуть» из корзины ════════
    r = await rowSel('Сидоров'); await tap('pen', ...center(r.more)); await tapItem('pen', 'del');
    const armed = await p.evaluate(() => { const b = document.querySelector('#labPrj .lp-sh.on .lp-mi[data-act="del"]'); return b && b.classList.contains('lp-arm') && b.textContent.includes('ещё раз'); });
    check(armed && !(await P('Сидоров')).del, 'удаление: первое касание — подтверждение «В корзину? Нажмите ещё раз», данных не трогает', armed);
    await tapItem('pen', 'del'); await p.waitForTimeout(300);
    const tr = await p.evaluate(async () => { const P = (await MeasureLabStore.projects()).find(x => x.client === 'Сидоров'), R = await MeasureLabStore.records(P.id); const to = document.querySelector('#labPrj .lp-to'); return {del: !!P.del, all: R.all.length, allDel: R.all.every(o => o.del && o.delP === P.id), toast: to.classList.contains('on') && to.textContent.includes('Вернуть'), sec: [...document.querySelectorAll('#labPrj .lp-sec')].map(s => s.textContent.trim())}; });
    await shot('08-trash-toast');
    check(tr.del && tr.all >= 2 && tr.allDel && tr.toast && tr.sec.includes('▸ Корзина (1)'), 'второе касание → корзина: P.del и штатный o.del у всех записей; тост «↶ Вернуть»; «▸ Корзина (1)»', tr);
    await tap('touch', ...center(await box('#labPrj .lp-to button'))); await p.waitForTimeout(300);
    const un = await p.evaluate(async () => { const P = (await MeasureLabStore.projects()).find(x => x.client === 'Сидоров'), R = await MeasureLabStore.records(P.id); return {del: P.del, any: R.all.some(o => o.del || o.delP)}; });
    check(!un.del && !un.any, '↶ Вернуть в тосте — проект и записи восстановлены', un);
    r = await rowSel('Сидоров'); await tap('touch', ...center(r.more)); await tapItem('touch', 'del'); await tapItem('touch', 'del'); await p.waitForTimeout(250);
    await tap('touch', ...center((await rowSel('▸ Корзина')).row));
    r = await rowSel('Сидоров'); await shot('09-trash');
    await tap('touch', ...center(r.row)); mi = await menuItems();
    check(mi && mi.map(m => m.act).join(',') === 'restore,purge', 'в корзине касание строки — меню «Вернуть / Удалить навсегда» (без открытия)', mi && mi.map(m => m.t));
    await tapItem('touch', 'restore'); await p.waitForTimeout(300);
    check(!(await P('Сидоров')).del && await p.evaluate(async () => (await MeasureLabStore.records((await MeasureLabStore.projects()).find(x => x.client === 'Сидоров').id)).all.every(o => !o.del)), '«Вернуть» из корзины', null);
    await tap('touch', ...center(await box('#labPrj .lp-up')));

    // ════════ 9. выгрузка v3 = как была + новые поля; импорт обратно ════════
    const ex = await p.evaluate(async r1 => { MeasureLabProjects.hide(); await openRoom(r1); const o = await PM.exportObjObj(); return o; }, old.r1);
    const strip = (o, drop) => JSON.parse(JSON.stringify(o, (k, v) => drop.includes(k) ? undefined : v));
    // «как была + новые поля»: всё из выгрузки 82.17 совпадает; новые — только no и id (id элементу без id выдан миграцией)
    const subset = (A, B, at) => { if (A === null || typeof A !== 'object') return A === B ? null : at; if (!B || typeof B !== 'object' || Array.isArray(A) !== Array.isArray(B)) return at; if (Array.isArray(A) && A.length !== B.length) return at + '.length';
      for (const k of Object.keys(A)) { const d = subset(A[k], B[k], at + '.' + k); if (d) return d; } for (const k of Object.keys(B)) if (!(k in A) && !['no', 'id'].includes(k)) return at + '.+' + k; return null; };
    const a = strip(old.exp, ['date']), b = strip(ex, ['date']);
    const nos = []; for (const W of Object.values(ex.rooms[0].ms.wl)) for (const k of ['els', 'pts', 'zn']) for (const q of W[k] || []) nos.push([q.id, q.no]);
    const diff = subset(a, b, '$');
    check(!diff, 'выгрузка v3: всё из выгрузки 82.17 тех же данных на месте и равно; добавлены только необязательные поля (no, id)', diff);
    check(ex.oid === old.exp.oid && nos.length === 2 && nos.every(x => x[0] && x[1] > 0) && (nos.find(x => x[0] === 'qa-e1') || [])[1] === 1, 'выгрузка v3: oid проекта; у элементов стены id и новое необязательное поле no', nos);
    const fx = path.join(os.tmpdir(), `qa8218-export-${TAG}.json`); fs.writeFileSync(fx, JSON.stringify(ex));
    let cons = ''; try { cons = cp.execFileSync('node', [path.join(__dirname, 'export-consumer.cjs'), fx], {encoding: 'utf8'}); } catch (e) { cons = 'FAIL ' + (e.stderr || e.message); }
    check(!/FAIL|Error/.test(cons), 'конструктор v894 (zwSet, export-consumer.cjs) принимает выгрузку с новыми полями', cons.trim().slice(-200));
    // удалить навсегда (из корзины) — затем импорт выгрузки обратно
    const ivBefore = await p.evaluate(async () => { const P = (await MeasureLabStore.projects()).find(x => x.client === 'Иванов'), R = await MeasureLabStore.records(P.id), refs = R.all.flatMap(o => (o.refs || []).map(r => 'ref:' + r.id)); return {pid: P.id, ids: R.all.map(o => o.id), refs}; });
    await p.evaluate(() => { leavePlan(); clearAll(); sessList(true); }); await p.waitForSelector('#labPrj.on'); await p.waitForTimeout(300);
    r = await rowSel('Иванов'); await tap('pen', ...center(r.more)); await tapItem('pen', 'del'); await tapItem('pen', 'del'); await p.waitForTimeout(250);
    await tap('pen', ...center((await rowSel('▸ Корзина')).row));
    r = await rowSel('Иванов'); await tap('pen', ...center(r.more)); await tapItem('pen', 'purge');
    await p.waitForSelector('#labPrj .lp-dg.on'); const dtxt = await p.evaluate(() => document.querySelector('#labPrj .lp-bx p').textContent); await shot('10-purge-dialog');
    check(/Иванов/.test(dtxt) && /\(\d+\)/.test(dtxt) && !/\(0\)/.test(dtxt), 'удалить навсегда: окно с именем проекта и числом фото', dtxt);
    await tap('touch', ...center(await box('#labPrj .lp-bt .lp-dn'))); await p.waitForTimeout(500);
    const gone = await p.evaluate(async b => { const s = await PM.dbAll('sess'), imgs = []; for (const k of b.refs) imgs.push(!!(await PM.dbGet('img', k))); return {sess: s.filter(o => b.ids.includes(o.id)).length, imgs, cv: !!(await MeasureLabStore.cv(b.pid)), prj: !!(await MeasureLabStore.get(b.pid))}; }, ivBefore);
    check(ivBefore.refs.length >= 1 && gone.sess === 0 && gone.imgs.every(x => !x) && !gone.cv && !gone.prj, '«Удалить навсегда» (только в корзине): нет записей, картинок ref:*, cv и проекта', {before: ivBefore.refs.length + ' фото, ' + ivBefore.ids.length + ' записей', gone});
    await tap('pen', ...center(await box('#labPrj .lp-up')));
    const imp = await p.evaluate(async o => { const n = await zImpExp(o); await MeasureLabStore.sync(); await MeasureLabProjects.show(); const L = await MeasureLabStore.projects(), P = L.find(x => x.id === o.oid), R = P && await MeasureLabStore.records(P.id); return {n, P: P && {client: P.client, obj: P.obj}, rooms: R && R.rooms.length, walls: R && R.walls.length, row: [...document.querySelectorAll('#labPrj .lp-row .lp-t')].some(t => t.textContent.trim() === 'Иванов'), no: R && R.walls.flatMap(w => (w.els || []).map(e => e.no || null))}; }, ex);
    info.import = imp;
    check(imp.n === 1 && imp.P && imp.P.client === 'Иванов' && imp.rooms === 1 && imp.row, 'импорт выгрузки обратно: помещение восстановлено, проект «Иванов» с тем же oid в списке', imp);
    await shot('11-after-import');

    // ════════ 10. резервная копия: блок lab ════════
    const bak = await p.evaluate(async () => { const o = await PM.zBackup(false); return {lab: !!o.lab, prj: o.lab.prj.length, fld: o.lab.fld.length, cv: o.lab.cv.length}; });
    check(bak.lab && bak.prj >= 4 && bak.fld === 1 && bak.cv >= 4, 'резервная копия: блок lab {prj, fld, cv}', bak);
    // старт: последний открытый проект
    await p.evaluate(async () => { const P = (await MeasureLabStore.projects()).find(x => x.client === 'Петров'); localStorage.setItem('measure.lastPrj', P.id); });
    await p.reload(); await p.waitForFunction(() => window.MeasureLabSketch && MeasureLabSketch.isOpen(), null, {timeout: 15000});
    const st = await p.evaluate(() => ({obj: MeasureLabSketch.state.obj, list: MeasureLabProjects.isOpen(), t: document.getElementById('labPrjT').textContent}));
    check(st.obj === 'Петров' && !st.list && st.t === 'Петров', 'старт: последний открытый проект — сразу холст (lastOpen)', st);
    await p.goto(url + '/web/experimental.html?list'); await p.waitForSelector('#labPrj.on');
    check(true, 'старт с ?list — список', null);
    check(await p.evaluate(() => document.querySelectorAll('#ss .it').length === 0 && getComputedStyle(document.getElementById('ss')).display === 'none'), 'штатный список #ss не показывается', null);
  } catch (e) { errors.push(String(e.stack || e)); console.error(e); }
  const real = errors.filter(e => !/favicon|manifest/.test(e));
  check(real.length === 0, 'нет ошибок страницы', real.slice(0, 3));
  const out = {screen: TAG, base: BASE, passed: checks.filter(c => c.ok).length, total: checks.length, checks, errors: real, info, shots: SHOT};
  fs.writeFileSync(path.join(__dirname, `qa-v8218-projects-${TAG}.json`), JSON.stringify(out, null, 2));
  console.log(`\n${out.passed}/${out.total} ${TAG}`);
  await browser.close(); server.close();
  process.exit(out.passed === out.total ? 0 : 1);
})();
