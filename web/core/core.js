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
     frames: {id, ph, q:[[u,v]×4], wall}                   — Б2: рамка «4 угла» на фото (доли полного кадра; ЛВ, ПВ, ПН, ЛН); wall — стена, построенная по рамке */
  const newDoc = () => ({v: 1, id: uid('p'), name: '', H: '', gnHi: 0, photos: [], nodes: [], walls: [], elev: [], dims: [], frames: []});
  let D = null;
  let V = {ox: 40, oy: 60, s: 0.1};                    // вид: px CSS на мм
  const C = {tool: 'sel', mode: 'wall', sel: null, crop: null, phm: false, msel: [], ptsP: null};   // Б2: msel — группа [{t,id}]; ptsP — начатая рамка {ph, q}      // phm — открыт выбор «камера / галерея»      // sel {t:'photo'|'wall'|'node'|'elev', id}
  const node = id => D.nodes.find(n => n.id === id);
  const wall = id => D.walls.find(w => w.id === id);
  const photo = id => D.photos.find(p => p.id === id);
  const elev = id => D.elev.find(e => e.id === id);
  const dim = id => D.dims.find(d => d.id === id);
  const frame = id => D.frames.find(f => f.id === id);
  const wLen = w => { const a = node(w.a), b = node(w.b); return a && b ? hyp(b.x - a.x, b.y - a.y) : 0; };
  const Hmm = () => (+D.H > 0 ? +D.H : 0);
  const phH = p => p.w * ((p.cr[3] - p.cr[1]) * p.ih) / ((p.cr[2] - p.cr[0]) * p.iw);
  const elevRect = e => { const w = wall(e.wall); return {x: e.x, y: e.y, w: w ? wLen(w) : 0, h: Hmm()}; };
  const deg = id => D.walls.filter(w => w.a === id || w.b === id).length;
  function dropOrphans() { D.nodes = D.nodes.filter(n => deg(n.id)); D.elev = D.elev.filter(e => wall(e.wall)); D.frames = D.frames.filter(f => photo(f.ph)); }

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
    const s = C.sel, F = {photo, wall, node, elev, dim, frame}; if (s && !F[s.t](s.id)) C.sel = null; C.msel = C.msel.filter(m => F[m.t] && F[m.t](m.id)); C.ptsP = null;
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
    D.dims = D.dims || []; D.frames = D.frames || [];
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
    drawPlan();
    drawDims();
    drawFrames();
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
  function drawElev(e) {
    const r = elevRect(e), w = wall(e.wall); if (!w) return;
    const [x, y] = toS(r.x, r.y), W = r.w * V.s, H = r.h * V.s, on = C.sel && C.sel.t === 'elev' && C.sel.id === e.id;
    cx.fillStyle = '#ffffffd9'; cx.fillRect(x, y, W, H);
    cx.strokeStyle = on ? COL.sel : COL.elev; cx.lineWidth = on ? 2.5 : 1.5; cx.strokeRect(x, y, W, H);
    cx.lineWidth = on ? 4 : 3; cx.beginPath(); cx.moveTo(x, y + H); cx.lineTo(x + W, y + H); cx.stroke();
    const edH = KB.tg && KB.tg.t === 'H';
    ELBL.set(e.id, label(`С${w.gn} · ${rnd(r.w)} × ${edH ? (KB.buf || ' ') + '▏' : rnd(r.h)}`, x + W / 2, y - 12, on ? COL.sel : COL.elev));
  }
  function label(t, X, Y, col) {
    cx.font = '600 13px system-ui'; const tw = cx.measureText(t).width + 10, r = {x: X - tw / 2, y: Y - 11, w: tw, h: 22};
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
    return q || {x: e.x, y: e.y};
  }
  const surf = e => (e.t === 'node' || e.t === 'wall') && endPos(e) ? 'plan' : e.t === 'elev' && elev(e.id) ? 'e:' + e.id : null;
  function dimVal(d) {                                           // {txt, kind:'man'|'geo'|'none'}
    if (d.v !== '' && d.v != null) return {txt: num(d.v), kind: 'man'};
    const sa = surf(d.a); if (sa && sa === surf(d.b)) { const A = endPos(d.a), B = endPos(d.b); return {txt: num(hyp(B.x - A.x, B.y - A.y)), kind: 'geo'}; }
    return {txt: '?', kind: 'none'};
  }
  const DLBL = new Map();
  function head(x, y, ux, uy, L) { cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - ux * L - uy * L * 0.38, y - uy * L + ux * L * 0.38); cx.lineTo(x - ux * L + uy * L * 0.38, y - uy * L - ux * L * 0.38); cx.closePath(); cx.fill(); }
  function drawDims() {
    DLBL.clear();
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
    for (let i = D.photos.length - 1; i >= 0; i--) { const p = D.photos[i]; if (q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + phH(p)) { const F = phFull(p); return {t: 'photo', id: p.id, u: (q.x - F.x) / F.w, v: (q.y - F.y) / F.h, x: q.x, y: q.y}; } }
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
      ...D.dims.map(o => ({t: 'dim', id: o.id})), ...D.frames.map(o => ({t: 'frame', id: o.id})), ...(typeof B3all === 'function' ? B3all() : [])];
    for (const m of all) { const o = objBox(m); if (o && rsTouch(o, R)) out.push(m); }
    return out;
  }
  const normHit = h => !h ? null : h.t === 'label' ? {t: 'wall', id: h.id} : h.t === 'dlabel' || h.t === 'dim-h' ? {t: 'dim', id: h.id} : h.t === 'elabel' ? {t: 'elev', id: h.id}
    : h.t === 'ph-h' ? {t: 'photo', id: h.id} : h.t === 'fr-h' ? {t: 'frame', id: h.id} : h.t === 'node' ? null : {t: h.t, id: h.id};
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
    D.walls = D.walls.filter(w => !wl.has(w.id)); D.frames = D.frames.filter(f => !fr.has(f.id));
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
    const H = Hmm(), bot = (Q[2].y + Q[3].y) / 2, ex = rnd(p.x + p.w + Math.max(200, L * 0.08)), ey = rnd(bot - H);
    let bx, by; if (D.nodes.length) { bx = Math.max(...D.nodes.map(n => n.x)) + 800; by = Math.min(...D.nodes.map(n => n.y)); } else { bx = ex; by = ey - 1200; }
    const na = {id: uid('n'), x: rnd(bx), y: rnd(by)}, nb = {id: uid('n'), x: rnd(bx + L), y: rnd(by)}; D.nodes.push(na, nb);
    const w = {id: uid('w'), a: na.id, b: nb.id, gn: ++D.gnHi}; D.walls.push(w);
    const e = {id: uid('e'), wall: w.id, x: ex, y: ey}; D.elev.push(e); f.wall = w.id; C.sel = {t: 'elev', id: e.id}; commit();
    toast(`Стена С${w.gn}: ${rnd(L)} × ${H} · фото — под рамку`);
  }

  /* ═══ [BLOCK C-HIT] что под пальцем (px) — порядок: маркеры → подписи → узлы → стены → развёртки → фото ═══ */
  const HR = {handle: 22, node: 20, wall: 14};
  function photoCorners(p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function hit(sx, sy) {
    const s = C.sel;
    if (C.crop) { const p = photo(C.crop.id); const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'crop-h', id: p.id, c};
      const [x0, y0] = photoCorners(p)[0], [x1, y1] = photoCorners(p)[2]; if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) return {t: 'crop-in', id: p.id}; return null; }
    if (s && s.t === 'photo') { const p = photo(s.id); if (p) { const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'ph-h', id: p.id, c}; } }
    if (s && s.t === 'frame') { const Q = frame(s.id) && frPts(frame(s.id)); if (Q) { const c = Q.findIndex(q => { const [x, y] = toS(q.x, q.y); return hyp(x - sx, y - sy) < HR.handle; }); if (c >= 0) return {t: 'fr-h', id: s.id, c}; } }
    if (s && s.t === 'dim') { const d = dim(s.id); if (d) for (const [k, e] of [['a', d.a], ['b', d.b]]) { const P = endPos(e), [x, y] = toS(P.x, P.y); if (hyp(x - sx, y - sy) < HR.handle) return {t: 'dim-h', id: d.id, end: k}; } }
    for (const [id, r] of DLBL) if (hyp(r.x - sx, r.y - sy) < r.r) return {t: 'dlabel', id};
    for (const d of D.dims) { const A = endPos(d.a), B = endPos(d.b); if (segDist([sx, sy], toS(A.x, A.y), toS(B.x, B.y)) < 12) return {t: 'dim', id: d.id}; }
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
    if (typeof B3hit === 'function') { const h3 = B3hit(sx, sy, q); if (h3) return h3; }
    for (let i = D.frames.length - 1; i >= 0; i--) { const Q = frPts(D.frames[i]); if (Q && inPoly(q, Q)) return {t: 'frame', id: D.frames[i].id}; }
    for (let i = D.photos.length - 1; i >= 0; i--) { const p = D.photos[i]; if (q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + phH(p)) return {t: 'photo', id: p.id}; }
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
  function dimCache() { for (const d of D.dims) for (const e of [d.a, d.b]) { const P = endPos(e); e.x = rnd(P.x * 10) / 10; e.y = rnd(P.y * 10) / 10; } }
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
    const L = wLen(w), c = toW(cssW() / 2, cssH() * 0.4);
    begin(); const e = {id: uid('e'), wall: w.id, x: rnd(c.x - L / 2), y: rnd(c.y - Hmm() / 2)}; D.elev.push(e); C.sel = {t: 'elev', id: e.id}; commit();
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
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); closeEd(true); $('zMenu').classList.remove('on'); if (C.phm) { C.phm = false; ui(); } try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    P.set(e.pointerId, pos(e));
    if (P.size === 2) startPinch(); else if (P.size === 1) startOne(pos(e));
  });
  cv.addEventListener('pointermove', e => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, pos(e));
    if (G && G.pinch) pinchMove(); else if (G && !G.dead) oneMove(pos(e));
  });
  const up = e => {
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
    if (h && h.t === 'dim-h') { G.t = 'dimend'; return; }
    if (h && h.t === 'fr-h') { G.t = 'fcorner'; return; }
    if (C.msel.length && (C.tool === 'sel' || C.tool === 'rsel')) { const m = normHit(h); if (m && inMsel(m.t, m.id)) { G.t = 'gmove'; return; } }
    if (C.tool === 'rsel') { G.t = 'rs'; return; }
    if (C.tool === 'pts') { G.t = 'pan'; return; }
    if (typeof B3start === 'function' && B3start(G, p, h)) return;
    if ((C.tool === 'dim' || C.tool === 'arr') && !(h && (h.t === 'dlabel' || h.t === 'label' || h.t === 'elabel'))) { G.t = 'dimdraw'; G.a = snapDim(p.x, p.y, null, null); G.cur = null; return; }
    if (C.tool === 'wall' && !(h && (h.t === 'label' || h.t === 'elabel'))) {
      const a = snapEnd(null, p.x, p.y); G.t = 'draw'; G.a = a; G.b = null; return;
    }
    if (!h || h.t === 'label' || h.t === 'dlabel' || h.t === 'elabel') { G.t = 'pan'; return; }
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
      default: if (typeof B3move === 'function') B3move(g, p, q, mx, my);
      case 'cropmove': cropMove(g, mx, my); break;
    }
  }
  function startDrag(g) {
    const h = g.h;
    if (g.t === 'gmove') gStart(g);
    if (g.t === 'fcorner') { begin(); C.sel = {t: 'frame', id: h.id}; ui(); }
    if (typeof B3drag === 'function') B3drag(g);
    if (g.t === 'move') { begin(); const o = movObj(h); g.o = {x: o.x, y: o.y}; C.sel = {t: h.t, id: h.id}; ui(); }
    if (g.t === 'wmove') { begin(); g.w = wall(h.id); g.o = {a: [node(g.w.a).x, node(g.w.a).y], b: [node(g.w.b).x, node(g.w.b).y]}; C.sel = {t: 'wall', id: h.id}; ui(); }
    if (g.t === 'nmove') { begin(); C.sel = {t: 'node', id: h.id}; ui(); }
    if (g.t === 'scale') { begin(); const p = photo(h.id), cs = [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + phH(p)], [p.x, p.y + phH(p)]], A = cs[(h.c + 2) % 4]; g.anchor = {x: A[0], y: A[1]}; g.o = {w: p.w, h: phH(p)}; }
    if (g.t === 'dimend') { begin(); C.sel = {t: 'dim', id: h.id}; ui(); }
    if (g.t === 'dmove') { begin(); const d = dim(h.id); g.o = {a: endPos(d.a), b: endPos(d.b)}; C.sel = {t: 'dim', id: h.id}; ui(); }
    if (g.t === 'crop' || g.t === 'cropmove') g.cr0 = C.crop ? photo(C.crop.id).cr.slice() : null;
  }
  const movObj = h => h.t === 'frame' ? photo(frame(h.id).ph) : h.t === 'photo' ? photo(h.id) : elev(h.id);
  function oneEnd(p, cancelled) {
    const g = G; G = null;
    if (cancelled) { cancel(); draw(); return; }
    if (!g.moved) { tap(g); return; }
    if (g.t === 'dimdraw') { if (g.cur) { const d = addDim(g.a, g.cur); if (d) C.sel = {t: 'dim', id: d.id}; } ui(); draw(); return; }
    if (g.t === 'draw') { if (g.b) { const w = addWall(g.a, g.b); if (w) C.sel = {t: 'wall', id: w.id}; } ui(); draw(); return; }
    if (g.t === 'nmove') { const n = node(g.h.id); if (g.snapN && n) { mergeNode(n.id, g.snapN); C.sel = {t: 'node', id: g.snapN}; } }
    if (g.t === 'pan') { viewChanged(); return; }
    if (g.t === 'rs') { C.msel = g.r ? rsPick(g.r[0], g.r[1]) : []; C.sel = null; ui(); draw(); if (C.msel.length) toast('В группе: ' + C.msel.length); return; }
    if (typeof B3end === 'function' && B3end(g, p)) return;
    commit();
  }
  function tap(g) {
    const h = g.h;
    if (C.crop) return;
    if (C.tool === 'rsel') { const m = normHit(h); if (m) C.msel = inMsel(m.t, m.id) ? C.msel.filter(x => !(x.t === m.t && x.id === m.id)) : [...C.msel, m]; else C.msel = []; C.sel = null; ui(); draw(); return; }
    if (C.tool === 'pts') { if (!C.ptsP && h && (h.t === 'frame' || h.t === 'fr-h')) { C.sel = {t: 'frame', id: h.id}; ui(); draw(); return; } ptsTap(g.p0.x, g.p0.y); return; }
    if (C.msel.length) C.msel = [];
    if (typeof B3tap === 'function' && B3tap(g, h)) return;
    if (h && h.t === 'label') { C.sel = {t: 'wall', id: h.id}; ui(); draw(); openEd(h.id); return; }
    if (h && h.t === 'dlabel') { C.sel = {t: 'dim', id: h.id}; ui(); draw(); openKb('dim', h.id); return; }
    if (h && h.t === 'elabel') { C.sel = {t: 'elev', id: h.id}; ui(); draw(); openKb('H', null); return; }
    if (C.tool === 'dim' || C.tool === 'arr') { const hh = hit(g.p0.x, g.p0.y); C.sel = hh && (hh.t === 'dim' || hh.t === 'dim-h') ? {t: 'dim', id: hh.id} : null; ui(); draw(); return; }
    if (C.tool === 'wall') { const hh = hit(g.p0.x, g.p0.y); C.sel = hh && (hh.t === 'wall' || hh.t === 'node') ? {t: hh.t, id: hh.id} : null; ui(); draw(); return; }
    C.sel = h && h.t !== 'ph-h' && h.t !== 'dim-h' && h.t !== 'fr-h' ? {t: h.t, id: h.id} : (h && (h.t === 'ph-h' || h.t === 'dim-h' || h.t === 'fr-h') ? C.sel : null); ui(); draw();
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
    const o = t === 'wall' ? wall(id) : t === 'dim' ? dim(id) : t === 'fL' ? frame(id) : typeof B3kbObj === 'function' && B3kbObj(t, id) || D; if (!o) return;
    KB.tg = {t, id}; KB.buf = t === 'wall' ? String(rnd(wLen(o))) : t === 'H' ? String(D.H || '') : t === 'fL' ? '' : typeof B3kbBuf === 'function' && B3kbBuf(t, o) != null ? B3kbBuf(t, o) : (o.v !== '' && o.v != null ? String(o.v) : ''); KB.fresh = true;
    document.body.classList.add('kb'); ui(); draw();
  }
  const openEd = id => openKb('wall', id);
  function closeEd(apply) {
    if (!KB.tg) return; const tg = KB.tg, raw = KB.buf.replace(',', '.'); KB.tg = null; document.body.classList.remove('kb');
    if (apply) { const v = parseFloat(raw);
      if (tg.t === 'wall') { const w = wall(tg.id); if (w && v > 0 && Math.abs(v - wLen(w)) >= 0.5) setLen(w, v); }
      else if (tg.t === 'fL') { const f = frame(tg.id); if (f && v > 0) mkFrameWall(f, v); }
      else if (typeof B3kbApply === 'function' && B3kbApply(tg, v, raw)) { }
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
  const TOOLK = {sel: 'sel', dim: 'dim', arr: 'arr', st: 'wall', rsel: 'rsel', pts: 'pts'};               // ключ футляра → инструмент ядра
  const IMPL = {sel: 1, dim: 1, arr: 1, st: 1, rf: () => { C.phm = !C.phm; ui(); }, cam: () => $('cCam').click(), gal: () => $('cFile').click()};
  function useKey(k) {
    if (C.crop) cropEnd();
    C.ptsP = null;
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
    DG = {k: src.dataset.q || src.dataset.k, from: src.closest('#tb') ? 'tb' : rowKey(src), el: src, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false};
    try { src.setPointerCapture(e.pointerId); } catch (_) { }
  }, true);
  document.addEventListener('pointermove', e => {
    if (!DG || e.pointerId !== DG.id) return;
    if (!DG.moved) { if (hyp(e.clientX - DG.x0, e.clientY - DG.y0) < 8) return; DG.moved = true; ghost.innerHTML = (REG[DG.k] || {}).icon || ''; ghost.classList.add('on'); DG.el.classList.add('dg-src'); }
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
    const box = $('zpAct'), s = C.sel, B = []; box.innerHTML = '';
    if (s && s.t === 'photo' && !C.crop) B.push(['✂', cropStart, 'Подрезать фото (рамка; исходник сохраняется)']);
    else if (s && s.t === 'frame') { const f = frame(s.id), w = f && f.wall && wall(f.wall);
      if (f) B.push(['<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#t-wallseg"/></svg>', () => frameWall(f), w ? `Стена С${w.gn} — показать` : 'Стена по рамке: L × H']); }
    else if (typeof B3act === 'function') B3act(s, B);
    else if (s && s.t === 'wall') { const w = wall(s.id); if (w) { const has = D.elev.some(e => e.wall === w.id);
      B.push(['<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#t-wallseg"/></svg>', () => addElev(w), has ? `Стена С${w.gn} на холсте — показать` : `Стена С${w.gn} на холст`]); } }
    if (B.length) { const sp = document.createElement('span'); sp.className = 'sep'; box.appendChild(sp); }
    for (const [h, fn, ti] of B) { const b = document.createElement('button'); b.innerHTML = h; b.title = ti || ''; act(b, fn); box.appendChild(b); }
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

  /* ═══ [BLOCK C-BACK] системная «назад» Android: локальные действия; false — выйти можно ═══ */
  window.AkrixBack = () => {
    if (KB.tg) { closeEd(false); return true; }
    if (C.phm) { C.phm = false; ui(); return true; }
    if (C.crop) { cropEnd(); return true; }
    if (C.ptsP) { C.ptsP = null; draw(); return true; }
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
  window.MeasureCore = {scaleInfo: () => { let st = 100; while (st * V.s < 14) st *= 10; return {cell: st}; }, get doc() { return D; }, get view() { return V; }, get sel() { return C.sel; }, get tool() { return C.tool; }, get crop() { return C.crop; }, get msel() { return C.msel; }, frPts, rsPick, hs: HS, toS, toW, hit, endPos, dimVal, dlabels: () => [...DLBL].map(([id, r]) => ({id, ...r})), get kb() { return KB.tg; }, save, fitAll, wLen, phH, elevRect, labels: () => [...LBL].map(([id, r]) => ({id, ...r}))};

  /* ═══ [BLOCK C-INIT] ═══ */
  (async () => {
    try { await dbOpen(); await load(); } catch (e) { console.error(e); D = newDoc(); }
    $('labPrjT').value = D.name; resize(); ui();
    window.MeasureCore.ready = true; updReady();
  })();
})();
