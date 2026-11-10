/* Measure 82.18 — авторазмеры стены цепочкой до граней элементов (AKX-2026-0012 §6, владелец 11.11.2026 00:31).
   Вызов — из w3Draw (scripts/autodim-patch.py) до штатной раскладки полей: очередь LQ меняется на месте.
   1. Рёбра стены режутся объёмами, которые их касаются: верх / низ — штатные части v81 (до объёма, между объёмами);
      боковые (лево / право) — цепочка Lab: ригель у потолка во всю ширину → «2 319 + 381» вместо «2 700». Разрезанное ребро —
      без поля общего габарита.
   2. Объём, не касающийся краёв, — цепочка «до грани» по каждой оси (колонна в середине: слева, ширина, справа).
   3. Без повторов: одна подпись на отрезок по длине (верх / низ одного объёма, ширина объёма = длина стены, одинаковые цепочки
      у пола и потолка); по высоте — цепочки обоих боковых рёбер стены остаются (разные углы), высота объёма с тем же отрезком — нет.
   4. Правка: отрезок «объём» — Ш / В объёма (штатно); от ребра стены до грани — положение объёма; от объёма до противоположного
      ребра по высоте — высота стены H при неизменных объёмах (объёмы у потолка остаются у потолка).
   Общий габарит стены — стрелками на фото (холст), здесь не дублируется. Поверх неизменной v81 (обёртки): w3FKind, w3FSet. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabAutodim) return;
  const api = window.MeasureLabAutodim = {version: 1, on: true};
  const E = 1;   // мм: касание ребра / совпадение отрезков

  function info(q, VV, Md) {   // ось и отрезок подписи в мм стены: {ax:'x'|'y', i0, i1, line, kind:'wall'|'chain'|'vol', side?, vol?}
    if (q.ad) return q.ad;
    const r = q.rec || {}, L = Md.L, H = Md.H;
    if (r.man || /^[ABCD]$/.test(r.a || '') && /^[ABCD]$/.test(r.b || '')) {
      const ab = r.a + r.b;
      if (ab === 'AB') return {ax: 'x', i0: 0, i1: L, line: H, kind: 'wall', edge: 'T'};
      if (ab === 'DC') return {ax: 'x', i0: 0, i1: L, line: 0, kind: 'wall', edge: 'B'};
      if (ab === 'AD') return {ax: 'y', i0: 0, i1: H, line: 0, kind: 'wall', edge: 'L'};
      if (ab === 'BC') return {ax: 'y', i0: 0, i1: H, line: L, kind: 'wall', edge: 'R'};
      return null;
    }
    if (r.b === 'seg' || r.a === 'seg') { const top = r.a === 'A' || r.b === 'B'; return {ax: 'x', i0: r.x0, i1: r.x1, line: top ? H : 0, kind: 'chain', edge: top ? 'T' : 'B'}; }
    const v = VV.find(o => typeof r.a === 'string' && r.a.startsWith(o.id) && /^[KW][LR][TB]$/.test(r.a.slice(o.id.length)));
    if (v) { const a = r.a.slice(v.id.length), b = String(r.b).slice(v.id.length); if (a[0] !== 'K' || b[0] !== 'K') return null;
      if (a[2] === b[2]) return {ax: 'x', i0: v.x0, i1: v.x1, line: a[2] === 'T' ? v.y1 : v.y0, kind: 'vol', vol: v.id, face: a[2]};
      return {ax: 'y', i0: v.y0, i1: v.y1, line: a[1] === 'L' ? v.x0 : v.x1, kind: 'vol', vol: v.id, face: a[1]}; }
    return null;
  }
  const same = (a, b) => Math.abs(a.i0 - b.i0) < E && Math.abs(a.i1 - b.i1) < E;
  const rank = a => a.kind === 'vol' ? (a.face === 'B' || a.face === 'L' ? 0 : 1) : a.kind === 'chain' ? (a.edge === 'B' || a.edge === 'L' ? 2 : 3) : (a.edge === 'B' || a.edge === 'L' ? 4 : 5);

  api.chain = function (LQ, c) {
    if (!api.on || !LQ || !c || !c.Md) return;
    const {Md, VV, cen, nf} = c, L = Md.L, H = Md.H, P3 = (x, y) => w3S([x, y, 0]);
    const vols = (VV || []).filter(v => v.x1 - v.x0 > E && v.y1 - v.y0 > E);
    const touch = v => ({c: v.y1 > H - E, f: v.y0 < E, l: v.x0 < E, r: v.x1 > L - E});
    const hMeas = () => { try { const m = manV('Hl'); return S.q4 && S.q4.blank ? (S.q4.aH || S.q4.pH ? 'apx' : true) : !!(m && m.src === 'рулетка') || undefined; } catch (e) { return undefined; } };
    const elOf = v => !v.plan && S.els.find(x => x.id === v.id);
    const add = (x0, y0, x1, y1, mm, ad, k, meas) => {
      if (!(mm > E)) return;
      LQ.push({A2: P3(x0, y0), B2: P3(x1, y1), t: (meas === 'apx' ? '≈ ' : '') + nf(mm), meas, rec: {a: 'ad', b: 'ad', adk: k}, inn: cen, pri: 1, own: null, ad});
    };
    /* 1. боковые рёбра: цепочка из объёмов, касающихся ребра (по высоте) */
    for (const [edge, X, tk] of [['L', 0, 'l'], ['R', L, 'r']]) {
      const cut = vols.filter(v => v.D > 0 && touch(v)[tk]).sort((a, b) => a.y0 - b.y0); if (!cut.length) continue;
      for (let i = LQ.length - 1; i >= 0; i--) { const a = info(LQ[i], VV, Md); if (a && a.kind === 'wall' && a.edge === edge) LQ.splice(i, 1); }   // разрезанное ребро — без общего габарита
      let y = 0; const hm = hMeas();
      for (const v of cut) {
        if (v.y0 > y + E) { const k = y < E && touch(v).c ? {t: 'adH', mode: 'below', y0: v.y0, H, v: v.y0} : {t: 'adY', id: v.id, side: 0, gap: y, v: v.y0 - y};   // под объёмом у потолка — правит H; иначе — положение объёма
          add(X, y, X, v.y0, v.y0 - y, {ax: 'y', i0: y, i1: v.y0, line: X, kind: 'chain', edge}, v.plan ? {t: 'ref'} : k, hm); }
        if (v.y1 > y + E) { const e0 = elOf(v), a0 = Math.max(y, v.y0); add(X, a0, X, v.y1, v.y1 - a0, {ax: 'y', i0: a0, i1: v.y1, line: X, kind: 'chain', edge, vol: v.id}, v.plan ? {t: 'ref'} : {t: 'el', id: v.id, ax: 'H', v: v.y1 - v.y0}, fwVM(e0, 'H')); }
        y = Math.max(y, v.y1);
      }
      if (H > y + E) { const lowTop = cut[cut.length - 1]; add(X, y, X, H, H - y, {ax: 'y', i0: y, i1: H, line: X, kind: 'chain', edge}, lowTop.plan ? {t: 'ref'} : {t: 'adH', mode: 'above', y1: y, H, v: H - y}, hm); }
    }
    /* 2. объёмы, не касающиеся краёв: «до грани» по каждой оси */
    for (const v of vols) {
      const t = touch(v);
      if (!t.c && !t.f) {   // по длине: верх / низ стены его не режут
        if (!t.l) add(0, v.y0, v.x0, v.y0, v.x0, {ax: 'x', i0: 0, i1: v.x0, line: v.y0, kind: 'chain', edge: 'F'}, v.plan ? {t: 'ref'} : {t: 'off', id: v.id, side: 0, v: v.x0}, w3SegOk(v, 'L') ? true : undefined);
        if (!t.r) add(v.x1, v.y0, L, v.y0, L - v.x1, {ax: 'x', i0: v.x1, i1: L, line: v.y0, kind: 'chain', edge: 'F'}, v.plan ? {t: 'ref'} : {t: 'off', id: v.id, side: 1, v: L - v.x1}, w3SegOk(v, 'R') ? true : undefined);
      }
      if (!t.l && !t.r) {   // по высоте: боковые рёбра его не режут
        const hm = hMeas();
        if (!t.f) add(v.x0, 0, v.x0, v.y0, v.y0, {ax: 'y', i0: 0, i1: v.y0, line: v.x0, kind: 'chain', edge: 'F'}, v.plan ? {t: 'ref'} : t.c ? {t: 'adH', mode: 'below', y0: v.y0, H, v: v.y0} : {t: 'adY', id: v.id, side: 0, v: v.y0}, hm);
        if (!t.c) add(v.x0, v.y1, v.x0, H, H - v.y1, {ax: 'y', i0: v.y1, i1: H, line: v.x0, kind: 'chain', edge: 'F'}, v.plan ? {t: 'ref'} : t.f ? {t: 'adH', mode: 'above', y1: v.y1, H, v: H - v.y1} : {t: 'adY', id: v.id, side: 1, v: H - v.y1}, hm);
      }
    }
    /* верх / низ стены разрезаны — общий габарит не выводится (v81 ставил его снаружи) */
    for (let i = LQ.length - 1; i >= 0; i--) if (LQ[i].out) LQ.splice(i, 1);
    /* 3. повторы */
    const A = LQ.map(q => ({q, a: info(q, VV, Md)})).filter(x => x.a);
    const drop = new Set();
    for (const ax of ['x', 'y']) {
      const G = A.filter(x => x.a.ax === ax);
      for (const x of G) { if (drop.has(x.q)) continue;
        const grp = G.filter(y => !drop.has(y.q) && same(x.a, y.a) && y.q.t === x.q.t);   // одинаковый отрезок и одинаковое значение if (grp.length < 2) continue;
        if (ax === 'x') { grp.sort((p, q) => rank(p.a) - rank(q.a)); grp.slice(1).forEach(y => drop.add(y.q)); continue; }
        const side = y => (y.a.kind === 'wall' || y.a.kind === 'chain') && (y.a.edge === 'L' || y.a.edge === 'R');   // по высоте: боковые рёбра стены — по одной на ребро
        const S2 = grp.filter(side), seen = new Set();
        for (const y of S2.sort((p, q) => rank(p.a) - rank(q.a))) { if (seen.has(y.a.edge)) drop.add(y.q); seen.add(y.a.edge); }
        const rest = grp.filter(y => !side(y)).sort((p, q) => rank(p.a) - rank(q.a));
        rest.forEach((y, i) => { if (S2.length || i > 0) drop.add(y.q); });
      }
    }
    for (let i = LQ.length - 1; i >= 0; i--) if (drop.has(LQ[i])) LQ.splice(i, 1);
  };

  /* ═══ [BLOCK AD-EDIT] правка отрезков цепочки ═══ */
  const fk0 = w3FKind; w3FKind = function (l) { if (l && l.adk) return {...l.adk}; return fk0.apply(this, arguments); };
  function shiftY(ids, dy) { const W = wf(); for (const id of ids) { const e = S.els.find(x => x.id === id); if (!e) continue; const c = toW(e.c, W); e.c = fromW([c[0], c[1] + dy], W); delete e.fy; delete e.fyr; } }
  const fs0 = w3FSet; w3FSet = function (k, n) {
    if (!k || (k.t !== 'adH' && k.t !== 'adY')) return fs0.apply(this, arguments);
    const Md = w3Model(); if (!Md) return; const H = Md.H, VV = w3Vols(Md);
    if (k.t === 'adY') { const v = VV.find(o => o.id === k.id); if (!v || v.plan) return; const dy = k.side ? (H - n) - v.y1 : (n + (k.gap || 0)) - v.y0; if (Math.abs(dy) < 0.05) return; snap(); shiftY([v.id], dy); unsnap(); saveSess(); mkPanel(); draw(); return; }
    const nH = k.mode === 'below' ? n + (H - k.y0) : k.y1 + n; if (!(nH > 0) || Math.abs(nH - H) < 0.05) return;
    const up = VV.filter(v => !v.plan && v.y1 > H - E).map(v => v.id), dH = nH - H;
    if (S.q4 && S.q4.blank && typeof w3BaseSet === 'function') w3BaseSet('Hl', nH); else fs0.call(this, {t: 'man', k: 'Hl', v: H}, nH);   // высота стены — штатно (чистая стена — размер стены, свой шаг ↶)
    const M2 = w3Model(); if (M2 && Math.abs(M2.H - nH) < 1 && up.length) { snap(); shiftY(up, dH); unsnap(); saveSess(); mkPanel(); draw(); }   // объёмы у потолка — у потолка
  };
  PM.labAutodim = api;
})();
