/* Measure 82.18 — «Скетч»: единый холст проекта клиента поверх штатного холста v81 (AKX-2026-0012, инженер B).
   Решение владельца 11.11.2026: холст не закрывается и никуда не переходит; план (вид сверху) и стены — области холста;
   свободное поле холста — подложка, штатная поверхность v81 (sess kind:'board', lab-board.js): фото, размеры и стрелки
   с вводом значения, текст, перо, фигуры работают на ВСЁМ холсте, включая фото. Активна одна поверхность: подложка, стена или план;
   касание другой активирует её и передаёт начатый жест штатному обработчику. Неактивные стены и план — снимки;
   подложка под активной стеной / планом — векторно (lab-ctx.js). Футляр и наборы — на каждой поверхности (zmSet('mk')).
   Удаление — только 🗑 (#bDelS). Своей строки, ✕, «Объект», «Закрыть» нет. ✓ — сохранить и показать весь холст; 📁 — список проектов.
   Системная «назад» Android: window.AkrixBack() → true / false (цепочка: поле ввода → начатое действие / меню → выделение → двойное нажатие — к проектам).
   Работает поверх неизменной v81: S, cv, cx, draw, fit, plFit, openSess, openRoom, newRoom, zmSet, zDone, wGo, wGo2, mdGo, zSelHas, zDelSel, dbGet/dbPut/dbAll, flushAll … */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabSketch) return;
  const api = window.MeasureLabSketch = {version: 3};

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
  const ver = () => String(window.MeasureVersion || '82.18');
  const PLAN_K = 0.12, GAP = 40;                                       // масштаб плана (ед. холста на мм), зазор
  const WM = {x: 1300, b: 800, t: 900};                                // поля области стены, мм: развёртка боковых стен, пол, подписи сверху (82.18 int: 300 → 600 — цепочка авторазмеров над ригелем у потолка не обрезается рамкой; QA Д11: 900 — подписи над ригелем и снимки не обрезаны)
  api.metrics = () => ({text: fsz(13), point: pr()});

  /* ═══ [BLOCK SK-STATE] модель холста проекта ═══
     единицы холста = мм подложки (ось y вниз; у v81 — вверх): подложка — BOARD (ax 0, ay 0, k 1);
     items: plan {id, t:'plan', ax, ay, k, snap?}                         — (X, Y) мм плана → (ax + X·k, ay − Y·k)
            wall {id, t:'wall', room, wid, sid, ax, ay, k, L, H, name, snap?} — область по (room, wid); sid — кэш; у отдельной плоскости room = null
     act: {t:'board'|'wall'|'plan', id?} — активная поверхность; view: холст → px CSS (x·s + ox, y·s + oy) */
  const BOARD = api.BOARD = {id: '~board', t: 'board', ax: 0, ay: 0, k: 1};
  const K = api.state = {on: false, pid: '', obj: '', board: '', boardRec: null, items: [], view: {ox: 20, oy: 80, s: 0.4}, act: {t: 'board'}, sel: null, cor: null, snaps: {}, rooms: [], quiet: 0, lastWall: null, extra: {}};
  const byId = id => K.items.find(i => i.id === id);

  /* ═══ [BLOCK SK-DB] раскладка холста: MeasureLabStore.cv / putCv (инженер A); без него — запасная запись '~cv:'+pid в akrix-sketch.sk;
     старые холсты 82.14–82.17 (akrix-sketch.sk[obj], img) — только чтение (перенос migrateCanvas) ═══ */
  const SDB = {db: null};
  function sdbOpen() {
    if (SDB.db) return Promise.resolve(SDB.db);
    return new Promise(res => { try { const r = indexedDB.open('akrix-sketch');
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('sk')) d.createObjectStore('sk', {keyPath: 'obj'}); if (!d.objectStoreNames.contains('img')) d.createObjectStore('img'); };
      r.onsuccess = () => { SDB.db = r.result; SDB.db.onversionchange = () => { SDB.db.close(); SDB.db = null; }; res(SDB.db); }; r.onerror = () => res(null); r.onblocked = () => res(null); } catch (e) { res(null); } });
  }
  async function stx(store, mode, fn) {
    const db = await sdbOpen(); if (!db || !db.objectStoreNames.contains(store)) return null;
    return new Promise((res, rej) => { const t = db.transaction(store, mode), q = fn(t.objectStore(store)); let out; if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  const sPut = (st, v, k) => stx(st, 'readwrite', s => k === undefined ? s.put(v) : s.put(v, k));
  const sGet = (st, k) => stx(st, 'readonly', s => s.get(k));
  api.db = {open: sdbOpen, put: sPut, get: sGet};
  const Store = () => (window.MeasureLabStore && typeof MeasureLabStore.cv === 'function' ? MeasureLabStore : null);
  async function cvLoad(pid) { const st = Store(); if (st) { try { return (await st.cv(pid)) || null; } catch (e) { return null; } } const r = await sGet('sk', '~cv:' + pid).catch(() => null); return r ? r.cv : null; }
  const cvRec = () => ({...K.extra, pid: K.pid, v: 3, obj: K.obj, board: K.board, view: K.view, act: K.act, items: K.items.map(i => { const o = {...i}; return o; }), upd: Date.now()});
  api.cv = cvRec;
  let saveT = 0;
  function save() { clearTimeout(saveT); saveT = setTimeout(saveNowSk, 400); }
  async function saveNowSk() { clearTimeout(saveT); if (!K.pid) return; const rec = clone(cvRec()); try { const st = Store(); if (st) await st.putCv(rec); else await sPut('sk', {obj: '~cv:' + K.pid, cv: rec}); } catch (e) { } }
  api.saveNow = saveNowSk;

  /* ═══ [BLOCK SK-MAP] холст ↔ вид v81 активной поверхности ═══ */
  const toScrK = (x, y) => [(x * K.view.s + K.view.ox) * DPR(), (y * K.view.s + K.view.oy) * DPR()];   // холст → px устройства
  const toK = (px, py) => [(px / DPR() - K.view.ox) / K.view.s, (py / DPR() - K.view.oy) / K.view.s];   // px устройства → холст
  const nat2k = (it, X, Y) => [it.ax + X * it.k, it.ay - Y * it.k];
  const viewOf = it => { const d = DPR(); return {s: K.view.s * it.k * d, rot: 0, ox: (K.view.ox + it.ax * K.view.s) * d, oy: (K.view.oy + it.ay * K.view.s) * d}; };
  function syncToS(it) { S.view = viewOf(it); }
  function syncFromS(it) { const v = S.view, d = DPR(); if (!v || !(v.s > 0)) return; const s = v.s / (it.k * d); K.view = {s, ox: v.ox / d - it.ax * s, oy: v.oy / d - it.ay * s}; }
  api.map = {toScrK, toK, nat2k, syncToS, syncFromS, viewOf};
  const listOn = () => { const ss = document.getElementById('ss'); return !!(ss && ss.classList.contains('on')) || !!(window.MeasureLabProjects && MeasureLabProjects.isOpen && MeasureLabProjects.isOpen()); };
  function activeKind() {
    if (listOn()) return null;
    if (S.mode === 'plan') return S.room && S.room.obj === K.obj ? 'plan' : null;
    if (!S.sess || S.show >= 0) return null;
    if (S.sess.kind === 'board') return S.sess.id === K.board ? 'board' : null;
    return S.mosaic ? 'wall' : null;
  }
  function roomOf(id) { return (S.room && S.room.id === id && S.room) || (S.objRooms || []).find(r => r.id === id) || K.rooms.find(r => r.id === id) || null; }
  function segOf(it) { const r = it.room && roomOf(it.room); if (!r || !r.wid) return null; const k = Object.keys(r.wid).find(k => r.wid[k] === it.wid); return k == null ? null : +k; }
  function sidOf(it) { if (!it.room) return it.sid; const r = roomOf(it.room), k = segOf(it); const sid = r && k != null && r.segs ? r.segs[k] : null; if (sid) it.sid = sid; return sid || null; }
  api.sidOf = sidOf;
  function active() {
    const t = activeKind(); if (!t) return null;
    if (t === 'board') return BOARD;
    if (t === 'plan') return K.items.find(i => i.t === 'plan') || null;
    const s = S.sess; return K.items.find(i => i.t === 'wall' && (i.sid === s.id || (i.room && i.room === s.room && (roomOf(i.room) || {}).wid && roomOf(i.room).wid[s.seg] === i.wid))) || null;
  }
  api.active = active;
  function nativeOnly() { if (activeKind() || listOn()) return false; return S.mode === 'plan' ? !!S.room && S.room.obj === K.obj : !!S.sess && (S.sess.obj || '') === K.obj; }   // стена без 4 углов, кадр — v81 целиком
  api.nativeOnly = nativeOnly;
  function planBox() { const rs = activeKind() === 'plan' ? [S.room, ...(S.objRooms || [])] : K.rooms, P = []; for (const r of rs) if (r && r.ms && !r.pstub && !r.del && r.obj === K.obj) P.push(...(r.ms.pts || [])); if (!P.length) return [0, 0, 6000, 4000];
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]); return [Math.min(...xs) - 900, Math.min(...ys) - 900, Math.max(...xs) + 900, Math.max(...ys) + 900]; }
  function region(it) {   // область в единицах холста: стена — L×H + развёртка боковых и пол; план — все помещения проекта + поле
    if (it.t === 'wall') { const L = +it.L || 3000, H = +it.H || 2700, a = nat2k(it, -WM.x, H + WM.t), b = nat2k(it, L + WM.x, -WM.b); return {x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1]}; }
    if (it.t === 'plan') { const [x0, y0, x1, y1] = planBox(), a = nat2k(it, x0, y1), b = nat2k(it, x1, y0); return {x: a[0], y: a[1], w: b[0] - a[0], h: b[1] - a[1]}; }
    return {x: 0, y: 0, w: 0, h: 0};
  }
  api.region = region;
  const rfH = r => r.w * r.ih / r.iw;
  const refR = r => ({x: r.x, y: -r.y, w: r.w, h: rfH(r)});                // фото подложки → холст
  const boardRefs = () => (activeKind() === 'board' ? S.refs : (K.boardRec && K.boardRec.refs)) || [];
  api.refRegion = id => { const r = boardRefs().find(x => x.id === id); return r ? refR(r) : null; };
  const inR = (r, p, m = 0) => p[0] >= r.x - m && p[0] <= r.x + r.w + m && p[1] >= r.y - m && p[1] <= r.y + r.h + m;
  const ovl = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function titleR(it) { const r = region(it), f = fsz(15) / K.view.s; let tw = 0; try { const d = DPR(); cx.save(); cx.font = `700 ${fsz(15) * d}px system-ui`; tw = (cx.measureText(title(it)).width / d + 8) / K.view.s; cx.restore(); } catch (e) { }
    return {x: r.x, y: r.y - f * 1.7, w: Math.max(r.w * .6, 160 / K.view.s, tw), h: f * 1.6}; }   // QA Д11: ширина — по тексту заголовка
  function title(it) { if (it.t === 'plan') return 'План помещений'; const L = Math.round(+it.L || 0), H = Math.round(+it.H || 0); return (it.name || 'Стена') + (L && H ? ` · ${L} × ${H}` : ''); }

  /* ═══ [BLOCK SK-DRAW] фон и сетка → снимки неактивных областей → активная стена / план (в своей рамке) → подложка поверх (векторно) → рамки ═══ */
  const draw81 = draw;
  function label(x, y, t, c, sz, clip) {   // подписи — в px экрана (размер текста — из настроек Lab); clip — область холста, за которую подпись не выходит
    const d = DPR(), s = toScrK(x, y), f = fsz(sz) * d; cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); if (clip) { const a = toScrK(clip.x, clip.y), b = toScrK(clip.x + clip.w, clip.y + clip.h); cx.beginPath(); cx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); cx.clip(); } cx.font = `700 ${f}px system-ui`;
    if (Array.isArray(t)) { const room = clip ? toScrK(clip.x + clip.w, 0)[0] - s[0] - 6 * d : Infinity; t = t.find(x => cx.measureText(x).width <= room) || t[t.length - 1]; }   // QA Д11: подсказка — вариант, который помещается
    const w = cx.measureText(t).width, fh = parseFloat(cx.font) || f;
    cx.fillStyle = 'rgba(255,255,255,.9)'; cx.fillRect(s[0] - 3 * d, s[1] - fh, w + 6 * d, fh * 1.3); cx.fillStyle = c; cx.fillText(t, s[0], s[1]); cx.restore(); }
  function paintLayer(act) {
    const d = DPR(); cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.fillStyle = '#E9ECF0'; cx.fillRect(0, 0, cv.width, cv.height);
    const s = K.view.s * d; cx.setTransform(s, 0, 0, s, K.view.ox * d, K.view.oy * d); const px = 1 / K.view.s;
    if (cfg().grid !== false) { const a = toK(0, 0), b = toK(cv.width, cv.height); let st = 100; while (st * K.view.s < 18) st *= 5; cx.strokeStyle = 'rgba(26,32,39,.07)'; cx.lineWidth = px; cx.beginPath();
      for (let x = Math.floor(a[0] / st) * st; x < b[0]; x += st) { cx.moveTo(x, a[1]); cx.lineTo(x, b[1]); } for (let y = Math.floor(a[1] / st) * st; y < b[1]; y += st) { cx.moveTo(a[0], y); cx.lineTo(b[0], y); } cx.stroke(); }
    for (const it of K.items) {
      if (it === act) continue; const r = region(it), sn = K.snaps[it.id];
      if (sn && sn.img) cx.drawImage(sn.img, sn.x, sn.y, sn.w, sn.h);
      else { cx.fillStyle = it.t === 'plan' ? '#F4F6F8' : '#F7F8FA'; cx.fillRect(r.x, r.y, r.w, r.h); cx.strokeStyle = '#B8C0CA'; cx.lineWidth = px; cx.setLineDash([6 * px, 4 * px]); cx.strokeRect(r.x, r.y, r.w, r.h); cx.setLineDash([]); }
    }
    cx.restore();
    for (const it of K.items) { if (it === act || (K.snaps[it.id] && K.snaps[it.id].img)) continue; const r = region(it); label(r.x + 12 / K.view.s, r.y + r.h / 2, it.t === 'plan' ? (K.rooms.length ? ['Коснитесь — план помещений', 'Коснитесь — план', 'План'] : ['Коснитесь — новое помещение', 'Новое помещение', '＋']) : ['Коснитесь — стена', 'Коснитесь', 'Стена'], '#6B7380', 13, r); }
  }
  function paintTitles(act) { for (const it of K.items) { const r = region(it); label(r.x, r.y - fsz(15) * .5 / K.view.s, title(it), it === act ? '#1F6FD1' : K.sel === it.id ? '#1F6FD1' : '#3E4954', 15); } }
  function paintOver(act) {   // рамка активной области, выбранная область, 4 угла выбранного фото
    const d = DPR(), s = K.view.s * d; cx.save(); cx.setTransform(s, 0, 0, s, K.view.ox * d, K.view.oy * d); const px = 1 / K.view.s;
    if (act && act !== BOARD) { const r = region(act); cx.strokeStyle = '#1F6FD1'; cx.lineWidth = 2 * px; cx.strokeRect(r.x, r.y, r.w, r.h); }
    const sel = K.sel && byId(K.sel); if (sel && sel !== act) { const r = region(sel); cx.strokeStyle = '#1F6FD1'; cx.lineWidth = 3 * px; cx.setLineDash([10 * px, 6 * px]); cx.strokeRect(r.x, r.y, r.w, r.h); cx.setLineDash([]); }
    cx.restore();
    const rid = K.cor ? K.cor.id : act === BOARD && S.rsel, ref = rid && boardRefs().find(x => x.id === rid);
    if (ref) { const P = corPts(ref); cx.save(); cx.setTransform(s, 0, 0, s, K.view.ox * d, K.view.oy * d);
      if (P.length === 4) { cx.strokeStyle = '#F6B400'; cx.lineWidth = 2.5 * px; cx.setLineDash([8 * px, 5 * px]); cx.beginPath(); P.forEach((q, i) => i ? cx.lineTo(...q) : cx.moveTo(...q)); cx.closePath(); cx.stroke(); cx.setLineDash([]); }
      P.forEach(q => { cx.fillStyle = '#F6B400'; cx.beginPath(); cx.arc(q[0], q[1], pr() * px, 0, 7); cx.fill(); }); cx.restore();
      P.forEach((q, i) => label(q[0] + (pr() + 3) / K.view.s, q[1] - pr() / K.view.s, ['ЛВ', 'ПВ', 'ПН', 'ЛН'][i], '#B07F00', 12)); }
  }
  /* 4 угла фото: ref.q (формат v81, px фото: низ-лево, низ-право, верх-право, верх-лево) ↔ порядок касаний ЛВ ПВ ПН ЛН */
  const q2c = q => q && q.length === 4 ? [q[3], q[2], q[1], q[0]] : null, c2q = c => [c[3], c[2], c[1], c[0]];
  function corPts(ref) { const R = refR(ref), k = R.w / ref.iw, c = K.cor && K.cor.id === ref.id ? K.cor.pts : (ref.qUser || ref.labCor ? q2c(ref.q) : null) || []; return c.map(p => [R.x + p[0] * k, R.y + p[1] * k]); }
  /* подложка: штатная отрисовка поверх; фото — под рисунками (рисунки на фото видны) */
  function boardPaint() { draw81(); try { if (S.mosaic && S.show < 0) drawMarkup(); } catch (e) { } }
  function noBg(fn) { const own = Object.prototype.hasOwnProperty.call(cx, 'fillRect'), fr = cx.fillRect; let skip = true;
    cx.fillRect = function (x, y, w, h) { if (skip && x === 0 && y === 0 && w === cv.width && h === cv.height) { skip = false; return; } return fr.apply(this, arguments); };
    try { return fn(); } finally { if (own) cx.fillRect = fr; else delete cx.fillRect; } }
  function snapNow(act) {   // снимок активной области для показа, когда она неактивна; кодирование — асинхронно (toBlob)
    if (act.t === 'wall' && !(S.mosaic && S.q4 && S.q4.ok && !S.recomp)) return;   // QA Д11: стена ещё не построена (переход, ↶ ↷) — пустой снимок не заменяет прежний
    try { const r = region(act), a = toScrK(r.x, r.y), b = toScrK(r.x + r.w, r.y + r.h), sx = Math.max(0, a[0]), sy = Math.max(0, a[1]), ex = Math.min(cv.width, b[0]), ey = Math.min(cv.height, b[1]);
      if (ex - sx < 40 || ey - sy < 40) return; const cover = sx === a[0] && sy === a[1] && ex === b[0] && ey === b[1], old = K.snaps[act.id];
      if (old && old.cover && !cover) return;   // частичный вид не заменяет полный снимок
      const k = Math.min(1, 1400 / Math.max(ex - sx, ey - sy)), c = document.createElement('canvas'); c.width = Math.round((ex - sx) * k); c.height = Math.round((ey - sy) * k);
      c.getContext('2d').drawImage(cv, sx, sy, ex - sx, ey - sy, 0, 0, c.width, c.height);
      const w0 = toK(sx, sy), w1 = toK(ex, ey), sn = {img: c, x: w0[0], y: w0[1], w: w1[0] - w0[0], h: w1[1] - w0[1], cover};
      K.snaps[act.id] = sn;
      c.toBlob(b => { if (!b || K.snaps[act.id] !== sn) return; const fr = new FileReader(); fr.onload = () => { act.snap = {src: fr.result, x: sn.x, y: sn.y, w: sn.w, h: sn.h, cover}; save(); }; fr.readAsDataURL(b); }, 'image/jpeg', .82); } catch (e) { }
  }
  api.snapNow = snapNow;
  /* снимок — по деактивации области и по простою ≥ 1,5 с без касаний; без выделения и ручек, до подложки */
  let idleT = 0, wantSnap = 0;
  function snapIdle(act) { clearTimeout(idleT); idleT = setTimeout(() => {
    if (!K.on || K.quiet || active() !== act || ours.size || nat.size || F.on) return;
    const keep = {sel: S.sel, dsel: S.dsel, nsel: S.nsel, msel: S.msel}; wantSnap = 1;
    try { S.sel = null; S.dsel = null; S.nsel = null; S.msel = []; draw(); } finally { wantSnap = 0; Object.assign(S, keep); draw(); } }, 1500); }
  let swAct = null;
  /* 82.18 fix (qa-v8218-undo): пока идёт open(), S.sess ещё прежняя стена другого проекта — draw() в этом окне (K.on уже true, подложка не активна)
     уводил холст обратно в прежний проект (switchTo) и создавал ему подложку; фото ложилось туда. Переход — только вне open() и если расхождение осталось. */
  let opening = 0;
  const foreignObj = () => { const fo = S.mode === 'plan' ? S.room && S.room.obj : S.sess && S.sess.kind !== 'board' && S.sess.obj; return fo != null && fo !== false && fo !== '' && fo !== K.obj ? fo : null; };
  /* 82.18 fix (аудит m1): раскладка холста (cv) — в базу сразу при flushAll v81: сворачивание (visibilitychange hidden), pagehide,
     Android onPause (PM.flushAll → flushAll), «Перезапустить» (lab-update saveAll). Во время open() — нет (K ещё собирается). */
  const flush0 = flushAll; flushAll = async function () { const r = await flush0.apply(this, arguments); if (K.on && !opening) { try { await saveNowSk(); } catch (e) { } } return r; };
  function switchTo(obj) { if (opening || swAct === obj) return; swAct = obj; setTimeout(() => { if (opening || !K.on || foreignObj() !== obj || listOn()) { swAct = null; return; } open(obj, {fromNative: 1}).finally(() => { swAct = null; }); }, 0); }
  draw = function () {
    if (!K.on || (window.LABCTX && LABCTX.painting)) return draw81.apply(this, arguments);
    const fo = foreignObj();   // открыто штатно другое (список v81) — переход в его проект, холст не закрывается (во время open() — без перехода)
    if (fo && !listOn()) { if (!opening) switchTo(fo); return draw81.apply(this, arguments); }
    if (listOn() || nativeOnly()) { const r0 = draw81.apply(this, arguments); ui(); return r0; }
    let act = active();
    if (!act && activeKind()) act = adopt();   // стену / план открыли штатно (из плана, ряд С№) — область появляется на холсте
    if (act) { if (act.t === 'wall' && S.q4) { act.L = +S.q4.L || act.L; act.H = +S.q4.H || act.H; } if (K.quiet) syncToS(act); else syncFromS(act); K.act = act === BOARD ? {t: 'board'} : {t: act.t, id: act.id}; }
    paintLayer(act);
    let res;
    if (act && act !== BOARD) {
      const r = region(act), a = toScrK(r.x, r.y), b = toScrK(r.x + r.w, r.y + r.h); cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.beginPath(); cx.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]); cx.clip();
      try { res = draw81.apply(this, arguments); } finally { cx.restore(); }
      if (wantSnap) snapNow(act);
      if (K.boardRec && window.MeasureLabCtx) { const v = viewOf(BOARD); MeasureLabCtx.paint(K.boardRec, v, boardPaint, {noBg: 1}); }
      if (!K.quiet && !wantSnap) snapIdle(act);
    } else if (act === BOARD) { res = noBg(() => boardPaint()); }
    paintTitles(act); if (!wantSnap) paintOver(act); ui();
    return res;
  };
  api.draw = () => draw();
  // «вписать» в холсте: подложка — весь холст; стена / план — область; во время открытия вид держит холст
  const fit81 = fit, plFit81 = plFit;
  const freeH = () => (typeof zFreeH === 'function' ? zFreeH() : cv.height) / DPR();
  function topInset() {   // 82.18 int: штатные плашки вида сверху (#w3p переключатель стен, #mdT вид/∠°/Aa) — вписывать ниже них, заголовок области не закрыт
    const c = cv.getBoundingClientRect(); let t = 0;
    for (const id of ['w3p', 'mdT']) { const e = document.getElementById(id); if (!e || !e.getClientRects().length || getComputedStyle(e).display === 'none') continue; const r = e.getBoundingClientRect(); if (r.height && r.top < c.top + 120) t = Math.max(t, r.bottom - c.top + 4); }
    return Math.max(0, Math.min(t, 120));
  }
  function fitRect(x0, y0, x1, y1) { const W = cv.width / DPR(), T = topInset(), H = freeH() - T, s = clamp(Math.min(W / Math.max(1, x1 - x0), H / Math.max(1, y1 - y0)) * .94, .01, 20); K.view = {s, ox: (W - (x1 - x0) * s) / 2 - x0 * s, oy: T + (H - (y1 - y0) * s) / 2 - y0 * s}; }
  function fitRegion(it) { if (!it) return; if (it === BOARD) return fitAll(); const r = region(it), f = fsz(15) * 2 / K.view.s; fitRect(r.x, r.y - f, r.x + r.w, r.y + r.h); if (active() === it) syncToS(it); }
  function boardBox() { const P = []; for (const r of boardRefs()) { const R = refR(r); P.push([R.x, R.y], [R.x + R.w, R.y + R.h]); } const B = activeKind() === 'board' ? S : K.boardRec || {};
    for (const k of ['dms', 'drw']) for (const q of B[k] || []) for (const p of [q.a, q.b, ...(q.pts || [])]) if (Array.isArray(p) && typeof p[0] === 'number') P.push([p[0], -p[1]]); return P; }
  /* 82.18 fix (QA Д11): «вписать всё» — план не мельче стен, области и их заголовки не накрывают фото и друг друга.
     planScale: масштаб области плана — сторона не меньше 0,7 и не больше 1,6 стороны самой крупной области стены (верхний левый угол на месте).
     tidy: область (вместе с заголовком при текущем масштабе) накрывает фото или уже разложенную область — сдвиг вниз или вправо, что меньше. */
  function planScale() {
    const pl = K.items.find(i => i.t === 'plan'); if (!pl || !K.rooms.length) return;
    const walls = K.items.filter(i => i.t === 'wall').map(region), side = r => Math.max(r.w, r.h), T = walls.length ? Math.max(...walls.map(side)) : 1000, r0 = region(pl), cur = side(r0);
    if (!(cur > 0) || (cur >= T * .7 && cur <= T * 1.6)) return;
    const k = clamp(pl.k * T / cur, .03, .8); if (Math.abs(k - pl.k) < 1e-6) return;
    const f = k / pl.k; pl.k = k; const r1 = region(pl); pl.ax += r0.x - r1.x; pl.ay += r0.y - r1.y;
    for (const sn of [K.snaps[pl.id], pl.snap]) if (sn) { sn.x = r0.x + (sn.x - r0.x) * f; sn.y = r0.y + (sn.y - r0.y) * f; sn.w *= f; sn.h *= f; }   // снимок — вместе с областью
  }
  function shiftItem(it, dx, dy) { it.ax += dx; it.ay += dy; const sn = K.snaps[it.id]; if (sn) { sn.x += dx; sn.y += dy; } if (it.snap) { it.snap.x += dx; it.snap.y += dy; } }
  function tidy() {
    const gap = 12 / K.view.s, boxOf = it => { const r = region(it), t = titleR(it), x0 = Math.min(r.x, t.x), y0 = Math.min(r.y, t.y); return {x: x0, y: y0, w: Math.max(r.x + r.w, t.x + t.w) - x0, h: r.y + r.h - y0}; };
    const obst = boardRefs().map(refR), order = [...K.items].sort((a, b) => region(a).y - region(b).y || region(a).x - region(b).x);
    for (const it of order) {
      for (let n = 0; n < 60; n++) {
        const b = boxOf(it), o = obst.find(q => ovl(b, q)); if (!o) break;
        const dy = o.y + o.h + gap - b.y, dx = o.x + o.w + gap - b.x;
        if (dx < dy) shiftItem(it, dx, 0); else shiftItem(it, 0, dy);
      }
      obst.push(boxOf(it));
    }
  }
  async function refreshDims() {   // QA Д11: L × H неактивных стен — из записи (правки на плане, ↶ ↷ меняют q4 без активации) → заголовок и область
    const all = (await dbAll('sess').catch(() => [])) || [], by = new Map(all.map(o => [o.id, o])); let ch = 0; const a = active();
    for (const it of K.items) { if (it.t !== 'wall' || it === a) continue; const o = by.get(it.sid), q = o && o.q4; if (!q) continue; const L = +q.L || it.L, H = +q.H || it.H;
      if (Math.abs(L - (+it.L || 0)) > .5 || Math.abs(H - (+it.H || 0)) > .5) { it.L = L; it.H = H; ch++; } }
    if (ch) { save(); draw(); } return ch;
  }
  api.refreshDims = refreshDims;
  function fitAll() { try { planScale(); tidy(); } catch (e) { } fitAll0(); try { tidy(); } catch (e) { } fitAll0(); save(); }
  function fitAll0() { const P = boardBox(); for (const it of K.items) { const r = region(it); P.push([r.x, r.y - fsz(15) * 2 / K.view.s], [r.x + r.w, r.y + r.h]); } if (!P.length) return; fitRect(Math.min(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), Math.max(...P.map(p => p[1]))); const a = active(); if (a) syncToS(a); }
  api.fitAll = fitAll; api.fitRegion = fitRegion;
  const fitK = () => { const a = active() || (activeKind() && adopt()); if (a) { if (!K.quiet) fitRegion(a); syncToS(a); } return draw(); };
  fit = function () { return K.on && !nativeOnly() && !listOn() ? fitK() : fit81.apply(this, arguments); };
  plFit = function () { return K.on && !nativeOnly() && !listOn() ? fitK() : plFit81.apply(this, arguments); };

  /* ═══ [BLOCK SK-PLACE] размещение областей и фото ═══ */
  function bbox() { const R = K.items.map(region).concat(boardRefs().map(refR)); if (!R.length) return null; return {x0: Math.min(...R.map(r => r.x)), y0: Math.min(...R.map(r => r.y)), x1: Math.max(...R.map(r => r.x + r.w)), y1: Math.max(...R.map(r => r.y + r.h))}; }
  function free(r, skip) { return !K.items.some(i => i !== skip && ovl(region(i), r)) && !boardRefs().some(x => x !== skip && ovl(refR(x), r)); }
  api.freeBoard = ref => { const r = refR(ref); for (let i = 0; i < 80 && !free(r, ref); i++) r.y += Math.max(60, r.h * .25); return [r.x, -r.y]; };   // фото — на свободное место подложки (lab-board)
  function planItem() { const B = bbox(), [x0, , x1, y1] = planBox(), it = {id: 'n' + uid(), t: 'plan', k: PLAN_K, ax: 0, ay: 0};
    it.ax = (B ? B.x0 - (x1 - x0) * PLAN_K - 140 : 0) - x0 * PLAN_K; it.ay = (B ? B.y0 : 0) + y1 * PLAN_K + 40; K.items.push(it); save(); return it; }
  function wallItem(o, r) { const L = +(o.q4 && o.q4.L) || 3000, H = +(o.q4 && o.q4.H) || 2700, k = 600 / L, seg = o.seg; return {id: 'w' + uid(), t: 'wall', room: r ? r.id : null, wid: r && r.wid ? r.wid[seg] : null, sid: o.id, k, L, H, name: r ? (r.name || 'Помещение') + ' · С' + wN(r, seg) : (o.name || 'Плоскость'), ax: 0, ay: 0}; }
  function adopt() {   // открытая штатно стена / план без области — новая область
    const t = activeKind(); if (!t || t === 'board') return t === 'board' ? BOARD : null;
    if (t === 'plan') return planItem();
    if (S.sess && S.sess.del) return null;   // 82.18 fix (Д1): удалённая (↶ «стена по фото») стена — без новой области
    const r = S.room0; if (r && (!r.wid || !r.wid[S.sess.seg])) { try { gnFix(r); } catch (e) { } }
    const B = bbox(), it = wallItem(S.sess, r); it.ax = (B ? B.x1 + 140 : 0) + WM.x * it.k; it.ay = (B ? B.y0 : 0) + (it.H + WM.t) * it.k + 40; K.items.push(it); save(); return it;
  }
  function placeWall(R, it) {   // стена над фото по ширине фото; места нет — под фото
    const L = +it.L, H = +it.H; it.k = R.w / L; const k = it.k, f = fsz(15) * 2 / K.view.s;
    it.ax = R.x; it.ay = R.y - GAP - WM.b * k;
    if (!free(region(it), it) || !free(titleR(it), it)) it.ay = R.y + R.h + GAP + (H + WM.t) * k + f;
  }
  function autoLayout(walls) {   // нет раскладки: план слева, стены проекта сеткой справа (все стены видны сразу)
    const pl = K.items.find(i => i.t === 'plan') || (K.rooms.length ? planItem() : null); let x = 0, y = 0, rowH = 0; const W0 = pl ? region(pl).x + region(pl).w + 200 : 0;
    walls.forEach(([o, r], i) => { if (K.items.some(it => it.t === 'wall' && (it.sid === o.id || (r && it.room === r.id && r.wid && it.wid === r.wid[o.seg])))) return; const it = wallItem(o, r); const w = (it.L + 2 * WM.x) * it.k, h = (it.H + WM.t + WM.b) * it.k;
      if (i && i % 3 === 0) { x = 0; y += rowH + 160; rowH = 0; } it.ax = W0 + x + WM.x * it.k; it.ay = y + (it.H + WM.t) * it.k + 60; x += w + 160; rowH = Math.max(rowH, h); K.items.push(it); });
  }

  /* ═══ [BLOCK SK-ACT] сделать поверхность активной: штатное открытие подложки / стены / плана, вид — на её месте, разметка (zmSet('mk')) ═══ */
  let actP = null;
  async function activate(it, opt) {
    opt = opt || {}; if (!it) return false; if (active() === it && !opt.force) return true;
    if (actP) { try { await actP; } catch (e) { } if (active() === it) return true; }
    const run = (async () => {
      K.quiet++; const v0 = {...K.view};
      try {
        const cur = active(); if (cur && cur !== BOARD) {
          { const r = region(cur), a = toScrK(r.x, r.y), b = toScrK(r.x + r.w, r.y + r.h); if (a[0] < 0 || a[1] < 0 || b[0] > cv.width || b[1] > cv.height) fitRegion(cur); }   // QA Д11: снимок — всей области (вид вернётся ниже, K.view = v0)
          const keep = {sel: S.sel, dsel: S.dsel, nsel: S.nsel, msel: S.msel}; S.sel = null; S.dsel = null; S.nsel = null; S.msel = [];
          wantSnap = 1; try { draw(); } finally { wantSnap = 0; Object.assign(S, keep); } }
        try { await flushAll(); } catch (e) { }   // текущая поверхность — в базу сразу (saveRoom отложен на 250 мс)
        if (cur === BOARD || (S.sess && S.sess.kind === 'board')) K.boardRec = await dbGet('sess', K.board).catch(() => K.boardRec) || K.boardRec;
        if (it === BOARD) { await openSess(K.board); }
        else if (it.t === 'wall') { let sid = sidOf(it); if (!sid) { await loadRooms(); sid = sidOf(it); } const o = sid && await dbGet('sess', sid); if (!o || o.del) { say('Стена не найдена в базе замеров'); return false; } await openSess(sid); K.lastWall = it.id; }
        else { await loadRooms(); const r = (window.MeasureLabStore && MeasureLabStore.curRoom && K.rooms.find(x => x.id === MeasureLabStore.curRoom(K.pid))) || K.rooms[0]; if (!r) { roomNew(); return false; } await openRoom(r.id, null, true); }   /* r2c Н6: план — текущее помещение проекта (MeasureLabStore.curRoom), иначе первое */
        if (S.mode !== 'plan' && S.tool !== 'mk') { try { await zmSet('mk'); } catch (e) { } }   // любая поверхность — в разметке: ряд инструментов и футляр
        K.view = v0; K.sel = null; syncToS(it); K.act = it === BOARD ? {t: 'board'} : {t: it.t, id: it.id}; save(); draw();
        dispatchEvent(new CustomEvent('measure-lab-activate', {detail: it === BOARD ? {t: 'board', sid: K.board} : it.t === 'plan' ? {t: 'plan', rid: S.room && S.room.id} : {t: 'wall', sid: S.sess && S.sess.id}}));
        return true;
      } finally { K.quiet--; }
    })();
    actP = run; try { return await run; } finally { if (actP === run) actP = null; }
  }
  api.activate = t => activate(t === 'board' ? BOARD : typeof t === 'string' ? byId(t) : t);
  async function loadRooms() { const all = (await dbAll('sess').catch(() => [])) || []; K.rooms = all.filter(o => o.kind === 'room' && !o.del && !o.pstub && o.obj === K.obj).sort((a, b) => a.created - b.created); return K.rooms; }
  function roomNew() { dlg('Новое помещение', `<label>Помещение</label><input type="text" data-sk-name value="Помещение ${K.rooms.length + 1}">`, [{t: 'Отмена'}, {t: 'Создать', pr: 1, fn: B => roomCreate(B.querySelector('[data-sk-name]').value.trim() || 'Помещение')}]); }
  async function roomCreate(n) { K.quiet++; const v0 = {...K.view}; try { try { await flushAll(); } catch (e) { } await newRoom(K.obj, n, true); if (S.room) { S.room.oid = K.pid; try { saveRoom(); } catch (e) { } } await loadRooms(); const it = K.items.find(i => i.t === 'plan') || planItem(); K.view = v0; syncToS(it); draw(); return it; } finally { K.quiet--; } }
  api.roomCreate = roomCreate;
  function panTo(it) { const r = it === BOARD ? null : region(it); if (!r) return; const W = cv.width / DPR(), H = freeH(), s = K.view.s; if (r.w * s > W || r.h * s > H) return fitRegion(it);
    const x0 = r.x * s + K.view.ox, y0 = r.y * s + K.view.oy; if (x0 >= 0 && y0 >= 0 && x0 + r.w * s <= W && y0 + r.h * s <= H) return; K.view = {s, ox: (W - r.w * s) / 2 - r.x * s, oy: (H - r.h * s) / 2 - r.y * s}; }
  async function goWall(r, k) {   // ряд С№ / ⌂-стена: область стены (room, wid); вида стены ещё нет — штатно, затем область
    if (!r) return; try { if (gnFix(r)) saveRoom(); } catch (e) { } const wid = r.wid && r.wid[k];
    let it = K.items.find(i => i.t === 'wall' && i.room === r.id && i.wid === wid);
    if (!it && r.segs && r.segs[k]) { const o = await dbGet('sess', r.segs[k]).catch(() => null); if (o && !o.del && o.q4 && o.q4.ok) { it = wallItem(o, r); const B = bbox(); it.ax = (B ? B.x1 + 140 : 0) + WM.x * it.k; it.ay = (B ? B.y0 : 0) + (it.H + WM.t) * it.k + 40; K.items.push(it); } }
    if (it) { panTo(it); return activate(it); }
    K.quiet++; try { if (S.mode !== 'plan' || !S.room || S.room.id !== r.id) await openRoom(r.id, null, true); S.psel = {t: 's', i: k}; await zmSet('mk'); } finally { K.quiet--; }
    const a = active() || adopt(); if (a) { panTo(a); syncToS(a); draw(); }
  }
  api.goWall = goWall;

  /* ═══ [BLOCK SK-INPUT] касания: активная поверхность — штатно; другая — активировать и передать начатый жест (§2.3);
     заголовок области — перенос / выбор области (🗑); 4 угла фото. Щипок и колесо вне активной области — вид холста ═══ */
  const ours = new Map(), nat = new Set(), F = {on: 0, hold: 0, tgt: null, id: null, buf: [], drop: 0, t0: 0, swallow: new Set()}; let G = null;
  const ptK = ev => { const r = cv.getBoundingClientRect(), d = DPR(); return toK((ev.clientX - r.left) * d, (ev.clientY - r.top) * d); };
  { const spc = cv.setPointerCapture; cv.setPointerCapture = function (id) { try { return spc.call(this, id); } catch (e) { } }; }   // повтор жеста после активации: указатель мог уже отпуститься
  function hitTitle(w) { for (const it of [...K.items].reverse()) if (inR(titleR(it), w)) return it; return null; }
  function hitArea(w) { for (const it of [...K.items].reverse()) if (inR(region(it), w)) return it; return BOARD; }
  api.hitArea = (x, y) => { const a = hitArea([x, y]); return a === BOARD ? 'board' : a.id; };
  const evInit = ev => ({pointerId: ev.pointerId, pointerType: ev.pointerType, isPrimary: ev.isPrimary, clientX: ev.clientX, clientY: ev.clientY, screenX: ev.screenX, screenY: ev.screenY, button: ev.button, buttons: ev.buttons, pressure: ev.pressure, width: ev.width, height: ev.height, tiltX: ev.tiltX, tiltY: ev.tiltY, ctrlKey: ev.ctrlKey, shiftKey: ev.shiftKey, bubbles: true, cancelable: true, composed: true});
  /* 82.18 fix (QA Д6, Д15): касание (без сдвига) неактивной области — только активация; на подложке — выбор фото под пальцем.
     Жест передаётся, только когда это протяжка (сдвиг > 8 px). На подложку жест передаётся лишь инструментам рисования
     (коммуникации, элементы, проёмы на подложке выключены — инструмент сбрасывается на «выбор»). */
  const BOARD_MK = new Set(['sel', 'rsel', 'pen', 'ln', 'arr', 'pl', 'dim', 'rect', 'circ', 'arc', 'er', 'txt', 'pin', 'vyn', 'rf']);
  const boardTool = () => S.tool === 'mk' && BOARD_MK.has(S.mk);
  const MOVE_PX = 8;
  const movedBuf = buf => { const a = buf[0] && buf[0][1]; return !!a && buf.some(([t, b]) => t === 'pointermove' && Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY) > MOVE_PX); };
  function tapBoard(init) {   // касание подложки: фото под пальцем — выбрано
    try { const r = cv.getBoundingClientRect(), d = DPR(), w = toK((init.clientX - r.left) * d, (init.clientY - r.top) * d), R = boardRefs();
      const hit = [...R].reverse().find(x => inR(refR(x), w)); S.sel = null; S.dsel = null; S.msel = []; S.rsel = hit ? hit.id : null; draw(); try { zLay(); } catch (e) { } ui(); } catch (e) { }
  }
  function replay() { const buf = F.buf, up = buf.some(b => b[0] === 'pointerup' || b[0] === 'pointercancel'); F.on = 0; F.hold = 0; nat.add(F.id); for (const [t, init] of buf) cv.dispatchEvent(new PointerEvent(t, init)); if (up) nat.delete(F.id); }
  function tapEnd() { const tgt = F.tgt, init = F.buf[0] && F.buf[0][1]; F.on = 0; F.hold = 0; if (tgt === BOARD && init) tapBoard(init); }
  function forward(ev, tgt) {   // активация с передачей жеста; > 400 мс или второй палец — «первое касание активирует»
    Object.assign(F, {on: 1, hold: 0, tgt, id: ev.pointerId, buf: [['pointerdown', evInit(ev)]], drop: 0, t0: Date.now()});
    activate(tgt).then(ok => {
      const late = Date.now() - F.t0 > 400, buf = F.buf, up = buf.some(b => b[0] === 'pointerup' || b[0] === 'pointercancel'), mv = movedBuf(buf);
      if (!ok || F.drop || late) { F.on = 0; if (!up) F.swallow.add(F.id); else if (ok && !F.drop && !mv && tgt === BOARD) tapBoard(buf[0][1]); return; }
      if (tgt === BOARD && !boardTool()) { try { pickTool('sel'); } catch (e) { } F.on = 0; if (!up) F.swallow.add(F.id); else if (!mv) tapBoard(buf[0][1]); return; }
      if (up && !mv) return tapEnd();
      if (!up && !mv) { F.hold = 1; return; }   // палец ещё на экране: сдвиг — передать жест, отпускание — касание
      replay();
    });
  }
  api.forwardState = () => ({...F, swallow: [...F.swallow]});
  window.addEventListener('pointerdown', ev => {
    if (!K.on || ev.target !== cv || listOn()) return;
    if (F.on) { ev.stopImmediatePropagation(); ev.preventDefault(); F.drop = 1; F.swallow.add(ev.pointerId); return; }
    if (!ours.size && nativeOnly()) { nat.add(ev.pointerId); return; }
    if (!ours.size && nat.size) { nat.add(ev.pointerId); return; }   // второй палец штатного жеста — щипок штатный
    const w = ptK(ev), act = active();
    if (ours.size) { ev.stopImmediatePropagation(); ev.preventDefault(); ours.set(ev.pointerId, [ev.clientX, ev.clientY]); if (ours.size === 2) G = {pinch: pinch0()}; return; }
    const tt = hitTitle(w), ref = K.cor && act === BOARD ? S.refs.find(x => x.id === K.cor.id) : null, corHit = !K.cor && act === BOARD && S.rsel && S.tool === 'mk' && ['sel', 'rsel'].includes(S.mk) && corNear(w);
    if (tt || (ref && inR(refR(ref), w)) || corHit) { ev.stopImmediatePropagation(); ev.preventDefault(); ours.set(ev.pointerId, [ev.clientX, ev.clientY]); down(w, ev, tt, corHit); return; }
    const tgt = hitArea(w);
    if (tgt === act) { if (K.sel) { K.sel = null; draw(); } nat.add(ev.pointerId); return; }   // штатно
    ev.stopImmediatePropagation(); ev.preventDefault(); K.sel = null; forward(ev, tgt);
  }, true);
  const swallowEv = ev => { if (F.on && ev.pointerId === F.id) { ev.stopImmediatePropagation(); F.buf.push([ev.type, evInit(ev)]);
      if (F.hold) { if (ev.type === 'pointerup' || ev.type === 'pointercancel') tapEnd(); else if (movedBuf(F.buf)) replay(); }
      return true; } if (F.swallow.has(ev.pointerId)) { ev.stopImmediatePropagation(); if (ev.type !== 'pointermove') F.swallow.delete(ev.pointerId); return true; } return false; };
  window.addEventListener('pointermove', ev => {
    if (swallowEv(ev)) return;
    if (!ours.has(ev.pointerId)) return; ev.stopImmediatePropagation(); ours.set(ev.pointerId, [ev.clientX, ev.clientY]); if (!G) return;
    if (G.pinch) { const n = pinch0(), o = G.pinch, s = clamp(o.s * n.d / o.d, .01, 20); K.view = {s, ox: n.c[0] - (o.c[0] - o.ox) * s / o.s, oy: n.c[1] - (o.c[1] - o.oy) * s / o.s}; pushView(); return; }
    G.move && G.move(ptK(ev), ev); draw();
  }, true);
  const up = ev => {
    if (swallowEv(ev)) return;
    nat.delete(ev.pointerId); if (!ours.has(ev.pointerId)) return; ev.stopImmediatePropagation(); ours.delete(ev.pointerId);
    const g = G; if (!g) return; if (g.pinch) { G = ours.size ? {pinch: pinch0()} : null; return; }
    G = null; if (ev.type !== 'pointercancel' && g.end) g.end(ptK(ev)); draw();
  };
  window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
  window.addEventListener('wheel', ev => { if (!K.on || ev.target !== cv || listOn() || nativeOnly()) return; const w = ptK(ev), a = active(); if (a === BOARD || (a && inR(region(a), w))) return;
    ev.stopImmediatePropagation(); ev.preventDefault(); const f = Math.exp(-ev.deltaY * .0015), s = clamp(K.view.s * f, .01, 20), r = cv.getBoundingClientRect(); K.view = {s, ox: ev.clientX - r.left - w[0] * s, oy: ev.clientY - r.top - w[1] * s}; pushView(); }, {capture: true, passive: false});
  function pinch0() { const [a, b] = [...ours.values()], r = cv.getBoundingClientRect(); return {d: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, c: [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top], s: K.view.s, ox: K.view.ox, oy: K.view.oy}; }
  function pushView() { const a = active(); if (a) syncToS(a); draw(); save(); }
  function corNear(w) { const ref = S.refs.find(x => x.id === S.rsel); if (!ref || !(ref.qUser || ref.labCor) || !ref.q) return null; const P = corPts(ref), i = P.findIndex(q => Math.hypot(q[0] - w[0], q[1] - w[1]) < Math.max(18, pr() * 2) / K.view.s); return i >= 0 ? {ref, i} : null; }
  function down(w, ev, tt, corHit) {
    if (corHit) { const {ref, i} = corHit, R = refR(ref), k = ref.iw / R.w, q0 = JSON.stringify(ref.q);   // угол тянется (выбор)
      G = {move: q => { const c = q2c(ref.q); c[i] = [(q[0] - R.x) * k, (q[1] - R.y) * k]; ref.q = c2q(c); }, end: () => { const q1 = JSON.stringify(ref.q); if (q1 !== q0) { ref.q = JSON.parse(q0); snap(); ref.q = JSON.parse(q1); saveSess(); } }}; return; }   /* 82.18 int: шаг-снимок (refs в снимке) вместо ZA — ↶ переживает перезапуск */
    if (K.cor && !tt) { const ref = S.refs.find(x => x.id === K.cor.id), R = refR(ref), k = ref.iw / R.w, q = [(w[0] - R.x) * k, (w[1] - R.y) * k];   // 4 угла на фото: ЛВ ПВ ПН ЛН
      G = {end: () => { K.cor.pts.push(q); if (K.cor.pts.length === 4) { const q1 = c2q(K.cor.pts); snap(); ref.q = q1; ref.qUser = 1; ref.labCor = 1; K.cor = null;   /* 82.18 int: шаг-снимок вместо ZA */
        saveSess(); say('Углы стены заданы · ▣ — стена по фото'); } ui(); }}; return; }
    const it = tt, o0 = [it.ax, it.ay], sn = K.snaps[it.id], s0 = sn ? [sn.x, sn.y] : null; let moved = 0;   // заголовок области: перенос / выбор
    const moveIt = (dx, dy) => { it.ax = o0[0] + dx; it.ay = o0[1] + dy; if (s0) { sn.x = s0[0] + dx; sn.y = s0[1] + dy; if (it.snap) { it.snap.x = sn.x; it.snap.y = sn.y; } } };
    G = {move: q => { const dx = q[0] - w[0], dy = q[1] - w[1]; if (!moved && Math.hypot(dx, dy) * K.view.s < 6) return; moved = 1; moveIt(dx, dy); if (active() === it) syncToS(it); },
      end: () => { if (moved) { dispatchEvent(new CustomEvent('measure-lab-canvas-op', {detail: {op: 'move', id: it.id, a: {ax: o0[0], ay: o0[1]}, b: {ax: it.ax, ay: it.ay}}})); return save(); } K.sel = K.sel === it.id ? null : it.id; }};
  }

  /* 82.18 fix (QA Д12): поворот экрана (смена ширины / ориентации) — холст вписывается заново под новые нижние строки.
     Смена только высоты (клавиатура) — без вписывания. */
  { let rzW = innerWidth, rzH = innerHeight, rzT = 0;
    addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { const w = innerWidth, h = innerHeight, turned = Math.abs(w - rzW) > 40 || (w > h) !== (rzW > rzH); rzW = w; rzH = h;
      if (!K.on || !turned || listOn()) return; try { zLay(); } catch (e) { } fitAll(); draw(); save(); }, 250); }); }

  /* ═══ [BLOCK SK-NAV] навигация внутри холста: ✓, 📁, ряд С№, ⌂ / стена, «План» v81 — без закрытия холста ═══ */
  async function done() {   // ✓: футляр / меню — свернуть; иначе сохранить и показать весь холст
    if (S.zSheet) return zSheet(false);
    const tb = document.getElementById('tb'); if (tb && tb.classList.contains('on')) { tb.classList.remove('on'); return; }
    try { await flushAll(); } catch (e) { } await saveNowSk(); try { await refreshDims(); } catch (e) { } K.sel = null; K.cor = null; S.sel = null; S.dsel = null; S.msel = []; S.rsel = null; fitAll(); draw(); say('Сохранено');
  }
  api.done = done;
  async function toProjects() {   // 📁: список проектов; холст остаётся открытым под списком
    try { await flushAll(); } catch (e) { } await saveNowSk();
    if (window.MeasureLabProjects && MeasureLabProjects.show) return MeasureLabProjects.show();
    try { await sessList(true); } catch (e) { }
  }
  api.toProjects = toProjects;
  const zDone0 = zDone; zDone = function () { return K.on ? done() : zDone0.apply(this, arguments); };
  const bDone = document.getElementById('bDone'); if (bDone) bDone.onclick = () => zDone();
  const bSes = document.getElementById('bSes'), bSes0 = bSes && bSes.onclick; if (bSes) bSes.onclick = function () { if (K.on && !listOn()) return toProjects(); if (K.on && listOn() && !window.MeasureLabProjects) { sessList(false); return draw(); } return bSes0 && bSes0.apply(this, arguments); };
  const wGo0 = wGo; wGo = function (j) { if (!K.on) return wGo0.apply(this, arguments); return goWall(S.mode === 'plan' ? S.room : S.room0, j); };
  if (typeof wGo2 === 'function') { const wGo20 = wGo2; wGo2 = function (rid, j) { if (!K.on) return wGo20.apply(this, arguments); return (async () => { await loadRooms(); return goWall(roomOf(rid) || K.rooms.find(r => r.id === rid), j); })(); }; }
  async function goPlan() { let it = K.items.find(i => i.t === 'plan'); if (!it) { await loadRooms(); if (!K.rooms.length) return roomNew(); it = planItem(); } panTo(it); return activate(it); }
  api.goPlan = goPlan;
  const mdGo0 = mdGo; mdGo = function (m) {
    if (!K.on) return mdGo0.apply(this, arguments);
    if (m === 'plan') return goPlan().then(() => { try { lay05(); } catch (e) { } });
    const it = K.lastWall && byId(K.lastWall) || K.items.find(i => i.t === 'wall'); if (it) return activate(it).then(() => { try { lay05(); } catch (e) { } });
    if (S.mode === 'plan') return mdGo0.apply(this, arguments);
  };
  const zm0 = zmSet; zmSet = async function (m) { if (K.on && m === 'plan' && !listOn()) { try { $('zMenu').classList.remove('on'); } catch (e) { } return goPlan(); } return zm0.apply(this, arguments); };
  /* 🗑 — единственное удаление: выбранная область холста (заголовок) — область убирается, вид стены — в «Удалённые»; ↶ — возвращает */
  const sh0 = zSelHas; zSelHas = function () { return (K.on && !!K.sel && !!byId(K.sel)) || sh0.apply(this, arguments); };
  const ds0 = zDelSel; zDelSel = async function () { if (K.on && K.sel && byId(K.sel)) return delRegion(byId(K.sel)); return ds0.apply(this, arguments); };
  async function delRegion(it) {
    if (it.t === 'plan') { K.sel = null; draw(); return say('План помещений не удаляется — помещения удаляются на плане'); }
    if (active() !== BOARD) await activate(BOARD);
    const i = K.items.indexOf(it), sid = sidOf(it), o = sid && await dbGet('sess', sid).catch(() => null), refs = S.refs.filter(r => r.labWall && r.labWall === (it.wid || it.sid));
    const rm = async () => { K.items = K.items.filter(x => x !== it); if (o) { o.del = Date.now(); o.delWhy = 'холст: область удалена'; await dbPut('sess', clone(o)).catch(() => { }); } refs.forEach(r => { delete r.labWall; }); K.sel = null; saveSess(); save(); draw(); };
    const back = async () => { if (!K.items.includes(it)) K.items.splice(Math.min(i, K.items.length), 0, it); if (o) { delete o.del; delete o.delWhy; await dbPut('sess', clone(o)).catch(() => { }); } refs.forEach(r => { r.labWall = it.wid || it.sid; }); saveSess(); save(); draw(); };
    await rm(); zaAdd(() => { back(); }, () => { rm(); });
    dispatchEvent(new CustomEvent('measure-lab-canvas-op', {detail: {op: 'del', a: clone(it), b: null, sid: sid || it.sid || null, refs: refs.map(r => r.id)}}));   /* 82.18 int: sid до удаления и фото с labWall — для журнала lab-history */
    say('Область удалена · ↶ — вернуть');
  }
  api.delRegion = id => delRegion(typeof id === 'string' ? byId(id) : id);

  /* ═══ [BLOCK SK-BACK] системная «назад» Android: window.AkrixBack() → true (обработано) / false (оболочка — прежнее поведение). Синхронно. ═══ */
  const BK = {t: 0};
  const isOn = id => { const e = document.getElementById(id); return !!(e && e.classList.contains('on')); };
  function back() {
    if (!K.on || listOn()) { if (K.on && listOn() && window.MeasureLabProjects && MeasureLabProjects.back) return !!MeasureLabProjects.back(); return false; }
    const ae = document.activeElement;   // 1. клавиатура / поле ввода
    if (ae && ae !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) { ae.blur(); for (const id of ['w3f', 'dmIn', 'ptx']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } return true; }
    if (isOn('w3f')) { $('w3f').classList.remove('on'); return true; }
    const dg = root.querySelector('.sk-dlg.on'); if (dg) { dg.classList.remove('on'); return true; }   // 2. окна, меню, футляр
    for (const id of ['rfv', 'rfr', 'tb', 'zMenu', 'lay', 'set', 'rzM']) if (isOn(id)) { if (id === 'rfr' && typeof rfrClose === 'function') { try { rfrClose(); } catch (e) { $(id).classList.remove('on'); } } else $(id).classList.remove('on'); try { zLay(); } catch (e) { } return true; }
    if (S.zSheet) { zSheet(false); return true; }
    if (K.cor) { K.cor = null; draw(); return true; }   // 2. начатое действие
    if (G || ours.size || F.on) { G = null; ours.clear(); F.drop = 1; draw(); return true; }
    if (S.pend || (S.zpl && S.zpl.length) || (S.zdp && S.zdp.length) || S.zpen) { S.pend = null; S.zpl = []; S.zdp = []; S.zpen = null; try { mkPanel(); } catch (e) { } draw(); return true; }
    if (S.mode === 'plan' && window.PL && (PL.pend || (PL.pts && PL.pts.length))) { try { PL.pend = null; } catch (e) { } draw(); return true; }
    if (K.sel || S.sel || S.dsel || S.nsel || S.rsel || (S.msel && S.msel.length) || (S.mode === 'plan' && (S.psel || S.ppsel))) {   // 3. выделение
      K.sel = null; S.sel = null; S.dsel = null; S.nsel = null; S.rsel = null; S.msel = []; if (S.mode === 'plan') { S.psel = null; S.ppsel = null; } try { mkPanel(); zLay(); } catch (e) { } draw(); return true; }
    const now = Date.now(); if (now - BK.t <= 2000) { BK.t = 0; toProjects(); return true; }   // 4. двойное нажатие — к проектам
    BK.t = now; say('Ещё раз — к проектам'); return true;
  }
  api.back = back;
  window.AkrixBack = () => { try { return back() === true; } catch (e) { console.error('AkrixBack', e); return false; } };

  /* ═══ [BLOCK SK-UI] своей строки нет: команды холста — плитки футляра (lab-tb.js) → api.cmd; выбранное фото подложки — блок в нижней строке (#zpb) ═══ */
  const root = document.createElement('div'); root.id = 'labSketch';
  root.innerHTML = `<div class="sk-dlg"><div class="bx"></div></div>
<input type="file" accept="image/*" capture="environment" data-skf="cam" hidden><input type="file" accept="image/*" multiple data-skf="gal" hidden><input type="file" accept=".json,application/json" data-skf="imp" hidden>`;
  document.body.appendChild(root);
  const $s = q => root.querySelector(q);
  let uiKey = '', uiBlk = '';
  const selRef = () => (K.on && active() === BOARD && S.rsel && (S.refs || []).find(r => r.id === S.rsel)) || null;
  const blk = () => (selRef() || (K.cor && active() === BOARD) ? 'ph' : '');
  api.block = blk;
  function ui() {
    root.classList.toggle('on', K.on); document.body.classList.toggle('lab-sketch', K.on); document.body.classList.toggle('lab-board', K.on && activeKind() === 'board');
    const sel = selRef(), key = K.on ? [K.pid, sel && sel.id, sel && !!(sel.qUser || sel.labCor), !!K.cor, K.cor && K.cor.pts.length, sel && sel.labWall].join('|') : '';
    if (key === uiKey) return; uiKey = key;
    const b = blk(); document.body.classList.toggle('lab-sk-ph', b === 'ph');
    if (b || uiBlk) { try { zpbDraw(); } catch (e) { } try { lay05(); } catch (e) { } }
    uiBlk = b;
  }
  function cmd(a, b) {   // команды холста: плитки футляра (cam, gal, note, plan, room, exp, imp) и блок фото (cor, wall)
    if (!K.on) return false;
    if (a === 'open' || a === 'close' || a === 'obj') return false;   // холст не закрывается и не переключается (решение владельца 11.11.2026)
    const sel = selRef();
    if (a === 'cam' || a === 'gal') return activate(BOARD).then(() => $s(`[data-skf="${a}"]`).click());
    if (a === 'imp') return $s('[data-skf="imp"]').click();
    if (a === 'note') return activate(BOARD).then(() => { pickTool('txt'); zLay(); say('Текст: коснитесь места на холсте'); });
    if (a === 'plan') return goPlan();
    if (a === 'room') return loadRooms().then(roomNew);
    if (a === 'cor' && (sel || K.cor)) { K.cor = K.cor ? null : {id: sel.id, pts: []}; if (K.cor) say('Углы стены: левый-верх, правый-верх, правый-низ, левый-низ'); uiKey = ''; return draw(); }
    if (a === 'wall' && sel) return wallDlg(sel);
    if (a === 'exp') return exportJson();
    return false;
  }
  api.cmd = cmd;

  /* ═══ [BLOCK SK-BAR] выбранное фото подложки — ⌗ 4 угла (n/4) · ▣ Стена — в самой нижней строке (#zpb), после 🖍; удаление — штатной 🗑 ═══ */
  const svgU = (id, vb) => `<svg viewBox="${vb || '0 0 32 32'}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const zpb0 = zpbDraw;
  zpbDraw = function () {
    const res = zpb0.apply(this, arguments), el = document.getElementById('zpb'); if (!el) return res;
    try {
      const old = el.querySelector('#labSkPh'); if (old) old.remove();
      if (!blk()) return res;
      const sel = selRef() || (K.cor && S.refs.find(r => r.id === K.cor.id)); if (!sel) return res;
      const n = K.cor && K.cor.id === sel.id ? K.cor.pts.length : null, w = !!sel.labWall, hasQ = !!(sel.q && (sel.qUser || sel.labCor));
      const h = `<button data-skp="cor" class="${n != null ? 'on' : ''}" title="4 угла стены на фото: ЛВ, ПВ, ПН, ЛН">${kIcoD('pts')}${n != null ? `<i>${n}/4</i>` : ''}</button>`
        + (hasQ ? `<button data-skp="wall" class="${w ? 'on' : ''}" title="${w ? 'Стена по фото создана · ещё раз — заменить вид стены' : 'Стена по фото: помещение, стена плана, L, H'}">${svgU('t-wallseg')}</button>` : '');
      const box = document.createElement('span'); box.id = 'labSkPh'; box.innerHTML = `<span class="sep"></span>${h}<span class="sep"></span>`;
      const f = el.querySelector('#zpF'); if (f) f.after(box); else el.prepend(box);
      box.querySelectorAll('[data-skp]').forEach(x => x.onclick = () => cmd(x.dataset.skp, x));
    } catch (e) { }
    return res;
  };
  function dlg(title, html, buttons) {
    const D = $s('.sk-dlg'), B = D.querySelector('.bx');
    B.innerHTML = `<h4>${esc(title)}</h4>${html}<div class="bt">${buttons.map((b, i) => `<button data-dg="${i}" class="${b.pr ? 'pr' : ''}">${esc(b.t)}</button>`).join('')}</div>`;
    D.classList.add('on'); const close0 = () => D.classList.remove('on');
    B.querySelectorAll('[data-dg]').forEach(x => x.onclick = () => { const b = buttons[+x.dataset.dg]; if (!b.keep) close0(); b.fn && b.fn(B); });
    return {B, close: close0};
  }
  api.dialog = dlg;
  for (const k of ['cam', 'gal', 'imp']) { const inp = $s(`[data-skf="${k}"]`); inp.onchange = async ev => { const fs0 = [...ev.target.files]; ev.target.value = ''; if (!fs0.length) return;
    if (k === 'imp') { try { await importJson(JSON.parse(await fs0[0].text())); } catch (e) { say('Файл не прочитан: ' + e.message); } } else { if (active() !== BOARD) await activate(BOARD); await MeasureLabBoard.addRefs(fs0); } }; }

  /* ═══ [BLOCK SK-WALL] фото → стена: помещение, стена плана (или новая), L, H (предзаполнение размерами на фото); область — над фото ═══ */
  const aspect = c => { const d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]); return (d(c[0], c[1]) + d(c[3], c[2])) / (d(c[0], c[3]) + d(c[1], c[2])); };
  function photoLH(ref) {   // §5.3: размеры со значением на фото — горизонтальный ≥ 80 % края по 4 углам → L, вертикальный → H
    const B = activeKind() === 'board' ? S : K.boardRec || {}, R = {x: ref.x, y: ref.y, w: ref.w, h: rfH(ref)}, inside = p => p[0] >= R.x && p[0] <= R.x + R.w && p[1] <= R.y && p[1] >= R.y - R.h;
    const c = q2c(ref.q), k = ref.w / ref.iw, wTop = c ? Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) * k : ref.w, wBot = c ? Math.hypot(c[2][0] - c[3][0], c[2][1] - c[3][1]) * k : ref.w, hL = c ? Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1]) * k : R.h;
    let L = null, H = null;
    for (const q of [...(B.dms || []), ...(B.drw || []).filter(x => x.k === 'arr')]) { const v = +(q.vm || q.v); if (!(v > 0) || !Array.isArray(q.a) || !Array.isArray(q.b) || !inside(q.a) || !inside(q.b)) continue;
      const dx = Math.abs(q.b[0] - q.a[0]), dy = Math.abs(q.b[1] - q.a[1]), len = Math.hypot(dx, dy);
      if (dx > dy * 3 && len >= .8 * Math.min(wTop, wBot)) { if (!L || len > L.len) L = {v, len}; } else if (dy > dx * 3 && len >= .8 * hL) { if (!H || len > H.len) H = {v, len}; } }
    return {L: L && L.v, H: H && H.v};
  }
  api.photoLH = id => { const r = boardRefs().find(x => x.id === id); return r ? photoLH(r) : null; };
  async function wallDlg(p) {
    if (!p.q || !(p.qUser || p.labCor)) return say('Сначала 4 угла стены (⌗)');
    const R = await loadRooms(), opts = R.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join(''), ph = photoLH(p);
    const d = dlg('Стена по фото', `<label>Помещение</label><select data-sk-room>${opts}<option value="">＋ Новое помещение</option></select><div data-sk-new><label>Название</label><input type="text" data-sk-name value="Помещение ${R.length + 1}"></div><div data-sk-walls></div>
<label>Длина L, мм${ph.L ? ' — с фото' : ' (пусто — с плана или ≈)'}</label><input data-sk-l inputmode="decimal" value="${ph.L || ''}"><label>Высота H, мм${ph.H ? ' — с фото' : ' (пусто — помещения или ≈)'}</label><input data-sk-h inputmode="decimal" value="${ph.H || ''}">`, [{t: 'Отмена'}, {t: 'Создать', pr: 1, keep: 1, fn: B => go(B)}]);
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
  api.wallDlg = id => { const r = boardRefs().find(x => x.id === (typeof id === 'string' ? id : id && id.id)); return r ? wallDlg(r) : null; };
  async function createWall(p, to, dim) {
    dim = dim || {}; K.quiet++; const v0 = {...K.view}, pid = p.id, Rp = refR(p);
    try {
      await saveNowSk(); try { await flushAll(); } catch (e) { } K.boardRec = await dbGet('sess', K.board).catch(() => K.boardRec) || K.boardRec;
      const fresh = !to.id, planNew = !K.items.some(i => i.t === 'plan');
      if (to.id) await openRoom(to.id, null, true); else { await newRoom(K.obj, to.name, true); if (S.room) S.room.oid = K.pid; }
      /* 82.18 fix (QA Д1): новое помещение — часть одного шага «стена по фото» (↶ удаляет помещение, стену и созданные области целиком);
         в существующем помещении — снимок плана (P) + шаг холста */
      const r = S.room; if (!r) throw new Error('помещение не открыто'); const m = r.ms; if (!fresh) plSnap();
      let k = to.k;
      const asp = aspect(q2c(p.q)), pl0 = k != null && k !== 'new' ? plLen(m, k) : null;
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
      const old = (r.segs || {})[k]; if (old) { try { const o = await dbGet('sess', old); if (o) { o.del = Date.now(); o.delWhy = 'холст: вид стены заменён'; await dbPut('sess', o); } } catch (e) { } }
      const ts = Date.now(), sid = 's' + ts.toString(36) + Math.random().toString(36).slice(2, 5);
      const o = {id: sid, obj: r.obj, name: r.name + ' · С' + wN(r, k), created: ts, upd: ts, frames: [], room: r.id, seg: k,
        q4: {L, H, ok: 1, fr: {}, blank: 1, aL, aH}, lines: {floor: [[0, 0], [L, 0]], left: [[0, 0], [0, H]], right: [[L, 0], [L, H]], ceil: [[0, H], [L, H]]}, la: {}, man: {}, wsh: {},
        els: [], notes: [], und: [], dms: [], drw: [], rts: [], polys: [], rulers: [], refs: [], labSketch: {pid: K.pid, obj: K.obj, photo: pid}};
      await dbPut('sess', o); r.segs = r.segs || {}; r.segs[k] = sid; r.upd = Date.now(); await dbPut('sess', clone(r)); saveRoom(); await loadRooms();
      const wid = r.wid && r.wid[k];
      let it = K.items.find(i => i.t === 'wall' && ((i.room === r.id && i.wid === wid) || i.sid === old));
      if (it) { it.sid = sid; it.room = r.id; it.wid = wid; it.L = L; it.H = H; delete K.snaps[it.id]; delete it.snap; }   // замена вида — та же область
      else { it = {id: 'w' + uid(), t: 'wall', room: r.id, wid, sid, L, H, name: r.name + ' · С' + wN(r, k), ax: 0, ay: 0, k: 1}; placeWall(Rp, it); K.items.push(it); }
      if (!K.items.some(i => i.t === 'plan')) planItem();
      const brd = await dbGet('sess', K.board); if (brd) { const rr = (brd.refs || []).find(x => x.id === pid); if (rr) { rr.labWall = wid || sid; await dbPut('sess', brd); } K.boardRec = brd; }   // связь фото → стена (постоянный ID стены)
      K.sel = null; K.cor = null; await saveNowSk();
      await openSess(sid); if (S.tool !== 'mk') await zmSet('mk');
      for (let i = 0; i < 80; i++) { if (S.mosaic && S.q4 && S.q4.ok && !S.recomp && S.sess && S.sess.id === sid) { try { await saveNow(); } catch (e) { } const w = await dbGet('sess', sid).catch(() => null); if (w && w.out) break; } await new Promise(z => setTimeout(z, 75)); }   // снимок для выгрузки (out)
      K.view = v0; { const a = region(it), f = fsz(15) * 2 / K.view.s; fitRect(Math.min(a.x, Rp.x), Math.min(a.y - f, Rp.y), Math.max(a.x + a.w, Rp.x + Rp.w), Math.max(a.y + a.h, Rp.y + Rp.h)); } syncToS(it); K.lastWall = it.id; K.act = {t: 'wall', id: it.id}; save(); draw();
      const pit = planNew ? K.items.find(i => i.t === 'plan') : null;
      dispatchEvent(new CustomEvent('measure-lab-canvas-op', {detail: {op: 'wall', a: null, b: {id: it.id, sid, room: r.id, wid, photo: pid, fresh: fresh ? 1 : 0, plan: pit ? clone(pit) : null}}}));
      say(`Стена ${it.name} · ${Math.round(L)}${aL ? ' ≈' : ''} × ${Math.round(H)}${aH ? ' ≈' : ''} — правка штатными инструментами`);
      return {room: r.id, k, sid, wid, item: it.id};
    } finally { K.quiet--; }
  }
  api.createWall = (refId, to, dim) => { const r = boardRefs().find(x => x.id === refId); if (!r) throw new Error('нет фото'); return createWall(r, to, dim); };

  /* ═══ [BLOCK SK-JSON] перенос холста measure-sketch v3: раскладка + подложка (фото, размеры, рисунки) + картинки; импорт v1 / v2 / v3 ═══ */
  const b2u = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(b); });
  async function exportObj() {
    try { if (activeKind() === 'board') await saveNow(); } catch (e) { }
    const brd = (await dbGet('sess', K.board).catch(() => null)) || K.boardRec || {}, images = {};
    for (const r of brd.refs || []) { const b = await dbGet('img', 'ref:' + r.id).catch(() => null); if (b) images[r.id] = await b2u(b); }
    const layout = clone(K.items).map(i => { delete i.snap; return i; });
    return {format: 'measure-sketch', v: 3, app: 'Measure ' + ver(), pid: K.pid, obj: K.obj, date: new Date().toISOString(), layout, board: clone({refs: brd.refs || [], dms: brd.dms || [], drw: brd.drw || [], notes: brd.notes || []}), images};
  }
  api.exportObj = exportObj;
  async function exportJson() { const o = await exportObj(), txt = JSON.stringify(o), fn = 'holst_' + (K.obj || 'proekt').replace(/[^\wа-яА-ЯёЁ.-]+/g, '_') + '_' + o.date.slice(0, 10) + '.json';
    try { if (typeof appSave === 'function' && appSave(fn, txt)) return say('Холст сохранён: ' + fn); } catch (e) { }
    try { const u = URL.createObjectURL(new Blob([txt], {type: 'application/json'})), a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); say('Холст сохранён: ' + fn); } catch (e) { say('Сохранение отклонено'); } }
  async function importJson(o) {   // в подложку текущего проекта, ниже содержимого холста; ↶ — одним шагом
    if (!o || o.format !== 'measure-sketch') return say('Это не файл холста');
    if (active() !== BOARD) await activate(BOARD);
    const B = bbox(), dyK = B ? B.y1 + 200 : 0, refs = [], drw = [], dms = [], idm = {};
    const nid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (o.v === 3) {
      const R0 = (o.board && o.board.refs) || [], ys = R0.map(r => -r.y), y0 = ys.length ? Math.min(...ys) : 0, dy = -(dyK - y0);   // сдвиг по y (ось v81 вверх)
      for (const r of R0) { const id = nid('r'), src = (o.images || {})[r.id]; if (src) { try { await dbPut('img', await (await fetch(src)).blob(), 'ref:' + id); } catch (e) { } } idm[r.id] = id; const n = {...r, id, y: r.y + dy}; delete n.labWall; refs.push(n); }
      const mv = q => { const c = JSON.parse(JSON.stringify(q)); c.id = nid('d'); for (const k of ['a', 'b']) if (Array.isArray(c[k])) c[k] = [c[k][0], c[k][1] + dy]; if (Array.isArray(c.pts)) c.pts = c.pts.map(p => [p[0], p[1] + dy]); return c; };
      for (const q of (o.board && o.board.dms) || []) dms.push(mv(q)); for (const q of (o.board && o.board.drw) || []) drw.push(mv(q));
    } else {
      const src = o.v === 2 ? (o.items || []) : (o.photos || []).map(p => ({...p, t: 'photo'})), ys = src.map(i => +i.y || 0), dy = ys.length ? dyK - Math.min(...ys) : 0;
      for (const q of src) {
        if (q.t === 'photo') { const id = nid('r'); if (q.src) { try { await dbPut('img', await (await fetch(q.src)).blob(), 'ref:' + id); } catch (e) { } } refs.push({id, n: 0, iw: q.iw, ih: q.ih, w: q.w || 600, x: +q.x || 0, y: -((+q.y || 0) + dy), q: q.cor ? c2q(q.cor) : null, qUser: q.cor ? 1 : 0, labCor: q.cor ? 1 : undefined, found: [], t: Date.now()}); }
        else if (q.t === 'note') drw.push({id: nid('d'), k: 'txt', a: [+q.x || 0, -((+q.y || 0) + dy)], tx: q.tx || '', c: '#1a2027'});
      }
    }
    let n0 = Math.max(0, ...S.refs.map(r => r.n || 0)); refs.forEach(r => { r.n = ++n0; });
    const add = () => { S.refs.push(...refs); S.dms.push(...dms); S.drw.push(...drw); }, rm = () => { S.refs = S.refs.filter(x => !refs.includes(x)); S.dms = S.dms.filter(x => !dms.includes(x)); S.drw = S.drw.filter(x => !drw.includes(x)); };
    snap(); add(); saveSess(); draw();   /* 82.18 int: импорт — шаг-снимок (refs, dms, drw в снимке) вместо ZA */
    say(`Загружено: фото ${refs.length}, рисунков ${dms.length + drw.length}` + (o.obj && o.obj !== K.obj ? ` (из «${o.obj}»)` : ''));
    return {refs: refs.length, drw: dms.length + drw.length};
  }
  api.importJson = importJson;

  /* ═══ [BLOCK SK-MIG] перенос холста 82.14–82.17 (akrix-sketch.sk[obj] v1 / v2) в проект: фото → refs подложки (картинка копируется в akrix-zamer img 'ref:'+id),
     заметки → текст подложки, области стен → (room, wid); старые записи не удаляются (откат на 82.17 возможен) ═══ */
  async function migrateCanvas(pid, sk, boardId) {
    if (!sk) return null; const items = sk.v === 2 ? sk.items || [] : [...(sk.photos || []).map(p => ({...p, t: 'photo'})), ...(sk.notes || []).map(n => ({...n, t: 'note'}))];
    const brd = await dbGet('sess', boardId); if (!brd) return null; const all = (await dbAll('sess').catch(() => [])) || [], out = [], wmap = {};
    for (const it of items) if (it.t === 'wall' || (it.t === 'photo' && it.wall && it.wall.sid)) {
      const sid = it.t === 'wall' ? it.sid : it.wall.sid, o = all.find(x => x.id === sid); if (!o || o.del) continue; const r = o.room ? all.find(x => x.id === o.room) : null; if (r && !(r.wid && r.wid[o.seg])) { try { if (wIdFix(r)) await dbPut('sess', r); } catch (e) { } }
      const w = it.t === 'wall' ? {id: it.id, t: 'wall', room: r ? r.id : null, wid: r && r.wid ? r.wid[o.seg] : null, sid, ax: it.ax, ay: it.ay, k: it.k, L: it.L, H: it.H, name: it.name, snap: it.snap} : null;
      if (w) { out.push(w); wmap[it.id] = w.wid || sid; } }
    for (const it of items) if (it.t === 'plan') out.push({id: it.id, t: 'plan', ax: it.ax, ay: it.ay, k: it.k, snap: it.snap});
    const refs = brd.refs || (brd.refs = []), drw = brd.drw || (brd.drw = []); let n = Math.max(0, ...refs.map(r => r.n || 0));
    for (const it of items) {
      if (it.t === 'photo' && !refs.some(r => r.labFrom === it.id)) { const b = await sGet('img', it.id).catch(() => null), id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); if (b) await dbPut('img', b, 'ref:' + id);
        refs.push({id, n: ++n, iw: it.iw, ih: it.ih, w: it.w || 600, x: +it.x || 0, y: -(+it.y || 0), q: it.cor ? c2q(it.cor) : null, ...(it.cor ? {qUser: 1, labCor: 1} : {}), found: [], t: Date.now(), labFrom: it.id, ...(it.wall && wmap[it.wall] ? {labWall: wmap[it.wall]} : {})}); }
      if (it.t === 'note' && !drw.some(q => q.labFrom === it.id)) drw.push({id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), k: 'txt', a: [+it.x || 0, -(+it.y || 0)], tx: it.tx || '', c: '#1a2027', labFrom: it.id});
    }
    brd.upd = Date.now(); await dbPut('sess', brd);
    return {pid, v: 3, board: boardId, view: sk.view || null, act: {t: 'board'}, items: out};
  }
  api.migrateCanvas = async (pid, sk) => { const b = await boardFor(pid, sk && sk.obj); return migrateCanvas(pid, sk, b.id); };

  /* ═══ [BLOCK SK-OPEN] открыть проект (pid = oid; без MeasureLabStore — строка объекта); подложка проекта создаётся при первом открытии ═══ */
  async function resolve(arg) {
    const st = window.MeasureLabStore && typeof MeasureLabStore.get === 'function' ? MeasureLabStore : null;
    if (st) { try { const P = await st.get(arg); if (P) return {pid: P.id, obj: P.obj}; } catch (e) { } }
    const all = (await dbAll('sess').catch(() => [])) || [];
    let x = all.find(o => o.kind === 'room' && !o.del && o.oid === arg) || all.find(o => o.kind === 'board' && !o.del && o.labOid === arg);
    if (x) return {pid: arg, obj: x.obj || ''};
    const obj = String(arg), rooms = all.filter(o => o.kind === 'room' && !o.del && !o.pstub && o.obj === obj), b = all.find(o => o.kind === 'board' && !o.del && o.obj === obj);
    let pid = (rooms.find(r => r.oid) || {}).oid || (b && b.labOid);
    if (!pid && rooms.length) { try { pid = await oidFix(rooms); } catch (e) { } }
    return {pid: pid || 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), obj};
  }
  async function boardFor(pid, obj) {
    const all = (await dbAll('sess').catch(() => [])) || []; let b = all.find(o => o.kind === 'board' && !o.del && o.labOid === pid);
    if (!b) { b = MeasureLabBoard.record(pid, obj); await dbPut('sess', b); } else if (obj && b.obj !== obj) { b.obj = obj; await dbPut('sess', b); }
    return b;
  }
  async function open(arg, opt) { opening++; try { return await open1(arg, opt); } finally { opening--; } }
  async function open1(arg, opt) {
    opt = opt || {}; if (arg == null) arg = K.pid || curObj(); if (!arg) return null;
    const pr0 = await resolve(arg);
    if (K.on && pr0.pid === K.pid) { if (window.MeasureLabProjects && MeasureLabProjects.hide) MeasureLabProjects.hide(); if (listOn()) try { sessList(false); } catch (e) { } draw(); return K; }
    if (K.on) { try { await flushAll(); } catch (e) { } await saveNowSk(); }
    const b = await boardFor(pr0.pid, pr0.obj);
    let cvr = await cvLoad(pr0.pid);
    Object.assign(K, {pid: pr0.pid, obj: pr0.obj, board: b.id, boardRec: b, items: [], view: {ox: 20, oy: 80, s: 0.4}, act: {t: 'board'}, sel: null, cor: null, snaps: {}, lastWall: null, extra: {}});
    await loadRooms();
    if (!cvr) { const old = await sGet('sk', pr0.obj).catch(() => null); if (old) { cvr = await migrateCanvas(pr0.pid, old, b.id); K.boardRec = await dbGet('sess', b.id); } }
    if (cvr) { const {pid, v, obj, board, view, act, items, upd, ...rest} = cvr; K.extra = rest; K.items = (items || []).filter(i => i.t === 'wall' || i.t === 'plan'); if (view && view.s > 0) K.view = view; if (act) K.act = act; }
    const all = (await dbAll('sess').catch(() => [])) || [], walls = [];
    for (const r of K.rooms) for (const [k, sid] of Object.entries(r.segs || {})) { const o = all.find(x => x.id === sid); if (o && !o.del && o.q4 && o.q4.ok) { o.seg = +k; walls.push([o, r]); } }
    if (!cvr) { autoLayout(walls); }
    else for (const it of K.items) { const w = it.t === 'wall' && walls.find(([o]) => o.id === it.sid); if (w && w[0].q4) { it.L = +w[0].q4.L || it.L; it.H = +w[0].q4.H || it.H; } }   // QA Д11: L × H — из записи
    for (const it of K.items) if (it.snap && it.snap.src) { const im = new Image(); im.src = it.snap.src; await new Promise(z => { im.onload = z; im.onerror = z; }); K.snaps[it.id] = {img: im, x: it.snap.x, y: it.snap.y, w: it.snap.w, h: it.snap.h, cover: it.snap.cover}; }
    if (window.MeasureLabProjects && MeasureLabProjects.hide) MeasureLabProjects.hide(); try { await sessList(false); } catch (e) { }
    K.on = true; uiKey = ''; document.body.classList.add('lab-sketch');
    try { localStorage.setItem('measure.lab.canvas', JSON.stringify({pid: K.pid, obj: K.obj})); } catch (e) { }
    const tgt = K.act.t === 'wall' && byId(K.act.id) || K.act.t === 'plan' && byId(K.act.id) || BOARD;
    if (!opt.fromNative || !activeKind()) { const ok = await activate(tgt, {force: 1}); if (!ok && tgt !== BOARD) await activate(BOARD, {force: 1}); }
    if (!cvr) { fitAll(); const a = active(); if (a) syncToS(a); }
    await saveNowSk(); draw(); return K;
  }
  function curObj() { return (S.room && S.room.obj) || (S.room0 && S.room0.obj) || (S.sess && S.sess.obj) || ((document.getElementById('nObj') || {}).value || '').trim(); }
  api.open = open; api.loadRooms = loadRooms; api.isOpen = () => K.on; api.pid = () => K.pid; api.region = region;
  api.close = () => false;   // холст не закрывается (решение владельца 11.11.2026)
  addEventListener('measure-lab-settings', () => { if (K.on) draw(); });

  /* ═══ [BLOCK SK-ENTRY] вход до списка проектов (инженер A): «✎ Скетч» в списке v81 ═══ */
  function entry() {
    const nw = document.querySelector('#ss .nw'); if (nw && !nw.querySelector('[data-sk-open]')) { const b = document.createElement('button'); b.dataset.skOpen = 'ss'; b.textContent = '✎ Скетч'; b.title = 'Холст проекта: фото, стены, план, пометки'; b.onclick = () => { const v = ((document.getElementById('nObj') || {}).value || '').trim(); if (v) open(v); else say('Введите клиента · проект'); }; nw.appendChild(b); }
  }
  entry();
})();
