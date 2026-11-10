/* Measure 82.18 — «Скетч»: холст объекта (как DrawNote) поверх штатного холста v81.
   Решение владельца 10.11.2026: один бесконечный холст — фото, рендеры, пометки, стены и общий план помещений видны сразу;
   стены и план — области холста, правятся ОБЩИМ набором инструментов приложения: касание области делает её активной,
   вид v81 совмещается с её местом на холсте; неактивные области — снимки последнего вида.
   Фото → 4 угла → стена над фото (нет места — под фото); фото на стену не заливается — остаётся рядом на холсте. Последовательность стен, колонны, выступы, ниши — на общем плане.
   82.18 (AKX-2026-0008/0009, проект архитектора): своей строки холста нет — команды холста в штатном футляре (lab-tb.js),
   действия выбранного фото — блоком в нижней строке (#zpb); стена холста открывается в разметке (⌖).
   Работает поверх неизменной v81: S, cv, cx, draw, fit, plFit, openSess, openRoom, newRoom, dbGet/dbPut/dbAll, saveNow, saveRoom … */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabSketch) return;
  const api = window.MeasureLabSketch = {};

  /* ═══ [BLOCK SK-CONST] ═══ */
  const DPR = () => devicePixelRatio || 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = o => JSON.parse(JSON.stringify(o, (k, v) => k[0] === '_' ? undefined : v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const say = t => { try { toast(t); } catch (e) { } };
  const cfg = () => (window.MeasureLabSettings && MeasureLabSettings.current) || {textPx: 13, fieldPx: 22, linePx: 2.2, arrowPx: 9, pointPx: 5, grid: true, snap: true};
  const fsz = sz => Math.max(6, sz * cfg().textPx / 13);                 // текст ≥ 6 px
  const pr = () => Math.max(3, cfg().pointPx * 1.8);                    // точка
  const PLAN_K = 0.12, GAP = 40;                                       // масштаб плана (ед. холста на мм), зазор
  const WM = {x: 1300, b: 800, t: 300};                                // поля области стены, мм: развёртка боковых стен, пол, подписи сверху
  api.metrics = () => ({text: fsz(13), point: pr()});

  /* ═══ [BLOCK SK-STATE] модель холста ═══
     items: photo {id, t:'photo', x, y, w, iw, ih, cor: [[ix,iy]×4 ЛВ ПВ ПН ЛН] | null, wall?: id области стены}
            wall  {id, t:'wall', sid, ax, ay, k, L, H, name, snap?}   — (X, Y) мм стены → (ax + X·k, ay − Y·k)
            plan  {id, t:'plan', obj, ax, ay, k, snap?}               — (X, Y) мм плана → (ax + X·k, ay − Y·k)
            note  {id, t:'note', x, y, tx}
     view: холст → px CSS холста v81: (x·s + ox, y·s + oy) */
  const K = api.state = {on: false, obj: '', items: [], view: {ox: 20, oy: 80, s: 0.4}, sel: null, cor: null, imgs: {}, snaps: {}, rooms: [], quiet: 0};
  const byId = id => K.items.find(i => i.id === id);

  /* ═══ [BLOCK SK-DB] своя база IndexedDB akrix-sketch (холст и фото); база замеров v81 — только штатными записями стен ═══ */
  const SDB = {db: null};
  function sdbOpen() {
    if (SDB.db) return Promise.resolve(SDB.db);
    return new Promise(res => { try { const r = indexedDB.open('akrix-sketch', 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('sk')) d.createObjectStore('sk', {keyPath: 'obj'}); if (!d.objectStoreNames.contains('img')) d.createObjectStore('img'); };
      r.onsuccess = () => { SDB.db = r.result; res(SDB.db); }; r.onerror = () => res(null); } catch (e) { res(null); } });
  }
  async function stx(store, mode, fn) {
    const db = await sdbOpen(); if (!db) return null;
    return new Promise((res, rej) => { const t = db.transaction(store, mode), q = fn(t.objectStore(store)); let out; if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  const sPut = (st, v, k) => stx(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k));
  const sGet = (st, k) => stx(st, 'readonly', s => s.get(k));
  const sAll = st => stx(st, 'readonly', s => s.getAll());
  api.db = {open: sdbOpen, put: sPut, get: sGet, all: sAll};
  let saveT = 0;
  const rec = () => ({obj: K.obj, v: 2, items: K.items, view: K.view, upd: Date.now()});
  function save() { clearTimeout(saveT); saveT = setTimeout(saveNowSk, 400); }
  async function saveNowSk() { clearTimeout(saveT); if (!K.obj) return; try { await sPut('sk', clone(rec())); } catch (e) { } }
  api.saveNow = saveNowSk;

  /* ═══ [BLOCK SK-MAP] холст ↔ вид v81 активной области ═══ */
  const toScrK = (x, y) => [(x * K.view.s + K.view.ox) * DPR(), (y * K.view.s + K.view.oy) * DPR()];   // холст → px устройства
  const toK = (px, py) => [(px / DPR() - K.view.ox) / K.view.s, (py / DPR() - K.view.oy) / K.view.s];   // px устройства → холст
  const nat2k = (it, X, Y) => [it.ax + X * it.k, it.ay - Y * it.k];
  function syncToS(it) { const d = DPR(); S.view = {s: K.view.s * it.k * d, rot: 0, ox: (K.view.ox + it.ax * K.view.s) * d, oy: (K.view.oy + it.ay * K.view.s) * d}; }
  function syncFromS(it) { const v = S.view, d = DPR(); if (!v || !(v.s > 0)) return; const s = v.s / (it.k * d); K.view = {s, ox: v.ox / d - it.ax * s, oy: v.oy / d - it.ay * s}; }
  api.map = {toScrK, toK, nat2k, syncToS, syncFromS};
  function activeKind() { if (S.mode === 'plan' && S.room) return S.room.obj === K.obj ? 'plan' : null; return S.sess && S.mosaic && S.show < 0 && !$('ss').classList.contains('on') ? 'wall' : null; }
  function active() {
    const t = activeKind(); if (!t) return null;
    if (t === 'plan') return K.items.find(i => i.t === 'plan') || null;
    return K.items.find(i => i.t === 'wall' && i.sid === S.sess.id) || null;
  }
  api.active = active;
  function nativeOnly() {   // F6: открыто штатное, но не область холста (стена до 4 углов, кадр, список замеров) — v81 рисует и принимает касания сама
    if (activeKind()) return false;
    return S.mode === 'plan' ? !!S.room : !!S.sess;
  }
  api.nativeOnly = nativeOnly;
  function planBox() { const rs = activeKind() === 'plan' ? [S.room, ...(S.objRooms || [])] : K.rooms, P = []; for (const r of rs) if (r && r.ms && !r.pstub && !r.del) P.push(...(r.ms.pts || [])); if (!P.length) return [0, 0, 6000, 4000];
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]); return [Math.min(...xs) - 900, Math.min(...ys) - 900, Math.max(...xs) + 900, Math.max(...ys) + 900]; }
  function region(it) {   // область в единицах холста: стена — L×H + развёртка боковых и пол; план — все помещения объекта + поле
    if (it.t === 'wall') { const L = +it.L || 3000, H = +it.H || 2700, a = nat2k(it, -WM.x, H + WM.t), b = nat2k(it, L + WM.x, -WM.b); return {x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1]}; }
    if (it.t === 'plan') { const [x0, y0, x1, y1] = planBox(), a = nat2k(it, x0, y1), b = nat2k(it, x1, y0); return {x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1]}; }
    if (it.t === 'photo') return {x: it.x, y: it.y, w: it.w, h: it.w * (it.ih || 3) / (it.iw || 4)};
    if (it.t === 'note') { const f = fsz(15) / K.view.s; return {x: it.x - 4 / K.view.s, y: it.y - f, w: (it.tx || 'заметка').length * f * .6 + 8 / K.view.s, h: f * 1.4}; }
    return {x: 0, y: 0, w: 0, h: 0};
  }
  api.region = region;
  const inR = (r, p, m = 0) => p[0] >= r.x - m && p[0] <= r.x + r.w + m && p[1] >= r.y - m && p[1] <= r.y + r.h + m;
  const ovl = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function titleR(it) { const r = region(it), f = fsz(15) / K.view.s; return {x: r.x, y: r.y - f * 1.7, w: Math.max(r.w * .6, 160 / K.view.s), h: f * 1.6}; }
  function title(it) { if (it.t === 'plan') return 'План помещений · ' + (K.obj || ''); const L = Math.round(+it.L || 0), H = Math.round(+it.H || 0); return (it.name || 'Стена') + (L && H ? ` · ${L} × ${H}` : ''); }

  /* ═══ [BLOCK SK-DRAW] отрисовка: слой холста, затем активная область — штатной v81 в своей рамке ═══ */
  const draw81 = draw;
  function label(x, y, t, c, px, sz) {   // подписи — в px экрана (как подписи приложения; размер текста — из настроек Lab)
    const d = DPR(), s = toScrK(x, y), f = fsz(sz) * d; cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.font = `700 ${f}px system-ui`; const w = cx.measureText(t).width, fh = parseFloat(cx.font) || f;
    cx.fillStyle = 'rgba(255,255,255,.9)'; cx.fillRect(s[0] - 3 * d, s[1] - fh, w + 6 * d, fh * 1.3); cx.fillStyle = c; cx.fillText(t, s[0], s[1]); cx.restore(); void px; }
  function paintLayer(act) {
    const d = DPR(); cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#E9ECF0'; cx.fillRect(0, 0, cv.width, cv.height);
    const s = K.view.s * d; cx.setTransform(s, 0, 0, s, K.view.ox * d, K.view.oy * d); const px = 1 / K.view.s;
    if (cfg().grid !== false) { const a = toK(0, 0), b = toK(cv.width, cv.height); let st = 100; while (st * K.view.s < 18) st *= 5; cx.strokeStyle = 'rgba(26,32,39,.07)'; cx.lineWidth = px; cx.beginPath();
      for (let x = Math.floor(a[0] / st) * st; x < b[0]; x += st) { cx.moveTo(x, a[1]); cx.lineTo(x, b[1]); } for (let y = Math.floor(a[1] / st) * st; y < b[1]; y += st) { cx.moveTo(a[0], y); cx.lineTo(b[0], y); } cx.stroke(); }
    for (const it of K.items) {
      if (it.t === 'photo') { const r = region(it), im = K.imgs[it.id]; if (im) cx.drawImage(im, r.x, r.y, r.w, r.h); else { cx.fillStyle = '#CDD2D9'; cx.fillRect(r.x, r.y, r.w, r.h); }
        if (it.cor) { const P = it.cor.map(q => [r.x + q[0] * r.w / it.iw, r.y + q[1] * r.w / it.iw]); cx.strokeStyle = '#F6B400'; cx.lineWidth = 2.5 * px; cx.setLineDash([8 * px, 5 * px]); cx.beginPath(); P.forEach((q, i) => i ? cx.lineTo(...q) : cx.moveTo(...q)); cx.closePath(); cx.stroke(); cx.setLineDash([]); }
        continue; }
      if (it.t === 'note') { label(it.x, it.y, it.tx || 'заметка', K.sel === it.id ? '#1F6FD1' : '#1A2027', px, 15); continue; }
      const r = region(it); label(r.x, r.y - fsz(15) * .5 * px, title(it), it === act ? '#1F6FD1' : '#3E4954', px, 15);
      if (it === act) continue;
      const sn = K.snaps[it.id]; if (sn && sn.img) cx.drawImage(sn.img, sn.x, sn.y, sn.w, sn.h);
      else { cx.fillStyle = it.t === 'plan' ? '#F4F6F8' : '#F7F8FA'; cx.fillRect(r.x, r.y, r.w, r.h); cx.strokeStyle = '#B8C0CA'; cx.lineWidth = px; cx.setLineDash([6 * px, 4 * px]); cx.strokeRect(r.x, r.y, r.w, r.h); cx.setLineDash([]);
        label(r.x + 12 * px, r.y + r.h / 2, it.t === 'plan' ? (K.rooms.length ? 'Коснитесь — план помещений' : 'Коснитесь — новое помещение') : 'Коснитесь — открыть стену', '#6B7380', px, 13); }
    }
    cx.restore();
  }
  function paintOver(act) {   // рамка активной области, выбор, углы — поверх
    const d = DPR(), s = K.view.s * d; cx.save(); cx.setTransform(s, 0, 0, s, K.view.ox * d, K.view.oy * d); const px = 1 / K.view.s;
    if (act) { const r = region(act); cx.strokeStyle = '#1F6FD1'; cx.lineWidth = 2 * px; cx.strokeRect(r.x, r.y, r.w, r.h); }
    const sel = K.sel && byId(K.sel);
    if (sel && sel !== act) { const r = region(sel); cx.strokeStyle = '#1F6FD1'; cx.lineWidth = 3 * px; cx.strokeRect(r.x, r.y, r.w, r.h); }
    if (sel && sel.t === 'photo') { const r = region(sel), P = (K.cor && K.cor.id === sel.id ? K.cor.pts : sel.cor || []).map(q => [r.x + q[0] * r.w / sel.iw, r.y + q[1] * r.w / sel.iw]);
      P.forEach((q, i) => { cx.fillStyle = '#F6B400'; cx.beginPath(); cx.arc(q[0], q[1], pr() * px, 0, 7); cx.fill(); label(q[0] + (pr() + 3) * px, q[1] - pr() * px, ['ЛВ', 'ПВ', 'ПН', 'ЛН'][i], '#B07F00', px, 12); }); }
    cx.restore();
  }
  function snapNow(act) {   // снимок активной области для показа, когда она неактивна
    try { const r = region(act), a = toScrK(r.x, r.y), b = toScrK(r.x + r.w, r.y + r.h), sx = Math.max(0, a[0]), sy = Math.max(0, a[1]), ex = Math.min(cv.width, b[0]), ey = Math.min(cv.height, b[1]);
      if (ex - sx < 40 || ey - sy < 40) return; const cover = sx === a[0] && sy === a[1] && ex === b[0] && ey === b[1], old = K.snaps[act.id];
      if (old && old.cover && !cover) return;   // частичный вид не заменяет полный снимок
      const k = Math.min(1, 1400 / Math.max(ex - sx, ey - sy)), c = document.createElement('canvas'); c.width = Math.round((ex - sx) * k); c.height = Math.round((ey - sy) * k);
      c.getContext('2d').drawImage(cv, sx, sy, ex - sx, ey - sy, 0, 0, c.width, c.height);
      const w0 = toK(sx, sy), w1 = toK(ex, ey), sn = {img: c, x: w0[0], y: w0[1], w: w1[0] - w0[0], h: w1[1] - w0[1], cover};
      K.snaps[act.id] = sn;
      c.toBlob(b => { if (!b || K.snaps[act.id] !== sn) return; const fr = new FileReader(); fr.onload = () => { act.snap = {src: fr.result, x: sn.x, y: sn.y, w: sn.w, h: sn.h, cover}; save(); }; fr.readAsDataURL(b); }, 'image/jpeg', .82); } catch (e) { }   // F8: кодирование — асинхронно (toBlob)
  }
  api.snapNow = snapNow;
  /* F8 (аудит): снимок — не во время рисования, а при деактивации области (activate) и по простою ≥ 1,5 с без касаний и отрисовки; без выделения и ручек */
  let idleT = 0, snapBusy = 0;
  function snapIdle(act) { clearTimeout(idleT); idleT = setTimeout(() => {
    if (!K.on || K.quiet || active() !== act || ours.size || nat.size) return;
    const keep = {sel: S.sel, dsel: S.dsel, nsel: S.nsel, msel: S.msel}; snapBusy = 1;
    try { S.sel = null; S.dsel = null; S.nsel = null; S.msel = []; draw(); snapNow(act); }
    finally { Object.assign(S, keep); draw(); snapBusy = 0; } }, 1500); }   // перерисовка после снимка таймер не перезапускает
  api.snapIdle = snapIdle;
  draw = function () {
    if (!K.on) return draw81.apply(this, arguments);
    if (S.mode === 'plan' && S.room && S.room.obj !== K.obj) { K.on = false; K.sel = null; K.cor = null; document.body.classList.remove('lab-sketch'); $s('.sk-dlg').classList.remove('on'); ui(); return draw81.apply(this, arguments); }   // ушли в другой объект — холст закрыт (F4: и класс режима)
    if (nativeOnly()) { const r0 = draw81.apply(this, arguments); ui(); return r0; }   // F6: стена без 4 углов, кадр, список — штатная отрисовка v81 целиком
    let act = active();
    if (!act && activeKind()) act = adopt();   // стену/план открыли штатно (из плана, «Готово») — область появляется на холсте
    if (act) { if (act.t === 'wall' && S.q4) { act.L = +S.q4.L || act.L; act.H = +S.q4.H || act.H; } if (K.quiet) syncToS(act); else syncFromS(act); }   // во время открытия вид держит холст
    paintLayer(act);
    let res;
    if (act) { const r = region(act), a = toScrK(r.x, r.y), b = toScrK(r.x + r.w, r.y + r.h); cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.beginPath(); cx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); cx.clip();
      try { res = draw81.apply(this, arguments); } finally { cx.restore(); }
      if (!K.quiet && !snapBusy) snapIdle(act); }
    if (!snapBusy) paintOver(act); ui();   // снимок по простою — без рамки и выбора холста
    return res;
  };
  api.draw = () => draw();
  // «вписать» в режиме холста — вписать активную область; при открытии области — вид не трогать
  const fit81 = fit, plFit81 = plFit;
  function fitRegion(it) { if (!it) return; const r = region(it), W = cv.width / DPR(), H = (typeof zFreeH === 'function' ? zFreeH() : cv.height) / DPR(); const s = clamp(Math.min(W / r.w, H / r.h) * .94, .01, 20); K.view = {s, ox: (W - r.w * s) / 2 - r.x * s, oy: (H - r.h * s) / 2 - r.y * s}; if (active() === it) syncToS(it); }
  const fitK = () => { const a = active() || (activeKind() && adopt()); if (a) { if (!K.quiet) fitRegion(a); syncToS(a); } return draw(); };
  fit = function () { return K.on ? fitK() : fit81.apply(this, arguments); };
  plFit = function () { return K.on ? fitK() : plFit81.apply(this, arguments); };
  api.fitRegion = fitRegion;
  function fitUnion(R) { const x0 = Math.min(...R.map(r => r.x)), y0 = Math.min(...R.map(r => r.y - fsz(15) * 2 / K.view.s)), x1 = Math.max(...R.map(r => r.x + r.w)), y1 = Math.max(...R.map(r => r.y + r.h)), W = cv.width / DPR(), H = (typeof zFreeH === 'function' ? zFreeH() : cv.height) / DPR(), s = clamp(Math.min(W / (x1 - x0), H / (y1 - y0)) * .94, .01, 20); K.view = {s, ox: (W - (x1 - x0) * s) / 2 - x0 * s, oy: (H - (y1 - y0) * s) / 2 - y0 * s}; }

  /* ═══ [BLOCK SK-PLACE] размещение областей ═══ */
  function bbox() { const R = K.items.map(region); if (!R.length) return null; return {x0: Math.min(...R.map(r => r.x)), y0: Math.min(...R.map(r => r.y)), x1: Math.max(...R.map(r => r.x + r.w)), y1: Math.max(...R.map(r => r.y + r.h))}; }
  function free(r, skip) { return !K.items.some(i => i !== skip && ovl(region(i), r)); }
  function planItem() { const B = bbox(), [x0, , x1, y1] = planBox(), it = {id: 'n' + uid(), t: 'plan', obj: K.obj, k: PLAN_K, ax: 0, ay: 0};
    it.ax = (B ? B.x0 - (x1 - x0) * PLAN_K - 140 : 0) - x0 * PLAN_K; it.ay = (B ? B.y0 : 0) + y1 * PLAN_K + 40; K.items.push(it); save(); return it; }
  function adopt() {   // открытая штатно стена/план без области — новая область
    const t = activeKind(); if (!t) return null;
    if (t === 'plan') return planItem();
    const B = bbox(), L = +S.q4.L || 3000, H = +S.q4.H || 2700, k = 600 / L, it = {id: 'w' + uid(), t: 'wall', sid: S.sess.id, k, L, H, name: wallName(), ax: 0, ay: 0};
    it.ax = (B ? B.x1 + 140 : 0) + WM.x * k; it.ay = (B ? B.y0 : 0) + (H + WM.t) * k + 40; K.items.push(it); save(); return it;
  }
  function wallName() { const r = S.room0; return r ? (r.name || 'Помещение') + ' · С' + wN(r, S.sess.seg) : (S.sess.name || 'Плоскость'); }
  function placeWall(p, it) {   // стена над фото по ширине фото; места нет — под фото
    const r = region(p), L = +it.L, H = +it.H; it.k = r.w / L; const k = it.k, f = fsz(15) * 2 / K.view.s;
    it.ax = r.x; it.ay = r.y - GAP - WM.b * k;
    if (!free(region(it), it) || !free(titleR(it), it)) it.ay = r.y + r.h + GAP + (H + WM.t) * k + f;
  }

  /* ═══ [BLOCK SK-ACT] сделать область активной: штатное открытие стены/плана, вид — на её месте ═══ */
  async function activate(it) {
    if (!it || active() === it) return;
    K.quiet++; const v0 = {...K.view};
    try {
      const cur = active(); if (cur) snapNow(cur);
      try { await flushAll(); } catch (e) { }   // план и стена — в базу сразу (saveRoom отложен на 250 мс)
      if (it.t === 'wall') { const o = await dbGet('sess', it.sid); if (!o || o.del) { say('Стена не найдена в базе замеров'); return; } await openSess(it.sid); if (S.tool !== 'mk') await zmSet('mk'); }   /* 82.18: стена холста — сразу в разметке (ряд, футляр) */
      else { await loadRooms(); const r = K.rooms[0]; if (!r) return roomNew(); await openRoom(r.id, null, true); }
      K.view = v0; syncToS(it); draw();
    } finally { K.quiet--; }
  }
  api.activate = activate;
  async function loadRooms() { const all = (await dbAll('sess').catch(() => [])) || []; K.rooms = all.filter(o => o.kind === 'room' && !o.del && !o.pstub && o.obj === K.obj).sort((a, b) => a.created - b.created); return K.rooms; }
  function roomNew() { dlg('Новое помещение', `<label>Помещение</label><input type="text" data-sk-name value="Помещение ${K.rooms.length + 1}">`, [{t: 'Отмена'}, {t: 'Создать', pr: 1, fn: B => roomCreate(B.querySelector('[data-sk-name]').value.trim() || 'Помещение')}]); }
  async function roomCreate(n) { K.quiet++; const v0 = {...K.view}; try { try { await flushAll(); } catch (e) { } await newRoom(K.obj, n, true); await loadRooms(); const it = K.items.find(i => i.t === 'plan') || planItem(); K.view = v0; syncToS(it); draw(); return it; } finally { K.quiet--; } }
  api.roomCreate = roomCreate;

  /* ═══ [BLOCK SK-INPUT] касания: внутри активной области — штатные инструменты v81; вне — холст ═══ */
  const ours = new Map(), nat = new Set(); let G = null;
  const ptK = ev => { const r = cv.getBoundingClientRect(), d = DPR(); return toK((ev.clientX - r.left) * d, (ev.clientY - r.top) * d); };
  function hit(w) {
    for (const it of [...K.items].reverse()) if (it.t === 'note' && inR(region(it), w)) return {it};
    for (const it of K.items) if ((it.t === 'wall' || it.t === 'plan') && inR(titleR(it), w)) return {it, title: 1};
    for (const it of [...K.items].reverse()) if (it.t === 'photo' && inR(region(it), w)) return {it};
    for (const it of [...K.items].reverse()) if ((it.t === 'wall' || it.t === 'plan') && inR(region(it), w)) return {it};
    return null;
  }
  function insideActive(w) { const a = active(); return !!(a && inR(region(a), w) && !inR(titleR(a), w)); }
  api.insideActive = insideActive;
  window.addEventListener('pointerdown', ev => {
    if (!K.on || ev.target !== cv) return;
    if (!ours.size && nativeOnly()) { nat.add(ev.pointerId); return; }   // F6
    const w = ptK(ev);
    if (!ours.size && (nat.size || (insideActive(w) && !K.cor))) { nat.add(ev.pointerId); return; }   // штатно
    ev.stopImmediatePropagation(); ev.preventDefault(); ours.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ours.size === 2) { G = {pinch: pinch0()}; return; }
    down(w, ev);
  }, true);
  window.addEventListener('pointermove', ev => {
    if (!ours.has(ev.pointerId)) return; ev.stopImmediatePropagation(); ours.set(ev.pointerId, [ev.clientX, ev.clientY]); if (!G) return;
    if (G.pinch) { const n = pinch0(), o = G.pinch, s = clamp(o.s * n.d / o.d, .01, 20); K.view = {s, ox: n.c[0] - (o.c[0] - o.ox) * s / o.s, oy: n.c[1] - (o.c[1] - o.oy) * s / o.s}; pushView(); return; }
    G.move && G.move(ptK(ev), ev); draw();
  }, true);
  const up = ev => {
    nat.delete(ev.pointerId); if (!ours.has(ev.pointerId)) return; ev.stopImmediatePropagation(); ours.delete(ev.pointerId);
    const g = G; if (!g) return; if (g.pinch) { G = ours.size ? {pinch: pinch0()} : null; return; }
    G = null; if (ev.type !== 'pointercancel' && g.end) g.end(ptK(ev)); draw();
  };
  window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
  window.addEventListener('wheel', ev => { if (!K.on || ev.target !== cv || nativeOnly() || insideActive(ptK(ev))) return; ev.stopImmediatePropagation(); ev.preventDefault(); const w = ptK(ev), f = Math.exp(-ev.deltaY * .0015), s = clamp(K.view.s * f, .01, 20), r = cv.getBoundingClientRect(); K.view = {s, ox: ev.clientX - r.left - w[0] * s, oy: ev.clientY - r.top - w[1] * s}; pushView(); }, {capture: true, passive: false});
  function pinch0() { const [a, b] = [...ours.values()], r = cv.getBoundingClientRect(); return {d: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, c: [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top], s: K.view.s, ox: K.view.ox, oy: K.view.oy}; }
  function pushView() { const a = active(); if (a) syncToS(a); draw(); save(); }
  function down(w, ev) {
    const c0 = [ev.clientX, ev.clientY], v0 = {...K.view};
    const pan = () => { G = {move: (q, e) => { K.view = {...v0, ox: v0.ox + e.clientX - c0[0], oy: v0.oy + e.clientY - c0[1]}; const a = active(); if (a) syncToS(a); }, end: () => { if (Math.abs(K.view.ox - v0.ox) + Math.abs(K.view.oy - v0.oy) < 4) { K.sel = null; K.cor = null; } save(); }}; };
    const sel = K.sel && byId(K.sel);
    if (K.cor && sel && sel.t === 'photo') {   // 4 угла на выбранном фото
      const r = region(sel); if (!inR(r, w)) return pan(); const q = [(w[0] - r.x) * sel.iw / r.w, (w[1] - r.y) * sel.iw / r.w];
      G = {end: () => { K.cor.pts.push(q); if (K.cor.pts.length === 4) { sel.cor = K.cor.pts; K.cor = null; save(); say('Углы стены заданы · ▣ Стена'); } }}; return; }
    if (sel && sel.t === 'photo' && sel.cor) { const r = region(sel), ci = sel.cor.findIndex(q => Math.hypot(r.x + q[0] * r.w / sel.iw - w[0], r.y + q[1] * r.w / sel.iw - w[1]) < Math.max(18, pr() * 2) / K.view.s);
      if (ci >= 0) { G = {move: q => { sel.cor = sel.cor.slice(); sel.cor[ci] = [(q[0] - r.x) * sel.iw / r.w, (q[1] - r.y) * sel.iw / r.w]; }, end: () => save()}; return; } }
    const h = hit(w);
    if (!h) return pan();
    const it = h.it, o0 = it.t === 'photo' || it.t === 'note' ? [it.x, it.y] : [it.ax, it.ay], sn = K.snaps[it.id], s0 = sn ? [sn.x, sn.y] : null; let moved = 0;
    const moveIt = (dx, dy) => { if (it.t === 'photo' || it.t === 'note') { it.x = o0[0] + dx; it.y = o0[1] + dy; return; } it.ax = o0[0] + dx; it.ay = o0[1] + dy; if (s0) { sn.x = s0[0] + dx; sn.y = s0[1] + dy; if (it.snap) { it.snap.x = sn.x; it.snap.y = sn.y; } } };
    G = {move: q => { const dx = q[0] - w[0], dy = q[1] - w[1]; if (!moved && Math.hypot(dx, dy) * K.view.s < 6) return; moved = 1; moveIt(dx, dy); if (active() === it) syncToS(it); },
      end: () => { if (moved) return save();
        if (it.t === 'note') { if (K.sel === it.id) return noteEdit(it); K.sel = it.id; return; }
        if (it.t === 'photo') { K.sel = it.id; K.cor = null; return; }
        K.sel = null; activate(it); }};
  }

  /* ═══ [BLOCK SK-UI] своей строки нет (82.18): команды холста — плитки футляра (lab-tb.js) → api.cmd;
     выбранное фото / заметка — блок в самой нижней строке (#zpb, BLOCK SK-BAR); окна ввода и файлы — здесь ═══ */
  const root = document.createElement('div'); root.id = 'labSketch';
  root.innerHTML = `<div class="sk-dlg"><div class="bx"></div></div>
<input type="file" accept="image/*" capture="environment" data-skf="cam" hidden><input type="file" accept="image/*" multiple data-skf="gal" hidden><input type="file" accept=".json,application/json" data-skf="imp" hidden>`;
  document.body.appendChild(root);
  const $s = q => root.querySelector(q);
  let uiKey = '', uiBlk = '';
  const selIt = () => (K.on && K.sel && byId(K.sel)) || null;
  function blk() { const s = selIt(); return s && s.t === 'photo' ? 'ph' : s && s.t === 'note' ? 'nt' : ''; }   // блок нижней строки: фото / заметка / нет
  api.block = blk;
  function ui() {   // без отрисовки строки: классы body и перестройка нижней строки при смене выбора
    root.classList.toggle('on', K.on);
    const sel = selIt(), key = K.on ? [K.obj, sel && sel.id, sel && sel.t, sel && !!sel.cor, !!K.cor, K.cor && K.cor.pts.length, sel && sel.wall].join('|') : '';
    if (key === uiKey) return; uiKey = key;
    const b = blk(); document.body.classList.toggle('lab-sk-ph', b === 'ph'); document.body.classList.toggle('lab-sk-nt', b === 'nt');
    if (b || uiBlk) { try { zpbDraw(); } catch (e) { } try { lay05(); } catch (e) { } }   // снятие выбора: lay05 возвращает ↶ ↷ 🗑 на штатное место
    uiBlk = b;
  }
  function cmd(a, b) {   // команды холста: плитки футляра (open, close, obj, cam, gal, note, plan, exp, imp) и блок фото (cor, wall, ned, del)
    const sel = selIt();
    if (a === 'open') return open();
    if (a === 'close') return close();
    if (a === 'obj') return objDlg();
    if (a === 'cam' || a === 'gal' || a === 'imp') return $s(`[data-skf="${a}"]`).click();
    if (a === 'note') { const w = toK(cv.width / 2, cv.height / 3); return textDlg('Заметка', '', tx => { if (!tx) return; const n = {id: 'n' + uid(), t: 'note', x: w[0], y: w[1], tx}; K.items.push(n); K.sel = n.id; save(); draw(); }); }
    if (a === 'plan') { const it = K.items.find(i => i.t === 'plan'); if (it) { fitRegion(it); draw(); return activate(it); } return loadRooms().then(() => K.rooms.length ? activate(planItem()) : roomNew()); }
    if (a === 'cor' && sel && sel.t === 'photo') { K.cor = K.cor ? null : {id: sel.id, pts: []}; if (K.cor) say('Углы стены: левый-верх, правый-верх, правый-низ, левый-низ'); return draw(); }
    if (a === 'wall' && sel && sel.t === 'photo') return wallDlg(sel);
    if (a === 'ned' && sel && sel.t === 'note') return noteEdit(sel);
    if (a === 'del' && sel) { if (b && !b.classList.contains('arm')) { b.classList.add('arm'); setTimeout(() => b.classList.remove('arm'), 2500); return say('Ещё раз — удалить'); } K.items = K.items.filter(i => i !== sel); K.sel = null; K.cor = null; save(); return draw(); }
    if (a === 'exp') return exportJson();
  }
  api.cmd = cmd;

  /* ═══ [BLOCK SK-BAR] блок выбранного фото / заметки — в самой нижней строке (#zpb), после 🖍:
     ⌗ 4 угла (n/4) · ▣ Стена · 🗑 | штатная лента цветов на остальное место | ↶ ↷ 🗑. Штатные узлы полосы прячет CSS (не удаляются). ═══ */
  const svgU = (id, vb) => `<svg viewBox="${vb || '0 0 32 32'}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const zpbSk0 = zpbDraw;
  zpbDraw = function () {
    const res = zpbSk0.apply(this, arguments), el = document.getElementById('zpb'); if (!el) return res;
    try {
      const ch = document.getElementById('ch');   // против дублей: вид пера в полосе, если он уже в ряду
      el.querySelectorAll(':scope>[data-zk]').forEach(x => x.classList.toggle('lab-dup', !!(ch && ch.querySelector(`.pb[data-k="${x.dataset.zk}"]`))));
      const old = el.querySelector('#labSkPh'); if (old) old.remove();
      const b = blk(); if (!b) return res;
      const sel = selIt();
      let f = el.querySelector('#zpF'); if (!f) { el.insertAdjacentHTML('afterbegin', `<button id="zpF" title="Футляр: все инструменты, цвета">${svgU('t-cup')}</button>`); f = el.querySelector('#zpF'); f.onclick = () => tbOpen(); }
      if (!el.querySelector(':scope>.zcols')) {   // полоса фото стены (Ф1/Ф4) убрала ленту — штатная лента цветов заново
        const c = kC(S.mk), z = document.createElement('span'); z.className = 'zcols'; z.innerHTML = zColL().map(q => `<button class="cl${c === q ? ' on' : ''}" data-zc="${q}" style="background:${q}!important" title="Цвет ${q}"></button>`).join('');
        z.querySelectorAll('[data-zc]').forEach(x => x.onclick = () => zCol(x.dataset.zc)); const u = document.getElementById('zur'); el.insertBefore(z, u && u.parentElement === el ? u : null); }
      let h;
      if (b === 'ph') { const n = K.cor && K.cor.id === sel.id ? K.cor.pts.length : null, w = sel.wall && byId(sel.wall);
        h = `<button data-skp="cor" class="${n != null ? 'on' : ''}" title="4 угла стены на фото: ЛВ, ПВ, ПН, ЛН">${kIcoD('pts')}${n != null ? `<i>${n}/4</i>` : ''}</button>`
          + (sel.cor ? `<button data-skp="wall" class="${w ? 'on' : ''}" title="${w ? 'Стена по фото создана · ещё раз — заменить вид стены' : 'Стена по фото: помещение, стена плана, L, H'}">${svgU('t-wallseg')}</button>` : '')
          + `<button data-skp="del" title="Убрать фото с холста (два касания)">${svgU('h-trash', '0 0 24 24')}</button>`; }
      else h = `<button data-skp="ned" title="Текст заметки">${kIcoD('txt')}</button><button data-skp="del" title="Удалить заметку (два касания)">${svgU('h-trash', '0 0 24 24')}</button>`;
      const box = document.createElement('span'); box.id = 'labSkPh'; box.innerHTML = `<span class="sep"></span>${h}<span class="sep"></span>`;
      f.after(box); box.querySelectorAll('[data-skp]').forEach(x => x.onclick = () => cmd(x.dataset.skp, x));
      const u = document.getElementById('zur'); if (u && u.parentElement !== el) el.appendChild(u);   // ↶ ↷ 🗑 — в этой же строке справа
    } catch (e) { }
    return res;
  };
  const lay05Sk0 = lay05;
  lay05 = function () { const res = lay05Sk0.apply(this, arguments); try { if (blk()) { const u = document.getElementById('zur'), el = document.getElementById('zpb'); if (u && el && u.parentElement !== el) el.appendChild(u); } } catch (e) { } return res; };
  function dlg(title, html, buttons) {
    const D = $s('.sk-dlg'), B = D.querySelector('.bx');
    B.innerHTML = `<h4>${esc(title)}</h4>${html}<div class="bt">${buttons.map((b, i) => `<button data-dg="${i}" class="${b.pr ? 'pr' : ''}">${esc(b.t)}</button>`).join('')}</div>`;
    D.classList.add('on'); const close0 = () => D.classList.remove('on');
    B.querySelectorAll('[data-dg]').forEach(x => x.onclick = () => { const b = buttons[+x.dataset.dg]; if (!b.keep) close0(); b.fn && b.fn(B); });
    return {B, close: close0};
  }
  api.dialog = dlg;
  function textDlg(t, v, ok) { dlg(t, `<label>Текст</label><input type="text" data-sk-tx value="${esc(v)}">`, [{t: 'Отмена'}, {t: 'Готово', pr: 1, fn: B => ok(B.querySelector('[data-sk-tx]').value.trim())}]); }
  function noteEdit(n) { textDlg('Заметка', n.tx, tx => { if (tx) n.tx = tx; else K.items = K.items.filter(i => i !== n); save(); draw(); }); }
  async function objDlg() { const all = (await dbAll('sess').catch(() => [])) || [], sk = (await sAll('sk').catch(() => [])) || [], L = [...new Set([...sk.map(x => x.obj), ...all.filter(o => !o.del && o.obj).map(o => o.obj)])].filter(Boolean);
    root.classList.add('on');
    dlg('Объект', `<label>Объект</label><input type="text" data-sk-o list="skObjL" value="${esc(K.obj)}"><datalist id="skObjL">${L.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`, [{t: 'Отмена', fn: () => ui()}, {t: 'Открыть', pr: 1, fn: B => { const v = B.querySelector('[data-sk-o]').value.trim(); if (v) open(v); }}]); }

  /* ═══ [BLOCK SK-PHOTO] фото с камеры / галереи: ≤ 2000 px JPEG, файл — в базе холста; ставится где свободно ═══ */
  async function loadImg(id, blob) { try { const u = URL.createObjectURL(blob), im = new Image(); await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = u; }); K.imgs[id] = im; return im; } catch (e) { return null; } }
  async function toJpeg(src, max) {
    const bmp = await createImageBitmap(src, {imageOrientation: 'from-image'}).catch(() => createImageBitmap(src)), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    return {blob: await new Promise(res => c.toBlob(res, 'image/jpeg', 0.88)), w: c.width, h: c.height};
  }
  async function addPhotos(files) {
    const v = toK(cv.width * .08, cv.height * .3); let x = v[0], last = null, n = 0;
    for (const f of files) { try { const j = await toJpeg(f, 2000), p = {id: 'p' + uid(), t: 'photo', x, y: v[1], w: 600, iw: j.w, ih: j.h, cor: null};
      for (let i = 0; i < 60 && !free(region(p)); i++) p.y += 150;
      await sPut('img', j.blob, p.id); await loadImg(p.id, j.blob); K.items.push(p); x += 660; n++; last = p; } catch (e) { say('Фото не добавлено: ' + e.message); } }
    if (last) { K.sel = last.id; K.cor = {id: last.id, pts: []}; await saveNowSk(); draw(); say(n > 1 ? `Фото: ${n} · ⌗ углы стены` : 'Фото на холсте · ⌗ 4 угла стены'); }
  }
  api.addPhotos = addPhotos;
  for (const k of ['cam', 'gal', 'imp']) { const inp = $s(`[data-skf="${k}"]`); inp.onchange = async ev => { const fs0 = [...ev.target.files]; ev.target.value = ''; if (!fs0.length) return; if (k === 'imp') { try { await importJson(JSON.parse(await fs0[0].text())); } catch (e) { say('Файл не прочитан: ' + e.message); } } else await addPhotos(fs0); }; }

  /* ═══ [BLOCK SK-WALL] фото → стена: помещение, стена плана (или новая), L, H; область — над фото; фото рядом, без заливки стены ═══ */
  const aspect = c => { const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]); return (d(c[0], c[1]) + d(c[3], c[2])) / (d(c[0], c[3]) + d(c[1], c[2])); };
  async function wallDlg(p) {
    if (!p.cor) return say('Сначала 4 угла стены');
    const R = await loadRooms(), opts = R.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    const d = dlg('Стена по фото', `<label>Помещение</label><select data-sk-room>${opts}<option value="">＋ Новое помещение</option></select><div data-sk-new><label>Название</label><input type="text" data-sk-name value="Помещение ${R.length + 1}"></div><div data-sk-walls></div>
<label>Длина L, мм (пусто — с плана или ≈)</label><input data-sk-l inputmode="decimal"><label>Высота H, мм (пусто — помещения или ≈)</label><input data-sk-h inputmode="decimal">`, [{t: 'Отмена'}, {t: 'Создать', pr: 1, keep: 1, fn: B => go(B)}]);
    const B = d.B, sel = B.querySelector('[data-sk-room]'), nw = B.querySelector('[data-sk-new]'), wl = B.querySelector('[data-sk-walls]');
    const upd = () => { const r = R.find(x => x.id === sel.value); nw.hidden = !!r; if (!r) { wl.innerHTML = ''; return; }
      const m = r.ms, n = plN(m); wl.innerHTML = `<label>Стена плана</label><select data-sk-k>${!m.closed ? '<option value="new">＋ Новая стена (продолжение ломаной)</option>' : ''}${[...Array(n).keys()].map(k => { const l = plLen(m, k); return `<option value="${k}">С${wN(r, k)}${l ? ' · ' + Math.round(l.v) + (l.ok ? '' : ' ≈') : ''}${(r.segs || {})[k] ? ' · есть вид стены' : ''}</option>`; }).join('')}</select>`; };
    sel.onchange = upd; upd();
    async function go(B) {
      const r = R.find(x => x.id === sel.value), ks = B.querySelector('[data-sk-k]'), kv = ks ? ks.value : 'new', num = q => { const v = String(B.querySelector(q).value).trim(); const n = v ? (typeof evalN === 'function' ? evalN(v) : parseFloat(v.replace(',', '.'))) : null; return n > 0 ? r1(n) : null; };
      if (r && kv !== 'new' && (r.segs || {})[+kv] && !B.dataset.ok) { B.dataset.ok = '1'; B.querySelector('.bt .pr').textContent = 'Заменить вид стены'; return say('У стены уже есть вид — «Заменить вид стены» ещё раз'); }
      d.close();
      try { await createWall(p, r ? {id: r.id, k: kv === 'new' ? 'new' : +kv} : {name: B.querySelector('[data-sk-name]').value.trim() || 'Помещение'}, {L: num('[data-sk-l]'), H: num('[data-sk-h]')}); }
      catch (e) { console.error(e); say('Стена не создана: ' + e.message); }
    }
  }
  api.wallDlg = wallDlg;
  async function createWall(p, to, dim) {
    dim = dim || {}; K.quiet++; const v0 = {...K.view};
    try {
      await saveNowSk(); try { await flushAll(); } catch (e) { }   // план и стена — в базу сразу (saveRoom отложен на 250 мс)
      if (to.id) await openRoom(to.id, null, true); else await newRoom(K.obj, to.name, true);
      const r = S.room; if (!r) throw new Error('помещение не открыто'); const m = r.ms; plSnap();
      let k = to.k;
      const asp = aspect(p.cor), pl0 = k != null && k !== 'new' ? plLen(m, k) : null;
      let H = dim.H || (+m.H > 0 ? +m.H : null), L = dim.L || (pl0 && pl0.ok ? pl0.v : null);
      const aH = !H, aL = !L; if (!H) H = L ? r1(L / asp) : 2700; if (!L) L = pl0 ? pl0.v : r1(H * asp);
      if (k === 'new' || k == null) {   // новая стена — продолжение открытой ломаной (поворот 90° от последнего участка)
        if (m.closed) throw new Error('контур помещения замкнут — выберите стену');
        if (!m.pts.length) m.pts.push([0, 0]);
        const n = m.pts.length, a = m.pts[n - 1]; let u = [1, 0]; if (n >= 2) { const b = m.pts[n - 2], l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; u = [-(a[1] - b[1]) / l, (a[0] - b[0]) / l]; }
        m.pts.push([Math.round(a[0] + u[0] * L), Math.round(a[1] + u[1] * L)]); k = m.pts.length - 2; m.wsd = m.wsd || {}; if (m.wsd[k] == null) m.wsd[k] = 1; if (!m.wsdv) m.wsdv = 81;
      }
      if (!aL) { const a = k, b = (k + 1) % m.pts.length, od = plDim(m, k); m.dims = (m.dims || []).filter(q => !((q.a.p === a && q.b.p === b) || (q.a.p === b && q.b.p === a))); m.dims.push({id: od ? od.id : 'd' + Date.now().toString(36), a: {p: a}, b: {p: b}, v: L}); }
      if (!aH && !(+m.H > 0)) m.H = H;
      try { gnFix(r); } catch (e) { }
      const refs = [];   // фото на стену не заливается (владелец 10.11.2026): остаётся на холсте рядом с чертежом
      const old = (r.segs || {})[k]; if (old) { try { const o = await dbGet('sess', old); if (o) { o.del = Date.now(); o.delWhy = 'холст: вид стены заменён'; await dbPut('sess', o); } } catch (e) { } }
      const ts = Date.now(), sid = 's' + ts.toString(36) + Math.random().toString(36).slice(2, 5);
      const o = {id: sid, obj: r.obj, name: r.name + ' · С' + wN(r, k), created: ts, upd: ts, frames: [], room: r.id, seg: k,
        q4: {L, H, ok: 1, fr: {}, blank: 1, aL, aH}, lines: {floor: [[0, 0], [L, 0]], left: [[0, 0], [0, H]], right: [[L, 0], [L, H]], ceil: [[0, H], [L, H]]}, la: {}, man: {}, wsh: {},
        els: [], notes: [], und: [], dms: [], drw: [], rts: [], polys: [], rulers: [], refs, labSketch: {obj: K.obj, photo: p.id}};
      await dbPut('sess', o); r.segs = r.segs || {}; r.segs[k] = sid; r.upd = Date.now(); await dbPut('sess', clone(r)); saveRoom(); await loadRooms();
      for (const i of K.items) if (i.t === 'wall' && i.sid === old) { i.sid = sid; delete K.snaps[i.id]; delete i.snap; }   // замена вида — та же область
      let it = K.items.find(i => i.t === 'wall' && i.sid === sid);
      if (!it) { it = {id: 'w' + uid(), t: 'wall', sid, L, H, name: r.name + ' · С' + wN(r, k), ax: 0, ay: 0, k: 1}; placeWall(p, it); K.items.push(it); }
      if (!K.items.some(i => i.t === 'plan')) planItem();
      p.wall = it.id; K.sel = null; K.cor = null; await saveNowSk();
      await openSess(sid); if (S.tool !== 'mk') await zmSet('mk');   /* 82.18: стена — в разметке */
      for (let i = 0; i < 80; i++) { if (S.mosaic && S.q4 && S.q4.ok && !S.recomp && S.sess && S.sess.id === sid) { try { await saveNow(); } catch (e) { } const w = await dbGet('sess', sid).catch(() => null); if (w && w.out) break; } await new Promise(z => setTimeout(z, 75)); }   // снимок для выгрузки (out)
      K.view = v0; fitUnion([region(p), region(it)]); syncToS(it); draw();
      say(`Стена ${it.name} · ${Math.round(L)}${aL ? ' ≈' : ''} × ${Math.round(H)}${aH ? ' ≈' : ''} — правка штатными инструментами`);
      return {room: r.id, k, sid, item: it.id};
    } finally { K.quiet--; }
  }
  api.createWall = createWall;

  /* ═══ [BLOCK SK-JSON] перенос: фото и заметки холста (стены и план — штатной выгрузкой замеров) ═══ */
  const b2u = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(b); });
  async function exportObj() { const items = clone(K.items); for (const it of items) if (it.t === 'photo') { const b = await sGet('img', it.id).catch(() => null); it.src = b ? await b2u(b) : ''; } return {format: 'measure-sketch', v: 2, app: 'Measure 82.17', obj: K.obj, date: new Date().toISOString(), items}; }
  api.exportObj = exportObj;
  async function exportJson() { const o = await exportObj(), txt = JSON.stringify(o), fn = 'holst_' + (K.obj || 'obekt').replace(/[^\wа-яА-ЯёЁ.-]+/g, '_') + '_' + o.date.slice(0, 10) + '.json';
    try { if (typeof appSave === 'function' && appSave(fn, txt)) return say('Холст сохранён: ' + fn); } catch (e) { }
    try { const u = URL.createObjectURL(new Blob([txt], {type: 'application/json'})), a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); say('Холст сохранён: ' + fn); } catch (e) { say('Сохранение отклонено'); } }
  async function importJson(o) {
    if (!o || o.format !== 'measure-sketch') return say('Это не файл холста');
    const src = o.v === 2 ? (o.items || []) : (o.photos || []).map(p => ({...p, t: 'photo'})), B = bbox(), ys = src.map(i => +i.y || 0), dy = B && ys.length ? B.y1 + 200 - Math.min(...ys) : 0; let n = 0;
    for (const q of src) { if (q.t !== 'photo' && q.t !== 'note') continue; const it = {id: (q.t === 'photo' ? 'p' : 'n') + uid(), t: q.t, x: +q.x || 0, y: (+q.y || 0) + dy, w: q.w, iw: q.iw, ih: q.ih, cor: q.cor || null, tx: q.tx};
      if (q.t === 'photo' && q.src) { try { const b = await (await fetch(q.src)).blob(); await sPut('img', b, it.id); await loadImg(it.id, b); } catch (e) { } } K.items.push(it); n++; }
    await saveNowSk(); draw(); say(`Загружено: ${n}` + (o.obj && o.obj !== K.obj ? ` (из «${o.obj}»)` : ''));
  }
  api.importJson = importJson;

  /* ═══ [BLOCK SK-OPEN] открыть холст объекта / закрыть; перенос данных 82.14 (v1) ═══ */
  function curObj() { return (S.room && S.room.obj) || (S.room0 && S.room0.obj) || (S.sess && S.sess.obj) || ((document.getElementById('nObj') || {}).value || '').trim(); }
  async function migrate(r) {   // 82.14 v1: photos[] → фото холста; связанная стена — область над фото
    K.items = [];
    for (const p of r.photos || []) { const it = {id: p.id, t: 'photo', x: p.x || 0, y: p.y || 0, w: p.w || 600, iw: p.iw, ih: p.ih, cor: p.cor || null}; K.items.push(it);
      if (p.wall && p.wall.sid) { const o = await dbGet('sess', p.wall.sid).catch(() => null); if (o && !o.del && o.q4) { const w = {id: 'w' + uid(), t: 'wall', sid: o.id, L: +o.q4.L, H: +o.q4.H, name: o.name, ax: 0, ay: 0, k: 1}; placeWall(it, w); K.items.push(w); it.wall = w.id; } } }
    for (const n of r.notes || []) K.items.push({id: n.id || 'n' + uid(), t: 'note', x: n.x, y: n.y, tx: n.tx});
    return K.items;
  }
  async function open(obj) {
    if (obj == null) obj = curObj();
    if (!obj) return objDlg();
    if (K.on) await saveNowSk();
    const r = await sGet('sk', obj).catch(() => null);
    Object.assign(K, {obj, items: [], view: (r && r.view) || {ox: 20, oy: 80, s: 0.4}, sel: null, cor: null, imgs: {}, snaps: {}});
    K.items = r ? (r.v === 2 ? r.items || [] : await migrate(r)) : [];
    for (const it of K.items) { if (it.t === 'photo') { const b = await sGet('img', it.id).catch(() => null); if (b) await loadImg(it.id, b); }
      if (it.snap && it.snap.src) { const im = new Image(); im.src = it.snap.src; await new Promise(z => { im.onload = z; im.onerror = z; }); K.snaps[it.id] = {img: im, x: it.snap.x, y: it.snap.y, w: it.snap.w, h: it.snap.h, cover: it.snap.cover}; } }
    await loadRooms();
    try { sessList(false); } catch (e) { }
    if (S.mode === 'plan' && S.room && S.room.obj !== obj) { try { leavePlan(); clearAll(); } catch (e) { } }
    if (S.mode !== 'plan' && S.sess && (S.sess.obj || '') !== obj) { try { await saveNow(); clearAll(); } catch (e) { } }
    K.on = true; uiKey = ''; document.body.classList.add('lab-sketch');
    const a = active() || (activeKind() && adopt()); if (a) syncToS(a);
    await saveNowSk(); draw(); return K;
  }
  async function close() { await saveNowSk(); K.on = false; K.sel = null; K.cor = null; document.body.classList.remove('lab-sketch'); ui(); $s('.sk-dlg').classList.remove('on'); try { fit(); } catch (e) { draw(); } }
  api.open = open; api.close = close; api.isOpen = () => K.on;
  addEventListener('measure-lab-settings', () => { if (K.on) draw(); });

  /* ═══ [BLOCK SK-ENTRY] вход: список замеров (рядом с «＋ Помещение») и меню «Ещё» ═══ */
  function entry() {
    const nw = document.querySelector('#ss .nw'); if (nw && !nw.querySelector('[data-sk-open]')) { const b = document.createElement('button'); b.dataset.skOpen = 'ss'; b.textContent = '✎ Скетч'; b.title = 'Холст объекта: фото, стены, план, пометки'; b.onclick = () => open((document.getElementById('nObj') || {}).value.trim() || null); nw.appendChild(b); }
    const mn = document.getElementById('zMenu'); if (mn && !mn.querySelector('[data-sk-open]')) { const b = document.createElement('button'); b.dataset.skOpen = 'menu'; b.textContent = '✎ Скетч объекта'; b.title = 'Холст объекта: фото, стены, план, пометки'; b.onclick = () => { mn.classList.remove('on'); open(); }; mn.insertBefore(b, mn.firstChild); }
  }
  entry();
})();
