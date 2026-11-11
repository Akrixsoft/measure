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

  /* ═══ [BLOCK HJ-RED] 82.18 fix (QA Д1): ↷ поверхности не теряется при переходе между поверхностями и после перезапуска.
     v81 держит S.red / S.pred только в памяти и обнуляет при openSess / openRoom. Стек ↷ (снимки, без ZA) пишется в запись поверхности
     (sess.labRed / room._labPred — с «_», чтобы не попасть в снимки cjStr) и возвращается при её открытии. Новое действие (snap / plSnap) обнуляет стек, как в v81. ═══ */
  const RED_LIM = 60, PRED_LIM = 60;   // r2 (QA Н2): как стеки ↶ в памяти v81 (S.und / S.pund — 60); раньше 40 / 20 — после перезапуска ↷ терял последние шаги
  const noZA = L => (L || []).filter(t => t && (typeof t !== 'string' || (!t.startsWith('ZA:') && !t.startsWith('PA:'))));   // план: снимки cjSnap — объекты
  const doSave0 = doSave; doSave = async function () { try { if (S.sess) S.sess.labRed = noZA(S.red).slice(-RED_LIM); } catch (e) { } return doSave0.apply(this, arguments); };
  // стек ↷ плана — в формате cjEnc v81 (строки снимков помещений один раз), без его обрезки до 30; читается cjDec
  const encPred = L => { const T = [], ix = new Map(), put = x => { let i = ix.get(x); if (i == null) { i = T.length; T.push(x); ix.set(x, i); } return i; }, E = [];
    for (const t of L) { if (t && t.cv) E.push({cv: 1, act: t.act, R: Object.fromEntries(Object.entries(t.R).map(([id, x]) => [id, put(x)]))}); else if (t && t.lg) E.push({lg: t.lg, s: t.s}); else if (typeof t === 'string' && S.room) E.push({lg: S.room.id, s: t}); }
    return {v: 81, S: T, E}; };
  const keepPred = () => { try { if (S.room) S.room._labPred = encPred(noZA(S.pred).slice(-PRED_LIM)); } catch (e) { } };
  const os0 = openSess; openSess = async function (id) { const r = await os0.apply(this, arguments); try { if (S.sess && S.sess.id === id && Array.isArray(S.sess.labRed) && !S.red.length) S.red = S.sess.labRed.slice(); } catch (e) { } return r; };
  const cjl0 = cjLoad; cjLoad = function (r) { const res = cjl0.apply(this, arguments); try { if (r && r._labPred && !S.pred.length) S.pred = Array.isArray(r._labPred) ? r._labPred.slice() : cjDec(r._labPred, r.id); } catch (e) { } return res; };

  /* ═══ [BLOCK HJ-PHOTO] фото — шаг-снимок (с refs), не ZA: переживает перезапуск ═══ */
  function dropZA(n0) { let k = 0; while (S.und.length > n0 && String(S.und[S.und.length - 1]).startsWith('ZA:')) { S.und.pop(); k++; } if (k) { const t = H.j[H.j.length - 1]; if (t && t.t === 'N' && t.n > S.und.length) { H.j.pop(); persist(); } } }
  const rfAdd0 = rfAdd; rfAdd = async function () {
    const n0 = (S.refs || []).length; let snapped = false;
    if (S.mosaic) { snap(); snapped = true; }
    const u0 = S.und.length; zaMute++; let res;
    try { res = await rfAdd0.apply(this, arguments); } finally { zaMute--; }
    dropZA(u0);   // шаги-замыкания модулей поверх (подложка холста) — уже в снимке
    if (snapped && (S.refs || []).length === n0) unsnap();   // фото не добавлено — шага нет
    try { zLay(); } catch (e) { }
    return res;
  };
  const rfDel0 = rfDel; rfDel = function (id) {
    const r = (S.refs || []).find(x => x.id === id); if (!r) return rfDel0.apply(this, arguments);
    if (S.wsh && S.wsh.gaRf === id && S.wsh.ga) r.labGa = {ga: S.wsh.ga, gr: S.wsh.gaRf};   // выравнивание по фото — вернётся вместе с фото
    snap(); const u0 = S.und.length; zaMute++; let res;
    try { res = rfDel0.apply(this, arguments); } finally { zaMute--; }
    dropZA(u0);
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

  /* ═══ [BLOCK HJ-CANVAS] операции холста (событие 'measure-lab-canvas-op' модуля холста): данные в журнале — ↶ ↷ и после перезапуска.
     move — перенос области; del — удаление области (вид стены — в «Удалённые»); wall — «▣ Стена по фото». Замыкание ZA холста снимается. ═══ */
  const SKh = () => window.MeasureLabSketch;
  async function boardRefs(fn) {   // фото подложки: живые (подложка активна) или запись в базе
    const sk = SKh(), K = sk && sk.state; if (!K || !K.board) return;
    if (S.sess && S.sess.id === K.board) { fn(S.refs || []); saveSess(); return; }
    const o = await dbGet('sess', K.board).catch(() => null); if (!o) return; fn(o.refs || []); await dbPut('sess', JSON.parse(JSON.stringify(o))).catch(() => { }); K.boardRec = o;
  }
  async function sessDel(sid, on, why) { if (!sid) return null; const o = await dbGet('sess', sid).catch(() => null); if (!o) return null; if (on) { o.del = Date.now(); o.delWhy = why; } else { delete o.del; delete o.delWhy; } await dbPut('sess', o).catch(() => { }); return o; }
  const itemsOf = () => { const sk = SKh(); return sk && sk.state && sk.state.items; };
  const fin = () => { const sk = SKh(); try { sk && sk.refreshDims && sk.refreshDims(); } catch (e) { } try { sk && sk.saveNow && sk.saveNow(); } catch (e) { } try { draw(); zLay(); } catch (e) { } };
  async function areaPut(it, on) {   // 82.18 fix (Д1): область стены — одна на sid (без дублей после ↶ ↷)
    const L = itemsOf(); if (!L) return; const same = x => x.id === it.id || (it.t === 'wall' && x.t === 'wall' && it.sid && x.sid === it.sid);
    if (on && !L.some(same)) L.push(JSON.parse(JSON.stringify(it)));
    if (!on) for (let i = L.length - 1; i >= 0; i--) if (same(L[i])) L.splice(i, 1);
  }
  async function leaveRoom(rid) {   // открыт план удаляемого помещения — на подложку
    const sk = SKh(); if (!rid || !sk || !(S.mode === 'plan' && S.room && S.room.id === rid)) return;
    try { await flushAll(); } catch (e) { } try { await sk.activate('board'); } catch (e) { }
  }
  async function roomsAgain() { const sk = SKh(); try { if (sk && sk.loadRooms) await sk.loadRooms(); } catch (e) { } }
  async function leave(sid, board) {   // поверхность, которую удаляет шаг, не должна оставаться открытой (иначе запись вернётся сохранением, а область — adopt)
    const sk = SKh(); if (!sid || !sk || !(S.mode !== 'plan' && S.sess && S.sess.id === sid)) return;
    try { await flushAll(); } catch (e) { }
    const st = sk.state, pl = !board && st && (st.items || []).find(i => i.t === 'plan');
    try { await sk.activate(pl ? pl : 'board'); } catch (e) { }
  }
  api.register('K', {
    undo: async e => { const it = (itemsOf() || []).find(x => x.id === e.id); if (it) Object.assign(it, e.a); fin(); },
    redo: async e => { const it = (itemsOf() || []).find(x => x.id === e.id); if (it) Object.assign(it, e.b); fin(); }
  });
  api.register('C', {
    undo: async e => {
      if (e.op === 'del') { await areaPut(e.a, true); const o = await sessDel(e.sid || e.a.sid, false); const ph = o && o.labSketch && o.labSketch.photo, w = e.a.wid || e.a.sid, ids = new Set([...(e.refs || []), ...(ph ? [ph] : [])]); if (ids.size) await boardRefs(R => { for (const r of R) if (ids.has(r.id)) r.labWall = w; }); }
      if (e.op === 'wall' && e.b.fresh) {   // 82.18 fix (Д1): новое помещение — целиком (помещение, стена, области; связь фото)
        await leaveRoom(e.b.room); await leave(e.b.sid, true); await areaPut(e.it || e.b, false); if (e.b.plan) await areaPut(e.b.plan, false);
        await sessDel(e.b.sid, true, 'холст: ↶ стена по фото'); await sessDel(e.b.room, true, 'холст: ↶ стена по фото');
        if (e.b.photo) await boardRefs(R => { const q = R.find(x => x.id === e.b.photo); if (q) delete q.labWall; });
        await roomsAgain(); fin(); return;
      }
      if (e.op === 'wall') { await leave(e.b.sid); await areaPut(e.it || e.b, false); await sessDel(e.b.sid, true, 'холст: ↶ стена по фото'); const r = await dbGet('sess', e.b.room).catch(() => null); if (r && r.segs) { for (const k of Object.keys(r.segs)) if (r.segs[k] === e.b.sid) delete r.segs[k]; await dbPut('sess', r).catch(() => { }); if (S.room && S.room.id === r.id) S.room.segs = r.segs; }
        if (e.b.photo) await boardRefs(R => { const q = R.find(x => x.id === e.b.photo); if (q) delete q.labWall; }); }
      fin();
    },
    redo: async e => {
      if (e.op === 'del') { await leave(e.sid || e.a.sid); await areaPut(e.a, false); await sessDel(e.sid || e.a.sid, true, 'холст: область удалена'); const o = await dbGet('sess', e.sid || e.a.sid).catch(() => null), ph = o && o.labSketch && o.labSketch.photo, ids = new Set([...(e.refs || []), ...(ph ? [ph] : [])]); if (ids.size) await boardRefs(R => { for (const r of R) if (ids.has(r.id)) delete r.labWall; }); }
      if (e.op === 'wall' && e.b.fresh) {
        await sessDel(e.b.room, false); await sessDel(e.b.sid, false); if (e.b.plan) await areaPut(e.b.plan, true); await areaPut(e.it || e.b, true);
        if (e.b.photo) await boardRefs(R => { const q = R.find(x => x.id === e.b.photo); if (q) q.labWall = e.b.wid || e.b.sid; });
        await roomsAgain(); fin(); return;
      }
      if (e.op === 'wall') { await areaPut(e.it || e.b, true); const o = await sessDel(e.b.sid, false); const r = await dbGet('sess', e.b.room).catch(() => null); if (r && o && o.seg != null) { r.segs = r.segs || {}; r.segs[o.seg] = e.b.sid; await dbPut('sess', r).catch(() => { }); if (S.room && S.room.id === r.id) S.room.segs = r.segs; }
        if (e.b.photo) await boardRefs(R => { const q = R.find(x => x.id === e.b.photo); if (q) q.labWall = e.b.wid || e.b.sid; }); }
      fin();
    }
  });
  addEventListener('measure-lab-canvas-op', ev => {
    const d = ev.detail || {}; if (H.busy) return;
    try {
      if (d.op === 'move' && d.id && d.a && d.b) return rec({t: 'K', id: d.id, a: d.a, b: d.b});
      if (d.op === 'del' && d.a) { const top = S.und[S.und.length - 1]; if (top && String(top).startsWith('ZA:')) { S.und.pop(); const t = H.j[H.j.length - 1]; if (t && t.t === 'N' && t.n > S.und.length) H.j.pop(); } const a = JSON.parse(JSON.stringify(d.a)); delete a.snap; return rec({t: 'C', op: 'del', a, sid: d.sid || null, refs: Array.isArray(d.refs) ? d.refs.slice() : undefined}); }
      if (d.op === 'wall' && d.b && d.b.id) { const it = (itemsOf() || []).find(x => x.id === d.b.id); const c = it ? JSON.parse(JSON.stringify(it)) : {id: d.b.id}; delete c.snap; return rec({t: 'C', op: 'wall', b: d.b, it: c}); }
    } catch (e) { console.error(e); }
  });

  /* ═══ [BLOCK HJ-UNDO] ↶ ↷ по журналу ═══ */
  const here = e => e.t === 'N' ? (S.mode !== 'plan' && !!S.sess && S.sess.id === e.sid) : e.t === 'P' ? (S.mode === 'plan' && !!S.room && (S.room.id === e.rid || (S.objRooms || []).some(o => o.id === e.rid))) : false;
  function valid(e) {   // метка совпадает со штатным стеком активной поверхности
    const at = (U, e) => { if (U.length >= e.n && hOf(U[e.n - 1]) === e.h) return true; if (U.length && hOf(U[U.length - 1]) === e.h) { e.n = U.length; return true; } return false; };   // 82.18 fix (Д1): стек сдвинут (обрезка 40/60) — по вершине
    if (e.t === 'N') return here(e) && at(S.und, e);
    if (e.t === 'P') return here(e) && at(S.pund, e);
    return !!HANDLERS[e.t];
  }
  const curLen = () => S.mode === 'plan' ? S.pund.length : S.und.length;
  const canvasOn = () => { const sk = window.MeasureLabSketch; try { return !!(sk && sk.isOpen && sk.isOpen() && sk.activate); } catch (e) { return false; } };
  async function go(e) {   // перейти на поверхность метки — только на холсте
    if (here(e)) return true; if (!canvasOn()) return false;
    const sk = window.MeasureLabSketch, st = sk.state;
    try {
      if (e.t === 'N' && st && st.board && e.sid === st.board) { await sk.activate('board'); return here(e); }   // 82.18 fix (Д1): метки подложки
      if (st && Array.isArray(st.items)) {   // холст 82.17: области-элементы
        const it = e.t === 'N' ? st.items.find(i => i.t === 'wall' && i.sid === e.sid) : st.items.find(i => i.t === 'plan');
        if (!it) return false; await sk.activate(it, {fit: 1});   // r4 (QA-4 М1): ↶ ↷ переходят на область — она вписывается в экран
      } else await sk.activate(e.t === 'N' ? {t: 'wall', sid: e.sid} : {t: 'plan', rid: e.rid});   // контракт 82.18 (§8.3)
    } catch (x) { return false; }
    return here(e);
  }
  api.go = go;
  async function step(dir) {
    sync(); const J = dir < 0 ? H.j : H.r, R = dir < 0 ? H.r : H.j, nat = dir < 0 ? zUndo0 : zRedo0;
    if (dir < 0) {   // ↶: на текущей поверхности есть шаги новее её последней метки — штатно (метки не трогаем)
      let mine = null, mi = -1; for (let i = J.length - 1; i >= 0; i--) if (here(J[i])) { mine = J[i]; mi = i; break; }
      // 82.18 fix (Д1): только если после метки этой поверхности в журнале нет шагов других поверхностей (иначе порядок журнала важнее)
      if (mine && mi === J.length - 1 && valid(mine) && curLen() > mine.n) return nat();
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
      if (dir > 0 && ((e.t === 'N' && !noZA(S.red).length && !S.red.length) || (e.t === 'P' && !S.pred.length))) { J.pop(); persist(); continue; }   // r2 (Н2): штатного ↷ нет — метка снимается (кнопка гаснет)
      J.pop(); H.busy++; try { await nat(); } finally { H.busy--; }
      if (dir > 0) { e.n = curLen(); e.h = hOf(e.t === 'P' ? S.pund[S.pund.length - 1] : S.und[S.und.length - 1]); }
      R.push(e); persist(); return;
    }
    return nat();   // журнал пуст — штатно
  }
  const zUndo0 = zUndo, zRedo0 = zRedo;
  const dims = () => { const sk = SKh(); try { if (sk && sk.refreshDims && sk.isOpen && sk.isOpen()) sk.refreshDims(); } catch (e) { } };   // QA Д11: L × H стен в заголовках
  zUndo = async function () { try { return await step(-1); } finally { keepPred(); dims(); } };
  zRedo = async function () { try { return await step(1); } finally { keepPred(); dims(); } };
  const pls1 = plSnap; plSnap = function () { const r = pls1.apply(this, arguments); keepPred(); return r; };
  api.undo = () => zUndo(); api.redo = () => zRedo();
  const bind = () => { const u = document.getElementById('bUnd'), r = document.getElementById('bRed'); if (u) u.onclick = () => zUndo(); if (r) r.onclick = () => zRedo(); };
  bind();
  const zLay0 = zLay; zLay = function () { const r = zLay0.apply(this, arguments);
    try { if (canvasOn()) { sync(); const u = document.getElementById('bUnd'), d = document.getElementById('bRed'); if (u && H.j.length) u.classList.remove('dis'); if (d && H.r.length) d.classList.remove('dis'); } } catch (e) { } return r; };
  if (typeof flushAll === 'function') { const fa0 = flushAll; flushAll = async function () { persistNow(); return fa0.apply(this, arguments); }; }   // Android onPause → PM.flushAll (= flushAll v81) — одна обёртка (аудит m9)
  addEventListener('pagehide', persistNow); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistNow(); });
  PM.labHistory = api;
})();
