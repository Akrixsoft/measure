/* Measure 82.18 — общий журнал отмены проекта и фото в штатном снимке (AKX-2026-0012, проект архитектора §4).
   (a) Фото-справки — шаг-снимок v81 (scripts/undo-patch.py добавил refs в snap/unsnap/zState/undo): добавление и удаление
       фото идут через snap(), а не замыкания ZA, поэтому ↶ ↷ возвращают фото после перезапуска.
   (b) Журнал проекта hj: порядок шагов между поверхностями (стена / подложка — S.und, план — S.pund) поверх штатных стеков.
       Метка {t:'N', sid, n, h} | {t:'P', rid, n, h} проверяется длиной и хэшем вершины; расхождение — метка пропускается молча.
       Переход на поверхность другой метки — только на холсте (MeasureLabSketch.activate); вне холста ↶ работает штатно по
       текущей поверхности. Шаги холста (K — раскладка, C — составные) — обработчики register(t, {undo, redo}) модуля холста.
   (d) Картинки не удаляются до «Удалить навсегда»: замена подложки плана (ulAdd) и фото выноски (nAttach) кладут старый
       ключ в корзину записи (room.bin / sess.labBin); sessPurge удаляет их вместе с записью.
   Поверх неизменной v81 (обёртки): snap, unsnap, zaAdd, w3Hist, plSnap, zUndo, zRedo, undo, rfAdd, rfDel, ulAdd, nAttach,
   dbTx (только на время ulAdd / nAttach), sessPurge, zLay, flushAll; перепривязка #bUnd / #bRed. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabHistory) return;
  const api = window.MeasureLabHistory = {version: 1};
  const LIM = 200;

  /* ═══ [BLOCK HJ-STORE] хранение журнала: по проекту; адаптер подменяет модуль проектов (cv.hj), по умолчанию — localStorage ═══ */
  const fnv = s => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  const hOf = t => t == null ? '' : typeof t === 'string' ? fnv(t) : fnv(JSON.stringify(t.R || t));
  function scope() {
    const sk = window.MeasureLabSketch;
    try { if (sk && sk.isOpen && sk.isOpen()) { if (typeof sk.pid === 'function' && sk.pid()) return 'p:' + sk.pid(); if (sk.state && sk.state.obj) return 'o:' + sk.state.obj; } } catch (e) { }
    const o = (S.mode === 'plan' ? S.room : S.room0) || null;
    if (o && o.oid) return 'p:' + o.oid;
    const obj = (o && o.obj) || (S.sess && S.sess.obj) || '';
    return obj ? 'o:' + obj : S.sess ? 's:' + S.sess.id : S.room ? 'r:' + S.room.id : '';
  }
  api.storage = {
    load(sc) { try { return JSON.parse(localStorage.getItem('measure.lab.hj:' + sc) || 'null'); } catch (e) { return null; } },
    save(sc, d) { try { localStorage.setItem('measure.lab.hj:' + sc, JSON.stringify(d)); } catch (e) { } }
  };
  const H = {sc: null, j: [], r: [], busy: 0, mute: 0};
  function sync() { const sc = scope(); if (sc === H.sc) return; if (H.sc) persistNow(); H.sc = sc; const d = sc ? api.storage.load(sc) : null; H.j = (d && d.j) || []; H.r = (d && d.r) || []; }
  let pT = 0;
  function persistNow() { clearTimeout(pT); if (H.sc) api.storage.save(H.sc, {v: 1, j: H.j.slice(-LIM), r: H.r.slice(-LIM)}); }
  const persist = () => { clearTimeout(pT); pT = setTimeout(persistNow, 300); };
  api.flush = persistNow;

  /* ═══ [BLOCK HJ-REC] метки шагов: после штатного push в S.und / S.pund ═══ */
  function rec(e) { if (H.busy || H.mute) return; sync(); H.j.push(e); if (H.j.length > LIM) H.j.splice(0, H.j.length - LIM); H.r = []; persist(); }
  const recWall = () => { if (!S.sess || !S.und.length) return; rec({t: 'N', sid: S.sess.id, n: S.und.length, h: hOf(S.und[S.und.length - 1])}); };
  const recPlan = () => { if (!S.room || !S.pund.length) return; rec({t: 'P', rid: S.room.id, n: S.pund.length, h: hOf(S.pund[S.pund.length - 1])}); };
  api.push = e => { if (!e || !e.t) return; rec(e); };
  api.size = () => { sync(); return H.j.length; };
  api.entries = () => { sync(); return {j: H.j.slice(), r: H.r.slice()}; };
  const HANDLERS = {};
  api.register = (t, h) => { HANDLERS[t] = h; };

  const snap0 = snap; snap = function () { const r = snap0.apply(this, arguments); try { recWall(); } catch (e) { } return r; };
  const unsnap0 = unsnap; unsnap = function () { const n0 = S.und.length, r = unsnap0.apply(this, arguments);
    try { if (S.und.length < n0) { const t = H.j[H.j.length - 1]; if (t && t.t === 'N' && S.sess && t.sid === S.sess.id && t.n === n0) { H.j.pop(); persist(); } } } catch (e) { } return r; };   // правка без изменений — не шаг
  let zaMute = 0;
  const za0 = zaAdd; zaAdd = function (u, r) {
    if (zaMute) return 'ZA:lab-muted';   // шаг уже записан снимком (фото: rfAdd / rfDel)
    const id = za0.apply(this, arguments); try { recWall(); } catch (e) { } return id; };
  const w3H0 = w3Hist; w3Hist = function () { const n0 = S.und.length, r = w3H0.apply(this, arguments); try { if (S.und.length > n0) recWall(); } catch (e) { } return r; };
  const pls0 = plSnap; plSnap = function () { const r = pls0.apply(this, arguments); try { recPlan(); } catch (e) { } return r; };

  /* ═══ [BLOCK HJ-PHOTO] фото — шаг-снимок (с refs), не ZA: переживает перезапуск ═══ */
  const rfAdd0 = rfAdd; rfAdd = async function () {
    const n0 = (S.refs || []).length; let snapped = false;
    if (S.mosaic) { snap(); snapped = true; }
    zaMute++; let res;
    try { res = await rfAdd0.apply(this, arguments); } finally { zaMute--; }
    if (snapped && (S.refs || []).length === n0) unsnap();   // фото не добавлено — шага нет
    try { zLay(); } catch (e) { }
    return res;
  };
  const rfDel0 = rfDel; rfDel = function (id) {
    const r = (S.refs || []).find(x => x.id === id); if (!r) return rfDel0.apply(this, arguments);
    if (S.wsh && S.wsh.gaRf === id && S.wsh.ga) r.labGa = {ga: S.wsh.ga, gr: S.wsh.gaRf};   // выравнивание по фото — вернётся вместе с фото
    snap(); zaMute++; let res;
    try { res = rfDel0.apply(this, arguments); } finally { zaMute--; }
    try { if (S.sess) { const k = 'ref:' + id, b = S.sess.labBin = S.sess.labBin || []; if (!b.includes(k)) b.push(k); } saveSess(); zLay(); } catch (e) { }
    return res;
  };
  const undo0 = undo; undo = function () { const r = undo0.apply(this, arguments);
    try { for (const q of S.refs || []) if (q.labGa && !(S.wsh && S.wsh.gaRf)) { S.wsh = S.wsh || {}; S.wsh.ga = q.labGa.ga; S.wsh.gaRf = q.labGa.gr; } } catch (e) { } return r; };

  /* ═══ [BLOCK HJ-BIN] картинки — до «Удалить навсегда»: 2 места v81 с немедленным удалением ═══ */
  const BIN = {on: null};
  const dbTx0 = dbTx; dbTx = function (store, mode, fn) {
    if (BIN.on && store === 'img' && mode === 'readwrite') {
      let key = null; try { fn({delete(k) { key = k; return null; }}); } catch (e) { key = null; }   // только удаление; запись — штатно
      if (key != null) { try { BIN.on(key); } catch (e) { } return Promise.resolve(undefined); }
    }
    return dbTx0.apply(this, arguments);
  };
  function guard(fn, put) { return async function () { const prev = BIN.on; BIN.on = put; try { return await fn.apply(this, arguments); } finally { BIN.on = prev; } }; }
  ulAdd = guard(ulAdd, k => { const o = ulGet() || S.room; if (o) { o.bin = o.bin || []; if (!o.bin.includes(k)) o.bin.push(k); } });   // room.bin — sessPurge v81 удаляет
  nAttach = guard(nAttach, k => { if (S.sess) { const b = S.sess.labBin = S.sess.labBin || []; if (!b.includes(k)) b.push(k); } });
  const purge0 = sessPurge; sessPurge = async function (o) {
    try {
      const L = [o]; if (o && o.kind === 'room') for (const sid of Object.values(o.segs || {})) { const w = await dbGet('sess', sid).catch(() => null); if (w) L.push(w); }
      for (const x of L) for (const k of (x && x.labBin) || []) await dbDel('img', k).catch(() => { });
    } catch (e) { }
    return purge0.apply(this, arguments);
  };
  api.binKeys = o => [...((o && o.labBin) || []), ...((o && o.bin) || []), ...((o && o.refs) || []).map(r => 'ref:' + r.id)];

  /* ═══ [BLOCK HJ-UNDO] ↶ ↷ по журналу ═══ */
  const here = e => e.t === 'N' ? (S.mode !== 'plan' && !!S.sess && S.sess.id === e.sid) : e.t === 'P' ? (S.mode === 'plan' && !!S.room && (S.room.id === e.rid || (S.objRooms || []).some(o => o.id === e.rid))) : false;
  function valid(e) {   // метка совпадает со штатным стеком активной поверхности
    if (e.t === 'N') return here(e) && S.und.length >= e.n && hOf(S.und[e.n - 1]) === e.h;
    if (e.t === 'P') return here(e) && S.pund.length >= e.n && hOf(S.pund[e.n - 1]) === e.h;
    return !!HANDLERS[e.t];
  }
  const curLen = () => S.mode === 'plan' ? S.pund.length : S.und.length;
  const canvasOn = () => { const sk = window.MeasureLabSketch; try { return !!(sk && sk.isOpen && sk.isOpen() && sk.activate); } catch (e) { return false; } };
  async function go(e) {   // перейти на поверхность метки — только на холсте
    if (here(e)) return true; if (!canvasOn()) return false;
    const sk = window.MeasureLabSketch, st = sk.state;
    try {
      if (st && Array.isArray(st.items)) {   // холст 82.17: области-элементы
        const it = e.t === 'N' ? st.items.find(i => i.t === 'wall' && i.sid === e.sid) : st.items.find(i => i.t === 'plan');
        if (!it) return false; await sk.activate(it);
      } else await sk.activate(e.t === 'N' ? {t: 'wall', sid: e.sid} : {t: 'plan', rid: e.rid});   // контракт 82.18 (§8.3)
    } catch (x) { return false; }
    return here(e);
  }
  api.go = go;
  async function step(dir) {
    sync(); const J = dir < 0 ? H.j : H.r, R = dir < 0 ? H.r : H.j, nat = dir < 0 ? zUndo0 : zRedo0;
    if (dir < 0) {   // ↶: на текущей поверхности есть шаги новее её последней метки — штатно (метки не трогаем)
      let mine = null; for (let i = J.length - 1; i >= 0; i--) if (here(J[i])) { mine = J[i]; break; }
      if (mine && valid(mine) && curLen() > mine.n) return nat();
      if (!mine && curLen() && !J.length) return nat();
    }
    for (let guardN = 0; guardN < 40 && J.length; guardN++) {
      const e = J[J.length - 1];
      if (HANDLERS[e.t]) { J.pop(); H.busy++; try { await HANDLERS[e.t][dir < 0 ? 'undo' : 'redo'](e); } finally { H.busy--; } R.push(e); persist(); return; }
      if (!here(e) && !(await go(e))) {
        if (!canvasOn()) {   // вне холста: чужая поверхность — штатно по текущей, её метка остаётся
          if (dir < 0 && curLen()) { const k = J.map(here).lastIndexOf(true); H.busy++; try { await nat(); } finally { H.busy--; } if (k >= 0) { const m = J.splice(k, 1)[0]; R.push(m); } persist(); return; }
          if (dir > 0) { const k = J.map(here).lastIndexOf(true); if (k >= 0) { const m = J.splice(k, 1)[0]; H.busy++; try { await nat(); } finally { H.busy--; } m.n = curLen(); m.h = hOf(m.t === 'P' ? S.pund[S.pund.length - 1] : S.und[S.und.length - 1]); R.push(m); persist(); return; } }
          return nat();
        }
        J.pop(); persist(); continue;   // поверхности нет — метка пропускается
      }
      if (dir < 0 && !valid(e)) { J.pop(); persist(); continue; }   // шаг слит / снят — молча дальше
      J.pop(); H.busy++; try { await nat(); } finally { H.busy--; }
      if (dir > 0) { e.n = curLen(); e.h = hOf(e.t === 'P' ? S.pund[S.pund.length - 1] : S.und[S.und.length - 1]); }
      R.push(e); persist(); return;
    }
    return nat();   // журнал пуст — штатно
  }
  const zUndo0 = zUndo, zRedo0 = zRedo;
  zUndo = function () { return step(-1); };
  zRedo = function () { return step(1); };
  api.undo = () => step(-1); api.redo = () => step(1);
  const bind = () => { const u = document.getElementById('bUnd'), r = document.getElementById('bRed'); if (u) u.onclick = () => zUndo(); if (r) r.onclick = () => zRedo(); };
  bind();
  const zLay0 = zLay; zLay = function () { const r = zLay0.apply(this, arguments);
    try { if (canvasOn()) { sync(); const u = document.getElementById('bUnd'), d = document.getElementById('bRed'); if (u && H.j.length) u.classList.remove('dis'); if (d && H.r.length) d.classList.remove('dis'); } } catch (e) { } return r; };
  if (typeof flushAll === 'function') { const fa0 = flushAll; flushAll = async function () { persistNow(); return fa0.apply(this, arguments); }; }   // Android onPause → PM.flushAll: см. ниже
  if (PM.flushAll) { const pf0 = PM.flushAll; PM.flushAll = function () { persistNow(); return pf0.apply(this, arguments); }; }
  addEventListener('pagehide', persistNow); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistNow(); });
  PM.labHistory = api;
})();
