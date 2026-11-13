/* Measure Lab 0.13 — правки по проверке 0.12. Координаты плана — мм эскиза. */
(() => {
  'use strict';
  const api = window.MeasureLab013 = {};
  const dpr = () => devicePixelRatio || 1;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const len = v => Math.hypot(v[0], v[1]);
  const dotp = (a, b) => a[0] * b[0] + a[1] * b[1];
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ═══ [BLOCK 13-SNAP] привязка прямоугольника к граням стен и прямому углу ═══ */
  // P — 4 точки прямоугольника, segs — [[a, b]], tol — мм. Возвращает {pts, hl: [[a,b]...], corner}.
  function snapBox(P, segs, tol) {
    const edges = P.map((a, i) => [a, P[(i + 1) % 4]]);
    const fits = (pts, skipU) => {
      const out = [];
      pts.map((a, i) => [a, pts[(i + 1) % 4]]).forEach(([a, b]) => {
        const el = len(sub(b, a)); if (el < 1) return;
        const eu = [(b[0] - a[0]) / el, (b[1] - a[1]) / el];
        for (const [p, q] of segs) {
          const sl = len(sub(q, p)); if (sl < 1) continue;
          const u = [(q[0] - p[0]) / sl, (q[1] - p[1]) / sl], n = [-u[1], u[0]];
          if (Math.abs(Math.abs(dotp(eu, u)) - 1) > 0.002) continue;          // грань параллельна стене
          if (skipU && Math.abs(dotp(u, skipU)) > 0.05) continue;              // вторая — перпендикулярная
          const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], gap = dotp(sub(m, p), n);
          if (Math.abs(gap) >= tol) continue;
          const t0 = dotp(sub(a, p), u), t1 = dotp(sub(b, p), u);                // перекрытие по длине стены
          if (Math.max(t0, t1) < -tol || Math.min(t0, t1) > sl + tol) continue;
          out.push({gap, n, u, seg: [p, q]});
        }
      });
      return out.sort((x, y) => Math.abs(x.gap) - Math.abs(y.gap))[0] || null;
    };
    void edges;
    const shift = (pts, v) => pts.map(x => [x[0] + v[0], x[1] + v[1]]);
    const f1 = fits(P); if (!f1) return {pts: P, hl: []};
    let pts = shift(P, [-f1.n[0] * f1.gap, -f1.n[1] * f1.gap]);
    const f2 = fits(pts, f1.u), hl = [f1.seg];
    let corner = null;
    if (f2) {
      pts = shift(pts, [-f2.n[0] * f2.gap, -f2.n[1] * f2.gap]); hl.push(f2.seg);
      corner = pts.reduce((b, x) => {
        const d = Math.abs(dotp(sub(x, f1.seg[0]), f1.n)) + Math.abs(dotp(sub(x, f2.seg[0]), f2.n));
        return !b || d < b.d ? {x, d} : b;
      }, null).x;
    }
    return {pts: pts.map(x => x.map(Math.round)), hl, corner};
  }
  api.snapBox = snapBox;
  function allSegs() {
    const out = [];
    for (const r of f81Rooms()) { const m = r.ms; if (!m || !m.pts) continue; for (let k = 0; k < plN(m); k++) out.push(plSeg(m, k)); }
    return out;
  }
  const tolMm = () => dpr() * (WS.R || 18) / S.view.s;

  /* ═══ [BLOCK 13-COLDRAG] перетаскивание колонны целиком пером/пальцем ═══ */
  const CD = api.drag = {g: null, hl: null};
  const colOk = q => q && (q.t === 'box' || q.t === 'col') && !q.auto && (q.pts || []).length >= 2;
  function revert(g) {
    g.q.pts = g.P0.map(x => x.slice());
    if (g.W0 !== undefined) g.q.W = g.W0; if (g.D0 !== undefined) g.q.D = g.D0;
    if (g.sn && S.pund.length) S.pund.pop();
  }
  function finish(g, cancel) {
    CD.g = null; CD.hl = null;
    if (cancel) { revert(g); draw(); return; }
    if (g.sn) { saveRoom(); mkPanel(); draw(); return; }
    // касание без сдвига — обычный выбор
    f81ShpSel({r: S.room, i: g.i});
  }
  cv.addEventListener('pointerdown', e => {
    if (CD.g) { if (e.pointerId !== CD.g.id) finish(CD.g, true); return; }        // второй палец — откат
    if (S.mode !== 'plan' || !PLA() || !S.room || ptr.size || F81.hd) return;
    if (PEN.on() && e.pointerType === 'touch') return;
    const d = dpr(), p = [e.offsetX * d, e.offsetY * d];
    if (f81ColFHit(p)) return;
    const h = f81ShpHit(p); if (!h || h.r !== S.room) return;
    const q = (S.room.ms.shp || [])[h.i]; if (!colOk(q)) return;
    const sel = S.zps && S.zps.t === 'shp' && S.zps.i === h.i;
    if (!sel && !['sel', 'shp'].includes(PL.tool)) return;
    e.stopImmediatePropagation(); try { cv.setPointerCapture(e.pointerId); } catch (x) { }
    CD.g = {q, i: h.i, id: e.pointerId, p0: p, a0: toPl(...p), P0: q.pts.map(x => x.slice()), W0: q.W, D0: q.D, sn: 0};
  }, true);
  cv.addEventListener('pointermove', e => {
    const g = CD.g; if (!g || g.id !== e.pointerId) return;
    e.stopImmediatePropagation();
    const d = dpr(), p = [e.offsetX * d, e.offsetY * d];
    if (!g.sn && Math.hypot(p[0] - g.p0[0], p[1] - g.p0[1]) < 6 * d) return;
    if (!g.sn) { plSnap(); g.sn = 1; S.zps = {t: 'shp', i: g.i}; S.psel = null; }
    const a = toPl(...p), v = [a[0] - g.a0[0], a[1] - g.a0[1]];
    let pts = g.P0.map(x => [Math.round(x[0] + v[0]), Math.round(x[1] + v[1])]);
    CD.hl = null;
    if (WS.mag && g.q.t === 'box' && pts.length === 4) {
      const s = snapBox(pts, allSegs(), tolMm());
      if (s.hl.length) { pts = s.pts; CD.hl = s; }
    }
    g.q.pts = pts; draw();
  }, true);
  const up = e => { const g = CD.g; if (!g || g.id !== e.pointerId) return; e.stopImmediatePropagation(); finish(g, e.type === 'pointercancel'); };
  cv.addEventListener('pointerup', up, true); cv.addEventListener('pointercancel', up, true);
  // смена инструмента/режима во время протяжки — откат без шага отмены
  for (const n of ['plPick', 'tool']) if (typeof window[n] === 'function') {
    const f = window[n]; window[n] = function () { if (CD.g) finish(CD.g, true); return f.apply(this, arguments); };
  }

  /* ═══ [BLOCK 13-CORNER] привязка угла при растягивании за маркер ═══ */
  // Встроенная ручка F81 берёт точку через toPl — на время её протяжки угол
  // притягивается к линии стены (или к пересечению двух стен).
  let rsz = false;
  window.addEventListener('pointermove', e => { rsz = !!(F81.hd && WS.mag && e.pointerId === F81.hd.id); if (rsz) setTimeout(() => { rsz = false; }, 0); }, true);
  const toPlBase = toPl;
  toPl = function () {
    const q = toPlBase.apply(this, arguments);
    if (!rsz || !F81.hd) return q;
    const tol = tolMm(), hits = [];
    for (const [a, b] of allSegs()) {
      const l = len(sub(b, a)); if (l < 1) continue;
      const u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], n = [-u[1], u[0]], gap = dotp(sub(q, a), n), t = dotp(sub(q, a), u);
      if (Math.abs(gap) < tol && t > -tol && t < l + tol) hits.push({a, u, n, gap});
    }
    hits.sort((x, y) => Math.abs(x.gap) - Math.abs(y.gap));
    if (!hits.length) { CD.hl = null; return q; }
    const h1 = hits[0], h2 = hits.find(h => Math.abs(dotp(h.u, h1.u)) < 0.05);
    let r = [q[0] - h1.n[0] * h1.gap, q[1] - h1.n[1] * h1.gap];
    if (h2) { const g2 = dotp(sub(r, h2.a), h2.n); r = [r[0] - h2.n[0] * g2, r[1] - h2.n[1] * g2]; }
    CD.hl = {hl: [h1, h2].filter(Boolean).map(h => [h.a, [h.a[0] + h.u[0], h.a[1] + h.u[1]]]), corner: h2 ? r : null, line: 1};
    return r;
  };
  const hdUp = () => { if (CD.hl && CD.hl.line) { CD.hl = null; setTimeout(draw, 0); } };
  cv.addEventListener('pointerup', hdUp); cv.addEventListener('pointercancel', hdUp);

  /* ═══ [BLOCK 13-HL] подсветка зоны привязки ═══ */
  function drawHl() {
    const s = CD.hl; if (!s || !s.hl || !s.hl.length) return;
    const d = dpr(); cx.save(); cx.strokeStyle = '#00A0E0'; cx.lineWidth = 5 * d; cx.globalAlpha = 0.85; cx.lineCap = 'round';
    for (const [a, b] of s.hl) {
      let A = a, B = b;
      if (s.line) { const u = sub(b, a), far = 1e6; A = [a[0] - u[0] * far, a[1] - u[1] * far]; B = [a[0] + u[0] * far, a[1] + u[1] * far]; }
      const P = toScr(...A), Q = toScr(...B); cx.beginPath(); cx.moveTo(...P); cx.lineTo(...Q); cx.stroke();
    }
    if (s.corner) { const c = toScr(...s.corner); cx.fillStyle = '#00A0E0'; cx.beginPath(); cx.arc(c[0], c[1], 7 * d, 0, 7); cx.fill(); }
    cx.restore();
  }
  { const z0 = zpDraw; zpDraw = function () { const r = z0.apply(this, arguments); try { drawHl(); } catch (e) { } return r; }; }

  /* ═══ [BLOCK 13-W3PLAN] поля колонн/ниш плана на развёртке — вводимые ═══ */
  // v81: объём из плана (v.plan) — «справочно». 0.13: отступ, ширина, глубина правят план.
  function planVolOf(l) {
    const Md = w3Model(); if (!Md) return null;
    const VV = w3Vols(Md);
    if (l.b === 'seg' || l.a === 'seg') {
      const cut = VV.filter(v => v.D > 0 && (l.a === 'A' || l.b === 'B' ? v.y1 > Md.H - 1 : v.y0 < 1)); if (!cut.length) return null;
      if (l.b === 'seg') { const v = cut.find(q => Math.abs(q.x0 - l.x1) < 1) || cut[0]; return v.plan ? {Md, v, t: 'off', side: 0, val: l.x1 - l.x0} : null; }
      const v = cut.find(q => Math.abs(q.x1 - l.x0) < 1) || cut[cut.length - 1]; return v.plan ? {Md, v, t: 'off', side: 1, val: l.x1 - l.x0} : null;
    }
    const v = VV.find(q => l.a.startsWith(q.id)); if (!v || !v.plan) return null;
    const a = l.a.slice(v.id.length), b = l.b.slice(v.id.length);
    if (/^K/.test(a) && /^K/.test(b)) return a[2] === b[2] ? {Md, v, t: 'el', ax: 'W', val: v.x1 - v.x0} : {Md, v, t: 'el', ax: 'H', val: v.y1 - v.y0};
    return {Md, v, t: 'el', ax: 'D', val: Math.abs(v.D)};
  }
  function planRef(id) {   // 'p'+[roomId+'_']+i — колонна; 'pn'+i — ниша плана своего помещения
    const rooms = [S.room0, ...(S.objRooms || []).filter(o => !o.pstub && o.ms && o.id !== S.room0.id)];
    if (/^pn\d+$/.test(id)) return {r: S.room0, i: +id.slice(2), niche: 1};
    const body = id.slice(1);
    for (const r of rooms.slice(1)) if (body.startsWith(r.id + '_')) return {r, i: +body.slice(r.id.length + 1)};
    return /^\d+$/.test(body) ? {r: S.room0, i: +body} : null;
  }
  api.planRef = planRef;
  const w3K0 = w3FKind;
  w3FKind = function (l) {
    const k = w3K0.apply(this, arguments);
    if (!k || k.t !== 'ref') return k;
    let pv = null; try { pv = planVolOf(l); } catch (e) { pv = null; }
    if (!pv) return k;
    if (pv.t === 'el' && pv.ax === 'H') return {t: 'ref', why: 'col-h'};
    return {t: 'pvol', id: pv.v.id, f: pv.t === 'off' ? 'off' : pv.ax, side: pv.side, v: pv.val};
  };
  { const o0 = w3FOpen; w3FOpen = function (l) {
    const k = w3FKind(l);
    if (k && k.t === 'ref' && k.why === 'col-h') { toast('Колонна плана — во всю высоту помещения'); return; }
    return o0.apply(this, arguments);
  }; }
  function applyPlanVol(k, n) {
    const ref = planRef(k.id); if (!ref) return false;
    const Md = w3Model(); if (!Md) return false;
    const r = ref.r, m = r.ms, q = (m.shp || [])[ref.i]; if (!q) return false;
    const ax = Md.ax, L = Md.L;
    if (ref.niche) {
      const pl = plLen(m, Md.k);
      let j = -1; for (let x = 0; x < plN(m); x++) if ((r.wid || {})[x] === q.w) j = x;
      if (j < 0) return false;
      const [A, B] = plSeg(m, j), Ls = len(sub(B, A)) || 1, Lr = pl && pl.v ? pl.v : Ls, k2 = Lr / Ls, s2 = L / Lr;
      if (k.f === 'W') q.nw = r1(n);
      else if (k.f === 'D') q.nd = r1(n);
      else { const dx = k.side ? k.v - n : n - k.v; q.c = q.c + (plFlip(m, j) ? -1 : 1) * dx / (k2 * s2); }
      return true;
    }
    if (q.t !== 'box' || (q.pts || []).length < 3) return false;
    // Любой контур выступа (в т.ч. авто-уступ из общих стен): сдвиг/растяжение в осях стены.
    const sc = f81VSc(S.room0.ms, Md.k, L);                       // мм стены на мм эскиза
    const toLoc = p => [dotp(sub(p, ax.Lp), ax.u), dotp(sub(p, ax.Lp), ax.n)];
    const fromLoc = ([x, z]) => [Math.round(ax.Lp[0] + ax.u[0] * x + ax.n[0] * z), Math.round(ax.Lp[1] + ax.u[1] * x + ax.n[1] * z)];
    const loc = q.pts.map(toLoc), xs = loc.map(p => p[0]), zs = loc.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), zw = Math.min(...zs), zf = Math.max(...zs);
    const rect = q.pts.length === 4, along = rect && Math.abs(dotp(sub(q.pts[1], q.pts[0]), ax.u)) > 0.7 * (len(sub(q.pts[1], q.pts[0])) || 1);
    let f = p => p;
    if (k.f === 'off') {
      const dx = (k.side ? k.v - n : n - k.v) / sc;
      if ((x0 + dx) * sc < -0.5 || (x1 + dx) * sc > L + 0.5) { toast('Выступ за краем стены'); return false; }
      f = ([x, z]) => [x + dx, z];
    } else if (k.f === 'W') {
      const w0 = x1 - x0, w = n / sc; if (!(w0 > 0)) return false; if (n > L + 0.5) { toast('Ширина больше длины стены'); return false; }
      const right = x1 * sc > L - 30 && x0 * sc > 30, o = right ? x1 : x0;   // у правого края стены — правый край на месте
      f = ([x, z]) => [o + (x - o) * w / w0, z];
      if (rect) q[along ? 'W' : 'D'] = r1(n);
    } else if (k.f === 'D') {
      // глубина показывается от линии стены без масштаба длины (w3Vols: D = max z) — так же и вводится; сторона у стены на месте
      if (!(zf - zw > 0) || !(n > zw)) { toast('Глубина меньше зазора от стены'); return false; }
      f = ([x, z]) => [x, zw + (z - zw) * (n - zw) / (zf - zw)];
      if (rect) q[along ? 'D' : 'W'] = r1(n);
    }
    q.pts = loc.map(f).map(fromLoc);
    return true;
  }
  api.applyPlanVol = applyPlanVol;
  const w3S0 = w3FSet;
  w3FSet = function (k, n) {
    if (!k || k.t !== 'pvol') return w3S0.apply(this, arguments);
    if (!(n >= 0) || (k.f !== 'off' && !(n > 0))) return;
    const ref = planRef(k.id); if (!ref) return;
    const r = ref.r, before = clone(r.ms.shp || []);
    if (!applyPlanVol(k, n)) { r.ms.shp = before; return; }
    const after = clone(r.ms.shp || []);
    const put = s => { r.ms.shp = clone(s); patchHist(r, ref.i); persist(r); mkPanel(); draw(); };
    patchHist(r, ref.i);
    const key = 'ZA:' + (++zaN); ZA.set(key, {u: () => put(before), r: () => put(after)}); S.und.push(key); S.red = []; zLay();
    persist(r); mkPanel(); draw();
  };
  // История плана (S.pund и сохранённая r.und) — снимки всего холста. Правка с развёртки вносится в каждый снимок
  // этого помещения по id объекта: ↶ на плане отменяет только шаги плана и не стирает введённое на развёртке.
  function patchHist(r, i) {
    const q = (r.ms.shp || [])[i]; if (!q) return;
    const fix = str => { try { const o = JSON.parse(str); if (o.id !== r.id || !o.ms) return str; const L = o.ms.shp || [];
      const j = q.id ? L.findIndex(x => x && x.id === q.id) : (L[i] && L[i].t === q.t ? i : -1); if (j < 0) return str;
      L[j] = {...L[j], pts: q.pts, ...(q.W != null ? {W: q.W} : {}), ...(q.D != null ? {D: q.D} : {}), ...(q.nw != null ? {nw: q.nw, nd: q.nd, c: q.c} : {})};
      return JSON.stringify(o); } catch (e) { return str; } };
    for (const t of S.pund || []) if (t && t.cv && t.R && t.R[r.id]) t.R[r.id] = fix(t.R[r.id]);
    if (r.und && r.und.v === 81 && Array.isArray(r.und.S)) r.und.S = r.und.S.map(fix);
  }
  api.patchHist = patchHist;
  function persist(r) {
    if (r === S.room) saveRoom();
    else dbPut('sess', clone(r)).catch(() => { });
  }

  /* ═══ [BLOCK 13-WALLOBJ] объекты стены: выбор касанием в любом инструменте, посты по памяти ═══ */
  // 0.12: при активном инструменте касание другого объекта только снимало выделение.
  // 0.13: касание объекта выбирает его (и даёт тянуть); касание пустого — как в 0.4.
  if (window.MeasureLabPlacement) {
    const b0 = MeasureLabPlacement.begin;
    MeasureLabPlacement.begin = function (p) {
      try {
        if (false && S.mode !== 'plan' && S.tool === 'mk' && gest && ptr.size === 1 && KD[S.mk] && !KD[S.mk].line && !(rzOk() && RZT[RZ.t]) && S.sel) {   // 82.18 g2 (QA Д5): отключено — при инструменте объект выбирается только касанием выбранного (lab-placement), касание другого ставит объект
          const h = mkHit(p);
          if (h && h.id !== S.sel && S.els.some(e => e.id === h.id)) { S.sel = h.id; S.dsel = null; }
        }
      } catch (e) { }
      return b0.apply(this, arguments);
    };
  }
  // Посты розетки/выключателя: выбранное число запоминается и ставится следующим объектам того же вида.
  const POSTS_KEY = 'measure.lab13.posts';
  const posts = (() => { try { return JSON.parse(localStorage.getItem(POSTS_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  api.posts = posts;
  const bar0 = elBar81;
  elBar81 = function (pp, e) {
    const r = bar0.apply(this, arguments);
    pp.querySelectorAll('[data-e81n]').forEach(b => b.addEventListener('click', () => {
      posts[e.k] = +b.dataset.e81n; try { localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); } catch (x) { }
    }));
    return r;
  };
  const tap0 = mkTap;
  mkTap = function () {
    const n = S.els.length, res = tap0.apply(this, arguments), e = S.els[n];
    if (e && PST81[e.k] && posts[e.k] > 1 && !e.N) { e.N = posts[e.k]; e.st = 71; saveSess(); mkPanel(); draw(); }
    return res;
  };
})();
