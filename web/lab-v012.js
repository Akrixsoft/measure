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
  const clashes = (P, skip) => nativeRegions().some(r => overlaps(P, r.ms.pts))
    || regions().some(({q}) => q.id !== skip && overlaps(P, q.pts));
  const host = () => S.room.ms.pts.length >= 2 ? S.room : rooms().find(r => r.ms.pts.length >= 2);
  function store(owner) {
    if (owner === S.room) saveRoom();
    else {
      saveRoom();
      dbPut('sess', JSON.parse(JSON.stringify(owner))).catch(error => {
        console.error(error); toast('Не удалось сохранить помещение');
      });
    }
    draw();
  }
  let mode = '', draft = [], selected = null, selectedDivider = null, edit = null, shift = null;
  let canvasId = null, active = false;
  const selection = () => regions().find(({q}) => q.id === selected);
  const nativeSelection = () => ({r: S.room, native: true, q: {walls: S.room.ms.labAssigned || []}});
  const dividerSelection = () => dividers().find(({q}) => q.id === selectedDivider);
  function region(P, target) {
    const owner = target?.r || host();
    if (!owner) return toast('Сначала постройте или распознайте стены');
    if (!simple(P)) return toast('Нужен контур без пересечений');
    if (clashes(P, target?.q.id)) return toast('Контур пересекает назначенное помещение');
    plSnap();
    if (target) target.q.pts = P;
    else {
      const q = {id: crypto.randomUUID(), name: 'Помещение ' + (regions().length + 1), pts: P, walls: []};
      (owner.ms.labRooms ||= []).push(q);
      selected = q.id;
    }
    mode = 'pick'; draft = []; edit = null; store(owner);
    return true;
  }
  function divider(A, B, target) {
    const owner = target?.r || host();
    if (!owner || dist(A, B) < 20) return toast('Укажите два конца границы');
    plSnap();
    if (target) target.q.pts = [A, B];
    else {
      const q = {id: crypto.randomUUID(), pts: [A, B]};
      (owner.ms.labDividers ||= []).push(q); selectedDivider = q.id;
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
    let W, H, free, toGrid, toWorld;
    if (underlay && ulGet() && UL.c) {
      const u = ulGet().ul, M = ulMasks();
      ({W, H} = M);
      free = ulFree().slice();
      toGrid = p => [(p[0] - u.x0) / u.s, (u.y0 - p[1]) / u.s];
      toWorld = p => [u.x0 + p[0] * u.s, u.y0 - p[1] * u.s];
    } else {
      const P = [...W0, ...D].flat();
      if (!P.length) return null;
      const X = P.map(p => p[0]), Y = P.map(p => p[1]);
      const step = Math.max(2, (Math.max(...X) - Math.min(...X)) / 1000, (Math.max(...Y) - Math.min(...Y)) / 1000);
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
    return mask && ulDP(ulTrace(mask, W, H), 2).map(toWorld);
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
    const P = fill(q, underlay);
    if (!P) return toast('Заливка выходит наружу: добавьте границу от стены до стены');
    return region(P, target);
  }
  let nativeFilling = false;
  const oldFill = ulTap;
  ulTap = async function(p) {
    if (nativeFilling) return;
    if (dividers().length || rooms().some(r => r.ms.labWallBase)) return fillTap(toPl(...p), true, null);
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
      || (m.closed && (!simple(proposed) || (!m.labWallBase && api.blocksNative(proposed, r)))))
      return toast('Сдвиг пересекает контур или назначенное помещение');
    plSnap(); m.pts = proposed; m.labManualWalls = true;
    store(r); return true;
  }
  api.shiftWall = shiftWall;
  function tapPlan(p) {
    const q = toPl(...p), at = planSnap(q.map(Math.round));
    if (mode === 'assign') return assign(selection() || nativeSelection(), chooseWall(p));
    if (mode === 'manual' || mode === 'divider') {
      if (mode === 'divider' && draft.length) return divider(draft[0], at, edit);
      if (mode === 'manual' && draft.length >= 3 && dist(at, draft[0]) < radius()) return region(draft, edit);
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
  zTapSel = function(p) {
    if (S.mode === 'plan' && mode) {
      if (mode === 'pick') return tapPlan(p);
      return;
    }
    return priorFinger.apply(this, arguments);
  };
  labDown = function(p) {
    if (mode) return false;
    return priorLabel.apply(this, arguments);
  };
  const priorRetrace = ulRetrace;
  ulRetrace = function() {
    if (S.room?.ms.labManualWalls || dividers().length || S.room?.ms.labWallBase) return Promise.resolve(0);
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
    if (k !== 'sel') { mode = ''; draft = []; edit = null; }
    return priorPick.apply(this, arguments);
  };
  const panel = document.createElement('div');
  panel.id = 'lab12-plan'; panel.hidden = true; document.body.append(panel);
  let lastPanel = '';
  function refreshPanel() {
    panel.hidden = S.mode !== 'plan' || !S.room || $('ss').classList.contains('on');
    if (panel.hidden) return;
    const key = S.room.obj || S.room.id;
    if (canvasId !== key) { canvasId = key; mode = ''; active = false; draft = []; selected = null; selectedDivider = null; edit = null; }
    const hit = selection(), sep = dividerSelection(), wall = S.psel?.t === 's' ? S.psel.i : null;
    const state = JSON.stringify([key, S.room.id, S.room.ms.labAssigned, mode, active, draft.length, hit?.q, sep?.q, wall, S.room.ms.labWallBase, S.room.ms.closed, !!ulGet(), walls().map(w => w.id)]);
    if (state === lastPanel) return;
    lastPanel = state; panel.replaceChildren();
    const button = (label, fn, name) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn;
      if (name) b.dataset.lab12 = name;
      panel.append(b);
    };
    button(active ? 'Закрыть помещения' : 'Помещения', () => {
      active = !active; switchMode(active ? 'pick' : '');
    }, 'toggle');
    if (!active) return;
    button('Контур', () => switchMode('manual'), 'manual');
    button('Граница', () => switchMode('divider'), 'divider');
    button('Заливка стен', () => switchMode('fill'), 'fill');
    if (ulGet()) button('Заливка фото', () => switchMode('image'), 'image');
    if (mode === 'manual' && draft.length >= 3) button('Готово', () => region(draft, edit), 'commit');
    if (mode && mode !== 'pick') button('Отмена', () => switchMode('pick'), 'cancel');
    if (mode === 'pick' && S.room.ms.closed && !S.room.ms.labWallBase) button('Разделить исходный контур', () => {
      plSnap(); S.room.ms.labWallBase = true; store(S.room);
      toast('Стены сохранены. Укажите границы и выполните заливку');
    }, 'base');
    if (hit && mode === 'pick') {
      const field = document.createElement('input');
      field.type = 'text'; field.value = hit.q.name; field.setAttribute('aria-label', 'Имя помещения');
      field.onchange = () => {
        if (!field.value.trim()) { field.value = hit.q.name; return; }
        plSnap(); hit.q.name = field.value.trim(); store(hit.r);
      };
      panel.append(field);
      button('Изменить контур', () => { switchMode('manual'); edit = hit; }, 'edit');
      button('Перезалить', () => { switchMode(ulGet() ? 'image' : 'fill'); edit = hit; }, 'refill');
      const count = walls().filter(w => hit.q.walls.includes(w.id)).length;
      button('Назначить стены · ' + count, () => switchMode('assign'), 'assign');
    }
    if (!hit && mode === 'pick' && S.room.ms.pts.length >= 2 && !S.room.ms.labWallBase) {
      const count = walls().filter(w => nativeSelection().q.walls.includes(w.id)).length;
      button('Назначить стены текущему · ' + count, () => switchMode('assign'), 'assign-native');
    }
    if (mode === 'assign') button('Готово · стены', () => switchMode('pick'), 'assigned');
    if (sep && mode === 'pick') {
      button('Править границу', () => { switchMode('divider'); edit = sep; }, 'edit-divider');
      button('Удалить границу', () => {
        plSnap(); sep.r.ms.labDividers = sep.r.ms.labDividers.filter(q => q !== sep.q);
        selectedDivider = null; store(sep.r);
      }, 'delete-divider');
    }
    if (mode === 'pick') button('Выбирать стены', () => switchMode(''), 'walls');
    if (wall != null && !mode) {
      button('Сдвиг стены', () => {
        const r = S.room, [a, b] = plSeg(r.ms, wall);
        shift = {r, k: wall, from: mix(a, b, 0.5)}; switchMode('shift');
      }, 'shift');
      button('Разбить стену', () => ctAddNode(wall), 'split-wall');
      button('Удалить участок', () => zDelSel(), 'delete-wall');
    }
    const notes = {manual: 'Касайтесь углов по порядку', divider: 'Укажите два конца границы',
      fill: 'Коснитесь внутри контура стен', image: 'Коснитесь внутри области на фото',
      assign: 'Касайтесь стен, чтобы назначить или снять их', shift: 'Коснитесь нового положения середины стены'};
    if (notes[mode]) {
      const note = document.createElement('small'); note.textContent = notes[mode]; panel.append(note);
    }
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
    refreshPanel();
    if (panel.hidden) return result;
    cx.save();
    for (const {q} of regions()) {
      const isSelected = q.id === selected && active;
      paint(q.pts, '#13827c', isSelected ? '#2ab5ad40' : '#2ab5ad19', true, [pixels(5), pixels(3)]);
      const p = zCen(q.pts);
      cx.fillStyle = '#11766c'; cx.font = 'bold ' + pixels(13) + 'px system-ui';
      cx.textAlign = 'center'; cx.fillText(q.name, ...toScr(...p));
    }
    for (const {q} of dividers()) paint(q.pts, q.id === selectedDivider && active ? '#b71a7e' : '#13827c', null, false, [pixels(6), pixels(5)]);
    if (active && (selection() || mode === 'assign')) {
      const {q} = selection() || nativeSelection();
      for (const w of walls().filter(w => q.walls.includes(w.id))) paint(w.points, '#b71a7e');
    }
    if (draft.length) {
      paint(draft, '#b71a7e', null, false, [pixels(6), pixels(5)]);
      for (const p of draft) {
        cx.fillStyle = '#b71a7e'; cx.beginPath(); cx.arc(...toScr(...p), pixels(4), 0, 2 * Math.PI); cx.fill();
      }
    }
    cx.restore();
    return result;
  };
  api.planMeta = (m, flip) => {
    const transform = q => ({...q, pts: q.pts.map(([x, y]) => [x, flip ? -y : y])});
    return {
      ...(m.labRooms?.length ? {labRooms: m.labRooms.map(transform)} : {}),
      ...(m.labDividers?.length ? {labDividers: m.labDividers.map(transform)} : {}),
      ...(m.labWallBase ? {labWallBase: true} : {}),
      ...(m.labManualWalls ? {labManualWalls: true} : {}),
      ...(m.labAssigned?.length ? {labAssigned: m.labAssigned.slice()} : {})
    };
  };
})();
