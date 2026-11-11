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
     elev:   {id, wall, x, y}                              — развёртка стены: прямоугольник L × H в точке x,y (L — из плана, H — проекта) */
  const newDoc = () => ({v: 1, id: uid('p'), name: '', H: '', gnHi: 0, photos: [], nodes: [], walls: [], elev: []});
  let D = null;
  let V = {ox: 40, oy: 60, s: 0.1};                    // вид: px CSS на мм
  const C = {tool: 'sel', sel: null, crop: null, phm: false};      // phm — открыт выбор «камера / галерея»      // sel {t:'photo'|'wall'|'node'|'elev', id}
  const node = id => D.nodes.find(n => n.id === id);
  const wall = id => D.walls.find(w => w.id === id);
  const photo = id => D.photos.find(p => p.id === id);
  const elev = id => D.elev.find(e => e.id === id);
  const wLen = w => { const a = node(w.a), b = node(w.b); return a && b ? hyp(b.x - a.x, b.y - a.y) : 0; };
  const Hmm = () => (+D.H > 0 ? +D.H : 0);
  const phH = p => p.w * ((p.cr[3] - p.cr[1]) * p.ih) / ((p.cr[2] - p.cr[0]) * p.iw);
  const elevRect = e => { const w = wall(e.wall); return {x: e.x, y: e.y, w: w ? wLen(w) : 0, h: Hmm()}; };
  const deg = id => D.walls.filter(w => w.a === id || w.b === id).length;
  function dropOrphans() { D.nodes = D.nodes.filter(n => deg(n.id)); D.elev = D.elev.filter(e => wall(e.wall)); }

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
    const s = C.sel; if (s && !({photo, wall, node, elev})[s.t](s.id)) C.sel = null;
    C.crop = null; $('cName').value = D.name; $('cH').value = D.H; dirty(); ui(); toast(t);
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
  let raf = 0; const LBL = new Map();          // id стены → прямоугольник подписи (px), для касаний
  function draw() { if (!raf) raf = requestAnimationFrame(paint); }
  const COL = {wall: '#7a3cc8', sel: '#1f6fd1', node: '#0e7f93', elev: '#223', grid: '#e2e4e7', grid2: '#cfd3d8'};
  function paint() {
    raf = 0; if (!D) return; const d = DPR(), W = cssW(), Hh = cssH();
    cx.setTransform(d, 0, 0, d, 0, 0); cx.fillStyle = '#f6f5f1'; cx.fillRect(0, 0, W, Hh);
    const gst = grid(W, Hh);
    for (const p of D.photos) drawPhoto(p);
    for (const e of D.elev) drawElev(e);
    drawPlan();
    drawOverlay();
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
  /* [BLOCK C-SCALE] шкала масштаба в правом верхнем углу холста: размер клетки сетки + отрезок 1-2-5 длиной 60…150 px */
  const mmTxt = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' мм';
  function scaleBar(W, Hh, st) {
    let L = 1; for (const m of [1, 2, 5, 10, 20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5]) { L = m; if (m * V.s >= 60) break; }
    const px = L * V.s, x1 = W - 10, x0 = x1 - px, y = 52, t1 = mmTxt(L), t2 = '□ ' + mmTxt(st);
    cx.font = '600 12px system-ui'; const tw = Math.max(cx.measureText(t1).width, cx.measureText(t2).width, px);
    cx.fillStyle = '#ffffffd9'; cx.fillRect(x1 - tw - 8, y - 40, tw + 14, 46);
    cx.strokeStyle = '#1b1e23'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x0, y - 6); cx.lineTo(x0, y); cx.lineTo(x1, y); cx.lineTo(x1, y - 6); cx.stroke();
    cx.fillStyle = '#1b1e23'; cx.textAlign = 'right'; cx.textBaseline = 'bottom'; cx.fillText(t1, x1, y - 4); cx.fillStyle = '#5b636e'; cx.fillText(t2, x1, y - 22);
  }
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
    label(`С${w.gn} · ${rnd(r.w)} × ${rnd(r.h)}`, x + W / 2, y - 12, on ? COL.sel : COL.elev);
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
      LBL.set(w.id, label(`С${w.gn}  ${rnd(wLen(w))}`, (ax + bx) / 2 + nx * 18, (ay + by) / 2 + ny * 18, on ? COL.sel : COL.wall));
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
    if (g && g.t === 'nmove' && g.snapN) { const n = node(g.snapN), [x, y] = toS(n.x, n.y); cx.strokeStyle = '#e08a00'; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, y, 14, 0, 7); cx.stroke(); }
    const s = C.sel;
    if (s && s.t === 'photo' && !C.crop) { const p = photo(s.id); if (p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s;
      cx.strokeStyle = COL.sel; cx.lineWidth = 2.5; cx.strokeRect(x, y, w, h); handles([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); } }
    if (C.crop) { const p = photo(C.crop.id); if (p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s;
      cx.strokeStyle = '#e08a00'; cx.lineWidth = 2.5; cx.strokeRect(x, y, w, h); handles([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#e08a00'); } }
  }
  function handles(pts, col) { for (const [x, y] of pts) { cx.fillStyle = '#fff'; cx.strokeStyle = col || COL.sel; cx.lineWidth = 2.5; cx.fillRect(x - 8, y - 8, 16, 16); cx.strokeRect(x - 8, y - 8, 16, 16); } }

  /* ═══ [BLOCK C-HIT] что под пальцем (px) — порядок: маркеры → подписи → узлы → стены → развёртки → фото ═══ */
  const HR = {handle: 22, node: 20, wall: 14};
  function photoCorners(p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function hit(sx, sy) {
    const s = C.sel;
    if (C.crop) { const p = photo(C.crop.id); const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'crop-h', id: p.id, c};
      const [x0, y0] = photoCorners(p)[0], [x1, y1] = photoCorners(p)[2]; if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) return {t: 'crop-in', id: p.id}; return null; }
    if (s && s.t === 'photo') { const p = photo(s.id); if (p) { const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'ph-h', id: p.id, c}; } }
    for (const [id, r] of LBL) if (sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 6 && sy <= r.y + r.h + 6) return {t: 'label', id};
    let best = null, bd = HR.node;
    for (const n of D.nodes) { const [x, y] = toS(n.x, n.y), dd = hyp(x - sx, y - sy); if (dd < bd) { bd = dd; best = {t: 'node', id: n.id}; } }
    if (best) return best;
    bd = HR.wall;
    for (const w of D.walls) { const a = node(w.a), b = node(w.b); if (!a || !b) continue; const dd = segDist([sx, sy], toS(a.x, a.y), toS(b.x, b.y)); if (dd < bd) { bd = dd; best = {t: 'wall', id: w.id}; } }
    if (best) return best;
    const q = toW(sx, sy);
    for (let i = D.elev.length - 1; i >= 0; i--) { const r = elevRect(D.elev[i]); if (q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return {t: 'elev', id: D.elev[i].id}; }
    for (let i = D.photos.length - 1; i >= 0; i--) { const p = D.photos[i]; if (q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + phH(p)) return {t: 'photo', id: p.id}; }
    return null;
  }

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
  function del() {
    const s = C.sel; if (!s) { toast('Ничего не выбрано'); return; }
    begin();
    if (s.t === 'photo') D.photos = D.photos.filter(p => p.id !== s.id);
    if (s.t === 'elev') D.elev = D.elev.filter(e => e.id !== s.id);
    if (s.t === 'wall') D.walls = D.walls.filter(w => w.id !== s.id);
    if (s.t === 'node') D.walls = D.walls.filter(w => w.a !== s.id && w.b !== s.id);
    dropOrphans(); C.sel = null; C.crop = null; commit(); toast('Удалено · ↶ — вернуть');
  }
  function addElev(w) {
    if (!Hmm()) { $('cH').classList.add('need'); toast('Укажи высоту H'); $('cH').focus(); return; }
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
    e.preventDefault(); closeEd(true); if (C.phm) { C.phm = false; ui(); } try { cv.setPointerCapture(e.pointerId); } catch (_) { }
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
    if (C.tool === 'wall' && !(h && h.t === 'label')) {
      const a = snapEnd(null, p.x, p.y); G.t = 'draw'; G.a = a; G.b = null; return;
    }
    if (!h || h.t === 'label') { G.t = 'pan'; return; }
    G.t = {'ph-h': 'scale', photo: 'move', elev: 'move', node: 'nmove', wall: 'wmove'}[h.t] || 'pan';
  }
  function oneMove(p) {
    const g = G, dx = p.x - g.p0.x, dy = p.y - g.p0.y;
    if (!g.moved) { if (hyp(dx, dy) < TAP) return; g.moved = true; startDrag(g); }
    const q = toW(p.x, p.y), q0 = toW(g.p0.x, g.p0.y), mx = q.x - q0.x, my = q.y - q0.y;
    switch (g.t) {
      case 'pan': V.ox = g.V0.ox + dx; V.oy = g.V0.oy + dy; draw(); break;
      case 'draw': g.b = snapEnd(g.a, p.x, p.y, g.a.node); draw(); break;
      case 'move': { const o = g.h.t === 'photo' ? photo(g.h.id) : elev(g.h.id); o.x = rnd(g.o.x + mx); o.y = rnd(g.o.y + my); draw(); break; }
      case 'wmove': { const a = node(g.w.a), b = node(g.w.b); a.x = rnd(g.o.a[0] + mx); a.y = rnd(g.o.a[1] + my); b.x = rnd(g.o.b[0] + mx); b.y = rnd(g.o.b[1] + my); draw(); break; }
      case 'nmove': { const n = node(g.h.id), s = snapEnd(null, p.x, p.y, n.id); g.snapN = s.node || null; n.x = s.x; n.y = s.y; draw(); break; }
      case 'scale': { const pp = photo(g.h.id), A = g.anchor, asp = g.o.w / g.o.h, w = Math.max(30, Math.max(Math.abs(q.x - A.x), Math.abs(q.y - A.y) * asp));
        pp.w = rnd(w); const h = phH(pp); pp.x = rnd(g.h.c === 1 || g.h.c === 2 ? A.x : A.x - w); pp.y = rnd(g.h.c >= 2 ? A.y : A.y - h); draw(); break; }
      case 'crop': cropDrag(g, q); break;
      case 'cropmove': cropMove(g, mx, my); break;
    }
  }
  function startDrag(g) {
    const h = g.h;
    if (g.t === 'move') { begin(); const o = h.t === 'photo' ? photo(h.id) : elev(h.id); g.o = {x: o.x, y: o.y}; C.sel = {t: h.t, id: h.id}; ui(); }
    if (g.t === 'wmove') { begin(); g.w = wall(h.id); g.o = {a: [node(g.w.a).x, node(g.w.a).y], b: [node(g.w.b).x, node(g.w.b).y]}; C.sel = {t: 'wall', id: h.id}; ui(); }
    if (g.t === 'nmove') { begin(); C.sel = {t: 'node', id: h.id}; ui(); }
    if (g.t === 'scale') { begin(); const p = photo(h.id), cs = [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + phH(p)], [p.x, p.y + phH(p)]], A = cs[(h.c + 2) % 4]; g.anchor = {x: A[0], y: A[1]}; g.o = {w: p.w, h: phH(p)}; }
    if (g.t === 'crop' || g.t === 'cropmove') g.cr0 = C.crop ? photo(C.crop.id).cr.slice() : null;
  }
  function oneEnd(p, cancelled) {
    const g = G; G = null;
    if (cancelled) { cancel(); draw(); return; }
    if (!g.moved) { tap(g); return; }
    if (g.t === 'draw') { if (g.b) { const w = addWall(g.a, g.b); if (w) C.sel = {t: 'wall', id: w.id}; } ui(); draw(); return; }
    if (g.t === 'nmove') { const n = node(g.h.id); if (g.snapN && n) { mergeNode(n.id, g.snapN); C.sel = {t: 'node', id: g.snapN}; } }
    if (g.t === 'pan') { viewChanged(); return; }
    commit();
  }
  function tap(g) {
    const h = g.h;
    if (C.crop) return;
    if (h && h.t === 'label') { C.sel = {t: 'wall', id: h.id}; ui(); draw(); openEd(h.id); return; }
    if (C.tool === 'wall') { const hh = hit(g.p0.x, g.p0.y); C.sel = hh && (hh.t === 'wall' || hh.t === 'node') ? {t: hh.t, id: hh.id} : null; ui(); draw(); return; }
    C.sel = h && h.t !== 'ph-h' ? {t: h.t, id: h.id} : (h && h.t === 'ph-h' ? C.sel : null); ui(); draw();
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

  /* ═══ [BLOCK C-EDIT] ввод длины стены — только по касанию подписи ═══ */
  const ed = $('cEd'); let edW = null;
  function openEd(id) {
    const w = wall(id), r = LBL.get(id); if (!w || !r) return; edW = id; const cr = cv.getBoundingClientRect();
    ed.style.left = clamp(cr.left + r.x + r.w / 2 - 48, 4, innerWidth - 100) + 'px'; ed.style.top = clamp(cr.top + r.y - 8, 56, innerHeight - 120) + 'px';
    ed.value = rnd(wLen(w)); ed.style.display = 'block'; ed.focus(); ed.select();
  }
  function closeEd(apply) {
    if (!edW) return; const id = edW; edW = null; ed.style.display = 'none'; ed.blur();
    const v = parseFloat(String(ed.value).replace(',', '.')), w = wall(id); if (apply && w && v > 0 && Math.abs(v - wLen(w)) >= 0.5) setLen(w, v);
    draw();
  }
  ed.addEventListener('keydown', e => { if (e.key === 'Enter') closeEd(true); if (e.key === 'Escape') closeEd(false); });
  ed.addEventListener('blur', () => closeEd(true));

  /* ═══ [BLOCK C-UI] шапка, нижний ряд, контекстные кнопки ═══
     кнопки срабатывают по отпусканию пальца на кнопке (pointerup), а не по click: после щипка WebView может не выдать click */
  function act(el, fn) {
    el.addEventListener('pointerdown', e => { el._pd = e.pointerId; });
    el.addEventListener('pointerup', e => { if (el._pd !== e.pointerId || el.disabled) return; el._pd = null; const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { e.preventDefault(); fn(e); } });
    el.addEventListener('pointercancel', () => { el._pd = null; });
  }
  function ui() {
    document.querySelectorAll('#cTb [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === C.tool));
    $('cUn').disabled = !HS.u.length; $('cRe').disabled = !HS.r.length; $('cDel').disabled = !C.sel || !!C.crop;
    const box = $('cCtx'), s = C.sel, B = []; box.innerHTML = '';
    if (C.phm) B.push(['📷 Камера', () => { C.phm = false; ui(); $('cCam').click(); }, 'pri'], ['🖼 Галерея', () => { C.phm = false; ui(); $('cFile').click(); }]);
    else if (C.crop) B.push(['✓ Готово', cropEnd, 'pri'], ['Весь кадр', cropReset]);
    else if (s && s.t === 'photo') B.push(['✂ Подрезать', cropStart]);
    else if (s && s.t === 'wall') { const w = wall(s.id); if (w) B.push([D.elev.some(e => e.wall === w.id) ? `▭ К стене С${w.gn}` : `▭ Стена С${w.gn} на холст`, () => addElev(w), 'pri'], [`L ${rnd(wLen(w))}`, () => openEd(w.id)]); }
    for (const [t, fn, c] of B) { const b = document.createElement('button'); b.textContent = t; if (c) b.className = c; act(b, fn); box.appendChild(b); }
  }
  document.querySelectorAll('#cTb [data-t]').forEach(b => act(b, () => { if (C.crop) cropEnd(); C.tool = b.dataset.t; ui(); draw(); }));
  act($('cPh'), () => { C.phm = !C.phm; ui(); });
  $('cCam').onchange = e => { const f = e.target.files; addPhotos(f).finally(() => { e.target.value = ''; }); };
  $('cFile').onchange = e => { const f = e.target.files; addPhotos(f).finally(() => { e.target.value = ''; }); };
  act($('cUn'), () => { if (C.crop) cropEnd(); undo(); });
  act($('cRe'), () => { if (C.crop) cropEnd(); redo(); });
  act($('cDel'), del);
  act($('cFit'), fitAll);
  act($('cOk'), () => { closeEd(true); if (C.crop) cropEnd(); save().then(() => toast('Сохранено')); });
  $('cName').onchange = e => { begin(); D.name = e.target.value.trim(); commit(); };
  $('cH').onchange = e => {
    const v = parseInt(e.target.value, 10);
    if (!(v > 0) && D.elev.length) { e.target.value = D.H; toast('H нужна развёрткам стен'); return; }
    e.target.classList.remove('need'); begin(); D.H = v > 0 ? v : ''; commit(); e.target.value = D.H;
  };
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  /* ═══ [BLOCK C-BACK] системная «назад» Android: локальные действия; false — выйти можно ═══ */
  window.AkrixBack = () => {
    if (edW) { closeEd(false); return true; }
    if (C.phm) { C.phm = false; ui(); return true; }
    if (C.crop) { cropEnd(); return true; }
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
  window.MeasureCore = {scaleInfo: () => { let st = 100; while (st * V.s < 14) st *= 10; return {cell: st}; }, get doc() { return D; }, get view() { return V; }, get sel() { return C.sel; }, get tool() { return C.tool; }, get crop() { return C.crop; }, hs: HS, toS, toW, hit, save, fitAll, wLen, phH, elevRect, labels: () => [...LBL].map(([id, r]) => ({id, ...r}))};

  /* ═══ [BLOCK C-INIT] ═══ */
  (async () => {
    try { await dbOpen(); await load(); } catch (e) { console.error(e); D = newDoc(); }
    $('cName').value = D.name; $('cH').value = D.H; resize(); ui();
    window.MeasureCore.ready = true; updReady();
  })();
})();
