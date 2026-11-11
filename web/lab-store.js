/* Measure 82.18 — проекты и данные (AKX-2026-0012, инженер A).
   Проект = объект v81 с постоянным ID (oid). Метаданные проектов, папки, раскладка холста и признак миграции —
   в своей базе IndexedDB «akrix-lab» v1 (stores prj, fld, cv, meta). Старая база холста «akrix-sketch» v1 НЕ открывается
   на запись и не повышается в версии: 82.17 на той же базе открывает свои данные (откат возможен).
   Замеры (помещения, стены, подложка холста kind:'board', отдельные плоскости) — штатные записи «akrix-zamer».
   ═══ [BLOCK ST-DB]    своя база: prj {id=oid, client, name, obj, folder, arch, del, created, upd, elHi, znHi, bin[], board}, fld, cv {pid,…}, meta
   ═══ [BLOCK ST-ZDB]   доступ к «akrix-zamer»: свежая запись → правка → запись одной транзакцией (без гонок с открытым холстом)
   ═══ [BLOCK ST-PRJ]   API проектов: создать, переименовать (labRenameObj), папка, архив, корзина, вернуть, удалить навсегда
   ═══ [BLOCK ST-BOARD] подложка холста — запись sess {kind:'board', room:'~board', labOid}
   ═══ [BLOCK ST-SYNC]  список проектов восстанавливается из «akrix-zamer» (группы по oid, затем по obj)
   ═══ [BLOCK ST-MIG]   однократная идемпотентная миграция mig82_18(): проекты, oid, подложка, холст 82.14–82.17 → cv + refs/txt подложки
   ═══ [BLOCK ST-NUM]   номера для конструктора: els[].no (P.elHi), labRooms[].zn (P.znHi) — по проекту, не переиспользуются
   ═══ [BLOCK ST-BAK]   резервная копия: блок lab:{prj, fld, cv}; старые копии без lab — проекты из записей замеров
   Контракт (architect.md §8.3): MeasureLabStore: projects(), get(pid), put(P), folders(), putFolder(f), cv(pid), putCv(cv), migrate(), renameObj(ov, nv)
   + znNext(room) — синхронный номер зоны по P.znHi (для lab-v012, AKX-2026-0010) */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabStore) return;
  const api = window.MeasureLabStore = {};
  const clone = o => JSON.parse(JSON.stringify(o));
  const now = () => Date.now();
  const rid = p => p + now().toString(36) + Math.random().toString(36).slice(2, 6);
  const NONAME = 'Без названия';
  const emit = (op, d) => { try { dispatchEvent(new CustomEvent('measure-lab-project', {detail: {op, ...d}})); } catch (e) { } };

  /* ═══ [BLOCK ST-DB] ═══ */
  const LDB = {db: null, p: null};
  function ldb() {
    if (LDB.db) return Promise.resolve(LDB.db);
    if (LDB.p) return LDB.p;
    return LDB.p = new Promise(res => { try { const r = indexedDB.open('akrix-lab', 1);
      r.onupgradeneeded = () => { const d = r.result;
        if (!d.objectStoreNames.contains('prj')) d.createObjectStore('prj', {keyPath: 'id'});
        if (!d.objectStoreNames.contains('fld')) d.createObjectStore('fld', {keyPath: 'id'});
        if (!d.objectStoreNames.contains('cv')) d.createObjectStore('cv', {keyPath: 'pid'});
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', {keyPath: 'k'}); };
      r.onsuccess = () => { LDB.db = r.result; res(LDB.db); }; r.onerror = () => { LDB.p = null; res(null); }; } catch (e) { res(null); } });
  }
  async function ltx(store, mode, fn) {
    const db = await ldb(); if (!db) return null;
    return new Promise((res, rej) => { const t = db.transaction(store, mode), q = fn(t.objectStore(store)); let out; if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  const lPut = (st, v) => ltx(st, 'readwrite', s => s.put(clone(v)));
  const lGet = (st, k) => ltx(st, 'readonly', s => s.get(k));
  const lAll = async st => (await ltx(st, 'readonly', s => s.getAll())) || [];
  const lDel = (st, k) => ltx(st, 'readwrite', s => s.delete(k));
  api.db = {open: ldb, put: lPut, get: lGet, all: lAll, del: lDel};

  /* ═══ [BLOCK ST-ZDB] ═══ */
  async function zdb() {   // база замеров v81 (DB.db) — ждём штатное открытие; нет — открываем сами
    for (let i = 0; i < 100 && !DB.db; i++) await new Promise(z => setTimeout(z, 30));
    if (!DB.db) { const d = await dbOpen(); if (d && !DB.db) DB.db = d; }
    return DB.db;
  }
  const zAll = async () => { await zdb(); return ((await dbAll('sess').catch(() => [])) || []); };
  const mem = () => [S.room, S.room0, S.sess, ...(S.objRooms || [])].filter(Boolean);   // записи, открытые сейчас в v81
  async function zEdit(id, fn) {   // свежая запись → fn(o) → запись; открытая в v81 копия правится той же функцией
    await zdb(); let res = null;
    await new Promise((ok, no) => { const t = DB.db.transaction('sess', 'readwrite'), s = t.objectStore('sess'), q = s.get(id);
      q.onsuccess = () => { const o = q.result; if (o && fn(o) !== false) { s.put(o); res = o; } }; t.oncomplete = ok; t.onerror = () => no(t.error); t.onabort = () => no(t.error); });
    for (const m of mem()) if (m.id === id) fn(m);
    return res;
  }
  api.zEdit = zEdit;
  async function zEditMany(ids, fn) {   // 82.18 fix (аудит m5): несколько записей — одной транзакцией sess (всё или ничего)
    await zdb(); const done = []; ids = [...new Set(ids)]; if (!ids.length) return done;
    await new Promise((ok, no) => { const t = DB.db.transaction('sess', 'readwrite'), s = t.objectStore('sess');
      for (const id of ids) { const q = s.get(id); q.onsuccess = () => { const o = q.result; if (o && fn(o) !== false) { s.put(o); done.push(id); } }; }
      t.oncomplete = ok; t.onerror = () => no(t.error); t.onabort = () => no(t.error); });
    for (const m of mem()) if (done.includes(m.id)) fn(m);
    return done;
  }

  /* ═══ [BLOCK ST-PRJ] ═══ */
  const objOf = (client, name) => { const c = String(client || '').trim(), n = String(name || '').trim(); return c && n ? c + ' — ' + n : c || n; };   // « — », не « · »: hdIn режет по последнему « · »
  api.objOf = objOf;
  const label = P => P ? [P.client, P.name].filter(Boolean).join(' · ') || NONAME : '';
  api.label = label;
  const CACHE = new Map();   // синхронная копия проектов (для znNext из lab-v012, вызывается без ожидания)
  const projects = async () => { const L = await lAll('prj'); CACHE.clear(); for (const P of L) CACHE.set(P.id, P); return L; };
  const get = async pid => { if (!pid) return null; const P = await lGet('prj', pid); if (P) CACHE.set(P.id, P); return P; };
  async function put(P) { if (!P || !P.id) throw new Error('проект без id'); CACHE.set(P.id, clone(P)); await lPut('prj', P); return P; }
  Object.assign(api, {projects, get, put});
  api.folders = () => lAll('fld');
  api.putFolder = async f => { f = {id: f.id || rid('f'), name: String(f.name || 'Папка').trim() || 'Папка', parent: f.parent || null, order: f.order || 0, created: f.created || now()}; await lPut('fld', f); return f; };
  api.delFolder = async id => { const L = (await projects()).filter(p => p.folder === id && !p.purged); if (L.length) return false; await lDel('fld', id); return true; };
  api.cv = pid => lGet('cv', pid);
  api.putCv = async c => { if (!c || !c.pid) throw new Error('cv без pid'); c.upd = now(); await lPut('cv', c); return c; };
  const cv0 = pid => ({pid, v: 3, view: {ox: 20, oy: 80, s: 0.4}, act: {t: 'board'}, items: [], hj: [], hjR: [], upd: now()});
  api.cv0 = cv0;

  async function uniq(client, name, skip) {   // obj — ключ объекта в v81 (objLoad группирует по obj): у разных проектов obj разный
    const L = await projects(), me = L.find(p => p.id === skip), used = new Set(L.filter(p => p.id !== skip).map(p => p.obj));
    for (const r of await zAll()) { if (!r.obj || r.kind === 'board') continue; const id = r.kind === 'room' ? r.oid : r.labOid; if (!(id ? id === skip : me && r.obj === me.obj)) used.add(r.obj); }
    let n = String(name || '').trim(), c = String(client || '').trim() || (n ? '' : NONAME), i = 2; const n0 = n, c0 = c;
    while (used.has(objOf(c, n))) { if (n0) n = n0 + ' (' + i + ')'; else c = c0 + ' (' + i + ')'; i++; }
    return {client: c, name: n, obj: objOf(c, n)};
  }
  async function create(o) {
    o = o || {}; await ldb(); const u = await uniq(o.client, o.name), t = now();
    const P = {id: o.id || rid('o'), client: u.client, name: u.name, obj: u.obj, folder: o.folder || null, arch: null, del: null, created: t, upd: t, elHi: 0, znHi: 0, bin: []};
    await put(P); await ensureBoard(P); if (!(await api.cv(P.id))) await api.putCv(cv0(P.id));
    emit('create', {pid: P.id}); return P;
  }
  api.create = create;
  async function renameObj(ov, nv) {   // labRenameObj: obj во всех записях объекта (помещения, стены, заготовки, подложка, плоскости); поле шапки не участвует
    if (ov === nv) return 0; let n = 0;
    for (const o of await zAll()) if ((o.obj || '') === ov) { await zEdit(o.id, x => { if ((x.obj || '') !== ov) return false; x.obj = nv; }); n++; }
    for (const m of mem()) if ((m.obj || '') === ov) m.obj = nv;
    try { title(); } catch (e) { }
    return n;
  }
  api.renameObj = renameObj;
  async function rename(pid, client, name) {
    const P = await get(pid); if (!P) return null; const u = await uniq(client, name, pid), ov = P.obj;
    Object.assign(P, {client: u.client, name: u.name, obj: u.obj, upd: now()}); await put(P);
    if (ov !== u.obj) await renameObj(ov, u.obj);
    emit('rename', {pid, ov, nv: u.obj}); return P;
  }
  api.rename = rename;
  api.move = async (pid, fid) => { const P = await get(pid); if (!P) return null; P.folder = fid || null; await put(P); emit('move', {pid}); return P; };
  api.archive = async (pid, on) => { const P = await get(pid); if (!P) return null; P.arch = on === false ? null : now(); await put(P); emit('archive', {pid}); return P; };
  api.touch = async pid => { const P = await get(pid); if (!P) return null; P.upd = now(); await put(P); return P; };

  // записи проекта в «akrix-zamer»: помещения (oid / obj), их стены и заготовки, подложка, отдельные плоскости
  function owns(P, all) {
    const rooms = all.filter(r => r.kind === 'room' && (r.oid ? r.oid === P.id : (r.obj || '') === P.obj && !r.pstub)), ids = new Set(rooms.map(r => r.id));
    for (const x of all) if (x.kind === 'room' && x.pstub && ids.has(x.pstub.r) && !ids.has(x.id)) { rooms.push(x); ids.add(x.id); }
    const walls = all.filter(o => o.kind !== 'room' && o.room && ids.has(o.room));
    const boards = all.filter(o => o.kind === 'board' && o.labOid === P.id);
    const planes = all.filter(o => o.kind !== 'room' && o.kind !== 'board' && !o.room && (o.labOid ? o.labOid === P.id : (o.obj || '') === P.obj));
    return {rooms, walls, boards, planes, all: [...rooms, ...walls, ...boards, ...planes]};
  }
  api.records = async pid => { const P = await get(pid); return P ? owns(P, await zAll()) : null; };
  /* 82.18 fix (аудит m5): сначала метка проекта (P.del + P.op — незавершённая операция), затем все записи одной транзакцией, затем P.op снимается.
     Процесс убит посередине — при старте (migrate → resumeOps) операция догоняется по P.op. */
  const trashRecs = (R, pid, t) => zEditMany(R.all.filter(o => !o.del).map(o => o.id), x => { if (x.del) return false; x.del = t; x.delP = pid; });
  const restoreRecs = (R, pid, d) => zEditMany(R.all.filter(o => o.delP === pid || (o.del && o.del === d)).map(o => o.id), x => { if (!(x.delP === pid || (x.del && x.del === d))) return false; delete x.del; delete x.delP; });
  async function trash(pid) {   // в корзину: P.del + штатный o.del у всех записей проекта (метка delP — что вернуть)
    const P = await get(pid); if (!P) return null; const t = now();
    P.del = t; P.op = {k: 'trash', t}; await put(P);
    const R = owns(P, await zAll()); await trashRecs(R, pid, t);
    delete P.op; await put(P);
    if ((S.room && R.all.some(o => o.id === S.room.id)) || (S.sess && R.all.some(o => o.id === S.sess.id))) { try { if (S.mode === 'plan') leavePlan(); clearAll(); } catch (e) { } }
    emit('trash', {pid}); return P;
  }
  async function restore(pid) {
    const P = await get(pid); if (!P) return null; const d = P.del;
    P.op = {k: 'restore', d}; P.del = null; await put(P);
    await restoreRecs(owns(P, await zAll()), pid, d);
    delete P.op; await put(P); emit('restore', {pid}); return P;
  }
  async function resumeOps() {   // незавершённые «В корзину» / «Вернуть» (процесс убит между меткой проекта и записями)
    for (const P of await projects()) {
      if (!P || !P.op) continue; const R = owns(P, await zAll());
      if (P.op.k === 'trash') await trashRecs(R, P.id, P.op.t); else if (P.op.k === 'restore') await restoreRecs(R, P.id, P.op.d);
      delete P.op; await put(P);
    }
  }
  api.resumeOps = resumeOps;
  async function imgKeys(R, P) {   // картинки проекта, которые штатный sessPurge не удаляет: фото-справки ref:*, P.bin
    const k = new Set(P.bin || []); for (const o of R.all) for (const r of o.refs || []) if (r && r.id) k.add('ref:' + r.id);
    return [...k];
  }
  async function purge(pid) {   // навсегда — только из корзины
    const P = await get(pid); if (!P) return null; if (!P.del) throw new Error('удалить навсегда можно только из корзины');
    const all = await zAll(), R = owns(P, all);
    for (const k of await imgKeys(R, P)) await dbDel('img', k).catch(() => { });
    for (const r of R.rooms.filter(r => !r.pstub)) await sessPurge(r).catch(() => { });
    for (const o of [...R.walls, ...R.boards, ...R.planes]) { const x = await dbGet('sess', o.id).catch(() => null); if (x) await sessPurge(x).catch(() => { }); }
    for (const r of R.rooms) await dbDel('sess', r.id).catch(() => { });
    await lDel('cv', pid); await lDel('prj', pid);
    try { if (localStorage.getItem('measure.lastPrj') === pid) localStorage.removeItem('measure.lastPrj'); } catch (e) { }
    emit('purge', {pid}); return true;
  }
  Object.assign(api, {trash, restore, purge});
  api.photoCount = async pid => { const R = await api.records(pid); if (!R) return 0; let n = 0; for (const o of R.all) n += (o.refs || []).length + (o.frames || []).length + (o.pool || []).length; return n; };

  // проект записи (помещения / стены / подложки / плоскости) и текущий проект открытого в v81
  async function byRecord(o, L) {
    if (!o) return null; L = L || await projects();
    const room = o.kind === 'room' ? o : o.room && o.room !== '~board' ? ((S.room0 && S.room0.id === o.room) ? S.room0 : await dbGet('sess', o.room).catch(() => null)) : null;
    const oid = (room && room.oid) || o.labOid; if (oid) { const P = L.find(p => p.id === oid); if (P) return P; }
    const ob = (room || o).obj || ''; return L.find(p => p.obj === ob && !p.purged) || null;
  }
  api.byRecord = byRecord;
  api.current = async () => { const L = await projects(); for (const o of [S.room, S.room0, S.sess, ...(S.objRooms || [])]) { const P = o && await byRecord(o, L); if (P) return P; } return null; };

  /* ═══ [BLOCK ST-BOARD] ═══ */
  async function ensureBoard(P) {
    const all = await zAll(); let b = all.find(o => o.kind === 'board' && o.labOid === P.id);
    if (!b && window.MeasureLabBoard && typeof MeasureLabBoard.record === 'function') { b = MeasureLabBoard.record(P.id, P.obj); await dbPut('sess', clone(b)); }   // форма записи — инженера B
    if (!b) { const t = now(); b = {id: rid('b'), kind: 'board', room: '~board', labOid: P.id, obj: P.obj, name: 'Холст', created: t, upd: t,
      q4: {L: 1, H: 1, ok: 1, blank: 1, board: 1}, frames: [], lines: {}, la: {}, man: {}, wsh: {}, els: [], notes: [], und: [], dms: [], drw: [], rts: [], polys: [], rulers: [], refs: []};
      await dbPut('sess', clone(b)); }
    if (P.board !== b.id) { P.board = b.id; await put(P); }
    return b;
  }
  api.ensureBoard = async pid => { const P = typeof pid === 'string' ? await get(pid) : pid; return P ? ensureBoard(P) : null; };

  /* ═══ [BLOCK ST-SYNC] ═══ */
  const PLAN_K = 0.12, WM = {x: 1300, b: 800, t: 300}, GAP = 160;   // как в lab-sketch (SK-CONST)
  const nW = (r, k) => { try { return wN(r, k); } catch (e) { return ((r.gn || {})[k]) || k + 1; } };
  const segN = m => { try { return plN(m); } catch (e) { return m && m.pts ? m.pts.length - (m.closed ? 0 : 1) : 0; } };
  function planBox(rooms) { const P = []; for (const r of rooms) if (r && r.ms && !r.pstub && !r.del) P.push(...(r.ms.pts || [])); if (!P.length) return [0, 0, 6000, 4000];
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]); return [Math.min(...xs) - 900, Math.min(...ys) - 900, Math.max(...xs) + 900, Math.max(...ys) + 900]; }
  function regionOf(it, rooms) {   // область в единицах холста (как lab-sketch region)
    if (it.t === 'wall') { const L = +it.L || 3000, H = +it.H || 2700; return {x: it.ax - WM.x * it.k, y: it.ay - (H + WM.t) * it.k, w: (L + 2 * WM.x) * it.k, h: (H + WM.t + WM.b) * it.k}; }
    if (it.t === 'plan') { const [x0, y0, x1, y1] = planBox(rooms); return {x: it.ax + x0 * it.k, y: it.ay - y1 * it.k, w: (x1 - x0) * it.k, h: (y1 - y0) * it.k}; }
    return null;
  }
  api.regionOf = regionOf;
  function wallItem(r, k, o, wid) {
    const L = +(o.q4 || {}).L || 3000, H = +(o.q4 || {}).H || 2700;
    return {id: 'w' + Math.random().toString(36).slice(2, 9), t: 'wall', room: r ? r.id : null, wid: wid || null, sid: o.id, ax: 0, ay: 0, k: 600 / L, L, H, name: r ? (r.name || 'Помещение') + ' · С' + nW(r, k) : (o.name || 'Плоскость')};
  }
  /* Д8 (QA 82.18, g3): фото и заметки подложки — препятствия раскладки: новые области ставятся рядом с ними, а не поверх
     (миграция 82.17: в скетче были только фото и заметка — область стены ложилась на фото) */
  const refBox = r => ({x: +r.x || 0, y: -(+r.y || 0), w: +r.w || 600, h: (+r.w || 600) * ((+r.ih || 1) / (+r.iw || 1))});
  const txtBox = q => ({x: q.a[0], y: -q.a[1] - 120, w: Math.max(240, String(q.tx || '').length * 60), h: 180});
  function obstacles(R) { const out = []; for (const b of (R && R.boards) || []) { if (b.del) continue; for (const r of b.refs || []) if (r && r.iw) out.push(refBox(r)); for (const q of b.drw || []) if (q && q.k === 'txt' && Array.isArray(q.a)) out.push(txtBox(q)); } return out; }
  function layout(c, R) {   // недостающие области: план слева, стены сеткой справа (решение 10.11: все стены проекта видны сразу)
    const rooms = R.rooms.filter(r => !r.pstub && !r.del), OB = obstacles(R);
    if (rooms.length && !c.items.some(i => i.t === 'plan')) { const [x0, , x1, y1] = planBox(rooms), B = bbox(c, rooms, OB);
      c.items.push({id: 'n' + Math.random().toString(36).slice(2, 9), t: 'plan', k: PLAN_K, ax: (B ? B.x0 - (x1 - x0) * PLAN_K - GAP : 0) - x0 * PLAN_K, ay: (B ? B.y0 : 0) + y1 * PLAN_K}); }
    const have = new Set(c.items.filter(i => i.t === 'wall').map(i => i.room ? i.room + '|' + i.wid : 's|' + i.sid)), add = [];
    for (const r of rooms) { const n = segN(r.ms); for (let k = 0; k < n; k++) { const sid = (r.segs || {})[k], o = sid && R.walls.find(w => w.id === sid && !w.del); if (!o) continue; const wid = (r.wid || {})[k]; if (have.has(r.id + '|' + wid)) continue; add.push(wallItem(r, k, o, wid)); } }
    for (const o of R.planes.filter(o => !o.del && o.q4)) if (!have.has('s|' + o.id)) add.push(wallItem(null, 0, o, null));
    if (!add.length) return c;
    const B = bbox(c, rooms, OB), x0 = B ? B.x1 + GAP : 0, y0 = B ? B.y0 : 0, COLS = 3; let x = x0, y = y0, rowH = 0, col = 0;
    for (const it of add) { const w = (it.L + 2 * WM.x) * it.k, h = (it.H + WM.t + WM.b) * it.k;
      if (col === COLS) { col = 0; x = x0; y += rowH + GAP + 60; rowH = 0; }
      it.ax = x + WM.x * it.k; it.ay = y + 60 + (it.H + WM.t) * it.k; x += w + GAP; rowH = Math.max(rowH, h); col++; c.items.push(it); }
    return c;
  }
  function bbox(c, rooms, extra) { const R = c.items.map(i => regionOf(i, rooms)).filter(Boolean).concat(extra || []); if (!R.length) return null; return {x0: Math.min(...R.map(r => r.x)), y0: Math.min(...R.map(r => r.y)), x1: Math.max(...R.map(r => r.x + r.w)), y1: Math.max(...R.map(r => r.y + r.h))}; }
  api.layout = async pid => { const P = await get(pid); if (!P) return null; const c = (await api.cv(pid)) || cv0(pid); layout(c, owns(P, await zAll())); await api.putCv(c); return c; };

  async function sync(opt) {   // записи без проекта → проекты (группы по oid, затем по obj); oid — во все помещения, labOid — в плоскости
    opt = opt || {}; await ldb(); const all = await zAll(), L = await projects(), byId = new Map(L.map(p => [p.id, p])), byObj = new Map(L.filter(p => !p.purged).map(p => [p.obj, p])), G = new Map();
    const grp = (key, obj) => { let g = G.get(key); if (!g) G.set(key, g = {key, oid: key.startsWith('o:') ? key.slice(2) : null, obj, rooms: [], planes: [], boards: []}); return g; };
    const rooms = all.filter(r => r.kind === 'room' && !r.pstub), objOid = new Map();
    for (const r of rooms) if (r.oid && !objOid.has(r.obj || '')) objOid.set(r.obj || '', r.oid);
    for (const r of rooms) { if (r.oid && byId.has(r.oid)) continue; if (!r.oid && byObj.has(r.obj || '')) continue;
      const oid = r.oid || objOid.get(r.obj || ''); grp(oid ? 'o:' + oid : 'b:' + (r.obj || ''), r.obj || '').rooms.push(r); }
    for (const o of all.filter(o => o.kind === 'board')) if (o.labOid && !byId.has(o.labOid)) grp('o:' + o.labOid, o.obj || '').boards.push(o);
    for (const o of all.filter(o => o.kind !== 'room' && o.kind !== 'board' && !o.room && !o.pstub)) { if (o.labOid ? byId.has(o.labOid) : byObj.has(o.obj || '')) continue;
      const g = o.labOid ? grp('o:' + o.labOid, o.obj || '') : [...G.values()].find(g => g.obj === (o.obj || '')) || grp('b:' + (o.obj || ''), o.obj || ''); g.planes.push(o); }
    const made = [];
    for (const g of G.values()) {
      const pid = g.oid || rid('o'), recs = [...g.rooms, ...g.planes, ...g.boards], walls = all.filter(w => w.room && g.rooms.some(r => r.id === w.room)), every = [...recs, ...walls];
      for (const r of g.rooms) if (r.oid !== pid) await zEdit(r.id, x => { x.oid = pid; });
      for (const x of all.filter(x => x.pstub && g.rooms.some(r => r.id === x.pstub.r))) if (x.oid !== pid) await zEdit(x.id, y => { y.oid = pid; });
      for (const o of g.planes) if (o.labOid !== pid) await zEdit(o.id, x => { x.labOid = pid; });
      const ts = every.map(o => o.created || o.upd || 0).filter(Boolean), us = every.map(o => o.upd || o.created || 0).filter(Boolean), dl = recs.filter(o => !o.pstub).map(o => o.del || 0);
      const obj = g.obj, P = {id: pid, client: obj || NONAME, name: '', obj, folder: null, arch: null, del: dl.length && dl.every(Boolean) ? Math.max(...dl) : null,
        created: ts.length ? Math.min(...ts) : now(), upd: us.length ? Math.max(...us) : now(), elHi: 0, znHi: 0, bin: [], from: opt.mig ? 'mig82.18' : 'sync'};
      await put(P); byId.set(pid, P); byObj.set(obj, P); made.push(P);
    }
    for (const P of made) { await ensureBoard(P); if (!(await api.cv(P.id)) && !opt.mig) await api.layout(P.id); }
    if (made.length) emit('sync', {pids: made.map(p => p.id)});
    return made;
  }
  api.sync = sync;

  /* ═══ [BLOCK ST-MIG] ═══ */
  function oldSketch() {   // «akrix-sketch» v1 — только чтение; не создаём и не повышаем версию (откат на 82.17)
    return new Promise(res => { let made = false; try { const r = indexedDB.open('akrix-sketch');
      r.onupgradeneeded = () => { made = true; try { r.transaction.abort(); } catch (e) { } };
      r.onsuccess = () => { const d = r.result; if (made || !d.objectStoreNames.contains('sk')) { d.close(); return res(null); } res(d); };
      r.onerror = () => res(null); r.onblocked = () => res(null); } catch (e) { res(null); } });
  }
  const sReq = (d, st, fn) => new Promise(res => { try { const t = d.transaction(st, 'readonly'), q = fn(t.objectStore(st)); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } });
  const txtC = () => { try { return kC('txt'); } catch (e) { return '#1A2027'; } };
  // холст 82.14 (v1) и 82.15–82.17 (v2) → cv.items (области на (room, wid)) + фото как refs подложки + заметки как drw txt подложки
  async function convertSk(P, sk, sdb) {
    const all = await zAll(), R = owns(P, all), c = (await api.cv(P.id)) || cv0(P.id), board = await ensureBoard(P), b = (await dbGet('sess', board.id)) || board;
    b.refs = b.refs || []; b.drw = b.drw || [];
    const wallOf = {}, items = sk.v === 2 ? sk.items || [] : [...(sk.photos || []).map(p => ({...p, t: 'photo'})), ...(sk.notes || []).map(n => ({...n, t: 'note'}))];
    for (const it of items) {
      if (it.t === 'wall' || it.t === 'plan') { if (c.items.some(i => i.id === it.id)) continue;
        if (it.t === 'plan') { c.items.push({id: it.id, t: 'plan', ax: it.ax, ay: it.ay, k: it.k || PLAN_K, ...(it.snap ? {snap: it.snap} : {})}); continue; }
        const o = all.find(x => x.id === it.sid); if (!o) continue; const r = o.room ? all.find(x => x.id === o.room) : null;
        let wid = null; if (r) { if (!r.wid || r.wid[o.seg] == null) { try { wIdFix(r); await zEdit(r.id, x => { x.wid = r.wid; x.widHi = r.widHi; }); } catch (e) { } } wid = (r.wid || {})[o.seg] || null; }
        c.items.push({id: it.id, t: 'wall', room: r ? r.id : null, wid, sid: o.id, ax: it.ax, ay: it.ay, k: it.k, L: it.L, H: it.H, name: it.name, ...(it.snap ? {snap: it.snap} : {})}); wallOf[it.id] = wid || o.id; continue; }
    }
    for (const it of items) {
      if (it.t === 'photo') { if (b.refs.some(r => r.id === it.id)) continue;
        const blob = sdb ? await sReq(sdb, 'img', s => s.get(it.id)) : null; if (blob) await dbPut('img', blob, 'ref:' + it.id).catch(() => { });
        const cor = Array.isArray(it.cor) && it.cor.length === 4 ? it.cor : null, n = Math.max(0, ...b.refs.map(r => r.n || 0)) + 1;
        let lw = it.wall && sk.v === 2 ? wallOf[it.wall] : null;
        if (sk.v !== 2 && it.wall && it.wall.sid) { const o = all.find(x => x.id === it.wall.sid), r = o && o.room ? all.find(x => x.id === o.room) : null; lw = r ? (r.wid || {})[o.seg] || o.id : o ? o.id : null; }
        b.refs.push({id: it.id, n, iw: it.iw, ih: it.ih, x: +it.x || 0, y: -(+it.y || 0), w: +it.w || 600, q: cor ? [cor[3], cor[2], cor[1], cor[0]].map(p => [+p[0], +p[1]]) : null, found: [], t: now(), name: '', ...(lw ? {labWall: lw} : {})}); continue; }
      if (it.t === 'note') { const id = 'd' + String(it.id || '').replace(/[^\w]/g, '') + 'm'; if (b.drw.some(q => q.id === id)) continue; b.drw.push({id, k: 'txt', c: txtC(), a: [+it.x || 0, -(+it.y || 0)], tx: it.tx || ''}); }
    }
    if (sk.view && !c.migView) { c.view = sk.view; c.migView = 1; }
    b.upd = now(); await dbPut('sess', clone(b)); await api.putCv(layout(c, owns(P, await zAll())));
    return c;
  }
  api.convertSk = convertSk;
  async function canvasFrom(P, sk, sdb) {   // перенос холста — по контракту инженера B (MeasureLabSketch.migrateCanvas → запись cv); без модуля B — свой convertSk
    const B = window.MeasureLabSketch;
    if (B && typeof B.migrateCanvas === 'function') { const rec = await B.migrateCanvas(P.id, sk); if (rec && !(await api.cv(P.id))) await api.putCv({...cv0(P.id), ...rec, pid: P.id, ...(rec.view ? {} : {view: cv0(P.id).view})});
      if (sk.v !== 2) await v1Links(P, sk); return; }
    await convertSk(P, sk, sdb);
  }
  async function v1Links(P, sk) {   // 82.14: фото со стеной {wall:{sid}} → ref.labWall = wid (перенос B связь v1 не переносит)
    const all = await zAll(), b = all.find(o => o.kind === 'board' && o.labOid === P.id); if (!b) return; let ch = 0;
    for (const ph of sk.photos || []) { const sid = ph.wall && ph.wall.sid, o = sid && all.find(x => x.id === sid); if (!o) continue;
      const r = o.room ? all.find(x => x.id === o.room) : null, lw = r ? (r.wid || {})[o.seg] || o.id : o.id;
      for (const ref of b.refs || []) if ((ref.labFrom === ph.id || ref.id === ph.id) && !ref.labWall) { ref.labWall = lw; ch++; } }
    if (ch) await zEdit(b.id, x => { x.refs = b.refs; });
  }
  /* Д8: области 82.18 шире областей 82.17 (поля размеров вокруг стены) — фото, легшее на область, сдвигается вниз в свободное место
     вместе с рисунками и размерами, целиком лежащими на нём (как перенос фото на подложке) */
  async function refsFree(P) {
    const all = await zAll(), R = owns(P, all), rooms = R.rooms.filter(r => !r.pstub && !r.del), c = await api.cv(P.id), b = R.boards.find(x => !x.del); if (!c || !b || !(b.refs || []).length) return 0;
    const ov = (a, q) => a.x < q.x + q.w && q.x < a.x + a.w && a.y < q.y + q.h && q.y < a.y + a.h, REG = c.items.map(i => regionOf(i, rooms)).filter(Boolean); let n = 0;
    for (const r of b.refs) {
      const B0 = refBox(r), B = {...B0}, others = () => b.refs.filter(x => x !== r).map(refBox);
      const hit = () => REG.some(q => ov(B, q)) || others().some(q => ov(B, q)); if (!REG.some(q => ov(B, q))) continue;
      for (let i = 0; i < 200 && hit(); i++) B.y += Math.max(60, B.h * .25);
      const dy = B.y - B0.y; if (!dy) continue; r.y = -(B.y); n++;
      const inside = p => Array.isArray(p) && p.length === 2 && p[0] >= B0.x && p[0] <= B0.x + B0.w && -p[1] >= B0.y && -p[1] <= B0.y + B0.h, mv = p => [p[0], p[1] - dy];
      for (const k of ['dms', 'drw']) for (const q of b[k] || []) { const pts = [q.a, q.b, ...(q.pts || [])].filter(Boolean); if (pts.length && pts.every(inside)) { if (q.a) q.a = mv(q.a); if (q.b) q.b = mv(q.b); if (q.pts) q.pts = q.pts.map(mv); } }
    }
    if (n) await zEdit(b.id, x => { x.refs = b.refs; x.dms = b.dms || x.dms; x.drw = b.drw || x.drw; });
    return n;
  }
  api.refsFree = async pid => { const P = await get(pid); return P ? refsFree(P) : 0; };
  let migP = null;
  async function mig82_18() {
    await ldb(); const m = await lGet('meta', 'mig'); if (m && m.v === '82.18') { await sync(); return {done: false, at: m.at}; }
    const made = await sync({mig: true}), L = await projects(), sdb = await oldSketch();
    const all0 = sdb ? ((await sReq(sdb, 'sk', s => s.getAll())) || []) : [];
    const tmp = all0.filter(x => String(x.obj || '').startsWith('~cv:')), sks = all0.filter(x => !String(x.obj || '').startsWith('~cv:'));
    for (const t of tmp) { const pid = t.obj.slice(4); if (t.cv && L.some(p => p.id === pid) && !(await api.cv(pid))) await api.putCv({...t.cv, pid}); }   // раскладка холста B без Store ('~cv:'+pid) — в cv
    for (const P of L) {
      if (await api.cv(P.id)) continue;   // повторный запуск: холст уже есть
      const sk = sks.find(x => x.obj === P.obj);
      if (sk) await canvasFrom(P, sk, sdb);
      await api.layout(P.id);   // нет холста — авто; есть — недостающие стены проекта добавляются
      if (sk) await refsFree(P);
    }
    for (const sk of sks) if (sk.obj && !L.some(p => p.obj === sk.obj) && ((sk.items || []).length || (sk.photos || []).length || (sk.notes || []).length)) {   // холст без замеров — свой проект
      const P = await create({client: sk.obj}); await lDel('cv', P.id); await canvasFrom(P, sk, sdb); if (!(await api.cv(P.id))) await api.layout(P.id); }
    if (sdb) sdb.close();
    for (const P of await projects()) await number(P.id);
    const at = now(); await lPut('meta', {k: 'mig', v: '82.18', at, n: made.length});
    emit('migrate', {n: made.length}); return {done: true, at, n: made.length};
  }
  api.migrate = () => migP || (migP = mig82_18().then(async r => { try { await resumeOps(); } catch (e) { console.error('Measure 82.18 resumeOps', e); } return r; }).catch(e => { console.error('Measure 82.18 migration', e); migP = null; return {error: String(e && e.message || e)}; }));
  api.ready = () => api.migrate();

  /* ═══ [BLOCK ST-NUM] ═══ */
  async function number(pid) {   // постоянные id и номера элементов стен (no) и зон (zn) по проекту
    // открытая в v81 запись правится в памяти и пишется штатно (saveRoom / saveSess) или целиком; закрытая — в базе
    const P = await get(pid); if (!P) return null; const R = owns(P, await zAll()), live = id => mem().find(m => m.id === id);
    const elsOf = (o, m) => m && m === S.sess ? S.els : (m || o).els || [];
    let el = +P.elHi || 0, zn = +P.znHi || 0, ch = 0;
    for (const r of R.rooms) { const ms = (live(r.id) || r).ms || {}; zn = Math.max(zn, +ms.labZnHi || 0); for (const q of ms.labRooms || []) if (+q.zn > zn) zn = +q.zn; }
    for (const o of [...R.walls, ...R.planes]) for (const e of elsOf(o, live(o.id))) if (+e.no > el) el = +e.no;
    const keep = async (o, m) => { if (m === S.room) { try { saveRoom(); } catch (e) { } } else if (m && m === S.sess) { try { saveSess(); } catch (e) { } } else await dbPut('sess', clone(m || o)).catch(() => { }); ch++; };
    const rooms = R.rooms.filter(r => !r.pstub).sort((a, b) => (a.created || 0) - (b.created || 0));
    for (const r of rooms) { const m = live(r.id), x = m || r, Z = (x.ms || {}).labRooms || []; if (!Z.some(q => !q.id || !(q.zn > 0))) continue;
      for (const q of Z) { if (!q.id) q.id = 'z' + now().toString(36) + Math.random().toString(36).slice(2, 6); if (!(q.zn > 0)) q.zn = ++zn; }
      await keep(r, m); }
    const order = [];
    for (const r of rooms) { const ks = [...Array(segN(r.ms)).keys()].sort((a, b) => nW(r, a) - nW(r, b)); for (const k of ks) { const sid = (r.segs || {})[k], o = sid && R.walls.find(w => w.id === sid); if (o) order.push(o); } }
    for (const o of [...R.walls, ...R.planes]) if (!order.includes(o)) order.push(o);
    for (const o of order) { const m = live(o.id), els = elsOf(o, m); if (!els.some(e => !e.id || !(e.no > 0))) continue;
      for (const e of els) { if (!e.id) e.id = 'e' + now().toString(36) + Math.random().toString(36).slice(2, 6); if (!(e.no > 0)) e.no = ++el; }
      const x = m || o, out = x.out && Array.isArray(x.out.els) ? x.out.els : null;   // снимок выгрузки (out) закрытой стены: id — тем же элементам (n = индекс + 1)
      if (out && m !== S.sess) { const L = els.filter(e => !e.cand); out.forEach((q, i) => { if (q && !q.id && L[i] && q.n === i + 1) q.id = L[i].id; }); }
      await keep(o, m); }
    if (el !== +P.elHi || zn !== +P.znHi) { const Q = await get(pid); Q.elHi = Math.max(+Q.elHi || 0, el); Q.znHi = Math.max(+Q.znHi || 0, zn); await put(Q); }
    return {elHi: el, znHi: zn, changed: ch};
  }
  api.number = number;

  // номер следующей зоны проекта (AKX-2026-0010/0012 §7): счётчик P.znHi, уникален по проекту, не переиспользуется.
  // Синхронно (lab-v012 вызывает при создании зоны); запись в базу — следом. Проект не найден — 0 (lab-v012 берёт свой счётчик).
  api.znNext = owner => {
    const L = [...CACHE.values()], ob = owner && owner.obj || '';
    const P = (owner && owner.oid && CACHE.get(owner.oid)) || (owner && !owner.oid && L.find(p => p.obj === ob && !p.del)); if (!P) return 0;
    const ms = owner.ms || {}, z = Math.max(+P.znHi || 0, +ms.labZnHi || 0, ...(ms.labRooms || []).map(q => +q.zn || 0)) + 1;
    P.znHi = z; put(P).catch(() => { }); return z;
  };

  /* ═══ [BLOCK ST-BAK] ═══ */
  const bak81 = zBackup, res81 = zRestore;
  zBackup = async function (dl) {
    const o = await bak81(false); if (!o) return o;
    o.lab = {v: 1, prj: await projects(), fld: await api.folders(), cv: await lAll('cv')};
    if (dl === false) return o;
    const txt = JSON.stringify(o), fn = 'zamer_kopiya_' + o.date.slice(0, 10) + '.json'; toast(`Копия: замеров ${o.sess.length}, проектов ${o.lab.prj.length}, картинок ${Object.keys(o.img || {}).length}`);
    if (appSave(fn, txt)) return; const file = new File([txt], fn, {type: 'application/json'});
    try { if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: fn}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = fn; document.body.appendChild(a); a.click(); a.remove();
  };
  zRestore = async function (o) {
    if (o && o.app === 'akrix-zamer-backup' && o.lab) {   // сначала проекты — затем штатное восстановление (оно показывает список)
      for (const P of o.lab.prj || []) { const cur = await get(P.id); if (!cur || (cur.upd || 0) <= (P.upd || 0)) await put(P); }
      for (const f of o.lab.fld || []) if (!(await lGet('fld', f.id))) await lPut('fld', f);
      for (const c of o.lab.cv || []) { const cur = await api.cv(c.pid); if (!cur || (cur.upd || 0) <= (c.upd || 0)) await lPut('cv', c); }
    }
    const res = await res81.apply(this, arguments);
    try { await sync(); } catch (e) { }
    try { if (window.MeasureLabProjects && MeasureLabProjects.isOpen()) MeasureLabProjects.refresh(); } catch (e) { }
    return res;
  };
  PM.zBackup = (...a) => zBackup(...a); PM.zRestore = o => zRestore(o);

  /* ═══ [BLOCK ST-IMP] AKX-2026-0012 Д9 (QA 82.18): импорт своей выгрузки «для Akrix» (♻ → zRestore → zImpExp) — в проект и на холст.
     v81 открывал помещение на старом экране, а проект собирался синхронизацией с client = obj («Сидоровы — Кухня-гостиная»), name пусто.
     Здесь: obj файла разбирается обратно на клиент / проект (objOf: « — »); по oid файла — существующий проект обновляется после
     подтверждения (прежние помещения и виды стен — в «Удалённые» штатным del, раскладка стен холста перестраивается), иначе / «Новым» —
     новый проект; штатный импорт v81 (и обёртки lab-prd, lab-export, lab-floor-routes) получает obj и oid проекта; затем — холст проекта. ═══ */
  const splitObj = s => { s = String(s || '').trim(); const i = s.indexOf(' — '); return i > 0 ? {client: s.slice(0, i).trim(), name: s.slice(i + 3).trim()} : {client: s, name: ''}; };
  api.splitObj = splitObj;
  async function askUpdate(P) {
    const t = 'Проект «' + label(P) + '» уже есть', x = 'Файл — выгрузка этого же проекта. Обновить проект из файла (прежние помещения и стены уйдут в «Удалённые») или загрузить отдельным проектом?';
    const LP = window.MeasureLabProjects;
    if (LP && typeof LP.ask === 'function') return LP.ask(t, x, [{t: 'Отмена', v: null}, {t: 'Новым проектом', v: 'new'}, {t: 'Обновить', v: 'upd', pr: 1}]);
    return confirm(t + '. Обновить?') ? 'upd' : 'new';
  }
  const imp81 = zImpExp;
  zImpExp = async function (o) {
    const RS = o && o.app === 'akrix-zamer' ? (o.kind === 'object' ? o.rooms || [] : o.kind === 'room' ? [o] : []).filter(R => R && R.ms && Array.isArray(R.ms.pts) && R.ms.pts.length >= 2) : [];
    const SK = window.MeasureLabSketch, LP = window.MeasureLabProjects;
    const ui8218 = !!((SK && SK.isOpen && SK.isOpen()) || (LP && LP.isOpen && LP.isOpen()));   // штатный экран v81 без холста и списка (?nolist) — прежний импорт
    if (!RS.length || !ui8218) return imp81.apply(this, arguments);
    await ldb();
    const objF = o.obj || RS[0].obj || '';
    let P = o.oid ? await get(o.oid) : null; if (P && P.purged) P = null;
    let how = 'new';
    if (P) { how = await askUpdate(P); if (!how) { toast('Импорт отменён'); return 0; } }
    try { await flushAll(); } catch (e) { }
    if (SK && SK.isOpen && SK.isOpen()) { try { await SK.saveNow(); } catch (e) { } }
    if (how === 'upd') {
      const t = now(), R = owns(P, await zAll());
      for (const x of [...R.rooms, ...R.walls]) if (!x.del) await zEdit(x.id, y => { if (y.del) return false; y.del = t; y.delWhy = 'импорт: заменено выгрузкой'; });
      if (P.del) { P.del = null; }
      P.upd = t; await put(P);
      const c = (await api.cv(P.id)) || cv0(P.id); c.items = (c.items || []).filter(i => !(i.t === 'wall' && i.room)); await api.putCv(c);   // области стен — заново по новым записям
    } else {
      const sp = splitObj(objF);
      P = await create({id: o.oid && !(await get(o.oid)) ? o.oid : undefined, client: sp.client, name: sp.name});
    }
    const o2 = {...o, obj: P.obj, oid: P.id, rooms: o.kind === 'object' ? (o.rooms || []).map(R => ({...R, obj: P.obj})) : o.rooms};
    if (o.kind === 'room') o2.obj = P.obj;
    const n = await imp81.call(this, o2);
    if (!n) { if (how !== 'upd') { try { await lDel('prj', P.id); await lDel('cv', P.id); } catch (e) { } } return n; }
    try { await flushAll(); } catch (e) { }
    try { const zn = Math.max(0, ...RS.flatMap(R => (R.ms.labRooms || []).map(q => +q.zn || 0))); const P2 = await get(P.id); if (P2 && zn > (+P2.znHi || 0)) { P2.znHi = zn; await put(P2); } } catch (e) { }
    await api.layout(P.id);
    emit(how === 'upd' ? 'import-update' : 'import', {pid: P.id});
    try { localStorage.setItem('measure.lastPrj', P.id); } catch (e) { }
    if (SK && typeof SK.open === 'function') {
      if (SK.isOpen() && SK.pid() === P.id && SK.state) SK.state.pid = '';   // тот же проект открыт — перечитать раскладку (без записи старой поверх)
      if (window.MeasureLabProjects && MeasureLabProjects.open) await MeasureLabProjects.open(P.id); else await SK.open(P.id);
    }
    toast((how === 'upd' ? 'Проект обновлён: ' : 'Импорт: ') + label(P) + ' · помещений ' + n);
    return n;
  };
  PM.zImpExp = (...a) => zImpExp(...a);
  api.backup = () => zBackup(false);
  ldb().then(() => projects()).catch(() => { });   // кэш проектов — сразу (znNext)
})();
