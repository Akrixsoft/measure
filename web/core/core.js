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
  const newDoc = () => ({v: 1, id: uid('p'), name: '', H: '', gnHi: 0, photos: [], nodes: [], walls: [], elev: [], dims: [], frames: [], drw: [], com: [], ops: [], rooms: [], found: []});
  let D = null;
  let V = {ox: 40, oy: 60, s: 0.1};                    // вид: px CSS на мм
  const C = {tool: 'sel', mode: 'wall', sel: null, crop: null, phm: false, msel: [], ptsP: null, zdp: [], phHide: false, rt: 'el', cpg: null, ctp: null, opp: null};   // Б2: msel — группа [{t,id}]; ptsP — начатая рамка {ph, q}      // phm — открыт выбор «камера / галерея»      // sel {t:'photo'|'wall'|'node'|'elev', id}
  const node = id => D.nodes.find(n => n.id === id);
  const wall = id => D.walls.find(w => w.id === id);
  const photo = id => D.photos.find(p => p.id === id);
  const elev = id => D.elev.find(e => e.id === id);
  const elOn = e => { const w = e && wall(e.wall); return !!w && !w.off; };   // 82.35.6: развёртка выключенной стены (w.off) не показывается, данные остаются
  const dim = id => D.dims.find(d => d.id === id);
  const frame = id => D.frames.find(f => f.id === id);
  const drw = id => D.drw.find(q => q.id === id);
  const wLen = w => { const a = node(w.a), b = node(w.b); return a && b ? hyp(b.x - a.x, b.y - a.y) : 0; };
  const Hmm = () => (+D.H > 0 ? +D.H : CFG.H);                    // 82.35.5: стен без высоты нет — по умолчанию из настроек
  const wHt = w => (w && +w.H > 0 ? +w.H : Hmm());                 // высота стены: своя (w.H) или общая
  const phH = p => p.w * ((p.cr[3] - p.cr[1]) * p.ih) / ((p.cr[2] - p.cr[0]) * p.iw);
  const elevRect = e => { const w = wall(e.wall); return {x: e.x, y: e.y, w: w ? wLen(w) : 0, h: wHt(w)}; };
  const deg = id => D.walls.filter(w => w.a === id || w.b === id).length;
  function dropOrphans() { D.nodes = D.nodes.filter(n => deg(n.id)); D.elev = D.elev.filter(e => wall(e.wall)); if (D.found) D.found = D.found.filter(f => elev(f.e)); D.frames = D.frames.filter(f => photo(f.ph)); if (D.ops) D.ops = D.ops.filter(o => wall(o.wall)); }

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
    const s = C.sel, F = {photo, wall, node, elev, dim, frame, drw, com: id => D.com.find(c => c.id === id), op: id => D.ops.find(o => o.id === id), room: id => D.rooms.find(r => r.id === id), found: id => D.found.find(f => f.id === id)}; if (s && !F[s.t](s.id)) C.sel = null; C.msel = C.msel.filter(m => F[m.t] && F[m.t](m.id)); C.ptsP = null; C.zdp = [];
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
    D.dims = D.dims || []; D.frames = D.frames || []; D.drw = D.drw || []; D.com = D.com || []; D.ops = D.ops || []; D.rooms = D.rooms || []; D.found = D.found || [];
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
    for (const e of D.elev) { if (!elOn(e)) continue; const r = elevRect(e); add(r.x, r.y - 300); add(r.x + r.w, r.y + r.h); }
    return x0 === Infinity ? null : {x0, y0, x1, y1};
  }
  function fitAll() {
    const b = bounds(); if (!b) return; const m = 28, bw = Math.max(1, b.x1 - b.x0), bh = Math.max(1, b.y1 - b.y0);
    const zf = $('zf'), cvT = cv.getBoundingClientRect().top, mb = zf ? Math.max(m, cvT + cssH() - zf.getBoundingClientRect().top + 14) : m, mt = D.walls.length ? 104 : 56;   // всё (+ строка плоскостей) — между верхними кнопками и нижними строками
    V.s = clamp(Math.min((cssW() - 2 * m) / bw, (cssH() - mt - mb) / bh), 0.005, 5);
    V.fs = V.s; V.ox = (cssW() - bw * V.s) / 2 - b.x0 * V.s; V.oy = mt + (cssH() - mt - mb - bh * V.s) / 2 - b.y0 * V.s; viewChanged();
  }

  /* ═══ [BLOCK C-DRAW] отрисовка: сетка → фото → развёртки → план → выделение ═══ */
  let raf = 0; const LBL = new Map(), ELBL = new Map();          // id стены → прямоугольник подписи (px), для касаний
  function draw() { if (!raf) raf = requestAnimationFrame(paint); }
  const COL = {wall: '#7a3cc8', sel: '#FFD400', node: '#0e7f93', elev: '#223', grid: '#e2e4e7', grid2: '#cfd3d8'};
  function paint() {
    raf = 0; if (!D) return; const d = DPR(), W = cssW(), Hh = cssH();
    cx.setTransform(d, 0, 0, d, 0, 0); cx.fillStyle = '#f6f5f1'; cx.fillRect(0, 0, W, Hh);
    const gst = grid(W, Hh); FPL.length = 0;
    for (const p of D.photos) drawPhoto(p);
    ELBL.clear(); for (const e of D.elev) if (elOn(e)) drawElev(e);
    drawCom();
    drawFound();
    drawRooms();
    drawPlan();
    drawPlanCols();
    drawOps();
    drawDrw();
    drawDims();
    drawFrames();
    drawElevDims();
    drawW3Pts();
    drawOverlay();
    drawGroup();
    scaleBar(W, Hh, gst); try { w3Row(); w3Win(); wHrow(); vwUi(); } catch (x) { }
    cx.font = '600 11px system-ui'; cx.fillStyle = '#8a9099'; cx.textAlign = 'left'; cx.textBaseline = 'bottom'; cx.textBaseline = 'top'; cx.fillText('Measure ' + (window.MeasureVersion || '') + ' · ядро', 6, 6 + topOff());
  }
  function grid(W, Hh) {
    let st = 100; while (st * V.s < 14) st *= 10; if (!CFG.grid) return st;
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
  function scaleBar(W, Hh, st) { cx.font = '600 13px system-ui'; cx.fillStyle = '#8a9099'; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText('□ ' + num(st), 6, 24 + topOff()); }
  const topOff = () => (D && D.walls.length ? 36 : 0) + (D && D.elev.length && C.tool === 'pts' ? 38 : 0);   // + строка плоскостей (4 угла)          // подписи стен — под шапкой, версия и масштаб ниже (владелец 12.11.2026)
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
    const y = col === COL.sel; cx.fillStyle = y ? COL.sel : '#fff'; cx.fillRect(r.x, r.y, r.w, r.h); cx.strokeStyle = y ? '#B89500' : col; cx.lineWidth = 1; cx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    cx.fillStyle = y ? '#1a2027' : col; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, X, Y + 0.5); FPL.push(r); return r;   // поля размеров обходят подписи
  }
  /* 82.35.5: подпись стены плана как поле v81 — по центру линии, вдоль неё, скругление 3, обводка 1,2, без наложения (fPlace) */
  function labelA(t, X, Y, ang, col, L) {
    if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    cx.save(); cx.font = `600 ${Math.round(TXP())}px system-ui`; const th = FLP(), tw = Math.max(th, cx.measureText(t).width + th * 0.55);
    [X, Y] = fPlace(X, Y, tw, th, ang, L); cx.translate(X, Y); cx.rotate(ang); rrect(-tw / 2, -th / 2, tw, th, th * 0.23);
    const y = col === COL.sel; cx.fillStyle = y ? COL.sel : '#fff'; cx.fill(); cx.strokeStyle = y ? '#B89500' : col; cx.lineWidth = 1.2; cx.stroke();
    cx.fillStyle = y ? '#1a2027' : col; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 0, 0.5); cx.restore(); return fbox(X, Y, tw, th, ang);
  }
  function drawPlan() {
    LBL.clear();
    for (const w of D.walls) {
      const a = node(w.a), b = node(w.b); if (!a || !b) continue;
      const on = C.sel && C.sel.t === 'wall' && C.sel.id === w.id, [ax, ay] = toS(a.x, a.y), [bx, by] = toS(b.x, b.y);
      cx.strokeStyle = on ? COL.sel : COL.wall; cx.lineWidth = on ? 6 : 4; cx.lineCap = 'round'; if (w.off) { cx.setLineDash([10, 7]); cx.globalAlpha = on ? 1 : 0.6; }   // развёртка выключена — пунктир
      cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1;
    }
    const R = C.tool === 'wall' ? CFG.pointPx + 1 : CFG.pointPx - 1;
    for (const n of D.nodes) { const [x, y] = toS(n.x, n.y), on = C.sel && C.sel.t === 'node' && C.sel.id === n.id;
      cx.fillStyle = on ? COL.sel : COL.node; cx.beginPath(); cx.arc(x, y, on ? R + 3 : R, 0, 7); cx.fill(); }
    for (const w of D.walls) {                                  // подписи — поверх, сбоку от стены
      const a = node(w.a), b = node(w.b); if (!a || !b) continue;
      const [ax, ay] = toS(a.x, a.y), [bx, by] = toS(b.x, b.y), L = hyp(bx - ax, by - ay); if (L < 24) continue;
      const nx = -(by - ay) / L, ny = (bx - ax) / L, on = C.sel && C.sel.t === 'wall' && C.sel.id === w.id;
      const ed = KB.tg && KB.tg.t === 'wall' && KB.tg.id === w.id;
      LBL.set(w.id, labelA(ed ? `С${w.gn}  ${KB.buf || ' '}▏` : `С${w.gn}`,   /* 82.35.8: на плане — только обозначение, длина — на развёртке */ (ax + bx) / 2, (ay + by) / 2, Math.atan2(by - ay, bx - ax), on ? COL.sel : COL.wall, hyp(bx - ax, by - ay)));
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
  const COLD = {line: '#1b1e23', sel: '#FFD400', none: '#d0342c'};   // 82.35: выбранное — ярко-жёлтым (владелец 12.11)
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
  function drawDims() {                                          // 82.35: цвет размера — свой (d.c), выбранный — жёлтым; поле v81: по центру стрелки, вдоль неё, скруглённое
    DLBL.clear(); if (!LAY.dim) return; const act = dimAct();
    for (const d of D.dims) {
      if (act && !dimOn(d, act)) continue; { const q = surf(d.a) || surf(d.b); if (q && q.startsWith('e:') && !elOn(elev(q.slice(2)))) continue; }
      const A = endPos(d.a), B = endPos(d.b), [ax, ay] = toS(A.x, A.y), [bx, by] = toS(B.x, B.y), L = hyp(bx - ax, by - ay); if (L < 2) continue;
      const on = C.sel && C.sel.t === 'dim' && C.sel.id === d.id, ux = (bx - ax) / L, uy = (by - ay) / L, col = on ? COLD.sel : d.c || COLD.line;
      cx.strokeStyle = col; cx.fillStyle = col; cx.lineWidth = dimLW(on); cx.beginPath(); cx.moveTo(ax, ay); cx.lineTo(bx, by); cx.stroke();
      const hl = zLW(CFG.arrowPx); head(bx, by, ux, uy, hl); if (d.k !== 'arr' && d.t !== 'one') head(ax, ay, -ux, -uy, hl);
      const val = dimVal(d), edit = KB.tg && KB.tg.t === 'dim' && KB.tg.id === d.id, t = edit ? (KB.buf || ' ') + '▏' : val.kind === 'man' ? val.txt : '?';   // 82.35.14: невведённый — «?»
      let ang = Math.atan2(by - ay, bx - ax); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      const fq = edit || on ? 1 : fk(); if (TXP() * fq < 5) continue;   // 82.35.14: поле — в масштабе холста, нечитаемое скрыто
      cx.font = `700 ${TXP() * fq}px system-ui`; const fh = FLP() * fq, tw = Math.max(fh, cx.measureText(t).width + fh * 0.55);
      const [cxp, cyp] = fPlace((ax + bx) / 2, (ay + by) / 2, tw, fh, ang, L);
      const fc = edit ? '#c99a1e' : val.kind === 'man' ? '#1a2027' : val.kind === 'geo' ? '#d93025' : '#8a9099';   // введённый — чёрный, авто — красный, ≈ по фото — серый
      cx.save(); cx.translate(cxp, cyp); cx.rotate(ang); rrect(-tw / 2, -fh / 2, tw, fh, fh * 0.23);
      cx.fillStyle = edit ? '#fff7d1' : '#fff'; cx.fill(); cx.strokeStyle = on ? COLD.sel : fc; cx.lineWidth = on ? 2.4 : 1.2; cx.setLineDash(val.kind === 'man' || edit || on ? [] : [3, 2]); cx.stroke(); cx.setLineDash([]);
      cx.fillStyle = fc; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 0, 0.5); cx.restore();
      DLBL.set(d.id, {x: cxp, y: cyp, r: Math.max(tw / 2, 14) + 6});
      /* маркеров на концах нет (владелец 12.11): выбранный — только цветом; конец берётся пальцем в радиусе касания */
    }
  }
  /* «Размеры: все стены / только активная» (v81): активная — выбранная развёртка или стена выбранного объекта; ничего не выбрано — все */
  function dimAct() { if (!CFG.dimAct) return null; const s = C.sel; if (!s) return null;
    if (s.t === 'elev') return s.id; if (s.t === 'com') { const c = com(s.id); return c ? c.e : null; }
    if (s.t === 'dim') { const d = dim(s.id), q = d && (surf(d.a) || surf(d.b)); return q && q.startsWith('e:') ? q.slice(2) : null; } return null; }
  const dimOn = (d, act) => { const q = surf(d.a) || surf(d.b); return !q || q === 'plan' || q === 'e:' + act; };
  /* привязка конца размера: точка (узел, угол фото/развёртки, конец размера) → грань (стена, край развёртки/фото) → поверхность (фото, развёртка) → свободно */
  /* ∟ у размера / стрелки (82.35.2): конец строго по горизонтали / вертикали от начала; привязка к точке — только её координата вдоль оси (точка не на оси — свободный конец на оси) */
  function snapDim(sx, sy, skipDim, from) {
    const r = snapDim0(sx, sy, skipDim, from); if (!from || !r) return r;
    const A = endPos(from), q0 = toW(sx, sy), L = md('L'), hz = Math.abs(q0.x - A.x) >= Math.abs(q0.y - A.y);
    const sA = surf(from), e = sA && sA.startsWith('e:') ? elev(sA.slice(2)) : null;
    let Q = L ? (hz ? {x: q0.x, y: A.y} : {x: A.x, y: q0.y}) : null;
    /* ═══ [BLOCK DIM-SWING] 82.35.20: размер / стрелка от точки коммуникации — по направлению взмаха до ближайшей грани (край стены, грань объекта) ═══ */
    const fc = from.t === 'com' && com(from.id), fpt = fc && CK[fc.k] && CK[fc.k].pt;
    if (e && md('sn') && fpt && hyp((q0.x - A.x) * V.s, (q0.y - A.y) * V.s) > 12) {
      const R = elevRect(e), fx = [R.x, R.x + R.w], fy = [R.y, R.y + R.h];
      for (const c of D.com) { if (c.e !== e.id || !CK[c.k].rc) continue; const b = cRect(c); if (!b) continue; const X0 = R.x + b.x, X1 = X0 + b.w, Y0 = R.y + R.h - b.y - b.h, Y1 = Y0 + b.h;
        if (hz && A.y >= Y0 - 0.5 && A.y <= Y1 + 0.5) fx.push(X0, X1); if (!hz && A.x >= X0 - 0.5 && A.x <= X1 + 0.5) fy.push(Y0, Y1); }
      const sg = Math.sign(hz ? q0.x - A.x : q0.y - A.y), cand = (hz ? fx.map(X => X - A.x) : fy.map(Y => Y - A.y)).filter(d => d * sg > 0.5).sort((u, v) => Math.abs(u) - Math.abs(v));
      if (cand.length) return surfAt(hz ? {x: A.x + cand[0], y: A.y} : {x: A.x, y: A.y + cand[0]}); }
    /* ═══ [/BLOCK DIM-SWING] ═══ */
    if (L) { const P = endPos(r); if (hz ? Math.abs(P.y - A.y) < 0.5 : Math.abs(P.x - A.x) < 0.5) return r; }   // точка на оси — привязка к ней
    if (e && md('sn')) {                                         // 82.35.3: грани стены и объёмов (колонна, короб…) — привязка размера / стрелки «до грани»
      const R = elevRect(e), q = Q || q0, out = q.x < R.x || q.x > R.x + R.w || q.y < R.y || q.y > R.y + R.h;
      if (out) { const dx = q.x - A.x, dy = q.y - A.y; let t = 1;   // за краем стены — конец на её грани
        if (dx) for (const X of [R.x, R.x + R.w]) { const k = (X - A.x) / dx; if (k > 0 && k < t) t = k; }
        if (dy) for (const Y of [R.y, R.y + R.h]) { const k = (Y - A.y) / dy; if (k > 0 && k < t) t = k; }
        return surfAt({x: A.x + dx * t, y: A.y + dy * t}); }
      if (L) { const fx = [R.x, R.x + R.w], fy = [R.y, R.y + R.h];
        for (const c of D.com) { if (c.e !== e.id || !CK[c.k].rc) continue; const b = cRect(c); if (!b) continue; const X0 = R.x + b.x, X1 = X0 + b.w, Y0 = R.y + R.h - b.y - b.h, Y1 = Y0 + b.h;
          if (hz && A.y >= Y0 - 0.5 && A.y <= Y1 + 0.5) fx.push(X0, X1); if (!hz && A.x >= X0 - 0.5 && A.x <= X1 + 0.5) fy.push(Y0, Y1); }
        let bd = 24, best = null;
        if (hz) for (const X of fx) { const d = Math.abs(toS(X, 0)[0] - sx); if (d < bd) { bd = d; best = {x: X, y: A.y}; } }
        else for (const Y of fy) { const d = Math.abs(toS(0, Y)[1] - sy); if (d < bd) { bd = d; best = {x: A.x, y: Y}; } }
        if (best) return surfAt(best); }
    }
    if (L && (r.t === 'com' || r.t === 'node')) { const P = endPos(r); Q = hz ? {x: P.x, y: A.y} : {x: A.x, y: P.y}; }   // точка в стороне — её координата по оси
    return L ? surfAt(Q) : r;
  }
  function snapDim0(sx, sy, skipDim, from) {
    let best = null, bd = 20; const q0 = toW(sx, sy);
    if (!md('sn')) { const q = from ? lineSnap(endPos(from), q0) : q0; return surfAt(q); }   // 🧲 выкл — без привязки
    const pt = (x, y, e) => { const [X, Y] = toS(x, y), dd = hyp(X - sx, Y - sy); if (dd < bd) { bd = dd; best = {...e, x: rnd(x * 10) / 10, y: rnd(y * 10) / 10}; } };
    for (const n of D.nodes) pt(n.x, n.y, {t: 'node', id: n.id});
    for (const o of D.elev) { if (!elOn(o)) continue; const r = elevRect(o); [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v]) => pt(r.x + r.w * u, r.y + r.h * v, {t: 'elev', id: o.id, u, v})); }
    for (const e of comSnapPts()) { const P = comEnd(e); if (P) pt(P.x, P.y, e); }
    for (const d of D.dims) if (d.id !== skipDim) for (const e of [d.a, d.b]) if (e.t === 'node' || e.t === 'wall' || e.t === 'elev') { const P = endPos(e); pt(P.x, P.y, {...e}); }
    if (best) return best;                                       // геометрия плана и развёрток важнее углов фото
    for (const p of D.photos) { const F = phFull(p); [[p.cr[0], p.cr[1]], [p.cr[2], p.cr[1]], [p.cr[2], p.cr[3]], [p.cr[0], p.cr[3]]].forEach(([u, v]) => pt(F.x + F.w * u, F.y + F.h * v, {t: 'photo', id: p.id, u, v})); }
    for (const d of D.dims) if (d.id !== skipDim) for (const e of [d.a, d.b]) if (!(e.t === 'node' || e.t === 'wall' || e.t === 'elev')) { const P = endPos(e); pt(P.x, P.y, {...e}); }
    if (best) return best;
    bd = 14; const seg = (A, B, mk) => { const [ax, ay] = toS(A.x, A.y), [bx, by] = toS(B.x, B.y), dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; if (!L2) return;
      const t = clamp(((sx - ax) * dx + (sy - ay) * dy) / L2, 0, 1), dd = hyp(ax + dx * t - sx, ay + dy * t - sy); if (dd < bd) { bd = dd; best = mk(t, A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t); } };
    for (const w of D.walls) { const a = node(w.a), b = node(w.b); if (a && b) seg(a, b, (t, x, y) => ({t: 'wall', id: w.id, s: t, x, y})); }
    for (const o of D.elev) { if (!elOn(o)) continue; const r = elevRect(o), C4 = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (let i = 0; i < 4; i++) { const [u0, v0] = C4[i], [u1, v1] = C4[(i + 1) % 4]; seg({x: r.x + r.w * u0, y: r.y + r.h * v0}, {x: r.x + r.w * u1, y: r.y + r.h * v1}, (t, x, y) => ({t: 'elev', id: o.id, u: u0 + (u1 - u0) * t, v: v0 + (v1 - v0) * t, x, y})); } }
    if (best) return best;
    let q = q0;
    if (from) { const A = endPos(from); q = lineSnap(A, q); }
    return surfAt(q);
  }
  function surfAt(q) {
    for (let i = D.elev.length - 1; i >= 0; i--) { const o = D.elev[i], r = elevRect(o); if (elOn(o) && r.w && r.h && q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return {t: 'elev', id: o.id, u: (q.x - r.x) / r.w, v: (q.y - r.y) / r.h, x: q.x, y: q.y}; }
    if (!C.phHide) for (let i = D.photos.length - 1; i >= 0; i--) { const p = D.photos[i]; if (q.x >= p.x && q.x <= p.x + p.w && q.y >= p.y && q.y <= p.y + phH(p)) { const F = phFull(p); return {t: 'photo', id: p.id, u: (q.x - F.x) / F.w, v: (q.y - F.y) / F.h, x: q.x, y: q.y}; } }
    return {t: 'free', x: rnd(q.x * 10) / 10, y: rnd(q.y * 10) / 10};
  }
  function addDim(a, b) {
    const A = endPos(a), B = endPos(b); if (hyp(B.x - A.x, B.y - A.y) * V.s < 12) return null;
    begin(); const d = {id: uid('d'), k: C.tool === 'arr' ? 'arr' : 'dim', a, b, v: '', c: C.col}; if (d.k === 'dim' && !md('t')) d.t = 'one'; D.dims.push(d); commit(); setDir(A, B); return d;
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
    toast(`Стена С${w.gn}: ${rnd(L)} × ${H} · фото — под рамку`); recognize(f);
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
  /* ═══ [BLOCK C-CFG] 82.35: «Настройки Measure Lab» 82.18 на ядре. Толщина линий — LW ядра (одно значение с футляром); текст и поля × Aa (W3.f);
     наконечники и точки привязки — px экрана; толщина от масштаба мягко (zLW v81: ^0,35 в пределах ×0,6…×2 от «всё»).
     Общая привязка и «повторять инструмент» 82.18 не переносятся: в ядре 🧲 у каждого инструмента, инструмент не сбрасывается. ═══ */
  const CFG0 = {textPx: 13, fieldPx: 22, arrowPx: 9, pointPx: 5, grid: true, side: true, dimAct: false, H: 2700};
  const CFGR = {textPx: [6, 28], fieldPx: [10, 64], arrowPx: [4, 20], pointPx: [2, 12], H: [1000, 9000]};
  const CFG = (() => { const o = {...CFG0}; try { Object.assign(o, JSON.parse(localStorage.getItem('akx-core-cfg') || '{}')); } catch (e) { }
    for (const k in CFGR) o[k] = Math.max(CFGR[k][0], Math.min(CFGR[k][1], +o[k] || CFG0[k])); return o; })();
  const cfgSv = () => { try { localStorage.setItem('akx-core-cfg', JSON.stringify(CFG)); } catch (e) { } };
  const zLW = w => { const z = V.fs ? V.s / V.fs : 1; return Math.max(w * 0.6, Math.min(w * 2, w * Math.pow(z, 0.35))); };
  /* ═══ [BLOCK FSCALE] 82.35.14: поле размера масштабируется с холстом — полный размер при V.s ≥ FS0 (≈ 2× стена на экран), меньше — пропорционально, не длиннее своей грани, нечитаемое (< 5 px) скрыто; невведённый размер — «?» ═══ */
  const FS0 = 0.3, fk = () => Math.min(1, V.s / FS0), FHID = {x: -1e5, y: -1e5, w: 0, h: 0};
  function fkE(t, L) { let k = fk(); if (L > 0) { cx.save(); cx.font = `700 ${TXP()}px system-ui`; const tw = Math.max(FLP(), cx.measureText(t).width + FLP() * 0.55); cx.restore(); k = Math.min(k, L * 0.6 / tw); } return k; }   // поле лежит на грани: не длиннее 60 % её длины — у угла не сходится с соседним
  /* ═══ [/BLOCK FSCALE] ═══ */
  const TXP = () => Math.max(6, CFG.textPx * W3.f), FLP = () => Math.max(10, CFG.fieldPx * W3.f, TXP() + 2);
  const dimLW = sel => zLW(1.6 * LW.v / 3) * (sel ? 1.5 : 1);
  /* поля без наложения (w3Place v81, упрощённо): центр → вдоль линии в её пределах → поперёк (h/2+2, h+6) с обеих сторон; FPL — занятые за кадр */
  const FPL = [];
  const fbox = (X, Y, w, h, a) => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), W = w * c + h * s, H = w * s + h * c; return {x: X - W / 2, y: Y - H / 2, w: W, h: H}; };
  const fhit = b => FPL.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  function fPlace(X, Y, w, h, a, L) {
    const ex = Math.cos(a), ey = Math.sin(a), nx = -ey, ny = ex, sm = Math.max(0, (L || 0) / 2 - w / 2 - 2), st = Math.max(6, h * 0.6), al = [0];
    for (let x = st; x < sm; x += st) al.push(x, -x); if (sm > 0) al.push(sm, -sm);
    const ax = al.concat([L / 2 + w / 2 + 6, -(L / 2 + w / 2 + 6)]);   // за концом линии — последним
    for (const p of [0, h / 2 + 2, -(h / 2 + 2), h + 6, -(h + 6), 2 * h + 8, -(2 * h + 8)]) for (const x of ax) { const P = [X + ex * x + nx * p, Y + ey * x + ny * p], b = fbox(P[0], P[1], w, h, a); if (!fhit(b)) { FPL.push(b); return P; } }
    FPL.push(fbox(X, Y, w, h, a)); return [X, Y];
  }
  function rrect(x, y, w, h, r) { cx.beginPath(); if (cx.roundRect) cx.roundRect(x, y, w, h, r); else cx.rect(x, y, w, h); }
  const TBOX = new Map();                                        // id → прямоугольник подписи (px) — текст, пин, выноска
  function hostAt(q) {
    for (let i = D.elev.length - 1; i >= 0; i--) { const o = D.elev[i], r = elevRect(o); if (elOn(o) && r.w && r.h && q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return {t: 'elev', id: o.id}; }
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
    const h = hostAt(W[0]); begin(); const z = zo(k), q = {id: uid('g'), k, c: C.col, h, p: [], ...(z.dash ? {dash: 1} : {}), ...(z.fill && (k === 'rect' || k === 'circ') ? {fill: 1} : {}), ...(z.rnd && k === 'rect' ? {rnd: 1} : {}), ...o}; if (k === 'ln') setDir(W[0], W[1]); drwSet(q, W); D.drw.push(q); C.sel = /^(txt|pin|note|vyn)$/.test(k) ? {t: 'drw', id: q.id} : null; commit(); return q;   // 82.35.1: нарисованное не остаётся выделенным (текст — для ввода)
  }
  const snap90 = (A, q) => { const dx = q.x - A.x, dy = q.y - A.y; return Math.abs(dx) >= Math.abs(dy) ? {x: q.x, y: A.y} : {x: A.x, y: q.y}; };   // ∟ — строго 0 / 90° (82.35.2; было: только в пределах 6°)
  function circ3(A, B, Cc) {                                     // окружность через 3 точки (px) — как zdCirc3 v81
    const d = 2 * (A[0] * (B[1] - Cc[1]) + B[0] * (Cc[1] - A[1]) + Cc[0] * (A[1] - B[1])); if (Math.abs(d) < 1e-6) return null;
    const a2 = A[0] * A[0] + A[1] * A[1], b2 = B[0] * B[0] + B[1] * B[1], c2 = Cc[0] * Cc[0] + Cc[1] * Cc[1];
    const x = (a2 * (B[1] - Cc[1]) + b2 * (Cc[1] - A[1]) + c2 * (A[1] - B[1])) / d, y = (a2 * (Cc[0] - B[0]) + b2 * (A[0] - Cc[0]) + c2 * (B[0] - A[0])) / d;
    return {x, y, r: hyp(A[0] - x, A[1] - y), ccw: (B[0] - A[0]) * (Cc[1] - A[1]) - (B[1] - A[1]) * (Cc[0] - A[0]) < 0};
  }
  function drwShape(k, S, q, c, w, sel) {                        // S — точки px
    cx.strokeStyle = c; cx.fillStyle = c; cx.lineWidth = w; cx.lineJoin = 'round'; cx.lineCap = 'round'; cx.setLineDash(q.dash ? [8, 5] : []);
    if (k === 'pen' || k === 'pl' || k === 'ln') { cx.beginPath(); S.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.stroke(); }
    else if (k === 'rect') { const [A, B] = S, x0 = Math.min(A[0], B[0]), y0 = Math.min(A[1], B[1]), w0 = Math.abs(B[0] - A[0]), h0 = Math.abs(B[1] - A[1]); cx.beginPath(); if (q.rnd && cx.roundRect) cx.roundRect(x0, y0, w0, h0, Math.min(14, w0 / 4, h0 / 4)); else cx.rect(x0, y0, w0, h0); if (q.fill) { cx.globalAlpha = 0.25; cx.fill(); cx.globalAlpha = 1; } cx.stroke(); }
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
    else if (g.t === 'zd2') { g.b = C.tool === 'ln' ? lineSnap(g.a, q) : (C.tool === 'rect' && md('sq')) ? sqr(g.a, q) : q; draw(); }
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
      C.zdp.push(C.zdp.length ? (md('L') ? snap90(C.zdp[C.zdp.length - 1], q) : q) : q); ui(); draw(); return true; }
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
    wire: {n: 'провод', c: '#7b3fc4', pt: 1}, rv: {n: 'розетка + выключатель', c: '#f0a020', pt: 1, ps: 1},   // rv (82.35): последний пост — выключатель
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
  function postsW(c) { const R = elevRect(elev(c.e)), N = Math.max(1, Math.min(5, c.N || 1)), st = N > 1 ? PSTEP : 0, v = c.o === 'v'; return [...Array(N)].map((_, i) => ({x: v ? c.x : c.x + i * st, y: v ? c.y + i * st : c.y, R})); }   // ↕ (c.o = 'v', 82.35) — посты вверх   // x, y — центр первого подрозетника, посты вправо с шагом 71 (82.14)
  function elevOf(sx, sy) { const q = toW(sx, sy); for (let i = D.elev.length - 1; i >= 0; i--) { const o = D.elev[i], r = elevRect(o); if (r.w && r.h && q.x >= r.x && q.x <= r.x + r.w && q.y >= r.y && q.y <= r.y + r.h) return o; } return null; }
  const OFL = new Map();                                         // подписи отступов выбранного: [{id, side, r}]
  function drawCom() {
    OFL.clear();
    for (const c of D.com) {
      if (!comLay(c)) continue;
      const e = elev(c.e); if (!e) continue; const R = elevRect(e), K = CK[c.k] || CK.roz, sel = (C.sel && C.sel.t === 'com' && C.sel.id === c.id) || inMsel('com', c.id), col = sel ? COL.sel : K.c;
      if (K.pt) { const z = Math.max(1, PTS(c.k) * V.s), P = postsW(c).map(q => w2s(R, q.x, q.y)), im = ico(c.k);   // 82.35.22: в габаритах 71/60 мм на любом масштабе — значки на местах постов
        const sp = P.length > 1 ? hyp(P[1][0] - P[0][0], P[1][1] - P[0][1]) : 0, Q = sp >= z || P.length < 2 ? P : P.map((_, i) => { const m = w2s(R, c.x, c.y); return c.o === 'v' ? [m[0], m[1] - i * z * 0.84] : [m[0] + i * z * 0.84, m[1]]; });
        if (sel) { const xs = Q.map(q => q[0]), ys = Q.map(q => q[1]), bx = Math.min(...xs) - z / 2 - 3, by = Math.min(...ys) - z / 2 - 3, bw = Math.max(...xs) - Math.min(...xs) + z + 6, bh = Math.max(...ys) - Math.min(...ys) + z + 6;
          cx.fillStyle = COL.sel; cx.strokeStyle = '#B89500'; cx.lineWidth = 1.5; cx.fillRect(bx, by, bw, bh); cx.strokeRect(bx, by, bw, bh); }   // 82.35: малый объект — целиком жёлтым
        FPL.push(...Q.map(([x, y]) => ({x: x - z / 2, y: y - z / 2, w: z, h: z})));   // поля размеров обходят значки точек
        Q.forEach(([x, y], i) => { const ik = c.k === 'rv' ? (i === Q.length - 1 ? ico('vyk') : ico('roz')) : im; if (ik) cx.drawImage(ik, x - z / 2, y - z / 2, z, z); else { cx.fillStyle = col; cx.beginPath(); cx.arc(x, y, z / 3, 0, 7); cx.fill(); } });
        continue; }
      if (K.ln) { const T = rtt(c.t), A = w2s(R, c.a[0], c.a[1]), B = w2s(R, c.b[0], c.b[1]); cx.strokeStyle = sel ? COL.sel : T[3]; cx.lineWidth = sel ? 4 : 3; cx.setLineDash(T[4]); cx.lineCap = 'butt';
        cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); cx.setLineDash([]);
        cx.font = '700 11px system-ui'; const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, tw = cx.measureText(T[2]).width + 6; cx.fillStyle = '#fff'; cx.fillRect(mx - tw / 2, my - 8, tw, 16); cx.fillStyle = T[3]; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(T[2], mx, my + 0.5);
        if (sel) for (const [x, y] of [A, B]) { cx.fillStyle = '#fff'; cx.strokeStyle = COL.sel; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); cx.stroke(); }
        continue; }
      if (K.pg) { const P = c.pts.map(t => w2s(R, t[0], t[1])); cx.beginPath(); P.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath(); cx.fillStyle = K.c + '33'; cx.fill(); cx.strokeStyle = col; cx.lineWidth = sel ? 2.6 : 2; cx.setLineDash([6, 4]); cx.stroke(); cx.setLineDash([]);
        if (sel) for (const [x, y] of P) { cx.fillStyle = '#fff'; cx.strokeStyle = COL.sel; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, 6, 0, 7); cx.fill(); cx.stroke(); }
        continue; }
      const vf = K.D && volFaces(c);
      if (vf) { const pg = (Q, f, st, lw) => { cx.beginPath(); Q.forEach(([qx, qy], i) => (i ? cx.lineTo(qx, qy) : cx.moveTo(qx, qy))); cx.closePath(); cx.fillStyle = f; cx.fill(); cx.strokeStyle = st; cx.lineWidth = lw; cx.stroke(); };
        for (const f of vf.F) pg(f.q, K.c + (f.k === 't' ? '44' : '66'), sel ? COL.sel : K.c, sel ? 2.4 : 1.4);
        { const P = (x, y, z) => w3P(vf.R, x, y, z), B = [P(vf.x0, vf.y1, 0), P(vf.x1, vf.y1, 0), P(vf.x1, vf.y0, 0), P(vf.x0, vf.y0, 0)], Fq = vf.front;   // 82.35.12: примыкание к стене и рёбра глубины — всегда видны
          cx.save(); cx.strokeStyle = sel ? COL.sel : K.c; cx.lineWidth = 1.2; cx.setLineDash([5, 3]); cx.beginPath(); B.forEach(([x, y], i) => (i ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath();
          for (let i = 0; i < 4; i++) { cx.moveTo(B[i][0], B[i][1]); cx.lineTo(Fq[i][0], Fq[i][1]); } cx.stroke(); cx.restore(); }
        pg(vf.front, K.c + '2a', sel ? COL.sel : K.c, sel ? 2.8 : 1.6);   // 82.35.3: объём — гранями, не пунктиром
        if (sel && C.sel && C.sel.id === c.id) for (const [x, y] of vf.front) { cx.fillStyle = COL.sel; cx.fillRect(x - 5, y - 5, 10, 10); }
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
    if (K.pt) { const z = Math.max(24, PTS(c.k) * V.s), P = postsW(c).map(q => w2s(R, q.x, q.y)); const xs = P.map(q => q[0]), ys = P.map(q => q[1]); return {box: [Math.min(...xs) - z / 2, Math.min(...ys) - z / 2, Math.max(...xs) + z / 2, Math.max(...ys) + z / 2]}; }
    if (K.ln) return {line: [w2s(R, c.a[0], c.a[1]), w2s(R, c.b[0], c.b[1])]};
    if (K.pg) return {poly: c.pts.map(t => w2s(R, t[0], t[1]))};
    { const vf = K.D && volFaces(c); if (vf) { const xs = vf.front.map(q => q[0]), ys = vf.front.map(q => q[1]); return {box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]}; } }
    const r = cRect(c), A = w2s(R, r.x, r.y + r.h), B = w2s(R, r.x + r.w, r.y); return {box: [A[0], A[1], B[0], B[1]]};
  }
  function comAt(sx, sy) { for (let i = D.com.length - 1; i >= 0; i--) { const c = D.com[i], g = comLay(c) && comPx(c); if (g && g.box && sx >= g.box[0] && sx <= g.box[2] && sy >= g.box[1] && sy <= g.box[3]) return {t: 'com', id: c.id}; } return null; }
  function B4hit(sx, sy) {
    { const hf = foundHit(sx, sy); if (hf) return hf; }
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
    const i = pts.findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (i >= 0) return {t: 'com-h', id, i};
    if (K.rc) { const [x0, y0, x1, y1] = g.box, tl = Math.min(12, (x1 - x0) / 4, (y1 - y0) / 4), inX = sx > x0 && sx < x1, inY = sy > y0 && sy < y1;   // 82.35.22: за грань — тянется одна сторона
      const e = inX && Math.abs(sy - y0) < tl ? 4 : inY && Math.abs(sx - x1) < tl ? 5 : inX && Math.abs(sy - y1) < tl ? 6 : inY && Math.abs(sx - x0) < tl ? 7 : -1; if (e >= 0) return {t: 'com-h', id, i: e}; }
    return null;
  }
  function comBoxW(c) { const g = comPx(c); if (!g) return null; if (g.line) return {seg: g.line.map(([x, y]) => toW(x, y))}; if (g.poly) return {poly: g.poly.map(([x, y]) => toW(x, y))}; const a = toW(g.box[0], g.box[1]), b = toW(g.box[2], g.box[3]); return {x0: a.x, y0: a.y, x1: b.x, y1: b.y}; }
  function comNew(k, e, o) { begin(); const c = {id: uid('c'), k, e: e.id, ...o}; D.com.push(c); C.sel = null; commit(); return c; }   // 82.35.1: после рисования — без выделения
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
    if (g.t === 'cmove') { begin(); const c = com(g.h.id); for (const k of ['fpx', 'fpy', 'fpxh', 'fpyh']) delete c[k]; g.o = clone(c); const r = cRect(c); if (r && (c.ex || c.ey)) { g.o.x = r.x; g.o.y = r.y; delete c.ex; delete c.ey; } C.sel = {t: 'com', id: c.id}; ui(); }
    if (g.t === 'cres') { begin(); const c = com(g.h.id); const r = cRect(c); if (r && CK[c.k].rc) { c.x = r.x; c.y = r.y; delete c.ex; delete c.ey; } g.o = clone(c); C.sel = {t: 'com', id: c.id}; ui(); }
  }
  function B4move(g, p, q) {
    if (g.t === 'cdraw') { const R = elevRect(elev(g.e)); let b = md('sn') || !CK[C.tool].ln ? snapE(R, s2w(R, p.x, p.y)) : s2w(R, p.x, p.y); if (CK[C.tool].rc && md('sq')) { const dx = b.x - g.a.x, dy = b.y - g.a.y, m = Math.max(Math.abs(dx), Math.abs(dy)); b = {x: g.a.x + Math.sign(dx || 1) * m, y: g.a.y + Math.sign(dy || 1) * m}; }
      if (CK[C.tool].ln && md('L')) { const dx = b.x - g.a.x, dy = b.y - g.a.y, m = ((Math.atan2(dy, dx) * 180 / Math.PI) % 90 + 90) % 90; if (m < 6 || m > 84) b = Math.abs(dx) >= Math.abs(dy) ? {x: b.x, y: g.a.y} : {x: g.a.x, y: b.y}; } g.b = b; draw(); return true; }
    if (g.t === 'cmove') { const c = com(g.h.id), e = elev(c.e), R = elevRect(e), w0 = s2w(R, g.p0.x, g.p0.y), w1 = s2w(R, p.x, p.y), dx = rnd(w1.x - w0.x), dy = rnd(w1.y - w0.y), o = g.o, K = CK[c.k];
      if (K.ln) { c.a = [o.a[0] + dx, o.a[1] + dy]; c.b = [o.b[0] + dx, o.b[1] + dy]; } else if (K.pg) c.pts = o.pts.map(t => [t[0] + dx, t[1] + dy]); else { c.x = o.x + dx; c.y = o.y + dy;
        const r0 = cRect(c), sn = K.rc ? objSnap(c, R, [[r0.x], [r0.x + r0.w]], [[r0.y], [r0.y + r0.h]]) : objSnap(c, R, [[c.x]], [[c.y]]);   /* привязка к краям стены и граням других (замечание 4) */
        if (sn.dx != null) c.x = rnd(c.x + sn.dx); if (sn.dy != null && c.k !== 'kol') c.y = rnd(c.y + sn.dy); }
      draw(); return true; }
    if (g.t === 'cres') { const c = com(g.h.id), R = elevRect(elev(c.e)), w0 = s2w(R, p.x, p.y), sn = objSnap(c, R, [[w0.x]], [[w0.y]]), w = {x: w0.x + (sn.dx || 0), y: w0.y + (sn.dy || 0)}, K = CK[c.k], o = g.o, X = rnd(w.x), Y = rnd(w.y);
      if (K.ln) c[g.h.i ? 'b' : 'a'] = [X, Y]; else if (K.pg) c.pts[g.h.i] = [X, Y];
      else { const i = g.h.i, xl = i === 0 || i === 3 || i === 7 ? X : o.x, xr = i === 1 || i === 2 || i === 5 ? X : o.x + o.w, yt = i === 0 || i === 1 || i === 4 ? Y : o.y + o.h, yb = i === 2 || i === 3 || i === 6 ? Y : o.y;   // 4–7: грани верх / право / низ / лево
        c.x = Math.min(xl, xr); c.w = Math.max(10, Math.abs(xr - xl)); c.y = Math.min(yb, yt); c.h = Math.max(10, Math.abs(yt - yb)); }
      draw(); return true; }
    return false;
  }
  function B4end(g) {
    if (g.t !== 'cdraw') return false; const K = CK[C.tool]; if (!g.b) return true; const e = elev(g.e); if (!e) return true;
    const d = hyp(g.b.x - g.a.x, g.b.y - g.a.y) * V.s; if (d < 12) return true;
    if (K.ln) { comNew(C.tool, e, {a: [rnd(g.a.x), rnd(g.a.y)], b: [rnd(g.b.x), rnd(g.b.y)], t: C.rt}); LASTDIR = Math.atan2(-(g.b.y - g.a.y), g.b.x - g.a.x); }
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
    if (K.pt) B.push([`<span class="opt on" style="font-size:12px">${esc(K.n.split(' ')[0])} ▾</span>`, () => ptKind(c), 'Вид точки: ' + K.n]);
    if (K.ps) B.push([`<span class="opt on">${c.o === 'v' ? '↕' : '↔'}</span>`, () => { begin(); if (c.o === 'v') delete c.o; else c.o = 'v'; commit(); ui(); draw(); }, 'Посты: горизонтально ↔ / вертикально ↕']);
    if (c.k === 'roz' || c.k === 'rv') B.push([`<span class="opt${c.k === 'rv' ? ' on' : ''}">+⏻</span>`, () => { begin(); if (c.k === 'rv') { c.k = 'roz'; c.N = Math.max(1, (c.N || 2) - 1); } else { c.k = 'rv'; c.N = Math.min(5, (c.N || 1) + 1); } if (c.N === 1) delete c.N; commit(); ui(); draw(); }, 'Розетка + выключатель (один блок)']);
    if (K.ps) B.push([`<span class="opt on">${c.N || 1} ▾</span>`, () => ptPosts(c), 'Количество постов: ' + (c.N || 1) + ' (шаг 71 мм)']);   // 82.35.20: одна кнопка со списком
    if (K.ln) { const T = rtt(c.t); B.push([`<span class="opt on" style="color:${T[3]}">${T[2]}</span>`, () => { begin(); const i = RTT.findIndex(r => r[0] === c.t); c.t = RTT[(i + 1) % RTT.length][0]; C.rt = c.t; commit(); ui(); toast('Трасса: ' + rtt(c.t)[1]); }, 'Тип трассы: ' + T[1]]); }
    if (K.rc && c.k !== 'kol') B.push(['<span class="opt on" style="font-size:11px">W×H</span>', () => { openKb('cW', c.id); KB.after = () => setTimeout(() => { if (com(c.id)) { openKb('cH', c.id); ui(); draw(); } }, 0); ui(); draw(); }, 'Габарит: ширина × высота, мм']);
    if (K.rc || K.pt) B.push(['⧉', () => { begin(); const o = clone(c); o.id = uid('c'); if (o.ex) o.xv = Math.max(0, o.xv - 300); else o.x += 300; D.com.push(o); C.sel = {t: 'com', id: o.id}; commit(); }, 'Копия рядом']);
    if (K.D && c.k !== 'kol') B.push([`<span class="opt${c.D ? ' on' : ''}">Z</span>`, () => { openKb('cD', c.id); ui(); draw(); }, 'Z — глубина, мм: выступ +, ниша −']);
  }
  /* вид точки (82.35): смена типа выбранной точки; посты и ↕ — только у розетки / выключателя */
  const sheetLow = el => { const z = $('zf'), r = z && z.getBoundingClientRect(); el.style.setProperty('--sheetB', Math.max(8, innerHeight - (r ? r.top : innerHeight - 180) + 6) + 'px'); };   // 82.35.20: окно — снизу, над нижними рядами
  function ptKind(c) {
    let el = $('ptK'); if (!el) { el = document.createElement('div'); el.id = 'ptK'; el.className = 'sheet'; document.body.appendChild(el); }
    const ks = Object.keys(CK).filter(k => CK[k].pt);
    el.innerHTML = '<div class="hd"><b>Вид точки</b><button data-x>✕</button></div>' + ks.map(k => `<button class="row${k === c.k ? ' cur' : ''}" data-pk="${k}"><span style="color:${CK[k].c}">●</span> ${esc(CK[k].n)}</button>`).join('');
    el.querySelectorAll('[data-pk]').forEach(b => act(b, () => { const k = b.dataset.pk; el.classList.remove('on'); if (!com(c.id) || k === c.k) return; begin(); c.k = k;
      if (!CK[k].ps) { delete c.N; delete c.o; } else if (k === 'rv' && !(c.N >= 2)) c.N = 2; commit(); ui(); draw(); }));
    act(el.querySelector('[data-x]'), () => el.classList.remove('on')); sheetLow(el); el.classList.add('on');
  }
  /* 82.35.20: количество постов — список значений (розетка + выключатель — от 2) */
  function ptPosts(c) {
    let el = $('ptN'); if (!el) { el = document.createElement('div'); el.id = 'ptN'; el.className = 'sheet'; document.body.appendChild(el); }
    const n0 = c.k === 'rv' ? 2 : 1; el.innerHTML = '<div class="hd"><b>Количество постов</b><button data-x>✕</button></div>' + [1, 2, 3, 4, 5].filter(n => n >= n0).map(n => `<button class="row${(c.N || 1) === n ? ' cur' : ''}" data-pn="${n}">${n}</button>`).join('');
    el.querySelectorAll('[data-pn]').forEach(b => act(b, () => { const n = +b.dataset.pn; el.classList.remove('on'); if (!com(c.id) || (c.N || 1) === n) return; begin(); if (n === 1) delete c.N; else c.N = n; commit(); ui(); draw(); }));
    act(el.querySelector('[data-x]'), () => el.classList.remove('on')); sheetLow(el); el.classList.add('on');
  }
  function B4kbObj(t, id) { return t === 'eE' ? elev(id) : t === 'wH' ? wall(id) : t === 'w3p' ? elev(id) : t === 'cD' || t === 'cOf' || t === 'cW' || t === 'cH' ? com(id) : t === 'eSeg' ? elev(id) : null; }
  function B4kbBuf(t, o) { return t === 'eE' ? '' : t === 'wH' ? String(wHt(o)) : t === 'w3p' ? '' : t === 'cD' ? (o.D ? String(o.D) : '') : t === 'cOf' || t === 'eSeg' ? '' : t === 'cW' ? String(rnd(o.w)) : t === 'cH' ? String(rnd(o.h)) : null; }
  function B4kbApply(tg, v, raw) {
    if (tg.t === 'w3p') { w3Set(tg, v, raw); return true; }
    if (tg.t === 'eE') { const e = elev(tg.id); if (e && v > 0) { const cur = eEdge(e, tg.side), d = v - cur; if (Math.abs(d) > 0.05) { begin(); e.w3d = e.w3d || {};
      const [k, i] = {l: ['A', 1], r: ['B', 1], t: ['B', 0], b: ['C', 0]}[tg.side], o = e.w3d[k] = (e.w3d[k] || [0, 0, 0]).slice(); o[i] = rnd((o[i] + d) * 10) / 10; if (!o.some(Boolean)) delete e.w3d[k]; if (!Object.keys(e.w3d).length) delete e.w3d; commit(); } } return true; }
    if (tg.t === 'wH') { const w = wall(tg.id); if (w) { begin(); if (v > 0 && v !== Hmm()) w.H = rnd(v); else delete w.H; elevLayout(); commit(); } return true; }
    if (tg.t === 'cD') { const c = com(tg.id); if (c) { begin(); if (v && isFinite(v)) c.D = rnd(v); else delete c.D; commit(); } return true; }   // Z: выступ +, ниша − (82.14)
    if (tg.t === 'eSeg') { segApply(tg, v); return true; }
    if (tg.t === 'cW' || tg.t === 'cH') { const c = com(tg.id); if (c && v > 0) { begin(); const r = cRect(c); if (tg.t === 'cW') { c.x = r.x; delete c.ex; c.w = rnd(v); c.fwx = 1; } else { const Rh = (elev(c.e) ? elevRect(elev(c.e)).h : 0), up = r.y > 0.5 && Math.abs(r.y + r.h - Rh) < 0.5; c.y = up ? rnd(r.y + r.h - v) : r.y; delete c.ey; c.h = rnd(v); c.fwy = 1; }   /* 82.35.13: у потолка — верх на месте, растёт вниз */ commit(); } return true; }
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

  /* ═══ [BLOCK C-MODS] модификаторы инструмента — набор v81 (ZO / ZOPT): блок модификаторов (3-я строка снизу справа) при активном инструменте,
     у каждого инструмента свои, запоминаются. ∟ 0/90° · ∥ параллельно последней · ↔/→ стрелки размера · ⛓ цепочка · 🧲 привязка · ┄ пунктир · ◜ скругление · ■ заливка · 1:1 квадрат ═══ */
  const ZO = {L: ['∟', 'Модификатор 0 / 90°: только вертикально / горизонтально'], P: ['∥', 'Параллельно последней линии'], sq: ['1:1', 'Квадрат'],
    t: ['↔', 'Размер: стрелки с двух сторон (↔) / от угла (→)'], ch: ['⛓', 'Цепочка: следующий размер — от конца предыдущего'], sn: ['🧲', 'Привязка к краям, линиям, углам'],
    dash: ['┄', 'Пунктир'], rnd: ['◜', 'Скругление углов'], fill: ['■', 'Заливка']};
  const RCK = Object.keys(CK).filter(k => CK[k].rc);
  const ZOPT = Object.assign({dim: ['L', 'P', 't', 'ch', 'sn'], arr: ['L', 'P', 'sn'], ln: ['L', 'P', 'dash'], pl: ['L', 'dash'], rect: ['sq', 'rnd', 'fill', 'dash'], circ: ['fill', 'dash'], arc: ['dash'], pen: ['dash'],
    wall: ['L', 'sn'], ct: ['L', 'sn'], wrt: ['L', 'P', 'sn']}, ...RCK.map(k => ({[k]: ['sq']})));
  const ZO0 = {dim: {L: 1, sn: 1, t: 1}, arr: {L: 1, sn: 1}, ln: {L: 1}, pl: {L: 1}, wall: {L: 1, sn: 1}, ct: {L: 1, sn: 1}, wrt: {L: 1, sn: 1}};
  const MOD = (() => { try { return JSON.parse(localStorage.getItem('akx-core-mod') || '{}'); } catch (e) { return {}; } })();
  const zo = k => (MOD[k] = MOD[k] || {...(ZO0[k] || {})});
  const md = o => (ZOPT[C.tool] ? !!zo(C.tool)[o] : o !== 'P' && o !== 'ch');   // модификатор текущего инструмента; без набора (выбор и др.) — привязки как раньше
  const mdSv = () => { try { localStorage.setItem('akx-core-mod', JSON.stringify(MOD)); } catch (e) { } };
  let LASTDIR = null;                                            // направление последней линии (рад), для ∥
  function snapP(A, q) { if (!md('P') || LASTDIR == null) return q; const dx = q.x - A.x, dy = q.y - A.y, L = hyp(dx, dy); if (!L) return q;
    let d = Math.atan2(dy, dx) - LASTDIR; d = ((d + Math.PI / 2) % Math.PI + Math.PI) % Math.PI - Math.PI / 2; if (Math.abs(d) > 6 * Math.PI / 180) return q;
    const s = Math.sign(Math.cos(Math.atan2(dy, dx) - LASTDIR)) || 1, u = {x: Math.cos(LASTDIR) * s, y: Math.sin(LASTDIR) * s}, k = dx * u.x + dy * u.y; return {x: A.x + u.x * k, y: A.y + u.y * k}; }
  const setDir = (A, B) => { if (A && B && hyp(B.x - A.x, B.y - A.y) > 0) LASTDIR = Math.atan2(B.y - A.y, B.x - A.x); };
  const sqr = (A, q) => { const dx = q.x - A.x, dy = q.y - A.y, m = Math.max(Math.abs(dx), Math.abs(dy)); return {x: A.x + Math.sign(dx || 1) * m, y: A.y + Math.sign(dy || 1) * m}; };
  const lineSnap = (A, q) => snapP(A, md('L') ? snap90(A, q) : q);
  const ZI = {"L": "<svg viewBox=\"0 0 24 24\"><path d=\"M5 4v15h15\" fill=\"none\" stroke=\"#3D9BFF\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M5 13h6v6\" fill=\"none\" stroke=\"#F2B233\" stroke-width=\"2\"/></svg>", "P": "<svg viewBox=\"0 0 24 24\"><path d=\"M4 17L17 4\" stroke=\"#2BB673\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M8 20L20 8\" stroke=\"#3D9BFF\" stroke-width=\"2.6\" stroke-linecap=\"round\"/></svg>", "t2": "<svg viewBox=\"0 0 24 24\"><path d=\"M5 12h14\" stroke=\"#E8EBEF\" stroke-width=\"2.2\"/><path d=\"M3 12l5-4v8zM21 12l-5-4v8z\" fill=\"#F2B233\"/></svg>", "t1": "<svg viewBox=\"0 0 24 24\"><path d=\"M5 12h14\" stroke=\"#E8EBEF\" stroke-width=\"2.2\"/><circle cx=\"5\" cy=\"12\" r=\"2.5\" fill=\"#E8EBEF\"/><path d=\"M21 12l-5-4v8z\" fill=\"#F2B233\"/></svg>", "ch": "<svg viewBox=\"0 0 24 24\"><rect x=\"2.5\" y=\"8\" width=\"11\" height=\"8\" rx=\"4\" fill=\"none\" stroke=\"#3D9BFF\" stroke-width=\"2.4\"/><rect x=\"10.5\" y=\"8\" width=\"11\" height=\"8\" rx=\"4\" fill=\"none\" stroke=\"#2BB673\" stroke-width=\"2.4\"/></svg>", "sn": "<svg viewBox=\"0 0 24 24\"><path d=\"M5 4v8a7 7 0 0014 0V4h-5v8a2 2 0 01-4 0V4z\" fill=\"#E5484D\"/><path d=\"M5 4h5v4H5zM14 4h5v4h-5z\" fill=\"#E8EBEF\"/></svg>", "dash": "<svg viewBox=\"0 0 24 24\"><path d=\"M3 12h18\" stroke=\"#F2B233\" stroke-width=\"2.6\" stroke-dasharray=\"4 3\"/></svg>", "rnd": "<svg viewBox=\"0 0 24 24\"><path d=\"M4 20V11a7 7 0 017-7h9\" fill=\"none\" stroke=\"#B57BFF\" stroke-width=\"2.6\" stroke-linecap=\"round\"/></svg>", "fill": "<svg viewBox=\"0 0 24 24\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"2\" fill=\"#2BB673\" fill-opacity=\".55\" stroke=\"#2BB673\" stroke-width=\"2\"/></svg>", "sq": "<svg viewBox=\"0 0 24 24\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"#3D9BFF\" stroke-width=\"2.2\"/><text x=\"12\" y=\"15.5\" text-anchor=\"middle\" font-family=\"system-ui\" font-weight=\"700\" font-size=\"8\" fill=\"#F2B233\">1:1</text></svg>"};   // 82.35.3: полноцветные значки модификаторов (утверждено 12.11)
  function modsAct(B) {
    const o = ZOPT[C.tool]; if (!o) return; const z = zo(C.tool);
    for (const k of o) { const on = !!z[k], ic = k === 't' ? (on ? ZI.t2 : ZI.t1) : ZI[k] || ZO[k][0];
      B.push([`<span class="zi${on || k === 't' ? ' on' : ''}">${ic}</span>`, () => { z[k] = z[k] ? 0 : 1; mdSv(); ui(); draw(); toast(ZO[k][1].split(':')[0] + (k === 't' ? (z[k] ? ': ↔' : ': →') : z[k] ? ': вкл' : ': выкл')); }, ZO[k][1]]); }
    B.push(null);                                                // разделитель: дальше — действия выбранного
  }

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
      if (hyp(b.x - last.x, b.y - last.y) * V.s < 12) { C.ctp = null; elevAll(); draw(); toast('Контур: готово'); return true; }
      const w = addWall(last, b); if (!w) { draw(); return true; }
      const end = w.b, start0 = C.ctp.n0 || D.walls.find(x => x.id === w.id).a;
      if (b.node && b.node === start0) { C.ctp = null; elevAll(); C.sel = {t: 'wall', id: w.id}; ui(); draw(); toast('Контур замкнут'); return true; }
      const n = node(end); C.ctp = {x: n.x, y: n.y, node: end, n0: start0}; C.sel = {t: 'wall', id: w.id}; ui(); draw(); return true; }
    if (C.tool === 'op') {
      const hw = wallAt(g.p0.x, g.p0.y); if (!hw) { toast('Проём — двумя касаниями по стене'); return true; }
      const s0 = rnd(hw.s * 1e4) / 1e4;
      if (!C.opp || C.opp.wall !== hw.w.id) { C.opp = {wall: hw.w.id, s: s0}; draw(); return true; }
      const a = Math.min(C.opp.s, s0), b = Math.max(C.opp.s, s0); C.opp = null; if ((b - a) * wLen(hw.w) < 10) { draw(); return true; }
      begin(); const o = {id: uid('o'), wall: hw.w.id, s0: a, s1: b}; D.ops.push(o); C.sel = null; commit(); toast('Проём ' + num((b - a) * wLen(hw.w))); return true; }
    return false;
  }

  /* ═══ [BLOCK C-HIT] что под пальцем (px) — порядок: маркеры → подписи → узлы → стены → развёртки → фото ═══ */
  const HR = {handle: 22, node: 20, wall: 14};
  function photoCorners(p) { const [x, y] = toS(p.x, p.y), w = p.w * V.s, h = phH(p) * V.s; return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
  function hit(sx, sy) {
    const s = C.sel;
    if (!C.crop && C.tool === 'pts') { const hp = w3Hit(sx, sy); if (hp) return hp; }   // 82.35.4: точки 4 углов — раньше полей
    if (!C.crop) { const he = edHit(sx, sy); if (he) { const hc = comAt(sx, sy); const sg = he.o && he.o.s, own = !!hc && ((he.o && he.o.c === hc.id) || !!(sg && sg.A && sg.B && sg.A.vol && sg.A.vol === sg.B.vol && sg.A.vol.c.id === hc.id));   /* 82.35.13: Ш / В / Г на гранях объекта — его поля */ return hc && ((!(C.sel && C.sel.id === hc.id) && !own) || !he.core) ? hc : he; } }   /* 82.35.14: над телом объекта — только касание самого поля */   // поле Ш / В самого объекта — поле; зазоры и чужие над объектом — объект   // поля размеров — раньше ручек выбранного; невыбранный объект под полем — сначала он
    if (C.crop) { const p = photo(C.crop.id); const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'crop-h', id: p.id, c};
      const [x0, y0] = photoCorners(p)[0], [x1, y1] = photoCorners(p)[2]; if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) return {t: 'crop-in', id: p.id}; return null; }
    if (s && s.t === 'photo') { const p = photo(s.id); if (p) { const c = photoCorners(p).findIndex(([x, y]) => hyp(x - sx, y - sy) < HR.handle); if (c >= 0) return {t: 'ph-h', id: p.id, c}; } }
    if (s && s.t === 'drw' && typeof B3handle === 'function') { const hh = B3handle(s.id, sx, sy); if (hh) return hh; }
    if (s && s.t === 'com') { const hh = B4handle(s.id, sx, sy); if (hh) return hh; }
    if (s && s.t === 'frame') { const Q = frame(s.id) && frPts(frame(s.id)); if (Q) { const c = Q.findIndex(q => { const [x, y] = toS(q.x, q.y); return hyp(x - sx, y - sy) < HR.handle; }); if (c >= 0) return {t: 'fr-h', id: s.id, c}; } }
    if (s && s.t === 'dim') { const d = dim(s.id); if (d) for (const [k, e] of [['a', d.a], ['b', d.b]]) { const P = endPos(e), [x, y] = toS(P.x, P.y); if (hyp(x - sx, y - sy) < HR.handle) return {t: 'dim-h', id: d.id, end: k}; } }
    for (const [id, r] of DLBL) if (hyp(r.x - sx, r.y - sy) < r.r) return {t: 'dlabel', id};
    { const hc = comAt(sx, sy); for (const d of D.dims) { const A = endPos(d.a), B = endPos(d.b); if (segDist([sx, sy], toS(A.x, A.y), toS(B.x, B.y)) < 12) { if (hc && (d.a.id === hc.id || d.b.id === hc.id)) return hc; return {t: 'dim', id: d.id}; } } }   // 82.35: на значке точки — точка, а не её размер
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
    if (!md('sn') && !md('L')) { const q = toW(sx, sy); return {x: rnd(q.x), y: rnd(q.y)}; }
    if (md('sn')) for (const n of D.nodes) { if (n.id === skip) continue; const [x, y] = toS(n.x, n.y); if (hyp(x - sx, y - sy) < HR.node + 4) return {x: n.x, y: n.y, node: n.id}; }
    let q = toW(sx, sy); if (!a) return {x: rnd(q.x), y: rnd(q.y)};
    const dx = q.x - a.x, dy = q.y - a.y, ang = Math.atan2(dy, dx) * 180 / Math.PI, m = ((ang % 90) + 90) % 90; let ax = null;
    if (md('L') && (m < 6 || m > 84)) {
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
    const w = {id: uid('w'), a: na, b: nb, gn: ++D.gnHi}; D.walls.push(w); if (C.tool !== 'ct') elevPut(w); commit(); return w;   // 82.35.5: нарисованная стена — сразу на холсте (контур — по завершении)
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
  /* ═══ [BLOCK C-ELAY] 82.35.6: развёртки — от плана вниз по номерам стен (выключенные пропускаются); перестановка раздвигает ряды:
     всё, что лежит в ряду развёртки (фото, рамки, рисунки), едет вместе с ней; размеры и объекты на стене / фото — привязаны и едут сами ═══ */
  const ELG = 1300;                                              // зазор между рядами, мм (боковые и пол в проекции — ~600)
  function elevPut(w) { if (!D.elev.some(e => e.wall === w.id)) D.elev.push({id: uid('e'), wall: w.id, x: 0, y: 0}); elevLayout(); }
  function elevAll() { const miss = D.walls.filter(w => !D.elev.some(e => e.wall === w.id)); begin(); miss.forEach(w => D.elev.push({id: uid('e'), wall: w.id, x: 0, y: 0})); elevLayout(); commit(); }
  function elevLayout() {
    if (!D.nodes.length) return; const x0 = rnd(Math.min(...D.nodes.map(n => n.x))); let y = rnd(Math.max(...D.nodes.map(n => n.y)) + ELG);
    const on = D.elev.filter(elOn).sort((a, b) => wall(a.wall).gn - wall(b.wall).gn), plan = {};
    for (const e of on) { plan[e.id] = {x: x0, y}; y = rnd(y + elevRect(e).h + ELG); }
    // ряды по старым местам: что попадает в полосу развёртки — едет с ней
    const old = on.filter(e => e.x || e.y).map(e => { const r = elevRect(e); return {e, t: r.y - ELG / 2, b: r.y + r.h + ELG / 2, dx: plan[e.id].x - e.x, dy: plan[e.id].y - e.y}; });
    const band = yy => old.find(o => yy >= o.t && yy < o.b);
    const mv = (cy, f) => { const o = band(cy); if (o && (o.dx || o.dy)) f(o.dx, o.dy); };
    for (const p of D.photos) mv(p.y + phH(p) / 2, (dx, dy) => { p.x = rnd(p.x + dx); p.y = rnd(p.y + dy); });
    for (const q of D.drw || []) { if (q.h || !q.p || !q.p.length) continue; mv(q.p.reduce((s, v) => s + v[1], 0) / q.p.length, (dx, dy) => { q.p = q.p.map(v => [rnd(v[0] + dx), rnd(v[1] + dy)]); }); }   // свободные рисунки; на стене / фото — едут с хозяином
    for (const d of D.dims) for (const k of ['a', 'b']) { const q = d[k]; if (q.t === 'free') mv(q.y, (dx, dy) => { d[k] = {t: 'free', x: rnd((q.x + dx) * 10) / 10, y: rnd((q.y + dy) * 10) / 10}; }); }   // свободные концы размеров
    for (const e of on) { e.x = plan[e.id].x; e.y = plan[e.id].y; }
  }
  function addElev(w) {
    if (!Hmm()) { KB.after = () => { if (Hmm()) addElev(w); }; openKb('H', null); toast('Высота H'); return; }
    const ex = D.elev.find(e => e.wall === w.id);
    if (ex) { const r = elevRect(ex); V.ox = cssW() / 2 - (r.x + r.w / 2) * V.s; V.oy = cssH() / 2 - (r.y + r.h / 2) * V.s; C.sel = {t: 'elev', id: ex.id}; viewChanged(); ui(); return; }
    // свободное место под планом: ниже плана и уже стоящих развёрток плана (холст не перестраивается — новое ложится в пустое)
    begin(); elevPut(w); commit(); const e2 = D.elev.find(e => e.wall === w.id); if (e2) { const r = elevRect(e2); V.ox = cssW() / 2 - (r.x + r.w / 2) * V.s; V.oy = cssH() / 2 - (r.y + r.h / 2) * V.s; C.sel = {t: 'elev', id: e2.id}; viewChanged(); ui(); } return;
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
    C.sel = null; C.msel = D.photos.slice(-out.length).map(p => ({t: 'photo', id: p.id}));    // вставленные — выделены (группой), чтобы было видно
    if (out.length === 1) { C.sel = C.msel[0]; C.msel = []; }
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
    if (h && h.t === 'edim') { const hc = comAt(p.x, p.y); if (hc && C.sel && C.sel.id === hc.id) { G.ed = h; G.h = hc; G.t = 'cmove'; return; } G.t = 'pan'; return; }   // поле над выбранным: касание — ввод, протяжка — перенос
    if (h && h.t === 'found') { G.t = 'pan'; return; }
    if (fingerPan(p)) { G.t = 'pan'; G.finger = true; return; }
    if (h && h.t === 'dim-h') { G.t = 'dimend'; return; }
    if (h && h.t === 'fr-h') { G.t = 'fcorner'; return; }
    if (C.msel.length && (C.tool === 'sel' || C.tool === 'rsel')) { const m = normHit(h); if (m && inMsel(m.t, m.id)) { G.t = 'gmove'; return; } }
    if (C.tool === 'rsel') { G.t = 'rs'; return; }
    if (C.tool === 'pts') { if (h && h.t === 'frame' && C.sel && C.sel.id === h.id) { G.t = 'move'; return; } const ph = photoAt(p); if (ph) { G.t = 'ptsd'; G.ph = ph.id; G.a = toW(p.x, p.y); } else G.t = 'pan'; return; }
    if (B6start(G, p, h)) return;
    if (B4start(G, p, h)) return;
    if (typeof B3start === 'function' && B3start(G, p, h)) return;
    if ((C.tool === 'dim' || C.tool === 'arr') && !(h && (h.t === 'dlabel' || h.t === 'label' || h.t === 'elabel'))) { G.t = 'dimdraw'; G.a = snapDim(p.x, p.y, null, null); G.cur = null;
      if (C.tool === 'dim' && md('ch')) { const ld = D.dims.filter(x => x.k === 'dim').slice(-1)[0]; if (ld) { const E = endPos(ld.b), [ex, ey] = toS(E.x, E.y); if (hyp(ex - p.x, ey - p.y) < 40) G.a = {...ld.b}; } }   // ⛓ — от конца предыдущего
      return; }
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
    if (g.t === 'dimdraw') { if (g.cur) { addDim(g.a, g.cur); C.sel = null; } ui(); draw(); return; }
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
    if (g.ed) { edTap(g.ed); return; }
    if (h && h.t === 'edim') { edTap(h); return; }
    if (h && h.t === 'found') { const f = fnd(h.id); foundPut([h.id]); C.sel = {t: 'elev', id: f.e}; ui(); draw(); toast('На стену: ' + (CK[f.k] || {n: f.k}).n); return; }
    if (g.finger) { const t0 = C.tool; C.tool = 'sel'; try { tap({...g, finger: false}); } finally { C.tool = t0; ui(); } return; }
    if (C.tool === 'rsel') { const m = normHit(h); if (m) C.msel = inMsel(m.t, m.id) ? C.msel.filter(x => !(x.t === m.t && x.id === m.id)) : [...C.msel, m]; else C.msel = []; C.sel = null; ui(); draw(); return; }
    if (C.tool === 'pts') { if (h && h.t === 'w3p') { C.sel = {t: 'w3p', id: h.id, k: h.k}; ui(); draw(); return; }   // 82.35.5: 4 угла — касание плоскости выделяет её, маркеры по углам
      const pl = w3PlaneAt(g.p0.x, g.p0.y); if (pl) { Object.assign(W3S, pl); C.sel = null; ui(); draw(); return; }
      if (h && (h.t === 'frame' || h.t === 'fr-h')) { C.sel = {t: 'frame', id: h.id}; ui(); draw(); return; } if (photoAt(g.p0)) toast('4 угла — протяни рамку по диагонали по фото стены'); else { W3S.pl = null; C.sel = null; ui(); draw(); } return; }
    if (C.msel.length) C.msel = [];
    if (B6tap(g, h)) return;
    if (B4tap(g, h)) return;
    if (typeof B3tap === 'function' && B3tap(g, h)) return;
    if (h && h.t === 'label') { C.sel = {t: 'wall', id: h.id}; ui(); draw(); return; }   // 82.35.8: обозначение — выбор стены; длина вводится на развёртке
    if (h && h.t === 'dlabel') { C.sel = {t: 'dim', id: h.id}; ui(); draw(); openKb('dim', h.id); return; }
    if (h && h.t === 'elabel') { C.sel = {t: 'elev', id: h.id}; ui(); draw(); const e = elev(h.id); if (e) openKb('wH', e.wall); return; }
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
  /* 82.35: введённый размер до точки (коммуникации) — точка встаёт на этот размер вдоль размера; другой конец — опора. Оба конца — объекты: двигается конец b */
  function dimMove(d, v) {
    const ca = d.a.t === 'com' && com(d.a.id), cb = d.b.t === 'com' && com(d.b.id); if (!ca && !cb) return;
    const mv = cb && !(ca && ca === cb) ? 'b' : ca && ca !== cb ? 'a' : null; if (!mv) return;
    const fix = mv === 'b' ? d.a : d.b, A = endPos(fix), B = endPos(d[mv]), L = hyp(B.x - A.x, B.y - A.y); if (!(L > 0)) return;
    const k = v / L, dx = (B.x - A.x) * (k - 1), dy = (B.y - A.y) * (k - 1), c = com(d[mv].id);
    if (CK[c.k].ln) { c.a = [rnd(c.a[0] + dx), rnd(c.a[1] - dy)]; c.b = [rnd(c.b[0] + dx), rnd(c.b[1] - dy)]; return; }
    if (c.ex === 'R') c.xv = rnd(c.xv - dx); else c.x = rnd(c.x + dx);
    if (c.ey === 'C') c.yv = rnd(c.yv + dy); else c.y = rnd(c.y - dy);
  }
  function closeEd(apply) {
    if (!KB.tg) return; const tg = KB.tg, raw = KB.buf.replace(',', '.'); KB.last = KB.fresh ? {tg: {...tg}, at: Date.now()} : null; KB.tg = null; document.body.classList.remove('kb');
    if (apply) { const v = parseFloat(raw);
      if (tg.t === 'wall') { const w = wall(tg.id); if (w && v > 0 && Math.abs(v - wLen(w)) >= 0.5) setLen(w, v); }
      else if (tg.t === 'fL') { const f = frame(tg.id); if (f && v > 0) mkFrameWall(f, v); }
      else if (B4kbApply(tg, v, raw)) { }
      else if (B6apply(tg, v)) { }
      else if (tg.t === 'H') { if (v > 0 && v !== +D.H) { begin(); D.H = rnd(v); commit(); } else if (!(v > 0) && !D.elev.length) { begin(); D.H = ''; commit(); } }
      else { const d = dim(tg.id); if (d) { begin(); d.v = raw === '' || raw === '-' || isNaN(v) ? '' : v; if (v > 0) dimMove(d, v); commit(); } } }
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
    if (C.ctp) elevAll();                                        // недорисованный контур — его стены тоже на холст
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
    /* 82.35.5: кнопки «стена на холст» нет — каждая стена на холсте сразу */
    const B0 = B.splice(0); modsAct(B); B.push(...B0);
    if (typeof B3act === 'function') B3act(s, B);
    if (typeof B4act === 'function') B4act(s, B);
    if (typeof B6act === 'function') B6act(s, B);
    restAct(s, B);
    while (B.length && B[B.length - 1] === null) B.pop(); if (B[0] === null) B.shift();
    box.classList.toggle('on', B.length > 0);
    for (const it of B) { if (it === null) { const sp = document.createElement('span'); sp.className = 'sep'; box.appendChild(sp); continue; } const [h, fn, ti] = it; { const b = document.createElement('button'); b.innerHTML = h; b.title = ti || ''; act(b, fn); box.appendChild(b); } }
    if (typeof B3ui === 'function') B3ui();
    chipsUi();
  }
  document.querySelectorAll('#mdT [data-md]').forEach(b => act(b, () => { C.mode = b.dataset.md; C.phm = false; ui(); draw(); }));
  document.querySelectorAll('[data-soon]').forEach(b => act(b, () => toast('«' + b.dataset.soon + '» — переносится на ядро следующими этапами')));
  document.querySelectorAll('#fws [data-rf]').forEach(b => act(b, () => { C.phm = false; ui(); $(b.dataset.rf === 'c' ? 'cCam' : 'cFile').click(); }));
  act($('zpF'), () => $('tb').classList.toggle('on'));
  act($('tbX'), () => $('tb').classList.remove('on'));
  $('cCam').onchange = e => { const f = e.target.files; addPhotos(f).finally(() => { e.target.value = ''; }); };
  $('cFile').onchange = e => { const f = e.target.files; addPhotos(f).finally(() => { e.target.value = ''; }); };
  act($('bUnd'), () => { if (C.crop) cropEnd(); undo(); });
  act($('bRed'), () => { if (C.crop) cropEnd(); redo(); });
  act($('bDelS'), () => { if (!$('bDelS').classList.contains('dis')) del(); });
  act($('bDone'), () => { closeEd(true); if (C.crop) cropEnd(); save().then(() => toast('Сохранено')); });   // ✓ — только сохранить проект; вид не меняется
  act($('bMore'), () => $('zMenu').classList.toggle('on'));
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
  /* 82.35.19: как в v81 (btField) — поле закрылось касанием до замера (ничего не набрано) → замер идёт в это последнее поле */
  function btVal(mm) { BT.last = mm; if (!KB.tg && KB.last && Date.now() - KB.last.at < 60000) { const t = KB.last.tg; KB.last = null; openKb(t.t, t.id); Object.assign(KB.tg, t); }
    if (KB.tg) { KB.buf = String(mm); KB.fresh = false; KB.last = null; closeEd(true); toast('📡 ' + mm + ' мм'); } else toast('📡 ' + mm + ' мм · коснись значения — вставить'); }
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
  const comLay = c => { if (!elOn(elev(c.e))) return false; const K = CK[c.k] || {}; return K.pt || K.ln ? LAY.kom : (c.k === 'zon' || c.k === 'znd' || c.k === 'shield') ? LAY.zon : LAY.el; };
  const EDL = [];                                                // поля размеров развёрток: {id (развёртка), k, r (px), …}
  const STRUCT = new Set(['kol', 'nis', 'kor', 'rig', 'win', 'door']);
  function edimBox(t, X, Y, vert, ed, ent, L) {                  // поле 82.13 в стиле v81 (82.35): скруглено 3, обводка 1,2, размеры из настроек, без наложения; введённое — чёрным, примерное — красным
    if (!ed && !ent) t = '?'; const k = ed ? 1 : fkE(t, L); if (TXP() * k < 5) return FHID;   // 82.35.14: по центру грани, не длиннее грани
    cx.save(); cx.font = `700 ${TXP() * k}px system-ui`; const th = FLP() * k, tw = Math.max(th, cx.measureText(t).width + th * 0.55), a = vert ? -Math.PI / 2 : 0;
    cx.translate(X, Y); if (vert) cx.rotate(a);
    rrect(-tw / 2, -th / 2, tw, th, th * 0.23);   /* 82.35.18: закругление как у полей v81 (5 при высоте 22) */ cx.fillStyle = ed ? '#fff7d1' : '#fff'; cx.fill(); const fc = ed ? '#c99a1e' : ent ? '#1a2027' : '#d93025'; cx.setLineDash(ent || ed ? [] : [3, 2]); cx.strokeStyle = fc; cx.lineWidth = 1.2; cx.stroke(); cx.setLineDash([]);
    cx.fillStyle = ed ? '#1a2027' : fc; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 0, 0.5); cx.restore();
    return vert ? {x: X - th / 2, y: Y - tw / 2, w: th, h: tw} : {x: X - tw / 2, y: Y - th / 2, w: tw, h: th};
  }
  function edimBoxA(t, X, Y, a, ed, ent, L) {                    // поле под углом (глубина объёма — вдоль ребра глубины)
    if (!ed && !ent) t = '?'; const k = ed ? 1 : fkE(t, L); if (TXP() * k < 5) return FHID;   // 82.35.14: по центру ребра, не длиннее ребра
    cx.save(); cx.font = `700 ${TXP() * k}px system-ui`; const th = FLP() * k, tw = Math.max(th, cx.measureText(t).width + th * 0.55);
    cx.translate(X, Y); cx.rotate(a);
    rrect(-tw / 2, -th / 2, tw, th, th * 0.23);   /* 82.35.18: закругление как у полей v81 (5 при высоте 22) */ cx.fillStyle = ed ? '#fff7d1' : '#fff'; cx.fill(); const fc = ed ? '#c99a1e' : ent ? '#1a2027' : '#d93025'; cx.setLineDash(ent || ed ? [] : [3, 2]); cx.strokeStyle = fc; cx.lineWidth = 1.2; cx.stroke(); cx.setLineDash([]);
    cx.fillStyle = ed ? '#1a2027' : fc; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 0, 0.5); cx.restore();
    const b = fbox(X, Y, tw, th, a); return b;
  }
  const kbIs = (t, id, extra) => KB.tg && KB.tg.t === t && (id == null || KB.tg.id === id) && (!extra || extra(KB.tg));
  const kbTxt = v => (KB.buf || ' ') + '▏';
  function sideWalls(w) {                                        // соседние по плану: слева — у узла a, справа — у узла b (вид из помещения)
    const nb = nid => { const o = D.walls.find(x => x.id !== w.id && (x.a === nid || x.b === nid)); return o ? {w: o, L: wLen(o)} : null; }, v = wallView(w);
    return {l: nb(v.a), r: nb(v.b)};
  }
  /* авторазмеры до граней (правила 82.18, владелец 11.11.2026): объём, касающийся ребра стены, режет ребро — цепочка вместо габарита;
     объём в середине — цепочка «до грани» по каждой оси; без повторов (по длине — одна подпись на отрезок; по высоте боковые остаются);
     правка: звено объёма — его Ш / В (у потолка растёт вниз); от края / соседа до грани — положение (объём от края до края — размер); H стены — своим полем */
  const VOL = new Set(['kol', 'nis', 'kor', 'rig']);
  function autoDims(e, R) {
    const T = 1, vols = D.com.filter(c => c.e === e.id && VOL.has(c.k)).map(c => { const r = cRect(c); return r && {c, x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.h}; }).filter(Boolean);
    const out = [], seen = new Set();
    const chain = (ax, line, lo, hi, cut, kind) => {            // cut — объёмы на линии; точки: край, грани, край
      const P = [{v: lo, o: {edge: 'lo'}}]; for (const o of cut) { P.push({v: ax === 'x' ? o.x0 : o.y0, o: {vol: o, f: 'lo'}}); P.push({v: ax === 'x' ? o.x1 : o.y1, o: {vol: o, f: 'hi'}}); }
      P.push({v: hi, o: {edge: 'hi'}}); P.sort((a, b) => a.v - b.v);
      const S = []; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i]; if (b.v - a.v < 0.5) continue; S.push({ax, line, a: a.v, b: b.v, v: b.v - a.v, A: a.o, B: b.o, kind}); } return S;
    };
    const touch = {t: vols.filter(o => o.y1 >= R.h - T), b: vols.filter(o => o.y0 <= T), l: vols.filter(o => o.x0 <= T), r: vols.filter(o => o.x1 >= R.w - T)};
    const top = touch.t.length ? chain('x', R.h, 0, R.w, touch.t, 'edge') : null, bot = touch.b.length ? chain('x', 0, 0, R.w, touch.b, 'edge') : null;
    const sig = S => S.map(s => s.a + ':' + s.b).join('|');
    if (top && bot && sig(top) === sig(bot)) out.push(...bot); else { if (top) out.push(...top); if (bot) out.push(...bot); if (!top && !bot) out.push({ax: 'x', line: R.h, a: 0, b: R.w, v: R.w, kind: 'L'}); else if (!top) out.push({ax: 'x', line: R.h, a: 0, b: R.w, v: R.w, kind: 'L'}); }
    out.push(...(touch.l.length ? chain('y', 0, 0, R.h, touch.l, 'edge') : [{ax: 'y', line: 0, a: 0, b: R.h, v: R.h, kind: 'H'}]));
    out.push(...(touch.r.length ? chain('y', R.w, 0, R.h, touch.r, 'edge') : [{ax: 'y', line: R.w, a: 0, b: R.h, v: R.h, kind: 'H'}]));
    for (const s of out) seen.add(s.ax + s.a.toFixed(0) + ':' + s.b.toFixed(0));
    for (const o of vols) {                                      // объём в середине: «до грани» по каждой оси, без повторов
      if (!touch.t.includes(o) && !touch.b.includes(o)) for (const s of chain('y', (o.x0 + o.x1) / 2, 0, R.h, [o], 'vol')) { const k = 'y' + s.a.toFixed(0) + ':' + s.b.toFixed(0); if (!seen.has(k)) { seen.add(k); out.push(s); } }
      if (!touch.l.includes(o) && !touch.r.includes(o)) for (const s of chain('x', (o.y0 + o.y1) / 2, 0, R.w, [o], 'vol')) { const k = 'x' + s.a.toFixed(0) + ':' + s.b.toFixed(0); if (!seen.has(k)) { seen.add(k); out.push(s); } }
    }
    return out;
  }
  function adApply(s, v) {                                       // введённое — опора: введённая ширина / высота (fw*) и положение (fp*) не меняются другими правками
    if (!(v > 0)) return; const R0 = s.R, A = s.A || {}, B = s.B || {}, ax = s.ax, lim = ax === 'x' ? R0.w : R0.h, T = 1, FW = 'fw' + ax, FP = 'fp' + ax;
    const box = o => ax === 'x' ? [o.x0, o.x1] : [o.y0, o.y1];
    const put = (c, lo, hi, mark) => { delete c.ex; delete c.ey; if (ax === 'x') { c.x = rnd(lo); c.w = Math.max(1, rnd(hi - lo)); } else if (c.k !== 'kol') { c.y = rnd(lo); c.h = Math.max(1, rnd(hi - lo)); } for (const m of mark) c[m] = 1; };
    if (A.vol && B.vol && A.vol === B.vol) {                     // звено объёма — его ширина / высота
      const c = A.vol.c, [lo, hi] = box(A.vol), keepHi = hi >= lim - T && lo > T || (c[FP + 'h'] && !c[FP]);
      begin(); keepHi ? put(c, hi - v, hi, [FW]) : put(c, lo, lo + v, [FW]); commit(); return; }
    const d = v - s.v, opts = [];                                // зазор: двигаем / тянем соседа так, чтобы введённое не менялось
    if (B.vol) { const c = B.vol.c, [lo, hi] = box(B.vol); if (hi >= lim - T) { if (!c[FW]) opts.push(() => put(c, lo + d, hi, [FP])); } else if (!c[FP]) opts.push(() => put(c, lo + d, hi + d, [FP])); else if (!c[FW]) opts.push(() => put(c, lo + d, hi, [FP])); }
    if (A.vol) { const c = A.vol.c, [lo, hi] = box(A.vol); if (lo <= T) { if (!c[FW]) opts.push(() => put(c, lo, hi - d, [FP + 'h'])); } else if (!c[FP + 'h'] && !c[FP]) opts.push(() => put(c, lo - d, hi - d, [FP + 'h'])); else if (!c[FW]) opts.push(() => put(c, lo, hi - d, [FP + 'h'])); }
    if (!opts.length) { toast(A.vol || B.vol ? 'Не изменить: соседние размеры уже введены — сначала измени один из них' : 'Габарит стены — своим полем'); return; }
    begin(); opts[0](); commit();
  }

  function drawElev(e) {
    const r = elevRect(e), w = wall(e.wall); if (!w) return;
    const [x, y] = toS(r.x, r.y), W = r.w * V.s, H = r.h * V.s, on = (C.sel && C.sel.t === 'elev' && C.sel.id === e.id) || inMsel('elev', e.id);
    // 82.35.3: соседние стены и пол — проекция v81 (w1): глубина z (мм к зрителю) сдвигает точку на (0,6·((2x/L−1)+t)·z, 0,6·z); ∠° — наклон t, боковые параллельно
    const sides = th => {
      for (const S of w3Sides(e, r)) { if (!!S.thin !== th) continue; const Q = [S.T0, S.T1, S.B1, S.B0], ps = W3S.e === e.id && w3Mode() && W3S.pl === (S.sd < 0 ? 'L' : 'R');
        cx.beginPath(); Q.forEach(([qx, qy], i) => (i ? cx.lineTo(qx, qy) : cx.moveTo(qx, qy))); cx.closePath();
        if (th) { if (ps) { cx.fillStyle = 'rgba(255,241,179,.6)'; cx.fill(); } cx.setLineDash([4, 3]); cx.strokeStyle = ps ? '#E0B800' : '#8a8f96'; cx.lineWidth = ps ? 1.6 : 1; cx.stroke(); cx.setLineDash([]); continue; }
        cx.fillStyle = ps ? '#FFF1B3' : '#e9e3da'; cx.fill(); cx.strokeStyle = ps ? '#E0B800' : '#b9b2a6'; cx.lineWidth = ps ? 2.5 : 1; cx.stroke();
        if (CFG.side) sideEls(S);
        const mx = (S.T0[0] + S.T1[0] + S.B0[0] + S.B1[0]) / 4, my = (S.T0[1] + S.T1[1] + S.B0[1] + S.B1[1]) / 4;
        cx.save(); cx.font = '600 11px system-ui'; cx.fillStyle = '#6b6457'; cx.translate(mx, my); cx.rotate(S.sd * Math.PI / 2); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('С' + S.o.w.gn, 0, 0); cx.restore(); }
    };
    sides(false);                                                // боковые 90° и больше — заливкой за основной
    { const F = w3Floor(e, r), pf = W3S.e === e.id && w3Mode() && W3S.pl === 'floor'; cx.beginPath(); F.forEach(([qx, qy], i) => (i ? cx.lineTo(qx, qy) : cx.moveTo(qx, qy))); cx.closePath(); cx.fillStyle = pf ? '#FFEC99' : '#d9dcdf'; cx.fill(); cx.strokeStyle = pf ? '#E0B800' : '#b9bec5'; cx.lineWidth = pf ? 2.5 : 1; cx.stroke(); }
    { const Q = ['A', 'B', 'C', 'D'].map(k => w3S3(r, w3C(e, r, k))), act = W3S.e === e.id && w3Mode(), pm = act && W3S.pl === 'M';   // 82.35.4: контур по углам с отклонениями; выбранная плоскость — заливкой (v81, 4 угла)
      cx.beginPath(); Q.forEach(([qx, qy], i) => (i ? cx.lineTo(qx, qy) : cx.moveTo(qx, qy))); cx.closePath(); cx.fillStyle = pm ? '#FFF3BF' : '#dbe9f7'; cx.fill();   // 82.35.8: выбранная плоскость — бледно-жёлтым
      cx.strokeStyle = on || pm ? COL.sel : '#1f6fd1'; cx.lineWidth = on ? 3 : pm ? 2.5 : 2; cx.stroke(); }
    sides(true);                                                 // меньше 90° — тонким пунктиром поверх
    cx.font = `700 ${Math.round(12 * W3.f)}px system-ui`; cx.fillStyle = '#1f6fd1'; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText('С' + w.gn, x + 5, y + 14 * W3.f);
  }
  /* ═══ [BLOCK C-W3P] вид стены v81 (w1, 82.35.3): точка стены (x от левого края, y от пола, z — глубина к зрителю, мм) → px; ∠° — наклон t = (90−a)/45 в пределах −2…2.
     Боковые — на min(1000, длина) по направлению соседней стены в плане; видимость грани — по нормали (w3Vis v81); колонна, короб, ригель, ниша — объёмом ═══ */
  const W3K = 0.6, w3t = () => Math.max(-2, Math.min(2, (90 - W3.a) / 45));
  /* 82.35.11 (владелец 12.11): точно как v81 на 45…135°; дальше к 0° / 180° — доворот: раскрывающаяся боковая ложится продолжением стены в плоскость,
     вторая — на линию стены (пунктиром); f — доля доворота за пределами |t| > 1 */
  const w3F = () => Math.max(0, Math.abs(w3t()) - 1);
  const w3Dx = (R, x) => { const t = w3t(), f = w3F(); return (1 - f) * W3K * ((2 * x / (R.w || 1) - 1) + t) + f * Math.sign(t); };
  const w3Dy = () => W3K * (1 - w3F());
  const w3P = (R, x, y, z) => toS(R.x + x + w3Dx(R, x) * z, R.y + R.h - y + w3Dy() * z);
  const w3Vis = (R, n, x, eps = 0.02) => n[0] * -w3Dx(R, x) + n[1] * w3Dy() + n[2] > eps;
  /* углы стены с отклонениями (v81 w3Set): e.w3d = {A|B|C|D|LT|LB|RT|RB: [dx, dy, dz]} — мм; разворот угла по угольнику — узел плана n.ang = {u|d: {at, mm}} */
  const W3C0 = {A: (R) => [0, R.h, 0], B: (R) => [R.w, R.h, 0], C: (R) => [R.w, 0, 0], D: (R) => [0, 0, 0]};
  const w3dv = (e, k) => (e.w3d && e.w3d[k]) || [0, 0, 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const w3C = (e, R, k) => add3(W3C0[k](R), w3dv(e, k));
  const w3S3 = (R, q) => w3P(R, q[0], q[1], q[2]);
  const w3AnDeg = q => (q && q.at > 0 && q.mm != null && q.mm !== '' ? 90 + Math.atan2(+q.mm, +q.at) * 180 / Math.PI : null);
  function w3Sides(e, R) { const w = wall(e.wall); if (!w) return []; const v = wallView(w), A = node(v.a), B = node(v.b); if (!A || !B) return [];
    const L = hyp(B.x - A.x, B.y - A.y) || 1, u = {x: (B.x - A.x) / L, y: (B.y - A.y) / L}, n = {x: -u.y, y: u.x}, sw = sideWalls(w), out = [];
    for (const [sd, o, Cn] of [[-1, sw.l, A], [1, sw.r, B]]) { if (!o) continue; const on = node(o.w.a === (sd < 0 ? v.a : v.b) ? o.w.b : o.w.a); if (!on) continue;
      const dv = {x: on.x - Cn.x, y: on.y - Cn.y}, l = hyp(dv.x, dv.y) || 1, Dp = Math.min(1000, l), x0 = sd < 0 ? 0 : R.w;
      const pd = [(dv.x * u.x + dv.y * u.y) / l, Math.abs(dv.x * n.x + dv.y * n.y) / l], aq = Cn.ang || {};
      const dirA = q => { const a = w3AnDeg(q); if (a == null) return null; const dl = (a - 90) * Math.PI / 180; return [sd < 0 ? -Math.sin(dl) : Math.sin(dl), Math.cos(dl)]; };   // разворот угла — по угольнику (v71)
      const dT = dirA(aq.u) || dirA(aq.d) || pd, dB = dirA(aq.d) || dirA(aq.u) || pd, cT = sd < 0 ? 'A' : 'B', cB = sd < 0 ? 'D' : 'C', kT = sd < 0 ? 'LT' : 'RT', kB = sd < 0 ? 'LB' : 'RB';
      const P0T = w3C(e, R, cT), P0B = w3C(e, R, cB), P1T = add3(add3(P0T, [dT[0] * Dp, 0, dT[1] * Dp]), w3dv(e, kT)), P1B = add3(add3(P0B, [dB[0] * Dp, 0, dB[1] * Dp]), w3dv(e, kB));
      const nn = sd < 0 ? [dB[1], 0, -dB[0]] : [-dB[1], 0, dB[0]];
      out.push({sd, o, R, x0, sx: dB[0], sz: dB[1], Dp, kT, kB, cT, cB, P3: {T0: P0T, T1: P1T, B1: P1B, B0: P0B}, vis: true, thin: !w3Vis(R, nn, x0),   /* скрытая (как v81) — тонким пунктиром поверх */ T0: w3S3(R, P0T), T1: w3S3(R, P1T), B1: w3S3(R, P1B), B0: w3S3(R, P0B)}); }
    return out; }
  function w3Floor(e, R) { const S = w3Sides(e, R), l = S.find(q => q.sd < 0), r = S.find(q => q.sd > 0);
    return [w3S3(R, w3C(e, R, 'D')), w3S3(R, w3C(e, R, 'C')), r ? r.B1 : w3P(R, R.w, 0, 1000), l ? l.B1 : w3P(R, 0, 0, 1000)]; }
  /* элементы на боковых стенах (82.18 sideElements): коммуникации и проёмы соседней стены в пределах её показанной глубины, без подписей */
  function sideEls(S) { const e = D.elev.find(q => q.wall === S.o.w.id); if (!e) return; const Rs = elevRect(e); if (!(Rs.w > 0 && Rs.h > 0)) return;
    const P = (xw, yw) => { const d = S.sd < 0 ? Rs.w - xw : xw; return d < -1 || d > S.Dp + 1 ? null : w3P(S.R, S.x0 + S.sx * d, yw, S.sz * d); };
    cx.save(); cx.globalAlpha = 0.85;
    for (const c of D.com) { if (c.e !== e.id || !comLay(c)) continue; const K = CK[c.k] || {};
      if (K.pt) { for (const q of postsW(c)) { const pp = P(q.x, q.y); if (!pp) continue; cx.fillStyle = K.c; cx.beginPath(); cx.arc(pp[0], pp[1], Math.max(2, CFG.pointPx - 1), 0, 7); cx.fill(); } }
      else if (K.ln) { const A = P(c.a[0], c.a[1]), B = P(c.b[0], c.b[1]); if (!A || !B) continue; cx.strokeStyle = rtt(c.t)[3]; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); }
      else if (K.rc) { const r = cRect(c), Q = [P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.h), P(r.x, r.y + r.h)]; if (Q.some(q => !q)) continue; cx.beginPath(); Q.forEach(([qx, qy], i) => (i ? cx.lineTo(qx, qy) : cx.moveTo(qx, qy))); cx.closePath(); cx.fillStyle = K.c + '33'; cx.fill(); cx.strokeStyle = K.c; cx.lineWidth = 1.2; cx.stroke(); } }
    cx.restore(); }
  /* объём на стене: глубина z (введённая c.D; без ввода — показ по умолчанию v81: колонна 400, ригель 300, короб 200) */
  const W3VD = {kol: 400, rig: 300, kor: 200};
  const volZ = c => (c.D ? +c.D : W3VD[c.k] || 0);
  function volFaces(c) { const e = elev(c.e), r = cRect(c); if (!e || !r) return null; const R = elevRect(e), z = volZ(c); if (!z) return null;
    const x0 = r.x, x1 = r.x + r.w, y0 = r.y, y1 = r.y + r.h, P = (x, y, zz) => w3P(R, x, y, zz), sg = z > 0 ? 1 : -1, F = [];
    if (w3Vis(R, [-sg, 0, 0], x0)) F.push({k: 'l', q: [P(x0, y0, 0), P(x0, y1, 0), P(x0, y1, z), P(x0, y0, z)]});
    if (w3Vis(R, [sg, 0, 0], x1)) F.push({k: 'r', q: [P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, z), P(x1, y0, z)]});
    if (sg > 0 ? y1 < R.h - 0.5 : y0 > 0.5) { const yy = sg > 0 ? y1 : y0; F.push({k: 't', q: [P(x0, yy, 0), P(x1, yy, 0), P(x1, yy, z), P(x0, yy, z)]}); }
    return {F, front: [P(x0, y1, z), P(x1, y1, z), P(x1, y0, z), P(x0, y0, z)], z, R, x0, x1, y0, y1}; }
  /* ═══ [BLOCK C-W3PT] 4 угла v81 (82.35.4): плоскости активной стены — пол · боковая · стена · боковая · грани объёмов (▯ — следующая грань, затем следующий объём);
     выбранная — заливкой, её 4 угла крупно; касание точки — окно «Угол»: X, Y, Z (смещение от плоскости), у углов стены — разворот по угольнику (верх / низ 100: от стыка, зазор, ∠).
     Стена и боковые: отклонения e.w3d; объём: X / Y — его грани, Z — глубина; угол — в узел плана (n.ang, выгрузка angs как v81) ═══ */
  const W3S = {e: null, pl: null, vi: 0, vf: 'F'};
  const w3Mode = () => C.tool === 'pts' && D.elev.length > 0;   // 82.35.5: только в режиме «4 угла» (кнопка инструмента)
  const W3N = {A: 'верх-лево', B: 'верх-право', C: 'низ-право', D: 'низ-лево', LT: 'верх', LB: 'низ', RT: 'верх', RB: 'низ'};
  const W3VN = {KLT: 'верх-лево', KRT: 'верх-право', KRB: 'низ-право', KLB: 'низ-лево', WLT: 'у стены · верх-лево', WRT: 'у стены · верх-право', WRB: 'у стены · низ-право', WLB: 'у стены · низ-лево'};
  const W3FN = {F: 'лицевая', SL: 'левая', SR: 'правая', T: 'верх'};
  function w3Act() { const s = C.sel; let id = null;
    if (s) { if (s.t === 'elev' || s.t === 'w3p') id = s.id; else if (s.t === 'com') { const c = com(s.id); id = c && c.e; } }
    if (id && elev(id)) W3S.e = id; if (!W3S.e || !elev(W3S.e)) W3S.e = D.elev.length ? D.elev[0].id : null; return W3S.e ? elev(W3S.e) : null; }
  function w3Vols(e) { return D.com.filter(c => c.e === e.id && (CK[c.k] || {}).D && comLay(c)).map(c => ({c, f: volFaces(c)})).filter(o => o.f); }
  function w3Pts(e) { const R = elevRect(e), P = {}; for (const k of ['A', 'B', 'C', 'D']) P[k] = w3C(e, R, k);
    for (const S of w3Sides(e, R)) { P[S.kT] = S.P3.T1; P[S.kB] = S.P3.B1; }
    for (const {c, f} of w3Vols(e)) { const z = f.z; Object.assign(P, {[c.id + ':KLT']: [f.x0, f.y1, z], [c.id + ':KRT']: [f.x1, f.y1, z], [c.id + ':KRB']: [f.x1, f.y0, z], [c.id + ':KLB']: [f.x0, f.y0, z],
      [c.id + ':WLT']: [f.x0, f.y1, 0], [c.id + ':WRT']: [f.x1, f.y1, 0], [c.id + ':WRB']: [f.x1, f.y0, 0], [c.id + ':WLB']: [f.x0, f.y0, 0]}); }
    return P; }
  function w3VFaces(o) { const f = o.f, id = o.c.id, F = [{k: 'F', ks: ['KLT', 'KRT', 'KRB', 'KLB']}];
    for (const q of f.F) F.push(q.k === 'l' ? {k: 'SL', ks: ['WLT', 'KLT', 'KLB', 'WLB']} : q.k === 'r' ? {k: 'SR', ks: ['KRT', 'WRT', 'WRB', 'KRB']} : {k: 'T', ks: f.y1 < f.R.h - 0.5 ? ['WLT', 'WRT', 'KRT', 'KLT'] : ['WLB', 'WRB', 'KRB', 'KLB']});
    return F.map(q => ({k: q.k, ks: q.ks.map(k => id + ':' + k)})); }
  function w3PlaneKs(e) { const R = elevRect(e), S = w3Sides(e, R), l = S.find(q => q.sd < 0), r = S.find(q => q.sd > 0);
    if (W3S.pl === 'L') return l ? ['A', 'LT', 'LB', 'D'] : []; if (W3S.pl === 'R') return r ? ['B', 'RT', 'RB', 'C'] : []; if (W3S.pl === 'floor') return ['D', 'C', ...(r ? ['RB'] : []), ...(l ? ['LB'] : [])];
    if (W3S.pl === 'obj') { const V = w3Vols(e), o = V[Math.min(W3S.vi, V.length - 1)]; if (!o) return []; const f = w3VFaces(o).find(q => q.k === W3S.vf) || w3VFaces(o)[0]; return f.ks; }
    if (W3S.pl === 'M') return ['A', 'B', 'C', 'D']; return []; }
  /* касание плоскости в режиме 4 углов: грани объёмов → стена → боковые → пол; активной стены — первой */
  const pinPoly = (x, y, Q) => { let a = false; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [xi, yi] = Q[i], [xj, yj] = Q[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a; } return a; };
  function w3PlaneAt(sx, sy) { const es = [...D.elev].sort((a, b) => (b.id === W3S.e) - (a.id === W3S.e));
    for (const e of es) { const R = elevRect(e), V = w3Vols(e);
      for (let vi = 0; vi < V.length; vi++) { const o = V[vi]; for (const f of [{k: 'F', q: o.f.front}, ...o.f.F.map(q => ({k: q.k === 'l' ? 'SL' : q.k === 'r' ? 'SR' : 'T', q: q.q}))]) if (pinPoly(sx, sy, f.q)) return {e: e.id, pl: 'obj', vi, vf: f.k}; }
      if (pinPoly(sx, sy, ['A', 'B', 'C', 'D'].map(k => w3S3(R, w3C(e, R, k))))) return {e: e.id, pl: 'M'};
      for (const S of w3Sides(e, R)) if (S.vis && pinPoly(sx, sy, [S.T0, S.T1, S.B1, S.B0])) return {e: e.id, pl: S.sd < 0 ? 'L' : 'R'};
      if (pinPoly(sx, sy, w3Floor(e, R))) return {e: e.id, pl: 'floor'}; }
    return null; }
  function drawW3Pts() {
    if (!w3Mode()) return; const e = w3Act(); if (!e) return; const R = elevRect(e), P = w3Pts(e), sel = C.sel && C.sel.t === 'w3p' && C.sel.id === e.id ? C.sel.k : null, ring = new Set(w3PlaneKs(e));
    if (W3S.pl === 'obj') { const Q = [...ring].map(k => P[k] && w3S3(R, P[k])).filter(Boolean); if (Q.length === 4) { cx.beginPath(); Q.forEach(([qx, qy], i) => (i ? cx.lineTo(qx, qy) : cx.moveTo(qx, qy))); cx.closePath(); cx.fillStyle = 'rgba(255,212,0,.32)'; cx.fill(); cx.strokeStyle = '#E0B800'; cx.lineWidth = 2.5; cx.stroke(); } }
    W3PX.length = 0;
    for (const [k, q] of Object.entries(P)) { if (!ring.has(k)) continue; const [x, y] = w3S3(R, q), r = CFG.pointPx + 1.5;   // маркеры — только по углам выбранной плоскости
      if (ring.has(k)) { cx.strokeStyle = '#E0B800'; cx.lineWidth = 2.2; cx.beginPath(); cx.arc(x, y, r + 5, 0, 7); cx.stroke(); }
      cx.fillStyle = '#F28C00'; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
      if (k === sel) { cx.strokeStyle = COL.sel; cx.lineWidth = 2.5; cx.setLineDash([3, 3]); cx.beginPath(); cx.arc(x, y, r + 8, 0, 7); cx.stroke(); cx.setLineDash([]); }
      W3PX.push({k, x, y, e: e.id, ring: ring.has(k)}); }
  }
  const W3PX = [];
  function w3Hit(sx, sy) { if (!w3Mode()) return null; let b = null, bd = 1e9; for (const o of W3PX) { const d = hyp(o.x - sx, o.y - sy), lim = o.ring ? 14 : o.k.includes(':') && W3S.pl !== 'obj' ? 0 : 9; if (d < lim && d < bd) { bd = d; b = o; } }
    if (b && bd > 6 && comAt(sx, sy)) return null;   // внутри объекта — объект, точка — только вплотную
    return b ? {t: 'w3p', id: b.e, k: b.k} : null; }
  function w3Name(e, k) { const w = wall(e.wall), sw = w ? sideWalls(w) : {}; if (k.includes(':')) { const [id, kk] = k.split(':'), c = com(id); return [(CK[c.k] || {}).n, W3VN[kk]].join(' · '); }
    const side = /^L/.test(k) ? sw.l : /^R/.test(k) ? sw.r : null, lo = /^(C|D|LB|RB)$/.test(k), ws = side ? ['С' + side.w.gn] : ['С' + w.gn, ...((k === 'A' || k === 'D') && sw.l ? ['С' + sw.l.w.gn] : (k === 'B' || k === 'C') && sw.r ? ['С' + sw.r.w.gn] : [])];
    return [W3N[k], ...ws, ...(lo ? ['пол'] : [])].join(' · '); }
  function w3AnNode(e, k) { if (!/^[ABCD]$/.test(k)) return null; const w = wall(e.wall), v = w && wallView(w), sw = w && sideWalls(w), left = k === 'A' || k === 'D'; if (!v || !(left ? sw.l : sw.r)) return null; return {n: node(left ? v.a : v.b), lv: k === 'A' || k === 'B' ? 'u' : 'd'}; }
  function w3Val(e, k, ax) { if (ax === 'at' || ax === 'mm') { const g = w3AnNode(e, k), q = g && g.n && ((g.n.ang || {})[g.lv] || {}); return ax === 'at' ? (q && +q.at) || 600 : q && q.mm != null ? q.mm : ''; }
    const P = w3Pts(e)[k]; return P ? rnd(P[{x: 0, y: 1, z: 2}[ax]]) : ''; }
  function w3Set(tg, v, raw) { const e = elev(tg.id); if (!e) return; const k = tg.k, ax = tg.ax;
    if (ax === 'at' || ax === 'mm') { const g = w3AnNode(e, k); if (!g || !g.n) return; begin(); const a = g.n.ang = g.n.ang || {}, q = a[g.lv] = a[g.lv] || {at: 600};
      if (ax === 'at') { if (v > 0) q.at = rnd(v); } else { if (raw === '' || isNaN(v)) delete q.mm; else q.mm = rnd(v); } if (q.mm == null) delete a[g.lv]; if (!Object.keys(a).length) delete g.n.ang; commit(); return; }
    if (isNaN(v)) return; const i = {x: 0, y: 1, z: 2}[ax], P = w3Pts(e)[k]; if (!P) return;
    if (k.includes(':')) { const [id, kk] = k.split(':'), c = com(id); if (!c) return; const r = cRect(c); begin(); c.x = r.x; c.y = r.y; delete c.ex; delete c.ey;
      if (i === 0) { if (kk[1] === 'L') { c.w = Math.max(1, rnd(c.w + c.x - v)); c.x = rnd(v); } else c.w = Math.max(1, rnd(v - c.x)); c.fwx = 1; }
      else if (i === 1) { if (c.k === 'kol') toast('Колонна — во всю высоту'); else if (kk[2] === 'T') { c.h = Math.max(1, rnd(v - c.y)); c.fwy = 1; } else { c.h = Math.max(1, rnd(c.h + c.y - v)); c.y = rnd(v); c.fwy = 1; } }
      else if (kk[0] === 'K') { if (v) c.D = rnd(v); else delete c.D; } else toast('Угол у стены — Z = 0');
      commit(); return; }
    const dv = v - P[i]; if (Math.abs(dv) < 0.05) return; begin(); e.w3d = e.w3d || {}; const o = e.w3d[k] = (e.w3d[k] || [0, 0, 0]).slice(); o[i] = rnd((o[i] + dv) * 10) / 10; if (!o.some(Boolean)) delete e.w3d[k]; if (!Object.keys(e.w3d).length) delete e.w3d; commit(); }
  function eEdge(e, side) { const R = elevRect(e), c = k => w3C(e, R, k), P = {l: ['A', 'D'], r: ['B', 'C'], t: ['B', 'A'], b: ['C', 'D']}[side], a = c(P[0]), b = c(P[1]);
    return side === 'l' || side === 'r' ? a[1] - b[1] : hyp(a[0] - b[0], a[1] - b[1]); }
  function w3Pick(k) { const e = w3Act(); if (!e) return;
    if (k === 'obj') { const V = w3Vols(e), n = V.length; if (!n) { toast('На стене нет объёмов'); return; }
      if (W3S.pl === 'obj') { const vi = Math.min(W3S.vi, n - 1), L = w3VFaces(V[vi]).map(f => f.k), j = L.indexOf(W3S.vf); if (j >= 0 && j < L.length - 1) W3S.vf = L[j + 1]; else { W3S.vi = (vi + 1) % n; W3S.vf = 'F'; } }
      else { W3S.vi = Math.min(W3S.vi, n - 1); W3S.vf = 'F'; } }
    W3S.pl = k; if (k === 'L' || k === 'R') { const S = w3Sides(e, elevRect(e)).find(q => q.sd === (k === 'L' ? -1 : 1)); if (S && !S.vis) { W3.a = k === 'L' ? 135 : 45; w3Sv(); } }   // скрытая боковая — наклон к ней
    if (C.sel && C.sel.t === 'w3p') C.sel = null; ui(); draw(); }
  function w3Row() { const el = $('w3pl'); if (!el) return; const e = w3Mode() && w3Act(); if (!e) { if (el.innerHTML) el.innerHTML = ''; return; }
    const w = wall(e.wall), sw = w ? sideWalls(w) : {}, V = w3Vols(e), o = V[Math.min(W3S.vi, Math.max(0, V.length - 1))];
    const h = `<button data-p="floor" title="Пол"><svg viewBox="0 0 32 32"><path d="M3 24l7-10h19l-7 10z" fill="#CDD1D6" stroke="#9AA0A8" stroke-width="2.2" stroke-linejoin="round"/></svg></button>` + [['L', sw.l], ['M', w ? {w} : null], ['R', sw.r]].filter(q => q[1]).map(([k, q]) => `<button data-p="${k}" title="${k === 'M' ? 'Стена' : 'Боковая'} С${q.w.gn}">С${q.w.gn}</button>`).join('') + (o ? `<button data-p="obj" title="${esc((CK[o.c.k] || {}).n)}${W3S.pl === 'obj' ? ' · ' + W3FN[W3S.vf] : ''} — касание: следующая грань, затем следующий объём"><svg viewBox="0 0 32 32"><rect x="11" y="4" width="10" height="24" fill="#d9b48f" stroke="#b8602e" stroke-width="2"/><path d="M21 4l5 3v24l-5-3" fill="#c49a73" stroke="#b8602e" stroke-width="2"/></svg></button>` : '') ;
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; el.querySelectorAll('[data-p]').forEach(b => act(b, () => w3Pick(b.dataset.p))); }
    el.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === W3S.pl)); }
  /* 82.35.5: выбрана стена (на плане или её развёртка) — слева третьим рядом поле её высоты */
  /* ═══ [BLOCK C-VW] 82.35.6: справа две кнопки — 1) план ⇄ развёртка выбранной стены (переход по холсту); 2) развёртка стены вкл / выкл (только на плане) ═══ */
  function vwWall() { const s = C.sel; if (!s) return null; if (s.t === 'wall') return wall(s.id); if (s.t === 'elev') { const e = elev(s.id); return e && wall(e.wall); }
    if (s.t === 'com') { const c = com(s.id), e = c && elev(c.e); return e && wall(e.wall); } if (s.t === 'w3p') { const e = elev(s.id); return e && wall(e.wall); } return null; }
  function vwGo() { const w = vwWall() || D.walls.filter(x => !x.off).sort((a, b) => a.gn - b.gn)[0]; if (!w) { toast('Нет стен'); return; }
    const e = D.elev.find(x => x.wall === w.id), c = toW(cssW() / 2, cssH() / 2), r = e && elOn(e) ? elevRect(e) : null, st = C.sel && C.sel.t, inEl = st === 'wall' ? false : st ? true : r && D.elev.some(o => { if (!elOn(o)) return false; const q = elevRect(o); return c.y >= q.y - ELG / 2 && c.y <= q.y + q.h + ELG / 2; });   // выбрана на плане — к развёртке; работа на стене — к плану; без выбора — по центру экрана
    const cen = (x, y) => { V.ox = cssW() / 2 - x * V.s; V.oy = cssH() / 2 - y * V.s; viewChanged(); };
    if (inEl || !r) { const a = node(w.a), b = node(w.b); cen((a.x + b.x) / 2, (a.y + b.y) / 2); C.sel = {t: 'wall', id: w.id}; if (!r && w.off) toast('С' + w.gn + ' — развёртка выключена'); }
    else { cen(r.x + r.w / 2, r.y + r.h / 2); C.sel = {t: 'elev', id: e.id}; }
    ui(); draw(); }
  function vwOff() { const s = C.sel, w = s && s.t === 'wall' && wall(s.id); if (!w) { toast('Выбери стену на плане'); return; }
    begin(); if (w.off) delete w.off; else w.off = 1; if (!D.elev.some(e => e.wall === w.id)) D.elev.push({id: uid('e'), wall: w.id, x: 0, y: 0}); elevLayout(); commit();
    toast('С' + w.gn + (w.off ? ' — развёртка выключена' : ' — развёртка на холсте')); ui(); draw(); }
  function vwUi() { const a = $('vwGo'), b = $('vwOff'); if (!a) return; const has = D.walls.length > 0; a.parentNode.classList.toggle('on', has);
    const s = C.sel, w = s && s.t === 'wall' && wall(s.id); b.classList.toggle('na', !w); b.classList.toggle('off', !!(w && w.off));
    b.title = w ? (w.off ? `С${w.gn}: включить развёртку` : `С${w.gn}: выключить развёртку`) : 'Развёртка стены вкл / выкл — выбери стену на плане'; }
  function wHrow() { const el = $('wHf'); if (!el) return; const s = C.sel, w = s && (s.t === 'wall' ? wall(s.id) : s.t === 'elev' ? (elev(s.id) && wall(elev(s.id).wall)) : null);
    if (!w) { el.classList.remove('on'); el.dataset.h = ''; return; } const ed = kbIs('wH', w.id);
    const h = `<b>H</b><button class="${ed ? 'ed' : ''}">${ed ? esc(KB.buf || ' ') + '▏' : num(wHt(w))}</button><small>С${w.gn}${w.H ? '' : ' · общая'}</small>`;
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; act(el.querySelector('button'), () => { openKb('wH', w.id); ui(); draw(); }); } el.classList.add('on'); }
  function w3Win() { let x = $('w3x'); if (!x) { x = document.createElement('div'); x.id = 'w3x'; document.body.appendChild(x); }
    const s = C.sel, e = s && s.t === 'w3p' && elev(s.id); if (!e || !w3Pts(e)[s.k]) { x.classList.remove('on'); x.dataset.h = ''; return; }
    const k = s.k, f = ax => { const ed = kbIs('w3p', e.id, t => t.k === k && t.ax === ax); return `<button data-ax="${ax}" class="${ed ? 'ed' : ''}">${ed ? esc(KB.buf || ' ') + '▏' : esc(String(w3Val(e, k, ax)))}</button>`; };
    const g = w3AnNode(e, k), q = g && g.n && ((g.n.ang || {})[g.lv] || {}), an = w3AnDeg(q);
    const h = `<div class="h">Угол · ${esc(w3Name(e, k))}</div><div class="r"><b class="X">X</b>${f('x')}<b class="Y">Y</b>${f('y')}</div><div class="r"><b class="Z">Z</b>${f('z')}<small>смещение от плоскости</small></div>`
      + (g ? `<div class="r an"><svg viewBox="0 0 24 24"><path d="M5 3v16h16" fill="none" stroke="#B57BFF" stroke-width="2.4"/><path d="M5 13h6v6" fill="none" stroke="#B57BFF" stroke-width="1.6"/></svg><small>${g.lv === 'u' ? 'верх' : 'низ 100'}</small>${f('at')}<small>от стыка</small>${f('mm')}<small>зазор</small><b class="a">∠ ${an != null ? String(Math.round(an * 10) / 10).replace('.', ',') : '90'}°</b></div>` : '');
    if (x.dataset.h !== h) { x.dataset.h = h; x.innerHTML = h; x.querySelectorAll('[data-ax]').forEach(b => act(b, () => { openKb('w3p', e.id); KB.tg.k = k; KB.tg.ax = b.dataset.ax; KB.buf = String(w3Val(e, k, b.dataset.ax)); KB.fresh = true; ui(); draw(); })); }
    const pp = W3PX.find(o => o.k === k); x.classList.toggle('lo', !!pp && pp.y < 300); x.classList.add('on'); }   // точка под окном — окно вниз
  function drawElevDims() {                                      // после объектов стены — поля сверху всего
    EDL.length = 0; if (!LAY.dim) return; const act = dimAct();
    for (const e of D.elev) { const w = wall(e.wall); if (!w || w.off || (act && e.id !== act)) continue; const R = elevRect(e), [x, y] = toS(R.x, R.y), W = R.w * V.s, H = R.h * V.s;
      const dv = !!(e.w3d && ['A', 'B', 'C', 'D'].some(k => e.w3d[k])), Cc = k => w3C(e, R, k);   // 82.35.9: каждая грань — свой размер (по углам с отклонениями)
      const vSeen = new Set();                                   // объёмы, чей размер уже стоит в цепочке (id:ось)
      autoDims(e, R).forEach((sg, i) => { sg.R = R;
        if (sg.kind === 'H' || sg.kind === 'L') { const [k1, k0] = sg.kind === 'H' ? (sg.line > 0 ? ['B', 'C'] : ['A', 'D']) : ['B', 'A'], P1 = Cc(k1), P0 = Cc(k0), m0 = w3S3(R, [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2, (P0[2] + P1[2]) / 2]);
          const v = sg.kind === 'H' ? P1[1] - P0[1] : hyp(P1[0] - P0[0], P1[1] - P0[1]), side = sg.kind === 'H' ? (sg.line > 0 ? 'r' : 'l') : 't';
          const ed = sg.kind === 'L' ? (dv ? kbIs('eE', e.id, t => t.side === 't') : kbIs('wall', w.id)) : kbIs('eE', e.id, t => t.side === side), t = ed ? kbTxt() : num(v);
          const en = sg.kind === 'L' ? !!w.fx || !!(e.w3d && (e.w3d.A || e.w3d.B)) : !!(w.H || D.H) || !!(e.w3d && (e.w3d[k1] || e.w3d[k0]));
          const r = edimBox(t, m0[0], m0[1], sg.kind === 'H', ed, en, (sg.kind === 'H' ? Math.abs(P1[1] - P0[1]) : v) * V.s);
          EDL.push({id: e.id, k: sg.kind === 'H' ? 'eE' : dv ? 'eE' : 'L', side, i, s: sg, r}); return; }
        const ed = kbIs('eSeg', e.id, t => t.i === i), t = ed ? kbTxt() : num(sg.v), m = (sg.a + sg.b) / 2;
        let vo = sg.A && sg.B && sg.A.vol && sg.A.vol === sg.B.vol ? sg.A.vol.c : null;
        if (!vo) vo = D.com.find(c => c.e === e.id && (CK[c.k] || {}).D && comLay(c) && (() => { const r = cRect(c); return sg.ax === 'x' ? Math.abs(sg.a - r.x) < 1 && Math.abs(sg.b - r.x - r.w) < 1 && (sg.line < R.h / 2 ? r.y < 1 : r.y + r.h > R.h - 1) : Math.abs(sg.a - r.y) < 1 && Math.abs(sg.b - r.y - r.h) < 1 && (sg.line < R.w / 2 ? r.x < 1 : r.x + r.w > R.w - 1); })()) || null;   // отрезок ровно по объёму, объём у этой стороны стены — тоже его размер (82.35.14)
        const vf = vo && (CK[vo.k] || {}).D ? volFaces(vo) : null;   // размеры цепочек у стены — на своих гранях (82.35.13)
        if (vf && sg.ax === 'y' && vo.k !== 'kol') return;          // высота объёма — ниже, на его лицевых рёбрах
        if (vf) {                                                    // 82.35.12: размер объёма — на его внешней (лицевой) грани
          const en = sg.ax === 'y' && vo.k === 'kol' ? !!(w.H || D.H) : !!vo['fw' + sg.ax];
          const P0 = sg.ax === 'x' ? [sg.a, vf.y0, vf.z] : [vf.x1 < R.w - 0.5 ? vf.x1 : vf.x0, sg.a, vf.z], P1 = sg.ax === 'x' ? [sg.b, P0[1], vf.z] : [P0[0], sg.b, vf.z];
          const q0 = w3S3(R, P0), q1 = w3S3(R, P1), r = edimBox(t, (q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, sg.ax === 'y', ed, en, hyp(q1[0] - q0[0], q1[1] - q0[1]));
          vSeen.add(vo.id + ':' + sg.ax); EDL.push({id: e.id, k: 'seg', i, s: sg, r}); return; }
        if (D.com.some(c => c.e === e.id && (CK[c.k] || {}).D && comLay(c) && (() => { const r = cRect(c); return sg.ax === 'y' ? (sg.line < R.w / 2 ? r.x < 1 : r.x + r.w > R.w - 1) && sg.a >= r.y - 1 && sg.b <= r.y + r.h + 1 : (sg.line < R.h / 2 ? r.y < 1 : r.y + r.h > R.h - 1) && sg.a >= r.x - 1 && sg.b <= r.x + r.w + 1; })())) return;   // 82.35.16: отрезок стены за объёмом не виден и не меряется — без поля
        const fx = 'fp' + sg.ax, ent = sg.kind === 'L' ? !!w.fx : sg.kind === 'H' ? !!(w.H || D.H) : (sg.A && sg.B && sg.A.vol && sg.A.vol === sg.B.vol) ? (sg.ax === 'y' && sg.A.vol.c.k === 'kol' ? !!D.H : !!sg.A.vol.c['fw' + sg.ax]) : !!((sg.B && sg.B.vol && sg.B.vol.c[fx]) || (sg.A && sg.A.vol && sg.A.vol.c[fx + 'h']));
        const r = sg.ax === 'x' ? edimBox(t, x + m * V.s, y + H - sg.line * V.s, false, ed, ent, (sg.b - sg.a) * V.s) : edimBox(t, x + sg.line * V.s, y + H - m * V.s, true, ed, ent, (sg.b - sg.a) * V.s);
        EDL.push({id: e.id, k: sg.kind === 'L' ? 'L' : sg.kind === 'H' ? 'H' : 'seg', i, s: sg, r}); });
      for (const c of D.com) { if (c.e !== e.id || !(CK[c.k] || {}).D || !comLay(c)) continue; const vf = volFaces(c); if (!vf) continue;   // 82.35.12: ширина / высота объёма, не попавшие в цепочки, — на его лицевой грани
        const put = (kk, ax, P0, P1) => { const f = P0.map(Math.round).join(',') + '/' + P1.map(Math.round).join(','), ed = kbIs(kk, c.id, t => t.f === f), q0 = w3S3(R, P0), q1 = w3S3(R, P1), v = ax === 'x' ? vf.x1 - vf.x0 : vf.y1 - vf.y0;
          EDL.push({id: e.id, k: kk, c: c.id, f, r: edimBox(ed ? kbTxt() : num(v), (q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, ax === 'y', ed, !!c['fw' + ax], hyp(q1[0] - q0[0], q1[1] - q0[1]))}); };
        /* ═══ [BLOCK VOL-EDGES] 82.35.16: размер — на каждом доступном (видимом и измеряемом) ребре объёма ═══ */
        if (!vSeen.has(c.id + ':x')) put('cW', 'x', [vf.x0, vf.y0, vf.z], [vf.x1, vf.y0, vf.z]);   // низ лицевой грани
        put('cW', 'x', [vf.x0, vf.y1, vf.z], [vf.x1, vf.y1, vf.z]);                                  // верх лицевой грани (у потолка — примыкание)
        if (c.k !== 'kol') { for (const xx of [vf.x0, vf.x1]) put('cH', 'y', [xx, vf.y0, vf.z], [xx, vf.y1, vf.z]);   // лицевые вертикальные рёбра
          const room = xx => { const p = w3S3(R, [xx, (vf.y0 + vf.y1) / 2, 0]), q = w3S3(R, [xx, (vf.y0 + vf.y1) / 2, vf.z]); return Math.abs(q[0] - p[0]) > FLP() * fk() * 1.5; };   // разворот даёт место между задним и лицевым ребром
          for (const f of vf.F) { if (f.k === 'l' && vf.x0 > 0.5 && room(vf.x0)) put('cH', 'y', [vf.x0, vf.y0, 0], [vf.x0, vf.y1, 0]); if (f.k === 'r' && vf.x1 < R.w - 0.5 && room(vf.x1)) put('cH', 'y', [vf.x1, vf.y0, 0], [vf.x1, vf.y1, 0]); } }   // внутренний угол объёма со стеной
        /* ═══ [/BLOCK VOL-EDGES] ═══ */ }
      if (dv) { const P0 = Cc('D'), P1 = Cc('C'), Lb = hyp(P1[0] - P0[0], P1[1] - P0[1]), Lt = hyp(Cc('B')[0] - Cc('A')[0], Cc('B')[1] - Cc('A')[1]);
        if (Math.abs(Lb - Lt) > 0.5) { const m0 = w3S3(R, [(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2, 0]), ed = kbIs('eE', e.id, t => t.side === 'b'); EDL.push({id: e.id, k: 'eE', side: 'b', r: edimBox(ed ? kbTxt() : num(Lb), m0[0], m0[1], false, ed, !!(e.w3d.C || e.w3d.D), Lb * V.s)}); } }
      for (const c of D.com) { if (c.e !== e.id || !(CK[c.k] || {}).D || !comLay(c)) continue; const vf = volFaces(c); if (!vf) continue;   // 82.35.3: глубина — полем на боковой грани объёма
        /* 82.35.16: ребро глубины — доступное: 1) верх свободной боковой (не у стены, не у потолка) — видно и достаётся снизу; 2) низ свободной боковой над полом;
           3) низ боковой у стены (не над полом), не закрытый другим объёмом снизу — напр. ригель вдоль боковой стены; 4) низ свободной боковой по полу */
        const fr = [vf.x0 > 0.5 ? vf.x0 : null, vf.x1 < R.w - 0.5 ? vf.x1 : null].filter(x => x != null), wl = [vf.x0 <= 0.5 ? vf.x0 : null, vf.x1 >= R.w - 0.5 ? vf.x1 : null].filter(x => x != null);
        const cov = (x, y) => D.com.some(o => o !== c && o.e === e.id && (CK[o.k] || {}).D && comLay(o) && (() => { const r = cRect(o), xi = x <= 0.5 ? x + 1 : x - 1; return xi >= r.x && xi <= r.x + r.w && y - 1 >= r.y && y - 1 <= r.y + r.h; })());
        const dl = (x, y) => { const p = w3P(R, x, y, 0), q = w3P(R, x, y, vf.z); return hyp(q[0] - p[0], q[1] - p[1]); }, best = a => a.sort((u, v) => dl(v[0], v[1]) - dl(u[0], u[1]))[0];
        const pick = (vf.y1 < R.h - 0.5 && fr.length ? best(fr.map(x => [x, vf.y1])) : null) || (vf.y0 > 0.5 && fr.length ? best(fr.map(x => [x, vf.y0])) : null)
          || (vf.y0 > 0.5 ? best(wl.filter(x => !cov(x, vf.y0)).map(x => [x, vf.y0])) : null) || (fr.length ? best(fr.map(x => [x, vf.y0])) : null);
        if (!pick) continue; const [xx, yy] = pick;
        const a = w3P(R, xx, yy, 0), b = w3P(R, xx, yy, vf.z), ed = kbIs('cD', c.id), tt = ed ? kbTxt() : num(Math.abs(vf.z));
        let ang = Math.atan2(b[1] - a[1], b[0] - a[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        const rr = edimBoxA(tt, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ang, ed, !!c.D, hyp(b[0] - a[0], b[1] - a[1])); EDL.push({id: e.id, k: 'D', c: c.id, r: rr}); }
      const sc = C.sel && C.sel.t === 'com' && com(C.sel.id); if (sc && sc.e === e.id && CK[sc.k].rc) { const rr = cRect(sc);
        if (kbIs('cW', sc.id, t => !t.f)) edimBox('W ' + kbTxt(), x + (rr.x + rr.w / 2) * V.s, y + H - (rr.y + rr.h / 2) * V.s, false, true);
        if (kbIs('cH', sc.id, t => !t.f)) edimBox('H ' + kbTxt(), x + (rr.x + rr.w / 2) * V.s, y + H - (rr.y + rr.h / 2) * V.s, false, true); } }
  }
  function edHit(sx, sy) { let best = null, bd = 1e9; for (let i = EDL.length - 1; i >= 0; i--) { const o = EDL[i], r = o.r; if (!r.w) continue; const cx0 = r.x + r.w / 2, cy0 = r.y + r.h / 2, hw = Math.max(r.w / 2 + 4, 18), hh = Math.max(r.h / 2 + 4, 18);   // 82.35.14: мелкое поле — зона касания ≥ 36 px, ближайшее к пальцу
      if (Math.abs(sx - cx0) <= hw && Math.abs(sy - cy0) <= hh) { const d = hyp(sx - cx0, sy - cy0); if (d < bd) { bd = d; best = {t: 'edim', id: o.id, o, core: sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4}; } } } return best; }
  function edTap(h) {
    const o = h.o, e = elev(h.id), w = e && wall(e.wall); if (!w) return;
    if (o.k === 'L') { openKb('wall', w.id); }   // 82.35.19: касание поля — сразу ввод, объект не выделяется
    else if (o.k === 'H') { openKb('wH', e.wall); }   // 82.35.5: высота — этой стены
    else if (o.k === 'D') { openKb('cD', o.c); }
    else if (o.k === 'cW' || o.k === 'cH') { openKb(o.k, o.c); KB.tg.f = o.f; }   // 82.35.17: какое именно поле — набор видно только в нём
    else if (o.k === 'eE') { openKb('eE', e.id); KB.tg.side = o.side; KB.buf = String(rnd(eEdge(e, o.side))); KB.fresh = true; ui(); draw(); }   // грань — свой размер
    else if (o.k === 'seg') { openKb('eSeg', e.id); KB.tg.i = o.i; KB.tg.s = o.s; KB.buf = String(rnd(o.s.v)); }
    ui(); draw();
  }
  function segApply(tg, v) { if (tg.s) adApply(tg.s, v); }
  /* колонна / ниша на плане (вид сверху): у своей стены, ширина — по развёртке, глубина — Z (без Z — отрезок ширины по стене) */
  function drawPlanCols() {
    for (const c of D.com) { if (c.k !== 'kol' && c.k !== 'nis') continue; const e = elev(c.e), w = e && wall(e.wall), vw = w && wallView(w), a = vw && node(vw.a), b = vw && node(vw.b); if (!a || !b) continue;
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
    const sp = sl.querySelectorAll('.t span'), up = () => { sl.querySelector('.v').textContent = t === 'a' ? 'Наклон боковых стен · ' + W3.a + '°' : 'Размер полей · ' + Math.round(W3.f * 100) + ' %'; };
    if (t === 'a') { i.min = 0; i.max = 180; i.value = W3.a; [sp[0].textContent, sp[1].textContent, sp[2].textContent] = ['0° · вправо', '90° · прямо', '180° · влево']; }
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
  (() => { const m = $('zMenu'); m.innerHTML = '<button id="bExp">⇪ Выгрузка для Akrix</button><button id="bPenM"></button><button id="bCfg">⚙ Настройки</button><button id="bLay">◫ Слои</button><button id="bBak">💾 Резервная копия</button><button id="bRes">♻ Восстановить</button><button id="bRms">⌂ Помещения / группы стен</button><button id="bUpdChk">⟳ Проверить обновления</button><button id="bStripRs">Строки инструментов — по умолчанию</button>';
    $('bPenM').textContent = penTxt(); })();
  const mClose = () => $('zMenu').classList.remove('on');
  act($('bExp'), () => { mClose(); exportFile(); });
  act($('bPenM'), () => { PEN.on = !PEN.on; try { localStorage.setItem('akx-core-pen', PEN.on ? '1' : '0'); } catch (e) { } $('bPenM').textContent = penTxt(); mClose(); toast(penTxt()); });
  act($('bLay'), () => { mClose(); layPanel(); });
  act($('bCfg'), () => { mClose(); cfgPanel(); });
  /* 82.35.15: привязка после пересборки #zMenu (раньше вешалась на старые кнопки — пункты не работали) */
  act($('bStripRs'), () => { $('zMenu').classList.remove('on'); ST = clone(SDEF); stSave(); renderStrips(); toast('Строки инструментов — по умолчанию'); });
  act($('bUpdChk'), () => { $('zMenu').classList.remove('on'); const N = window.AkrixUpdate; if (N && N.check) N.check(); else toast('Обновление — только в приложении'); });
  act($('vwGo'), vwGo); act($('vwOff'), vwOff);
  /* ═══ [BLOCK C-CFG-UI] окно «Настройки Measure Lab» (82.18) на значениях ядра: вкладки «Вид и размеры», «Холст»; живой пример ═══ */
  let CFT = 'a';
  function cfgPanel() {
    let el = $('cfgS'); if (!el) { el = document.createElement('div'); el.id = 'cfgS'; el.className = 'sheet'; document.body.appendChild(el); }
    const num = (k, n, a, b, st, v) => `<div class="cr"><label>${n}</label><input type="range" min="${a}" max="${b}" step="${st}" value="${v}" data-cf="${k}"><input type="number" min="${a}" max="${b}" step="${st}" value="${v}" data-cf="${k}"><small>px</small></div>`;
    const tg = (k, n, m) => `<label class="row"><input type="checkbox" data-ct="${k}"${CFG[k] ? ' checked' : ''}> <span>${n}<br><small class="mu">${m}</small></span></label>`;
    const body = CFT === 'a' ? `<div class="cpv"><small class="mu">Живой пример · px экрана</small><svg id="cfSm" viewBox="0 0 480 112"></svg></div>` + num('lw', 'Толщина линий', 0.5, 12, 0.5, LW.v) + num('textPx', 'Размер текста', 6, 28, 1, CFG.textPx) + num('fieldPx', 'Размер полей', 10, 64, 1, CFG.fieldPx) + num('arrowPx', 'Наконечники стрелок', 4, 20, 1, CFG.arrowPx) + num('pointPx', 'Точки привязки', 2, 12, 1, CFG.pointPx) + '<p class="mu" style="padding:0 12px">Текст и поля — ещё × Aa; толщина мягко следует масштабу (×0,6…×2).</p>'
      : num('H', 'Высота стен по умолчанию', 1000, 9000, 10, CFG.H).replace('<small>px</small>', '<small>мм</small>') + tg('grid', 'Сетка', 'Клетки масштаба на холсте') + tg('side', 'Элементы на боковых стенах', 'Коммуникации и проёмы на раскрытых соседних стенах, без подписей') + `<div class="row"><span>Размеры</span><button data-da="0" class="${CFG.dimAct ? '' : 'on'}">все стены</button><button data-da="1" class="${CFG.dimAct ? 'on' : ''}">только активная</button></div>`;
    el.innerHTML = `<div class="hd"><b>Настройки Measure Lab</b><button data-x>✕</button></div><nav class="ctb"><button data-tab="a" class="${CFT === 'a' ? 'on' : ''}">Вид и размеры</button><button data-tab="c" class="${CFT === 'c' ? 'on' : ''}">Холст</button></nav>${body}<div class="ft"><button data-rs style="margin-right:auto">Сбросить</button><button data-x>Готово</button></div>`;
    const sm = () => { const q = $('cfSm'); if (!q) return; const lw = 1.6 * LW.v / 3, a = CFG.arrowPx, h = Math.max(CFG.fieldPx, CFG.textPx + 2), w = Math.max(h, 3.4 * CFG.textPx + h * 0.55);
      q.innerHTML = `<path d="M42 40H438V94H42Z" fill="#fff" stroke="#8997a7" stroke-width="${2.2 * LW.v / 3}"/><path d="M66 70H410" stroke="${C.col}" stroke-width="${lw}"/><path d="M66 70l${a} -${a * 0.38}v${a * 0.76}zM410 70l-${a} -${a * 0.38}v${a * 0.76}z" fill="${C.col}"/><rect x="${240 - w / 2}" y="${70 - h / 2}" width="${w}" height="${h}" rx="3" fill="#fff" stroke="#1a2027" stroke-width="1.2"/><text x="240" y="71" fill="#1a2027" text-anchor="middle" dominant-baseline="middle" font-family="system-ui" font-weight="700" font-size="${CFG.textPx}">2400</text><circle cx="42" cy="40" r="${CFG.pointPx}" fill="${COL.node}"/>`; };
    el.querySelectorAll('[data-cf]').forEach(i => i.oninput = () => { const k = i.dataset.cf, v = +i.value; if (!isFinite(v)) return;
      if (k === 'lw') { LW.v = Math.max(0.5, Math.min(12, v)); try { localStorage.setItem('akx-core-lw', LW.v); } catch (e) { } const t = $('tbLw'), o = $('tbLwV'); if (t) t.value = LW.v; if (o) o.textContent = String(LW.v).replace('.', ','); }
      else CFG[k] = Math.max(CFGR[k][0], Math.min(CFGR[k][1], v));
      el.querySelectorAll(`[data-cf="${k}"]`).forEach(j => { if (j !== i) j.value = k === 'lw' ? LW.v : CFG[k]; }); cfgSv(); sm(); draw(); });
    el.querySelectorAll('[data-ct]').forEach(i => i.onchange = () => { CFG[i.dataset.ct] = i.checked; cfgSv(); draw(); });
    el.querySelectorAll('[data-da]').forEach(b => act(b, () => { CFG.dimAct = b.dataset.da === '1'; cfgSv(); cfgPanel(); draw(); }));
    el.querySelectorAll('[data-tab]').forEach(b => act(b, () => { CFT = b.dataset.tab; cfgPanel(); }));
    act(el.querySelector('[data-rs]'), () => { Object.assign(CFG, CFG0); cfgSv(); cfgPanel(); draw(); });
    el.querySelectorAll('[data-x]').forEach(b => act(b, () => el.classList.remove('on'))); el.classList.add('on'); sm();
  }
  act($('bBak'), () => { mClose(); exportPrj(); });
  act($('bRes'), () => { mClose(); impIn.click(); });
  act($('bRms'), () => { mClose(); roomList(); });

  /* ═══ [BLOCK C-REST] Остальное по приложению (12.11.2026): привязка объектов стены к граням других; выбор стен С1…Сn вверху (82.13);
     распознавание по фото стены на телефоне (fwRectify + fwDetect 82.13, fw-cv.js) — найденное пунктиром на развёртке:
     касание — на стену, «✓ всё» — всё на стену, «✕» — убрать найденное; 🔍 — распознать снова. ═══ */
  function objSnap(c, R, xs, ys) {                               // кандидаты привязки: края стены, грани и центры других объектов той же стены
    const X = [0, R.w], Y = [0, R.h];
    for (const o of D.com) { if (o === c || o.e !== c.e) continue; const K = CK[o.k]; if (K.rc) { const r = cRect(o); X.push(r.x, r.x + r.w); Y.push(r.y, r.y + r.h); } else if (K.pt) { X.push(o.x); Y.push(o.y); } }
    const t = 10 / V.s, best = (vals, cand) => { let d = t, out = null; for (const [v, off] of vals) for (const q of cand) if (Math.abs(q - v) < d) { d = Math.abs(q - v); out = q - v; } return out; };
    return {dx: best(xs, X), dy: best(ys, Y)};
  }
  /* выбор стен вверху */
  function chipsUi() {
    const el = $('wChips'); if (!el) return; const ws = D ? D.walls.filter(w => !w.off).sort((a, b) => a.gn - b.gn) : [];   // выключенная — не во вкладках
    el.classList.toggle('on', ws.length > 0); const cur = C.sel && C.sel.t === 'elev' && elev(C.sel.id) ? elev(C.sel.id).wall : C.sel && C.sel.t === 'wall' ? C.sel.id : null;
    el.innerHTML = ws.map(w => `<button data-w="${w.id}" class="${w.id === cur ? 'on' : ''}${D.elev.some(e => e.wall === w.id) ? '' : ' no'}">С${w.gn}</button>`).join('');
    el.querySelectorAll('[data-w]').forEach(b => act(b, () => { const w = wall(b.dataset.w); if (w) addElev(w); }));
  }
  /* распознавание */
  const fnd = id => D.found.find(f => f.id === id);
  const FK2 = {roz: 'roz', vyk: 'vyk', svet: 'svet', slab: 'slab', hvs: 'hvs', gvs: 'gvs', kan: 'kan', gaz: 'gaz', vent: 'vent', win: 'win', door: 'door', nis: 'nis', kor: 'kor', kol: 'kol', shch: 'shield', zone: 'zon'};
  async function recognize(f) {
    const p = photo(f.ph), w = f.wall && wall(f.wall), e = w && D.elev.find(x => x.wall === w.id); if (!p || !e || !window.MeasureFW) { toast('Распознавание: нет фото / стены'); return; }
    const R0 = elevRect(e), L = R0.w, H = R0.h; toast('Распознаю на телефоне…');
    try {
      const b = await get('img', p.img); if (!b) throw new Error('нет фото'); const img = await MeasureFW.img(b, 1200), k = img.W / p.iw;
      const qi = f.q.map(([u, v]) => [u * p.iw * k, v * p.ih * k]), R = MeasureFW.rectify(img, qi, L, H); if (!R) throw new Error('углы рамки — неверно');
      const items = MeasureFW.detect(R, {}) || [], out = [];   // fwDetect отдаёт мм выпрямленной стены (x — от левого края, y — от верха)
      for (const it of items) {
        if ((it.k === 'rt' || it.k === 'st') && it.pts) { const [a, c] = it.pts; out.push({id: uid('f'), e: e.id, k: 'wrt', a: [rnd(a[0]), rnd(H - a[1])], b: [rnd(c[0]), rnd(H - c[1])], t: RTT.some(x => x[0] === it.t) ? it.t : 'el', conf: it.conf}); continue; }
        const kk = FK2[it.k]; if (!kk || it.x0 == null) continue; const x0 = it.x0, x1 = it.x1, y0 = H - it.y1, y1 = H - it.y0;
        if (CK[kk].pt) { const N = Math.max(1, Math.min(5, it.n || 1)); out.push({id: uid('f'), e: e.id, k: kk, x: rnd(CK[kk].ps && N > 1 ? x0 + PSTEP / 2 : (x0 + x1) / 2), y: rnd((y0 + y1) / 2), N, conf: it.conf}); }
        else out.push({id: uid('f'), e: e.id, k: kk, x: rnd(x0), y: rnd(y0), w: rnd(x1 - x0), h: rnd(y1 - y0), conf: it.conf});
      }
      begin(); D.found = D.found.filter(x => x.e !== e.id).concat(out); C.sel = {t: 'elev', id: e.id}; commit();
      toast(out.length ? `Найдено: ${out.length} · касание — на стену, «✓ всё» — всё` : 'Ничего не найдено — ставьте вручную');
    } catch (err) { toast('Распознавание: ' + err.message); }
  }
  function foundPut(ids) {
    begin(); for (const id of ids) { const f = fnd(id); if (!f || !elev(f.e)) continue; const o = {id: uid('c'), k: f.k, e: f.e};
      if (f.k === 'wrt') Object.assign(o, {a: f.a, b: f.b, t: f.t}); else if (CK[f.k].pt) Object.assign(o, {x: f.x, y: f.y, N: f.N}); else Object.assign(o, {x: f.x, y: f.y, w: f.w, h: f.h}); D.com.push(o); }
    D.found = D.found.filter(f => !ids.includes(f.id)); commit();
  }
  function drawFound() {
    for (const f of D.found) { const e = elev(f.e); if (!e) continue; const R = elevRect(e), col = (CK[f.k] || CK.zon).c; cx.strokeStyle = col; cx.lineWidth = 2; cx.setLineDash([3, 3]);
      if (f.k === 'wrt') { const A = w2s(R, f.a[0], f.a[1]), B = w2s(R, f.b[0], f.b[1]); cx.beginPath(); cx.moveTo(A[0], A[1]); cx.lineTo(B[0], B[1]); cx.stroke(); cx.setLineDash([]); continue; }
      const z = CK[f.k].pt ? Math.max(1, 60 * V.s) : 0,   /* 82.35.22: в габаритах */ A = CK[f.k].pt ? w2s(R, f.x, f.y) : w2s(R, f.x, f.y + f.h), B = CK[f.k].pt ? null : w2s(R, f.x + f.w, f.y);
      if (B) cx.strokeRect(A[0], A[1], B[0] - A[0], B[1] - A[1]); else { cx.beginPath(); cx.arc(A[0], A[1], z / 2, 0, 7); cx.stroke(); }
      cx.setLineDash([]); cx.font = '700 11px system-ui'; cx.fillStyle = col; cx.textAlign = 'left'; cx.textBaseline = 'bottom'; cx.fillText('? ' + (CK[f.k] || {n: f.k}).n + (f.N > 1 ? ' ×' + f.N : ''), A[0] + (B ? 2 : z / 2 + 2), A[1] - 2); }
  }
  function foundHit(sx, sy) {
    for (let i = D.found.length - 1; i >= 0; i--) { const f = D.found[i], e = elev(f.e); if (!e) continue; const R = elevRect(e);
      if (f.k === 'wrt') { if (segDist([sx, sy], w2s(R, f.a[0], f.a[1]), w2s(R, f.b[0], f.b[1])) < 12) return {t: 'found', id: f.id}; continue; }
      if (CK[f.k].pt) { const A = w2s(R, f.x, f.y); if (hyp(A[0] - sx, A[1] - sy) < 22) return {t: 'found', id: f.id}; continue; }
      const A = w2s(R, f.x, f.y + f.h), B = w2s(R, f.x + f.w, f.y); if (sx >= A[0] - 4 && sx <= B[0] + 4 && sy >= A[1] - 4 && sy <= B[1] + 4) return {t: 'found', id: f.id}; }
    return null;
  }
  function restAct(s, B) {
    const e = s && s.t === 'elev' && elev(s.id), fs = e ? D.found.filter(f => f.e === e.id) : [];
    if (fs.length) { B.push(['✓', () => { foundPut(fs.map(f => f.id)); toast('На стену: ' + fs.length); }, 'Всё найденное — на стену']); B.push(['✕', () => { begin(); D.found = D.found.filter(f => f.e !== e.id); commit(); }, 'Убрать найденное']); }
    const fr = s && s.t === 'frame' ? frame(s.id) : e ? D.frames.find(f => f.wall === e.wall) : null;
    if (fr && fr.wall) B.push(['🔍', () => recognize(fr), 'Распознать по фото (на телефоне)']);
  }

  /* ═══ [BLOCK C-EXP] Б7 выгрузка для Akrix — контракт `akrix-zamer`, kind:object, v:3 (как v81 / 82.18: rooms[].ms — pts, closed, dims, H, wl, ccw, gn, wid, geo, wsd, labRooms; prd).
     Связная цепочка стен плана → помещение выгрузки; замкнутая — ccw (y вверх), X элементов — от левого края при взгляде из помещения; открытая — от узла a.
     Стены — постоянные id (w.id), С№ — gn. Элементы: AK_RC / AK_PT / ZN v81; d — Z (|Z|). Трассы, фасон, изделия — не выгружаются (в ядре нет записи v81 для них). ═══ */
  const AK_PT = {wire: 'el', roz: 'so', vyk: 'sw', svet: 'li', slab: 'wi', hvs: 'wa', gvs: 'wh', kan: 'dr', gaz: 'ga', vent: 've'}, AK_RC = {win: 'win', door: 'door', nis: 'niche', kol: 'col', rig: 'beam', kor: 'box'}, AK_ZN = {zon: 'zon', znd: 'znd', znt: 'znt', znf: 'znf', shield: 'shield'};
  function chainsOfPlan() {
    const left = new Set(D.walls.map(w => w.id)), out = [];
    const other = (w, n) => (w.a === n ? w.b : w.a);
    while (left.size) {
      const comp = []; const st = [D.walls.find(w => left.has(w.id))]; while (st.length) { const w = st.pop(); if (!left.has(w.id)) continue; left.delete(w.id); comp.push(w); for (const o of D.walls) if (left.has(o.id) && [o.a, o.b].some(n => n === w.a || n === w.b)) st.push(o); }
      const dg = n => comp.filter(w => w.a === n || w.b === n).length; let start = comp.map(w => [w.a, w.b]).flat().find(n => dg(n) === 1) || comp[0].a;
      const used = new Set(), seq = [], nodes = [start]; let cur = start;
      for (;;) { const w = comp.find(x => !used.has(x.id) && (x.a === cur || x.b === cur)); if (!w) break; used.add(w.id); seq.push(w); cur = other(w, cur); nodes.push(cur); }
      const closed = seq.length > 2 && nodes[0] === nodes[nodes.length - 1]; if (closed) nodes.pop();
      out.push({walls: seq, nodes, closed, rest: comp.filter(w => !used.has(w.id))});
      for (const w of comp.filter(w => !used.has(w.id))) left.add(w.id);   // ветвление — оставшиеся стены следующей цепочкой
    }
    return out;
  }
  /* вид стены — из помещения (82.13): у стены замкнутого контура левый край развёртки (x = 0) — левый при взгляде изнутри; у открытой цепочки — узел a */
  function wallView(w) {
    const ch = chainsOfPlan().find(c => c.closed && c.walls.some(x => x.id === w.id)); if (!ch) return {a: w.a, b: w.b};
    const poly = ch.nodes.map(id => node(id)), a = node(w.a), b = node(w.b), L = wLen(w) || 1, m = {x: (a.x + b.x) / 2 - (b.y - a.y) / L * 30, y: (a.y + b.y) / 2 + (b.x - a.x) / L * 30};
    return inPoly(m, poly) ? {a: w.a, b: w.b} : {a: w.b, b: w.a};
  }
  function exportAkrix() {
    if (!D.walls.length) { toast('Выгрузка: на плане нет стен'); return null; }
    const date = new Date().toISOString(), H = Hmm() || 0, rooms = [], gnMax = Math.max(0, ...D.walls.map(w => w.gn));
    for (const ch of chainsOfPlan()) {
      const nodes = ch.nodes.map(id => node(id)), walls = ch.walls.slice(), o0 = nodes[0], E = n => [rnd(n.x - o0.x), rnd(n.y - o0.y)];   // оси как в v81: y вниз (пример 82.18: pts [0,0]…[4000,-3000], ccw:true)
      const P = nodes.map(E), area = P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
      const poly = nodes.map(n => ({x: n.x, y: n.y})), wl = {}, gnM = {}, wid = {}, wsd = {}, gw = [], dims = [];
      walls.forEach((w, k) => {
        const pa = nodes[k], L = rnd(wLen(w)), e = D.elev.find(x => x.wall === w.id), Hw = H;
        const flip = false; void pa;                             // X развёртки ядра — уже от левого края при взгляде из помещения (wallView), как v81
        const X = (x, wd) => rnd(flip ? L - x - (wd || 0) : x), els = [], pts = [], zn = []; let no = 0;
        for (const c of D.com) { if (!e || c.e !== e.id) continue; const K = CK[c.k];
          if (AK_RC[c.k]) { const r = cRect(c), o = {id: c.id, t: AK_RC[c.k], x0: X(r.x, r.w), x1: X(r.x, r.w) + rnd(r.w), y0: rnd(r.y), y1: rnd(r.y + r.h), note: '', no: ++no}; if (c.D) o.d = rnd(Math.abs(c.D)); els.push(o); }
          else if (AK_PT[c.k] || c.k === 'rv') { const vt = c.o === 'v', NN = c.N || 1;   // ↕ — поле o: 'v'; rv — розетки + выключатель отдельной точкой (вопрос конструктору записан)
            const put = (id, t, n, x0, y0) => { const N = n > 1 ? n : null; pts.push({id, t, x: N && !vt ? X(x0, (N - 1) * PSTEP) : X(x0), y: rnd(y0), D: null, N, st: N ? PSTEP : null, ...(N && vt ? {o: 'v'} : {}), note: '', no: ++no}); };
            if (c.k === 'rv') { const q = postsW(c)[NN - 1]; if (NN > 1) put(c.id, 'so', NN - 1, c.x, c.y); put(c.id + '-sw', 'sw', 1, q.x, q.y); } else put(c.id, AK_PT[c.k], NN, c.x, c.y); }
          else if (AK_ZN[c.k]) { const r = cRect(c), o = {id: c.id, t: AK_ZN[c.k], x: X(r.x, r.w), y: rnd(r.y), W: rnd(r.w), H: rnd(r.h), note: ''}; if (c.D) o.d = rnd(Math.abs(c.D)); zn.push(o); }
          void K; }
        wl[k] = {H: Hw, els, pts, zn, gn: w.gn, id: w.id, L}; gnM[k] = w.gn; wid[k] = w.id; wsd[k] = 1;
        const q = k + 1 < P.length ? k + 1 : 0; dims.push({id: 'ql' + k, a: {p: k}, b: {p: q}, v: L});
        gw.push({k, gn: w.gn, id: w.id, a: P[k], b: P[q] || P[k], L, ok: 1, ...(ch.closed && k === walls.length - 1 ? {cl: 1} : {})});
      });
      const labRooms = D.rooms.filter(r => r.walls.some(id => walls.some(w => w.id === id))).map((r, i) => ({id: r.id, zn: i + 1, name: r.name, pts: r.poly.map(([x, y]) => [rnd(x - o0.x), rnd(y - o0.y)]), walls: r.walls.filter(id => walls.some(w => w.id === id))}));
      const rid = 'r_' + walls[0].id, nm = labRooms.length === 1 ? labRooms[0].name : '';
      rooms.push({app: 'akrix-zamer', v: 3, kind: 'room', id: rid, date, obj: D.name || '', name: nm,
        ms: {labRooms, labDividers: [], v: 1, lvl: 'd', pts: P, closed: ch.closed, dims, angs: Object.fromEntries(nodes.map((n, i) => [i, n.ang]).filter(q => q[1])), ink: [], H, wl, ccw: ch.closed ? area < 0 : false, arcs: {}, rnd: {}, gn: gnM, wid,
          geo: {v: 1, rules: 'zamer-18', walls: gw, err: 0, rnd: {}, mm: 0}, wsd}});
    }
    return {app: 'akrix-zamer', v: 3, kind: 'object', date, obj: D.name || '', oid: D.id, rooms, gnMax, prd: []};
  }
  async function exportFile() {
    const o = exportAkrix(); if (!o) return null; await save(); const txt = JSON.stringify(o);
    const fn = 'zamer-' + ((D.name || 'объект').replace(/[^\wа-яё .-]+/gi, '_').slice(0, 40)) + '-' + new Date().toISOString().slice(0, 10) + '.json';
    if (window.AkrixApp && AkrixApp.save) { AkrixApp.save(fn, 'application/json', txt); toast('Выгрузка: Загрузки/Akrix · ' + fn); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type: 'application/json'})); a.download = fn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); toast('Выгрузка: ' + fn); }
    return o;
  }

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
    else if (e.type === 'apk-ready') updCard('Установка приложения ' + (e.versionName || ''));
    else if (e.type === 'apk-failed') updCard('Не удалось скачать приложение: ' + (e.reason || ''), 'Повторить', () => N.downloadApk());
    else if (!e.manual) return;                                  // 82.35: при ручной проверке — каждый исход
    else if (e.type === 'none') { let st = null; try { st = JSON.parse(N.state()); } catch (x) { }   // 82.35.15: уже скачанная (ждёт перезапуска) версия — не «обновлений нет», а «Перезапустить»
      if (st && st.pending && st.pending !== st.version) updCard('Загружена версия ' + st.pending, 'Перезапустить', () => save().then(() => N.restart()));
      else updCard('Последняя версия ' + (e.version || '') + ' — обновлений нет'); }
    else if (e.type === 'checking') updCard('Проверка обновлений…');
    else if (e.type === 'busy') updCard('Проверка уже идёт');
    else if (e.type === 'offline') updCard('Нет связи с сервером обновлений');
    else if (e.type === 'error') updCard('Ошибка проверки: ' + (e.reason || ''));
    else if (e.type === 'web-downloading') updCard('Загрузка версии ' + (e.version || '') + '…');
    else if (e.type === 'web-needs-apk') updCard('Версия ' + (e.version || '') + ' — нужно новое приложение');
    else if (e.type === 'web-failed') updCard('Не удалось загрузить: ' + (e.reason || ''));
    else updCard('Обновление: ' + e.type);
  };
  function updReady() { const N = window.AkrixUpdate; if (N && typeof N.ready === 'function') try { N.ready(String(window.MeasureVersion || '')); } catch (e) { } }

  /* ═══ [BLOCK C-API] для проверки и будущего переходника выгрузки v3 ═══ */
  window.MeasureCore = {w3px: () => W3PX.map(o => ({...o})), w3Sides: id => w3Sides(elev(id), elevRect(elev(id))).map(q => ({sd: q.sd, vis: q.vis, sx: q.sx, sz: q.sz, Dp: q.Dp})), scaleInfo: () => { let st = 100; while (st * V.s < 14) st *= 10; return {cell: st}; }, get doc() { return D; }, get view() { return V; }, get sel() { return C.sel; }, set sel(v) { C.sel = v; draw(); }, set sel(v) { C.sel = v; ui(); draw(); }, get tool() { return C.tool; }, get crop() { return C.crop; }, get msel() { return C.msel; }, frPts, rsPick, drwPts: id => drwW(drw(id)), get phHide() { return C.phHide; }, draw: () => draw(), recognize: id => recognize(frame(id)), exportAkrix, edl: () => EDL.map(o => ({k: o.k, i: o.i, s: o.s, r: o.r})), elabels: () => [...ELBL.values()], exportPrj, importPrj, allPrj, btVal, roomWalls, comPx: id => comPx(com(id)), cRect: id => cRect(com(id)), get col() { return C.col; }, get lw() { return LW.v; }, hs: HS, toS, toW, hit, endPos, dimVal, dlabels: () => [...DLBL].map(([id, r]) => ({id, ...r})), get kb() { return KB.tg; }, save, fitAll, wLen, phH, elevRect, labels: () => [...LBL].map(([id, r]) => ({id, ...r}))};

  /* ═══ [BLOCK C-INIT] ═══ */
  (async () => {
    try { await dbOpen(); await load(); } catch (e) { console.error(e); D = newDoc(); }
    $('labPrjT').value = D.name; resize(); ui();
    window.MeasureCore.ready = true; updReady();
  })();
})();
