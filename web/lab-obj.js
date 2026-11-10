/* Measure 82.18 — поля объектов стены и длины плана (AKX-2026-0009, инженер C).
   Z: поле «Z · выступ +, ниша −» в плашке #pp выбранного объёма (колонна, ригель, короб, выступ, ниша) — как штатный w3FSet (ax D):
      шаг ↶ (snap), запись (saveSess), объём на развёртке (w3Vols D). Знак: выступ ↔ ниша меняют вид; колонна / ригель / короб — только +.
      На холсте развёртки то же значение правится полем глубины объёма (w3FHit → #w3f), в том числе при активном инструменте (lab-placement F2).
   План: введённая длина стены (#pp L, поле плана plL → тот же ввод) перестраивает эскиз:
      открытая ломаная — конец стены и все следующие точки сдвигаются вдоль стены;
      замкнутая — длину добирают ближайшие НЕзамеренные стены (направления стен сохраняются); замерены все — конфликт: размер записан,
      эскиз не меняется (как v81) + сообщение. Колонны и выступы плана (ms.shp) идут со своей стеной / углом. Тот же шаг ↶ (plSnap штатного ввода).
   Поверх неизменной v81 (обёртки): elBar81, plPanel. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabObj) return;
  const api = window.MeasureLabObj = {version: 1};
  const VOL = ['kol', 'rig', 'kor', 'vys', 'nis'];

  /* ═══ [BLOCK OBJ-Z] поле Z в плашке объёма ═══ */
  function zSet(e, n) {
    if (!e || !Number.isFinite(n) || n === 0) return false;
    let k = e.k;
    if (n < 0 && k === 'vys') k = 'nis'; else if (n > 0 && k === 'nis') k = 'vys';
    else if (n < 0 && k !== 'nis') { try { toast(((W3VK[k] || [])[1] || 'объём') + ': только выступ (+) — взято ' + Math.abs(n)); } catch (x) { } }
    snap(); e.k = k; e.D = r1(Math.abs(n)); delete e.cand; if (e.apx) { delete e.apx.D; if (!Object.keys(e.apx).length) delete e.apx; }   // как w3FSet (ax D); вид и глубина — один шаг ↶
    unsnap(); saveSess(); mkPanel(); draw();
    return true;
  }
  api.zSet = zSet;
  const bar0 = elBar81; elBar81 = function (pp, e) {
    const r = bar0.apply(this, arguments);
    try {
      if (e && VOL.includes(e.k) && pp && !pp.querySelector('[data-lab-z]')) {
        const D = Math.abs(+e.D || ((W3VK[e.k] || [])[2] || 0)), v = e.k === 'nis' ? -D : D;
        const l = document.createElement('label'); l.className = 'lab-z'; l.title = 'Глубина Z: выступ +, ниша −';
        l.innerHTML = `Z <input data-lab-z inputmode="decimal" value="${v}" aria-label="Глубина Z, мм: выступ плюс, ниша минус">`;
        const i = l.querySelector('input');
        i.onchange = () => { const t = i.value.trim().replace(',', '.'), n = t === '' ? null : evalN(t); if (n == null || !Number.isFinite(n) || n === 0) { i.value = v; return; } zSet(S.els.find(x => x.id === e.id), n); };
        const row = pp.querySelector('.row'); (row || pp).appendChild(l);
      }
    } catch (x) { console.error(x); }
    return r;
  };

  /* ═══ [BLOCK OBJ-PLAN] длина стены плана перестраивает эскиз ═══ */
  const segLen = (m, k) => { const [a, b] = plSeg(m, k); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  function shpMove(m, disp, k, n0) {   // колонны / выступы плана — со своей стеной: смещение ближайшего угла или стены (у меняемой стены — от её начала)
    const N = m.pts.length, segs = plN(m);
    for (const q of m.shp || []) {
      if (!q.pts || !q.pts.length) continue;
      const c = [q.pts.reduce((s, p) => s + p[0], 0) / q.pts.length, q.pts.reduce((s, p) => s + p[1], 0) / q.pts.length];
      let best = null, bd = 1e18;
      for (let j = 0; j < segs; j++) { const a = j, b = (j + 1) % N, A = n0[a], B = n0[b], dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((c[0] - A[0]) * dx + (c[1] - A[1]) * dy) / L2)), d = Math.hypot(A[0] + dx * t - c[0], A[1] + dy * t - c[1]); if (d < bd) { bd = d; best = {a, b, t, L: Math.sqrt(L2), j}; } }
      if (!best) continue;
      const reach = Math.max(...q.pts.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))) + 50;
      let v;
      if (best.j === k) v = (1 - best.t) * best.L <= reach ? disp[best.b] : [0, 0];   // меняемая стена: у её конца — с концом, иначе отступ от начала сохраняется
      else v = [disp[best.a][0] * (1 - best.t) + disp[best.b][0] * best.t, disp[best.a][1] * (1 - best.t) + disp[best.b][1] * best.t];
      if (Math.abs(v[0]) + Math.abs(v[1]) < 1e-9) continue;
      q.pts = q.pts.map(p => [p[0] + v[0], p[1] + v[1]]);
    }
  }
  function rebuild(m, k, n) {
    const N = m.pts.length, segs = plN(m), l = segLen(m, k); if (!(n > 0) || !(l > 0) || Math.abs(n - l) < 0.05) return 'same';
    const [A, B] = plSeg(m, k), u = [(B[0] - A[0]) / l, (B[1] - A[1]) / l], d = [(n - l) * u[0], (n - l) * u[1]], n0 = m.pts.map(p => p.slice()), disp = m.pts.map(() => [0, 0]);
    if (!m.closed) {   // открытая: конец стены и все следующие точки
      for (let i = k + 1; i < N; i++) disp[i] = d.slice();
    } else {           // замкнутая: компенсация ближайшими незамеренными стенами (2 непараллельные), направления сохраняются
      const free = []; for (let s = 1; s < segs; s++) for (const j of [(k + s) % segs, (k - s + segs) % segs]) if (j !== k && !free.includes(j) && !(plDim(m, j) && plDim(m, j).v > 0)) free.push(j);
      let sol = null;
      const dir = j => { const [a, b] = plSeg(m, j), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L, L]; };
      outer: for (let x = 0; x < free.length; x++) for (let y = x + 1; y < free.length; y++) {
        const p = dir(free[x]), q = dir(free[y]), det = p[0] * q[1] - p[1] * q[0]; if (Math.abs(det) < 0.05) continue;
        const a = (-d[0] * q[1] + d[1] * q[0]) / det, b = (-p[0] * d[1] + p[1] * d[0]) / det;   // a·p + b·q = −d
        if (p[2] + a > 10 && q[2] + b > 10) { sol = [[free[x], a, p], [free[y], b, q]]; break outer; }
      }
      if (!sol) return 'conflict';
      const dl = new Map([[k, [n - l, u]], ...sol.map(([j, v, w]) => [j, [v, w]])]);   // приращение длины по стенам; точки — накоплением от узла k
      let acc = [0, 0];
      for (let s = 0; s < segs - 1; s++) { const j = (k + s) % segs, t = dl.get(j); if (t) acc = [acc[0] + t[0] * t[1][0], acc[1] + t[0] * t[1][1]]; disp[(j + 1) % N] = acc.slice(); }
    }
    m.pts = m.pts.map((p, i) => [r1(p[0] + disp[i][0]), r1(p[1] + disp[i][1])]);
    shpMove(m, disp, k, n0);
    return 'ok';
  }
  api.rebuild = rebuild;
  const pp0 = plPanel; plPanel = function () {
    const r = pp0.apply(this, arguments);
    try {
      const i = document.querySelector('#pp [data-pf="L"]'), s = S.psel; if (!i || !s || s.t !== 's' || i._lab) return r;
      const nat = i.onchange, k = s.i; i._lab = 1;
      i.onchange = function () {
        const room = S.room, res = nat ? nat.apply(this, arguments) : undefined;
        try { const m = room && room.ms, d = m && plDim(m, k);
          if (d && d.v > 0 && Math.abs(segLen(m, k) - d.v) > 0.5) {
            const out = rebuild(m, k, +d.v);
            if (out === 'conflict') toast(`С${wN(room, k)} = ${d.v}: соседние стены замерены — эскиз не перестроен, размеры расходятся`);
            saveRoom(); mkPanel(); status(); strip(); draw();
          } } catch (x) { console.error(x); }
        return res;
      };
    } catch (x) { console.error(x); }
    return r;
  };
  PM.labObj = api;
})();
