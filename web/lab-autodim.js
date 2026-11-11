/* Measure 82.18 — авторазмеры стены цепочкой до граней элементов (AKX-2026-0012 §6, владелец 11.11.2026 00:31).
   Вызов — из w3Draw (scripts/autodim-patch.py) до штатной раскладки полей: очередь LQ меняется на месте.
   1. Рёбра стены режутся объёмами, которые их касаются: верх / низ — штатные части v81 (до объёма, между объёмами);
      боковые (лево / право) — цепочка Lab: ригель у потолка во всю ширину → «2 319 + 381» вместо «2 700». Разрезанное ребро —
      без поля общего габарита.
   2. Объём, не касающийся краёв, — цепочка «до грани» по каждой оси (колонна в середине: слева, ширина, справа).
   3. Без повторов: одна подпись на отрезок по длине (верх / низ одного объёма, ширина объёма = длина стены, одинаковые цепочки
      у пола и потолка); по высоте — цепочки обоих боковых рёбер стены остаются (разные углы), высота объёма с тем же отрезком — нет.
   4. Правка (82.18 g2, QA Д4 — решение Master: H стены только своим полем): отрезок «объём» — Ш / В объёма (В у потолка растёт вниз);
      от ребра стены / соседа до грани — положение объёма; под объёмом у потолка — его низ (верх у потолка); над объёмом у пола — его верх.
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
        if (v.y0 > y + E) { const k = touch(v).c ? {t: 'adB', id: v.id, gap: y, v: v.y0 - y} : {t: 'adY', id: v.id, side: 0, gap: y, v: v.y0 - y};   // под объёмом у потолка — его низ (верх у потолка); иначе — положение объёма
          add(X, y, X, v.y0, v.y0 - y, {ax: 'y', i0: y, i1: v.y0, line: X, kind: 'chain', edge}, v.plan ? {t: 'ref'} : k, hm); }
        if (v.y1 > y + E) { const e0 = elOf(v), a0 = Math.max(y, v.y0); add(X, a0, X, v.y1, v.y1 - a0, {ax: 'y', i0: a0, i1: v.y1, line: X, kind: 'chain', edge, vol: v.id}, v.plan ? {t: 'ref'} : {t: 'el', id: v.id, ax: 'H', v: v.y1 - v.y0}, fwVM(e0, 'H')); }
        y = Math.max(y, v.y1);
      }
      if (H > y + E) { const hi = cut.reduce((a, b) => b.y1 > a.y1 ? b : a); add(X, y, X, H, H - y, {ax: 'y', i0: y, i1: H, line: X, kind: 'chain', edge}, hi.plan ? {t: 'ref'} : touch(hi).f ? {t: 'adT', id: hi.id, v: H - y} : {t: 'adY', id: hi.id, side: 1, v: H - y}, hm); }   // над объёмом у пола — его верх; иначе — положение
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
        if (!t.f) add(v.x0, 0, v.x0, v.y0, v.y0, {ax: 'y', i0: 0, i1: v.y0, line: v.x0, kind: 'chain', edge: 'F'}, v.plan ? {t: 'ref'} : t.c ? {t: 'adB', id: v.id, gap: 0, v: v.y0} : {t: 'adY', id: v.id, side: 0, v: v.y0}, hm);
        if (!t.c) add(v.x0, v.y1, v.x0, H, H - v.y1, {ax: 'y', i0: v.y1, i1: H, line: v.x0, kind: 'chain', edge: 'F'}, v.plan ? {t: 'ref'} : t.f ? {t: 'adT', id: v.id, v: H - v.y1} : {t: 'adY', id: v.id, side: 1, v: H - v.y1}, hm);
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
        const grp = G.filter(y => !drop.has(y.q) && same(x.a, y.a) && y.q.t === x.q.t); if (grp.length < 2) continue;   // одинаковый отрезок и одинаковое значение
        if (ax === 'x') { grp.sort((p, q) => rank(p.a) - rank(q.a)); grp.slice(1).forEach(y => drop.add(y.q)); continue; }
        const side = y => (y.a.kind === 'wall' || y.a.kind === 'chain') && (y.a.edge === 'L' || y.a.edge === 'R');   // по высоте: боковые рёбра стены — по одной на ребро
        const S2 = grp.filter(side), seen = new Set();
        for (const y of S2.sort((p, q) => rank(p.a) - rank(q.a))) { if (seen.has(y.a.edge)) drop.add(y.q); seen.add(y.a.edge); }
        const rest = grp.filter(y => !side(y)).sort((p, q) => rank(p.a) - rank(q.a));
        rest.forEach((y, i) => { if (S2.length || i > 0) drop.add(y.q); });
      }
    }
    /* 82.18 g2 (QA Д14): глубина объёма (ребро стена → лицо, W…→K…) — одна подпись на объём: колонна плана от пола до потолка
       давала «232» у верха и у низа. Остаётся нижняя (у пола), при равных — первая. */
    { const seen = new Map();
      const dep = q => { const r = q.rec || {}; if (typeof r.a !== 'string' || typeof r.b !== 'string') return null; const v = VV.find(o => r.a.startsWith(o.id) && r.b.startsWith(o.id) && /^W[LR][TB]$/.test(r.a.slice(o.id.length)) && /^K[LR][TB]$/.test(r.b.slice(o.id.length))); return v ? {v, lo: r.a.slice(v.id.length)[2] === 'B'} : null; };
      LQ.forEach(q => { if (drop.has(q)) return; const d = dep(q); if (!d) return; const key = d.v.id + '|' + q.t, o = seen.get(key);
        if (!o) { seen.set(key, {q, lo: d.lo}); return; } if (d.lo && !o.lo) { drop.add(o.q); seen.set(key, {q, lo: true}); } else drop.add(q); }); }
    for (let i = LQ.length - 1; i >= 0; i--) if (drop.has(LQ[i])) LQ.splice(i, 1);
  };

  /* ═══ [BLOCK AD-EDIT] правка отрезков цепочки и высоты объёма (82.18 g2, QA Д4) ═══
     Высота стены H правится только своим полем (ребро / угол стены, ▣ Стена); отрезки цепочки — элементом:
     adY — положение объёма (от ребра / соседа до грани); adB — низ объёма у потолка (верх у потолка, высота = верх − низ);
     adT — верх объёма у пола (низ у пола). Поле высоты объёма (el H): у потолка растёт вниз, у пола — вверх.
     Грань у потолка / пола ставится точно в H / 0 (без дрейфа на округлениях toW/fromW). */
  const fk0 = w3FKind; w3FKind = function (l) { if (l && l.adk) return {...l.adk}; return fk0.apply(this, arguments); };
  const nm = e => { const s = (W3VK[e.k] || [])[1] || 'объём'; return s[0].toUpperCase() + s.slice(1); };
  function place(e, y0, h) {   // объём e: низ y0, высота h (мм стены); x и остальное — как были
    const W = wf(), c = toW(e.c, W); e.H = r1(h); e.c = fromW([c[0], y0 + e.H / 2], W);
  }
  function setY(k, n) {   // → true: обработано
    const Md = w3Model(); if (!Md) return true; const H = Md.H, v = w3Vols(Md).find(o => o.id === k.id), e = S.els.find(x => x.id === k.id);
    if (!v || v.plan || !e) return true;
    const h = v.y1 - v.y0, cTop = v.y1 > H - E, cBot = v.y0 < E, top = cTop ? H : v.y1, bot = cBot ? 0 : v.y0;
    let y0, hh;
    if (k.t === 'el') {   // высота объёма
      if (!(n > 0)) return true;
      if (n > H + 0.05) { toast(nm(e) + ': высота больше высоты стены ' + Math.round(H)); return true; }
      if (cTop && !cBot) { y0 = top - n; hh = n; } else { y0 = bot; hh = n; if (y0 + hh > H) y0 = H - hh; }
    } else if (k.t === 'adB') {
      y0 = (k.gap || 0) + n; hh = top - y0;
      if (!(hh > 0)) { toast(nm(e) + ': низ выше потолка — не принято'); return true; }
    } else if (k.t === 'adT') {
      hh = (H - n) - bot; y0 = bot;
      if (!(hh > 0)) { toast(nm(e) + ': верх ниже пола — не принято'); return true; }
    } else {   // adY
      y0 = k.side ? (H - n) - h : (k.gap || 0) + n; hh = h;
      if (y0 < -0.05 || y0 + hh > H + 0.05) { toast(nm(e) + ' за краем стены — не принято'); return true; }
    }
    y0 = Math.max(0, Math.min(H - hh, y0));
    const W = wf(), c0 = toW(e.c, W);
    if (Math.abs(y0 - v.y0) < 0.05 && Math.abs(hh - (+e.H || h)) < 0.05 && Math.abs(c0[1] - (y0 + hh / 2)) < 0.05) return true;
    snap(); place(e, y0, hh);
    if (k.t === 'el') { delete e.cand; if (e.apx) { delete e.apx.H; if (!Object.keys(e.apx).length) delete e.apx; } }
    delete e.fy; delete e.fyr; unsnap(); saveSess(); mkPanel(); draw();
    return true;
  }
  api.setY = setY;
  const fs0 = w3FSet; w3FSet = function (k, n) {
    if (k && (k.t === 'adY' || k.t === 'adB' || k.t === 'adT')) { setY(k, n); return; }
    if (k && k.t === 'el' && k.ax === 'H') { const e = S.els.find(x => x.id === k.id); if (e && W3VK[e.k]) { setY(k, n); return; } }
    if (k && k.t === 'man' && (k.k === 'Hl' || k.k === 'Hr')) {   // поле высоты стены: объёмы у потолка остаются у потолка
      const M0 = w3Model(), up = M0 ? w3Vols(M0).filter(v => !v.plan && v.y1 > M0.H - E && v.y0 > E).map(v => v.id) : [], H0 = M0 && M0.H;
      const r = fs0.apply(this, arguments), M1 = w3Model();
      if (M1 && H0 && up.length && Math.abs(M1.H - H0) > 0.05) { snap();
        for (const id of up) { const e = S.els.find(x => x.id === id); if (!e) continue; const h = Math.min(+e.H || 0, M1.H); if (h > 0) place(e, M1.H - h, h); }
        unsnap(); saveSess(); mkPanel(); draw(); }
      return r;
    }
    return fs0.apply(this, arguments);
  };
  /* ═══ [BLOCK AD-PLACE] r2b (QA2 Н8): поля размеров не ложатся на значки коммуникаций и не выходят за рамку области стены.
     1) значки точечных объектов (розетки и т. п.) — препятствия раскладки (кольца S.w3RO, как у подписей С№ в w3Txt9);
     2) кандидаты места поля за рамкой активной области холста отбрасываются, пока есть место внутри (иначе — как было).
     Поверх неизменной v81 (обёртки w3FPs, w3Free). ═══ */
  const fp0 = w3FPs; w3FPs = function () {
    const r = fp0.apply(this, arguments);
    try { const RO = S.w3RO; if (Array.isArray(RO)) { const d = devicePixelRatio || 1, z = w3IcZ() * 0.7 + 5 * d; for (const e of S.els) if ((KD[e.k] || {}).pt && layOn(e) && !e.cand) RO.push([toScr(...e.c), z]); /* с рамкой выбора; от выбора не зависит — поля не прыгают */ } } catch (e) { }
    return r;
  };
  function frame() {   // рамка активной области стены на холсте, px холста; null — вне холста / снимок
    try {
      if (!window.MeasureLabSketch || !MeasureLabSketch.isOpen || !MeasureLabSketch.isOpen()) return null;
      if (window.MeasureLabCtx && MeasureLabCtx.painting && MeasureLabCtx.painting()) return null;
      const it = MeasureLabSketch.active(); if (!it || it.t !== 'wall') return null;
      const R = MeasureLabSketch.region(it), a = MeasureLabSketch.map.toScrK(R.x, R.y), b = MeasureLabSketch.map.toScrK(R.x + R.w, R.y + R.h);
      const d = devicePixelRatio || 1; return {x0: Math.min(a[0], b[0]) + 2 * d, x1: Math.max(a[0], b[0]) - 2 * d, y0: Math.min(a[1], b[1]) + 2 * d, y1: Math.max(a[1], b[1]) - 2 * d};
    } catch (e) { return null; }
  }
  api.frame = frame;
  const inF = (F, c, o) => { const ca = Math.abs(Math.cos(o.an || 0)), sa = Math.abs(Math.sin(o.an || 0)), hw = (o.w * ca + o.h * sa) / 2, hh = (o.w * sa + o.h * ca) / 2; return c[0] - hw >= F.x0 && c[0] + hw <= F.x1 && c[1] - hh >= F.y0 && c[1] + hh <= F.y1; };
  const fr0 = w3Free; w3Free = function (C, o) {
    try { if (Array.isArray(C) && C.length > 1 && o && o.w) { const F = frame(); if (F) { const C2 = C.filter(c => inF(F, c, o)); if (C2.length && C2.length < C.length) { const a = [...arguments]; a[0] = C2; return fr0.apply(this, a); } } } } catch (e) { }
    return fr0.apply(this, arguments);
  };
  PM.labAutodim = api;
})();
