/* Measure — ядро холста (AKX-2026-0015). Единый холст: одно координатное пространство (мм, ось y вниз),
   фото — постоянный слой, план стен и развёртки стен рисуются прямо на холсте. Нет переключения экранов,
   нет рамок-областей, нет снимков. Ничто не перестраивается само. Отмена/повтор — снимки документа,
   переживают перезапуск. Картинки фото не удаляются (возврат через ↶).
   Блоки изолированы: правка одного блока не требует правки других. */
(() => {
  'use strict';

  /* ═══ [BLOCK C-UTIL] ═══ */
  const $ = id => document.getElementById(id);
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clone = o => JSON.parse(JSON.stringify(o));
  const hyp = Math.hypot, rnd = Math.round;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DPR = () => window.devicePixelRatio || 1;
  let toastT = 0;
  const toast = t => { const e = $('cToast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1800); };
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = L2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1) : 0; return hyp(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

  /* ═══ [BLOCK C-MODEL] документ проекта ═══
     photos: {id, img, x, y, w, iw, ih, cr:[x0,y0,x1,y1]}  — x,y,w мм холста; cr — подрезка 0…1 от полного кадра
     nodes:  {id, x, y}                                    — узлы плана, мм
     walls:  {id, a, b, gn}                                — стена плана между узлами; gn — номер С№, не переиспользуется
     elev:   {id, wall, x, y}                              — развёртка стены: прямоугольник L × H в точке x,y (L — из плана, H — проекта)
     dims:   {id, k:'dim'|'arr', a, b, v}                  — размер (↔) / стрелка (→); v — введённое значение, мм ('' — нет);
             конец: {t:'node', id} | {t:'wall', id, s} | {t:'elev', id, u, v} | {t:'photo', id, u, v} (доли полного кадра) | {t:'free'}; x,y — последнее место (мм)
     drw:    {id, k, c, h:{t:'photo'|'elev',id}|null, p:[[u,v]|[x,y]…], tx, n, dash, fill, wp} — Б3: рисунок; p — доли основы (фото — полный кадр, развёртка) или мм холста (h=null); wp — мм на случай удаления основы
     frames: {id, ph, q:[[u,v]×4], wall}                   — Б2: рамка «4 угла» на фото (доли полного кадра; ЛВ, ПВ, ПН, ЛН); wall — стена, построенная по рамке */
  const newDoc = () => ({v: 1, id: uid('p'), name: '', H: '', gnHi: 0, photos: [], nodes: [], walls: [], elev: [], dims: [], frames: [], drw: [], com: [], ops: [], rooms: []});
  let D = null;
  let V = {ox: 40, oy: 60, s: 0.1};                    // вид: px CSS на мм
  const C = {tool: 'sel', mode: 'wall', sel: null, crop: null, phm: false, msel: [], ptsP: null, zdp: [], phHide: false, rt: 'el', cpg: null, ctp: null, opp: null};   // Б2: msel — группа [{t,id}]; ptsP — начатая рамка {ph, q}      // phm — открыт выбор «камера / галерея»      // sel {t:'photo'|'wall'|'node'|'elev', id}
  const node = id => D.nodes.find(n => n.id === id);
  const wall = id => D.walls.find(w => w.id === id);
  const photo = id => D.photos.find(p => p.id === id);
  const elev = id => D.elev.find(e => e.id === id);
  const dim = id => D.dims.find(d => d.id === id);
  const frame = id => D.frames.find(f => f.id === id);
  const drw = id => D.drw.find(q => q.id === id);
  const wLen = w => { const a = node(w.a), b = node(w.b); return a && b ? hyp(b.x - a.x, b.y - a.y) : 0; };
  const Hmm = () => (+D.H > 0 ? +D.H : 0);
  const phH = p => p.w * ((p.cr[3] - p.cr[1]) * p.ih) / ((p.cr[2] - p.cr[0]) * p.iw);
  const elevRect = e => { const w = wall(e.wall); return {x: e.x, y: e.y, w: w ? wLen(w) : 0, h: Hmm()}; };
  const deg = id => D.walls.filter(w => w.a === id || w.b === id).length;
  function dropOrphans() { D.nodes = D.nodes.filter(n => deg(n.id)); D.elev = D.elev.filter(e => wall(e.wall)); D.frames = D.frames.filter(f => photo(f.ph)); if (D.ops) D.ops = D.ops.filter(o => wall(o.wall)); }

  /* ═══ [BLOCK C-HIST] отмена / повтор — снимки документа ═══ */
  const HS = {u: [], r: []};
  let pending = null;
  const snap = () => JSON.stringify(D);
  function begin() { if (pending == null) pending = snap(); }
  function commit() { if (pending == null) return; const now = snap(); if (now !== pending) { HS.u.push(pending); if (HS.u.length > 100) HS.u.shift(); HS.r = []; dirty(); } pending = null; ui(); draw(); }
  function cancel() { if (pending != null) { D = JSON.parse(pending); pending = null; } }
  function undo() { if (!HS.u.length) return; HS.r.push(snap()); D = JSON.parse(HS.u.pop()); afterHist('↶ отменено'); }
  function redo() { if (!HS.r.length) return; HS.u.push(snap()); D = JSON.parse(HS.r.pop()); afterHist('↷ повторено'); }
  function afterHist(t) {
    const s = C.sel, F = {photo, wall, node, elev, dim, frame, drw, com: id => D.com.find(c => c.id === id), op: id => D.ops.find(o => o.id === id), room: id => D.rooms.find(r => r.id === id)}; if (s && !F[s.t](s.id)) C.sel = null; C.msel = C.msel.filter(m => F[m.t] && F[m.t](m.id)); C.ptsP = null; C.zdp = [];
    C.crop = null; $('labPrjT').value = D.name; dirty(); ui(); toast(t);
  }

  /* ═══ [BLOCK C-DB] IndexedDB akrix-core: prj (документ + вид + журнал), img (картинки), meta ═══ */
  const DB = {db: null};
  function dbOpen() {
    return new Promise((res, rej) => { const r = indexedDB.open('akrix-core', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('prj', {keyPath: 'id'}); d.createObjectStore('img'); d.createObjectStore('meta'); };
      r.onsuccess = () => res(DB.db = r.result); r.onerror = () => rej(r.error); });
  }
  function tx(st, mode, fn) {
    return new Promise((res, rej) => { const t = DB.db.transaction(st, mode), q = fn(t.objectStore(st)); let out;
      if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  const put = (st, v, k) => tx(st, 'readwrite', s => (k === undefined ? s.put(v) : s.put(v, k)));
  const get = (st, k) => !DB.db ? Promise.resolve(undefined) : tx(st, 'readonly', s => s.get(k));
  let saveT = 0;
  function dirty() { clearTimeout(saveT); saveT = setTimeout(save, 400); draw(); }
  async function save() {
    clearTimeout(saveT); if (!D || !DB.db) return;
    const rec = {...clone(D), view: {...V}, hist: {u: HS.u.slice(-60), r: HS.r.slice(-60)}, upd: Date.now()};
    await put('prj', rec); await put('meta', D.id, 'last');
  }
  async function load() {
    const last = await get('meta', 'last'); const r = last ? await get('prj', last) : null;
    if (r) { if (r.view) V = r.view; HS.u = (r.hist && r.hist.u) || []; HS.r = (r.hist && r.hist.r) || []; delete r.view; delete r.hist; delete r.upd; D = r; }
    else D = newDoc();
    D.dims = D.dims || []; D.frames = D.frames || []; D.drw = D.drw || []; D.com = D.com || []; D.ops = D.ops || []; D.rooms = D.rooms || [];
  }

  /* ═══ [BLOCK C-IMG] кэш картинок ═══ */
  const IMG = new Map();
  function bmp(key) {
    const b = IMG.get(key);
    if (b === undefined && DB.db) { IMG.set(key, null);
      get('img', key).then(bl => (bl ? createImageBitmap(bl) : null)).then(bm => { IMG.set(key, bm || false); draw(); }).catch(() => IMG.set(key, false));
      return null; }
    return b || null;
  }

  /* ═══ [BLOCK C-VIEW] вид: мм ⇄ px ═══ */
  const cv = $('cCv'), cx = cv.getContext('2d');
  const cssW = () => cv.clientWidth, cssH = () => cv.clientHeight;
  const toS = (x, y) => [x * V.s + V.ox, y * V.s + V.oy];
  const toW = (sx, sy) => ({x: (sx - V.ox) / V.s, y: (sy - V.oy) / V.s});
  let viewT = 0;
  const viewChanged = () => { draw(); clearTimeout(viewT); viewT = setTimeout(save, 800); };
  function resize() { cv.width = rnd(cssW() * DPR()); cv.height = rnd(cssH() * DPR()); draw(); }
  function bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const p of D.photos) { add(p.x, p.y); add(p.x + p.w, p.y + phH(p)); }
    for (const n of D.nodes) add(n.x, n.y);
    for (const e of D.elev) { const r = elevRect(e); add(r.x, r.y - 300); add(r.x + r.w, r.y + r.h); }
    return x0 === Infinity ? null : {x0, y0, x1, y1};
  }
  function fitAll() {
    const b = bounds(); if (!b) return; const m = 28, bw = Math.max(1, b.x1 - b.x0), bh = Math.max(1, b.y1 - b.y0);
    V.s = clamp(Math.min((cssW() - 2 * m) / bw, (cssH() - 2 * m) / bh), 0.005, 5);
    V.ox = (cssW() - bw * V.s) / 2 - b.x0 * V.s; V.oy = (cssH() - bh * V.s) / 2 - b.y0 * V.s; viewChanged();
  }

  /* ═══ [BLOCK C-DRAW] отрисовка: сетка → фото → развёртки → план → выделение ═══ */
  let raf = 0; const LBL = new Map(), ELBL = new Map();          // id стены → прямоугольник подписи (px), для касаний
  function draw() { if (!raf) raf = requestAnimationFrame(paint); }
  const COL = {wall: '#7a3cc8', sel: '#1f6fd1', node: '#0e7f93', elev: '#223', grid: '#e2e4e7', grid2: '#cfd3d8'};
  function paint() {
    raf = 0; if (!D) return; const d = DPR(), W = cssW(), Hh = cssH();
    cx.setTransform(d, 0, 0, d, 0, 0); cx.fillStyle = '#f6f5f1'; cx.fillRect(0, 0, W, Hh);
    const gst = grid(W, Hh);
    for (const p of D.photos) drawPhoto(p);
    ELBL.clear(); for (const e of D.elev) drawElev(e);
    drawCom();
    drawRooms();
    drawPlan();
    drawPlanCols();
    drawOps();
    drawDrw();
    drawDims();
    drawFrames();
    drawElevDims();
    drawOverlay();
    drawGroup();
    scaleBar(W, Hh, gst);
    cx.font = '600 11px system-ui'; cx.fillStyle = '#8a9099'; cx.textAlign = 'left'; cx.textBaseline = 'bottom'; cx.textBaseline = 'top'; cx.fillText('Measure ' + (window.MeasureVersion || '') + ' · ядро', 6, 6);
  }
  function grid(W, Hh) {
    let st = 100; while (st * V.s < 14) st *= 10;
    const a = toW(0, 0), b = toW(W, Hh);
    for (const [s, c] of [[st, COL.grid], [st * 10, COL.grid2]]) {
      cx.strokeStyle = c; cx.lineWidth = 1; cx.beginPath();
      for (let x = Math.floor(a.x / s) * s; x <= b.x; x += s) { const X = rnd(toS(x, 0)[0]) + 0.5; cx.moveTo(X, 0); cx.lineTo(X, Hh); }
      for (let y = Math.floor(a.y / s) * s; y <= b.y; y += s) { const Y = rnd(toS(0, y)[1]) + 0.5; cx.moveTo(0, Y); cx.lineTo(W, Y); }
      cx.stroke();
    }
    return st;
  }
  /* [BLOCK C-SCALE] размер клетки сетки — серым слева вверху под версией: «□ 1 000» (справа — переключатель вида) */
  const num = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  function scaleBar(W, Hh, st) { cx.font = '600 13px system-ui'; cx.fillStyle = '#8a9099'; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText('□ ' + num(st), 6, 24); }
  function drawPhoto(p) {
    if (C.phHide) return;
    const bm = bmp(p.img), cr = C.crop && C.crop.id === p.id ? C.crop : null;
    if (cr && bm) {                                            // подрезка: полный кадр приглушён, окно — ярко
      const F = cr.F, [fx, fy] = toS(F.x, F.y);
      cx.globalAlpha = 0.35; cx.drawImage(bm, fx, fy, p.iw * F.k * V.s, p.ih * F.k * V.s); cx.globalAlpha = 1;
    }
    const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s;
    if (bm) cx.drawImage(bm, p.cr[0] * bm.width, p.cr[1] * bm.height, (p.cr[2] - p.cr[0]) * bm.width, (p.cr[3] - p.cr[1]) * bm.height, x, y, w, h);
    else { cx.fillStyle = '#d5d8dc'; cx.fillRect(x, y, w, h); }
    cx.strokeStyle = '#8a9099'; cx.lineWidth = 1; cx.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  function label(t, X, Y, col) {
    cx.font = `600 ${Math.round(13 * W3.f)}px system-ui`; const tw = cx.measureText(t).width + 10, r = {x: X - tw / 2, y: Y - 11 * W3.f, w: tw, h: 22 * W3.f};
    cx.fillStyle = '#fff'; cx.fillRect(r.x, r.y, r.w, r.h); cx.strokeStyle = col; cx.lineWidth = 1; cx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    cx.fillStyle = col; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, X, Y + 0.5); return r;
  }
  function drawPlan() {
    LBL.clear();
    for (const w of D.walls) {
      const a = node(w.a), b = node(w.b); if (!a || !b) continue;
      const on = C.sel && C.sel.t === 'wall' && C.sel.id === w.id, [ax, ay] = toS(a.x, a.y), [bx, by] = toS(b.x, b.y);
      cx.strokeStyle = on ? COL.sel : COL.wall; cx.lineWidth = on ? 6 : 4; cx.lineCap = 'round';
      cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke();
    }
    const R = C.tool === 'wall' ? 6 : 4;
    for (const n of D.nodes) { const [x, y] = toS(n.x, n.y), on = C.sel && C.sel.t === 'node' && C.sel.id === n.id;
      cx.fillStyle = on ? COL.sel : COL.node; cx.beginPath(); cx.arc(x, y, on ? R + 3 : R, 0, 7); cx.fill(); }
    for (const w of D.walls) {                                  // подписи — поверх, сбоку от стены
      const a = node(w.a), b = node(w.b); if (!a || !b) continue;
      const [ax, ay] = toS(a.x, a.y), [bx, by] = toS(b.x, b.y), L = hyp(bx - ax, by - ay); if (L < 24) continue;
      const nx = -(by - ay) / L, ny = (bx - ax) / L, on = C.sel && C.sel.t === 'wall' && C.sel.id === w.id;
      const ed = KB.tg && KB.tg.t === 'wall' && KB.tg.id === w.id;
      LBL.set(w.id, label(ed ? `С${w.gn}  ${KB.buf || ' '}▏` : `С${w.gn}  ${rnd(wLen(w))}`, (ax + bx) / 2 + nx * 18, (ay + by) / 2 + ny * 18, on ? COL.sel : COL.wall));
    }
  }
  function drawOverlay() {
    const g = G;
    if (g && g.t === 'draw' && g.b) {                           // строящаяся стена
      const [ax, ay] = toS(g.a.x, g.a.y), [bx, by] = toS(g.b.x, g.b.y);
      cx.strokeStyle = COL.sel; cx.lineWidth = 4; cx.setLineDash([10, 6]); cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke(); cx.setLineDash([]);
      if (g.b.node) { cx.strokeStyle = '#e08a00'; cx.lineWidth = 3; cx.beginPath(); cx.arc(bx, by, 14, 0, 7); cx.stroke(); }
      if (g.b.ax) { cx.strokeStyle = '#e08a0099'; cx.lineWidth = 1; cx.setLineDash([4, 4]); cx.beginPath(); const [nx, ny] = toS(g.b.ax.x, g.b.ax.y); cx.moveTo(nx, ny); cx.lineTo(bx, by); cx.stroke(); cx.setLineDash([]); }
      label(String(rnd(hyp(g.b.x - g.a.x, g.b.y - g.a.y))), (ax + bx) / 2, (ay + by) / 2 - 22, COL.sel);
    }
    if (g && (g.t === 'dimdraw' || g.t === 'dimend') && g.cur) { const P = endPos(g.cur), [x, y] = toS(P.x, P.y); cx.strokeStyle = g.cur.t === 'free' ? '#8a9099' : '#e08a00'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(x, y, 12, 0, 7); cx.stroke(); }
    if (g && g.t === 'dimdraw' && g.a && g.cur) { const A = endPos(g.a), B = endPos(g.cur), [ax, ay] = toS(A.x, A.y), [bx, by] = toS(B.x, B.y); cx.strokeStyle = COLD.sel; cx.lineWidth = 2; cx.setLineDash([8, 5]); cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke(); cx.setLineDash([]); }
    if (g && g.t === 'nmove' && g.snapN) { const n = node(g.snapN), [x, y] = toS(n.x, n.y); cx.strokeStyle = '#e08a00'; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, y, 14, 0, 7); cx.stroke(); }
    const s = C.sel;
    if (s && s.t === 'photo' && !C.crop) { const p = photo(s.id); if (p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s;
      cx.strokeStyle = COL.sel; cx.lineWidth = 2.5; cx.strokeRect(x, y, w, h); handles([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); } }
    if (C.crop) { const p = photo(C.crop.id); if (p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s;
      cx.strokeStyle = '#e08a00'; cx.lineWidth = 2.5; cx.strokeRect(x, y, w, h); handles([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#e08a00'); } }
  }
  function handles(pts, col) { for (const [x, y] of pts) { cx.fillStyle = '#fff'; cx.strokeStyle = col || COL.sel; cx.lineWidth = 2.5; cx.fillRect(x - 8, y - 8, 16, 16); cx.strokeRect(x - 8, y - 8, 16, 16); } }

  /* ═══ [BLOCK C-DIM] размеры и стрелки: положение концов, значение, отрисовка ═══ */
  const COLD = {line: '#1b1e23', sel: '#1f6fd1', none: '#d0342c'};
  function phFull(p) { const k = p.w / ((p.cr[2] - p.cr[0]) * p.iw); return {x: p.x - p.cr[0] * p.iw * k, y: p.y - p.cr[1] * p.ih * k, w: p.iw * k, h: p.ih * k}; }
  function endPos(e) {                                           // мм холста; цель удалена — последнее место
    let q = null;
    if (e.t === 'node') { const n = node(e.id); if (n) q = {x: n.x, y: n.y}; }
    else if (e.t === 'wall') { const w = wall(e.id), a = w && node(w.a), b = w && node(w.b); if (a && b) q = {x: a.x + (b.x - a.x) * e.s, y: a.y + (b.y - a.y) * e.s}; }
    else if (e.t === 'elev') { const o = elev(e.id); if (o) { const r = elevRect(o); q = {x: r.x + r.w * e.u, y: r.y + r.h * e.v}; } }
    else if (e.t === 'photo') { const p = photo(e.id); if (p) { const F = phFull(p); q = {x: F.x + F.w * e.u, y: F.y + F.h * e.v}; } }
    else if (e.t === 'com') q = comEnd(e);
    return q || {x: e.x, y: e.y};
  }
  const surf = e => (e.t === 'node' || e.t === 'wall') && endPos(e) ? 'plan' : e.t === 'elev' && elev(e.id) ? 'e:' + e.id : e.t === 'com' && com(e.id) && elev(com(e.id).e) ? 'e:' + com(e.id).e : null;
  function dimVal(d) {                                           // {txt, kind:'man'|'geo'|'none'}
    if (d.v !== '' && d.v != null) return {txt: num(d.v), kind: 'man'};
    const sa = surf(d.a); if (sa && sa === surf(d.b)) { const A = endPos(d.a), B = endPos(d.b); return {txt: num(hyp(B.x - A.x, B.y - A.y)), kind: 'geo'}; }
    return {txt: '?', kind: 'none'};
  }
  const DLBL = new Map();
  function head(x, y, ux, uy, L) { cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - ux * L - uy * L * 0.38, y - uy * L + ux * L * 0.38); cx.lineTo(x - ux * L + uy * L * 0.38, y - uy * L - ux * L * 0.38); cx.closePath(); cx.fill(); }
  function drawDims() {
    DLBL.clear(); if (!LAY.dim) return;
    for (const d of D.dims) {
      const A = endPos(d.a), B = endPos(d.b), [ax, ay] = toS(A.x, A.y), [bx, by] = toS(B.x, B.y), L = hyp(bx - ax, by - ay); if (L < 2) continue;
      const on = C.sel && C.sel.t === 'dim' && C.sel.id === d.id, ux = (bx - ax) / L, uy = (by - ay) / L, col = on ? COLD.sel : COLD.line;
      cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = on ? 2.4 : 1.6; cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke();
      head(bx, by, ux, uy, 11); if (d.k !== 'arr') head(ax, ay, -ux, -uy, 11);
      const val = dimVal(d), edit = KB.tg && KB.tg.t === 'dim' && KB.tg.id === d.id, t = edit ? (KB.buf || ' ') + '▏' : val.txt;
      let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = Math.sin(ang), ny = -Math.cos(ang), cxp = mx + nx * 14, cyp = my + ny * 14;
      cx.save(); cx.translate(cxp, cyp); cx.rotate(ang); cx.font = '700 14px system-ui'; const tw = cx.measureText(t).width + 12;
      cx.fillStyle = edit ? '#fff7d1' : '#ffffffe6'; cx.fillRect(-tw / 2, -11, tw, 22);
      if (val.kind === 'none' && !edit) { cx.strokeStyle = COLD.none; cx.setLineDash([4, 3]); cx.lineWidth = 1.5; cx.strokeRect(-tw / 2, -11, tw, 22); cx.setLineDash([]); }
      else if (edit) { cx.strokeStyle = '#c99a1e'; cx.lineWidth = 2; cx.strokeRect(-tw / 2, -11, tw, 22); }
      cx.fillStyle = val.kind === 'none' && !edit ? COLD.none : val.kind === 'man' || edit ? '#1f4fa8' : col; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 0, 1); cx.restore();
      DLBL.set(d.id, {x: cxp, y: cyp, r: Math.max(tw / 2, 14) + 6});
      /* маркеров на концах нет (владелец 12.11): выбранный — только цветом; конец берётся пальцем в радиусе касания */
    }
  }
  /* привязка конца размера: точка (узел, угол фото/развёртки, конец размера) → грань (стена, край развёртки/фото) → поверхность (фото, развёртка) → свободно */
  function snapDim(sx, sy, skipDim, from) {
    let best = null, bd = 20; const q0 = toW(sx, sy);
    const pt = (x, y, e) => { const [X, Y] = toS(x, y), dd = hyp(X - sx, Y - sy); if (dd < bd) { bd = dd; best = {...e, x: rnd(x * 10) / 10, y: rnd(y * 10) / 10}; } };
    for (const n of D.nodes) pt(n.x, n.y, {t: 'node', id: n.id});
    for (const o of D.elev) { const r = elevRect(o); [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v]) => pt(r.x + r.w * u, r.y + r.h * v, {t: 'elev', id: o.id, u, v})); }
    for (const e of comSnapPts()) { const P = comEnd(e); if (P) pt(P.x, P.y, e); }
    for (const d of D.dims) if (d.id !== skipDim) for (const e of [d.a, d.b]) if (e.t === 'node' || e.t === 'wall' || e.t === 'elev') { const P = endPos(e); pt(P.x, P.y, {...e}); }
    if (best) return best;                                       // геометрия плана и развёрток важнее углов фото
    for (const p of D.photos) { const F = phFull(p); [[p.cr[0], p.cr[1]], [p.cr[2], p.cr[1]], [p.cr[2], p.cr[3]], [p.cr[0], p.cr[3]]].forEach(([u, v]) => pt(F.x + F.w * u, F.y + F.h * v, {t: 'photo', id: p.id, u, v})); }
    for (const d of D.dims) if (d.id !== skipDim) for (const e of [d.a, d.b]) if (!(e.t === 'node' || e.t === 'wall' || e.t === 'elev')) { const P = endPos(e); pt(P.x, P.y, {...e}); }
    if (best) return best;
    bd = 14; const seg = (A, B, mk) => { const [ax, ay] = toS(A.x, A.y), [bx, by] = toS(B.x, B.y), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; if (!L2) return;
      const t = clamp(((sx - ax) * dx + (sy - ay) * dy) / L2, 0, 1), dd = hyp(ax + dx * t - sx, ay + dy * t - sy); if (dd < bd) { bd = dd; best = mk(t, A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t); } };
    for (const w of D.walls) { const a = node(w.a), b = node(w.b); if (a && b) seg(a, b, (t, x, y) => ({t: 'wall', id: w.id, s: t, x, y})); }
    for (const o of D.elev) { const r = elevRect(o), C4 = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (let i = 0; i < 4; i++) { const [u0, v0] = C4[i], [u1, v1] = C4[(i + 1) % 4]; seg({x: r.x + r.w * u0, y: r.y + r.h * v0}, {x: r.x + r.w * u1, y: r.y + r.h * v1}, (t, x, y) => ({t: 'elev', id: o.id, u: u0 + (u1 - u0) * t, v: v0 + (v1 - v0) * t, x, y})); } }
    if (best) return best;
    let q = q0;
    if (from) { const A = endPos(from), dx = q.x - A.x, dy = q.y - A.y, m = ((Math.atan2(dy, dx) * 180 / Math.PI) % 90 + 90) % 90; if (m < 6 || m > 84) q = Math.abs(dx) >= Math.abs(dy) ? {x: q.x, y: A.y} : {x: A.x, y: q.y}; }
    return surfAt(q);
  }
  function surfAt(q) {
    for (let i = D.elev.length - 1; i >= 0; i--) { const o = D.elev[i], r = elevRect(o); if (r.w && r.h && q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return {t: 'elev', id: o.id, u: (q.x - r.x) / r.w, v: (q.y - r.y) / r.h, x: q.x, y: q.y}; }
    if (!C.phHide) for (let i = D.photos.length - 1; i >= 0; i--) { const p = D.photos[i]; if (q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + phH(p)) { const F = phFull(p); return {t: 'photo', id: p.id, u: (q.x - F.x) / F.w, v: (q.y - F.y) / F.h, x: q.x, y: q.y}; } }
    return {t: 'free', x: rnd(q.x * 10) / 10, y: rnd(q.y * 10) / 10};
  }
  function addDim(a, b) {
    const A = endPos(a), B = endPos(b); if (hyp(B.x - A.x, B.y - A.y) * V.s < 12) return null;
    begin(); const d = {id: uid('d'), k: C.tool === 'arr' ? 'arr' : 'dim', a, b, v: ''}; D.dims.push(d); commit(); return d;
  }


  /* ═══ [BLOCK C-B2] Б2 «Правка»: рамка выделения (группа) и «4 угла» → стена по фото ═══
     Группа C.msel: рамка берёт всё, что задела (контур задет или объект целиком внутри; рамка внутри большого объекта его не берёт — как v81);
     касание объекта в «рамке» — добавить/убрать; перенос любого члена группы — переносит группу; 🗑 — группа целиком (один шаг ↶).
     Рамка «4 угла»: 4 касания по фото → углы (доли полного кадра, следуют за фото); «Стена по рамке» — ввод L (и H проекта, если нет) →
     стена плана С№ + развёртка L×H справа от фото, низ — по низу рамки; фото масштабируется: ширина рамки = L. */
  const COLF = '#F28C00';
  const frPts = f => { const p = photo(f.ph); if (!p) return null; const F = phFull(p); return f.q.map(([u, v]) => ({x: F.x + F.w * u, y: F.y + F.h * v})); };
  function drawFrames() {
    for (const f of D.frames) {
      const Q = frPts(f); if (!Q) continue; const S = Q.map(q => toS(q.x, q.y)), on = C.sel && C.sel.t === 'frame' && C.sel.id === f.id;
      cx.beginPath(); S.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath();
      cx.fillStyle = 'rgba(242,140,0,.14)'; cx.fill(); cx.strokeStyle = on ? COL.sel : COLF; cx.lineWidth = on ? 2.6 : 2; cx.stroke();
      for (const [x, y] of S) { cx.fillStyle = on ? COL.sel : COLF; cx.beginPath(); cx.arc(x, y, on ? 7 : 4.5, 0, 7); cx.fill(); }
      if (KB.tg && KB.tg.t === 'fL' && KB.tg.id === f.id) label('L ' + (KB.buf || ' ') + '▏', (S[0][0] + S[1][0]) / 2, Math.min(S[0][1], S[1][1]) - 14, '#c99a1e');
      const w = f.wall && wall(f.wall); if (w) label('С' + w.gn, (S[0][0] + S[1][0]) / 2, Math.min(S[0][1], S[1][1]) - 14, COLF);
    }
    if (G && G.t === 'ptsd' && G.b) { const [ax, ay] = toS(G.a.x, G.a.y), [bx, by] = toS(G.b.x, G.b.y); cx.strokeStyle = COLF; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); cx.setLineDash([]); }
    const P = C.ptsP; if (P && P.q.length) { const p = photo(P.ph); if (p) { const F = phFull(p), S = P.q.map(([u, v]) => toS(F.x + F.w * u, F.y + F.h * v));
      cx.strokeStyle = COLF; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.beginPath(); S.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.stroke(); cx.setLineDash([]);
      for (const [x, y] of S) { cx.fillStyle = COLF; cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); } } }
  }
  const inMsel = (t, id) => C.msel.some(m => m.t === t && m.id === id);
  function objBox(m) {                                           // мм: {x0,y0,x1,y1, seg?:[A,B]}
    if (m.t === 'photo') { const p = photo(m.id); return p && {x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + phH(p)}; }
    if (m.t === 'elev') { const e = elev(m.id); if (!e) return null; const r = elevRect(e); return {x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h}; }
    if (m.t === 'wall') { const w = wall(m.id), a = w && node(w.a), b = w && node(w.b); return a && b && {seg: [a, b]}; }
    if (m.t === 'dim') { const d = dim(m.id); return d && {seg: [endPos(d.a), endPos(d.b)]}; }
    if (m.t === 'frame') { const f = frame(m.id), Q = f && frPts(f); return Q && {poly: Q}; }
    if (m.t === 'com') { const c = D.com.find(x => x.id === m.id); return c ? comBoxW(c) : null; }
    if (typeof B3box === 'function') return B3box(m);
    return null;
  }
  function drawGroup() {
    const g = G; if (g && g.t === 'rs' && g.r) { const [a, b] = g.r.map(q => toS(q.x, q.y)); cx.fillStyle = 'rgba(31,111,209,.10)'; cx.strokeStyle = COL.sel; cx.lineWidth = 1.5; cx.setLineDash([6, 4]);
      cx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); cx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); cx.setLineDash([]); }
    if (!C.msel.length) return;
    cx.strokeStyle = COL.sel; cx.lineWidth = 3;
    for (const m of C.msel) { const o = objBox(m); if (!o) continue;
      if (o.seg) { const [A, B] = o.seg.map(q => toS(q.x, q.y)); cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); }
      else if (o.poly) { cx.beginPath(); o.poly.forEach((q, i) => { const [x, y] = toS(q.x, q.y); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.closePath(); cx.stroke(); }
      else if (o.pts) { cx.beginPath(); o.pts.forEach((q, i) => { const [x, y] = toS(q.x, q.y); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.stroke(); }
      else { const [x0, y0] = toS(o.x0, o.y0), [x1, y1] = toS(o.x1, o.y1); cx.strokeRect(x0, y0, x1 - x0, y1 - y0); } }
  }
  /* рамка выделения: что задето */
  const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
  function rsTouch(o, R) {
    const inR = q => q.x >= R.x0 && q.x <= R.x1 && q.y >= R.y0 && q.y <= R.y1;
    const E = [[{x: R.x0, y: R.y0}, {x: R.x1, y: R.y0}], [{x: R.x1, y: R.y0}, {x: R.x1, y: R.y1}], [{x: R.x1, y: R.y1}, {x: R.x0, y: R.y1}], [{x: R.x0, y: R.y1}, {x: R.x0, y: R.y0}]];
    const lineTouch = P => P.some(inR) || P.some((q, i) => i && E.some(([c, d]) => segX(P[i - 1], q, c, d)));
    if (o.seg) return lineTouch(o.seg);
    if (o.pts) return lineTouch(o.pts);
    const poly = o.poly || [{x: o.x0, y: o.y0}, {x: o.x1, y: o.y0}, {x: o.x1, y: o.y1}, {x: o.x0, y: o.y1}];
    if (lineTouch([...poly, poly[0]])) return true;              // контур задет или объект целиком внутри
    return false;                                                // рамка внутри объекта — не берёт
  }
  function rsPick(a, b) {
    const R = {x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y)}, out = [];
    const all = [...D.photos.map(o => ({t: 'photo', id: o.id})), ...D.elev.map(o => ({t: 'elev', id: o.id})), ...D.walls.map(o => ({t: 'wall', id: o.id})),
      ...D.dims.map(o => ({t: 'dim', id: o.id})), ...D.frames.map(o => ({t: 'frame', id: o.id})), ...(typeof B3all === 'function' ? B3all() : []), ...D.com.map(o => ({t: 'com', id: o.id}))];
    for (const m of all) { const o = objBox(m); if (o && rsTouch(o, R)) out.push(m); }
    return out;
  }
  const normHit = h => !h ? null : h.t === 'label' ? {t: 'wall', id: h.id} : h.t === 'dlabel' || h.t === 'dim-h' ? {t: 'dim', id: h.id} : h.t === 'elabel' ? {t: 'elev', id: h.id}
    : h.t === 'ph-h' ? {t: 'photo', id: h.id} : h.t === 'fr-h' ? {t: 'frame', id: h.id} : h.t === 'drw-h' ? {t: 'drw', id: h.id} : h.t === 'com-h' || h.t === 'cofl' ? {t: 'com', id: h.id} : h.t === 'node' ? null : {t: h.t, id: h.id};
  /* перенос группы */
  function gStart(g) {
    begin(); const nodes = new Set(), o = {ph: {}, el: {}, nd: {}, dm: {}};
    for (const m of C.msel) {
      if (m.t === 'photo') { const p = photo(m.id); if (p) o.ph[p.id] = [p.x, p.y]; }
      if (m.t === 'frame') { const f = frame(m.id), p = f && photo(f.ph); if (p) o.ph[p.id] = [p.x, p.y]; }
      if (m.t === 'elev') { const e = elev(m.id); if (e) o.el[e.id] = [e.x, e.y]; }
      if (m.t === 'wall') { const w = wall(m.id); if (w) { nodes.add(w.a); nodes.add(w.b); } }
      if (m.t === 'dim') { const d = dim(m.id); if (d) o.dm[d.id] = [endPos(d.a), endPos(d.b)]; }
    }
    for (const id of nodes) { const n = node(id); o.nd[id] = [n.x, n.y]; }
    g.go = o; if (typeof B3gStart === 'function') B3gStart(g);
  }
  function gMove(g, mx, my) {
    const o = g.go;
    for (const id in o.ph) { const p = photo(id); p.x = rnd(o.ph[id][0] + mx); p.y = rnd(o.ph[id][1] + my); }
    for (const id in o.el) { const e = elev(id); e.x = rnd(o.el[id][0] + mx); e.y = rnd(o.el[id][1] + my); }
    for (const id in o.nd) { const n = node(id); n.x = rnd(o.nd[id][0] + mx); n.y = rnd(o.nd[id][1] + my); }
    for (const id in o.dm) { const d = dim(id), [A, B] = o.dm[id];                  // концы на перенесённых фото/развёртках/стенах следуют сами; свободные — сдвигаются
      if (d.a.t === 'free') d.a = {t: 'free', x: rnd((A.x + mx) * 10) / 10, y: rnd((A.y + my) * 10) / 10};
      if (d.b.t === 'free') d.b = {t: 'free', x: rnd((B.x + mx) * 10) / 10, y: rnd((B.y + my) * 10) / 10}; }
    if (typeof B3gMove === 'function') B3gMove(g, mx, my);
    draw();
  }
  function delGroup() {
    begin(); dimCache(); const has = t => new Set(C.msel.filter(m => m.t === t).map(m => m.id));
    const ph = has('photo'), el = has('elev'), dm = has('dim'), wl = has('wall'), fr = has('frame');
    D.photos = D.photos.filter(p => !ph.has(p.id)); D.elev = D.elev.filter(e => !el.has(e.id)); D.dims = D.dims.filter(d => !dm.has(d.id));
    D.walls = D.walls.filter(w => !wl.has(w.id)); D.frames = D.frames.filter(f => !fr.has(f.id)); D.drw = D.drw.filter(q => !inMsel('drw', q.id)); D.com = D.com.filter(c => !inMsel('com', c.id));
    if (typeof B3delGroup === 'function') B3delGroup();
    dropOrphans(); const n = C.msel.length; C.msel = []; C.sel = null; commit(); toast('Удалено: ' + n + ' · ↶ — вернуть');
  }
  /* «4 угла» */
  function ptsTap(sx, sy) {
    const q = toW(sx, sy); let p = null;
    for (let i = D.photos.length - 1; i >= 0; i--) { const o = D.photos[i]; if (q.x >= o.x && q.x <= o.x + o.w && q.y >= o.y && q.y <= o.y + phH(o)) { p = o; break; } }
    if (!p) { toast('4 угла — касаниями по фото'); return; }
    if (!C.ptsP || C.ptsP.ph !== p.id) C.ptsP = {ph: p.id, q: []};
    const F = phFull(p); C.ptsP.q.push([(q.x - F.x) / F.w, (q.y - F.y) / F.h]);
    if (C.ptsP.q.length < 4) { draw(); return; }
    const Q = C.ptsP.q, cxm = Q.reduce((a, t) => a + t[0], 0) / 4, cym = Q.reduce((a, t) => a + t[1], 0) / 4;
    const srt = Q.slice().sort((a, b) => Math.atan2(a[1] - cym, a[0] - cxm) - Math.atan2(b[1] - cym, b[0] - cxm));   // по часовой (y вниз)
    let i0 = 0; srt.forEach((t, i) => { if (t[0] + t[1] < srt[i0][0] + srt[i0][1]) i0 = i; });
    begin(); const f = {id: uid('r'), ph: p.id, q: [0, 1, 2, 3].map(k => srt[(i0 + k) % 4].map(v => rnd(v * 1e5) / 1e5)), wall: null}; D.frames.push(f);
    C.ptsP = null; C.sel = {t: 'frame', id: f.id}; commit(); toast('Рамка готова · «Стена по рамке» — L × H');
  }
  function frameCornerDrag(g, q) {
    const f = frame(g.h.id), p = f && photo(f.ph); if (!p) return; const F = phFull(p);
    f.q[g.h.c] = [rnd(clamp((q.x - F.x) / F.w, 0, 1) * 1e5) / 1e5, rnd(clamp((q.y - F.y) / F.h, 0, 1) * 1e5) / 1e5]; draw();
  }
  function frameWall(f) {
    const w0 = f.wall && wall(f.wall); if (w0) { addElev(w0); return; }
    openKb('fL', f.id); toast('Длина стены L');
  }
  function mkFrameWall(f, L) {
    if (!Hmm()) { setTimeout(() => { KB.after = () => { if (Hmm() && frame(f.id)) mkFrameWall(frame(f.id), L); }; openKb('H', null); toast('Высота H'); }, 0); return; }
    const p = photo(f.ph); if (!p) return; let Q = frPts(f);
    const wf = (hyp(Q[1].x - Q[0].x, Q[1].y - Q[0].y) + hyp(Q[2].x - Q[3].x, Q[2].y - Q[3].y)) / 2; if (!(wf > 0)) return;
    begin(); p.w = Math.max(1, rnd(p.w * L / wf)); Q = frPts(f);
    const H = Hmm(), ex = rnd(Math.min(Q[0].x, Q[3].x)), ey = rnd(p.y - H - 600);   // развёртка — над фото (замечание 6), низ стены над верхом фото
    let bx, by; if (D.nodes.length) { bx = Math.max(...D.nodes.map(n => n.x)) + 800; by = Math.min(...D.nodes.map(n => n.y)); } else { bx = ex; by = ey - 1200; }
    const na = {id: uid('n'), x: rnd(bx), y: rnd(by)}, nb = {id: uid('n'), x: rnd(bx + L), y: rnd(by)}; D.nodes.push(na, nb);
    const w = {id: uid('w'), a: na.id, b: nb.id, gn: ++D.gnHi}; D.walls.push(w);
    const e = {id: uid('e'), wall: w.id, x: ex, y: ey}; D.elev.push(e); f.wall = w.id; C.sel = {t: 'elev', id: e.id}; commit();
    toast(`Стена С${w.gn}: ${rnd(L)} × ${H} · фото — под рамку`);
  }

  /* ═══ [BLOCK C-B3] Б3 «Рисование и пометки»: перо, линия, ломаная, прямоугольник, круг, дуга, ластик, текст, пин №, выноска; цвет, толщина; фото видно/скрыто.
     Поведение — как v81 (блок «РИСОВАНИЕ» v26/v78): перо/линия/прямоугольник/круг/выноска — протяжкой; дуга — 3 касания; ломаная — касания,
     касание последней точки или ✓ — готово; текст/пин — касание, ввод подписи; ластик — касание/протяжка по рисунку; инструмент остаётся.
     Рисунок лежит на основе под первой точкой (развёртка → фото → холст) и следует за её переносом, масштабом и подрезкой.
     Толщина — одна на все рисунки (футляр, 0,5…12, по умолчанию 3, как v81); цвет — выбранный в строке/футляре, у выбранного рисунка — меняется. ═══ */
  const isLbl = h => !!h && (h.t === 'label' || h.t === 'dlabel' || h.t === 'elabel' || h.t === 'edim');   // подписи (длина, размер, H) — ввод значения в любом инструменте
  const DRWK = new Set(['pen', 'ln', 'pl', 'rect', 'circ', 'arc', 'er', 'txt', 'pin', 'vyn']);   // заметка (note) — Б6, рисунок того же вида
  const DRW_N = {pen: 'перо', ln: 'линия', pl: 'ломаная', rect: 'прямоугольник', circ: 'круг', arc: 'дуга', txt: 'текст', pin: 'пин', vyn: 'выноска'};
  C.col = (() => { try { return localStorage.getItem('akx-core-col') || '#1f6fd1'; } catch (e) { return '#1f6fd1'; } })();
  const LW = {v: (() => { try { const v = +localStorage.getItem('akx-core-lw'); return v >= 0.5 && v <= 12 ? v : 3; } catch (e) { return 3; } })()};
  const lwPx = sel => 2.2 * LW.v / 3 * (sel ? 1.6 : 1);
  const TBOX = new Map();                                        // id → прямоугольник подписи (px) — текст, пин, выноска
  function hostAt(q) {
    for (let i = D.elev.length - 1; i >= 0; i--) { const o = D.elev[i], r = elevRect(o); if (r.w && r.h && q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return {t: 'elev', id: o.id}; }
    if (!C.phHide) for (let i = D.photos.length - 1; i >= 0; i--) { const p = D.photos[i]; if (q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + phH(p)) return {t: 'photo', id: p.id}; }
    return null;
  }
  function hostR(h) { if (!h) return null; if (h.t === 'elev') { const o = elev(h.id); return o ? elevRect(o) : null; } const p = photo(h.id); if (!p) return null; const F = phFull(p); return {x: F.x, y: F.y, w: F.w, h: F.h}; }
  const enc = (h, R, pt) => (R && R.w && R.h ? [rnd((pt.x - R.x) / R.w * 1e5) / 1e5, rnd((pt.y - R.y) / R.h * 1e5) / 1e5] : [rnd(pt.x * 10) / 10, rnd(pt.y * 10) / 10]);
  function drwW(q) {                                             // мм холста
    if (!q) return []; const R = hostR(q.h);
    if (q.h && !R) return (q.wp || []).map(([x, y]) => ({x, y}));
    return q.p.map(t => (R ? {x: R.x + R.w * t[0], y: R.y + R.h * t[1]} : {x: t[0], y: t[1]}));
  }
  function drwSet(q, W) { const R = hostR(q.h); if (q.h && !R) { q.h = null; delete q.wp; } q.p = W.map(pt => enc(q.h, hostR(q.h), pt)); }
  function B3cache() { for (const q of D.drw) if (q.h) q.wp = drwW(q).map(t => [rnd(t.x), rnd(t.y)]); }
  function drwNew(k, W, o) {
    const h = hostAt(W[0]); begin(); const q = {id: uid('g'), k, c: C.col, h, p: [], ...o}; drwSet(q, W); D.drw.push(q); C.sel = {t: 'drw', id: q.id}; commit(); return q;
  }
  const snap90 = (A, q) => { const dx = q.x - A.x, dy = q.y - A.y, m = ((Math.atan2(dy, dx) * 180 / Math.PI) % 90 + 90) % 90; return m < 6 || m > 84 ? (Math.abs(dx) >= Math.abs(dy) ? {x: q.x, y: A.y} : {x: A.x, y: q.y}) : q; };
  function circ3(A, B, Cc) {                                     // окружность через 3 точки (px) — как zdCirc3 v81
    const d = 2 * (A[0] * (B[1] - Cc[1]) + B[0] * (Cc[1] - A[1]) + Cc[0] * (A[1] - B[1])); if (Math.abs(d) < 1e-6) return null;
    const a2 = A[0] * A[0] + A[1] * A[1], b2 = B[0] * B[0] + B[1] * B[1], c2 = Cc[0] * Cc[0] + Cc[1] * Cc[1];
    const x = (a2 * (B[1] - Cc[1]) + b2 * (Cc[1] - A[1]) + c2 * (A[1] - B[1])) / d, y = (a2 * (Cc[0] - B[0]) + b2 * (A[0] - Cc[0]) + c2 * (B[0] - A[0])) / d;
    return {x, y, r: hyp(A[0] - x, A[1] - y), ccw: (B[0] - A[0]) * (Cc[1] - A[1]) - (B[1] - A[1]) * (Cc[0] - A[0]) < 0};
  }
  function drwShape(k, S, q, c, w, sel) {                        // S — точки px
    cx.strokeStyle = c; cx.fillStyle = c; cx.lineWidth = w; cx.lineJoin = 'round'; cx.lineCap = 'round'; cx.setLineDash(q.dash ? [8, 5] : []);
    if (k === 'pen' || k === 'pl' || k === 'ln') { cx.beginPath(); S.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.stroke(); }
    else if (k === 'rect') { const [A, B] = S; cx.beginPath(); cx.rect(Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.abs(B[0] - A[0]), Math.abs(B[1] - A[1])); if (q.fill) { cx.globalAlpha = 0.25; cx.fill(); cx.globalAlpha = 1; } cx.stroke(); }
    else if (k === 'circ') { const [A, B] = S; cx.beginPath(); cx.arc(A[0], A[1], hyp(B[0] - A[0], B[1] - A[1]), 0, 7); if (q.fill) { cx.globalAlpha = 0.25; cx.fill(); cx.globalAlpha = 1; } cx.stroke(); }
    else if (k === 'arc') { const [A, B, Cc] = S, o = circ3(A, B, Cc); cx.beginPath(); if (o) cx.arc(o.x, o.y, o.r, Math.atan2(A[1] - o.y, A[0] - o.x), Math.atan2(Cc[1] - o.y, Cc[0] - o.x), o.ccw); else { cx.moveTo(A[0], A[1]); cx.lineTo(Cc[0], Cc[1]); } cx.stroke(); }
    cx.setLineDash([]);
  }
  function textBox(id, t, x, y, c, edit, pin) {
    cx.font = '700 15px system-ui'; const tw = t ? cx.measureText(t).width : 0; let X = x;
    if (pin) { cx.fillStyle = c; cx.beginPath(); cx.arc(x, y, 11, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(pin), x, y + 1); X = x + 15; }
    if (t || edit) { cx.fillStyle = edit ? '#fff7d1' : 'rgba(255,255,255,.88)'; cx.fillRect(X - 3, y - 11, Math.max(tw, 10) + 6, 22); if (edit) { cx.strokeStyle = '#c99a1e'; cx.lineWidth = 1.5; cx.strokeRect(X - 3, y - 11, Math.max(tw, 10) + 6, 22); }
      cx.fillStyle = c; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillText(t, X, y + 1); }
    const r = pin ? {x: x - 12, y: y - 12, w: (t ? tw + 22 : 0) + 24, h: 24} : {x: X - 4, y: y - 12, w: Math.max(tw, 12) + 8, h: 24}; TBOX.set(id, r); return r;
  }
  function drawDrw() {
    TBOX.clear();
    for (const q of D.drw) {
      if (!(q.k === 'vyn' ? LAY.vyn : LAY.pen)) continue;
      const W = drwW(q); if (!W.length) continue; const S = W.map(t => toS(t.x, t.y)), sel = (C.sel && C.sel.t === 'drw' && C.sel.id === q.id), c = sel ? COL.sel : q.c || '#1a2027';
      const ed = TXI.id === q.id && TXI.focus, tx = TXI.id === q.id ? txIn.value : q.tx;
      if (q.k === 'note') { const [x, y] = S[0], lines = String(tx || (ed ? '' : 'заметка')).split(/\n/); cx.font = '600 14px system-ui';
        const w = Math.max(90, ...lines.map(t => cx.measureText(t).width + 16)), h = lines.length * 18 + 14; cx.fillStyle = '#FFF3B0'; cx.fillRect(x, y, w, h); cx.strokeStyle = sel ? COL.sel : '#D4A300'; cx.lineWidth = sel ? 2 : 1.2; cx.strokeRect(x, y, w, h);
        cx.fillStyle = tx ? '#3a3000' : '#a89850'; cx.textAlign = 'left'; cx.textBaseline = 'top'; lines.forEach((t, i) => cx.fillText(t, x + 8, y + 8 + i * 18)); TBOX.set(q.id, {x, y, w, h}); }
      else if (q.k === 'txt') textBox(q.id, tx || (ed ? '' : '…'), S[0][0], S[0][1], c, ed);
      else if (q.k === 'pin') textBox(q.id, tx || '', S[0][0], S[0][1], c, ed, q.n || '?');
      else if (q.k === 'vyn') { const [A, B] = S; cx.strokeStyle = c; cx.lineWidth = Math.max(1.2, lwPx(sel) * 0.75); cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke();
        cx.fillStyle = c; cx.beginPath(); cx.arc(A[0], A[1], 4, 0, 7); cx.fill();
        cx.font = '600 13px system-ui'; const t = tx || '…', tw = Math.max(cx.measureText(t).width, 14), r = {x: B[0] - 4, y: B[1] - 18, w: tw + 8, h: 22};
        cx.fillStyle = ed ? '#fff7d1' : '#fff'; cx.fillRect(r.x, r.y, r.w, r.h); cx.strokeStyle = ed ? '#c99a1e' : c; cx.lineWidth = 1.2; cx.strokeRect(r.x, r.y, r.w, r.h);
        cx.fillStyle = tx ? '#1a2027' : '#9aa5b1'; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillText(t, r.x + 4, r.y + r.h / 2); TBOX.set(q.id, r); }
      else drwShape(q.k, S, q, c, lwPx(sel), sel);
      if (sel && q.k !== 'pen' && q.k !== 'txt' && q.k !== 'pin' && q.k !== 'note') for (const [x, y] of S) { cx.fillStyle = '#fff'; cx.strokeStyle = COL.sel; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); cx.stroke(); }
    }
    const g = G;                                                  // строящийся рисунок
    if (g && g.t === 'pen' && g.pts.length > 1) drwShape('pen', g.pts.map(t => toS(t.x, t.y)), {}, C.col, lwPx());
    if (g && g.t === 'zd2' && g.b) { const k = C.tool, S2 = [g.a, g.b].map(t => toS(t.x, t.y));
      if (k === 'vyn') { cx.strokeStyle = C.col; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(S2[0][0], S2[0][1]); cx.lineTo(S2[1][0], S2[1][1]); cx.stroke(); } else drwShape(k, S2, {}, C.col, lwPx()); }
    if (C.zdp.length && (C.tool === 'arc' || C.tool === 'pl')) { const S3 = C.zdp.map(t => toS(t.x, t.y));
      if (C.tool === 'pl' && S3.length > 1) drwShape('pl', S3, {dash: 0}, C.col, lwPx());
      for (const [x, y] of S3) { cx.fillStyle = C.col; cx.beginPath(); cx.arc(x, y, 5, 0, 7); cx.fill(); } }
  }
  function drwHitQ(q, sx, sy) {
    if (q.k === 'txt' || q.k === 'pin' || q.k === 'vyn' || q.k === 'note') { const r = TBOX.get(q.id); if (r && sx >= r.x - 6 && sx <= r.x + r.w + 6 && sy >= r.y - 6 && sy <= r.y + r.h + 6) return true; if (q.k !== 'vyn' && q.k !== 'note') { const [A] = drwW(q).map(t => toS(t.x, t.y)); return A && hyp(A[0] - sx, A[1] - sy) < 18; } }
    const S = drwW(q).map(t => toS(t.x, t.y)); if (!S.length) return false;
    if (q.k === 'circ') { const r = hyp(S[1][0] - S[0][0], S[1][1] - S[0][1]), l = hyp(sx - S[0][0], sy - S[0][1]); return Math.abs(l - r) < 12 || (q.fill && l < r); }
    if (q.k === 'rect') { const [A, B] = S, x0 = Math.min(A[0], B[0]), x1 = Math.max(A[0], B[0]), y0 = Math.min(A[1], B[1]), y1 = Math.max(A[1], B[1]);
      if (q.fill && sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) return true; const P4 = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]; return P4.some((t, i) => i && segDist([sx, sy], P4[i - 1], t) < 12); }
    if (q.k === 'arc') { const o = circ3(...S); if (!o) return segDist([sx, sy], S[0], S[2]) < 12; if (Math.abs(hyp(sx - o.x, sy - o.y) - o.r) > 12) return false;
      const ang = a => (a + 2 * Math.PI) % (2 * Math.PI), a0 = Math.atan2(S[0][1] - o.y, S[0][0] - o.x), a1 = Math.atan2(S[2][1] - o.y, S[2][0] - o.x), t = Math.atan2(sy - o.y, sx - o.x);
      const cw = (x, y) => ang(y - x); return o.ccw ? cw(t, a0) <= cw(a1, a0) : cw(a0, t) <= cw(a0, a1); }
    return S.some((t, i) => i && segDist([sx, sy], S[i - 1], t) < 12);
  }
  function B3hit(sx, sy) { for (let i = D.drw.length - 1; i >= 0; i--) if ((D.drw[i].k === 'vyn' ? LAY.vyn : LAY.pen) && drwHitQ(D.drw[i], sx, sy)) return {t: 'drw', id: D.drw[i].id}; return null; }
  function B3handle(id, sx, sy) { const q = drw(id); if (!q || q.k === 'pen' || q.k === 'txt' || q.k === 'pin' || q.k === 'note') return null;
    const i = drwW(q).findIndex(t => { const [x, y] = toS(t.x, t.y); return hyp(x - sx, y - sy) < HR.handle; }); return i >= 0 ? {t: 'drw-h', id, i} : null; }
  function B3all() { return D.drw.map(q => ({t: 'drw', id: q.id})); }
  function B3box(m) {
    if (m.t !== 'drw') return null; const q = drw(m.id); if (!q) return null; const W = drwW(q);
    if (q.k === 'txt' || q.k === 'pin' || q.k === 'vyn' || q.k === 'note') { const r = TBOX.get(q.id); if (r) { const a = toW(r.x, r.y), b = toW(r.x + r.w, r.y + r.h); if (q.k === 'vyn') return {pts: [W[0], W[1], {x: a.x, y: a.y}, {x: b.x, y: a.y}, {x: b.x, y: b.y}, {x: a.x, y: b.y}, {x: a.x, y: a.y}]}; return {x0: a.x, y0: a.y, x1: b.x, y1: b.y}; } return {pts: [W[0], W[0]]}; }
    if (q.k === 'rect') { const [A, B] = W; return {x0: Math.min(A.x, B.x), y0: Math.min(A.y, B.y), x1: Math.max(A.x, B.x), y1: Math.max(A.y, B.y)}; }
    if (q.k === 'circ') { const [A, B] = W, r = hyp(B.x - A.x, B.y - A.y); return {poly: [...Array(24)].map((_, i) => ({x: A.x + r * Math.cos(i * Math.PI / 12), y: A.y + r * Math.sin(i * Math.PI / 12)}))}; }
    if (q.k === 'arc') { const S = W.map(t => toS(t.x, t.y)), o = circ3(...S); if (!o) return {pts: [W[0], W[2]]}; const pts = [];
      let a0 = Math.atan2(S[0][1] - o.y, S[0][0] - o.x), a1 = Math.atan2(S[2][1] - o.y, S[2][0] - o.x); if (o.ccw) { while (a1 > a0) a1 -= 2 * Math.PI; } else { while (a1 < a0) a1 += 2 * Math.PI; }
      for (let i = 0; i <= 20; i++) { const a = a0 + (a1 - a0) * i / 20, P = toW(o.x + o.r * Math.cos(a), o.y + o.r * Math.sin(a)); pts.push(P); } return {pts}; }
    return {pts: W};
  }
  function B3gStart(g) { g.go.cm = {}; for (const m of C.msel) if (m.t === 'com') { const c = com(m.id); if (c && !inMsel('elev', c.e)) g.go.cm[c.id] = clone(c); }
    g.go.dr = {}; for (const m of C.msel) if (m.t === 'drw') { const q = drw(m.id); if (q && !(q.h && inMsel(q.h.t, q.h.id))) g.go.dr[q.id] = drwW(q); } }
  function B3gMove(g, mx, my) {
    for (const id in g.go.cm) { const c = com(id), o = g.go.cm[id], dx = rnd(mx), dy = -rnd(my);
      if (c.a) { c.a = [o.a[0] + dx, o.a[1] + dy]; c.b = [o.b[0] + dx, o.b[1] + dy]; } else if (c.pts) c.pts = o.pts.map(t => [t[0] + dx, t[1] + dy]); else { c.x = o.x + dx; c.y = o.y + dy; if (o.ex) c.xv = o.xv - dx; if (o.ey) c.yv = o.yv - dy; } } for (const id in g.go.dr) { const q = drw(id); q.h = null; q.p = g.go.dr[id].map(t => [rnd((t.x + mx) * 10) / 10, rnd((t.y + my) * 10) / 10]); } }
  function B3del(s) { if (s.t === 'drw') D.drw = D.drw.filter(q => q.id !== s.id); if (s.t === 'com') D.com = D.com.filter(c => c.id !== s.id); if (s.t === 'op') D.ops = D.ops.filter(o => o.id !== s.id); if (s.t === 'room') D.rooms = D.rooms.filter(r => r.id !== s.id); }
  function B3moveKind(h) { return h.t === 'drw' ? 'drmove' : h.t === 'drw-h' ? 'drwh' : h.t === 'com' ? 'cmove' : h.t === 'com-h' ? 'cres' : null; }
  const eraseAt = (sx, sy) => { const h = B3hit(sx, sy); if (!h) return false; begin(); D.drw = D.drw.filter(q => q.id !== h.id); if (C.sel && C.sel.id === h.id) C.sel = null; return true; };
  function B3start(g, p, h) {
    if (h && h.t === 'drw-h') { g.t = 'drwh'; return true; }
    if (!DRWK.has(C.tool) || isLbl(h)) return false;
    const q = toW(p.x, p.y);
    if (C.tool === 'pen') { g.t = 'pen'; g.pts = [q]; return true; }
    if (C.tool === 'ln' || C.tool === 'rect' || C.tool === 'circ' || C.tool === 'vyn') { g.t = 'zd2'; g.a = q; g.b = null; return true; }
    if (C.tool === 'er') { g.t = 'er'; g.er = 0; return true; }
    g.t = 'pan'; return true;                                    // дуга, ломаная, текст, пин — касаниями; протяжка — сдвиг вида
  }
  function B3drag(g) {
    if (g.t === 'drmove') { begin(); const q = drw(g.h.id); g.o = drwW(q); C.sel = {t: 'drw', id: q.id}; ui(); }
    if (g.t === 'drwh') { begin(); C.sel = {t: 'drw', id: g.h.id}; ui(); }
  }
  function B3move(g, p, q, mx, my) {
    if (g.t === 'pen') { const L = g.pts[g.pts.length - 1], [lx, ly] = toS(L.x, L.y); if (hyp(lx - p.x, ly - p.y) > 4) g.pts.push(q); draw(); }
    else if (g.t === 'zd2') { g.b = C.tool === 'ln' ? snap90(g.a, q) : q; draw(); }
    else if (g.t === 'er') { if (eraseAt(p.x, p.y)) g.er++; draw(); }
    else if (g.t === 'drmove') { const d = drw(g.h.id); drwSet(d, g.o.map(t => ({x: t.x + mx, y: t.y + my}))); draw(); }
    else if (g.t === 'drwh') { const d = drw(g.h.id), W = drwW(d); W[g.h.i] = q; drwSet(d, W); draw(); }
  }
  function B3end(g, p) {
    if (g.t === 'pen') { const q = toW(p.x, p.y); if (g.pts.length > 1) { g.pts.push(q); drwNew('pen', g.pts.map(t => ({x: rnd(t.x), y: rnd(t.y)}))); } ui(); draw(); return true; }
    if (g.t === 'zd2') { if (g.b) { const [ax, ay] = toS(g.a.x, g.a.y), [bx, by] = toS(g.b.x, g.b.y);
      if (hyp(bx - ax, by - ay) >= 12) { const q = drwNew(C.tool, [g.a, g.b], C.tool === 'vyn' ? {tx: ''} : {}); if (C.tool === 'vyn') txOpen(q.id); } } ui(); draw(); return true; }
    if (g.t === 'er') { if (g.er) { commit(); toast('Стёрто: ' + g.er + ' · ↶ — вернуть'); } return true; }
    return false;
  }
  function B3tap(g, h) {
    if (!DRWK.has(C.tool) || isLbl(h)) return false;
    const k = C.tool, q = toW(g.p0.x, g.p0.y), hd = h && h.t === 'drw' ? drw(h.id) : null;
    if (k === 'er') { if (eraseAt(g.p0.x, g.p0.y)) { commit(); toast('Стёрто · ↶ — вернуть'); } return true; }
    if (k === 'txt' || k === 'pin') {
      if (hd && (hd.k === 'txt' || hd.k === 'pin')) { C.sel = {t: 'drw', id: hd.id}; ui(); draw(); txOpen(hd.id); return true; }
      const n = k === 'pin' ? Math.max(0, ...D.drw.filter(x => x.k === 'pin').map(x => x.n || 0)) + 1 : 0;
      const r = drwNew(k, [q], {tx: '', ...(n ? {n} : {})}); ui(); txOpen(r.id); return true; }
    if (k === 'vyn') { if (hd && hd.k === 'vyn') { C.sel = {t: 'drw', id: hd.id}; ui(); draw(); txOpen(hd.id); return true; }
      const r = drwNew('vyn', [q, {x: q.x + 40 / V.s, y: q.y - 40 / V.s}], {tx: ''}); ui(); txOpen(r.id); return true; }
    if (k === 'arc') { C.zdp.push(q); if (C.zdp.length === 3) { drwNew('arc', C.zdp.slice()); C.zdp = []; } ui(); draw(); return true; }
    if (k === 'pl') {
      if (!C.zdp.length && hd) { C.sel = {t: 'drw', id: hd.id}; ui(); draw(); return true; }
      if (C.zdp.length >= 2) { const L = C.zdp[C.zdp.length - 1], [lx, ly] = toS(L.x, L.y); if (hyp(lx - g.p0.x, ly - g.p0.y) < 16) { plDone(); return true; } }
      C.zdp.push(C.zdp.length ? snap90(C.zdp[C.zdp.length - 1], q) : q); ui(); draw(); return true; }
    C.sel = hd ? {t: 'drw', id: hd.id} : null; ui(); draw(); return true;   // перо, линия, прямоугольник, круг: касание — выбрать рисунок
  }
  function plDone() { if (C.zdp.length >= 2) drwNew('pl', C.zdp.slice()); C.zdp = []; ui(); draw(); }
  function drwCopy(q) { const W = drwW(q).map(t => ({x: t.x + 150, y: t.y - 150})); const o = clone(q); delete o.id; delete o.p; delete o.h; delete o.wp; delete o.k;
    if (q.k === 'pin') o.n = Math.max(0, ...D.drw.filter(x => x.k === 'pin').map(x => x.n || 0)) + 1; drwNew(q.k, W, o); ui(); toast('Копия'); }
  function drwOpt(q, o) { begin(); if (q[o]) delete q[o]; else q[o] = 1; commit(); ui(); }
  function B3act(s, B) {
    if (C.tool === 'pl' && C.zdp.length >= 2) B.push(['✓', plDone, 'Ломаная: готово']);
    if (!s || s.t !== 'drw') return; const q = drw(s.id); if (!q) return;
    if (['pen', 'ln', 'pl', 'rect', 'circ', 'arc'].includes(q.k)) B.push(['<span class="' + (q.dash ? 'opt on' : 'opt') + '">┄</span>', () => drwOpt(q, 'dash'), 'Пунктир']);
    if (q.k === 'rect' || q.k === 'circ') B.push(['<span class="' + (q.fill ? 'opt on' : 'opt') + '">■</span>', () => drwOpt(q, 'fill'), 'Заливка']);
    B.push(['⧉', () => drwCopy(q), 'Копия']);
  }
  /* ввод подписи: текст, пин, выноска — поле над нижними строками (системная клавиатура); пусто при уходе — текст удаляется (как v81 zdDropEmpty) */
  const TXI = {id: null}; const txEl = $('cTx'), txIn = $('cTxI');
  const TXK = {txt: 1, pin: 1, vyn: 1, note: 1};
  function txOpen(id, nofocus) { const q = drw(id); if (!q) return; if (TXI.id && TXI.id !== id) txClose(); TXI.id = id; TXI.focus = !nofocus; txIn.value = q.tx || ''; txIn.placeholder = q.k === 'txt' ? 'текст' : q.k === 'note' ? 'заметка' : 'подпись'; txEl.classList.add('on');
    if (!nofocus) setTimeout(() => { try { txIn.focus(); } catch (e) { } }, 30); draw(); }
  txIn.addEventListener('focus', () => { TXI.focus = true; draw(); });
  function B3ui() { if (String(TXI.id).startsWith('room:') && C.sel && C.sel.t === 'room' && 'room:' + C.sel.id === TXI.id) return; const s = C.sel, q = s && s.t === 'drw' && drw(s.id); if (!q || q.id !== TXI.skip) TXI.skip = null;
    if (q && TXK[q.k]) { if (TXI.id !== q.id && TXI.skip !== q.id) txOpen(q.id, true); } else if (TXI.id && !txBusy) txClose(); }
  let txBusy = false;
  function txClose() {
    if (!TXI.id || txBusy) return; txBusy = true;
    if (String(TXI.id).startsWith('room:')) { const r = room(TXI.id.slice(5)); TXI.id = null; TXI.focus = false; txEl.classList.remove('on'); try { txIn.blur(); } catch (e) { }
      const v = txIn.value.trim(); if (r && v && v !== r.name) { const inStep = pending != null; if (!inStep) begin(); r.name = v; if (!inStep) commit(); } txBusy = false; ui(); draw(); return; }
    const q = drw(TXI.id); TXI.id = null; TXI.focus = false; txEl.classList.remove('on'); try { txIn.blur(); } catch (e) { }
    if (q) { const inStep = pending != null, B = () => { if (!inStep) begin(); }, E = () => { if (!inStep) commit(); };   // внутри начатого жеста — в тот же шаг ↶
      const v = txIn.value.trim(); if (v !== (q.tx || '')) { B(); q.tx = v; E(); } if (q.k === 'txt' && !q.tx) { B(); D.drw = D.drw.filter(x => x !== q); if (C.sel && C.sel.id === q.id) C.sel = null; E(); } }
    txBusy = false; ui(); draw();
  }
  txIn.addEventListener('input', () => { const q = drw(TXI.id); if (q) { TXI.live = txIn.value; draw(); } });
  txIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); TXI.skip = TXI.id; txClose(); } });
  act($('cTxOk'), () => { TXI.skip = TXI.id; txClose(); });
  /* цвет и толщина */
  function setCol(c) { C.col = c; try { localStorage.setItem('akx-core-col', c); } catch (e) { }
    const q = C.sel && C.sel.t === 'drw' && drw(C.sel.id); if (q && q.c !== c) { begin(); q.c = c; commit(); }
    document.querySelectorAll('[data-zc],[data-tc]').forEach(b => b.classList.toggle('on', (b.dataset.zc || b.dataset.tc) === c)); draw(); }
  document.querySelectorAll('[data-zc]').forEach(b => act(b, () => setCol(b.dataset.zc)));
  document.querySelectorAll('#tbCols [data-tc]').forEach(b => act(b, () => setCol(b.dataset.tc)));
  { const i = $('tbLw'), o = $('tbLwV'); if (i) { i.value = LW.v; o.textContent = String(LW.v).replace('.', ',');
    i.oninput = () => { LW.v = +i.value; o.textContent = String(LW.v).replace('.', ','); draw(); }; i.onchange = () => { LW.v = +i.value; try { localStorage.setItem('akx-core-lw', LW.v); } catch (e) { } }; } }
  setTimeout(() => setCol(C.col), 0);
  /* фото: видно / скрыто */
  act($('zpE'), () => { C.phHide = !C.phHide; if (C.phHide && C.sel && C.sel.t === 'photo') C.sel = null; $('zpE').classList.toggle('off', C.phHide); ui(); draw(); toast(C.phHide ? 'Фото скрыты' : 'Фото видны'); });

  /* ═══ [BLOCK C-B4] Б4/Б5 «Коммуникации» и «Проёмы и элементы» на развёртке стены (как v81 / 82.18).
     Объект лежит на развёртке: координаты — мм стены (x — от левого края, y — от пола вверх), следует за переносом развёртки, L — из плана, H — проекта.
     Точечные (розетка, выключатель, выводы, провод): касание — поставить; значок по виду; посты 1…5, шаг 71 мм (розетка, выключатель).
     Прямоугольные (не сверлить, зона, электрощит; окно, дверь, ниша, колонна, ригель, короб, техника, фартук): протяжка — рамка, касание — 300×300;
       выбранный — углы тянутся; отступы ← → ↓ ↑ (от краёв стены / пола / потолка) — касание числа: ввод, отступ от правого края / потолка держится при смене L / H (82.18);
       Z — глубина со знаком: выступ +, ниша − (82.14).
     Обозначения — утверждённые: значки точечных и прямоугольных — из футляра (82.18), провод — фиолетовая точка, не сверлить — красная зона, зона — фиолетовый пунктир,
       трасса — легенда 0.11 (цвет + рисунок + буквенный код), розетка/выключатель — от центра первого подрозетника, шаг 71 мм.
     Трасса: протяжка, 0/90°; тип — 10 условных обозначений 82.18 (цвет + рисунок + код), выбранной — меняется; концы тянутся.
     Автоматических размерных стрелок нет (уточнение 0.3); размеры — инструментом ↔, концы цепляются за посты и углы объектов. ═══ */
  const CK = {
    roz: {n: 'розетка', c: '#f0a020', pt: 1, ps: 1}, vyk: {n: 'выключатель', c: '#7b3fc4', pt: 1, ps: 1}, svet: {n: 'вывод света', c: '#d4a300', pt: 1}, slab: {n: 'ТВ / интернет', c: '#3d7be0', pt: 1},
    hvs: {n: 'ХВС', c: '#3d9bff', pt: 1}, gvs: {n: 'ГВС', c: '#ff5c5c', pt: 1}, kan: {n: 'канализация', c: '#8d6e63', pt: 1}, gaz: {n: 'газ', c: '#c98a00', pt: 1}, vent: {n: 'вентиляция', c: '#1fa98f', pt: 1},
    wire: {n: 'провод', c: '#7b3fc4', pt: 1},
    znd: {n: 'не сверлить', c: '#d93025', rc: 1}, zon: {n: 'зона', c: '#b44cc0', rc: 1}, shield: {n: 'электрощит', c: '#7b3fc4', rc: 1, D: 1}, wrt: {n: 'трасса', c: '#E07A00', ln: 1},
    win: {n: 'окно', c: '#2e9e4f', rc: 1}, door: {n: 'дверь', c: '#1f8a78', rc: 1}, nis: {n: 'ниша', c: '#5b5bd0', rc: 1, D: 1}, kol: {n: 'колонна', c: '#b8602e', rc: 1, D: 1},
    rig: {n: 'ригель', c: '#a07a10', rc: 1, D: 1}, kor: {n: 'короб', c: '#6b7785', rc: 1, D: 1}, znt: {n: 'техника', c: '#1f6fd1', rc: 1}, znf: {n: 'фартук', c: '#2bb673', rc: 1},
    poly: {n: 'фасон', c: '#6b7785', pg: 1, D: 1}};
  const RTT = [['el', 'Электрика', 'ЭЛ', '#E07A00', [20, 4]], ['lo', 'Слаботочка', 'СС', '#7B3FC4', [8, 4]], ['wa', 'ХВС', 'ХВ', '#3D9BFF', [14, 4]], ['wh', 'ГВС', 'ГВ', '#FF5C5C', [14, 3, 2, 3]],
    ['dr', 'Канализация', 'К', '#8D6E63', [3, 4]], ['ht', 'Отопление', 'ОТ', '#D455B0', [14, 3, 2, 3, 2, 3]], ['ufh', 'Тёплый пол', 'ТП', '#D93263', [8, 3, 8, 7]], ['ga', 'Газ', 'Г', '#C98A00', [18, 4, 3, 4]],
    ['ve', 'Вентиляция', 'ВЕН', '#1FA98F', [2, 3, 2, 7]], ['ot', 'Другое', 'ДР', '#7B8795', [6, 6]]];       // условные обозначения приложения (82.18), не ГОСТ
  const rtt = t => RTT.find(r => r[0] === t) || RTT[0];
  const com = id => D.com.find(c => c.id === id);
  const PSTEP = 71, PTS = k => (CK[k] && CK[k].ps ? 71 : 60);
  const ICO = new Map();
  function ico(k) { let im = ICO.get(k); if (im) return im.complete && im.naturalWidth ? im : null;
    const r = typeof REG !== 'undefined' && REG[k]; if (!r || !r.icon) return null; im = new Image(); im.onload = () => draw();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.icon.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace(/ aria-hidden="true"/, '')); ICO.set(k, im); return null; }
  function cRect(c) {                                            // прямоугольник объекта, мм стены: {x, y (низ), w, h}
    const e = elev(c.e); if (!e) return null; const R = elevRect(e);
    let x = c.x, y = c.y, h = c.h; if (c.ex === 'R') x = R.w - c.xv - c.w; if (c.ey === 'C') y = R.h - c.yv - c.h;
    if (c.k === 'kol') { y = 0; h = R.h; }                       // колонна — во всю высоту помещения (82.13)
    return {x, y, w: c.w, h, R};
  }
  const w2s = (R, x, y) => toS(R.x + x, R.y + R.h - y);                     // мм стены → px
  const s2w = (R, sx, sy) => { const q = toW(sx, sy); return {x: q.x - R.x, y: R.y + R.h - q.y}; };
  function postsW(c) { const R = elevRect(elev(c.e)), N = Math.max(1, Math.min(5, c.N || 1)), st = N > 1 ? PSTEP : 0; return [...Array(N)].map((_, i) => ({x: c.x + i * st, y: c.y, R})); }   // x, y — центр первого подрозетника, посты вправо с шагом 71 (82.14)
  function elevOf(sx, sy) { const q = toW(sx, sy); for (let i = D.elev.length - 1; i >= 0; i--) { const o = D.elev[i], r = elevRect(o); if (r.w && r.h && q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return o; } return null; }
  const OFL = new Map();                                         // подписи отступов выбранного: [{id, side, r}]
  function drawCom() {
    OFL.clear();
    for (const c of D.com) {
      if (!comLay(c)) continue;
      const e = elev(c.e); if (!e) continue; const R = elevRect(e), K = CK[c.k] || CK.roz, sel = (C.sel && C.sel.t === 'com' && C.sel.id === c.id) || inMsel('com', c.id), col = sel ? COL.sel : K.c;
      if (K.pt) { const z = clamp(PTS(c.k) * V.s, 18, 44), P = postsW(c).map(q => w2s(R, q.x, q.y)), im = ico(c.k);
        const sp = P.length > 1 ? hyp(P[1][0] - P[0][0], P[1][1] - P[0][1]) : 0, Q = sp >= z || P.length < 2 ? P : P.map((_, i) => { const m = w2s(R, c.x, c.y); return [m[0] + i * z * 0.84, m[1]]; });
        if (sel) { const xs = Q.map(q => q[0]), ys = Q.map(q => q[1]); cx.fillStyle = '#fff'; cx.strokeStyle = '#D4A300'; cx.lineWidth = 2; cx.fillRect(Math.min(...xs) - z / 2 - 3, Math.min(...ys) - z / 2 - 3, Math.max(...xs) - Math.min(...xs) + z + 6, z + 6); cx.strokeRect(Math.min(...xs) - z / 2 - 3, Math.min(...ys) - z / 2 - 3, Math.max(...xs) - Math.min(...xs) + z + 6, z + 6); }
        for (const [x, y] of Q) { if (im) cx.drawImage(im, x - z / 2, y - z / 2, z, z); else { cx.fillStyle = col; cx.beginPath(); cx.arc(x, y, z / 3, 0, 7); cx.fill(); } }
        continue; }
      if (K.ln) { const T = rtt(c.t), A = w2s(R, c.a[0], c.a[1]), B = w2s(R, c.b[0], c.b[1]); cx.strokeStyle = sel ? COL.sel : T[3]; cx.lineWidth = sel ? 4 : 3; cx.setLineDash(T[4]); cx.lineCap = 'butt';
        cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); cx.setLineDash([]);
        cx.font = '700 11px system-ui'; const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, tw = cx.measureText(T[2]).width + 6; cx.fillStyle = '#fff'; cx.fillRect(mx - tw / 2, my - 8, tw, 16); cx.fillStyle = T[3]; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(T[2], mx, my + 0.5);
        if (sel) for (const [x, y] of [A, B]) { cx.fillStyle = '#fff'; cx.strokeStyle = COL.sel; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); cx.stroke(); }
        continue; }
      if (K.pg) { const P = c.pts.map(t => w2s(R, t[0], t[1])); cx.beginPath(); P.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); cx.fillStyle = K.c + '33'; cx.fill(); cx.strokeStyle = col; cx.lineWidth = sel ? 2.6 : 2; cx.setLineDash([6, 4]); cx.stroke(); cx.setLineDash([]);
        if (sel) for (const [x, y] of P) { cx.fillStyle = '#fff'; cx.strokeStyle = COL.sel; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); cx.stroke(); }
        continue; }
      const r = cRect(c), A = w2s(R, r.x, r.y + r.h), B = w2s(R, r.x + r.w, r.y), x0 = A[0], y0 = A[1], W2 = B[0] - A[0], H2 = B[1] - A[1];
      cx.fillStyle = K.c + '33'; cx.fillRect(x0, y0, W2, H2); cx.strokeStyle = col; cx.lineWidth = sel ? 2.6 : 2; cx.setLineDash([6, 4]); cx.strokeRect(x0, y0, W2, H2); cx.setLineDash([]);
      const im = ico(c.k), z = 22; if (im && Math.min(W2, H2) >= z * 1.5) cx.drawImage(im, x0 + W2 / 2 - z / 2, y0 + H2 / 2 - z / 2, z, z);
      if (c.D) { cx.font = '600 11px system-ui'; cx.fillStyle = col; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText('Z ' + (c.D > 0 ? '+' : '−') + num(Math.abs(c.D)), x0 + 3, y0 + 3); }
      if (sel && C.sel && C.sel.id === c.id) { for (const [x, y] of [[x0, y0], [x0 + W2, y0], [x0 + W2, y0 + H2], [x0, y0 + H2]]) { cx.fillStyle = COL.sel; cx.fillRect(x - 5, y - 5, 10, 10); }
      }
    }
    const g = G; if (g && g.t === 'cdraw' && g.b) { const R = elevRect(elev(g.e)), K = CK[C.tool];
      if (K.ln) { const A = w2s(R, g.a.x, g.a.y), B = w2s(R, g.b.x, g.b.y); cx.strokeStyle = rtt(C.rt)[3]; cx.lineWidth = 3; cx.setLineDash(rtt(C.rt)[4]); cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); cx.setLineDash([]); }
      else { const A = w2s(R, Math.min(g.a.x, g.b.x), Math.max(g.a.y, g.b.y)), B = w2s(R, Math.max(g.a.x, g.b.x), Math.min(g.a.y, g.b.y)); cx.strokeStyle = K.c; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.strokeRect(A[0], A[1], B[0] - A[0], B[1] - A[1]); cx.setLineDash([]); } }
    if (C.cpg && C.cpg.pts.length) { const R = elevRect(elev(C.cpg.e)), P = C.cpg.pts.map(t => w2s(R, t[0], t[1])); cx.strokeStyle = CK.poly.c; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.beginPath(); P.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.stroke(); cx.setLineDash([]);
      for (const [x, y] of P) { cx.fillStyle = CK.poly.c; cx.beginPath(); cx.arc(x, y, 5, 0, 7); cx.fill(); } }
  }
  function comPx(c) {                                            // для касаний и рамки выделения: {pts px, box px}
    const e = elev(c.e); if (!e) return null; const R = elevRect(e), K = CK[c.k] || CK.roz;
    if (K.pt) { const z = clamp(PTS(c.k) * V.s, 18, 44), P = postsW(c).map(q => w2s(R, q.x, q.y)); const xs = P.map(q => q[0]); return {box: [Math.min(...xs) - z / 2, P[0][1] - z / 2, Math.max(...xs) + z / 2, P[0][1] + z / 2]}; }
    if (K.ln) return {line: [w2s(R, c.a[0], c.a[1]), w2s(R, c.b[0], c.b[1])]};
    if (K.pg) return {poly: c.pts.map(t => w2s(R, t[0], t[1]))};
    const r = cRect(c), A = w2s(R, r.x, r.y + r.h), B = w2s(R, r.x + r.w, r.y); return {box: [A[0], A[1], B[0], B[1]]};
  }
  function B4hit(sx, sy) {
    { const he = edHit(sx, sy); if (he) return he; }
    { const ho = opHit(sx, sy); if (ho) return ho; }
    { const hr = B6hit(sx, sy); if (hr) return hr; }
    for (const [side, o] of OFL) { const r = o.r; if (sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4) return {t: 'cofl', id: o.id, side}; }
    for (let i = D.com.length - 1; i >= 0; i--) { const c = D.com[i], g = comLay(c) && comPx(c); if (!g) continue;
      if (g.box && sx >= g.box[0] - 4 && sx <= g.box[2] + 4 && sy >= g.box[1] - 4 && sy <= g.box[3] + 4) return {t: 'com', id: c.id};
      if (g.line && segDist([sx, sy], g.line[0], g.line[1]) < 12) return {t: 'com', id: c.id};
      if (g.poly && inPoly({x: sx, y: sy}, g.poly.map(([x, y]) => ({x, y})))) return {t: 'com', id: c.id}; }
    return null;
  }
  function B4handle(id, sx, sy) {
    const c = com(id), g = c && comPx(c); if (!g) return null; const K = CK[c.k];
    const pts = K.ln ? g.line : K.pg ? g.poly : K.rc ? [[g.box[0], g.box[1]], [g.box[2], g.box[1]], [g.box[2], g.box[3]], [g.box[0], g.box[3]]] : [];
    const i = pts.findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); return i >= 0 ? {t: 'com-h', id, i} : null;
  }
  function comBoxW(c) { const g = comPx(c); if (!g) return null; if (g.line) return {seg: g.line.map(([x, y]) => toW(x, y))}; if (g.poly) return {poly: g.poly.map(([x, y]) => toW(x, y))}; const a = toW(g.box[0], g.box[1]), b = toW(g.box[2], g.box[3]); return {x0: a.x, y0: a.y, x1: b.x, y1: b.y}; }
  function comNew(k, e, o) { begin(); const c = {id: uid('c'), k, e: e.id, ...o}; D.com.push(c); C.sel = {t: 'com', id: c.id}; commit(); return c; }
  const snapE = (R, p) => { const t = 10 / V.s; return {x: Math.abs(p.x) < t ? 0 : Math.abs(p.x - R.w) < t ? R.w : p.x, y: Math.abs(p.y) < t ? 0 : Math.abs(p.y - R.h) < t ? R.h : p.y}; };   // магнит к краям стены, пол, потолок
  function B4start(g, p, h) {
    if (h && h.t === 'com-h') { g.t = 'cres'; return true; }
    if (h && h.t === 'cofl') { g.t = 'pan'; return true; }
    if ((C.tool === 'ct' || C.tool === 'op') && !isLbl(h)) { g.t = 'pan'; return true; }
    const K = CK[C.tool]; if (!K || isLbl(h)) return false;
    const e = elevOf(p.x, p.y); if (!e) { g.t = 'pan'; return true; }
    if (K.pt || K.pg) { g.t = 'pan'; return true; }              // касанием
    const R = elevRect(e); g.t = 'cdraw'; g.e = e.id; g.a = snapE(R, s2w(R, p.x, p.y)); g.b = null; return true;
  }
  function B4drag(g) {
    if (g.t === 'cmove') { begin(); const c = com(g.h.id); g.o = clone(c); const r = cRect(c); if (r && (c.ex || c.ey)) { g.o.x = r.x; g.o.y = r.y; delete c.ex; delete c.ey; } C.sel = {t: 'com', id: c.id}; ui(); }
    if (g.t === 'cres') { begin(); const c = com(g.h.id); const r = cRect(c); if (r && CK[c.k].rc) { c.x = r.x; c.y = r.y; delete c.ex; delete c.ey; } g.o = clone(c); C.sel = {t: 'com', id: c.id}; ui(); }
  }
  function B4move(g, p, q) {
    if (g.t === 'cdraw') { const R = elevRect(elev(g.e)); let b = snapE(R, s2w(R, p.x, p.y)); if (CK[C.tool].ln) { const dx = b.x - g.a.x, dy = b.y - g.a.y, m = ((Math.atan2(dy, dx) * 180 / Math.PI) % 90 + 90) % 90; if (m < 6 || m > 84) b = Math.abs(dx) >= Math.abs(dy) ? {x: b.x, y: g.a.y} : {x: g.a.x, y: b.y}; } g.b = b; draw(); return true; }
    if (g.t === 'cmove') { const c = com(g.h.id), e = elev(c.e), R = elevRect(e), w0 = s2w(R, g.p0.x, g.p0.y), w1 = s2w(R, p.x, p.y), dx = rnd(w1.x - w0.x), dy = rnd(w1.y - w0.y), o = g.o, K = CK[c.k];
      if (K.ln) { c.a = [o.a[0] + dx, o.a[1] + dy]; c.b = [o.b[0] + dx, o.b[1] + dy]; } else if (K.pg) c.pts = o.pts.map(t => [t[0] + dx, t[1] + dy]); else { c.x = o.x + dx; c.y = o.y + dy; if (K.rc) { const s = snapE(R, {x: c.x, y: c.y}), s2 = snapE(R, {x: c.x + c.w, y: c.y + c.h}); if (s.x !== c.x) c.x = s.x; else if (s2.x !== c.x + c.w) c.x = s2.x - c.w; if (s.y !== c.y) c.y = s.y; else if (s2.y !== c.y + c.h) c.y = s2.y - c.h; } }
      draw(); return true; }
    if (g.t === 'cres') { const c = com(g.h.id), R = elevRect(elev(c.e)), w = snapE(R, s2w(R, p.x, p.y)), K = CK[c.k], o = g.o, X = rnd(w.x), Y = rnd(w.y);
      if (K.ln) c[g.h.i ? 'b' : 'a'] = [X, Y]; else if (K.pg) c.pts[g.h.i] = [X, Y];
      else { const i = g.h.i, xl = i === 0 || i === 3 ? X : o.x, xr = i === 1 || i === 2 ? X : o.x + o.w, yt = i === 0 || i === 1 ? Y : o.y + o.h, yb = i === 2 || i === 3 ? Y : o.y;
        c.x = Math.min(xl, xr); c.w = Math.max(10, Math.abs(xr - xl)); c.y = Math.min(yb, yt); c.h = Math.max(10, Math.abs(yt - yb)); }
      draw(); return true; }
    return false;
  }
  function B4end(g) {
    if (g.t !== 'cdraw') return false; const K = CK[C.tool]; if (!g.b) return true; const e = elev(g.e); if (!e) return true;
    const d = hyp(g.b.x - g.a.x, g.b.y - g.a.y) * V.s; if (d < 12) return true;
    if (K.ln) comNew(C.tool, e, {a: [rnd(g.a.x), rnd(g.a.y)], b: [rnd(g.b.x), rnd(g.b.y)], t: C.rt});
    else comNew(C.tool, e, {x: rnd(Math.min(g.a.x, g.b.x)), y: rnd(Math.min(g.a.y, g.b.y)), w: rnd(Math.abs(g.b.x - g.a.x)), h: rnd(Math.abs(g.b.y - g.a.y))});
    ui(); draw(); return true;
  }
  function B4tap(g, h) {
    if (h && h.t === 'cofl') { C.sel = {t: 'com', id: h.id}; openKb('cOf', h.id); KB.tg.side = h.side; const c = com(h.id), r = cRect(c), o = {L: r.x, R: r.R.w - r.x - r.w, F: r.y, C: r.R.h - r.y - r.h}; KB.buf = String(rnd(o[h.side])); ui(); draw(); return true; }
    if (!isLbl(h) && B5tap(g, h)) return true;
    const K = CK[C.tool]; if (!K || isLbl(h)) return false;
    if (h && h.t === 'com' && !C.cpg) { C.sel = {t: 'com', id: h.id}; ui(); draw(); return true; }
    const e = elevOf(g.p0.x, g.p0.y); if (!e) { toast('«' + K.n + '» — на развёртке стены'); return true; }
    const R = elevRect(e), w = s2w(R, g.p0.x, g.p0.y);
    if (K.pt) { comNew(C.tool, e, {x: rnd(w.x), y: rnd(w.y), N: 1}); ui(); draw(); return true; }
    if (K.rc) { const s = 300; comNew(C.tool, e, {x: rnd(w.x - s / 2), y: rnd(w.y - s / 2), w: s, h: s}); ui(); draw(); return true; }
    if (K.pg) { if (C.cpg && C.cpg.e !== e.id) C.cpg = null; if (!C.cpg) { C.cpg = {e: e.id, pts: []}; C.sel = null; }
      const P = C.cpg.pts; if (P.length >= 3) { const [fx, fy] = w2s(R, P[0][0], P[0][1]); if (hyp(fx - g.p0.x, fy - g.p0.y) < 16) { polyDone(); return true; } }
      const sw = snapE(R, w); P.push([rnd(sw.x), rnd(sw.y)]); ui(); draw(); return true; }
    if (K.ln) { C.sel = null; ui(); draw(); return true; }
    return false;
  }
  function polyDone() { const P = C.cpg; C.cpg = null; if (P && P.pts.length >= 3 && elev(P.e)) comNew('poly', elev(P.e), {pts: P.pts}); ui(); draw(); }
  function B4act(s, B) {
    if (C.cpg && C.cpg.pts.length >= 3) B.push(['✓', polyDone, 'Фасон: готово']);
    const c = s && s.t === 'com' && com(s.id); if (!c) return; const K = CK[c.k];
    if (K.ps) for (let n = 1; n <= 5; n++) B.push([`<span class="opt${(c.N || 1) === n ? ' on' : ''}">${n}</span>`, () => { if ((c.N || 1) === n) return; begin(); c.N = n; commit(); ui(); }, n + ' — шаг 71 мм']);
    if (K.ln) { const T = rtt(c.t); B.push([`<span class="opt on" style="color:${T[3]}">${T[2]}</span>`, () => { begin(); const i = RTT.findIndex(r => r[0] === c.t); c.t = RTT[(i + 1) % RTT.length][0]; C.rt = c.t; commit(); ui(); toast('Трасса: ' + rtt(c.t)[1]); }, 'Тип трассы: ' + T[1]]); }
    if (K.rc && c.k === 'kol') B.push(['<span class="opt on" style="font-size:11px">W</span>', () => { openKb('cW', c.id); ui(); draw(); }, 'Ширина колонны, мм (высота — во всю стену)']);
    else if (K.rc) B.push(['<span class="opt on" style="font-size:11px">W×H</span>', () => { openKb('cW', c.id); KB.after = () => setTimeout(() => { if (com(c.id)) { openKb('cH', c.id); ui(); draw(); } }, 0); ui(); draw(); }, 'Габарит: ширина × высота, мм']);
    if (K.rc || K.pt) B.push(['⧉', () => { begin(); const o = clone(c); o.id = uid('c'); if (o.ex) o.xv = Math.max(0, o.xv - 300); else o.x += 300; D.com.push(o); C.sel = {t: 'com', id: o.id}; commit(); }, 'Копия рядом']);
    if (K.D) B.push([`<span class="opt${c.D ? ' on' : ''}">Z</span>`, () => { openKb('cD', c.id); ui(); draw(); }, 'Z — глубина, мм: выступ +, ниша −']);
  }
  function B4kbObj(t, id) { return t === 'cD' || t === 'cOf' || t === 'cW' || t === 'cH' ? com(id) : t === 'eSeg' ? elev(id) : null; }
  function B4kbBuf(t, o) { return t === 'cD' ? (o.D ? String(o.D) : '') : t === 'cOf' || t === 'eSeg' ? '' : t === 'cW' ? String(rnd(o.w)) : t === 'cH' ? String(rnd(o.h)) : null; }
  function B4kbApply(tg, v, raw) {
    if (tg.t === 'cD') { const c = com(tg.id); if (c) { begin(); if (v && isFinite(v)) c.D = rnd(v); else delete c.D; commit(); } return true; }   // Z: выступ +, ниша − (82.14)
    if (tg.t === 'eSeg') { segApply(tg, v); return true; }
    if (tg.t === 'cW' || tg.t === 'cH') { const c = com(tg.id); if (c && v > 0) { begin(); const r = cRect(c); if (tg.t === 'cW') { c.x = r.x; delete c.ex; c.w = rnd(v); } else { c.y = r.y; delete c.ey; c.h = rnd(v); } commit(); } return true; }
    if (tg.t === 'cOf') { const c = com(tg.id); if (!c || !(v >= 0)) return true; begin();
      if (tg.side === 'L') { c.x = rnd(v); delete c.ex; } if (tg.side === 'R') { c.ex = 'R'; c.xv = rnd(v); }
      if (tg.side === 'F') { c.y = rnd(v); delete c.ey; } if (tg.side === 'C') { c.ey = 'C'; c.yv = rnd(v); }
      commit(); return true; }
    return false;
  }
  /* концы размеров: посты точечных и углы прямоугольных — размер на развёртке считается по геометрии (отступы, Z) */
  function comEnd(e) { const c = com(e.id); if (!c) return null; const R = elevRect(elev(c.e)), K = CK[c.k];
    if (K.pt) { const P = postsW(c)[Math.min(e.i, (c.N || 1) - 1)]; return {x: R.x + P.x, y: R.y + R.h - P.y}; }
    if (K.rc) { const r = cRect(c), cs = [[r.x, r.y + r.h], [r.x + r.w, r.y + r.h], [r.x + r.w, r.y], [r.x, r.y]][e.i % 4]; return {x: R.x + cs[0], y: R.y + R.h - cs[1]}; }
    return null; }
  function comSnapPts() { const out = []; for (const c of D.com) { const e = elev(c.e); if (!e) continue; const K = CK[c.k];
    if (K.pt) postsW(c).forEach((_, i) => out.push({t: 'com', id: c.id, i})); else if (K.rc) for (let i = 0; i < 4; i++) out.push({t: 'com', id: c.id, i}); } return out; }

  /* ═══ [BLOCK C-B5] Б5 план: «контур: касания по углам» (⌗) и «проём» (⊓) — как v81 (ct, op).
     Контур: касание — угол, между углами — стена плана (0/90°, узлы, выравнивание — привязки ядра); касание первого угла — замкнуть, касание последнего — закончить.
     Проём: два касания по стене — участок стены (доли длины, следует за правкой L); подпись — ширина, мм. ═══ */
  const opn = id => D.ops.find(o => o.id === id);
  function drawOps() {
    for (const o of D.ops) { const w = wall(o.wall), a = w && node(w.a), b = w && node(w.b); if (!a || !b) continue;
      const P = t => toS(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t), A = P(o.s0), B = P(o.s1), on = C.sel && C.sel.t === 'op' && C.sel.id === o.id;
      cx.strokeStyle = '#f6f5f1'; cx.lineWidth = 7; cx.lineCap = 'butt'; cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke();
      const L = hyp(B[0] - A[0], B[1] - A[1]) || 1, nx = -(B[1] - A[1]) / L * 7, ny = (B[0] - A[0]) / L * 7; cx.strokeStyle = on ? COL.sel : COL.wall; cx.lineWidth = 2;
      cx.beginPath(); for (const Q of [A, B]) { cx.moveTo(Q[0] - nx, Q[1] - ny); cx.lineTo(Q[0] + nx, Q[1] + ny); } cx.stroke();
      cx.font = '600 11px system-ui'; cx.fillStyle = on ? COL.sel : COL.wall; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('⊓ ' + num(Math.abs(o.s1 - o.s0) * wLen(w)), (A[0] + B[0]) / 2 - nx * 2.4, (A[1] + B[1]) / 2 - ny * 2.4); }
    if (C.ctp) { const [x, y] = toS(C.ctp.x, C.ctp.y); cx.strokeStyle = '#e08a00'; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, y, 10, 0, 7); cx.stroke(); }
    if (C.opp) { const w = wall(C.opp.wall), a = w && node(w.a), b = w && node(w.b); if (a && b) { const [x, y] = toS(a.x + (b.x - a.x) * C.opp.s, a.y + (b.y - a.y) * C.opp.s); cx.fillStyle = '#e08a00'; cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); } }
  }
  function opHit(sx, sy) { for (const o of D.ops) { const w = wall(o.wall), a = w && node(w.a), b = w && node(w.b); if (!a || !b) continue;
    const P = t => toS(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); if (segDist([sx, sy], P(o.s0), P(o.s1)) < 10) return {t: 'op', id: o.id}; } return null; }
  function wallAt(sx, sy) { let best = null, bd = HR.wall; for (const w of D.walls) { const a = node(w.a), b = node(w.b); if (!a || !b) continue; const A = toS(a.x, a.y), B = toS(b.x, b.y), dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy; if (!L2) continue;
    const t = clamp(((sx - A[0]) * dx + (sy - A[1]) * dy) / L2, 0, 1), dd = hyp(A[0] + dx * t - sx, A[1] + dy * t - sy); if (dd < bd) { bd = dd; best = {w, s: t}; } } return best; }
  function B5tap(g, h) {
    if (C.tool === 'ct') {
      const last = C.ctp, b = snapEnd(last, g.p0.x, g.p0.y, null);
      if (!last) { C.ctp = {x: b.x, y: b.y, node: b.node || null, n0: b.node || null}; draw(); return true; }
      if (hyp(b.x - last.x, b.y - last.y) * V.s < 12) { C.ctp = null; draw(); toast('Контур: готово'); return true; }
      const w = addWall(last, b); if (!w) { draw(); return true; }
      const end = w.b, start0 = C.ctp.n0 || D.walls.find(x => x.id === w.id).a;
      if (b.node && b.node === start0) { C.ctp = null; C.sel = {t: 'wall', id: w.id}; ui(); draw(); toast('Контур замкнут'); return true; }
      const n = node(end); C.ctp = {x: n.x, y: n.y, node: end, n0: start0}; C.sel = {t: 'wall', id: w.id}; ui(); draw(); return true; }
    if (C.tool === 'op') {
      const hw = wallAt(g.p0.x, g.p0.y); if (!hw) { toast('Проём — двумя касаниями по стене'); return true; }
      const s0 = rnd(hw.s * 1e4) / 1e4;
      if (!C.opp || C.opp.wall !== hw.w.id) { C.opp = {wall: hw.w.id, s: s0}; draw(); return true; }
      const a = Math.min(C.opp.s, s0), b = Math.max(C.opp.s, s0); C.opp = null; if ((b - a) * wLen(hw.w) < 10) { draw(); return true; }
      begin(); const o = {id: uid('o'), wall: hw.w.id, s0: a, s1: b}; D.ops.push(o); C.sel = {t: 'op', id: o.id}; commit(); toast('Проём ' + num((b - a) * wLen(hw.w))); return true; }
    return false;
  }

  /* ═══ [BLOCK C-HIT] что под пальцем (px) — порядок: маркеры → подписи → узлы → стены → развёртки → фото ═══ */
  const HR = {handle: 22, node: 20, wall: 14};
  function photoCorners(p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function hit(sx, sy) {
    const s = C.sel;
    if (C.crop) { const p = photo(C.crop.id); const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'crop-h', id: p.id, c};
      const [x0, y0] = photoCorners(p)[0], [x1, y1] = photoCorners(p)[2]; if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) return {t: 'crop-in', id: p.id}; return null; }
    if (s && s.t === 'photo') { const p = photo(s.id); if (p) { const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'ph-h', id: p.id, c}; } }
    if (s && s.t === 'drw' && typeof B3handle === 'function') { const hh = B3handle(s.id, sx, sy); if (hh) return hh; }
    if (s && s.t === 'com') { const hh = B4handle(s.id, sx, sy); if (hh) return hh; }
    if (s && s.t === 'frame') { const Q = frame(s.id) && frPts(frame(s.id)); if (Q) { const c = Q.findIndex(q => { const [x, y] = toS(q.x, q.y); return hyp(x - sx, y - sy) < HR.handle; }); if (c >= 0) return {t: 'fr-h', id: s.id, c}; } }
    if (s && s.t === 'dim') { const d = dim(s.id); if (d) for (const [k, e] of [['a', d.a], ['b', d.b]]) { const P = endPos(e), [x, y] = toS(P.x, P.y); if (hyp(x - sx, y - sy) < HR.handle) return {t: 'dim-h', id: d.id, end: k}; } }
    for (const [id, r] of DLBL) if (hyp(r.x - sx, r.y - sy) < r.r) return {t: 'dlabel', id};
    for (const d of D.dims) { const A = endPos(d.a), B = endPos(d.b); if (segDist([sx, sy], toS(A.x, A.y), toS(B.x, B.y)) < 12) return {t: 'dim', id: d.id}; }
    { const h4 = B4hit(sx, sy); if (h4) return h4; }
    if (typeof B3hit === 'function') { const h3 = B3hit(sx, sy); if (h3) return h3; }
    for (const [id, r] of ELBL) if (sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 6 && sy <= r.y + r.h + 6) return {t: 'elabel', id};
    for (const [id, r] of LBL) if (sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 6 && sy <= r.y + r.h + 6) return {t: 'label', id};
    let best = null, bd = HR.node;
    for (const n of D.nodes) { const [x, y] = toS(n.x, n.y), dd = hyp(x - sx, y - sy); if (dd < bd) { bd = dd; best = {t: 'node', id: n.id}; } }
    if (best) return best;
    bd = HR.wall;
    for (const w of D.walls) { const a = node(w.a), b = node(w.b); if (!a || !b) continue; const dd = segDist([sx, sy], toS(a.x, a.y), toS(b.x, b.y)); if (dd < bd) { bd = dd; best = {t: 'wall', id: w.id}; } }
    if (best) return best;
    const q = toW(sx, sy);
    for (let i = D.elev.length - 1; i >= 0; i--) { const r = elevRect(D.elev[i]); if (q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return {t: 'elev', id: D.elev[i].id}; }
    for (let i = D.frames.length - 1; i >= 0; i--) { const Q = frPts(D.frames[i]); if (Q && inPoly(q, Q)) return {t: 'frame', id: D.frames[i].id}; }
    if (!C.phHide) for (let i = D.photos.length - 1; i >= 0; i--) { const p = D.photos[i]; if (q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + phH(p)) return {t: 'photo', id: p.id}; }
    return null;
  }
  function inPoly(q, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i].y > q.y) !== (P[j].y > q.y) && q.x < (P[j].x - P[i].x) * (q.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c; return c; }

  /* ═══ [BLOCK C-SNAP] привязки построения стены: узел → 0/90° → выравнивание по узлам ═══ */
  function snapEnd(a, sx, sy, skip) {
    for (const n of D.nodes) { if (n.id === skip) continue; const [x, y] = toS(n.x, n.y); if (hyp(x - sx, y - sy) < HR.node + 4) return {x: n.x, y: n.y, node: n.id}; }
    let q = toW(sx, sy); if (!a) return {x: rnd(q.x), y: rnd(q.y)};
    const dx = q.x - a.x, dy = q.y - a.y, ang = Math.atan2(dy, dx) * 180 / Math.PI, m = ((ang % 90) + 90) % 90; let ax = null;
    if (m < 6 || m > 84) {
      const hz = Math.abs(dx) >= Math.abs(dy); q = hz ? {x: q.x, y: a.y} : {x: a.x, y: q.y};
      const [qx, qy] = toS(q.x, q.y);
      for (const n of D.nodes) { if (n.id === skip) continue; const [x, y] = toS(n.x, n.y);
        if (hz && Math.abs(x - qx) < 10) { q.x = n.x; ax = n; break; } if (!hz && Math.abs(y - qy) < 10) { q.y = n.y; ax = n; break; } }
    }
    return {x: rnd(q.x), y: rnd(q.y), ax};
  }

  /* ═══ [BLOCK C-OPS] операции над документом (каждая — один шаг ↶) ═══ */
  function addWall(a, b) {
    if (hyp(b.x - a.x, b.y - a.y) < 1) return null;
    begin();
    const na = a.node || (D.nodes.push({id: uid('n'), x: a.x, y: a.y}), D.nodes[D.nodes.length - 1].id);
    const nb = b.node || (D.nodes.push({id: uid('n'), x: b.x, y: b.y}), D.nodes[D.nodes.length - 1].id);
    if (na === nb || D.walls.some(w => (w.a === na && w.b === nb) || (w.a === nb && w.b === na))) { cancel(); return null; }
    const w = {id: uid('w'), a: na, b: nb, gn: ++D.gnHi}; D.walls.push(w); commit(); return w;
  }
  function setLen(w, v) {
    const a = node(w.a), b = node(w.b), L = wLen(w); if (!(v > 0) || !L) return;
    w.fx = 1;                                                    // введённый размер: стена не тянется (замечание 8, 82.26)
    const [fix, mov] = deg(b.id) <= 1 || deg(a.id) > 1 ? [a, b] : [b, a];
    const ux = (mov.x - fix.x) / L, uy = (mov.y - fix.y) / L, dx = ux * (v - L), dy = uy * (v - L);
    begin(); const moved = new Set([mov.id]);
    // соседняя стена под 90° (±3°) к этой — переносится целиком: прямые углы контура сохраняются, меняется параллельная стена
    for (const o of D.walls) { if (o.id === w.id || (o.a !== mov.id && o.b !== mov.id)) continue;
      const far = node(o.a === mov.id ? o.b : o.a), lo = hyp(far.x - mov.x, far.y - mov.y); if (!lo || far.id === fix.id) continue;
      if (Math.abs((far.x - mov.x) / lo * ux + (far.y - mov.y) / lo * uy) < Math.sin(3 * Math.PI / 180)) moved.add(far.id); }
    for (const id of moved) { const q = node(id); q.x = rnd(q.x + dx); q.y = rnd(q.y + dy); }
    commit();
  }
  function mergeNode(from, into) {                 // узел брошен на узел — один узел (замыкание контура)
    for (const w of D.walls) { if (w.a === from) w.a = into; if (w.b === from) w.b = into; }
    const seen = new Set(); D.walls = D.walls.filter(w => { const k = [w.a, w.b].sort().join('|'); if (w.a === w.b || seen.has(k)) return false; seen.add(k); return true; });
    D.nodes = D.nodes.filter(n => n.id !== from); dropOrphans();
  }
  function dimCache() { if (typeof B3cache === 'function') B3cache(); dimCache0(); }
  function dimCache0() { for (const d of D.dims) for (const e of [d.a, d.b]) { const P = endPos(e); e.x = rnd(P.x * 10) / 10; e.y = rnd(P.y * 10) / 10; } }
  function del() {
    if (C.msel.length) { delGroup(); return; }
    const s = C.sel; if (!s) { toast('Ничего не выбрано'); return; }
    begin(); dimCache();
    if (s.t === 'frame') D.frames = D.frames.filter(f => f.id !== s.id);
    if (typeof B3del === 'function') B3del(s);
    if (s.t === 'photo') D.photos = D.photos.filter(p => p.id !== s.id);
    if (s.t === 'elev') D.elev = D.elev.filter(e => e.id !== s.id);
    if (s.t === 'dim') D.dims = D.dims.filter(d => d.id !== s.id);
    if (s.t === 'wall') D.walls = D.walls.filter(w => w.id !== s.id);
    if (s.t === 'node') D.walls = D.walls.filter(w => w.a !== s.id && w.b !== s.id);
    dropOrphans(); C.sel = null; C.crop = null; commit(); toast('Удалено · ↶ — вернуть');
  }
  function addElev(w) {
    if (!Hmm()) { KB.after = () => { if (Hmm()) addElev(w); }; openKb('H', null); toast('Высота H'); return; }
    const ex = D.elev.find(e => e.wall === w.id);
    if (ex) { const r = elevRect(ex); V.ox = cssW() / 2 - (r.x + r.w / 2) * V.s; V.oy = cssH() / 2 - (r.y + r.h / 2) * V.s; C.sel = {t: 'elev', id: ex.id}; viewChanged(); ui(); return; }
    // свободное место под планом: ниже плана и уже стоящих развёрток плана (холст не перестраивается — новое ложится в пустое)
    const L = wLen(w), xs = D.nodes.map(n => n.x), ys = [...D.nodes.map(n => n.y), ...D.elev.map(o => { const r = elevRect(o); return r.y + r.h; })];
    const x0 = xs.length ? Math.min(...xs) : toW(cssW() / 2, 0).x - L / 2, y0 = (ys.length ? Math.max(...ys) : toW(0, cssH() * 0.3).y) + 900;
    begin(); const e = {id: uid('e'), wall: w.id, x: rnd(x0), y: rnd(y0)}; D.elev.push(e); C.sel = {t: 'elev', id: e.id}; commit();
    const r = elevRect(e); V.ox = cssW() / 2 - (r.x + r.w / 2) * V.s; V.oy = cssH() / 2 - (r.y + r.h / 2) * V.s; viewChanged();
  }

  /* ═══ [BLOCK C-PHOTO] фото группой: уменьшение до 2400 px, складываются столбиком под последним ═══ */
  async function addPhotos(files) {
    files = [...files]; if (!files.length) return; toast('Фото: ' + files.length + '…');
    const out = [];
    for (const f of files) {
      try {
        const bm = await createImageBitmap(f, {imageOrientation: 'from-image'}); const k = Math.min(1, 2400 / Math.max(bm.width, bm.height));
        const w = rnd(bm.width * k), h = rnd(bm.height * k), c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(bm, 0, 0, w, h); if (bm.close) bm.close();
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88)); const key = uid('i'); if (DB.db) await put('img', blob, key); IMG.set(key, await createImageBitmap(blob)); out.push({key, w, h});
      } catch (e) { console.warn('photo', e); }
    }
    if (!out.length) { toast('Фото не прочитаны'); return; }
    const last = D.photos[D.photos.length - 1], GAP = last ? last.w * 0.06 : 20 / V.s, PW = last ? last.w : cssW() * 0.6 / V.s;
    let x, y; if (last) { x = last.x; y = last.y + phH(last) + GAP; } else { const q = toW(cssW() * 0.2, 24); x = rnd(q.x); y = rnd(q.y); }
    begin();
    for (const o of out) { const p = {id: uid('f'), img: o.key, x: rnd(x), y: rnd(y), w: rnd(PW), iw: o.w, ih: o.h, cr: [0, 0, 1, 1]}; D.photos.push(p); y += phH(p) + GAP; }
    commit(); await save();
    const f0 = D.photos[D.photos.length - out.length], [, sy] = toS(f0.x, f0.y);
    toast(`Добавлено фото: ${out.length}` + (sy > cssH() || sy < 0 ? ' · ниже, ⤢ — показать всё' : ''));
  }

  /* ═══ [BLOCK C-INPUT] касания: 1 палец/перо — инструмент, 2 пальца — масштаб и сдвиг (всегда) ═══ */
  const P = new Map(); let G = null; const TAP = 8;
  const pos = e => { const r = cv.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; };
  let LASTPT = 'touch';
  cv.addEventListener('pointerdown', e => {
    LASTPT = e.pointerType; if (e.pointerType === 'pen') { PEN.seen = true; PEN.down++; }
    if (e.pointerType === 'touch' && PEN.down) return;           // ладонь при пере — не в счёт
    e.preventDefault(); closeEd(true); if (TXI.focus) { try { txIn.blur(); } catch (_) { } TXI.focus = false; }
    $('zMenu').classList.remove('on'); if (C.phm) { C.phm = false; ui(); } try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    P.set(e.pointerId, pos(e));
    if (P.size === 2) startPinch(); else if (P.size === 1) startOne(pos(e));
  });
  cv.addEventListener('pointermove', e => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, pos(e));
    if (G && G.pinch) pinchMove(); else if (G && !G.dead) oneMove(pos(e));
  });
  const up = e => {
    if (e.pointerType === 'pen' && PEN.down) PEN.down--;
    if (!P.has(e.pointerId)) return; P.delete(e.pointerId);
    if (G && G.pinch) { G = P.size ? {dead: true} : null; viewChanged(); return; }
    if (G && G.dead) { if (!P.size) G = null; return; }
    if (G) oneEnd(pos(e), e.type === 'pointercancel');
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e), k = Math.exp(-e.deltaY * 0.0015), s = clamp(V.s * k, 0.005, 5), q = toW(p.x, p.y); V.s = s; V.ox = p.x - q.x * s; V.oy = p.y - q.y * s; viewChanged(); }, {passive: false});

  function startPinch() {
    if (G && !G.pinch && !G.dead) { cancel(); }                 // начатое действие одним пальцем — отменяется без следа
    const [a, b] = [...P.values()]; G = {pinch: true, d0: hyp(b.x - a.x, b.y - a.y) || 1, m0: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, V0: {...V}}; draw();
  }
  function pinchMove() {
    const [a, b] = [...P.values()], d = hyp(b.x - a.x, b.y - a.y) || 1, m = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, V0 = G.V0;
    const s = clamp(V0.s * d / G.d0, 0.005, 5), wx = (G.m0.x - V0.ox) / V0.s, wy = (G.m0.y - V0.oy) / V0.s;
    V.s = s; V.ox = m.x - wx * s; V.oy = m.y - wy * s; draw();
  }
  function startOne(p) {
    const h = hit(p.x, p.y); G = {t: 'tap', p0: p, h, moved: false, V0: {...V}};
    if (C.crop) { if (h && h.t === 'crop-h') G.t = 'crop'; else if (h && h.t === 'crop-in') G.t = 'cropmove'; else G.t = 'pan'; return; }
    if (h && h.t === 'edim') { G.t = 'pan'; return; }
    if (fingerPan(p)) { G.t = 'pan'; G.finger = true; return; }
    if (h && h.t === 'dim-h') { G.t = 'dimend'; return; }
    if (h && h.t === 'fr-h') { G.t = 'fcorner'; return; }
    if (C.msel.length && (C.tool === 'sel' || C.tool === 'rsel')) { const m = normHit(h); if (m && inMsel(m.t, m.id)) { G.t = 'gmove'; return; } }
    if (C.tool === 'rsel') { G.t = 'rs'; return; }
    if (C.tool === 'pts') { if (h && h.t === 'frame' && C.sel && C.sel.id === h.id) { G.t = 'move'; return; } const ph = photoAt(p); if (ph) { G.t = 'ptsd'; G.ph = ph.id; G.a = toW(p.x, p.y); } else G.t = 'pan'; return; }
    if (B6start(G, p, h)) return;
    if (B4start(G, p, h)) return;
    if (typeof B3start === 'function' && B3start(G, p, h)) return;
    if ((C.tool === 'dim' || C.tool === 'arr') && !(h && (h.t === 'dlabel' || h.t === 'label' || h.t === 'elabel'))) { G.t = 'dimdraw'; G.a = snapDim(p.x, p.y, null, null); G.cur = null; return; }
    if (C.tool === 'wall' && !(h && (h.t === 'label' || h.t === 'elabel'))) {
      const a = snapEnd(null, p.x, p.y); G.t = 'draw'; G.a = a; G.b = null; return;
    }
    if (!h || h.t === 'label' || h.t === 'dlabel' || h.t === 'elabel') { G.t = 'pan'; return; }
    if (C.tool === 'sel' && h && !isSelH(h)) { G.t = 'pan'; return; }            // сначала выбрать: касание невыбранного и протяжка — сдвиг холста
    if (h && h.t === 'node' && D.walls.some(w => w.fx && (w.a === h.id || w.b === h.id))) { G.t = 'pan'; G.fxMsg = 1; return; }
    if (h && h.t === 'wall' && D.walls.some(o => o.fx && o.id !== h.id && [o.a, o.b].some(n => n === wall(h.id).a || n === wall(h.id).b))) { G.t = 'pan'; G.fxMsg = 1; return; }
    G.t = {dim: 'dmove', 'ph-h': 'scale', photo: 'move', elev: 'move', frame: 'move', node: 'nmove', wall: 'wmove'}[h.t] || (typeof B3moveKind === 'function' && B3moveKind(h)) || 'pan';
  }
  function oneMove(p) {
    const g = G, dx = p.x - g.p0.x, dy = p.y - g.p0.y;
    if (!g.moved) { if (hyp(dx, dy) < TAP) return; g.moved = true; startDrag(g); }
    const q = toW(p.x, p.y), q0 = toW(g.p0.x, g.p0.y), mx = q.x - q0.x, my = q.y - q0.y;
    switch (g.t) {
      case 'pan': V.ox = g.V0.ox + dx; V.oy = g.V0.oy + dy; draw(); break;
      case 'draw': g.b = snapEnd(g.a, p.x, p.y, g.a.node); draw(); break;
      case 'move': { const o = movObj(g.h); o.x = rnd(g.o.x + mx); o.y = rnd(g.o.y + my); draw(); break; }
      case 'wmove': { const a = node(g.w.a), b = node(g.w.b); a.x = rnd(g.o.a[0] + mx); a.y = rnd(g.o.a[1] + my); b.x = rnd(g.o.b[0] + mx); b.y = rnd(g.o.b[1] + my); draw(); break; }
      case 'nmove': { const n = node(g.h.id), s = snapEnd(null, p.x, p.y, n.id); g.snapN = s.node || null; n.x = s.x; n.y = s.y; draw(); break; }
      case 'scale': { const pp = photo(g.h.id), A = g.anchor, asp = g.o.w / g.o.h, w = Math.max(30, Math.max(Math.abs(q.x - A.x), Math.abs(q.y - A.y) * asp));
        pp.w = rnd(w); const h = phH(pp); pp.x = rnd(g.h.c === 1 || g.h.c === 2 ? A.x : A.x - w); pp.y = rnd(g.h.c >= 2 ? A.y : A.y - h); draw(); break; }
      case 'dimdraw': g.cur = snapDim(p.x, p.y, null, g.a); draw(); break;
      case 'dimend': { const d = dim(g.h.id), other = g.h.end === 'a' ? d.b : d.a; d[g.h.end] = g.cur = snapDim(p.x, p.y, d.id, other); draw(); break; }
      case 'dmove': { const d = dim(g.h.id); d.a = surfAt({x: g.o.a.x + mx, y: g.o.a.y + my}); d.b = surfAt({x: g.o.b.x + mx, y: g.o.b.y + my}); draw(); break; }
      case 'crop': cropDrag(g, q); break;
      case 'gmove': gMove(g, mx, my); break;
      case 'rs': g.r = [q0, q]; draw(); break;
      case 'fcorner': frameCornerDrag(g, q); break;
      case 'ptsd': g.b = q; draw(); break;
      default: if (!B6move(g, p, q) && !B4move(g, p, q) && typeof B3move === 'function') B3move(g, p, q, mx, my); break;
      case 'cropmove': cropMove(g, mx, my); break;
    }
  }
  function startDrag(g) {
    const h = g.h;
    if (g.t === 'gmove') gStart(g);
    if (g.t === 'fcorner') { begin(); C.sel = {t: 'frame', id: h.id}; ui(); }
    if (typeof B3drag === 'function') B3drag(g);
    B4drag(g);
    if (g.t === 'move') { begin(); const o = movObj(h); g.o = {x: o.x, y: o.y}; C.sel = {t: h.t, id: h.id}; ui(); }
    if (g.t === 'wmove') { begin(); g.w = wall(h.id); g.o = {a: [node(g.w.a).x, node(g.w.a).y], b: [node(g.w.b).x, node(g.w.b).y]}; C.sel = {t: 'wall', id: h.id}; ui(); }
    if (g.t === 'nmove') { begin(); C.sel = {t: 'node', id: h.id}; ui(); }
    if (g.t === 'scale') { begin(); const p = photo(h.id), cs = [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + phH(p)], [p.x, p.y + phH(p)]], A = cs[(h.c + 2) % 4]; g.anchor = {x: A[0], y: A[1]}; g.o = {w: p.w, h: phH(p)}; }
    if (g.t === 'dimend') { begin(); C.sel = {t: 'dim', id: h.id}; ui(); }
    if (g.t === 'dmove') { begin(); const d = dim(h.id); g.o = {a: endPos(d.a), b: endPos(d.b)}; C.sel = {t: 'dim', id: h.id}; ui(); }
    if (g.t === 'crop' || g.t === 'cropmove') g.cr0 = C.crop ? photo(C.crop.id).cr.slice() : null;
  }
  const photoAt = p => { const q = toW(p.x, p.y); if (C.phHide) return null; for (let i = D.photos.length - 1; i >= 0; i--) { const o = D.photos[i]; if (q.x >= o.x && q.x <= o.x + o.w && q.y >= o.y && q.y <= o.y + phH(o)) return o; } return null; };
  function isSelH(h) {                                           // объект под пальцем уже выбран (или ручка выбранного)
    if (/-h$/.test(h.t) || h.t === 'label' || h.t === 'dlabel' || h.t === 'elabel' || h.t === 'rname' || h.t === 'rh' || h.t === 'cofl') return true;
    const s = C.sel; if (!s) return false; if (s.t === h.t && s.id === h.id) return true;
    if (h.t === 'node' && s.t === 'wall') { const w = wall(s.id); return !!w && (w.a === h.id || w.b === h.id); }
    if (h.t === 'frame' && s.t === 'photo') return frame(h.id) && frame(h.id).ph === s.id;
    return false;
  }
  function ptsDone(g) {                                          // рамка по диагонали → сразу стена (L, H)
    const p = photo(g.ph); if (!p || !g.b) { draw(); return; } const F = phFull(p), u = q => clamp((q.x - F.x) / F.w, 0, 1), v = q => clamp((q.y - F.y) / F.h, 0, 1);
    const u0 = Math.min(u(g.a), u(g.b)), u1 = Math.max(u(g.a), u(g.b)), v0 = Math.min(v(g.a), v(g.b)), v1 = Math.max(v(g.a), v(g.b));
    if ((u1 - u0) * F.w * V.s < 20 || (v1 - v0) * F.h * V.s < 20) { draw(); return; }
    const r5 = t => rnd(t * 1e5) / 1e5; begin(); const f = {id: uid('r'), ph: p.id, q: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(t => t.map(r5)), wall: null}; D.frames.push(f); C.sel = {t: 'frame', id: f.id}; commit();
    frameWall(f);
  }
  function fingerPan(p) { return PEN.on && PEN.seen && LASTPT === 'touch' && drawTool(); }
  const movObj = h => h.t === 'frame' ? photo(frame(h.id).ph) : h.t === 'photo' ? photo(h.id) : elev(h.id);
  function oneEnd(p, cancelled) {
    const g = G; G = null;
    if (cancelled) { cancel(); draw(); return; }
    if (!g.moved) { tap(g); return; }
    if (g.t === 'dimdraw') { if (g.cur) { const d = addDim(g.a, g.cur); if (d) C.sel = {t: 'dim', id: d.id}; } ui(); draw(); return; }
    if (g.t === 'draw') { if (g.b) { const w = addWall(g.a, g.b); if (w) C.sel = {t: 'wall', id: w.id}; } ui(); draw(); return; }
    if (g.t === 'nmove') { const n = node(g.h.id); if (g.snapN && n) { mergeNode(n.id, g.snapN); C.sel = {t: 'node', id: g.snapN}; } }
    if (g.t === 'pan') { if (g.fxMsg) toast('Размер стены введён — не тянется; новый размер — касанием поля'); viewChanged(); return; }
    if (g.t === 'ptsd') { ptsDone(g); return; }
    if (g.t === 'rs') { C.msel = g.r ? rsPick(g.r[0], g.r[1]) : []; C.sel = null; ui(); draw(); if (C.msel.length) toast('В группе: ' + C.msel.length); return; }
    if (B6end(g)) return;
    if (B4end(g)) return;
    if (typeof B3end === 'function' && B3end(g, p)) return;
    commit();
  }
  function tap(g) {
    const h = g.h;
    if (C.crop) return;
    if (h && h.t === 'edim') { edTap(h); return; }
    if (g.finger) { const t0 = C.tool; C.tool = 'sel'; try { tap({...g, finger: false}); } finally { C.tool = t0; ui(); } return; }
    if (C.tool === 'rsel') { const m = normHit(h); if (m) C.msel = inMsel(m.t, m.id) ? C.msel.filter(x => !(x.t === m.t && x.id === m.id)) : [...C.msel, m]; else C.msel = []; C.sel = null; ui(); draw(); return; }
    if (C.tool === 'pts') { if (h && (h.t === 'frame' || h.t === 'fr-h')) { C.sel = {t: 'frame', id: h.id}; ui(); draw(); return; } toast('4 угла — протяни рамку по диагонали по фото стены'); return; }
    if (C.msel.length) C.msel = [];
    if (B6tap(g, h)) return;
    if (B4tap(g, h)) return;
    if (typeof B3tap === 'function' && B3tap(g, h)) return;
    if (h && h.t === 'label') { C.sel = {t: 'wall', id: h.id}; ui(); draw(); openEd(h.id); return; }
    if (h && h.t === 'dlabel') { C.sel = {t: 'dim', id: h.id}; ui(); draw(); openKb('dim', h.id); return; }
    if (h && h.t === 'elabel') { C.sel = {t: 'elev', id: h.id}; ui(); draw(); openKb('H', null); return; }
    if (C.tool === 'dim' || C.tool === 'arr') { const hh = hit(g.p0.x, g.p0.y); C.sel = hh && (hh.t === 'dim' || hh.t === 'dim-h') ? {t: 'dim', id: hh.id} : null; ui(); draw(); return; }
    if (C.tool === 'wall') { const hh = hit(g.p0.x, g.p0.y); C.sel = hh && (hh.t === 'wall' || hh.t === 'node') ? {t: hh.t, id: hh.id} : null; ui(); draw(); return; }
    C.sel = h && h.t !== 'ph-h' && h.t !== 'dim-h' && h.t !== 'fr-h' && h.t !== 'drw-h' && h.t !== 'com-h' ? {t: h.t, id: h.id} : (h && (h.t === 'ph-h' || h.t === 'dim-h' || h.t === 'fr-h' || h.t === 'drw-h' || h.t === 'com-h') ? C.sel : null); ui(); draw();
  }

  /* ═══ [BLOCK C-CROP] подрезка выбранного фото — прямоугольная, по углам; кадр не теряется ═══ */
  function cropStart() {
    const p = photo(C.sel.id); begin(); const k = p.w / ((p.cr[2] - p.cr[0]) * p.iw);
    C.crop = {id: p.id, F: {x: p.x - p.cr[0] * p.iw * k, y: p.y - p.cr[1] * p.ih * k, k}}; ui(); draw();
  }
  function cropApply(p, cr) {
    const F = C.crop.F; p.cr = cr; p.x = rnd(F.x + cr[0] * p.iw * F.k); p.y = rnd(F.y + cr[1] * p.ih * F.k); p.w = Math.max(1, rnd((cr[2] - cr[0]) * p.iw * F.k));
  }
  function cropDrag(g, q) {
    const p = photo(C.crop.id), F = C.crop.F, u = clamp((q.x - F.x) / (p.iw * F.k), 0, 1), v = clamp((q.y - F.y) / (p.ih * F.k), 0, 1), cr = g.cr0.slice(), M = 0.05, c = g.h.c;
    if (c === 0 || c === 3) cr[0] = Math.min(u, cr[2] - M); else cr[2] = Math.max(u, cr[0] + M);
    if (c === 0 || c === 1) cr[1] = Math.min(v, cr[3] - M); else cr[3] = Math.max(v, cr[1] + M);
    cropApply(p, cr); draw();
  }
  function cropMove(g, mx, my) {
    const p = photo(C.crop.id), F = C.crop.F, c0 = g.cr0, du = clamp(mx / (p.iw * F.k), -c0[0], 1 - c0[2]), dv = clamp(my / (p.ih * F.k), -c0[1], 1 - c0[3]);
    cropApply(p, [c0[0] + du, c0[1] + dv, c0[2] + du, c0[3] + dv]); draw();
  }
  function cropEnd() { C.crop = null; commit(); ui(); draw(); }
  function cropReset() { cropApply(photo(C.crop.id), [0, 0, 1, 1]); draw(); }

  /* ═══ [BLOCK C-EDIT] ввод значения — только по касанию подписи; клавиатура как v81 (1–9, ⌫, Готово, «,», 0, ±) ═══
     стена — длина плана (геометрия меняется); размер — введённое значение (геометрия не меняется; пусто — снять) */
  const KB = {tg: null, buf: ''}, kbEl = $('cKb');
  function openKb(t, id) {
    const o = t === 'wall' ? wall(id) : t === 'dim' ? dim(id) : t === 'fL' ? frame(id) : B4kbObj(t, id) || B6kb(t, id) || D; if (!o) return;
    KB.tg = {t, id}; KB.buf = t === 'wall' ? String(rnd(wLen(o))) : t === 'H' ? String(D.H || '') : t === 'fL' ? '' : B4kbBuf(t, o) != null ? B4kbBuf(t, o) : B6buf(t, o) != null ? B6buf(t, o) : (o.v !== '' && o.v != null ? String(o.v) : ''); KB.fresh = true;
    document.body.classList.add('kb'); ui(); draw();
  }
  const openEd = id => openKb('wall', id);
  function closeEd(apply) {
    if (!KB.tg) return; const tg = KB.tg, raw = KB.buf.replace(',', '.'); KB.tg = null; document.body.classList.remove('kb');
    if (apply) { const v = parseFloat(raw);
      if (tg.t === 'wall') { const w = wall(tg.id); if (w && v > 0 && Math.abs(v - wLen(w)) >= 0.5) setLen(w, v); }
      else if (tg.t === 'fL') { const f = frame(tg.id); if (f && v > 0) mkFrameWall(f, v); }
      else if (B4kbApply(tg, v, raw)) { }
      else if (B6apply(tg, v)) { }
      else if (tg.t === 'H') { if (v > 0 && v !== +D.H) { begin(); D.H = rnd(v); commit(); } else if (!(v > 0) && !D.elev.length) { begin(); D.H = ''; commit(); } }
      else { const d = dim(tg.id); if (d) { begin(); d.v = raw === '' || raw === '-' || isNaN(v) ? '' : v; commit(); } } }
    const after = KB.after; KB.after = null; if (apply && after) after();
    ui(); draw();
  }
  function kbKey(k) {
    if (!KB.tg) return;
    if (k === 'ok') { closeEd(true); return; }
    if (k === 'bs') KB.buf = KB.fresh ? '' : KB.buf.slice(0, -1);
    else if (k === 'pm') KB.buf = KB.buf[0] === '-' ? KB.buf.slice(1) : '-' + KB.buf;
    else if (k === ',') { if (KB.fresh) KB.buf = '0'; if (!KB.buf.includes(',')) KB.buf += ','; }
    else { if (KB.fresh) KB.buf = ''; if (KB.buf.replace(/\D/g, '').length < 7) KB.buf += k; }
    KB.fresh = false; draw();
  }
  kbEl.querySelectorAll('[data-kk]').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); kbKey(b.dataset.kk); }));

  /* ═══ [BLOCK C-UI] шапка, нижний ряд, контекстные кнопки ═══
     кнопки срабатывают по отпусканию пальца на кнопке (pointerup), а не по click: после щипка WebView может не выдать click */
  function act(el, fn) {
    el.addEventListener('pointerdown', e => { el._pd = e.pointerId; });
    el.addEventListener('pointerup', e => { if (el._pd !== e.pointerId || el.disabled) return; el._pd = null; const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { e.preventDefault(); fn(e); } });
    el.addEventListener('pointercancel', () => { el._pd = null; });
  }
  /* ═══ [BLOCK C-STRIPS] строки быстрого доступа: #ch (по виду — стены / план) и #zpSlots (общая); состав — перетаскиванием.
     Источник значков и подписей — футляр #tb (82.18). Из футляра в строку — добавить; по строке / между строками — порядок;
     на 🗑 — убрать из строки (в футляре остаётся). Касание — взять инструмент. Состав хранится на устройстве (localStorage). ═══ */
  const REG = {};
  document.querySelectorAll('#tb .tl[data-k]').forEach(t => { const ic = t.querySelector('svg, b.gl'); REG[t.dataset.k] = {icon: ic ? ic.outerHTML : '', title: t.title, c: t.style.getPropertyValue('--c') || '#1f6fd1'}; });
  const SDEF = {wall: ['sel', 'rsel', 'pts', 'dim', 'rf', 'arr', 'pen'], plan: ['sel', 'rsel', 'ct', 'st', 'op'], row2: ['ln', 'rect', 'circ', 'arc', 'txt']};
  const SKEY = 'akx-core-strips';
  let ST = (() => { try { const v = JSON.parse(localStorage.getItem(SKEY)); if (v && v.wall && v.plan && v.row2) return v; } catch (e) { } return clone(SDEF); })();
  const stSave = () => { try { localStorage.setItem(SKEY, JSON.stringify(ST)); } catch (e) { } };
  const TOOLK = {sel: 'sel', dim: 'dim', arr: 'arr', st: 'wall', rsel: 'rsel', pts: 'pts', pen: 'pen', ln: 'ln', pl: 'pl', rect: 'rect', circ: 'circ', arc: 'arc', er: 'er', txt: 'txt', pin: 'pin', vyn: 'vyn',
    ct: 'ct', op: 'op', note: 'note', room: 'room', ...Object.fromEntries(Object.keys(CK).map(k => [k, k]))};               // ключ футляра → инструмент ядра
  const IMPL = {sel: 1, dim: 1, arr: 1, st: 1, rf: () => { C.phm = !C.phm; ui(); }, cam: () => $('cCam').click(), gal: () => $('cFile').click()};
  function useKey(k) {
    if (C.crop) cropEnd();
    C.ptsP = null; C.zdp = []; C.cpg = null; C.ctp = null; C.opp = null;
    if (typeof B3tool === 'function' && B3tool(k)) { if (C.tool !== 'sel' && C.tool !== 'rsel') C.msel = []; C.phm = false; ui(); draw(); return; }
    if (TOOLK[k]) { C.tool = TOOLK[k]; if (C.tool !== 'sel' && C.tool !== 'rsel') C.msel = []; C.phm = false; ui(); draw(); return; }
    if (typeof IMPL[k] === 'function') { IMPL[k](); return; }
    toast('«' + ((REG[k] && REG[k].title) || k) + '» — переносится на ядро следующими этапами');
  }
  const rowKey = el => (el.closest('#ch') ? C.mode : 'row2');
  function renderStrips() {
    const b = (k, cls) => { const r = REG[k]; return r ? `<button class="${cls}${TOOLK[k] === C.tool ? ' on' : ''}" data-q="${k}" title="${esc(r.title)}" style="--c:${r.c}">${r.icon}</button>` : ''; };
    $('ch').innerHTML = ST[C.mode].map(k => b(k, 'pb')).join('');
    $('zpSlots').innerHTML = ST.row2.map(k => b(k, '')).join('');
    document.querySelectorAll('#tb .tl[data-k]').forEach(t => t.classList.toggle('on', TOOLK[t.dataset.k] === C.tool));
  }
  /* перетаскивание: палец/перо; порог 8 px — иначе касание */
  let DG = null; const ghost = $('dgGhost');
  const dgClear = () => { document.querySelectorAll('.dg-ins,.dg-ins-end,.dg-over,.dg-del,.dg-src').forEach(e => e.classList.remove('dg-ins', 'dg-ins-end', 'dg-over', 'dg-del', 'dg-src')); };
  function dgTarget(x, y) {
    ghost.classList.remove('on'); const el = document.elementFromPoint(x, y); if (DG && DG.moved) ghost.classList.add('on');
    if (!el) return null;
    if (el.closest('#bDelS')) return {t: 'del'};
    const box = el.closest('#ch') ? $('ch') : el.closest('#zpb') ? $('zpSlots') : null; if (!box) return null;
    const btns = [...box.querySelectorAll('[data-q]')]; let i = btns.findIndex(b => { const r = b.getBoundingClientRect(); return x < r.left + r.width / 2; }); if (i < 0) i = btns.length;
    return {t: 'row', row: box.id === 'ch' ? C.mode : 'row2', i, btns, box};
  }
  document.addEventListener('pointerdown', e => {
    const src = e.target.closest('#ch [data-q], #zpSlots [data-q], #tb .tl[data-k]'); if (!src) return;
    e.preventDefault(); e.stopPropagation();
    DG = {k: src.dataset.q || src.dataset.k, from: src.closest('#tb') ? 'tb' : rowKey(src), el: src, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false, t0: performance.now()};
    try { src.setPointerCapture(e.pointerId); } catch (_) { }
  }, true);
  document.addEventListener('pointermove', e => {
    if (!DG || e.pointerId !== DG.id) return;
    if (!DG.moved) { if (hyp(e.clientX - DG.x0, e.clientY - DG.y0) < 8) return; if (performance.now() - DG.t0 < 600) { DG = null; return; } DG.moved = true; /* правка строк — после удержания 600 мс (замечание 2) */ ghost.innerHTML = (REG[DG.k] || {}).icon || ''; ghost.classList.add('on'); DG.el.classList.add('dg-src'); }
    ghost.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    dgClear(); DG.el.classList.add('dg-src'); const t = dgTarget(e.clientX, e.clientY);
    if (t && t.t === 'del' && DG.from !== 'tb') $('bDelS').classList.add('dg-del');
    if (t && t.t === 'row') { (t.box.id === 'ch' ? $('ch') : $('zpb')).classList.add('dg-over'); if (t.btns[t.i]) t.btns[t.i].classList.add('dg-ins'); else if (t.btns.length) t.btns[t.btns.length - 1].classList.add('dg-ins-end'); }
  }, true);
  const dgEnd = e => {
    if (!DG || e.pointerId !== DG.id) return; const g = DG; DG = null; ghost.classList.remove('on'); dgClear();
    if (e.type === 'pointercancel') return;
    if (!g.moved) { if (g.from === 'tb') $('tb').classList.remove('on'); useKey(g.k); return; }
    const t = dgTarget(e.clientX, e.clientY); ghost.classList.remove('on');
    if (t && t.t === 'del') { if (g.from !== 'tb') { ST[g.from] = ST[g.from].filter(k => k !== g.k); stSave(); renderStrips(); toast('Убрано из строки · в футляре остаётся'); } return; }
    if (t && t.t === 'row') {
      const dst = ST[t.row]; let i = t.i; const j = dst.indexOf(g.k);
      if (j >= 0) { dst.splice(j, 1); if (j < i) i--; }
      if (g.from !== 'tb' && g.from !== t.row) ST[g.from] = ST[g.from].filter(k => k !== g.k);
      dst.splice(i, 0, g.k); stSave(); renderStrips();
    }
  };
  document.addEventListener('pointerup', dgEnd, true); document.addEventListener('pointercancel', dgEnd, true);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  function ui() {
    document.body.classList.toggle('m-plan', C.mode === 'plan'); document.body.classList.toggle('m-wall', C.mode === 'wall');
    if (!DG) renderStrips();
    document.querySelectorAll('#mdT [data-md]').forEach(b => b.classList.toggle('on', b.dataset.md === C.mode));
    $('bUnd').classList.toggle('dis', !HS.u.length); $('bRed').classList.toggle('dis', !HS.r.length); $('bDelS').classList.toggle('dis', (!C.sel && !C.msel.length) || !!C.crop);
    $('labCrop').classList.toggle('on', !!C.crop); $('fws').classList.toggle('on', !!C.phm && !C.crop && !KB.tg);
    const box = $('zMods'), s = C.sel, B = []; box.innerHTML = ''; $('zpAct').innerHTML = '';
    if (s && s.t === 'photo' && !C.crop) B.push(['✂', cropStart, 'Подрезать фото (рамка; исходник сохраняется)']);
    else if (s && s.t === 'frame') { const f = frame(s.id), w = f && f.wall && wall(f.wall);
      if (f) B.push(['<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#t-wallseg"/></svg>', () => frameWall(f), w ? `Стена С${w.gn} — показать` : 'Стена по рамке: L × H']); }
    else if (s && s.t === 'wall') { const w = wall(s.id); if (w) { const has = D.elev.some(e => e.wall === w.id);
      B.push(['<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#t-wallseg"/></svg>', () => addElev(w), has ? `Стена С${w.gn} на холсте — показать` : `Стена С${w.gn} на холст`]); } }
    if (typeof B3act === 'function') B3act(s, B);
    if (typeof B4act === 'function') B4act(s, B);
    if (typeof B6act === 'function') B6act(s, B);
    box.classList.toggle('on', B.length > 0);
    for (const [h, fn, ti] of B) { const b = document.createElement('button'); b.innerHTML = h; b.title = ti || ''; act(b, fn); box.appendChild(b); }
    if (typeof B3ui === 'function') B3ui();
  }
  document.querySelectorAll('#mdT [data-md]').forEach(b => act(b, () => { C.mode = b.dataset.md; C.phm = false; ui(); draw(); }));
  document.querySelectorAll('[data-soon]').forEach(b => act(b, () => toast('«' + b.dataset.soon + '» — переносится на ядро следующими этапами')));
  document.querySelectorAll('#fws [data-rf]').forEach(b => act(b, () => { C.phm = false; ui(); $(b.dataset.rf === 'c' ? 'cCam' : 'cFile').click(); }));
  act($('zpF'), () => $('tb').classList.toggle('on'));
  act($('tbX'), () => $('tb').classList.remove('on'));
  act($('bStripRs'), () => { $('zMenu').classList.remove('on'); ST = clone(SDEF); stSave(); renderStrips(); toast('Строки инструментов — по умолчанию'); });
  $('cCam').onchange = e => { const f = e.target.files; addPhotos(f).finally(() => { e.target.value = ''; }); };
  $('cFile').onchange = e => { const f = e.target.files; addPhotos(f).finally(() => { e.target.value = ''; }); };
  act($('bUnd'), () => { if (C.crop) cropEnd(); undo(); });
  act($('bRed'), () => { if (C.crop) cropEnd(); redo(); });
  act($('bDelS'), () => { if (!$('bDelS').classList.contains('dis')) del(); });
  act($('bDone'), () => { closeEd(true); if (C.crop) cropEnd(); save().then(() => toast('Сохранено')); });   // ✓ — только сохранить проект; вид не меняется
  act($('bMore'), () => $('zMenu').classList.toggle('on'));
  act($('bUpdChk'), () => { $('zMenu').classList.remove('on'); const N = window.AkrixUpdate; if (N && N.check) N.check(); else toast('Обновление — только в приложении'); });
  act($('labCrX'), () => { cancel(); C.crop = null; ui(); draw(); });
  act($('labCrRs'), () => { cropReset(); cropEnd(); });
  act($('labCrOk'), cropEnd);
  $('labPrjT').onchange = e => { begin(); D.name = e.target.value.trim(); commit(); };
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  /* ═══ [BLOCK C-B6] Б6 «Холст»: заметка, помещения (скетч границы → ближайшие стены; имя, H — касанием), план помещений,
     перенос холста (сохранить / загрузить JSON с фото), 📁 проекты, лазер Bosch (мост AkrixBT v81).
     Помещение: провести границу внутри — стены, средняя удалённость которых от границы ≤ R (по умолчанию 600 мм, меняется), входят в помещение;
       дальние (через арку / пролёт) не цепляются. Стены сами не перестраиваются. ═══ */
  const room = id => D.rooms.find(r => r.id === id);
  const RLBL = new Map();                                        // id → {n: прямоугольник имени, h: прямоугольник H}
  function roomWalls(poly, R) {
    const P = poly.map(([x, y]) => ({x, y})), d = q => { let m = Infinity; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; m = Math.min(m, segDist([q.x, q.y], [a.x, a.y], [b.x, b.y])); } return m; };
    return D.walls.filter(w => { const a = node(w.a), b = node(w.b); if (!a || !b) return false; let s = 0; for (let k = 0; k <= 4; k++) s += d({x: a.x + (b.x - a.x) * k / 4, y: a.y + (b.y - a.y) * k / 4}); return s / 5 <= R; }).map(w => w.id);
  }
  function drawRooms() {
    RLBL.clear();
    for (const r of D.rooms) {
      const on = C.sel && C.sel.t === 'room' && C.sel.id === r.id, S = r.poly.map(([x, y]) => toS(x, y)), col = on ? COL.sel : '#0e7f93';
      cx.beginPath(); S.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); cx.fillStyle = 'rgba(14,127,147,.07)'; cx.fill(); cx.strokeStyle = col; cx.lineWidth = on ? 2 : 1.4; cx.setLineDash([7, 5]); cx.stroke(); cx.setLineDash([]);
      if (on) { cx.strokeStyle = 'rgba(31,111,209,.45)'; cx.lineWidth = 9; cx.lineCap = 'round'; for (const id of r.walls) { const w = wall(id), a = w && node(w.a), b = w && node(w.b); if (!a || !b) continue; const A = toS(a.x, a.y), B = toS(b.x, b.y); cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); } }
      const c = r.poly.reduce((o, [x, y]) => [o[0] + x / r.poly.length, o[1] + y / r.poly.length], [0, 0]), [X, Y] = toS(c[0], c[1]);
      const ed = TXI.id === 'room:' + r.id, edH = KB.tg && KB.tg.t === 'rH' && KB.tg.id === r.id;
      cx.font = '700 13px system-ui'; const nt = (ed ? txIn.value + '▏' : r.name) || ' ', ht = 'H ' + (edH ? (KB.buf || ' ') + '▏' : r.H ? num(r.H) : '?'), nw = cx.measureText(nt).width + 12, hw = cx.measureText(ht).width + 12;
      const n = {x: X - (nw + hw + 4) / 2, y: Y - 11, w: nw, h: 22}, h = {x: n.x + nw + 4, y: Y - 11, w: hw, h: 22};
      for (const [b, t, hl] of [[n, nt, ed], [h, ht, edH]]) { cx.fillStyle = hl ? '#fff7d1' : '#fff'; cx.fillRect(b.x, b.y, b.w, b.h); cx.strokeStyle = col; cx.lineWidth = 1.2; cx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1); cx.fillStyle = col; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, b.x + b.w / 2, Y + 0.5); }
      RLBL.set(r.id, {n, h});
    }
    const g = G; if (g && g.t === 'rmdraw' && g.pts.length > 1) { cx.strokeStyle = '#0e7f93'; cx.lineWidth = 2; cx.setLineDash([7, 5]); cx.beginPath(); g.pts.forEach((q, i) => { const [x, y] = toS(q.x, q.y); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.stroke(); cx.setLineDash([]); }
  }
  function B6hit(sx, sy) {
    const inB = b => sx >= b.x - 4 && sx <= b.x + b.w + 4 && sy >= b.y - 4 && sy <= b.y + b.h + 4;
    for (const [id, L] of RLBL) { if (inB(L.n)) return {t: 'rname', id}; if (inB(L.h)) return {t: 'rh', id}; }
    return null;
  }
  function B6hitArea(q) { for (let i = D.rooms.length - 1; i >= 0; i--) { const r = D.rooms[i]; const S = r.poly.map(([x, y]) => toS(x, y)), [sx, sy] = toS(q.x, q.y);
    for (let k = 0; k < S.length; k++) if (segDist([sx, sy], S[k], S[(k + 1) % S.length]) < 10) return {t: 'room', id: r.id}; } return null; }
  function B6start(g, p, h) {
    if (h && (h.t === 'rname' || h.t === 'rh')) { g.t = 'pan'; return true; }
    if (C.tool === 'room' && !isLbl(h)) { g.t = 'rmdraw'; g.pts = [toW(p.x, p.y)]; return true; }
    if (C.tool === 'note' && !isLbl(h)) { g.t = 'pan'; return true; }
    return false;
  }
  function B6move(g, p, q) { if (g.t !== 'rmdraw') return false; const L = g.pts[g.pts.length - 1], [lx, ly] = toS(L.x, L.y); if (hyp(lx - p.x, ly - p.y) > 6) g.pts.push(q); draw(); return true; }
  function B6end(g) {
    if (g.t !== 'rmdraw') return false; if (g.pts.length < 3) { draw(); return true; }
    const poly = g.pts.map(q => [rnd(q.x), rnd(q.y)]), R0 = 600; begin();
    const n = D.rooms.length + 1, r = {id: uid('m'), name: 'Помещение ' + n, H: Hmm() || '', poly, R: R0, walls: roomWalls(poly, R0)}; D.rooms.push(r); C.sel = {t: 'room', id: r.id}; commit();
    toast(`${r.name}: стен ${r.walls.length} · имя и H — касанием`); return true;
  }
  function B6tap(g, h) {
    if (h && h.t === 'rname') { C.sel = {t: 'room', id: h.id}; ui(); roomName(h.id); return true; }
    if (h && h.t === 'rh') { C.sel = {t: 'room', id: h.id}; openKb('rH', h.id); ui(); draw(); return true; }
    if (C.tool === 'note' && !isLbl(h)) { const hd = h && h.t === 'drw' && drw(h.id); if (hd && hd.k === 'note') { C.sel = {t: 'drw', id: hd.id}; ui(); draw(); txOpen(hd.id); return true; }
      const q = toW(g.p0.x, g.p0.y), r = drwNew('note', [q], {tx: '', c: '#F2B233'}); ui(); txOpen(r.id); return true; }
    if (C.tool === 'room' || C.tool === 'sel') { const a = B6hitArea(toW(g.p0.x, g.p0.y)); if (a && (C.tool === 'room' || !h)) { C.sel = a; ui(); draw(); return true; } }
    return false;
  }
  function roomName(id) { const r = room(id); if (!r) return; if (TXI.id && TXI.id !== 'room:' + id) txClose(); TXI.id = 'room:' + id; TXI.focus = true; txIn.value = r.name; txIn.placeholder = 'помещение'; txEl.classList.add('on'); setTimeout(() => { try { txIn.focus(); txIn.select(); } catch (e) { } }, 30); draw(); }
  function B6act(s, B) {
    const r = s && s.t === 'room' && room(s.id); if (!r) return;
    B.push([`<span class="opt on">R</span>`, () => { openKb('rR', r.id); ui(); draw(); toast('R — радиус примагничивания, мм (сейчас ' + r.R + ')'); }, 'R — радиус примагничивания стен: ' + r.R + ' мм']);
  }
  function B6kb(t, id) { return t === 'rH' || t === 'rR' ? room(id) : null; }
  function B6buf(t, o) { return t === 'rH' ? (o.H ? String(o.H) : '') : t === 'rR' ? String(o.R) : null; }
  function B6apply(tg, v) {
    const r = (tg.t === 'rH' || tg.t === 'rR') && room(tg.id); if (!r) return false;
    begin(); if (tg.t === 'rH') r.H = v > 0 ? rnd(v) : ''; else if (v > 0) { r.R = rnd(v); r.walls = roomWalls(r.poly, r.R); toast(`R ${r.R}: стен ${r.walls.length}`); } commit(); return true;
  }
  /* план помещений — список */
  function roomList() {
    let el = $('rmList'); if (!el) { el = document.createElement('div'); el.id = 'rmList'; el.className = 'sheet'; document.body.appendChild(el); }
    if (el.classList.contains('on')) { el.classList.remove('on'); return; }
    el.innerHTML = '<div class="hd"><b>План помещений</b><button data-x>✕</button></div>' + (D.rooms.length ? D.rooms.map(r => `<button class="row" data-r="${r.id}"><span>${esc(r.name)}</span><span class="mu">H ${r.H || '?'} · стен ${r.walls.length}</span></button>`).join('') : '<div class="mu" style="padding:10px">Помещений нет · «Новое помещение» — провести границу на плане</div>');
    el.querySelectorAll('[data-r]').forEach(b => act(b, () => { const r = room(b.dataset.r); el.classList.remove('on'); C.sel = {t: 'room', id: r.id};
      const c = r.poly.reduce((o, [x, y]) => [o[0] + x / r.poly.length, o[1] + y / r.poly.length], [0, 0]); V.ox = cssW() / 2 - c[0] * V.s; V.oy = cssH() / 2 - c[1] * V.s; viewChanged(); ui(); }));
    act(el.querySelector('[data-x]'), () => el.classList.remove('on')); el.classList.add('on');
  }
  /* перенос холста: документ + картинки (data URL) одним JSON */
  const b2d = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  async function exportPrj() {
    await save(); const imgs = {}; for (const p of D.photos) if (!imgs[p.img]) { const b = await get('img', p.img); if (b) imgs[p.img] = await b2d(b); }
    const txt = JSON.stringify({format: 'akrix-core-canvas', v: 1, app: window.MeasureVersion, doc: D, imgs});
    const fn = 'measure-' + ((D.name || 'проект').replace(/[^\wа-яё .-]+/gi, '_').slice(0, 40)) + '-' + new Date().toISOString().slice(0, 10) + '.json';
    if (window.AkrixApp && AkrixApp.save) { AkrixApp.save(fn, 'application/json', txt); toast('Сохранено: Загрузки/Akrix · ' + fn); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type: 'application/json'})); a.download = fn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Перенос: ' + fn); }
    return txt;
  }
  async function importPrj(txt) {
    let o; try { o = JSON.parse(txt); } catch (e) { toast('Файл не прочитан'); return false; }
    if (!o || o.format !== 'akrix-core-canvas' || !o.doc) { toast('Это не перенос холста Measure'); return false; }
    for (const [k, u] of Object.entries(o.imgs || {})) { const b = await (await fetch(u)).blob(); await put('img', b, k); IMG.delete(k); }
    await save(); const d = o.doc; d.id = uid('p'); await openDoc({...d, view: null, hist: {u: [], r: []}}); await save(); toast('Загружено: ' + (d.name || 'проект')); return true;
  }
  /* 📁 проекты: открыть, новый, архив, корзина (восстановить) — список по дате изменения */
  async function openDoc(r) {
    D = r; if (r.view) V = r.view; HS.u = (r.hist && r.hist.u) || []; HS.r = (r.hist && r.hist.r) || []; delete D.view; delete D.hist; delete D.upd; delete D.trash; delete D.arch;
    for (const k of ['dims', 'frames', 'drw', 'com', 'ops', 'rooms', 'photos', 'nodes', 'walls', 'elev']) D[k] = D[k] || [];
    C.sel = null; C.msel = []; C.crop = null; pending = null; $('labPrjT').value = D.name || ''; await put('meta', D.id, 'last'); ui(); draw();
  }
  const allPrj = () => tx('prj', 'readonly', s => s.getAll());
  async function prjList(sec) {
    let el = $('pjList'); if (!el) { el = document.createElement('div'); el.id = 'pjList'; el.className = 'sheet'; document.body.appendChild(el); }
    await save(); sec = sec || 'main'; const L = (await allPrj()).filter(r => sec === 'trash' ? r.trash : sec === 'arch' ? r.arch && !r.trash : !r.arch && !r.trash).sort((a, b) => (b.upd || 0) - (a.upd || 0));
    const dt = t => t ? new Date(t).toLocaleDateString('ru-RU') : '';
    el.innerHTML = `<div class="hd"><b>${sec === 'trash' ? 'Корзина' : sec === 'arch' ? 'Архив' : 'Проекты'}</b>${sec === 'main' ? '<button data-new>＋ Новый</button>' : '<button data-back>← Проекты</button>'}<button data-x>✕</button></div>` +
      L.map(r => `<div class="row${r.id === D.id ? ' cur' : ''}"><button class="nm" data-o="${r.id}">${esc(r.name || 'без имени')}</button><span class="mu">${dt(r.upd)}</span><button class="mn" data-m="${r.id}">⋯</button></div>`).join('') +
      (sec === 'main' ? '<div class="ft"><button data-sec="arch">Архив</button><button data-sec="trash">Корзина</button></div>' : '');
    el.querySelectorAll('[data-o]').forEach(b => act(b, async () => { if (sec !== 'main') return; const r = await get('prj', b.dataset.o); el.classList.remove('on'); if (r && r.id !== D.id) { await openDoc(r); toast('Открыт: ' + (r.name || 'без имени')); } }));
    el.querySelectorAll('[data-m]').forEach(b => act(b, async () => { const id = b.dataset.m, r = await get('prj', id); if (!r) return;
      const acts = sec === 'main' ? [['В архив', () => { r.arch = 1; }], ['Удалить', () => { r.trash = 1; }]] : [['Восстановить', () => { delete r.arch; delete r.trash; }]];
      const m = document.createElement('div'); m.className = 'pjm'; m.innerHTML = acts.map(([t], i) => `<button data-i="${i}">${t}</button>`).join(''); b.parentElement.appendChild(m);
      m.querySelectorAll('[data-i]').forEach(x => act(x, async () => { if (id === D.id && sec === 'main') { toast('Открытый проект — сначала открой другой'); m.remove(); return; } acts[+x.dataset.i][1](); await put('prj', r); prjList(sec); })); }));
    const nb = el.querySelector('[data-new]'); if (nb) act(nb, async () => { el.classList.remove('on'); await openDoc({...newDoc(), view: {ox: 40, oy: 60, s: 0.1}}); await save(); toast('Новый проект'); setTimeout(() => $('labPrjT').focus(), 50); });
    el.querySelectorAll('[data-sec]').forEach(b => act(b, () => prjList(b.dataset.sec)));
    const bb = el.querySelector('[data-back]'); if (bb) act(bb, () => prjList('main'));
    act(el.querySelector('[data-x]'), () => el.classList.remove('on')); el.classList.add('on');
  }
  /* лазер Bosch GLM — мост APK AkrixBT (v81): akrixBtState / akrixBtPkt; замер идёт в открытое поле ввода */
  const BT = {st: 'off', last: null};
  function btBtn() { const b = $('bBtH'); b.classList.toggle('bt-on', BT.st === 'on'); b.classList.toggle('bt-wait', BT.st === 'wait'); b.title = BT.st === 'on' ? 'Лазер: замер' : 'Лазерная рулетка: подключить'; }
  window.akrixBtState = (st, nm) => { const was = BT.st; BT.st = st; if (st === 'on') toast('📡 ' + (nm || 'GLM') + ' подключён'); else if (st === 'off' && was === 'on') toast('📡 дальномер отключён'); btBtn(); };
  window.akrixBtPkt = h => { const b = new Uint8Array(String(h).trim().split(/\s+/).map(x => parseInt(x, 16))), dv = new DataView(b.buffer);
    if (dv.byteLength < 11 || dv.getUint8(0) !== 0xC0 || dv.getUint8(1) !== 0x55 || dv.getUint8(2) !== 0x10) return; const m = dv.getFloat32(7, true); if (!(m > 0 && m < 300)) return; btVal(rnd(m * 1000)); };
  window.akrixBtMsg = t => toast('📡 ' + t);
  function btVal(mm) { BT.last = mm; if (KB.tg) { KB.buf = String(mm); KB.fresh = false; closeEd(true); toast('📡 ' + mm + ' мм'); } else toast('📡 ' + mm + ' мм · коснись значения — вставить'); }
  act($('bBtH'), () => { const N = window.AkrixBT; if (!N) { toast('Лазер — только в приложении'); return; } if (BT.st === 'on') { try { N.measure(); } catch (e) { } } else { BT.st = 'wait'; btBtn(); N.connect(); } });
  act($('bSes'), () => prjList('main'));
  const impIn = document.createElement('input'); impIn.type = 'file'; impIn.accept = '.json,application/json'; impIn.hidden = true; document.body.appendChild(impIn);
  impIn.onchange = async () => { const f = impIn.files[0]; impIn.value = ''; if (f) await importPrj(await f.text()); };
  Object.assign(IMPL, {note: 1, room: 1, plan: roomList, exp: exportPrj, imp: () => impIn.click()});

  /* ═══ [BLOCK C-W13] Вид стены 82.13 на холсте (вариант B, 12.11.2026): развёртка над фото; соседние стены по плану (∠° — раскрытие),
     размеры на гранях — параллельно грани, по центру (поля 82.13: красный текст, пунктирная рамка): верх — L, бока — H, низ — цепочка до граней элементов (номинал);
     у выбранного прямоугольного — вертикальная цепочка (пол → низ, высота, верх → потолок); касание поля — ввод. Подписи «С№ · L × H» нет.
     Колонна / ниша (Z) — и на плане (вид сверху) у своей стены. Aa — размер полей 30–160 %; слои видимости (82.13). ═══ */
  const W3 = (() => { try { const o = JSON.parse(localStorage.getItem('akx-core-w3') || '{}'); return {a: o.a >= 0 && o.a <= 180 ? o.a : 90, f: o.f >= 0.3 && o.f <= 1.6 ? o.f : 1}; } catch (e) { return {a: 90, f: 1}; } })();
  const w3Sv = () => { try { localStorage.setItem('akx-core-w3', JSON.stringify(W3)); } catch (e) { } };
  const LAY_N = [['pen', 'перо и пометки'], ['dim', 'размеры'], ['vyn', 'выноски'], ['kom', 'коммуникации'], ['el', 'проёмы и элементы'], ['zon', 'зоны'], ['foto', 'фото']];
  const LAY = (() => { const d = Object.fromEntries(LAY_N.map(([k]) => [k, true])); try { return Object.assign(d, JSON.parse(localStorage.getItem('akx-core-lay') || '{}')); } catch (e) { return d; } })();
  const laySv = () => { try { localStorage.setItem('akx-core-lay', JSON.stringify(LAY)); } catch (e) { } };
  const comLay = c => { const K = CK[c.k] || {}; return K.pt || K.ln ? LAY.kom : (c.k === 'zon' || c.k === 'znd' || c.k === 'shield') ? LAY.zon : LAY.el; };
  const EDL = [];                                                // поля размеров развёрток: {id (развёртка), k, r (px), …}
  const STRUCT = new Set(['kol', 'nis', 'kor', 'rig', 'win', 'door']);
  function edimBox(t, X, Y, vert, ed) {                          // поле 82.13
    cx.save(); cx.font = `700 ${Math.round(12 * W3.f)}px system-ui`; const tw = cx.measureText(t).width + 8 * W3.f, th = 17 * W3.f;
    cx.translate(X, Y); if (vert) cx.rotate(-Math.PI / 2);
    cx.fillStyle = ed ? '#fff7d1' : '#fff'; cx.fillRect(-tw / 2, -th / 2, tw, th); cx.setLineDash([3, 2]); cx.strokeStyle = '#d93025'; cx.lineWidth = 1; cx.strokeRect(-tw / 2 + 0.5, -th / 2 + 0.5, tw - 1, th - 1); cx.setLineDash([]);
    cx.fillStyle = '#d93025'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 0, 0.5); cx.restore();
    return vert ? {x: X - th / 2, y: Y - tw / 2, w: th, h: tw} : {x: X - tw / 2, y: Y - th / 2, w: tw, h: th};
  }
  const kbIs = (t, id, extra) => KB.tg && KB.tg.t === t && (id == null || KB.tg.id === id) && (!extra || extra(KB.tg));
  const kbTxt = v => (KB.buf || ' ') + '▏';
  function sideWalls(w) {                                        // соседние по плану: слева — у узла a, справа — у узла b (вид из помещения)
    const nb = nid => { const o = D.walls.find(x => x.id !== w.id && (x.a === nid || x.b === nid)); return o ? {w: o, L: wLen(o)} : null; };
    return {l: nb(w.a), r: nb(w.b)};
  }
  function elevChain(e, R) {                                     // низ: 0, грани элементов, L — сегменты (номинал)
    const els = D.com.filter(c => c.e === e.id && STRUCT.has(c.k) && CK[c.k].rc).map(c => ({c, r: cRect(c)})).filter(o => o.r).sort((a, b) => a.r.x - b.r.x);
    const P = [{x: 0}]; for (const o of els) { P.push({x: o.r.x, c: o.c, s: 'L'}); P.push({x: o.r.x + o.r.w, c: o.c, s: 'R'}); } P.push({x: R.w});
    const S = []; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], v = b.x - a.x; if (Math.abs(v) < 0.5) continue;
      S.push({x0: a.x, x1: b.x, v, own: a.c && a.s === 'L' && b.c === a.c ? {c: a.c, k: 'w'} : b.c && b.s === 'L' ? {c: b.c, k: 'gapL'} : a.c && a.s === 'R' ? {c: a.c, k: 'gapR'} : null}); }
    return {S, has: els.length > 0};
  }
  function drawElev(e) {
    const r = elevRect(e), w = wall(e.wall); if (!w) return;
    const [x, y] = toS(r.x, r.y), W = r.w * V.s, H = r.h * V.s, on = (C.sel && C.sel.t === 'elev' && C.sel.id === e.id) || inMsel('elev', e.id);
    // соседние стены: раскрытие ∠° (0 — сложены, 90 — прямой угол, 180 — развёрнуты)
    const th = (180 - W3.a) * Math.PI / 180, sw = sideWalls(w);
    for (const [sd, o] of [[-1, sw.l], [1, sw.r]]) { if (!o) continue; const d = o.L * V.s, dx = sd * d * (Math.cos(th) + Math.sin(th) * 0.35), dy = d * Math.sin(th) * 0.35, X0 = sd < 0 ? x : x + W;
      cx.beginPath(); cx.moveTo(X0, y); cx.lineTo(X0 + dx, y + dy); cx.lineTo(X0 + dx, y + H + dy); cx.lineTo(X0, y + H); cx.closePath(); cx.fillStyle = '#e9e3da'; cx.fill(); cx.strokeStyle = '#b9b2a6'; cx.lineWidth = 1; cx.stroke();
      cx.save(); cx.font = '600 11px system-ui'; cx.fillStyle = '#6b6457'; cx.translate(X0 + dx / 2, y + H / 2 + dy / 2); cx.rotate(sd * Math.PI / 2); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('С' + o.w.gn, 0, 0); cx.restore(); }
    cx.fillStyle = '#dbe9f7'; cx.fillRect(x, y, W, H);
    cx.strokeStyle = on ? COL.sel : '#1f6fd1'; cx.lineWidth = on ? 3 : 2; cx.strokeRect(x, y, W, H);
    cx.font = `700 ${Math.round(12 * W3.f)}px system-ui`; cx.fillStyle = '#1f6fd1'; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText('С' + w.gn, x + 5, y + 14 * W3.f);
  }
  function drawElevDims() {                                      // после объектов стены — поля сверху всего
    EDL.length = 0; if (!LAY.dim) return;
    for (const e of D.elev) { const w = wall(e.wall); if (!w) continue; const R = elevRect(e), [x, y] = toS(R.x, R.y), W = R.w * V.s, H = R.h * V.s;
      EDL.push({id: e.id, k: 'L', r: edimBox(kbIs('wall', w.id) ? kbTxt() : num(R.w), x + W / 2, y, false, kbIs('wall', w.id))});
      for (const X of [x, x + W]) EDL.push({id: e.id, k: 'H', r: edimBox(kbIs('H') ? kbTxt() : num(R.h), X, y + H / 2, true, kbIs('H'))});
      const ch = elevChain(e, R); if (!ch.has) EDL.push({id: e.id, k: 'L', r: edimBox(num(R.w), x + W / 2, y + H, false, false)});
      else ch.S.forEach((s, i) => { const ed = kbIs('eSeg', e.id, t => t.i === i); EDL.push({id: e.id, k: 'seg', i, s, r: edimBox(ed ? kbTxt() : num(s.v), x + (s.x0 + s.x1) / 2 * V.s, y + H, false, ed)}); });
      const sc = C.sel && C.sel.t === 'com' && com(C.sel.id); if (sc && sc.e === e.id && CK[sc.k].rc) { const rr = cRect(sc), X = x + (rr.x + rr.w) * V.s + 12 * W3.f;
        const seg = [['F', 0, rr.y], ['h', rr.y, rr.y + rr.h], ['C', rr.y + rr.h, R.h]];
        for (const [k, y0, y1] of seg) { if (y1 - y0 < 0.5) continue; const ed = k === 'h' ? kbIs('cH', sc.id) : kbIs('cOf', sc.id, t => t.side === k);
          EDL.push({id: e.id, k: 'v' + k, c: sc.id, r: edimBox(ed ? kbTxt() : num(y1 - y0), X, y + H - (y0 + y1) / 2 * V.s, true, ed)}); }
        if (kbIs('cW', sc.id)) edimBox('W ' + kbTxt(), x + (rr.x + rr.w / 2) * V.s, y + H - (rr.y + rr.h / 2) * V.s, false, true); } }
  }
  function edHit(sx, sy) { for (let i = EDL.length - 1; i >= 0; i--) { const o = EDL[i], r = o.r; if (sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4) return {t: 'edim', id: o.id, o}; } return null; }
  function edTap(h) {
    const o = h.o, e = elev(h.id), w = e && wall(e.wall); if (!w) return;
    if (o.k === 'L') { C.sel = {t: 'elev', id: e.id}; openKb('wall', w.id); }
    else if (o.k === 'H') { C.sel = {t: 'elev', id: e.id}; openKb('H', null); }
    else if (o.k === 'seg') { openKb('eSeg', e.id); KB.tg.i = o.i; KB.tg.s = o.s; KB.buf = String(rnd(o.s.v)); }
    else if (o.k === 'vh') { C.sel = {t: 'com', id: o.c}; openKb('cH', o.c); }
    else { C.sel = {t: 'com', id: o.c}; openKb('cOf', o.c); KB.tg.side = o.k.slice(1); const c = com(o.c), r = cRect(c); KB.buf = String(rnd(o.k === 'vF' ? r.y : r.R.h - r.y - r.h)); }
    ui(); draw();
  }
  function segApply(tg, v) {                                     // правка звена цепочки: ширина элемента или зазор до его грани
    const s = tg.s, own = s && s.own; if (!own || !(v >= 0)) { toast('Это звено — от края до края стены: длина вводится сверху'); return; }
    const c = com(own.c.id); if (!c) return; const r = cRect(c); begin(); delete c.ex;
    if (own.k === 'w') { c.x = r.x; c.w = Math.max(1, rnd(v)); }
    else if (own.k === 'gapL') c.x = rnd(r.x + (v - s.v));            // зазор слева от элемента — элемент сдвигается
    else c.x = rnd(r.x - (v - s.v));                                   // зазор справа (до края / следующего) — элемент сдвигается влево
    commit();
  }
  /* колонна / ниша на плане (вид сверху): у своей стены, ширина — по развёртке, глубина — Z (без Z — отрезок ширины по стене) */
  function drawPlanCols() {
    for (const c of D.com) { if (c.k !== 'kol' && c.k !== 'nis') continue; const e = elev(c.e), w = e && wall(e.wall), a = w && node(w.a), b = w && node(w.b); if (!a || !b) continue;
      const L = wLen(w); if (!L) continue; const r = cRect(c), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L, nx = -uy, ny = ux;
      const p0 = {x: a.x + ux * r.x, y: a.y + uy * r.x}, p1 = {x: a.x + ux * (r.x + r.w), y: a.y + uy * (r.x + r.w)}, sel = C.sel && C.sel.t === 'com' && C.sel.id === c.id, col = sel ? COL.sel : CK[c.k].c;
      if (c.D) { const d = c.D, Q = [p0, p1, {x: p1.x + nx * d, y: p1.y + ny * d}, {x: p0.x + nx * d, y: p0.y + ny * d}].map(q => toS(q.x, q.y));
        cx.beginPath(); Q.forEach(([X, Y], i) => (i ? cx.lineTo(X, Y) : cx.moveTo(X, Y))); cx.closePath(); cx.fillStyle = col + '55'; cx.fill(); cx.strokeStyle = col; cx.lineWidth = 1.5; if (c.D < 0) cx.setLineDash([4, 3]); cx.stroke(); cx.setLineDash([]); }
      else { const A = toS(p0.x, p0.y), B = toS(p1.x, p1.y); cx.strokeStyle = col; cx.lineWidth = 7; cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); } }
  }
  /* ∠° и Aa — ползунок 82.13 (w3Slider) */
  function w3Slider(t) {
    const sl = $('w3sl'), i = sl.querySelector('input'), on = !sl.classList.contains('on') || sl.dataset.t !== t; sl.dataset.t = t; sl.classList.toggle('on', on);
    document.querySelectorAll('#mdT [data-w3s]').forEach(b => b.classList.toggle('on', on && b.dataset.w3s === t)); if (!on) return;
    const sp = sl.querySelectorAll('.t span'), up = () => { sl.querySelector('.v').textContent = t === 'a' ? 'Раскрытие боковых стен · ' + W3.a + '°' : 'Размер полей · ' + Math.round(W3.f * 100) + ' %'; };
    if (t === 'a') { i.min = 0; i.max = 180; i.value = W3.a; [sp[0].textContent, sp[1].textContent, sp[2].textContent] = ['0° · сложены', '90° · прямой угол', '180° · развёрнуты']; }
    else { i.min = 30; i.max = 160; i.value = Math.round(W3.f * 100); [sp[0].textContent, sp[1].textContent, sp[2].textContent] = ['30 %', '100 %', '160 %']; }
    i.oninput = () => { if (t === 'a') W3.a = +i.value; else W3.f = i.value / 100; up(); draw(); }; i.onchange = w3Sv; up();
  }
  document.querySelectorAll('#mdT [data-w3s]').forEach(b => act(b, () => w3Slider(b.dataset.w3s)));
  act($('bDimL'), () => { LAY.dim = !LAY.dim; laySv(); $('bDimL').classList.toggle('on', LAY.dim); draw(); toast(LAY.dim ? 'Размеры видны' : 'Размеры скрыты'); });
  $('bDimL').classList.toggle('on', LAY.dim);
  function layPanel() {
    let el = $('lay'); if (!el) { el = document.createElement('div'); el.id = 'lay'; el.className = 'sheet'; document.body.appendChild(el); }
    el.innerHTML = '<div class="hd"><b>Слои</b><button data-x>✕</button></div>' + LAY_N.map(([k, n]) => `<label class="row"><input type="checkbox" data-lay="${k}"${LAY[k] ? ' checked' : ''}> ${n}</label>`).join('');
    el.querySelectorAll('[data-lay]').forEach(i => i.onchange = () => { LAY[i.dataset.lay] = i.checked; laySv(); if (i.dataset.lay === 'foto') { C.phHide = !i.checked; $('zpE').classList.toggle('off', C.phHide); } if (i.dataset.lay === 'dim') $('bDimL').classList.toggle('on', LAY.dim); draw(); });
    act(el.querySelector('[data-x]'), () => el.classList.remove('on')); el.classList.add('on');
  }
  /* стилус (82.13 bPen): «рисует стилус» — после первого касания пером палец в инструментах рисования двигает и масштабирует; ладонь при пере — не в счёт */
  const PEN = {on: (() => { try { return localStorage.getItem('akx-core-pen') !== '0'; } catch (e) { return true; } })(), seen: false, down: 0};
  const penTxt = () => '🖊 Стилус: ' + (PEN.on ? 'рисует стилус' : 'выкл — палец тоже рисует');
  const drawTool = () => C.tool !== 'sel' && C.tool !== 'rsel';
  /* меню ⋮ (82.13) */
  (() => { const m = $('zMenu'); m.innerHTML = '<button id="bExp">⇪ Выгрузка для Akrix</button><button id="bPenM"></button><button id="bLay">◫ Слои</button><button id="bBak">💾 Резервная копия</button><button id="bRes">♻ Восстановить</button><button id="bRms">⌂ Помещения / группы стен</button><button id="bUpdChk">⟳ Проверить обновления</button><button id="bStripRs">Строки инструментов — по умолчанию</button>';
    $('bPenM').textContent = penTxt(); })();
  const mClose = () => $('zMenu').classList.remove('on');
  act($('bExp'), () => { mClose(); toast('Выгрузка для Akrix v3 — блок Б7 (следующий)'); });
  act($('bPenM'), () => { PEN.on = !PEN.on; try { localStorage.setItem('akx-core-pen', PEN.on ? '1' : '0'); } catch (e) { } $('bPenM').textContent = penTxt(); mClose(); toast(penTxt()); });
  act($('bLay'), () => { mClose(); layPanel(); });
  act($('bBak'), () => { mClose(); exportPrj(); });
  act($('bRes'), () => { mClose(); impIn.click(); });
  act($('bRms'), () => { mClose(); roomList(); });

  /* ═══ [BLOCK C-BACK] системная «назад» Android: локальные действия; false — выйти можно ═══ */
  window.AkrixBack = () => {
    if (KB.tg) { closeEd(false); return true; }
    for (const id of ['pjList', 'rmList']) { const e = $(id); if (e && e.classList.contains('on')) { e.classList.remove('on'); return true; } }
    if (C.phm) { C.phm = false; ui(); return true; }
    if (C.crop) { cropEnd(); return true; }
    if (C.ptsP) { C.ptsP = null; draw(); return true; }
    if (C.zdp.length) { C.zdp = []; ui(); draw(); return true; }
    if (C.cpg) { C.cpg = null; ui(); draw(); return true; }
    if (C.ctp || C.opp) { C.ctp = null; C.opp = null; draw(); return true; }
    if (C.msel.length) { C.msel = []; ui(); draw(); return true; }
    if (G && !G.pinch) { cancel(); G = null; draw(); return true; }
    if (C.sel) { C.sel = null; ui(); draw(); return true; }
    save(); return false;
  };

  /* ═══ [BLOCK C-UPD] автообновление (натив AkrixUpdate, AKX-2026-0014): ready после старта → натив сам проверяет version.json;
     находки — карточка сверху: веб-версия → «Перезапустить», APK → «Обновить» ═══ */
  function updCard(t, btn, fn) { const b = $('cUpd'); b.querySelector('span').textContent = t; const k = b.querySelector('button'); k.textContent = btn || ''; k.onclick = fn ? () => { b.classList.remove('on'); fn(); } : null; b.classList.add('on'); if (!fn) setTimeout(() => b.classList.remove('on'), 5000); }
  window.akrixUpdateEvent = raw => {
    let e; try { e = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (x) { return; } if (!e) return; const N = window.AkrixUpdate;
    if (e.type === 'web-ready') updCard('Загружена версия ' + e.version, 'Перезапустить', () => save().then(() => N.restart()));
    else if (e.type === 'apk-available') updCard('Доступно приложение ' + e.versionName, 'Обновить', () => N.downloadApk());
    else if (e.type === 'apk-progress') updCard('Загрузка: ' + e.pct + '%');
    else if (e.type === 'apk-denied') updCard('Разреши установку: Настройки → Приложения → Measure', 'Повторить', () => N.downloadApk());
    else if (e.manual && e.type === 'none') toast('Последняя версия ' + (e.version || ''));
  };
  function updReady() { const N = window.AkrixUpdate; if (N && typeof N.ready === 'function') try { N.ready(String(window.MeasureVersion || '')); } catch (e) { } }

  /* ═══ [BLOCK C-API] для проверки и будущего переходника выгрузки v3 ═══ */
  window.MeasureCore = {scaleInfo: () => { let st = 100; while (st * V.s < 14) st *= 10; return {cell: st}; }, get doc() { return D; }, get view() { return V; }, get sel() { return C.sel; }, get tool() { return C.tool; }, get crop() { return C.crop; }, get msel() { return C.msel; }, frPts, rsPick, drwPts: id => drwW(drw(id)), get phHide() { return C.phHide; }, edl: () => EDL.map(o => ({k: o.k, i: o.i, s: o.s, r: o.r})), elabels: () => [...ELBL.values()], exportPrj, importPrj, allPrj, btVal, roomWalls, comPx: id => comPx(com(id)), cRect: id => cRect(com(id)), get col() { return C.col; }, get lw() { return LW.v; }, hs: HS, toS, toW, hit, endPos, dimVal, dlabels: () => [...DLBL].map(([id, r]) => ({id, ...r})), get kb() { return KB.tg; }, save, fitAll, wLen, phH, elevRect, labels: () => [...LBL].map(([id, r]) => ({id, ...r}))};

  /* ═══ [BLOCK C-INIT] ═══ */
  (async () => {
    try { await dbOpen(); await load(); } catch (e) { console.error(e); D = newDoc(); }
    $('labPrjT').value = D.name; resize(); ui();
    window.MeasureCore.ready = true; updReady();
  })();
})();
