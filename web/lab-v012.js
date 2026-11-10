/* Experimental plan rooms and wall rectangles. Coordinates are native plan mm. */
(() => {
  'use strict';
  const api = window.MeasureLab012 = {};
  const rooms = () => [S.room, ...S.objRooms].filter(r => r?.ms && !r.pstub);
  const walls = () => rooms().flatMap(r => Array.from({length: plN(r.ms)}, (_, k) =>
    ({r, k, id: r.wid?.[k], points: plSeg(r.ms, k)})));
  const dist = (a, b) => Math.hypot(...sub(a, b));
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const mix = (a, b, t) => add(a, sub(b, a), t);
  const edges = p => p.map((a, i) => [a, p[(i + 1) % p.length]]);
  const eps = 1e-6;
  const pixels = n => n * (devicePixelRatio || 1);
  const radius = () => pixels(WS.R) / S.view.s;
  const projection = (p, a, b) => {
    const v = sub(b, a);
    return mix(a, b, Math.min(1, Math.max(0, dot(sub(p, a), v) / (dot(v, v) || 1))));
  };
  function nearest(p, candidates, limit) {
    let best = null;
    for (const q of candidates) {
      const d = dist(p, q);
      if (d < limit) { best = q; limit = d; }
    }
    return best;
  }
  api.snapNode = (p, owner, i) => {
    const q = toPl(...p).map(Math.round);
    if (!WS.mag) return q;
    const m = owner.ms, n = m.pts.length;
    const excluded = new Set([i, i - 1, i + 1]);
    if (m.closed) { if (i === 0) excluded.add(n - 1); if (i === n - 1) excluded.add(0); }
    return (nearest(q, rooms().flatMap(r => r.ms.pts.filter((_, j) => r !== owner || !excluded.has(j))), radius()) || q).slice();
  };
  function planSnap(q) {
    if (!WS.mag) return q;
    const W = walls(), near = nearest(q, W.flatMap(w => w.points), radius());
    return (near || nearest(q, W.map(w => projection(q, ...w.points)), radius()) || q).slice();
  }

  // Place the first face on a nearby wall; a perpendicular incident wall at the
  // start/end gives the second face an exact shared corner.
  function column(a, b, segments, tolerance) {
    let match = null;
    for (const [p, q] of segments) {
      if (dist(p, q) < eps) continue;
      for (const [anchor, opposite, reverse] of [[a, b, false], [b, a, true]]) {
        const at = projection(anchor, p, q), gap = dist(at, anchor);
        if (gap >= tolerance) continue;
        const u = sub(q, p).map(v => v / dist(p, q)), v = [-u[1], u[0]];
        const corner = [p, q].find(c => dist(anchor, c) < tolerance && segments.some(([s, t]) =>
          dist(s, t) > eps && (dist(s, c) < eps || dist(t, c) < eps) &&
          Math.abs(dot(sub(t, s), u)) / dist(s, t) < 0.01));
        const score = gap + (corner ? 0 : tolerance);
        if (match && score >= match.score) continue;
        const o = corner || at, w = dot(sub(opposite, o), u), h = dot(sub(opposite, o), v);
        if (Math.abs(w) < 30 || Math.abs(h) < 30) continue;
        const P = [o, add(o, u, w), add(add(o, u, w), v, h), add(o, v, h)];
        match = {score, points: reverse ? [P[2], P[3], P[0], P[1]] : P};
      }
    }
    return match?.points;
  }
  api.column = column;
  const oldColumn = plzMake;
  plzMake = function(z, p) {
    if (z.k === 'shp' && WS.mag && !zo('shp').circ) {
      const pts = column(z.a, toPl(...p), walls().map(w => w.points), radius());
      if (pts) return {o: {t: 'box', pts, note: ''}};
    }
    return oldColumn.apply(this, arguments);
  };

  for (const k of ['zon', 'shield']) ZOPT[k].push('sn');
  const rect = e => e && (e.k === 'zon' || e.k === 'shield');
  const oldGeo = elGeo;
  elGeo = function(e) {
    const g = oldGeo.apply(this, arguments);
    if (rect(e)) g.D = e.D == null || e.D === '' ? '' : +e.D;
    return g;
  };
  api.flipEdges = (e, flip) => ({...e, x: flip && e.x ? (e.x === 'L' ? 'R' : 'L') : e.x});
  kIco = ((original) => function(k, c) {
    if (k === 'wire') return original('shch', c);
    if (k === 'shield') return '<svg width="28" height="28" viewBox="0 0 28 28"><rect x="5" y="4" width="18" height="20" rx="2" fill="none" stroke="#7b3fc4" stroke-width="2"/><path d="m15 8-5 7h4l-1 5 5-7h-4z" fill="#7b3fc4"/></svg>';
    return original.apply(this, arguments);
  })(kIco);
  function rectOffsets(e) {
    const E = wEnds(), g = elGeo(e, E.W, E.C), top = adimHc();
    return {g, E, top, L: E.L == null ? null : g.X - E.L,
      R: E.R == null ? null : E.R - g.X - g.W,
      F: E.W.floor ? g.Y : null, C: top > 0 ? top - g.Y - g.H : null};
  }
  function bindRect(e, axis, side, value) {
    const o = rectOffsets(e);
    if (o[side] == null || !Number.isFinite(value) || value < 0) return false;
    const {g} = o, delta = (side === 'R' || side === 'C' ? -1 : 1) * (value - o[side]);
    setOut(e, g.X + (axis === 'x' ? delta : 0), g.Y + (axis === 'y' ? delta : 0));
    e.labEdges = {...e.labEdges, [axis]: side, [axis + 'v']: r1(value)};
    return true;
  }
  function reapplyEdges(e) {
    for (const axis of ['x', 'y']) if (e.labEdges?.[axis])
      bindRect(e, axis, e.labEdges[axis], e.labEdges[axis + 'v']);
  }
  const oldWallSize = bwSet;
  bwSet = function() {
    const result = oldWallSize.apply(this, arguments);
    const bound = S.els.filter(e => rect(e) && e.labEdges);
    if (bound.length) {
      bound.forEach(reapplyEdges);
      saveSess(); mkPanel(); draw();
    }
    return result;
  };
  function snapRect(e) {
    if (!zo(e.k).sn) return;
    const o = rectOffsets(e), threshold = pixels(16) / S.view.s;
    for (const [axis, sides] of [['x', ['L', 'R']], ['y', ['F', 'C']]]) {
      const near = sides.filter(s => o[s] != null).sort((a, b) => Math.abs(o[a]) - Math.abs(o[b]))[0];
      if (near && Math.abs(o[near]) < threshold) bindRect(e, axis, near, 0);
    }
  }
  const wallTap = mkTap;
  mkTap = function() {
    const n = S.els.length, result = wallTap.apply(this, arguments);
    const e = S.els[n];
    if (rect(e)) { snapRect(e); saveSess(); mkPanel(); draw(); }
    return result;
  };
  const wallMove = mkDrag;
  mkDrag = function(g) {
    const result = wallMove.apply(this, arguments), e = S.els.find(x => x.id === g.edrag?.id);
    if (rect(e)) { delete e.labEdges; snapRect(e); draw(); }
    return result;
  };
  const wallResize = hDrag;
  hDrag = function() {
    const result = wallResize.apply(this, arguments), e = S.els.find(x => x.id === S.sel);
    if (rect(e)) { delete e.labEdges; snapRect(e); draw(); }
    return result;
  };
  function rectField(e, key, value) {
    if (!Number.isFinite(value) || value < 0 || (['W', 'H'].includes(key) && !value)) return;
    snap();
    const g = rectOffsets(e).g;
    if (key === 'D') e.D = r1(value);
    else if (key === 'W' || key === 'H') {
      e[key] = r1(value / (key === 'W' ? g.sx : g.sy));
      setOut(e, g.X, g.Y);
      reapplyEdges(e);
    } else bindRect(e, key === 'L' || key === 'R' ? 'x' : 'y', key, value);
    if (e.apx) delete e.apx[key];
    delete e.cand;
    elFollow(e.id); unsnap(); saveSess(); mkPanel(); status(); draw();
  }
  api.rectField = rectField;
  const oldBar = elBar81;
  elBar81 = function(pp, e) {
    const result = oldBar.apply(this, arguments);
    if (!rect(e)) return result;
    const o = rectOffsets(e), row = document.createElement('div');
    row.className = 'row lab12-fields';
    const labels = {W: 'Ширина', H: 'Высота', D: 'Глубина Z', L: 'От левого', R: 'От правого', F: 'От пола', C: 'От потолка'};
    for (const [key, value] of Object.entries({W: o.g.W, H: o.g.H, D: o.g.D, L: o.L, R: o.R, F: o.F, C: o.C})) {
      if (value == null) continue;
      const l = document.createElement('label'), i = document.createElement('input');
      i.inputMode = 'decimal'; i.dataset.lab12Size = key; i.value = value === '' ? '' : r1(value);
      i.onchange = () => {
        const n = evalN(i.value.trim());
        if (i.value.trim() && n != null && n >= 0 && (!['W', 'H'].includes(key) || n > 0)) rectField(e, key, n);
        else i.value = value;
      };
      l.textContent = labels[key] + ' · мм'; l.append(i); row.append(l);
    }
    pp.append(row); return result;
  };

  function intersection(a, b, c, d) {
    const u = sub(b, a), v = sub(d, c), den = cross(u, v);
    if (Math.abs(den) < eps) return null;
    const t = cross(sub(c, a), v) / den, s = cross(sub(c, a), u) / den;
    return t >= -eps && t <= 1 + eps && s >= -eps && s <= 1 + eps ? mix(a, b, t) : null;
  }
  function simple(p) {
    if (p.length < 3 || Math.abs(plArea({pts: p})) < 100 || p.some(q => !q.every(Number.isFinite))) return false;
    const E = edges(p);
    return E.every(([a, b], i) => dist(a, b) > eps && E.every(([c, d], j) => {
      if (j <= i + 1 || (i === 0 && j === E.length - 1)) return true;
      return !intersection(a, b, c, d) && ![a, b].some(q => dist(q, projection(q, c, d)) < eps)
        && ![c, d].some(q => dist(q, projection(q, a, b)) < eps);
    }));
  }
  function overlaps(p, q) {
    const A = edges(p), B = edges(q), cuts = [...p, ...q].map(v => v[0]);
    for (const a of A) for (const b of B) {
      const x = intersection(...a, ...b);
      if (x) cuts.push(x[0]);
    }
    cuts.sort((a, b) => a - b);
    const intervals = (E, x) => E.filter(([a, b]) => x > Math.min(a[0], b[0]) && x < Math.max(a[0], b[0]))
      .map(([a, b]) => mix(a, b, (x - a[0]) / (b[0] - a[0]))[1]).sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      if (cuts[i] - cuts[i - 1] < eps) continue;
      const x = (cuts[i - 1] + cuts[i]) / 2, a = intervals(A, x), b = intervals(B, x);
      for (let j = 0, k = 0; j + 1 < a.length && k + 1 < b.length;) {
        if (Math.min(a[j + 1], b[k + 1]) - Math.max(a[j], b[k]) > eps) return true;
        if (a[j + 1] < b[k + 1]) j += 2; else k += 2;
      }
    }
    return false;
  }
  api.overlaps = overlaps;
  const regions = () => rooms().flatMap(r => (r.ms.labRooms || []).map(q => ({r, q})));
  const dividers = () => rooms().flatMap(r => (r.ms.labDividers || []).map(q => ({r, q})));
  const nativeRegions = () => rooms().filter(r => r.ms.closed && r.ms.pts.length > 2 && !r.ms.labWallBase);
  api.blocksNative = (P, skip) => nativeRegions().some(r => r !== skip && overlaps(P, r.ms.pts))
    || regions().some(({q}) => overlaps(P, q.pts));
  /* ── AKX-2026-0010 Д3/Д8/Д10: зона — область ВНУТРИ физического помещения.
     Владелец зоны — замкнутое помещение, в котором лежит её внутренняя точка (иначе активное помещение,
     даже без стен). Зона не может перекрывать другую зону и заходить в другое (чужое) помещение;
     собственный контур помещения ей не мешает — кнопка «Разделить исходный контур» для этого больше не нужна. ── */
  const ZONE = 'Зона';
  const closedRooms = () => rooms().filter(r => r.ms.closed && r.ms.pts.length > 2);
  function interior(P) {
    if (!P || P.length < 3) return null;
    let a = 0, cx0 = 0, cy0 = 0;
    for (const [p, q] of edges(P)) { const c = cross(p, q); a += c; cx0 += (p[0] + q[0]) * c; cy0 += (p[1] + q[1]) * c; }
    if (Math.abs(a) > eps) { const c = [cx0 / (3 * a), cy0 / (3 * a)]; if (inPoly(c, P)) return c; }
    const Y = P.map(p => p[1]), y0 = Math.min(...Y), y1 = Math.max(...Y);
    for (const t of [0.5, 0.25, 0.75, 0.1, 0.9, 0.37, 0.63]) {
      const y = y0 + (y1 - y0) * t, xs = [];
      for (const [p, q] of edges(P)) if ((p[1] > y) !== (q[1] > y)) xs.push(p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]));
      xs.sort((u, v) => u - v);
      for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 1) return [(xs[i] + xs[i + 1]) / 2, y];
    }
    return null;
  }
  api.interior = interior;
  const zoneOwner = P => { const c = interior(P); return c && closedRooms().find(r => inPoly(c, r.ms.pts)); };
  const clashes = (P, owner, skip) => regions().some(({q}) => q.id !== skip && overlaps(P, q.pts)) ? 'zone'
    : closedRooms().some(r => r !== owner && overlaps(P, r.ms.pts)) ? 'room' : '';
  /* ── AKX-2026-0010 + AKX-2026-0012 §7: номер зоны zn («З1…») — постоянный, уникален по проекту (все помещения
     объекта), не переиспользуется. Счётчик — ms.labZnHi помещения-владельца (максимум по объекту); если модуль
     проектов даёт MeasureLabStore.znNext (P.znHi), берётся больший. Состав зоны walls — постоянные ID стен r.wid[k]. ── */
  const znHi = () => Math.max(0, ...rooms().map(r => +r.ms.labZnHi || 0), ...regions().map(({q}) => +q.zn || 0));
  function znNext(owner) {
    const ext = window.MeasureLabStore?.znNext;
    const z = Math.max(typeof ext === 'function' ? +ext(owner) || 0 : 0, znHi() + 1);
    owner.ms.labZnHi = z;
    return z;
  }
  const zoneLabel = q => /^Зона \d+$/.test(q.name) || !q.zn ? q.name : ZONE + ' ' + q.zn + ' · ' + q.name;
  /* зоны 0.12 без zn получают номер при первом показе плана (порядок помещений и зон сохраняется) */
  function znFix() {
    const touched = new Set();
    for (const {r, q} of regions()) if (!(+q.zn > 0)) { q.zn = znNext(r); touched.add(r); }
    for (const r of touched) persist(r);
  }
  const host = () => S.room.ms.pts.length >= 2 ? S.room : rooms().find(r => r.ms.pts.length >= 2);
  function persist(owner) {
    saveRoom();
    if (owner !== S.room) dbPut('sess', JSON.parse(JSON.stringify(owner))).catch(error => {
      console.error(error); toast('Не удалось сохранить помещение');
    });
  }
  function store(owner) { persist(owner); draw(); }
  let mode = '', draft = [], selected = null, selectedDivider = null, edit = null, shift = null;
  let canvasId = null, active = false;
  const selection = () => regions().find(({q}) => q.id === selected);
  const nativeSelection = () => ({r: S.room, native: true, q: {walls: S.room.ms.labAssigned || []}});
  const dividerSelection = () => dividers().find(({q}) => q.id === selectedDivider);
  /* AKX-2026-0010 Д3/Д8/Д10: владелец по положению, проверка только зона↔зона и зона↔чужое помещение,
     имя «Зона N», src — способ построения ('fill' | 'image' | 'manual') для «Перезалить» и контроля Д7. */
  function region(P, target, src) {
    const owner = target?.r || zoneOwner(P) || host() || S.room;
    if (!simple(P)) return toast('Нужен контур без пересечений');
    const clash = clashes(P, owner, target?.q.id);
    if (clash) return toast(clash === 'zone' ? 'Зона перекрывает другую зону' : 'Зона заходит в другое помещение');
    plSnap();
    if (target) { target.q.pts = P; if (src) target.q.src = src; }
    else {
      const zn = znNext(owner), q = {id: crypto.randomUUID(), zn, name: ZONE + ' ' + zn, pts: P, walls: [], ...(src ? {src} : {})};
      (owner.ms.labRooms ||= []).push(q);
      selected = q.id; selectedDivider = null;   /* AKX-2026-0010: одно выделение в панели */
    }
    mode = 'pick'; draft = []; edit = null; store(owner);
    return true;
  }
  /* AKX-2026-0010 Д2: удаление зоны (кнопка панели и корзина), один шаг ↶. */
  function removeZone(z) {
    if (!z) return;
    plSnap();
    z.r.ms.labRooms = (z.r.ms.labRooms || []).filter(q => q !== z.q);
    if (selected === z.q.id) selected = null;
    store(z.r); toast('«' + z.q.name + '» удалена · ↶ — вернуть');
    return true;
  }
  function removeDivider(sep) {
    if (!sep) return;
    plSnap(); sep.r.ms.labDividers = sep.r.ms.labDividers.filter(q => q !== sep.q);
    selectedDivider = null; store(sep.r);
    return true;
  }
  api.removeZone = id => removeZone(regions().find(({q}) => q.id === id));
  function divider(A, B, target) {
    const owner = target?.r || host();
    if (!owner || dist(A, B) < 20) return toast('Укажите два конца границы');
    plSnap();
    if (target) target.q.pts = [A, B];
    else {
      const q = {id: crypto.randomUUID(), pts: [A, B]};
      (owner.ms.labDividers ||= []).push(q); selectedDivider = q.id; selected = null;
    }
    mode = 'pick'; edit = null; draft = []; store(owner);
    return true;
  }
  function chooseWall(p) {
    const q = toPl(...p);
    let best = null, gap = pixels(18) / S.view.s;
    for (const w of walls()) {
      const d = dist(q, projection(q, ...w.points));
      if (d < gap) { best = w; gap = d; }
    }
    return best;
  }
  function assign(target, w) {
    if (!target || !w?.id) return;
    plSnap();
    const list = new Set(target.q.walls);
    if (list.has(w.id)) list.delete(w.id); else list.add(w.id);
    if (target.native) target.r.ms.labAssigned = [...list];
    else target.q.walls = [...list];
    store(target.r);
    return true;
  }
  function rasterRegion(q, W, H, free) {
    const [x, y] = q.map(Math.floor);
    if (x < 0 || y < 0 || x >= W || y >= H || !free[y * W + x]) return null;
    const reg = new Uint8Array(W * H), queue = new Int32Array(W * H);
    let i = 0, n = 1;
    reg[y * W + x] = 1; queue[0] = y * W + x;
    while (i < n) {
      const j = queue[i++], c = j % W, r = j / W | 0;
      if (!c || c === W - 1 || !r || r === H - 1) return null;
      for (const k of [j - 1, j + 1, j - W, j + W]) {
        if (free[k] && !reg[k]) { reg[k] = 1; queue[n++] = k; }
      }
    }
    return n >= 16 ? reg : null;
  }
  function fill(q, underlay) {
    const D = dividers().map(({q}) => q.pts);
    const W0 = walls().map(w => w.points);
    let W, H, free, toGrid, toWorld, cell;
    if (underlay && ulGet() && UL.c) {
      const u = ulGet().ul, M = ulMasks(); cell = u.s;
      ({W, H} = M);
      free = ulFree().slice();
      toGrid = p => [(p[0] - u.x0) / u.s, (u.y0 - p[1]) / u.s];
      toWorld = p => [u.x0 + p[0] * u.s, u.y0 - p[1] * u.s];
    } else {
      const P = [...W0, ...D].flat();
      if (!P.length) return null;
      const X = P.map(p => p[0]), Y = P.map(p => p[1]);
      const step = cell = Math.max(2, (Math.max(...X) - Math.min(...X)) / 1000, (Math.max(...Y) - Math.min(...Y)) / 1000);
      const x = Math.min(...X) - step * 5, y = Math.min(...Y) - step * 5;
      W = Math.ceil((Math.max(...X) - x) / step) + 5;
      H = Math.ceil((Math.max(...Y) - y) / step) + 5;
      free = new Uint8Array(W * H).fill(1);
      toGrid = p => [(p[0] - x) / step, (p[1] - y) / step];
      toWorld = p => [x + p[0] * step, y + p[1] * step];
      D.push(...W0);
    }
    const blocked = new Uint8Array(W * H);
    for (const [a, b] of D) stRaster(blocked, W, H, {a: toGrid(a), b: toGrid(b), th: 3});
    for (let i = 0; i < free.length; i++) if (blocked[i]) free[i] = 0;
    const mask = rasterRegion(toGrid(q), W, H, free);
    if (!mask) return null;
    const out = ulDP(ulTrace(mask, W, H), 2).map(toWorld);
    out.cell = cell;   /* AKX-2026-0010 Д7: размер ячейки — допуск сравнения при контроле устаревших зон */
    return out;
  }
  api.fill = fill;
  api.region = region;
  api.divider = divider;
  api.regions = regions;
  api.walls = walls;
  api.assign = assign;
  function fillTap(q, underlay, target) {
    const present = regions().find(x => inPoly(q, x.q.pts));
    if (present && !target) { selected = present.q.id; mode = 'pick'; draw(); return; }
    /* AKX-2026-0010 Д8: без стен и границ — понятный отказ вместо «выходит наружу» */
    if (!(underlay && ulGet()) && !walls().length && !dividers().length)
      return toast('Нет стен и границ: постройте стены или задайте зону «Контуром»');
    const P = fill(q, underlay);
    if (!P) return toast('Заливка выходит наружу: добавьте границу от стены до стены');
    return region(P, target, underlay ? 'image' : 'fill');
  }
  let nativeFilling = false;
  const oldFill = ulTap;
  /* AKX-2026-0010 Д1: штатное «⌂ по плану» не перехватывается. Заливка зоны по фото — только пока
     открыта панель «Зоны» (её режим; выбор ⌂ панель закрывает, см. plPick). */
  ulTap = async function(p) {
    if (nativeFilling) return;
    if (active && mode && S.mode === 'plan') return fillTap(toPl(...p), true, mode === 'image' ? edit : null);
    try {
      nativeFilling = true;
      return await oldFill.apply(this, arguments);
    } finally { nativeFilling = false; }
  };
  function shiftWall(r, k, delta) {
    if (k >= plN(r.ms) || Math.hypot(...delta) < eps) return;
    const m = r.ms, next = (k + 1) % m.pts.length;
    const proposed = m.pts.map((p, i) => i === k || i === next ? add(p, delta).map(Math.round) : p);
    if (proposed.some((p, i) => i && dist(p, proposed[i - 1]) < eps)
      || (m.closed && (!simple(proposed) || closedRooms().some(o => o !== r && overlaps(proposed, o.ms.pts)))))
      return toast('Сдвиг пересекает контур или соседнее помещение');   /* AKX-2026-0010 Д3: зоны внутри помещения сдвигу не мешают (Д7 — отметка) */
    plSnap(); m.pts = proposed; m.labManualWalls = true;
    store(r); return true;
  }
  api.shiftWall = shiftWall;
  function tapPlan(p) {
    const q = toPl(...p), at = planSnap(q.map(Math.round));
    if (mode === 'assign') return assign(selection() || nativeSelection(), chooseWall(p));
    if (mode === 'manual' || mode === 'divider') {
      if (mode === 'divider' && draft.length) return divider(draft[0], at, edit);
      if (mode === 'manual' && draft.length >= 3 && dist(at, draft[0]) < radius()) return region(draft, edit, 'manual');
      if (!draft.length || dist(draft.at(-1), at) > eps) draft.push(at);
      return draw();
    }
    if (mode === 'fill' || mode === 'image') return fillTap(q, mode === 'image', edit);
    if (mode === 'shift') {
      const delta = sub(q, shift.from);
      if (shiftWall(shift.r, shift.k, delta)) { mode = ''; shift = null; draw(); }
      return;
    }
    selected = regions().find(({q: r}) => inPoly(q, r.pts))?.q.id || null;
    selectedDivider = dividers().find(({q: r}) => dist(q, projection(q, ...r.pts)) < pixels(12) / S.view.s)?.q.id || null;
    draw();
  }
  const priorTap = plTap, priorFinger = zTapSel, priorLabel = labDown;
  plTap = function(p) {
    if (S.mode === 'plan' && mode) return tapPlan(p);
    return priorTap.apply(this, arguments);
  };
  /* AKX-2026-0010 Д4: правило пера v81 сохранено — при обнаруженном пере палец двигает вид, касание пальцем —
     только выбор (zTapSel), ⌂ — касанием пальца (v32). Поэтому пальцем: выбор зоны, выбор стен зоны, заливка
     (аналог ⌂). Точки «Контура», «Границы», «Сдвига» ставит только перо — касание пальцем даёт подсказку, а не молчит. */
  const FINGER = {pick: 1, assign: 1, fill: 1, image: 1};
  zTapSel = function(p) {
    if (S.mode === 'plan' && mode) {
      if (FINGER[mode]) return tapPlan(p);
      return toast('Точки ставит перо · палец двигает вид');
    }
    return priorFinger.apply(this, arguments);
  };
  labDown = function(p) {
    if (mode) return false;
    return priorLabel.apply(this, arguments);
  };
  const priorRetrace = ulRetrace;
  ulRetrace = function() {
    if (S.room?.ms.labManualWalls || dividers().length || S.room?.ms.labWallBase || (S.room?.ms.labRooms || []).length) return Promise.resolve(0);   /* AKX-2026-0010: зоны фиксируют стены */
    return priorRetrace.apply(this, arguments);
  };
  function markWallEdit(fn) {
    return function() {
      const r = S.room;
      if (r?.ms.ul) r.ms.labManualWalls = true;
      return fn.apply(this, arguments);
    };
  }
  ctAddNode = markWallEdit(ctAddNode);
  ctDelNode = markWallEdit(ctDelNode);
  ctOpen = markWallEdit(ctOpen);
  function switchMode(next) {
    mode = next; draft = []; edit = null;
    if (mode) {
      S.zps = null;
      if (PL.tool !== 'sel') plPick('sel');
    }
    draw();
  }
  const priorPick = plPick;
  plPick = function(k) {
    if (k !== 'sel') { active = false; mode = ''; draft = []; edit = null; shift = null; }   /* AKX-2026-0010 Д12/Д1: другой инструмент закрывает панель «Зоны» */
    return priorPick.apply(this, arguments);
  };
  /* ── AKX-2026-0010 Д7: контроль устаревших зон. Зона из заливки (src 'fill' | 'image') пересчитывается от своей
     внутренней точки при каждом изменении стен/границ/подложки; если новый контур не совпадает со
     сохранённым — зона отмечается оранжевым «⟳» и предлагается «Перезалить». Формат не меняется. ── */
  let staleKey = '', staleIds = new Set();
  function sameShape(P, Q, tol) {
    const near = (A, B) => A.every(a => edges(B).some(([b, c]) => dist(a, projection(a, b, c)) <= tol));
    return near(P, Q) && near(Q, P);
  }
  function refreshStale() {
    const list = regions().filter(({q}) => q.src === 'fill' || q.src === 'image');
    const key = list.length ? JSON.stringify([walls().map(w => w.points), dividers().map(d => d.q.pts), !!(ulGet() && UL.c),
      list.map(({q}) => [q.id, q.src, q.pts])]) : '';
    if (key === staleKey) return;
    staleKey = key;
    const before = staleIds; staleIds = new Set();
    for (const {q} of list) {
      const c = interior(q.pts), P = c && fill(c, q.src === 'image');
      if (!P || !sameShape(P, q.pts, Math.max(30, 4 * (P.cell || 0)))) staleIds.add(q.id);
    }
    const fresh = list.filter(({q}) => staleIds.has(q.id) && !before.has(q.id)).map(({q}) => '«' + q.name + '»');
    if (fresh.length && active) toast('Стены или границы изменились: ' + fresh.join(', ') + ' — выберите и «Перезалить»');
  }
  api.stale = () => { refreshStale(); return [...staleIds]; };
  /* AKX-2026-0012: вход в зоны из холста — плитка футляра плана «Зона» (lab-tb, инженер C) вызывает open('pick'|'fill'|…) */
  api.open = (m = 'pick') => { if (S.mode !== 'plan' || !S.room) return false; active = true; switchMode(m); return true; };
  api.close = () => { active = false; switchMode(''); };
  api.isOpen = () => active;
  api.zoneLabel = zoneLabel;

  /* ── AKX-2026-0010 Д9: панель внизу, над штатной полосой #zf — не закрывает тосты, плашку угла и кнопки вида.
     Д6б: при открытой клавиатуре панель не исчезает, а сжимается в один прокручиваемый ряд (см. lab-v012.css). ── */
  const panel = document.createElement('div');
  panel.id = 'lab12-plan'; panel.hidden = true; document.body.append(panel);
  function place() {
    const zf = $('zf'), r = zf && getComputedStyle(zf).display !== 'none' ? zf.getBoundingClientRect() : null;
    const kb = document.body.classList.contains('kb');
    const bottom = r && r.height ? innerHeight - r.top + 6 : kb ? 208 : 56;
    panel.style.bottom = Math.max(8, Math.round(bottom)) + 'px';
  }
  new MutationObserver(place).observe(document.body, {attributes: true, attributeFilter: ['class']});
  addEventListener('resize', place);
  let lastPanel = '';
  function refreshPanel() {
    panel.hidden = S.mode !== 'plan' || !S.room || $('ss').classList.contains('on');
    if (panel.hidden) return;
    place();
    const key = S.room.obj || S.room.id;
    if (canvasId !== key) { canvasId = key; mode = ''; active = false; draft = []; selected = null; selectedDivider = null; edit = null; shift = null; }
    const hit = selection(), sep = dividerSelection(), wall = S.psel?.t === 's' ? S.psel.i : null;
    const state = JSON.stringify([key, S.room.id, S.room.ms.labAssigned, mode, active, draft.length, hit?.q, sep?.q, wall, S.room.ms.labWallBase,
      S.room.ms.labManualWalls, S.room.ms.ul, S.room.ms.closed, !!ulGet(), walls().map(w => w.id), [...staleIds], edit?.q.id]);
    if (state === lastPanel) return;
    lastPanel = state; panel.replaceChildren();
    const button = (label, fn, name, title) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn;
      if (name) b.dataset.lab12 = name;
      if (title) b.title = title;
      panel.append(b);
      return b;
    };
    /* Д10: сущность панели — «Зоны» (штатные помещения ⌂ называются «Помещение N») */
    button(active ? 'Закрыть зоны' : 'Зоны', () => {
      active = !active; switchMode(active ? 'pick' : '');
    }, 'toggle', 'Зоны внутри помещения: прихожая, кухня, ТВ-зона… — каждая уходит в конструктор отдельным листом');
    if (!active) return;
    if (!mode) {
      /* Д5: режим правки стен — явный возврат к зонам */
      button('← Зоны', () => switchMode('pick'), 'back');
      if (wall != null) {
        button('Сдвиг стены', () => {
          const r = S.room, [a, b] = plSeg(r.ms, wall);
          shift = {r, k: wall, from: mix(a, b, 0.5)}; switchMode('shift');
        }, 'shift');
        /* Д6а: после разбиения выбран первый из двух новых участков, а не узел */
        button('Разбить стену', () => { ctAddNode(wall); S.psel = {t: 's', i: wall}; mkPanel(); status(); draw(); }, 'split-wall');
        button('Удалить участок', () => zDelSel(), 'delete-wall');
      }
    } else if (mode !== 'shift' && mode !== 'assign') {
      button('Контур', () => switchMode('manual'), 'manual');
      button('Граница', () => switchMode('divider'), 'divider');
      button('Заливка стен', () => switchMode('fill'), 'fill');
      if (ulGet()) button('Заливка фото', () => switchMode('image'), 'image');
    }
    if (mode === 'manual' && draft.length >= 3) button('Готово', () => region(draft, edit, 'manual'), 'commit');
    /* Д11: «Отмена» в «Сдвиге» — обратно к выбранной стене */
    if (mode && mode !== 'pick' && mode !== 'assign') button('Отмена', () => {
      if (mode === 'shift') { shift = null; switchMode(''); } else switchMode('pick');
    }, 'cancel');
    /* Д3: зоны строятся в замкнутой комнате сразу. Кнопка осталась только для распознанного по фото контура
       и делает то, что написано: запрещает перестройку стен по фото (labWallBase). */
    if (mode === 'pick' && S.room.ms.closed && S.room.ms.ul && !S.room.ms.labWallBase && !S.room.ms.labManualWalls) button('Зафиксировать стены', () => {
      plSnap(); S.room.ms.labWallBase = true; store(S.room);
      toast('Стены зафиксированы: распознавание по фото их не перестроит');
    }, 'base', 'Запретить перестройку стен этого помещения по фото');
    if (hit && mode === 'pick') {
      const field = document.createElement('input');
      field.type = 'text'; field.value = hit.q.name; field.placeholder = 'Имя зоны';
      field.setAttribute('aria-label', 'Имя зоны'); field.title = 'Имя зоны · Enter — сохранить';
      field.onchange = () => {
        if (!field.value.trim()) { field.value = hit.q.name; return; }
        plSnap(); hit.q.name = field.value.trim(); store(hit.r);
      };
      panel.append(field);
      button('Изменить контур', () => { switchMode('manual'); edit = hit; draw(); }, 'edit');
      /* Т11: перезаливка тем же способом, каким зона построена */
      button(staleIds.has(hit.q.id) ? 'Перезалить ⟳' : 'Перезалить', () => {
        switchMode(hit.q.src === 'fill' || !ulGet() ? 'fill' : 'image'); edit = hit; draw();
      }, 'refill');
      const count = walls().filter(w => hit.q.walls.includes(w.id)).length;
      button('Стены зоны · ' + count, () => switchMode('assign'), 'assign', 'Назначить стены этой зоне касаниями');
      button('Удалить зону', () => removeZone(hit), 'delete-zone');   /* Д2 */
    }
    if (!hit && mode === 'pick' && S.room.ms.pts.length >= 2 && !S.room.ms.labWallBase) {
      const count = walls().filter(w => nativeSelection().q.walls.includes(w.id)).length;
      button('Стены помещения · ' + count, () => switchMode('assign'), 'assign-native', 'Назначить стены самому помещению «' + (S.room.name || '') + '»');
    }
    if (mode === 'assign') button('Готово · стены', () => switchMode('pick'), 'assigned');
    if (sep && mode === 'pick') {
      button('Править границу', () => { switchMode('divider'); edit = sep; draw(); }, 'edit-divider');
      button('Удалить границу', () => removeDivider(sep), 'delete-divider');
    }
    if (mode === 'pick') button('Выбирать стены', () => switchMode(''), 'walls');
    const name = edit?.q.name ? '«' + edit.q.name + '»: ' : '';
    const notes = {manual: name + 'касайтесь углов по порядку (пером)', divider: 'Укажите пером два конца границы',
      fill: name + 'коснитесь внутри контура стен', image: name + 'коснитесь внутри области на фото',
      assign: 'Касайтесь стен, чтобы назначить или снять их', shift: 'Коснитесь пером нового положения середины стены',
      '': wall == null ? 'Коснитесь стены' : ''};
    if (hit && mode === 'pick' && staleIds.has(hit.q.id)) notes.pick = 'Стены изменились — контур зоны устарел: «Перезалить»';
    if (notes[mode]) {
      const note = document.createElement('small'); note.textContent = notes[mode]; panel.append(note);
    }
  }
  /* AKX-2026-0010 Д2: корзина удаляет выбранную зону / границу, пока открыта панель «Зоны» */
  const priorDelete = zDelSel;
  zDelSel = async function() {
    if (S.mode === 'plan' && active && mode === 'pick') {
      if (selection()) return removeZone(selection());
      if (dividerSelection()) return removeDivider(dividerSelection());
    }
    return priorDelete.apply(this, arguments);
  };
  /* ── AKX-2026-0010: подпись зоны не накрывает подписи стен С№ и «⌂ помещение». Места подписей v81 (draw) снаружи
     не видны — берутся приближённо: С№ у середины стены внутрь контура, «⌂» у центра помещения. Подпись ставится
     в свободную точку зоны ближе к её центру; своё имя — в две строки: «Зона N» мелко, имя ниже. ── */
  function labelBoxes() {
    const d = devicePixelRatio || 1, out = [];
    cx.save(); cx.font = 'bold ' + 14 * d + 'px system-ui';
    for (const r of rooms()) {
      const m = r.ms, n = plN(m);
      for (let k = 0; k < n; k++) {
        const [A, B] = plSeg(m, k).map(v => toScr(...v)), M = mix(A, B, 0.5), l = dist(A, B) || 1;
        const N = [-(B[1] - A[1]) / l, (B[0] - A[0]) / l], in1 = add(M, N, 25 * d), in2 = add(M, N, -25 * d);
        const shut = m.closed && m.pts.length > 2, c = shut && !inPoly(toPl(...in1), m.pts) ? in2 : in1;
        for (const e of shut ? [c] : [in1, in2]) out.push([e[0] - 22 * d, e[1] - 14 * d, e[0] + 22 * d, e[1] + 14 * d]);   /* 82.18 fix: незамкнутый контур — сторона С№ неизвестна, заняты обе */
      }
      if (m.closed && m.pts.length > 2 && r.name) {
        const c = toScr(...plCen(m.pts)), w = cx.measureText('⌂ ' + r.name).width / 2;
        out.push([c[0] - w - 4 * d, c[1] - 14 * d, c[0] + w + 4 * d, c[1] + 6 * d]);
      }
    }
    cx.restore();
    return out;
  }
  function zoneText(q, old, avoid, sel) {
    const d = devicePixelRatio || 1, P = q.pts.map(v => toScr(...v)), xs = P.map(v => v[0]), ys = P.map(v => v[1]);
    const custom = !/^Зона \d+$/.test(q.name) && q.zn, top = custom ? ZONE + ' ' + q.zn : '', text = q.name + (old ? ' ⟳' : '');
    const span = (Math.max(...xs) - Math.min(...xs)) * 0.9;
    let size = 13; cx.font = 'bold ' + size * d + 'px system-ui';
    while (size > 9 && cx.measureText(text).width > span) cx.font = 'bold ' + --size * d + 'px system-ui';
    const c0 = toScr(...zCen(q.pts));
    let w, h0, box, best, score, hk = 1;
    const place = () => {   // свободная точка зоны ближе к центру для текущего размера шрифта
      w = Math.max(cx.measureText(text).width, custom ? cx.measureText(top).width * 0.8 : 0) / 2;
      h0 = (custom ? 28 : 12) * d * hk; const h1 = 5 * d;
      box = c => [c[0] - w, c[1] - h0, c[0] + w, c[1] + h1];
      const hits = c => { const b = box(c); return avoid.filter(x => x[0] < b[2] && x[2] > b[0] && x[1] < b[3] && x[3] > b[1]).length; };
      best = c0; score = hits(c0);
      if (score) for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) {
        const c = [Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * i / 12, Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * j / 12 + h0 / 2];
        if (!inPoly(toPl(...c), q.pts)) continue;
        const v = hits(c) + dist(c, c0) / 1e5;
        if (v < score) { score = v; best = c; }
      }
    };
    place();
    /* 82.18 fix: места нет (крошечный план — подпись ложится на С№ / «⌂») — сначала мельче (9), затем без подписи;
       выбранная зона подписывается всегда (её видно по заливке и панели «Зоны»). */
    if (score >= 1 && size > 9) { size = 9; hk = 9 / 13; cx.font = 'bold ' + size * d + 'px system-ui'; place(); }
    if (score >= 1 && !sel) return false;
    avoid.push(box(best));
    cx.fillStyle = old ? '#b4610f' : '#11766c'; cx.textAlign = 'center';
    cx.fillText(text, best[0], best[1]);
    if (custom) { cx.font = 'bold ' + Math.max(9, size - 3) * d + 'px system-ui'; cx.globalAlpha = 0.8; cx.fillText(top, best[0], best[1] - (size + 4) * d); cx.globalAlpha = 1; }
    return true;
  }
  function paint(P, line, fillColor, closed = false, dash = []) {
    if (P.length < 2) return;
    cx.strokeStyle = line; cx.lineWidth = pixels(2); cx.setLineDash(dash);
    cx.beginPath(); P.forEach((q, i) => i ? cx.lineTo(...toScr(...q)) : cx.moveTo(...toScr(...q)));
    if (closed) cx.closePath();
    if (fillColor) { cx.fillStyle = fillColor; cx.fill(); }
    cx.stroke();
  }
  const priorDraw = draw;
  draw = function() {
    const result = priorDraw.apply(this, arguments);
    document.body.classList.toggle('lab12-rect', S.mode !== 'plan' && rect({k: S.mk}));
    /* 82.18 int: холст (lab-ctx) рисует неактивные области с подменой S — панель, zn и Д7 только для активной поверхности; зоны неактивного плана — рисуются */
    const ctxPaint = !!(window.MeasureLabCtx && MeasureLabCtx.painting && MeasureLabCtx.painting());
    if (!ctxPaint && S.mode === 'plan' && S.room) { znFix(); refreshStale(); }   /* AKX-2026-0010 zn, Д7 */
    if (!ctxPaint) refreshPanel();
    if (ctxPaint ? !(S.mode === 'plan' && S.room) : panel.hidden) return result;
    cx.save();
    const avoid = labelBoxes(); const shown = {};
    for (const {q} of regions()) {
      const isSelected = q.id === selected && active && !ctxPaint, old = staleIds.has(q.id);
      paint(q.pts, old ? '#d9822b' : '#13827c', isSelected ? (old ? '#f0a03040' : '#2ab5ad40') : (old ? '#f0a03019' : '#2ab5ad19'), true, [pixels(5), pixels(3)]);
      shown[q.id] = zoneText(q, old, avoid, isSelected);
    }
    if (!ctxPaint) api.labels = shown;   /* 82.18 fix: подписаны ли зоны (тесты) */
    for (const {q} of dividers()) paint(q.pts, q.id === selectedDivider && active && !ctxPaint ? '#b71a7e' : '#13827c', null, false, [pixels(6), pixels(5)]);
    if (!ctxPaint && active && (selection() || mode === 'assign')) {
      const {q} = selection() || nativeSelection();
      for (const w of walls().filter(w => q.walls.includes(w.id))) paint(w.points, '#b71a7e');
    }
    if (!ctxPaint && draft.length) {
      paint(draft, '#b71a7e', null, false, [pixels(6), pixels(5)]);
      for (const p of draft) {
        cx.fillStyle = '#b71a7e'; cx.beginPath(); cx.arc(...toScr(...p), pixels(4), 0, 2 * Math.PI); cx.fill();
      }
    }
    cx.restore();
    return result;
  };
  api.planMeta = (m, flip) => {
    /* AKX-2026-0010: v3 не ломается — к labRooms {id,name,pts,walls:[wid]} добавлено только необязательное zn (AKX-2026-0012 §7);
       служебные src (способ построения) и ms.labZnHi в JSON не уходят. */
    const transform = ({src, ...q}) => ({...q, pts: q.pts.map(([x, y]) => [x, flip ? -y : y])});
    return {
      ...(m.labRooms?.length ? {labRooms: m.labRooms.map(transform)} : {}),
      ...(m.labDividers?.length ? {labDividers: m.labDividers.map(transform)} : {}),
      ...(m.labWallBase ? {labWallBase: true} : {}),
      ...(m.labManualWalls ? {labManualWalls: true} : {}),
      ...(m.labAssigned?.length ? {labAssigned: m.labAssigned.slice()} : {})
    };
  };
})();
