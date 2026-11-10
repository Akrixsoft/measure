/* Measure 82.14 — режим «Скетч»: холст объекта, фото → углы стены → вид сверху → чертёж стены → настоящая стена.
   Основа — подтверждённый прототип v7 (Akrixsoft/measure, measure-lab, prototypes/sketch/sketch.src.html).
   Работает поверх неизменной v81 (классический скрипт после inline): S, PM, W3, PEN, KD, KINDS, dbPut, newRoom, openRoom, openWall … */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabSketch) return;
  const api = window.MeasureLabSketch = {};

  /* ═══ [BLOCK SK-CONST] виды, настройки Lab 0.12 ═══ */
  const KINDS_O = {rig: ['Ригель', '#8A5A2B'], kor: ['Короб', '#5B6B7A'], kol: ['Колонна', '#6B7785'], nis: ['Ниша', '#8A4026'], okn: ['Проём', '#2E9E4F']};
  const O2V = {rig: 'rig', kor: 'kor', kol: 'kol', nis: 'nis', okn: 'pro'};                     // вид объекта → вид элемента стены v81
  const PTK = {}; for (const k of KINDS) if (k.pt && !k.hide) PTK[k.k] = [k.n[0].toUpperCase() + k.n.slice(1), k.c];
  const POSTS = {roz: 1, vyk: 1}, STEP = 71;                                                      // посты — шаг 71 (как PST81)
  const cfg = () => (window.MeasureLabSettings && MeasureLabSettings.current) || {textPx: 13, fieldPx: 22, linePx: 2.2, arrowPx: 9, pointPx: 5, grid: true, snap: true};
  const aa = () => Math.max(0.3, Math.min(1.6, Number(W3.f) || 1));                               // Aa = W3.f
  const fs = sz => Math.max(6, sz * cfg().textPx / 13 * aa());                                    // текст ≥ 6 px
  const fh = () => Math.max(10, cfg().fieldPx * aa(), fs(13) + 2);                                // поле ≥ 10 px
  const lw = b => Math.max(0.5, b * cfg().linePx / 2.2 * aa());                                   // толщина
  const ahl = () => Math.max(4, Math.min(70, cfg().arrowPx * aa()));                              // наконечник
  const pr = () => Math.max(3, cfg().pointPx * 1.8 * aa());                                       // точка
  const snapOn = () => cfg().snap !== false;
  api.metrics = () => ({text: fs(13), textMin: fs(1), field: fh(), line: lw(2), arrow: ahl(), point: pr(), aa: aa()});

  /* ═══ [BLOCK SK-STATE] модель ═══
     photo: {id, x, y, w (мир), iw, ih, cor: [[ix,iy]×4 ЛВ ПВ ПН ЛН] | null, L?, H?, els: [...], plan, wall?: {r, k, sid}}
     els: {id, t:'dim'|'obj'|'pt'|'txt', sp:'img'|'mm', a, b, v, k, n, D, tx, man, bind, L0, H0}
     notes: [{id, x, y, tx}] — заметки на холсте объекта (мир) */
  const K = api.state = {open: false, obj: '', photos: [], notes: [], view: {ox: 20, oy: 110, s: 0.42}, tool: 'pan', kind: 'rig', ptk: 'roz', posts: 1, sel: null, und: [], imgs: {}, pend: null, drag: null, plHl: null, pen: false};
  const uid = () => Math.random().toString(36).slice(2, 9);
  const DPR = () => devicePixelRatio || 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1 = v => Math.round(v * 10) / 10;
  const clone = o => JSON.parse(JSON.stringify(o, (k, v) => k[0] === '_' ? undefined : v));   // без служебных _кэшей отрисовки
  const strip = p => ({id: p.id, x: p.x, y: p.y, w: p.w, iw: p.iw, ih: p.ih, cor: p.cor, L: p.L, H: p.H, els: p.els, plan: p.plan, wall: p.wall});
  const say = t => { try { toast(t); } catch (e) { } };

  /* ═══ [BLOCK SK-DB] своя база IndexedDB (akrix-sketch): холст объекта и фото; база замеров v81 не меняется ═══ */
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
  const sDel = (st, k) => stx(st, 'readwrite', s => s.delete(k));
  api.db = {open: sdbOpen, put: sPut, get: sGet, all: sAll, del: sDel};
  let saveT = 0;
  function rec() { return {obj: K.obj, v: 1, photos: K.photos.map(strip), notes: K.notes, view: K.view, upd: Date.now()}; }
  function save() { clearTimeout(saveT); saveT = setTimeout(() => saveNowSk(), 300); }
  async function saveNowSk() { clearTimeout(saveT); if (!K.obj) return; try { await sPut('sk', clone(rec())); } catch (e) { } }
  api.saveNow = saveNowSk;
  function snap() { K.und.push(JSON.stringify({ph: K.photos.map(strip), notes: K.notes}, (k, v) => k[0] === '_' ? undefined : v)); if (K.und.length > 60) K.und.shift(); }

  /* ═══ [BLOCK SK-GEOM] гомография фото → плоскость стены ═══ */
  function solve(A, b) { const n = b.length; for (let i = 0; i < n; i++) { let m = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r; [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]]; for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } } const x = Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; } return x; }
  function homog(src, dst) { const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); } return [...solve(A, b), 1]; }
  const hap = (H, [x, y]) => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };
  const UNIT = [[0, 0], [1, 0], [1, 1], [0, 1]];
  function geo(p) { if (!p.cor) return null; const k = JSON.stringify(p.cor); if (p._gk !== k) { p._g = {f: homog(p.cor, UNIT), r: homog(UNIT, p.cor)}; p._gk = k; } return p._g; }
  function aspect(p) { const c = p.cor, d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]); return (d(c[0], c[1]) + d(c[3], c[2])) / (d(c[0], c[3]) + d(c[1], c[2])); }
  api.geom = {homog, hap};

  /* ═══ [BLOCK SK-PLAN] вид сверху: ломаная стена и/или колонны ═══
     plan: {pts: [[x, z]] (мм: x вдоль стены, z — в помещение), len: {i: мм}, cols: [{id, x, z, w, d, wx, dx, ox}]} */
  const isH = (a, b) => Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
  function planNorm(pl) { if (!pl) return null; pl.pts = pl.pts || []; pl.len = pl.len || {}; pl.cols = pl.cols || []; return pl; }
  const planSegs = pl => pl.pts.slice(1).map((b, i) => [pl.pts[i], b]);
  const colPts = c => [[c.x, c.z], [c.x + c.w, c.z], [c.x + c.w, c.z + c.d], [c.x, c.z + c.d]];
  function planExt(pl) { const xs = [...pl.pts.map(q => q[0]), ...pl.cols.flatMap(c => [c.x, c.x + c.w])]; return xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 0]; }
  function wallExt(pl) { const xs = pl.pts.map(q => q[0]); return xs.length > 1 ? [Math.min(...xs), Math.max(...xs)] : planExt(pl); }
  function planHas(pl) { return !!pl && (pl.pts.length > 1 || pl.cols.length > 0); }
  function setSegLen(pl, i, v) {   // длина участка i: конец сдвигается по направлению участка, следующие — следом
    const a = pl.pts[i], b = pl.pts[i + 1], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d); if (!l || !(v > 0)) { delete pl.len[i]; return; }
    const nb = [a[0] + d[0] / l * v, a[1] + d[1] / l * v], dv = [nb[0] - b[0], nb[1] - b[1]];
    for (let j = i + 1; j < pl.pts.length; j++) pl.pts[j] = [r1(pl.pts[j][0] + dv[0]), r1(pl.pts[j][1] + dv[1])];
    for (const c of pl.cols) if (c.x >= Math.min(a[0], b[0]) + Math.abs(d[0]) - 1) { c.x += dv[0]; c.z += dv[1]; }
    pl.len[i] = v; }
  function snapBox(P, segs, tol) {   // грань — к параллельному участку стены, у прямого угла — две грани (как колонны плана 0.13)
    const fit = (pts, skipU) => { let best = null;
      pts.map((a, i) => [a, pts[(i + 1) % 4]]).forEach(([a, b]) => { const el = Math.hypot(b[0] - a[0], b[1] - a[1]); if (el < 1) return; const eu = [(b[0] - a[0]) / el, (b[1] - a[1]) / el];
        for (const [p, q] of segs) { const sl = Math.hypot(q[0] - p[0], q[1] - p[1]); if (sl < 1) continue; const u = [(q[0] - p[0]) / sl, (q[1] - p[1]) / sl], n = [-u[1], u[0]];
          if (Math.abs(Math.abs(eu[0] * u[0] + eu[1] * u[1]) - 1) > .002) continue; if (skipU && Math.abs(u[0] * skipU[0] + u[1] * skipU[1]) > .05) continue;
          const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], gap = (m[0] - p[0]) * n[0] + (m[1] - p[1]) * n[1]; if (Math.abs(gap) >= tol) continue;
          const t0 = (a[0] - p[0]) * u[0] + (a[1] - p[1]) * u[1], t1 = (b[0] - p[0]) * u[0] + (b[1] - p[1]) * u[1]; if (Math.max(t0, t1) < -tol || Math.min(t0, t1) > sl + tol) continue;
          if (!best || Math.abs(gap) < Math.abs(best.gap)) best = {gap, n, u, seg: [p, q]}; } }); return best; };
    const sh = (pts, v) => pts.map(x => [x[0] + v[0], x[1] + v[1]]);
    const f1 = fit(P); if (!f1) return {pts: P, hl: []}; let pts = sh(P, [-f1.n[0] * f1.gap, -f1.n[1] * f1.gap]); const hl = [f1.seg];
    const f2 = fit(pts, f1.u); if (f2) { pts = sh(pts, [-f2.n[0] * f2.gap, -f2.n[1] * f2.gap]); hl.push(f2.seg); }
    return {pts, hl}; }
  function snapCol(pl, c, tol) { if (!snapOn()) return [];
    const s = snapBox(colPts(c), planSegs(pl), tol); if (s.hl.length) { c.x = Math.min(...s.pts.map(q => q[0])); c.z = Math.min(...s.pts.map(q => q[1])); }
    for (const v of pl.pts) { if (Math.abs(c.x - v[0]) < tol) { c.x = v[0]; s.hl.push([[v[0], v[1]], [v[0], v[1] + c.d]]); break; } if (Math.abs(c.x + c.w - v[0]) < tol) { c.x = v[0] - c.w; s.hl.push([[v[0], v[1]], [v[0], v[1] + c.d]]); break; } }   // край колонны — к концу/излому стены
    return s.hl; }
  api.plan = {setSegLen, snapBox, snapCol, planNorm};

  /* ═══ [BLOCK SK-BUILD] построение чертежа стены ═══
     Размер от края до края — длина/высота точно; остальные привязываются к ближайшему краю (стена, излом вида сверху, объект)
     и задают положение и габариты; привязка запоминается. Объект, поставленный руками на чертеже, размеры не двигают — конфликт «≠». */
  function build(p) {
    const g = geo(p); if (!g) return null;
    let L = +p.L || 0, H = +p.H || 0, sl = 0, wl = 0, sh = 0, wh = 0, Lx = 0, Hx = 0;
    const ed = u => u < 0.06 || u > 0.94;
    for (const e of p.els) if (e.t === 'dim' && e.v > 0 && e.sp !== 'mm') { const a = hap(g.f, e.a), b = hap(g.f, e.b), du = Math.abs(b[0] - a[0]), dv = Math.abs(b[1] - a[1]);
      if (du > dv && du > 0.05) { const w = du ** 3; sl += e.v / du * w; wl += w; if (du > 0.88 && ed(a[0]) && ed(b[0])) Lx = e.v; }
      else if (dv > 0.05) { const w = dv ** 3; sh += e.v / dv * w; wh += w; if (dv > 0.88 && ed(a[1]) && ed(b[1])) Hx = e.v; } }
    const L0 = p._m && p._m.L, H0 = p._m && p._m.H;   // размер на чертеже от края до края — тоже длина/высота
    for (const e of p.els) if (e.t === 'dim' && e.v > 0 && e.sp === 'mm' && L0) { const dx = Math.abs(e.b[0] - e.a[0]), dy = Math.abs(e.b[1] - e.a[1]);
      if (dx > dy && dx > .94 * L0 && Math.min(e.a[0], e.b[0]) < .03 * L0) Lx = e.v; if (dy > dx && dy > .94 * H0 && Math.min(e.a[1], e.b[1]) < .03 * H0) Hx = e.v; }
    const pl = planNorm(p.plan), hasPl = planHas(pl), pe = hasPl ? planExt(pl) : [0, 0], Lp = pe[1] - pe[0], plh = hasPl ? Lp : 0;
    if (!L) L = Lx || plh || (wl ? sl / wl : 0); if (!H) H = Hx || (wh ? sh / wh : 0);
    const asp = aspect(p); if (!L && H) L = H * asp; if (!H && L) H = L / asp; if (!L && !H) { H = 2700; L = H * asp; }   // без размеров — условно, по пропорции фото
    const exact = {L: !!(p.L || Lx || (hasPl && pl.pts.length > 1 && planSegs(pl).every((_, i) => +pl.len[i] > 0))), H: !!(p.H || Hx)};
    const mm = u => [u[0] * L, (1 - u[1]) * H];
    const P2 = (e, q) => e.sp === 'mm' ? [q[0] * L / (e.L0 || L), q[1] * H / (e.H0 || H)] : mm(hap(g.f, q));
    const objs = [];
    for (const e of p.els) {
      if (e.t === 'obj') { const Q = e.sp === 'mm' ? [P2(e, e.a), P2(e, e.b)] : [e.a, [e.b[0], e.a[1]], e.b, [e.a[0], e.b[1]]].map(q => P2(e, q)), xs = Q.map(q => q[0]), ys = Q.map(q => q[1]);
        const o = {id: e.id, k: e.k, D: e.D, man: e.man, mm: e.sp === 'mm', x0: clamp(Math.min(...xs), 0, L), x1: clamp(Math.max(...xs), 0, L), y0: clamp(Math.min(...ys), 0, H), y1: clamp(Math.max(...ys), 0, H), sn: []};
        if (!o.man) { if (o.x0 < .03 * L) { o.x0 = 0; o.sn.push('x0'); } if (o.x1 > .97 * L) { o.x1 = L; o.sn.push('x1'); } if (o.y0 < .03 * H) { o.y0 = 0; o.sn.push('y0'); } if (o.y1 > .97 * H) { o.y1 = H; o.sn.push('y1'); } } else o.sn.push('x0', 'x1', 'y0', 'y1'); objs.push(o); }
      if (e.t === 'pt') { const q = P2(e, e.a); objs.push({id: e.id, k: e.k, pt: 1, man: e.man, n: e.n || 1, x0: q[0], x1: q[0], y0: q[1], y1: q[1]}); }
    }
    const pfe = [], kpl = hasPl && Lp > 0 ? L / Lp : 1, px2 = X => (X - pe[0]) * kpl;   // изломы и колонны вида сверху — закреплённые признаки по x
    if (hasPl) { [...new Set(pl.pts.map(q => Math.round(q[0] * 10) / 10))].forEach(X => pfe.push({id: 'pv' + Math.round(X), only: 'x', pt: 1, x0: px2(X), x1: px2(X), y0: 0, y1: 0}));
      for (const c of pl.cols) pfe.push({id: 'pc' + c.id, only: 'x', x0: px2(c.x), x1: px2(c.x + c.w), y0: 0, y1: H, col: c}); }
    const all = [...objs, ...pfe];
    const pX = pfe.flatMap(f => f.pt ? [f.x0] : [f.x0, f.x1]);
    for (const o of objs) if (!o.pt && !o.man) for (const k of ['x0', 'x1']) { const v = pX.find(x => Math.abs(x - o[k]) < .015 * L); if (v != null) { o[k] = v; o.sn.push(k); } }
    const keyOf = f => f.o ? f.o.id + ':' + f.s : 'W:' + f.s;
    // новый размер привязывается к тому, что видно на чертеже: положения из предыдущего построения (уже решённые размерами)
    const shown = {}; if (p._m && p._m.objs && Math.abs(p._m.L - L) < .5 && Math.abs(p._m.H - H) < .5) for (const o of p._m.objs) shown[o.id] = o;
    const feats = (ax, cr) => { const F = [{o: null, s: 0, v: 0}, {o: null, s: 1, v: ax === 'x' ? L : H}], ct = .05 * (ax === 'x' ? H : L);
      for (const o of all) { const q = shown[o.id] || o; if (o.only && o.only !== ax) continue; if (cr != null && !o.only && !o.pt && (ax === 'x' ? (cr < q.y0 - ct || cr > q.y1 + ct) : (cr < q.x0 - ct || cr > q.x1 + ct))) continue; if (o.pt) F.push({o, s: 'c', v: ax === 'x' ? q.x0 : q.y0}); else { F.push({o, s: 0, v: ax === 'x' ? q.x0 : q.y0}); F.push({o, s: 1, v: ax === 'x' ? q.x1 : q.y1}); } } return F; };
    const pair = (ax, a, b, cr, tight) => { const tol = (tight ? .025 : .07) * (ax === 'x' ? L : H), F = feats(ax, cr), w = f => f.o ? 1 : .5;
      const ca = F.map(f => ({f, d: Math.abs(f.v - a) * w(f)})).filter(x => x.d < tol), cb = F.map(f => ({f, d: Math.abs(f.v - b) * w(f)})).filter(x => x.d < tol);
      let best = null; for (const x of ca) for (const y of cb) { if (x.f === y.f || (x.f.o === y.f.o && x.f.s === y.f.s)) continue; const sc = (x.d + y.d) * (x.f.o && x.f.o === y.f.o ? .6 : 1); if (!best || sc < best.sc) best = {sc, fa: x.f, fb: y.f}; }
      return best || {fa: (ca.sort((p, q) => p.d - q.d)[0] || {}).f || null, fb: null}; };
    const val = (ax, f) => f.o ? (f.s === 'c' ? (ax === 'x' ? f.o.x0 : f.o.y0) : (ax === 'x' ? (f.s ? f.o.x1 : f.o.x0) : (f.s ? f.o.y1 : f.o.y0))) : (f.s ? (ax === 'x' ? L : H) : 0);
    const dims = [];
    for (const e of p.els) if (e.t === 'dim') { const A = P2(e, e.a), B = P2(e, e.b), ax = Math.abs(B[0] - A[0]) >= Math.abs(B[1] - A[1]) ? 'x' : 'y', i = ax === 'x' ? 0 : 1, tight = e.sp === 'mm';
      let fa = null, fb = null; if (e.bind && e.bind.ax === ax) { const F = feats(ax); fa = F.find(f => keyOf(f) === e.bind.a) || null; fb = F.find(f => keyOf(f) === e.bind.b) || null; }   // привязка запоминается: держится, пока оба края существуют (сдвиг самого размера — сброс)
      if (!fa || !fb) { ({fa, fb} = pair(ax, A[i], B[i], ax === 'x' ? (A[1] + B[1]) / 2 : (A[0] + B[0]) / 2, tight)); if (fa && fb) e.bind = {ax, a: keyOf(fa), b: keyOf(fb)}; }
      dims.push({e, ax, A, B, fa, fb, est: Math.abs(B[i] - A[i])}); }
    const pos = {x: new Set(['W:0', 'W:1']), y: new Set(['W:0', 'W:1'])}, wlk = new Set();
    for (const f of pfe) { if (f.pt) pos.x.add(f.id + ':c'); else { pos.x.add(f.id + ':0'); pos.x.add(f.id + ':1'); } }
    for (const o of objs) { for (const k of o.sn || []) pos[k[0]].add(o.id + ':' + k[1]); if (o.pt && o.man) { pos.x.add(o.id + ':c'); pos.y.add(o.id + ':c'); } }
    const KK = ax => ax === 'x' ? ['x0', 'x1'] : ['y0', 'y1'];
    const setPos = (ax, f, v) => { const o = f.o, [k0, k1] = KK(ax), P = pos[ax];
      if (o.pt) { o[k0] = o[k1] = v; P.add(keyOf(f)); return; }
      const me = f.s ? k1 : k0, oth = o.id + ':' + (f.s ? 0 : 1);
      if (wlk.has(o.id + ax) || !P.has(oth)) { const dv = v - o[me]; o[k0] += dv; o[k1] += dv; } else o[me] = v;
      P.add(keyOf(f)); if (wlk.has(o.id + ax)) P.add(oth); };
    const valid = dims.filter(d => d.e.v > 0 && d.fa && d.fb && (d.fa.o || d.fb.o));
    for (const d of valid) if (d.fa.o && d.fa.o === d.fb.o && !d.fa.o.pt) { const o = d.fa.o, [k0, k1] = KK(d.ax); if (o.col) { if (o.col.wx) continue; o.col.w = d.e.v / kpl; } if (o.man) continue;
      if (pos[d.ax].has(o.id + ':1') && !pos[d.ax].has(o.id + ':0')) o[k0] = o[k1] - d.e.v; else o[k1] = o[k0] + d.e.v; wlk.add(o.id + d.ax); }
    const offs = valid.filter(d => !(d.fa.o && d.fa.o === d.fb.o)), done = new Set();
    for (let pass = 0; pass < 6; pass++) for (const d of offs) { if (done.has(d)) continue;
      const P = pos[d.ax], ka = keyOf(d.fa), kb = keyOf(d.fb); let base, mov;
      if (P.has(ka) && !P.has(kb)) { base = d.fa; mov = d.fb; } else if (P.has(kb) && !P.has(ka)) { base = d.fb; mov = d.fa; }
      else if (pass === 5 && !P.has(ka) && !P.has(kb)) { base = d.fa.o ? d.fa : d.fb; mov = base === d.fa ? d.fb : d.fa; } else continue;
      if (!mov.o || mov.o.man) continue; const bv = val(d.ax, base), dir = Math.sign(val(d.ax, mov) - bv) || 1; setPos(d.ax, mov, bv + dir * d.e.v); done.add(d); }
    for (const d of dims) { if (!(d.e.v > 0)) { d.st = 'nov'; continue; } if (!d.fa || !d.fb) { d.st = 'free'; continue; }
      const got = Math.abs(val(d.ax, d.fb) - val(d.ax, d.fa)); d.res = got; d.st = Math.abs(got - d.e.v) <= 2 ? 'ok' : 'bad'; d.va = val(d.ax, d.fa); d.vb = val(d.ax, d.fb); }
    const plan = hasPl ? {pl, mn: pe[0], k: kpl, Lp} : null;
    return {g, L, H, exact, objs, dims, plan};
  }
  api.build = build;

  /* ═══ [BLOCK SK-LAYOUT] фото → под ним чертёж стены → под ним вид сверху, по одной оси x ═══ */
  const photoH = p => p.w * p.ih / p.iw;
  function elev(p) { const m = p._m; if (!m || !m.L) return null; const w = p.w, h = w * m.H / m.L; return {x: p.x, y: p.y + photoH(p) + 80, w, h, k: w / m.L}; }
  function planBox(p) { const E = elev(p); if (!E) return null; const m = p._m, pk = m.plan ? m.plan.k : 1, o = m.plan ? m.plan.mn : 0; return {x: E.x, y: E.y + E.h + 70, w: E.w, h: Math.max(200, E.w * .4), k: E.k * pk, o}; }
  const imgToW = (p, q) => [p.x + q[0] * p.w / p.iw, p.y + q[1] * p.w / p.iw];
  const wToImg = (p, q) => [(q[0] - p.x) * p.iw / p.w, (q[1] - p.y) * p.iw / p.w];
  const mmToW = (E, q) => [E.x + q[0] * E.k, E.y + E.h - q[1] * E.k];
  const wToMm = (E, q) => [(q[0] - E.x) / E.k, (E.y + E.h - q[1]) / E.k];
  const plToW = (B, q) => [B.x + (q[0] - B.o) * B.k, B.y + 24 + q[1] * B.k];
  const wToPl = (B, q) => [(q[0] - B.x) / B.k + B.o, (q[1] - B.y - 24) / B.k];
  const toScr = q => [(q[0] * K.view.s + K.view.ox) * DPR(), (q[1] * K.view.s + K.view.oy) * DPR()];
  const toW = (sx, sy) => [(sx - K.view.ox) / K.view.s, (sy - K.view.oy) / K.view.s];
  const emm = (p, e, q) => { const m = p._m; return [q[0] * m.L / (e.L0 || m.L), q[1] * m.H / (e.H0 || m.H)]; };
  const emmInv = (p, e, q) => { const m = p._m; return [q[0] * (e.L0 || m.L) / m.L, q[1] * (e.H0 || m.H) / m.H]; };
  api.layout = {elev, planBox, imgToW, mmToW, plToW, toScr};

  /* ═══ [BLOCK SK-DOM] экран режима поверх приложения ═══ */
  const root = document.createElement('div'); root.id = 'labSketch'; root.hidden = true;
  root.innerHTML = `<canvas id="skCv"></canvas>
<div class="sk-top"><button data-sk="close" title="Закрыть скетч">✕</button><b>Скетч</b><span class="sk-obj" data-sk="obj" title="Объект"></span><span class="sp"></span><button data-sk="cam" title="Фото с камеры">📷</button><button data-sk="gal" title="Фото из галереи">🖼</button><button data-sk="exp" title="Перенос: сохранить JSON">⇪</button><button data-sk="imp" title="Перенос: загрузить JSON">⇩</button></div>
<div class="sk-hint"></div><div class="sk-kinds"></div>
<div class="sk-bar"><button data-t="pan" class="on" title="Выбор и перемещение">✋</button><button data-t="cor" title="4 угла стены на фото">⌗ Углы</button><button data-t="dim" title="Размер">↔ Размер</button><button data-t="obj" title="Объект: ригель, короб, колонна, ниша, проём">▭ Объект</button><button data-t="pt" title="Точка коммуникации">◉ Точка</button><button data-t="plan" title="Вид сверху: ломаная стена">⌐ Ломаная</button><button data-t="pcol" title="Вид сверху: колонна">▯ Колонна</button><button data-t="txt" title="Заметка">Т</button><span class="sep"></span><button data-sk="undo" title="Отменить">↶</button><button data-sk="del" title="Удалить выбранное">🗑</button></div>
<div class="sk-panel"></div><div class="sk-dlg"><div class="bx"></div></div>
<input type="file" accept="image/*" capture="environment" data-skf="cam" hidden><input type="file" accept="image/*" multiple data-skf="gal" hidden><input type="file" accept=".json,application/json" data-skf="imp" hidden>`;
  document.body.appendChild(root);
  const $s = sel => root.querySelector(sel);
  const scv = $s('#skCv'), sc = scv.getContext('2d');

  /* ═══ [BLOCK SK-DRAW] отрисовка (настройки Lab 0.12: толщины, текст 6+, поля 10+, наконечники, точки, Aa) ═══ */
  function img(p) { return K.imgs[p.id] || null; }
  function grid(px) {
    if (cfg().grid === false) return; const W = scv.width / DPR(), H = scv.height / DPR(), a = toW(0, 0), b = toW(W, H); let st = 100; while (st * K.view.s < 18) st *= 5;
    sc.strokeStyle = 'rgba(26,32,39,.07)'; sc.lineWidth = px; sc.beginPath();
    for (let x = Math.floor(a[0] / st) * st; x < b[0]; x += st) { sc.moveTo(x, a[1]); sc.lineTo(x, b[1]); }
    for (let y = Math.floor(a[1] / st) * st; y < b[1]; y += st) { sc.moveTo(a[0], y); sc.lineTo(b[0], y); } sc.stroke();
  }
  function draw() {
    if (!K.open) return;
    const d = DPR(); scv.width = innerWidth * d; scv.height = innerHeight * d; sc.setTransform(1, 0, 0, 1, 0, 0); sc.fillStyle = '#E9ECF0'; sc.fillRect(0, 0, scv.width, scv.height);
    const s = K.view.s * d; sc.setTransform(s, 0, 0, s, K.view.ox * d, K.view.oy * d); const px = 1 / K.view.s;
    grid(px);
    for (const p of K.photos) {
      const im = img(p); if (!p.iw) continue; p._m = build(p); const m = p._m;
      if (im) sc.drawImage(im, p.x, p.y, p.w, photoH(p)); else { sc.fillStyle = '#CDD2D9'; sc.fillRect(p.x, p.y, p.w, photoH(p)); }
      if (K.sel && K.sel.p === p.id && K.sel.photo) { sc.strokeStyle = '#1F6FD1'; sc.lineWidth = lw(3) * px; sc.strokeRect(p.x, p.y, p.w, photoH(p)); }
      if (p.wall) label([p.x + 6 * px, p.y + photoH(p) - 8 * px], '✓ стена создана', '#2E9E4F', px, 12);
      const pend = K.pend && K.pend.p === p.id ? K.pend.pts : null;
      if (p.cor && !pend) { const P = p.cor.map(q => imgToW(p, q)); sc.strokeStyle = '#F6B400'; sc.lineWidth = lw(2.5) * px; sc.setLineDash([8 * px, 5 * px]); sc.beginPath(); P.forEach((q, i) => i ? sc.lineTo(...q) : sc.moveTo(...q)); sc.closePath(); sc.stroke(); sc.setLineDash([]); P.forEach((q, i) => dot(q, '#F6B400', pr() * px, ['ЛВ', 'ПВ', 'ПН', 'ЛН'][i], px)); }
      if (pend) pend.forEach((q, i) => dot(imgToW(p, q), '#F6B400', pr() * px, ['ЛВ', 'ПВ', 'ПН', 'ЛН'][i], px));
      for (const e of p.els) if (e.sp !== 'mm') drawEl(p, e, q => imgToW(p, q), px);
      const E = elev(p);
      if (E) { drawElev(p, m, E, px); drawPlan(p, m, planBox(p), px); }
    }
    for (const n of K.notes) { const sel = K.sel && K.sel.n === n.id; n._lab = [n.x, n.y]; label([n.x, n.y], n.tx || 'заметка', sel ? '#1F6FD1' : '#1A2027', px, 15); }
    if (!K.photos.length) label(toW(16, innerHeight / 2), 'Добавьте фото стены: 📷 камера или 🖼 галерея', '#3E4954', px, 15);
    if (K.drag && K.drag.prev) K.drag.prev(px);
    const n = K.pend ? K.pend.pts.length : 0; $s('.sk-hint').textContent = K.tool === 'cor' && K.pend ? `Угол ${n + 1} из 4: ${['левый-верх', 'правый-верх', 'правый-низ', 'левый-низ'][n]}` : HINT[K.tool] || '';
  }
  api.draw = draw;
  function drawElev(p, m, E, px) {
    p._zlab = [];
    sc.fillStyle = '#fff'; sc.fillRect(E.x, E.y, E.w, E.h);
    if (m.plan) { const {pl, mn, k} = m.plan, X = x => (x - mn) * k, zs = pl.pts.map(q => q[1]), zb = zs.length ? Math.min(...zs) : 0;
      const band = (x0, x1, a, t) => { const A = mmToW(E, [x0, m.H]), B = mmToW(E, [x1, 0]); sc.fillStyle = `rgba(107,119,133,${a})`; sc.fillRect(A[0], A[1], B[0] - A[0], B[1] - A[1]); label([A[0] + 4 * px, A[1] + 18 * px], t, '#3E4954', px, 12); };
      for (const [a, b] of planSegs(pl)) if (isH(a, b) && Math.abs(a[1] - zb) > .5) band(X(Math.min(a[0], b[0])), X(Math.max(a[0], b[0])), .2, 'Z ' + Math.round(a[1] - zb));
      for (const c of pl.cols) band(X(c.x), X(c.x + c.w), .42, 'Колонна Z ' + Math.round(c.z + c.d - zb));
      sc.strokeStyle = '#3E4954'; sc.lineWidth = lw(2) * px;
      for (const x of [...new Set([...pl.pts.map(q => X(q[0])), ...pl.cols.flatMap(c => [X(c.x), X(c.x + c.w)])].map(v => Math.round(v)))]) { if (x <= .5 || x >= m.L - .5) continue; const A = mmToW(E, [x, m.H]), B = mmToW(E, [x, 0]); sc.beginPath(); sc.moveTo(...A); sc.lineTo(...B); sc.stroke(); } }
    sc.strokeStyle = '#1F6FD1'; sc.lineWidth = lw(3) * px; sc.strokeRect(E.x, E.y, E.w, E.h);
    for (const o of m.objs) { const sel = K.sel && K.sel.e === o.id;
      if (o.pt) { const C = PTK[o.k] || PTK.roz; for (let j = 0; j < (o.n || 1); j++) { const c = mmToW(E, [o.x0 + j * STEP, o.y0]); sc.fillStyle = sel ? '#1F6FD1' : C[1]; sc.beginPath(); sc.arc(c[0], c[1], Math.max(35 * E.k, pr() * .5 * px), 0, 7); sc.fill(); } continue; }   /* розетка — центр первого подрозетника, посты вправо с шагом 71 */
      const A = mmToW(E, [o.x0, o.y1]), B = mmToW(E, [o.x1, o.y0]), C = KINDS_O[o.k] || KINDS_O.kol; sc.fillStyle = C[1] + '55'; sc.strokeStyle = sel ? '#1F6FD1' : C[1]; sc.lineWidth = lw(sel ? 3 : 2) * px; sc.fillRect(A[0], A[1], B[0] - A[0], B[1] - A[1]); sc.strokeRect(A[0], A[1], B[0] - A[0], B[1] - A[1]);
      label([A[0] + 3 * px, A[1] + fs(11) * 1.3 * px], C[0], C[1], px, 11);
      { const zt = zTxt(o.D), f = fs(12), h = fh(), c = [A[0] + f * 2.2 * px, Math.min(B[1] - h * .7 * px, A[1] + (fs(11) * 1.3 + h * .75) * px)]; sc.font = `700 ${f * px}px system-ui`; const zw = sc.measureText(zt).width; sc.fillStyle = '#fff'; sc.fillRect(c[0] - zw / 2 - 4 * px, c[1] - h / 2 * px, zw + 8 * px, h * px); sc.strokeStyle = o.D ? C[1] : '#E0442B'; sc.lineWidth = lw(1.5) * px; if (!o.D) sc.setLineDash([3 * px, 2 * px]); sc.strokeRect(c[0] - zw / 2 - 4 * px, c[1] - h / 2 * px, zw + 8 * px, h * px); sc.setLineDash([]); sc.fillStyle = o.D ? C[1] : '#E0442B'; sc.textBaseline = 'middle'; sc.fillText(zt, c[0] - zw / 2, c[1]); sc.textBaseline = 'alphabetic'; p._zlab.push({c, id: o.id}); }   /* Z: выступ +, ниша − */
      if (sel) handles([[A[0], B[1]], [B[0], B[1]], [B[0], A[1]], [A[0], A[1]]], px); }
    for (const dm of m.dims) { const col = dm.st === 'ok' ? '#2E9E4F' : dm.st === 'bad' ? '#E0442B' : '#D97706', sel = K.sel && K.sel.e === dm.e.id; let P, Q;
      const ptO = [dm.fa, dm.fb].map(f => f && f.o && f.o.pt && !f.o.only ? f.o : null).find(Boolean);   // размер до розетки/вывода — через её центр
      if (dm.fa && dm.fb && dm.e.v > 0) { if (dm.ax === 'x') { const y = ptO ? ptO.y0 : clamp((dm.A[1] + dm.B[1]) / 2, m.H * .03, m.H * .97); P = mmToW(E, [dm.va, y]); Q = mmToW(E, [dm.vb, y]); } else { const x = ptO ? ptO.x0 : clamp((dm.A[0] + dm.B[0]) / 2, m.L * .03, m.L * .97); P = mmToW(E, [x, dm.va]); Q = mmToW(E, [x, dm.vb]); } }
      else { P = mmToW(E, dm.A); Q = mmToW(E, dm.B); }
      const t = dm.e.v > 0 ? String(dm.e.v) + (dm.st === 'bad' ? ' ≠ ' + Math.round(dm.res) : '') : '?';
      dm.e._labE = dimLine(P, Q, t, sel ? '#1F6FD1' : col, px, dm.st === 'free'); dm.e._segE = [P, Q]; dm.wP = wToMm(E, P); dm.wQ = wToMm(E, Q); }
    label([E.x, E.y - 12 * px], `Стена ${Math.round(m.L)}${m.exact.L ? '' : ' ≈'} × ${Math.round(m.H)}${m.exact.H ? '' : ' ≈'}`, '#1F6FD1', px, 15);
  }
  function drawPlan(p, m, B, px) {
    sc.fillStyle = '#F7F8FA'; sc.fillRect(B.x, B.y, B.w, B.h); sc.strokeStyle = '#C9CED6'; sc.lineWidth = lw(1) * px; sc.strokeRect(B.x, B.y, B.w, B.h);
    const pl = planNorm(p.plan); p._plab = [];
    label([B.x, B.y - 10 * px], 'Вид сверху' + (planHas(pl) ? '' : ' — ⌐ Ломаная или ▯ Колонна'), '#3E4954', px, 14);
    if (!pl) return; const T = q => plToW(B, q), sel = K.sel && K.sel.p === p.id ? K.sel : {};
    const box = (c, t, exact, kind, extra) => { const f = fs(13), h = fh(); sc.font = `700 ${f * px}px system-ui`; const w = sc.measureText(t).width; sc.fillStyle = '#fff'; sc.fillRect(c[0] - w / 2 - 4 * px, c[1] - h / 2 * px, w + 8 * px, h * px); sc.strokeStyle = exact ? '#1A2027' : '#E0442B'; sc.lineWidth = lw(1.5) * px; if (!exact) sc.setLineDash([3 * px, 2 * px]); sc.strokeRect(c[0] - w / 2 - 4 * px, c[1] - h / 2 * px, w + 8 * px, h * px); sc.setLineDash([]); sc.fillStyle = exact ? '#1A2027' : '#E0442B'; sc.textBaseline = 'middle'; sc.fillText(t, c[0] - w / 2, c[1]); sc.textBaseline = 'alphabetic'; p._plab.push({c, kind, ...extra}); };
    for (const c of pl.cols) { const P = colPts(c).map(T), on = sel.pc === c.id; sc.fillStyle = 'rgba(107,119,133,.45)'; sc.strokeStyle = on ? '#1F6FD1' : '#3E4954'; sc.lineWidth = lw(on ? 3 : 2) * px; sc.beginPath(); P.forEach((q, i) => i ? sc.lineTo(...q) : sc.moveTo(...q)); sc.closePath(); sc.fill(); sc.stroke();
      box([(P[2][0] + P[3][0]) / 2, P[2][1] + (fh() * .5 + 7) * px], String(Math.round(c.w)), c.wx, 'cw', {id: c.id});
      box([P[1][0] + 24 * px, (P[1][1] + P[2][1]) / 2], String(Math.round(c.d)), c.dx, 'cd', {id: c.id});
      const we = wallExt(pl); if (pl.pts.length > 1) { const a = T([we[0], c.z + c.d / 2]), b = T([c.x, c.z + c.d / 2]); if (b[0] - a[0] > 30 * px) { sc.strokeStyle = '#9AA0A8'; sc.lineWidth = lw(1) * px; sc.setLineDash([4 * px, 3 * px]); sc.beginPath(); sc.moveTo(...a); sc.lineTo(...b); sc.stroke(); sc.setLineDash([]); box([(a[0] + b[0]) / 2, a[1]], '← ' + Math.round(c.x - we[0]), c.ox, 'co', {id: c.id}); } } }
    if (pl.pts.length) { sc.strokeStyle = '#1A2027'; sc.lineWidth = lw(5) * px; sc.lineJoin = 'round'; sc.beginPath(); pl.pts.forEach((q, i) => { const w = T(q); i ? sc.lineTo(...w) : sc.moveTo(...w); }); sc.stroke();
      pl.pts.forEach((q, i) => dot(T(q), sel.pv === i ? '#1F6FD1' : '#1A2027', pr() * .8 * px, '', px));
      planSegs(pl).forEach(([a, b], i) => { const A = T(a), Bq = T(b), l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1) return; const ll = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]), n = [-(Bq[1] - A[1]) / ll, (Bq[0] - A[0]) / ll];
        const v = +pl.len[i]; box([(A[0] + Bq[0]) / 2 + n[0] * 16 * px, (A[1] + Bq[1]) / 2 + n[1] * 16 * px], v > 0 ? String(v) : '≈' + Math.round(l), v > 0, 'seg', {i}); }); }
    if (K.plHl && K.plHl.p === p.id) { sc.strokeStyle = '#00A0E0'; sc.lineWidth = lw(6) * px; sc.globalAlpha = .8; for (const [a, b] of K.plHl.hl) { sc.beginPath(); sc.moveTo(...T(a)); sc.lineTo(...T(b)); sc.stroke(); } sc.globalAlpha = 1; }
  }
  function handles(P, px) { const r = pr() * .8; sc.fillStyle = '#1F6FD1'; sc.strokeStyle = '#fff'; sc.lineWidth = 1.5 * px; for (const q of P) { sc.fillRect(q[0] - r * px, q[1] - r * px, 2 * r * px, 2 * r * px); sc.strokeRect(q[0] - r * px, q[1] - r * px, 2 * r * px, 2 * r * px); } }
  function dot(q, c, r, t, px) { sc.fillStyle = c; sc.beginPath(); sc.arc(q[0], q[1], r, 0, 7); sc.fill(); if (t) label([q[0] + r + 3 * px, q[1] - r], t, c, px, 12); }
  function label(q, t, c, px, sz = 13) { const f = fs(sz); sc.font = `700 ${f * px}px system-ui`; const w = sc.measureText(t).width; sc.fillStyle = 'rgba(255,255,255,.9)'; sc.fillRect(q[0] - 3 * px, q[1] - f * px, w + 6 * px, f * 1.3 * px); sc.fillStyle = c; sc.fillText(t, q[0], q[1]); }
  // размерная линия; наконечник как v81 zArrHd (узкий ±15°, с выемкой); вертикальная подпись — снизу вверх, по центру стрелки
  function dimLine(P, Q, t, c, px, dash) {
    const w0 = lw(2); sc.strokeStyle = c; sc.fillStyle = c; sc.lineWidth = w0 * px; if (dash) sc.setLineDash([6 * px, 4 * px]); sc.beginPath(); sc.moveTo(...P); sc.lineTo(...Q); sc.stroke(); sc.setLineDash([]);
    const hl = ahl() * px, hw = hl * .27, L2 = Math.hypot(Q[0] - P[0], Q[1] - P[1]) || 1;
    for (const [B, s2] of [[Q, 1], [P, -1]]) { const e = [(Q[0] - P[0]) / L2 * s2, (Q[1] - P[1]) / L2 * s2], n = [-e[1], e[0]];
      sc.beginPath(); sc.moveTo(B[0], B[1]); sc.lineTo(B[0] - e[0] * hl + n[0] * hw, B[1] - e[1] * hl + n[1] * hw); sc.lineTo(B[0] - e[0] * hl * .84, B[1] - e[1] * hl * .84); sc.lineTo(B[0] - e[0] * hl - n[0] * hw, B[1] - e[1] * hl - n[1] * hw); sc.closePath(); sc.fill(); }
    const m = [(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], vert = Math.abs(Q[1] - P[1]) > Math.abs(Q[0] - P[0]);
    let ang = Math.atan2(Q[1] - P[1], Q[0] - P[0]); if (vert) ang = -Math.PI / 2; else if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    const f = fs(13), h = fh(); sc.font = `700 ${f * px}px system-ui`; const w = sc.measureText(t).width, len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    const sh = len < w + 26 * px ? -(h * .5 + 9) * px : 0;   // короткий размер — подпись над линией, стрелки видны
    sc.save(); sc.translate(m[0], m[1]); sc.rotate(ang); sc.translate(0, sh);
    sc.fillStyle = '#fff'; sc.fillRect(-w / 2 - 4 * px, -h / 2 * px, w + 8 * px, h * px); sc.lineWidth = lw(1.5) * px; sc.strokeRect(-w / 2 - 4 * px, -h / 2 * px, w + 8 * px, h * px); sc.fillStyle = c; sc.textBaseline = 'middle'; sc.fillText(t, -w / 2, 0); sc.textBaseline = 'alphabetic'; sc.restore();
    return sh ? [m[0] + Math.sin(ang) * -sh, m[1] + Math.cos(ang) * sh] : m;
  }
  api.dimLine = dimLine;
  function drawEl(p, e, T, px) {
    const sel = K.sel && K.sel.e === e.id;
    if (e.t === 'dim') { const st = (p._m && p._m.dims.find(d => d.e === e) || {}).st, c = sel ? '#1F6FD1' : st === 'ok' ? '#2E9E4F' : st === 'bad' ? '#E0442B' : '#D97706'; e._lab = dimLine(T(e.a), T(e.b), e.v > 0 ? String(e.v) : '?', c, px); }
    if (e.t === 'obj') { const A = T(e.a), B = T(e.b), C = KINDS_O[e.k] || KINDS_O.kol; sc.strokeStyle = sel ? '#1F6FD1' : C[1]; sc.lineWidth = lw(2.5) * px; sc.setLineDash([6 * px, 4 * px]); sc.strokeRect(A[0], A[1], B[0] - A[0], B[1] - A[1]); sc.setLineDash([]); label([Math.min(A[0], B[0]) + 4 * px, Math.min(A[1], B[1]) + fs(12) * 1.3 * px], C[0], C[1], px, 12); if (sel) handles([A, [B[0], A[1]], B, [A[0], B[1]]], px); }
    if (e.t === 'pt') { const c = T(e.a), C = PTK[e.k] || PTK.roz; sc.strokeStyle = sel ? '#1F6FD1' : C[1]; sc.lineWidth = lw(3) * px; sc.beginPath(); sc.arc(c[0], c[1], pr() * px, 0, 7); sc.stroke(); label([c[0] + (pr() + 3) * px, c[1] - 6 * px], C[0] + ((e.n || 1) > 1 ? ' ×' + e.n : ''), C[1], px, 12); }
    if (e.t === 'txt') label(T(e.a), e.tx || 'заметка', sel ? '#1F6FD1' : '#1A2027', px, 15);
  }

  /* ═══ [BLOCK SK-HIT] попадание: фото, чертёж стены, вид сверху, заметки ═══ */
  const hitR = () => Math.max(16, fh() * .8) / K.view.s;
  function photoAt(w) { for (let i = K.photos.length - 1; i >= 0; i--) { const p = K.photos[i]; if (!p.iw) continue;
    if (w[0] >= p.x && w[0] <= p.x + p.w && w[1] >= p.y && w[1] <= p.y + photoH(p)) return {p, sp: 'img', q: wToImg(p, w)};
    const E = elev(p); if (E && w[0] >= E.x - 10 && w[0] <= E.x + E.w + 10 && w[1] >= E.y - 10 && w[1] <= E.y + E.h + 10) return {p, sp: 'mm', q: wToMm(E, w), E};
    const B = planBox(p), mx = K.tool === 'plan' || K.tool === 'pcol' ? B && B.w : 40;   // ломаную продолжают и за рамкой (рамка вписывает уже нарисованное)
    if (B && w[0] >= B.x - mx && w[0] <= B.x + B.w + mx && w[1] >= B.y - 20 && w[1] <= B.y + B.h + 20) return {p, sp: 'plan', q: wToPl(B, w), B}; } return null; }
  function elAt(w) { const r = hitR();
    for (const n of [...K.notes].reverse()) { const f = fs(15) / K.view.s; if (w[0] >= n.x - 4 / K.view.s && w[0] <= n.x + (n.tx || 'заметка').length * f * .62 && w[1] >= n.y - f && w[1] <= n.y + f * .4) return {note: n}; }
    for (const p of K.photos) { for (const e of p.els) if (e.t === 'dim') for (const L of [e._labE, e.sp !== 'mm' && e._lab]) if (L && Math.hypot(w[0] - L[0], w[1] - L[1]) < r * 1.6) return {p, e, lab: L};
      for (const L of p._plab || []) if (Math.hypot(w[0] - L.c[0], w[1] - L.c[1]) < r * 1.6) return {p, plab: L};
      for (const L of p._zlab || []) if (Math.hypot(w[0] - L.c[0], w[1] - L.c[1]) < r * 1.4) return {p, zlab: L}; }
    for (const p of K.photos) { const E = elev(p);
      for (const e of [...p.els].reverse()) { const onPhoto = e.sp !== 'mm', T = onPhoto ? q => imgToW(p, q) : E ? q => mmToW(E, emm(p, e, q)) : null; if (!T) continue;
        if ((e.t === 'pt' || e.t === 'txt') && Math.hypot(w[0] - T(e.a)[0], w[1] - T(e.a)[1]) < r) return {p, e};
        const seg = e.t === 'dim' ? (onPhoto ? [T(e.a), T(e.b)] : e._segE) : null;
        if (seg) { const [A, B] = seg, v = [B[0] - A[0], B[1] - A[1]], l2 = v[0] * v[0] + v[1] * v[1] || 1, t = clamp(((w[0] - A[0]) * v[0] + (w[1] - A[1]) * v[1]) / l2, 0, 1); if (Math.hypot(A[0] + v[0] * t - w[0], A[1] + v[1] * t - w[1]) < r * .7) return {p, e}; }
        if (e.t === 'obj') { const A = T(e.a), B = T(e.b); if (w[0] > Math.min(A[0], B[0]) && w[0] < Math.max(A[0], B[0]) && w[1] > Math.min(A[1], B[1]) && w[1] < Math.max(A[1], B[1])) return {p, e}; } } }
    return null; }
  function corAt(p, w) { if (!p.cor) return -1; const r = Math.max(18, pr() * 2) / K.view.s; for (let i = 0; i < 4; i++) { const c = imgToW(p, p.cor[i]); if (Math.hypot(w[0] - c[0], w[1] - c[1]) < r) return i; } return -1; }

  /* ═══ [BLOCK SK-DLG] окно внутри экрана (без prompt/alert) ═══ */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function dlg(title, html, buttons) {
    const D = $s('.sk-dlg'), B = D.querySelector('.bx');
    B.innerHTML = `<h4>${esc(title)}</h4>${html}<div class="bt">${buttons.map((b, i) => `<button data-dg="${i}" class="${b.pr ? 'pr' : ''}">${esc(b.t)}</button>`).join('')}</div>`;
    D.classList.add('on'); const close = () => D.classList.remove('on');
    B.querySelectorAll('[data-dg]').forEach(x => x.onclick = () => { const b = buttons[+x.dataset.dg]; if (!b.keep) close(); b.fn && b.fn(B); });
    const f0 = B.querySelector('input[type=text],textarea'); if (f0) setTimeout(() => { try { f0.focus(); } catch (e) { } }, 30);
    return {B, close};
  }
  api.dialog = dlg;

  /* глубина Z: выступ — плюс, ниша — минус (знак по виду объекта) */
  const zSign = (e, v) => !v ? '' : e.k === 'nis' ? -Math.abs(v) : Math.abs(v);
  const zTxt = v => v === '' || v == null ? 'Z ?' : 'Z ' + (v < 0 ? '−' + Math.abs(v) : v);

  /* ═══ [BLOCK SK-INPUT] ввод значения — штатное поле v81 (#w3f) и клавиатура v81 (лазер — туда же) ═══ */
  const FLD = {k: null};
  function ask(get, set, at, force, neg) {
    const i = document.getElementById('w3f'); if (!i) return;
    let s = toScr(at).map(v => v / DPR()); const y1 = innerHeight - 202 - 24, ny = clamp(s[1], 70, y1), nx = clamp(s[0], 44, innerWidth - 44);
    if (Math.abs(ny - s[1]) > .5 || Math.abs(nx - s[0]) > .5) { K.view.ox += nx - s[0]; K.view.oy += ny - s[1]; s = [nx, ny]; draw(); }
    i._k = null; i.style.left = s[0] + 'px'; i.style.top = s[1] + 'px'; const v0 = get(); i.value = v0 === '' || v0 == null || v0 === 0 ? '' : String(v0);
    FLD.k = {get, set, force, neg, v0: i.value, ed: 0}; i.classList.add('on'); i.dataset.sk = '1'; i.focus(); i.select();
  }
  api.ask = ask;
  function commit(i) {
    const t = FLD.k; FLD.k = null; delete i.dataset.sk; i.classList.remove('on'); if (!t) return;
    const s = String(i.value).trim().replace('−', '-'), n = s === '' ? 0 : (typeof evalN === 'function' ? evalN(s) : parseFloat(s.replace(',', '.')));
    if (n == null || !Number.isFinite(n)) { draw(); return; }
    const v = (t.neg ? n !== 0 : n > 0) ? Math.round(n) : 0, cur = +t.get() || 0;
    if (v && (t.force || v !== cur)) { snap(); t.set(v); save(); } else if (!v && cur && s === '') { snap(); t.set(0); save(); }
    draw(); panel();
  }
  { const i = document.getElementById('w3f');
    if (i) {
      i.addEventListener('input', () => { if (FLD.k) FLD.k.ed = 1; });
      i.addEventListener('change', () => { if (FLD.k && i.dataset.sk) { commit(i); try { i.blur(); } catch (e) { } } });
      i.addEventListener('blur', () => { const t = FLD.k; setTimeout(() => { if (!t || FLD.k !== t || document.activeElement === i) return; if (t.ed && String(i.value).trim() !== t.v0) commit(i); else { FLD.k = null; delete i.dataset.sk; i.classList.remove('on'); } }, 0); });
    } }

  /* ═══ [BLOCK SK-GESTURE] перо/палец/мышь — инструмент; два пальца или колесо — масштаб; 🖊 «стилус рисует» — палец двигает ═══ */
  const ptr = new Map();
  scv.addEventListener('pointerdown', ev => { if (ev.button > 0) return; try { scv.setPointerCapture(ev.pointerId); } catch (e) { } ptr.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (ev.pointerType === 'pen') K.pen = true;
    if (ptr.size === 2) { if (K.drag && K.drag.undo) K.drag.undo(); K.drag = {pinch: pinchState()}; return; }
    const fingerPans = ev.pointerType === 'touch' && K.pen && typeof PEN !== 'undefined' && PEN.mode === 'auto';
    start(toW(ev.clientX, ev.clientY), ev, fingerPans); draw(); });
  scv.addEventListener('pointermove', ev => { if (!ptr.has(ev.pointerId)) return; ptr.set(ev.pointerId, [ev.clientX, ev.clientY]); const g = K.drag; if (!g) return;
    if (g.pinch) { const n = pinchState(), o = g.pinch; K.view.s = clamp(o.s * n.d / o.d, .05, 6); K.view.ox = n.c[0] - (o.c[0] - o.ox) * (K.view.s / o.s); K.view.oy = n.c[1] - (o.c[1] - o.oy) * (K.view.s / o.s); draw(); return; }
    g.move && g.move(toW(ev.clientX, ev.clientY), [ev.clientX, ev.clientY]); draw(); });
  const end = ev => { if (!ptr.has(ev.pointerId)) return; ptr.delete(ev.pointerId); const g = K.drag; if (!g) return; if (g.pinch) { K.drag = ptr.size ? {pinch: pinchState()} : null; return; } if (ev.type !== 'pointercancel' && g.end) g.end(toW(ev.clientX, ev.clientY)); else if (g.undo) g.undo(); K.drag = null; draw(); save(); };
  scv.addEventListener('pointerup', end); scv.addEventListener('pointercancel', end); scv.addEventListener('lostpointercapture', end);
  scv.addEventListener('wheel', ev => { ev.preventDefault(); const f = Math.exp(-ev.deltaY * .0015), w = toW(ev.clientX, ev.clientY); K.view.s = clamp(K.view.s * f, .05, 6); K.view.ox = ev.clientX - w[0] * K.view.s; K.view.oy = ev.clientY - w[1] * K.view.s; draw(); }, {passive: false});
  function pinchState() { const [a, b] = [...ptr.values()]; return {d: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s: K.view.s, ox: K.view.ox, oy: K.view.oy}; }
  function cornerDrag(p, i) { let moved = 0; K.drag = {move: q => { if (!moved) { snap(); moved = 1; } p.cor = p.cor.slice(); p.cor[i] = wToImg(p, q); }, end: () => { if (moved) save(); }}; }
  function start(w, ev, fingerPans) {
    const t = fingerPans ? 'pan' : K.tool, at = photoAt(w), c0 = [ev.clientX, ev.clientY];
    const pan = () => { const o = {ox: K.view.ox, oy: K.view.oy}; K.drag = {move: (q, c) => { K.view.ox = o.ox + c[0] - c0[0]; K.view.oy = o.oy + c[1] - c0[1]; }, end: () => { if (Math.abs(K.view.ox - o.ox) + Math.abs(K.view.oy - o.oy) < 4) { K.sel = null; panel(); } }}; };
    if (fingerPans) return pan();
    if (t === 'cor') { if (!at || at.sp !== 'img') return pan(); const p = at.p, q0 = at.q;
      const add = () => { if (!K.pend || K.pend.p !== p.id) K.pend = {p: p.id, pts: []}; K.pend.pts.push(q0); if (K.pend.pts.length === 4) { snap(); p.cor = K.pend.pts; K.pend = null; K.sel = {p: p.id, photo: 1}; save(); panel(); say('Углы стены заданы'); } };
      const ci = !K.pend ? corAt(p, w) : -1;
      if (ci >= 0) { cornerDrag(p, ci); const g = K.drag, e0 = g.end; let mv = 0; const m0 = g.move; g.move = q => { mv = 1; m0(q); }; g.end = q => mv ? e0(q) : add(); return; }
      add(); return; }
    const hit = elAt(w);
    if (hit && hit.note) { const n = hit.note; K.sel = {n: n.id}; panel(); const o = [n.x, n.y]; let moved = 0;
      K.drag = {move: q => { if (!moved) { snap(); moved = 1; } n.x = o[0] + q[0] - w[0]; n.y = o[1] + q[1] - w[1]; }, end: () => { if (!moved) noteEdit(n); }}; return; }
    if (hit && hit.lab) { K.sel = {p: hit.p.id, e: hit.e.id}; panel(); const rel = () => { const d = (hit.p._m.dims || []).find(x => x.e === hit.e); if (d) for (const f of [d.fa, d.fb]) { const el = f && f.o && hit.p.els.find(x => x.id === f.o.id); if (el) delete el.man; } };   // новое число — снова задаёт положение
      K.drag = {end: () => ask(() => hit.e.v, v => { hit.e.v = v; rel(); }, hit.lab)}; return; }
    if (hit && hit.zlab) { const e = hit.p.els.find(x => x.id === hit.zlab.id); K.sel = {p: hit.p.id, e: e.id}; panel(); K.drag = {end: () => ask(() => e.D, v => e.D = zSign(e, v), hit.zlab.c, 1, 1)}; return; }
    if (hit && hit.plab) { const L = hit.plab, pl = planNorm(hit.p.plan), c = pl.cols.find(x => x.id === L.id), we = wallExt(pl); let get, set;
      if (L.kind === 'seg') { const [a, b] = planSegs(pl)[L.i]; get = () => pl.len[L.i] || Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])); set = v => setSegLen(pl, L.i, v); }
      else if (L.kind === 'cw') { get = () => Math.round(c.w); set = v => { c.w = v; c.wx = 1; }; }
      else if (L.kind === 'cd') { get = () => Math.round(c.d); set = v => { c.d = v; c.dx = 1; }; }
      else { get = () => Math.round(c.x - we[0]); set = v => { c.x = we[0] + v; c.ox = 1; }; }
      K.sel = c ? {p: hit.p.id, pc: c.id} : {p: hit.p.id}; panel(); K.drag = {end: () => ask(get, set, L.c, 1)}; return; }
    if (t === 'pan') {
      if (at && at.sp === 'img') { const ci = corAt(at.p, w); if (ci >= 0) return cornerDrag(at.p, ci); }
      if (at && at.sp === 'img' && K.sel && K.sel.p === at.p.id && K.sel.e) { const p = at.p, e = p.els.find(x => x.id === K.sel.e); if (e && e.t === 'obj' && e.sp !== 'mm') {   // маркеры объекта на фото
        const P = [e.a, [e.b[0], e.a[1]], e.b, [e.a[0], e.b[1]]].map(q => imgToW(p, q)), hi = P.findIndex(q => Math.hypot(q[0] - w[0], q[1] - w[1]) < hitR());
        if (hi >= 0) { let moved = 0; K.drag = {move: q => { if (!moved) { snap(); moved = 1; } const r = wToImg(p, q); if (hi === 0 || hi === 3) e.a = [r[0], e.a[1]]; else e.b = [r[0], e.b[1]]; if (hi < 2) e.a = [e.a[0], r[1]]; else e.b = [e.b[0], r[1]]; }, end: () => { if (moved) save(); }}; return; } } }
      if (at && at.sp === 'mm') { const r = elevObjDrag(at.p, at.E, w); if (r) return; }
      if (hit && hit.e) { const p = hit.p, e = hit.e; K.sel = {p: p.id, e: e.id}; panel(); const a0 = e.a.slice(), b0 = e.b ? e.b.slice() : null, w0 = w; let moved = 0;
        const E = elev(p), conv = e.sp === 'mm' ? (dx, dy) => emmInv(p, e, [dx / E.k, -dy / E.k]) : (dx, dy) => [dx * p.iw / p.w, dy * p.iw / p.w];
        K.drag = {move: q => { if (!moved) { snap(); moved = 1; delete e.bind; } const [dx, dy] = conv(q[0] - w0[0], q[1] - w0[1]); e.a = [a0[0] + dx, a0[1] + dy]; if (b0) e.b = [b0[0] + dx, b0[1] + dy]; }, end: () => { if (moved) save(); }}; return; }
      if (at && at.sp === 'plan' && at.p.plan) { const p = at.p, B = at.B, pl = planNorm(p.plan), tol = Math.max(18, pr() * 2) / (K.view.s * B.k), q0 = at.q;
        const vi = pl.pts.findIndex(q => Math.hypot(q[0] - q0[0], q[1] - q0[1]) < tol);
        if (vi >= 0) { K.sel = {p: p.id, pv: vi}; panel(); const o = pl.pts[vi].slice(); let moved = 0;
          K.drag = {move: w2 => { if (!moved) { snap(); moved = 1; delete pl.len[vi - 1]; delete pl.len[vi]; } const q = wToPl(B, w2); let x = o[0] + q[0] - q0[0], z = o[1] + q[1] - q0[1];
            if (snapOn()) for (const j of [vi - 1, vi + 1]) { const n = pl.pts[j]; if (!n) continue; if (Math.abs(x - n[0]) < tol) x = n[0]; if (Math.abs(z - n[1]) < tol) z = n[1]; }   // по прямой с соседями
            pl.pts[vi] = [Math.round(x), Math.round(z)]; }, end: () => { if (moved) save(); }}; return; }
        const c = [...pl.cols].reverse().find(c => q0[0] >= c.x && q0[0] <= c.x + c.w && q0[1] >= c.z && q0[1] <= c.z + c.d);
        if (c) { K.sel = {p: p.id, pc: c.id}; panel(); const o = [c.x, c.z]; let moved = 0;
          K.drag = {move: w2 => { if (!moved) { snap(); moved = 1; } const q = wToPl(B, w2); c.x = o[0] + q[0] - q0[0]; c.z = o[1] + q[1] - q0[1]; K.plHl = {p: p.id, hl: snapCol(pl, c, tol)}; },
            end: () => { K.plHl = null; c.x = Math.round(c.x); c.z = Math.round(c.z); delete c.ox; if (moved) save(); }}; return; }
        return pan(); }
      if (at && at.sp === 'img') { const p = at.p, x0 = p.x, y0 = p.y; K.sel = {p: p.id, photo: 1}; panel(); let moved = 0; K.drag = {move: (q, c) => { if (!moved) { snap(); moved = 1; } p.x = x0 + (c[0] - c0[0]) / K.view.s; p.y = y0 + (c[1] - c0[1]) / K.view.s; }, end: () => { if (moved) save(); }}; return; }
      return pan();
    }
    if (t === 'txt' && (!at || at.sp === 'plan')) { noteNew(w); return; }   // заметка на холсте объекта
    if (!at) return pan();
    const p = at.p;
    if (t === 'plan' || t === 'pcol') { if (at.sp !== 'plan') return say('Вид сверху рисуется в рамке под чертежом стены'); const B = at.B, pl = p.plan = planNorm(p.plan || {}), tol = Math.max(18, pr() * 2) / (K.view.s * B.k);
      if (t === 'plan') return planTap(p, pl, at.q, tol);
      const a = at.q.slice(); let c = null;
      K.drag = {move: w2 => { const b = wToPl(B, w2); c = {id: uid(), x: Math.min(a[0], b[0]), z: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), d: Math.abs(b[1] - a[1])}; K.plHl = {p: p.id, hl: snapCol(pl, c, tol)}; },
        prev: px => { if (!c) return; const P = colPts(c).map(q => plToW(B, q)); sc.strokeStyle = '#1F6FD1'; sc.lineWidth = lw(2) * px; sc.setLineDash([6 * px, 4 * px]); sc.beginPath(); P.forEach((q, i) => i ? sc.lineTo(...q) : sc.moveTo(...q)); sc.closePath(); sc.stroke(); sc.setLineDash([]); },
        end: () => { K.plHl = null; if (!c || c.w < 30 || c.d < 30) return say('Колонна — протяни от угла к углу (от 30 мм)'); snap(); for (const k of ['x', 'z', 'w', 'd']) c[k] = Math.round(c[k]); pl.cols.push(c); K.sel = {p: p.id, pc: c.id}; save(); panel(); }}; return; }
    if (at.sp === 'plan') return pan();
    if (!p.cor) return say('Сначала углы стены на фото (⌗ Углы)');
    const mmSp = at.sp === 'mm', m = p._m, E = at.E, T = mmSp ? q => mmToW(E, q) : q => imgToW(p, q), conv = q => mmSp ? wToMm(E, q) : wToImg(p, q);
    const mk = o => mmSp ? {...o, sp: 'mm', L0: m.L, H0: m.H} : {...o, sp: 'img'};
    if (t === 'txt') { textDlg('Заметка', '', tx => { if (tx) { snap(); p.els.push(mk({id: uid(), t: 'txt', a: at.q, tx})); save(); draw(); } }); return; }
    if (t === 'pt') { snap(); const e = mk({id: uid(), t: 'pt', a: at.q, k: K.ptk, n: POSTS[K.ptk] ? K.posts : 1}); p.els.push(e); K.sel = {p: p.id, e: e.id}; save(); panel(); return; }
    if (t === 'dim' || t === 'obj') { const a = at.q.slice(); let b = a.slice();
      K.drag = {move: q => { b = conv(q); if (t === 'dim' && mmSp) { if (Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1])) b[1] = a[1]; else b[0] = a[0]; } },   // на чертеже размер строго гор./верт.
        prev: px => { if (t === 'dim') dimLine(T(a), T(b), '…', '#1F6FD1', px); else { const A = T(a), B = T(b); sc.strokeStyle = '#1F6FD1'; sc.lineWidth = lw(2) * px; sc.setLineDash([6 * px, 4 * px]); sc.strokeRect(A[0], A[1], B[0] - A[0], B[1] - A[1]); sc.setLineDash([]); } },
        end: () => { const A = T(a), B = T(b); if (Math.hypot(B[0] - A[0], B[1] - A[1]) * K.view.s < 14) return; snap(); const e = mk({id: uid(), t, a, b, v: 0, k: K.kind}); p.els.push(e); K.sel = {p: p.id, e: e.id}; save(); draw(); panel();
          if (t === 'dim') { const L = e._labE || e._lab || A; ask(() => e.v, v => e.v = v, L); } }}; }
  }
  // объект на чертеже: тянуть — сдвиг, угловой маркер — размер; края притягиваются к краям стены, изломам и колоннам вида сверху.
  // Объект с фото при первой правке на чертеже переводится в мм чертежа и помечается «поставлен руками».
  function elevObjDrag(p, E, w) {
    const m = p._m, q0 = wToMm(E, w), tol = Math.max(14, pr() * 1.6) / (K.view.s * E.k), sel = K.sel && K.sel.p === p.id ? K.sel.e : null;
    let o = null, hi = -1;
    if (sel) { const so = m.objs.find(x => x.id === sel && !x.pt); if (so) { const C = [[so.x0, so.y0], [so.x1, so.y0], [so.x1, so.y1], [so.x0, so.y1]]; hi = C.findIndex(c => Math.hypot(c[0] - q0[0], c[1] - q0[1]) < tol); if (hi >= 0) o = so; } }
    if (!o) o = [...m.objs].reverse().find(x => x.pt ? Math.hypot(x.x0 - q0[0], x.y0 - q0[1]) < tol * 1.5 : q0[0] >= x.x0 && q0[0] <= x.x1 && q0[1] >= x.y0 && q0[1] <= x.y1);
    if (!o) return false; const e = p.els.find(x => x.id === o.id); if (!e) return false;
    K.sel = {p: p.id, e: e.id}; panel();
    const fx = [0, m.L, ...(m.plan ? [...m.plan.pl.pts.map(v => (v[0] - m.plan.mn) * m.plan.k), ...m.plan.pl.cols.flatMap(c => [(c.x - m.plan.mn) * m.plan.k, (c.x + c.w - m.plan.mn) * m.plan.k])] : [])], fy = [0, m.H];
    const sn = (v, F) => { if (!snapOn()) return v; for (const f of F) if (Math.abs(f - v) < tol) return f; return v; };
    const r0 = [o.x0, o.y0, o.x1, o.y1]; let moved = 0;
    K.drag = {move: w2 => { const q = wToMm(E, w2), dx = q[0] - q0[0], dy = q[1] - q0[1];
      if (!moved) { snap(); moved = 1; Object.assign(e, {sp: 'mm', L0: m.L, H0: m.H, man: 1}); }
      if (o.pt) { e.a = [sn(r0[0] + dx, fx), sn(r0[1] + dy, fy)]; return; }
      let [x0, y0, x1, y1] = r0;
      if (hi < 0) { const w0 = x1 - x0, h0 = y1 - y0; x0 = sn(x0 + dx, fx); if (x0 === r0[0] + dx) { const x1s = sn(x1 + dx, fx); x0 = x1s - w0; } y0 = sn(y0 + dy, fy); if (y0 === r0[1] + dy) { const y1s = sn(y1 + dy, fy); y0 = y1s - h0; } x1 = x0 + w0; y1 = y0 + h0; }
      else { if (hi === 0 || hi === 3) x0 = sn(x0 + dx, fx); else x1 = sn(x1 + dx, fx); if (hi < 2) y0 = sn(y0 + dy, fy); else y1 = sn(y1 + dy, fy); }
      e.a = [Math.min(x0, x1), Math.min(y0, y1)]; e.b = [Math.max(x0, x1), Math.max(y0, y1)]; },
      end: () => { if (!moved) return; save(); const m2 = build(p), bad = m2.dims.filter(d => d.st === 'bad' && [d.fa, d.fb].some(f => f && f.o && f.o.id === e.id)); if (bad.length) say('Не сходится с размером ' + bad.map(d => d.e.v).join(', ') + ' — поправь число или объект'); }};
    return true; }
  api.elevObjDrag = elevObjDrag;
  // ломаная: касание — следующий излом; к прямой (≤12°) и к существующим точкам притягивается
  function planTap(p, pl, q, tol) { snap(); const P = pl.pts; let [x, z] = q;
    const hitV = P.find(v => Math.hypot(v[0] - x, v[1] - z) < tol); if (hitV) [x, z] = hitV;
    else if (snapOn() && !P.length) { if (Math.abs(x) < tol * 2) x = 0; if (Math.abs(z) < tol * 2) z = 0; }
    else if (P.length) { const l = P[P.length - 1], dx = x - l[0], dz = z - l[1], tg = Math.tan(12 * Math.PI / 180); if (snapOn()) { if (Math.abs(dz) <= tg * Math.abs(dx)) z = l[1]; else if (Math.abs(dx) <= tg * Math.abs(dz)) x = l[0]; }
      if (Math.hypot(x - l[0], z - l[1]) < 20) { K.und.pop(); return; } }
    P.push([Math.round(x), Math.round(z)]); K.sel = {p: p.id, pv: P.length - 1}; save(); panel(); }
  function textDlg(title, v, ok) { dlg(title, `<label>Текст</label><input type="text" data-sk-tx value="${esc(v)}">`, [{t: 'Отмена'}, {t: 'Готово', pr: 1, fn: B => ok(B.querySelector('[data-sk-tx]').value.trim())}]); }
  function noteNew(w) { textDlg('Заметка', '', tx => { if (!tx) return; snap(); const n = {id: uid(), x: w[0], y: w[1], tx}; K.notes.push(n); K.sel = {n: n.id}; save(); draw(); panel(); }); }
  function noteEdit(n) { textDlg('Заметка', n.tx, tx => { snap(); if (tx) n.tx = tx; else K.notes = K.notes.filter(x => x !== n); save(); draw(); panel(); }); }

  /* ═══ [BLOCK SK-UI] подсказки, панель, кнопки ═══ */
  const HINT = {pan: 'Тяни фото, элементы и жёлтые углы. Два пальца или колесо — масштаб. Касание числа — ввод.', cor: 'Ставь 4 угла стены на фото по потолку и полу: левый-верх, правый-верх, правый-низ, левый-низ. Готовый угол можно тянуть.', dim: 'Протяни размер на чертеже стены (или по фото) и введи число. Привязка — к ближайшему краю стены, излому вида сверху или объекту.', obj: 'Обведи ригель, короб, колонну, нишу или проём на фото или на чертеже. Глубина Z — касанием поля Z.', pt: 'Коснись точки коммуникации на фото или на чертеже. Розетка — центр первого подрозетника.', plan: 'Касаниями в рамке «Вид сверху» — изломы стены. Длина участка — касанием числа.', pcol: 'Протяни колонну в рамке «Вид сверху»; грань притягивается к стене.', txt: 'Коснись места заметки: на фото, на чертеже или на холсте.'};
  function panel() {
    const P = $s('.sk-panel'); if (K.sel && K.sel.n) { P.classList.remove('on'); return; }
    const p = K.photos.find(x => x.id === (K.sel && K.sel.p)); if (!p) { P.classList.remove('on'); return; } const m = p._m || build(p), e = K.sel.e && p.els.find(x => x.id === K.sel.e);
    let h = `<h4>${p.cor ? 'Стена' : 'Фото'}</h4>`;
    if (m && m.L) h += `<div class="r"><span>Длина</span><b>${Math.round(m.L)}${m.exact.L ? '' : ' ≈'}</b></div><div class="r"><span>Высота</span><b>${Math.round(m.H)}${m.exact.H ? '' : ' ≈'}</b></div>`;
    if (m && m.dims) { const D = m.dims, ok = D.filter(d => d.st === 'ok').length, bad = D.filter(d => d.st === 'bad').length, fr = D.filter(d => d.st === 'free' || d.st === 'nov').length; h += `<div class="r"><span>Размеры</span><span><span class="ok">✓${ok}</span> <span class="er">≠${bad}</span> <span class="wr">?${fr}</span></span></div>`; }
    if (p.cor) h += `<div class="r"><button data-pp="lh">Длина/высота вручную</button></div>`;
    if (p.plan) h += `<div class="r"><button data-pp="pl">Стереть вид сверху</button></div>`;
    if (p.cor && m && m.L) h += `<div class="r"><button data-pp="wall" class="pr">${p.wall ? '⟳ Стена снова' : '▣ Создать стену'}</button></div>`;
    const pc = K.sel.pc && p.plan && p.plan.cols.find(c => c.id === K.sel.pc); if (pc) h += `<hr><div class="r"><b>Колонна (вид сверху)</b></div><div class="r"><span>Ширина</span><b>${Math.round(pc.w)}</b></div><div class="r"><span>Глубина</span><b>${Math.round(pc.d)}</b></div><div class="r"><span>От края стены</span><b>${Math.round(pc.x - wallExt(p.plan)[0])}</b></div><div class="r mu">Числа меняются касанием на виде сверху</div>`;
    if (K.sel.pv != null && p.plan) h += `<hr><div class="r"><b>Излом ${K.sel.pv + 1}</b><span class="mu">🗑 — удалить</span></div>`;
    if (e) { h += `<hr><div class="r"><b>${e.t === 'dim' ? 'Размер' : e.t === 'obj' ? (KINDS_O[e.k] || [])[0] : e.t === 'pt' ? (PTK[e.k] || [])[0] : 'Заметка'}</b><span class="mu">${e.sp === 'mm' ? 'на чертеже' : 'на фото'}</span></div>`;
      if (e.t === 'dim') { const d = m && m.dims && m.dims.find(x => x.e === e); h += `<div class="r"><span>Значение</span><b>${e.v || '—'}</b></div>` + (d ? `<div class="r"><span>По месту ≈</span><span>${Math.round(d.est)}</span></div><div class="r"><span>Привязка</span><span>${d.fa && d.fb ? (d.st === 'ok' ? '<span class="ok">к краям</span>' : '<span class="er">конфликт</span>') : '<span class="wr">нет края рядом</span>'}</span></div>` : ''); }
      if (e.t === 'pt') h += `<div class="r"><span>Вид</span><select data-pp="ptk">${Object.entries(PTK).map(([k, v]) => `<option value="${k}"${k === e.k ? ' selected' : ''}>${esc(v[0])}</option>`).join('')}</select></div>` + (POSTS[e.k] ? `<div class="r"><span>Посты</span><span>${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}" class="n${(e.n || 1) === n ? ' on' : ''}">${n}</button>`).join('')}</span></div>` : '');
      if (e.t === 'obj') h += `<div class="r"><span>Глубина Z${e.k === 'nis' ? ' (ниша −)' : ''}</span><b>${zTxt(e.D)}</b></div>${e.man ? '<div class="r mu">Поставлен руками — размеры только проверяют</div>' : ''}<div class="r"><span>Вид</span><select data-pp="k">${Object.entries(KINDS_O).map(([k, v]) => `<option value="${k}"${k === e.k ? ' selected' : ''}>${v[0]}</option>`).join('')}</select></div>`;
      if (e.t === 'txt') h += `<div class="r"><button data-pp="tx">Изменить текст</button></div>`; }
    P.innerHTML = h; P.classList.add('on');
    const on = (k, f) => { const b = P.querySelector(`[data-pp="${k}"]`); if (b) b[b.tagName === 'SELECT' ? 'onchange' : 'onclick'] = () => f(b); };
    on('lh', () => { const d = dlg('Стена, мм', `<label>Длина (пусто — из размеров)</label><input data-sk-l inputmode="decimal" value="${p.L || ''}"><label>Высота (пусто — из размеров)</label><input data-sk-h inputmode="decimal" value="${p.H || ''}">`, [{t: 'Отмена'}, {t: 'Готово', pr: 1, fn: B => { const L = parseFloat(String(B.querySelector('[data-sk-l]').value).replace(',', '.')), H = parseFloat(String(B.querySelector('[data-sk-h]').value).replace(',', '.')); snap(); p.L = L > 0 ? Math.round(L) : 0; p.H = H > 0 ? Math.round(H) : 0; save(); draw(); panel(); }}]); void d; });
    on('pl', () => { snap(); p.plan = null; save(); draw(); panel(); });
    on('wall', () => wallDlg(p));
    on('tx', () => textDlg('Заметка', e.tx, tx => { snap(); e.tx = tx || e.tx; save(); draw(); }));
    on('ptk', b => { snap(); e.k = b.value; if (!POSTS[e.k]) e.n = 1; save(); draw(); panel(); });
    on('k', b => { snap(); e.k = b.value; if (e.D) e.D = zSign(e, e.D); save(); draw(); panel(); });
    P.querySelectorAll('[data-n]').forEach(x => x.onclick = () => { snap(); e.n = +x.dataset.n; K.posts = e.n; save(); draw(); panel(); });
  }
  api.panel = panel;
  function kinds() { const B = $s('.sk-kinds'), set = K.tool === 'obj' ? KINDS_O : K.tool === 'pt' ? PTK : null; if (!set) { B.classList.remove('on'); return; } B.innerHTML = Object.entries(set).map(([k, v]) => `<button data-k="${k}" class="${(K.tool === 'obj' ? K.kind : K.ptk) === k ? 'on' : ''}">${esc(v[0])}</button>`).join(''); B.classList.add('on'); B.querySelectorAll('button').forEach(b => b.onclick = () => { if (K.tool === 'obj') K.kind = b.dataset.k; else K.ptk = b.dataset.k; kinds(); }); }
  function tool(t) { K.tool = t; K.pend = null; root.querySelectorAll('.sk-bar [data-t]').forEach(x => x.classList.toggle('on', x.dataset.t === t)); kinds(); draw(); }
  api.tool = tool;
  root.querySelectorAll('.sk-bar [data-t]').forEach(b => b.onclick = () => tool(b.dataset.t));
  function undo() { if (K.pend) { K.pend.pts.pop(); if (!K.pend.pts.length) K.pend = null; return draw(); } const t = K.und.pop(); if (!t) return say('Отменять нечего'); const o = JSON.parse(t);
    for (const q of o.ph) { const p = K.photos.find(x => x.id === q.id); if (p) Object.assign(p, {cor: q.cor, els: q.els, x: q.x, y: q.y, L: q.L, H: q.H, plan: q.plan, wall: q.wall}); }
    K.photos = K.photos.filter(p => o.ph.some(q => q.id === p.id)); K.notes = o.notes || []; K.sel = null; save(); draw(); panel(); }
  function del() { if (K.sel && K.sel.n) { snap(); K.notes = K.notes.filter(n => n.id !== K.sel.n); K.sel = null; save(); draw(); panel(); return; }
    const p = K.photos.find(x => x.id === (K.sel && K.sel.p)); if (!p) return say('Выберите элемент или фото'); snap();
    if (K.sel.e) p.els = p.els.filter(e => e.id !== K.sel.e); else if (K.sel.pc && p.plan) p.plan.cols = p.plan.cols.filter(c => c.id !== K.sel.pc); else if (K.sel.pv != null && p.plan) { p.plan.pts.splice(K.sel.pv, 1); p.plan.len = {}; } else if (K.sel.photo) K.photos = K.photos.filter(x => x !== p);
    K.sel = null; save(); draw(); panel(); }
  api.undo = undo; api.del = del;

  /* ═══ [BLOCK SK-PHOTO] фото с камеры / галереи: ≤ 2000 px JPEG, файл — в базе скетча ═══ */
  async function loadImg(p, blob) { try { const u = URL.createObjectURL(blob), im = new Image(); await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = u; }); K.imgs[p.id] = im; if (!p.iw) { p.iw = im.naturalWidth; p.ih = im.naturalHeight; } } catch (e) { } }
  async function toJpeg(src, max) {
    const bmp = await createImageBitmap(src, {imageOrientation: 'from-image'}).catch(() => createImageBitmap(src)), k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.88)); return {blob, w: c.width, h: c.height, k};
  }
  async function addPhotos(files) {
    let x = Math.max(0, ...K.photos.map(p => p.x + p.w + 80)), n = 0;
    for (const f of files) { try { const j = await toJpeg(f, 2000), p = {id: 'p' + uid(), x, y: 0, w: 860, iw: j.w, ih: j.h, cor: null, els: [], plan: null};
      await sPut('img', j.blob, p.id); await loadImg(p, j.blob); snap(); K.photos.push(p); x += 940; n++; } catch (e) { say('Фото не добавлено: ' + e.message); } }
    if (n) { const p = K.photos[K.photos.length - 1]; K.sel = null; fitTo(p); tool('cor'); await saveNowSk(); panel(); say(n > 1 ? `Фото: ${n}` : 'Фото добавлено · ⌗ углы стены'); }
  }
  api.addPhotos = addPhotos;
  function fitTo(p) { const W = innerWidth, H = innerHeight - 170, h = photoH(p) * 1.15; K.view.s = clamp(Math.min(W / (p.w + 40), H / h), .05, 6); K.view.ox = (W - p.w * K.view.s) / 2 - p.x * K.view.s; K.view.oy = 100 - p.y * K.view.s; draw(); }
  function fitAll(p) { p = p || K.photos[0]; if (!p) return; p._m = build(p); const B = planBox(p), y1 = B ? B.y + B.h + 30 : p.y + photoH(p) + 30, W = innerWidth, H = innerHeight - 190;
    K.view.s = clamp(Math.min(W / (p.w + 60), H / (y1 - p.y + 60)), .05, 6); K.view.ox = (W - p.w * K.view.s) / 2 - p.x * K.view.s; K.view.oy = 110 - (p.y - 30) * K.view.s; draw(); }
  api.fit = fitTo; api.fitAll = fitAll;
  for (const [k, b] of [['cam', 'cam'], ['gal', 'gal'], ['imp', 'imp']]) { const inp = $s(`[data-skf="${k}"]`); $s(`[data-sk="${b}"]`).onclick = () => inp.click();
    inp.onchange = async ev => { const fs0 = [...ev.target.files]; ev.target.value = ''; if (!fs0.length) return; if (k === 'imp') { try { await importJson(JSON.parse(await fs0[0].text())); } catch (e) { say('Файл не прочитан: ' + e.message); } } else await addPhotos(fs0); }; }

  /* ═══ [BLOCK SK-JSON] перенос: файл JSON со всеми фото (dataURL) ═══ */
  const b2u = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(''); r.readAsDataURL(b); });
  async function exportObj() {
    const photos = []; for (const p of K.photos) { const b = await sGet('img', p.id).catch(() => null); photos.push({...clone(strip(p)), src: b ? await b2u(b) : ''}); }
    return {format: 'measure-sketch', v: 1, app: 'Measure 82.14', obj: K.obj, date: new Date().toISOString(), photos, notes: clone(K.notes)};
  }
  api.exportObj = exportObj;
  async function exportJson() {
    const o = await exportObj(), txt = JSON.stringify(o), fn = 'skech_' + (K.obj || 'obekt').replace(/[^\wа-яА-ЯёЁ.-]+/g, '_') + '_' + o.date.slice(0, 10) + '.json';
    try { if (typeof appSave === 'function' && appSave(fn, txt)) return say('Скетч сохранён: ' + fn); } catch (e) { }
    try { const u = URL.createObjectURL(new Blob([txt], {type: 'application/json'})), a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); say('Скетч сохранён: ' + fn); } catch (e) { say('Сохранение отклонено'); }
  }
  async function importJson(o) {
    if (!o || o.format !== 'measure-sketch' || !Array.isArray(o.photos)) return say('Это не файл скетча');
    snap(); let x = Math.max(0, ...K.photos.map(p => p.x + p.w + 80)); const dx = K.photos.length ? x - Math.min(...o.photos.map(p => p.x || 0)) : 0, ids = new Set(K.photos.map(p => p.id));
    for (const q of o.photos) { const p = {...q}; delete p.src; if (ids.has(p.id)) p.id = 'p' + uid(); p.x = (+p.x || 0) + dx; delete p.wall;
      if (q.src) { try { const b = await (await fetch(q.src)).blob(); await sPut('img', b, p.id); await loadImg(p, b); } catch (e) { } } K.photos.push(p); }
    for (const n of o.notes || []) K.notes.push({...n, id: uid(), x: (+n.x || 0) + dx});
    await saveNowSk(); draw(); say(`Загружено фото: ${o.photos.length}` + (o.obj && o.obj !== K.obj ? ` (из «${o.obj}»)` : ''));
  }
  api.importJson = importJson;
  $s('[data-sk="exp"]').onclick = exportJson;
  root.querySelector('[data-sk="undo"]').onclick = undo;
  root.querySelector('[data-sk="del"]').onclick = del;

  /* ═══ [BLOCK SK-WALL] «Создать стену»: помещение → стена плана L/H, объекты → объёмы с D, точки → коммуникации (посты), размеры → ручные стрелки, фото — на стену ═══ */
  function wallData(p) {   // чертёж → данные вида стены v81 (x — от левого угла вида из помещения, y — от пола, мм)
    const m = build(p); if (!m) return null; p._m = m; const {L, H} = m, R = v => r1(v), nid = pf => pf + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const els = [], dms = [], notes = [];
    for (const o of m.objs) {
      if (o.pt) { const n = Math.max(1, Math.min(5, o.n || 1)), multi = POSTS[o.k] && n > 1; els.push({id: nid('e'), k: o.k, c: [R(o.x0 + (multi ? (n - 1) * STEP / 2 : 0)), R(o.y0)], W: '', H: '', D: '', N: multi ? n : '', st: multi ? STEP : '', note: ''}); continue; }   // посты от центра первого вправо → центр блока v81
      if (o.x1 - o.x0 < 1 || o.y1 - o.y0 < 1) continue;
      els.push({id: nid('e'), k: O2V[o.k] || 'kor', c: [R((o.x0 + o.x1) / 2), R((o.y0 + o.y1) / 2)], W: R(o.x1 - o.x0), H: R(o.y1 - o.y0), D: o.D ? Math.abs(+o.D) : '', N: '', st: '', note: ''});
    }
    if (m.plan) { const {pl, mn, k} = m.plan, X = x => (x - mn) * k, zs = pl.pts.map(q => q[1]), zb = zs.length ? Math.min(...zs) : 0;
      for (const [a, b] of planSegs(pl)) if (isH(a, b) && a[1] - zb > .5) { const x0 = clamp(X(Math.min(a[0], b[0])), 0, L), x1 = clamp(X(Math.max(a[0], b[0])), 0, L); if (x1 - x0 > 1) els.push({id: nid('e'), k: 'kol', c: [R((x0 + x1) / 2), R(H / 2)], W: R(x1 - x0), H: R(H), D: Math.round(a[1] - zb), N: '', st: '', note: 'выступ стены (вид сверху)'}); }   // вид элемента v81 (KD): выступ во всю высоту — колонна
      for (const c of pl.cols) { const x0 = clamp(X(c.x), 0, L), x1 = clamp(X(c.x + c.w), 0, L); if (x1 - x0 > 1) els.push({id: nid('e'), k: 'kol', c: [R((x0 + x1) / 2), R(H / 2)], W: R(x1 - x0), H: R(H), D: Math.max(1, Math.round(c.z + c.d - zb)), N: '', st: '', note: 'вид сверху'}); } }
    for (const d of m.dims) { if (!(d.e.v > 0)) continue; let A, B;
      if (d.fa && d.fb) { const ptO = [d.fa, d.fb].map(f => f && f.o && f.o.pt && !f.o.only ? f.o : null).find(Boolean);
        if (d.ax === 'x') { const y = ptO ? ptO.y0 : clamp((d.A[1] + d.B[1]) / 2, H * .03, H * .97); A = [d.va, y]; B = [d.vb, y]; } else { const x = ptO ? ptO.x0 : clamp((d.A[0] + d.B[0]) / 2, L * .03, L * .97); A = [x, d.va]; B = [x, d.vb]; } }
      else { A = d.A; B = d.B; }
      dms.push({id: nid('d'), a: [R(A[0]), R(A[1])], b: [R(B[0]), R(B[1])], t: 'both', vm: d.e.v}); }
    for (const e of p.els) if (e.t === 'txt' && e.tx) { const q = e.sp === 'mm' ? emm(p, e, e.a) : (() => { const u = hap(m.g.f, e.a); return [u[0] * L, (1 - u[1]) * H]; })(); notes.push({id: nid('n'), p: [R(q[0]), R(q[1])], t: [R(q[0]), R(q[1])], tx: e.tx}); }
    return {L: R(L), H: R(H), exact: m.exact, els, dms, notes};
  }
  api.wallData = wallData;
  async function rooms() { const all = (await dbAll('sess').catch(() => [])) || []; return all.filter(o => o.kind === 'room' && !o.del && !o.pstub).sort((a, b) => (b.upd || b.created) - (a.upd || a.created)); }
  async function wallDlg(p) {
    const W = wallData(p); if (!W) return say('Сначала углы стены');
    const R = await rooms(), opts = R.map(r => `<option value="${esc(r.id)}"${r.obj === K.obj ? '' : ''}>${esc((r.obj || '—') + ' · ' + r.name)}</option>`).join('');
    const pre = p.wall && R.find(r => r.id === p.wall.r) ? p.wall.r : (R.find(r => r.obj === K.obj) || {}).id || '';
    const d = dlg('Создать стену', `<div class="mu">Стена ${Math.round(W.L)}${W.exact.L ? '' : ' ≈'} × ${Math.round(W.H)}${W.exact.H ? '' : ' ≈'} · объектов ${W.els.filter(e => !KD[e.k] || !KD[e.k].pt).length} · точек ${W.els.filter(e => KD[e.k] && KD[e.k].pt).length} · размеров ${W.dms.length}</div>
<label>Помещение</label><select data-sk-room><option value="">＋ Новое помещение</option>${opts}</select>
<div data-sk-new><label>Объект</label><input type="text" data-sk-obj value="${esc(K.obj)}"><label>Помещение</label><input type="text" data-sk-name value="${esc('Помещение')}"></div>
<div data-sk-walls></div>`, [{t: 'Отмена'}, {t: 'Создать', pr: 1, keep: 1, fn: B => go(B)}]);
    const B = d.B, sel = B.querySelector('[data-sk-room]'), nw = B.querySelector('[data-sk-new]'), wl = B.querySelector('[data-sk-walls]');
    const upd = () => { const r = R.find(x => x.id === sel.value); nw.hidden = !!r; if (!r) { wl.innerHTML = ''; return; }
      const m = r.ms, n = plN(m), ws = [...Array(n).keys()].map(k => { const l = plLen(m, k); return `<option value="${k}"${p.wall && p.wall.r === r.id && p.wall.k === k ? ' selected' : ''}>С${wN(r, k)}${l ? ' · ' + Math.round(l.v) + (l.ok ? '' : ' ≈') : ''}${(r.segs || {})[k] ? ' · есть вид стены' : ''}</option>`; }).join('');
      wl.innerHTML = `<label>Стена</label><select data-sk-k>${!m.closed ? `<option value="new">＋ Новая стена плана</option>` : ''}${ws}</select>`; };
    sel.value = pre; sel.onchange = upd; upd();
    async function go(B) {
      const r = R.find(x => x.id === sel.value), ks = B.querySelector('[data-sk-k]'), kv = ks ? ks.value : 'new';
      if (r && kv !== 'new' && (r.segs || {})[+kv] && !B.dataset.ok) { B.dataset.ok = '1'; B.querySelector('.bt .pr').textContent = 'Заменить вид стены'; return say('У стены уже есть вид — «Заменить вид стены» ещё раз'); }
      d.close();
      try { await createWall(p, W, r ? {id: r.id, k: kv === 'new' ? 'new' : +kv} : {obj: B.querySelector('[data-sk-obj]').value.trim() || K.obj, name: B.querySelector('[data-sk-name]').value.trim() || 'Помещение'}); }
      catch (e) { console.error(e); say('Стена не создана: ' + e.message); }
    }
  }
  api.wallDlg = wallDlg;
  async function createWall(p, W, to) {
    W = W || wallData(p); if (!W) throw new Error('нет углов стены');
    await saveNowSk(); const keepOpen = K.open; hide();
    if (S.sess) { try { await saveNow(); } catch (e) { } }
    if (to.id) await openRoom(to.id); else await newRoom(to.obj, to.name);
    const r = S.room; if (!r) throw new Error('помещение не открыто'); const m = r.ms;
    plSnap();
    let k = to.k;
    if (k === 'new' || k == null) {   // новая стена — продолжение открытой ломаной (поворот 90° от последнего участка)
      if (m.closed) throw new Error('контур помещения замкнут — выберите стену');
      if (!m.pts.length) m.pts.push([0, 0]);
      const n = m.pts.length, a = m.pts[n - 1];
      let u = [1, 0]; if (n >= 2) { const b = m.pts[n - 2], l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; u = [-(a[1] - b[1]) / l, (a[0] - b[0]) / l]; }
      m.pts.push([Math.round(a[0] + u[0] * W.L), Math.round(a[1] + u[1] * W.L)]); k = m.pts.length - 2;
      m.wsd = m.wsd || {}; if (m.wsd[k] == null) m.wsd[k] = 1; if (!m.wsdv) m.wsdv = 81;
    }
    if (W.exact.L || !(plDim(m, k) && +plDim(m, k).v > 0)) { const a = k, b = (k + 1) % m.pts.length, od = plDim(m, k); m.dims = (m.dims || []).filter(d => !((d.a.p === a && d.b.p === b) || (d.a.p === b && d.b.p === a))); if (W.exact.L || !od) { if (W.exact.L) m.dims.push({id: od ? od.id : 'd' + Date.now().toString(36), a: {p: a}, b: {p: b}, v: r1(W.L)}); else if (od) m.dims.push(od); } }
    if (W.exact.H && !(+m.H > 0)) m.H = r1(W.H);
    try { gnFix(r); } catch (e) { }
    // фото — на стену: выпрямление по 4 углам (r.q: ЛН ПН ПВ ЛВ в px фото), до 1600 px как rfAdd
    const refs = []; const sb = await sGet('img', p.id).catch(() => null);
    if (sb && p.cor) { try { const j = await toJpeg(sb, 1600), rid = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kk = j.w / p.iw;
      await dbPut('img', j.blob, 'ref:' + rid);
      refs.push({id: rid, n: 1, iw: j.w, ih: j.h, w: W.H * j.w / j.h, x: W.L + Math.max(W.L, W.H) * .06, y: W.H, q: [p.cor[3], p.cor[2], p.cor[1], p.cor[0]].map(q => [r1(q[0] * kk), r1(q[1] * kk)]), qa: 1, qUser: 1, on: 1, found: [], t: Date.now(), name: 'скетч ' + (K.obj || '')}); } catch (e) { } }
    const old = (r.segs || {})[k]; if (old) { try { const o = await dbGet('sess', old); if (o) { o.del = Date.now(); o.delWhy = 'скетч: вид стены заменён'; await dbPut('sess', o); } } catch (e) { } }
    const ts = Date.now(), sid = 's' + ts.toString(36) + Math.random().toString(36).slice(2, 5);
    const o = {id: sid, obj: r.obj, name: r.name + ' · С' + wN(r, k), created: ts, upd: ts, frames: [], room: r.id, seg: k,
      q4: {L: W.L, H: W.H, ok: 1, fr: {}, blank: 1, aL: !W.exact.L, aH: !W.exact.H}, lines: {floor: [[0, 0], [W.L, 0]], left: [[0, 0], [0, W.H]], right: [[W.L, 0], [W.L, W.H]], ceil: [[0, W.H], [W.L, W.H]]}, la: {}, man: {}, wsh: {},
      els: W.els, notes: W.notes, und: [], dms: W.dms, drw: [], rts: [], polys: [], rulers: [], refs, labSketch: {obj: K.obj, photo: p.id}};
    await dbPut('sess', o); r.segs = r.segs || {}; r.segs[k] = sid; r.upd = Date.now(); await dbPut('sess', clone(r)); saveRoom();
    p.wall = {r: r.id, k, sid}; await saveNowSk();
    await openWall(k);
    // снимок вида стены для выгрузки (out), как после импорта v81: после сборки стены (q4 + фон, без пересчёта)
    for (let i = 0; i < 80; i++) { if (S.mosaic && S.q4 && S.q4.ok && !S.recomp && S.sess && S.sess.id === sid) { try { await saveNow(); } catch (e) { } const w = await dbGet('sess', sid).catch(() => null); if (w && w.out) break; } await new Promise(z => setTimeout(z, 75)); }
    try { say(`Стена С${wN(S.room0 || r, k)} создана: ${Math.round(W.L)} × ${Math.round(W.H)} · объектов ${W.els.length} · размеров ${W.dms.length}`); } catch (e) { }
    void keepOpen; return {room: r.id, k, sid};
  }
  api.createWall = createWall;

  /* ═══ [BLOCK SK-OPEN] открыть холст объекта / закрыть ═══ */
  function curObj() { return (S.room && S.room.obj) || (S.room0 && S.room0.obj) || (S.sess && S.sess.obj) || ((document.getElementById('nObj') || {}).value || '').trim(); }
  async function objects() { const all = (await dbAll('sess').catch(() => [])) || [], sk = (await sAll('sk').catch(() => [])) || []; return [...new Set([...sk.map(x => x.obj), ...all.filter(o => !o.del && o.obj).map(o => o.obj)])].filter(Boolean); }
  async function open(obj) {
    if (obj == null) obj = curObj();
    if (!obj) { const L = await objects(); dlg('Скетч объекта', `<label>Объект</label><input type="text" data-sk-o list="skObjL" value=""><datalist id="skObjL">${L.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`, [{t: 'Отмена'}, {t: 'Открыть', pr: 1, fn: B => { const v = B.querySelector('[data-sk-o]').value.trim(); if (v) open(v); else say('Введите объект'); }}]); show(); return; }
    await saveNowSk();
    const r = await sGet('sk', obj).catch(() => null);
    Object.assign(K, {obj, photos: (r && r.photos) || [], notes: (r && r.notes) || [], view: (r && r.view) || {ox: 20, oy: 110, s: 0.42}, sel: null, und: [], imgs: {}, pend: null, drag: null});
    show(); $s('[data-sk="obj"]').textContent = obj;
    for (const p of K.photos) { const b = await sGet('img', p.id).catch(() => null); if (b) await loadImg(p, b); }
    if (!r) await saveNowSk();
    tool(K.photos.length ? 'pan' : 'pan'); draw(); panel();
    return K;
  }
  function show() { K.open = true; root.hidden = false; document.body.classList.add('lab-sketch'); draw(); }
  function hide() { K.open = false; root.hidden = true; document.body.classList.remove('lab-sketch'); $s('.sk-dlg').classList.remove('on'); const i = document.getElementById('w3f'); if (i && i.dataset.sk) { FLD.k = null; delete i.dataset.sk; i.classList.remove('on'); } }
  async function close() { await saveNowSk(); hide(); try { draw0(); } catch (e) { } }
  const draw0 = () => { if (typeof window.draw === 'function') window.draw(); };
  api.open = open; api.close = close; api.isOpen = () => K.open;
  $s('[data-sk="close"]').onclick = close;
  $s('[data-sk="obj"]').onclick = async () => { const L = await objects(); dlg('Другой объект', `<label>Объект</label><input type="text" data-sk-o list="skObjL2" value="${esc(K.obj)}"><datalist id="skObjL2">${L.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`, [{t: 'Отмена'}, {t: 'Открыть', pr: 1, fn: B => { const v = B.querySelector('[data-sk-o]').value.trim(); if (v) open(v); }}]); };
  addEventListener('resize', () => { if (K.open) draw(); });
  addEventListener('measure-lab-settings', () => { if (K.open) draw(); });

  /* ═══ [BLOCK SK-ENTRY] вход: список замеров (рядом с «＋ Помещение») и меню «Ещё» ═══ */
  function entry() {
    const nw = document.querySelector('#ss .nw'); if (nw && !nw.querySelector('[data-sk-open]')) { const b = document.createElement('button'); b.dataset.skOpen = 'ss'; b.textContent = '✎ Скетч'; b.title = 'Скетч объекта: фото → чертёж стены → стена'; b.onclick = () => open((document.getElementById('nObj') || {}).value.trim() || null); nw.appendChild(b); }
    const mn = document.getElementById('zMenu'); if (mn && !mn.querySelector('[data-sk-open]')) { const b = document.createElement('button'); b.dataset.skOpen = 'menu'; b.textContent = '✎ Скетч объекта'; b.title = 'Скетч объекта: фото → чертёж стены → стена'; b.onclick = () => { mn.classList.remove('on'); open(); }; mn.insertBefore(b, mn.firstChild); }
  }
  entry();
})();
