/* Measure — распознавание по фото стены на телефоне (перенос из 82.13 / v79–v81 без изменений логики: hDLT, fwRectify, fwDetect).
   Вход: кадр (Blob), 4 угла стены в пикселях кадра (ЛВ, ПВ, ПН, ЛН), L × H стены, мм. Выход — найденное в мм стены. */
(() => {
'use strict';
function hDLT(src, dst) {             // src, dst — [[x,y]…], ≥4; h33 = 1
  const A = [], b = [];
  for (let i = 0; i < src.length; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const N = Array.from({ length: 8 }, () => new Array(8).fill(0)), g = new Array(8).fill(0);
  for (let r = 0; r < A.length; r++) for (let i = 0; i < 8; i++) { g[i] += A[r][i] * b[r]; for (let j = 0; j < 8; j++) N[i][j] += A[r][i] * A[r][j] }
  return solveLin(N, g);
}
function hApply(h, x, y) { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w, w] }
async function fwImg(src, maxSide = 1200) {
  if (src && src.gray && src.rgba && src.W) return src;
  let b = src, own = false;
  if (typeof Blob !== 'undefined' && src instanceof Blob) { b = await createImageBitmap(src, { imageOrientation: 'from-image' }); own = true }
  else if (src && src.tagName === 'IMG' && !(src.complete && src.naturalWidth)) await src.decode();
  const w0 = b.naturalWidth || b.width, h0 = b.naturalHeight || b.height, k = Math.min(1, maxSide / Math.max(w0, h0));
  const W = Math.max(1, Math.round(w0 * k)), H = Math.max(1, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(b, 0, 0, W, H);
  if (own && b.close) b.close();
  const rgba = g.getImageData(0, 0, W, H).data, gray = new Uint8Array(W * H);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return { W, H, gray, rgba };
}
function fwRectify(img, q, L, Hm, r) {
  r = r > 0 ? r : Math.max(L, Hm) / 800;
  const W = Math.max(1, Math.round(L / r)), H = Math.max(1, Math.round(Hm / r)), u = hDLT([[0, 0], [1, 0], [1, 1], [0, 1]], q); if (!u) return null;
  const h = [u[0] / L, u[1] / Hm, u[2], u[3] / L, u[4] / Hm, u[5], u[6] / L, u[7] / Hm];            // мм → px кадра
  const gray = new Uint8Array(W * H), rgba = new Uint8ClampedArray(W * H * 4), S = img.rgba, IW = img.W, IH = img.H;
  for (let j = 0; j < H; j++) {
    const y = Hm - (j + 0.5) * r, ax = h[1] * y + h[2], ay = h[4] * y + h[5], aw = h[7] * y + 1;
    for (let i = 0, o = j * W * 4; i < W; i++, o += 4) {
      const x = (i + 0.5) * r, w = h[6] * x + aw, px = (h[0] * x + ax) / w - 0.5, py = (h[3] * x + ay) / w - 0.5;
      if (!(px >= 0 && py >= 0 && px <= IW - 1.001 && py <= IH - 1.001)) continue;
      const i0 = px | 0, j0 = py | 0, fx = px - i0, fy = py - j0, p = (j0 * IW + i0) * 4, pq = p + IW * 4;
      const a = (1 - fx) * (1 - fy), b = fx * (1 - fy), c = (1 - fx) * fy, d = fx * fy;
      for (let k = 0; k < 3; k++) rgba[o + k] = S[p + k] * a + S[p + 4 + k] * b + S[pq + k] * c + S[pq + 4 + k] * d;
      rgba[o + 3] = 255; gray[o >> 2] = (rgba[o] * 77 + rgba[o + 1] * 150 + rgba[o + 2] * 29) >> 8;
    }
  }
  return { W, H, r, L, Hm, gray, rgba, h, q: q.map(p => p.slice()), src: img };
}
function fwDetect(R, o) {
  o = o || {};
  const now = () => (typeof performance !== 'undefined' ? performance : Date).now(), TM = [], t00 = now(), tick = n => TM.push(n + ' ' + Math.round(now() - t00));
  const W = R.W | 0, H = R.H | 0, N = W * H, r = +R.r || 1, Hm = +R.Hm || H * r, L = +R.L || W * r;
  const Y = new Float32Array(N), CA = new Float32Array(N), CB = new Float32Array(N), src = R.rgba, gr = R.gray;
  /* попиксельные циклы — во вложенных функциях (большое тело fwDetect оптимизатор JS не берёт целиком) */
  (() => { if (src) for (let k = 0, q = 0; k < N; k++, q += 4) { const a = src[q], b = src[q + 1], c = src[q + 2]; Y[k] = gr ? gr[k] : (a * 77 + b * 150 + c * 29) / 256; CA[k] = a - b; CB[k] = (a + b) / 2 - c } else for (let k = 0; k < N; k++) Y[k] = gr[k] })();
  const bp = Math.max(1, Math.round(30 / r)), fb = Math.round(100 / r);
  const V = new Uint8Array(N); for (let j = bp; j < H - Math.max(bp, fb); j++) V.fill(1, j * W + bp, j * W + W - bp);
  const medAbs = (A, st, M) => {   /* медиана |A| по гистограмме (шаг 0,25) */
    const h = new Int32Array(1024); let n = 0;
    for (let k = 0; k < A.length; k += st) { if (M && !M[k]) continue; h[Math.min(1023, (Math.abs(A[k]) * 4) | 0)]++; n++ }
    let c = 0, m = 0; while (m < 1023 && c + h[m] < n / 2) c += h[m++]; return (m + .5) / 4;
  };
  const medBg = (A, off, cmm, wmm) => {
    const cs = Math.max(1, Math.round(cmm / r)), cx = Math.ceil(W / cs), cy = Math.ceil(H / cs), gc = new Int16Array(cx * cy).fill(-1);
    for (let cj = 0; cj < cy; cj++) for (let ci = 0; ci < cx; ci++) {
      let s = 0, n = 0;
      for (let j = cj * cs, j1 = Math.min(H, j + cs); j < j1; j++) for (let i = ci * cs, i1 = Math.min(W, i + cs), k = j * W + i; i < i1; i++, k++) if (V[k]) { s += A[k]; n++ }
      if (n * 2 >= cs * cs || (n && cs === 1)) gc[cj * cx + ci] = Math.max(0, Math.min(255, Math.round(s / n + off)));
    }
    const Rw = Math.max(1, Math.round(wmm / (cs * r))), bg = new Float32Array(cx * cy), hist = new Int32Array(256);
    for (let cj = 0; cj < cy; cj++) {   /* скользящая гистограмма; медиана сдвигается от прежней (счёт «ниже медианы» ведётся на ходу) */
      hist.fill(0); let tot = 0, m = 0, below = 0; const j0 = Math.max(0, cj - Rw), j1 = Math.min(cy - 1, cj + Rw);
      const col = (ci, d) => { for (let j = j0; j <= j1; j++) { const v = gc[j * cx + ci]; if (v >= 0) { hist[v] += d; tot += d; if (v < m) below += d } } };
      let lo = 0, hi = Math.min(cx - 1, Rw); for (let ci = lo; ci <= hi; ci++) col(ci, 1);
      for (let ci = 0; ci < cx; ci++) {
        const l2 = Math.max(0, ci - Rw), h2 = Math.min(cx - 1, ci + Rw); while (hi < h2) col(++hi, 1); while (lo < l2) col(lo++, -1);
        const half = tot / 2; while (m < 255 && below + hist[m] < half) { below += hist[m]; m++ } while (m > 0 && below >= half && below > 0) { m--; below -= hist[m] }
        bg[cj * cx + ci] = tot ? m : off;
      }
    }
    const out = new Float32Array(N);
    for (let j = 0; j < H; j++) {
      const v = Math.min(cy - 1, Math.max(0, (j + .5) / cs - .5)), b = Math.floor(v), b2 = Math.min(cy - 1, b + 1), fv = v - b;
      for (let i = 0; i < W; i++) { const u = Math.min(cx - 1, Math.max(0, (i + .5) / cs - .5)), a = Math.floor(u), a2 = Math.min(cx - 1, a + 1), fu = u - a;
        out[j * W + i] = (bg[b * cx + a] * (1 - fu) + bg[b * cx + a2] * fu) * (1 - fv) + (bg[b2 * cx + a] * (1 - fu) + bg[b2 * cx + a2] * fu) * fv - off }
    }
    return out;
  };
  /* крупный фон — робастная поверхность (полином 4-й степени по ячейкам 40 мм, веса Тьюки): свет и виньетка плавные, проёмы и короба — выбросы */
  const polyBg = (A, deg) => {
    const cs = Math.max(1, Math.round(40 / r)), cx = Math.ceil(W / cs), cy = Math.ceil(H / cs), P = [], Z = [];
    for (let cj = 0; cj < cy; cj++) for (let ci = 0; ci < cx; ci++) {
      let s = 0, n = 0;
      for (let j = cj * cs, j1 = Math.min(H, j + cs); j < j1; j++) for (let i = ci * cs, i1 = Math.min(W, i + cs), k = j * W + i; i < i1; i++, k++) if (V[k]) { s += A[k]; n++ }
      if (n * 2 >= cs * cs) { P.push([((ci + .5) * cs / W) * 2 - 1, ((cj + .5) * cs / H) * 2 - 1]); Z.push(s / n) }
    }
    const tm = [], nd = []; for (let d = 0; d <= deg; d++) { for (let a = d; a >= 0; a--) tm.push([a, d - a]); nd.push(tm.length) }   /* члены по возрастанию степени */
    const nt = tm.length, px_ = new Float64Array(deg + 1), py_ = new Float64Array(deg + 1);
    const Bf = (x, y, out) => { px_[0] = py_[0] = 1; for (let d = 1; d <= deg; d++) { px_[d] = px_[d - 1] * x; py_[d] = py_[d - 1] * y } for (let t = 0; t < nt; t++) out[t] = px_[tm[t][0]] * py_[tm[t][1]]; return out };
    const NZ = Z.length, BF = new Float64Array(NZ * nt); for (let q = 0; q < NZ; q++) BF.set(Bf(P[q][0], P[q][1], new Float64Array(nt)), q * nt);
    const fb = new Float64Array(nt), w = new Float64Array(Z.length).fill(1); let c = new Float64Array(nt);
    { const zs = Float32Array.from(Z).sort(); c[0] = zs[zs.length >> 1] || 0 }   /* старт — медиана, затем степень растёт 1…deg (по 2 прохода): крупное отличие (окно, дверь) успевает стать выбросом */
    const stg = [0]; for (let d = 1; d <= deg; d++) stg.push(d, d);
    const ex = new Uint8Array(NZ), CI = P.map(p => Math.round(((p[0] + 1) / 2 * W / cs) - .5)), CJ = P.map(p => Math.round(((p[1] + 1) / 2 * H / cs) - .5)), at = new Int32Array(cx * cy).fill(-1);
    for (let q = 0; q < NZ; q++) at[CJ[q] * cx + CI[q]] = q;
    for (let si = 0; si < stg.length; si++) {
      const d = stg[si];
      if (d === 3 && stg[si - 1] === 2) {   /* после жёсткой поверхности (2-я степень) крупные отличия (дверь, окно) исключаются насовсем, с каймой в ячейку: 4-я степень в них не прогибается */
        const res = new Float32Array(NZ); for (let q = 0; q < NZ; q++) { let v = 0; for (let t = 0, o = q * nt; t < nd[2]; t++) v += c[t] * BF[o + t]; res[q] = Z[q] - v }
        const th = Math.max(10, medAbs(res, 1) * 1.48 * 3), e0 = new Uint8Array(NZ); for (let q = 0; q < NZ; q++) if (Math.abs(res[q]) > th) e0[q] = 1;
        for (let q = 0; q < NZ; q++) if (e0[q]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = CI[q] + di, b = CJ[q] + dj; if (a >= 0 && b >= 0 && a < cx && b < cy && at[b * cx + a] >= 0) ex[at[b * cx + a]] = 1 }
      }
      const ne = nd[d];
      if (d > 0 || stg.length === 1) {
        const M = Array.from({ length: ne }, () => new Float64Array(ne + 1));
        for (let q = 0; q < NZ; q++) { if (!w[q]) continue; const o = q * nt; for (let a = 0; a < ne; a++) { const v = w[q] * BF[o + a], Ma = M[a]; Ma[ne] += v * Z[q]; for (let b = a; b < ne; b++) Ma[b] += v * BF[o + b] } }
        for (let a = 0; a < ne; a++) for (let b = 0; b < a; b++) M[a][b] = M[b][a];
        for (let a = 0; a < ne; a++) M[a][a] += 1e-6 * (M[a][a] + 1);
        for (let p = 0; p < ne; p++) { let m = p; for (let q = p + 1; q < ne; q++) if (Math.abs(M[q][p]) > Math.abs(M[m][p])) m = q; [M[p], M[m]] = [M[m], M[p]]; for (let q = p + 1; q < ne; q++) { const f = M[q][p] / M[p][p]; if (f) for (let t = p; t <= ne; t++) M[q][t] -= f * M[p][t] } }
        c = new Float64Array(nt); for (let p = ne - 1; p >= 0; p--) { let s = M[p][ne]; for (let t = p + 1; t < ne; t++) s -= M[p][t] * c[t]; c[p] = s / M[p][p] }
      }
      const res = new Float32Array(NZ); for (let q = 0; q < NZ; q++) { let v = 0; for (let t = 0, o = q * nt; t < ne; t++) v += c[t] * BF[o + t]; res[q] = Z[q] - v }
      const s = Math.max(1.5, medAbs(res, 1) * 1.48) * 4.685;
      for (let q = 0; q < Z.length; q++) { const u = res[q] / s; w[q] = ex[q] ? 0 : Math.abs(u) < 1 ? (1 - u * u) ** 2 : 0 }
    }
    const g = 8, gx = Math.ceil(W / g) + 1, gy = Math.ceil(H / g) + 1, Gd = new Float32Array(gx * gy), out = new Float32Array(N);   /* поверхность — на сетке 8 px, между узлами билинейно */
    for (let b = 0; b < gy; b++) for (let a = 0; a < gx; a++) { Bf((a * g / W) * 2 - 1, (b * g / H) * 2 - 1, fb); let v = 0; for (let t = 0; t < nt; t++) v += c[t] * fb[t]; Gd[b * gx + a] = v }
    for (let j = 0; j < H; j++) { const v = (j + .5) / g, b = Math.min(gy - 2, Math.floor(v)), fv = v - b; for (let i = 0; i < W; i++) { const u = (i + .5) / g, a = Math.min(gx - 2, Math.floor(u)), fu = u - a, q = b * gx + a; out[j * W + i] = (Gd[q] * (1 - fu) + Gd[q + 1] * fu) * (1 - fv) + (Gd[q + gx] * (1 - fu) + Gd[q + gx + 1] * fu) * fv } }
    return out;
  };
  tick('rgb');
  const bgL = polyBg(Y, 4); tick('polyY'); const bgA = polyBg(CA, 2), bgB = polyBg(CB, 2); tick('polyC'); const bgS = medBg(Y, 0, 16, 200); tick('medS');
  const DfL = new Float32Array(N), DcL = new Float32Array(N), DfS = new Float32Array(N);
  (() => { for (let k = 0; k < N; k++) { DfL[k] = Y[k] - bgL[k]; const a = CA[k] - bgA[k], b = CB[k] - bgB[k]; DcL[k] = (a < 0 ? -a : a) + (b < 0 ? -b : b); DfS[k] = Y[k] - bgS[k] } })();
  const mad = A => medAbs(A, 3, V);
  const sgS = mad(DfS) * 1.48, sgL = mad(DfL) * 1.48, sgC = mad(DcL) * 1.48;
  tick('df');
  /* ── морфология (квадрат 2r+1, раздельно по осям) и связные области ── */
  const ps = new Int32Array(Math.max(W, H) + 1);
  const morph = (A, rad, er) => {   /* скользящий счёт в окне: по строкам, затем по столбцам (счётчики столбцов — построчно, без прыжков по памяти) */
    if (rad <= 0) return A;
    const T = new Uint8Array(N), O = new Uint8Array(N), cnt = new Int32Array(W);
    for (let j = 0; j < H; j++) {
      const o = j * W; let c = 0; for (let i = 0; i < rad && i < W; i++) c += A[o + i];
      for (let i = 0; i < W; i++) { if (i + rad < W) c += A[o + i + rad]; if (i - rad - 1 >= 0) c -= A[o + i - rad - 1]; const n = (i + rad < W ? i + rad : W - 1) - (i - rad > 0 ? i - rad : 0) + 1; T[o + i] = er ? (c === n ? 1 : 0) : (c > 0 ? 1 : 0) }
    }
    for (let j = 0; j < rad && j < H; j++) for (let i = 0, o = j * W; i < W; i++) cnt[i] += T[o + i];
    for (let j = 0; j < H; j++) {
      if (j + rad < H) for (let i = 0, o = (j + rad) * W; i < W; i++) cnt[i] += T[o + i];
      if (j - rad - 1 >= 0) for (let i = 0, o = (j - rad - 1) * W; i < W; i++) cnt[i] -= T[o + i];
      const n = (j + rad < H ? j + rad : H - 1) - (j - rad > 0 ? j - rad : 0) + 1, o = j * W;
      if (er) for (let i = 0; i < W; i++) O[o + i] = cnt[i] === n ? 1 : 0; else for (let i = 0; i < W; i++) O[o + i] = cnt[i] > 0 ? 1 : 0;
    }
    return O;
  };
  const opn = (A, rad) => morph(morph(A, rad, 1), rad, 0), cls = (A, rad) => morph(morph(A, rad, 0), rad, 1);
  const label = A => {
    const Lb = new Int32Array(N), cs = [], q = new Int32Array(N);
    for (let k0 = 0; k0 < N; k0++) {
      if (!A[k0] || Lb[k0]) continue; const id = cs.length + 1; let h = 0, t = 0; const c = { id, i0: 1e9, i1: -1, j0: 1e9, j1: -1, n: 0, sd: 0, sa: 0, sc: 0 };
      q[t++] = k0; Lb[k0] = id;
      while (h < t) {
        const k = q[h++], i = k % W, j = (k / W) | 0; c.n++; c.sd += DfL[k]; c.sa += Math.abs(DfL[k]); c.sc += DcL[k];
        if (i < c.i0) c.i0 = i; if (i > c.i1) c.i1 = i; if (j < c.j0) c.j0 = j; if (j > c.j1) c.j1 = j;
        for (let dj = -1; dj <= 1; dj++) { const jj = j + dj; if (jj < 0 || jj >= H) continue; for (let di = -1; di <= 1; di++) { const ii = i + di; if (ii < 0 || ii >= W) continue; const kk = jj * W + ii; if (A[kk] && !Lb[kk]) { Lb[kk] = id; q[t++] = kk } } }
      }
      cs.push(c);
    }
    return { Lb, cs };
  };
  const holeFill = (A, mx) => {   /* дыры маски (фон, не связанный с краем кадра, ≤ mx px) — залить */
    const seen = new Uint8Array(N), q = new Int32Array(N);
    for (let k0 = 0; k0 < N; k0++) {
      if (A[k0] || seen[k0]) continue; let h = 0, t = 0, i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1, edge = 0; q[t++] = k0; seen[k0] = 1;
      while (h < t) { const k = q[h++], i = k % W, j = (k / W) | 0; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; if (i === 0 || j === 0 || i === W - 1 || j === H - 1) edge = 1;
        if (i > 0 && !A[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; q[t++] = k - 1 } if (i < W - 1 && !A[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; q[t++] = k + 1 }
        if (j > 0 && !A[k - W] && !seen[k - W]) { seen[k - W] = 1; q[t++] = k - W } if (j < H - 1 && !A[k + W] && !seen[k + W]) { seen[k + W] = 1; q[t++] = k + W } }
      if (!edge && i1 - i0 < mx && j1 - j0 < mx) for (let p = 0; p < t; p++) A[q[p]] = 1;
    }
    return A;
  };
  const xm = i => i * r, ym = j => Hm - j * r;   /* край px (непрерывн.) → мм стены */
  const box = (i0, j0, i1, j1) => ({ x0: xm(i0), x1: xm(i1 + 1), y0: ym(j1 + 1), y1: ym(j0) });
  const cl_ = (v, a, b) => v < a ? a : v > b ? b : v;
  const stat = (A, i0, j0, i1, j1, f) => { let s = 0, n = 0; i0 = cl_(i0, 0, W - 1); i1 = cl_(i1, 0, W - 1); j0 = cl_(j0, 0, H - 1); j1 = cl_(j1, 0, H - 1); for (let j = j0; j <= j1; j++) for (let i = i0, k = j * W + i; i <= i1; i++, k++) { s += f ? f(A[k]) : A[k]; n++ } return n ? s / n : 0 };
  const items = [], zones = [], dbgI = [];
  /* ── края: сглаживание 3×3, производные, подавление немаксимумов; знак края ── */
  const S3 = new Float32Array(N);
  (() => { const T = new Float32Array(N); for (let j = 0; j < H; j++) for (let i = 0, k = j * W; i < W; i++, k++) T[k] = (Y[i > 0 ? k - 1 : k] + Y[k] + Y[i < W - 1 ? k + 1 : k]) / 3;
    for (let j = 0; j < H; j++) for (let i = 0, k = j * W; i < W; i++, k++) S3[k] = (T[j > 0 ? k - W : k] + T[k] + T[j < H - 1 ? k + W : k]) / 3 })();
  const GX = new Float32Array(N), GY = new Float32Array(N);
  (() => { for (let j = 1; j < H - 1; j++) for (let i = 1, k = j * W + 1; i < W - 1; i++, k++) { GX[k] = S3[k + 1] - S3[k - 1]; GY[k] = S3[k + W] - S3[k - W] } })();
  const tE = Math.max(5, 4 * 1.48 * medAbs(GX, 3, V));
  const EV = new Int8Array(N), EH = new Int8Array(N);
  (() => { for (let j = 1; j < H - 1; j++) for (let i = 1, k = j * W + 1; i < W - 1; i++, k++) {
    const a = Math.abs(GX[k]); if (a >= tE && a >= Math.abs(GX[k - 1]) && a >= Math.abs(GX[k + 1])) EV[k] = GX[k] > 0 ? 1 : -1;
    const b = Math.abs(GY[k]); if (b >= tE && b >= Math.abs(GY[k - W]) && b >= Math.abs(GY[k + W])) EH[k] = GY[k] > 0 ? 1 : -1;
  } })();
  const DV = new Uint8Array(N), DH = new Uint8Array(N);   /* края с допуском ±1 px поперёк */
  (() => { for (let j = 1; j < H - 1; j++) for (let i = 1, k = j * W + 1; i < W - 1; i++, k++) { DV[k] = EV[k - 1] || EV[k] || EV[k + 1] ? 1 : 0; DH[k] = EH[k - W] || EH[k] || EH[k + W] ? 1 : 0 } })();
  const PV = new Int32Array((H + 1) * W), PH = new Int32Array(H * (W + 1));
  (() => { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { PV[(j + 1) * W + i] = PV[j * W + i] + DV[j * W + i]; PH[j * (W + 1) + i + 1] = PH[j * (W + 1) + i] + DH[j * W + i] } })();
  const covV = (i, a, b) => { a = cl_(a, 0, H - 1); b = cl_(b, 0, H - 1); if (b < a) return 0; let m = 0; for (let c = Math.max(0, i - 1); c <= Math.min(W - 1, i + 1); c++) m = Math.max(m, PV[(b + 1) * W + c] - PV[a * W + c]); return m / (b - a + 1) };
  const covH = (j, a, b) => { a = cl_(a, 0, W - 1); b = cl_(b, 0, W - 1); if (b < a) return 0; let m = 0; for (let c = Math.max(0, j - 1); c <= Math.min(H - 1, j + 1); c++) m = Math.max(m, PH[c * (W + 1) + b + 1] - PH[c * (W + 1) + a]); return m / (b - a + 1) };
  /* прямые отрезки краёв: серии вдоль столбца (vert) / строки с разрывом ≤ 20 мм; ступень stp и линия lin поперёк */
  const d2 = Math.max(3, Math.round(25 / r));
  const segs = (vert, minMM) => {   /* ведение края по тонким (после подавления) пикселям со сдвигом ±1 px на шаг: допускает наклон (неточные углы стены), затем прямая МНК */
    const out = [], Lp = vert ? H : W, Mp = vert ? W : H, E = vert ? EV : EH, minL = Math.round(minMM / r), gap = Math.max(2, Math.round(20 / r)), used = new Uint8Array(N);
    const at = vert ? (t, m) => t * W + m : (t, m) => m * W + t;
    for (let t0 = 1; t0 < Lp - 1; t0++) for (let m0 = 1; m0 < Mp - 1; m0++) {
      const k0 = at(t0, m0); if (!E[k0] || used[k0]) continue;
      let m = m0, last = t0, n = 0, St = 0, Sm = 0, Stm = 0, Stt = 0;
      for (let t = t0; t < Lp - 1 && t - last <= gap; t++) {
        let hit = -1; if (E[at(t, m)]) hit = m; else if (m > 1 && E[at(t, m - 1)]) hit = m - 1; else if (m < Mp - 2 && E[at(t, m + 1)]) hit = m + 1;
        if (hit < 0) continue; m = hit; last = t; used[at(t, m)] = 1; n++; St += t; Sm += m; Stm += t * m; Stt += t * t;
      }
      if (last - t0 + 1 < minL) continue;
      const den = n * Stt - St * St, bb = den > 0 ? (n * Stm - St * Sm) / den : 0, aa = (Sm - bb * St) / n;
      if (Math.abs(bb) > .07) continue;   /* не круче 4° от оси */
      out.push({ v: vert, m: Math.round(aa + bb * (t0 + last) / 2), m0: aa + bb * t0, tl: bb, a: t0, b: last, n });
    }
    out.sort((p, q) => q.n - p.n); const keep = [];
    for (const s of out) if (!keep.some(k => Math.abs(k.m - s.m) <= 2 && Math.min(k.b, s.b) - Math.max(k.a, s.a) > 0.5 * (s.b - s.a))) keep.push(s);
    for (const s of keep) {   /* ступень (сторона «+» минус «−») и линия (середина минус стороны) — вдоль наклонной прямой */
      let st = 0, li = 0, n = 0;
      for (let t = s.a; t <= s.b; t++) { const m0 = Math.round(s.m0 + s.tl * (t - s.a)); if (m0 - d2 < 0 || m0 + d2 >= (vert ? W : H)) continue; const f = q => vert ? S3[t * W + q] : S3[q * W + t]; st += f(m0 + d2) - f(m0 - d2); li += f(m0) - (f(m0 + d2) + f(m0 - d2)) / 2; n++ }
      s.stp = n ? st / n : 0; s.lin = n ? li / n : 0; s.len = (s.b - s.a + 1) * r;
    }
    return keep;
  };

  tick('edges');
  const SV = segs(1, 150), SH = segs(0, 150);
  /* признаки прямоугольника (px, включительно): покрытие сторон краями, полосы внутри / снаружи сторон, содержимое */
  const feat = (i0, j0, i1, j1) => {
    const w = i1 - i0 + 1, h = j1 - j0 + 1, dB = Math.max(2, Math.round(50 / r)), f = {};
    f.cT = covH(j0, i0, i1); f.cB = covH(j1, i0, i1); f.cL = covV(i0, j0, j1); f.cR = covV(i1, j0, j1);
    f.tIn = stat(DfL, i0 + dB, j0 + 2, i1 - dB, j0 + dB); f.tOut = stat(DfL, i0 + dB, j0 - dB, i1 - dB, j0 - 2);
    f.bIn = stat(DfL, i0 + dB, j1 - dB, i1 - dB, j1 - 2); f.bOut = stat(DfL, i0 + dB, j1 + 2, i1 - dB, j1 + dB);
    f.lIn = stat(DfL, i0 + 2, j0 + dB, i0 + dB, j1 - dB); f.lOut = stat(DfL, i0 - dB, j0 + dB, i0 - 2, j1 - dB);
    f.rIn = stat(DfL, i1 - dB, j0 + dB, i1 - 2, j1 - dB); f.rOut = stat(DfL, i1 + 2, j0 + dB, i1 + dB, j1 - dB);
    const a0 = i0 + Math.round(w * .15), a1 = i1 - Math.round(w * .15), b0 = j0 + Math.round(h * .15), b1 = j1 - Math.round(h * .15);
    let ne = 0, nv = 0, nh = 0, n = 0, s = 0, s2 = 0;
    for (let j = b0; j <= b1; j++) for (let i = a0, k = j * W + i; i <= a1; i++, k++) { n++; if (EV[k]) nv++; if (EH[k]) nh++; if (EV[k] || EH[k]) ne++; s += DfL[k]; s2 += DfL[k] * DfL[k] }
    f.ied = n ? ne / n : 0; f.iev = n ? nv / n : 0; f.ieh = n ? nh / n : 0; f.md = n ? s / n : 0; f.sd = n ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) : 0;
    f.chr = stat(DcL, a0, b0, a1, b1); f.ring = (f.tOut + f.bOut + f.lOut + f.rOut) / 4;
    f.bri = stat(DfL, a0, b0, a1, b1, v => v > f.ring + 15 ? 1 : 0); f.drk = stat(DfL, a0, b0, a1, b1, v => v < f.ring - 25 ? 1 : 0);
    return f;
  };
  const fstr = f => Object.entries(f).map(([k, v]) => k + (Math.abs(v) < 1 ? v.toFixed(2) : v.toFixed(0))).join(' ');
  tick('segs');
  /* ═ крупные: маска отличий от фона ═ */
  const tB = Math.min(30, Math.max(14, 2.5 * sgL)), tC = Math.min(40, Math.max(16, 4 * sgC));
  let MB = new Uint8Array(N); (() => { for (let k = 0; k < N; k++) MB[k] = V[k] && (Math.abs(DfL[k]) > tB || DcL[k] > tC) ? 1 : 0 })();
  MB = opn(cls(MB, 2), Math.max(1, Math.round(25 / r)));
  const LB = label(MB); let cand = [];
  for (const c of LB.cs) {
    if ((c.i1 - c.i0 + 1) * r < 150 || (c.j1 - c.j0 + 1) * r < 150) continue;
    const tmin = Math.max(2, Math.round(40 / r)), rows = new Int32Array(c.j1 - c.j0 + 1);
    for (let j = c.j0; j <= c.j1; j++) for (let i = c.i0, k = j * W + i; i <= c.i1; i++, k++) if (LB.Lb[k] === c.id) rows[j - c.j0]++;
    /* перешеек (строки почти без маски) делит область по высоте: окно с подоконником — отдельно от радиатора под ним */
    const mr = Math.max(...rows), low = Math.max(1, .08 * mr), parts = []; let s0 = 0;
    for (let q = 0; q <= rows.length; q++) { if (q < rows.length && rows[q] > low) continue; let e = q; while (q < rows.length && rows[q] <= low) q++; if (q - e >= 2 || q >= rows.length) { if (e - 1 >= s0) parts.push([s0, e - 1]); s0 = q } }
    for (const [pa, pb] of parts) {
      if ((pb - pa + 1) * r < 150) continue;
      const cols = new Int32Array(c.i1 - c.i0 + 1); for (let j = c.j0 + pa; j <= c.j0 + pb; j++) for (let i = c.i0, k = j * W + i; i <= c.i1; i++, k++) if (LB.Lb[k] === c.id) cols[i - c.i0]++;
      let r0 = pa, r1 = pb, c0 = 0, c1 = cols.length - 1;
      while (r0 < r1 && rows[r0] < tmin) r0++; while (r1 > r0 && rows[r1] < tmin) r1--; while (c0 < c1 && cols[c0] < tmin) c0++; while (c1 > c0 && cols[c1] < tmin) c1--;
      if ((c1 - c0 + 1) * r < 150) continue;
      cand.push({ i0: c.i0 + c0, i1: c.i0 + c1, j0: c.j0 + r0, j1: c.j0 + r1, src: 'm' });
    }
  }
  /* вложенные (содержимое окна) — в объемлющую */
  cand.sort((a, b) => (b.i1 - b.i0) * (b.j1 - b.j0) - (a.i1 - a.i0) * (a.j1 - a.j0));
  { const g = Math.round(40 / r), k2 = []; for (const c of cand) if (!k2.some(p => c.i0 >= p.i0 - g && c.i1 <= p.i1 + g && c.j0 >= p.j0 - g && c.j1 <= p.j1 + g)) k2.push(c); cand = k2 }
  /* прилипание сторон прямоугольника к краям: каждая сторона ищется в ±s px по максимуму покрытия (2 прохода) */
  const snap = (c, smm) => {
    const s = Math.max(2, Math.round(smm / r)); let { i0, j0, i1, j1 } = c;
    for (let it = 0; it < 2; it++) {
      let bj = j0, bv = covH(j0, i0, i1) + .05; for (let j = j0 - s; j <= j0 + s; j++) { const v = covH(j, i0, i1); if (j < j1 - 4 && v > bv) { bv = v; bj = j } } j0 = bj;
      bj = j1; bv = covH(j1, i0, i1) + .05; for (let j = j1 - s; j <= j1 + s; j++) { const v = covH(j, i0, i1); if (j > j0 + 4 && v > bv) { bv = v; bj = j } } j1 = bj;
      let bi = i0; bv = covV(i0, j0, j1) + .05; for (let i = i0 - s; i <= i0 + s; i++) { const v = covV(i, j0, j1); if (i < i1 - 4 && v > bv) { bv = v; bi = i } } i0 = bi;
      bi = i1; bv = covV(i1, j0, j1) + .05; for (let i = i1 - s; i <= i1 + s; i++) { const v = covV(i, j0, j1); if (i > i0 + 4 && v > bv) { bv = v; bi = i } } i1 = bi;
    }
    return { ...c, i0: cl_(i0, 0, W - 1), j0: cl_(j0, 0, H - 1), i1: cl_(i1, 0, W - 1), j1: cl_(j1, 0, H - 1) };
  };
  const big = [], add = (k, c, conf, why, y0f) => { const b = box(c.i0, c.j0, c.i1, c.j1); if (y0f) b.y0 = 0; big.push({ k, ...b, px: [c.i0, c.j0, c.i1, c.j1], conf, why }) };
  const iouB = (a, b) => { const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (w <= 0 || h <= 0) return 0; const I = w * h; return I / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - I) };
  for (const c0 of cand) {
    const b0 = box(c0.i0, c0.j0, c0.i1, c0.j1), w0 = b0.x1 - b0.x0, h0 = b0.y1 - b0.y0;
    if (w0 < 250 && h0 > 0.5 * Hm) continue;   /* узкая полоса во всю высоту — стояк / короб, ниже */
    const c = w0 < 800 && h0 < 800 ? snap(c0, 60) : c0, b = box(c.i0, c.j0, c.i1, c.j1), w = b.x1 - b.x0, h = b.y1 - b.y0, f = feat(c.i0, c.j0, c.i1, c.j1);
    const ia = c.i0 + Math.round((c.i1 - c.i0) * .25), ib = c.i1 - Math.round((c.i1 - c.i0) * .25), ja = c.j0 + Math.round((c.j1 - c.j0) * .25), jb = c.j1 - Math.round((c.j1 - c.j0) * .25);
    f.ied25 = stat(EV, ia, ja, ib, jb, v => v ? 1 : 0) + stat(EH, ia, ja, ib, jb, v => v ? 1 : 0);
    f.inner = SV.filter(s => s.m > c.i0 + (c.i1 - c.i0) * .15 && s.m < c.i1 - (c.i1 - c.i0) * .15 && s.a < c.j1 && s.b > c.j0 && Math.min(s.b, c.j1) - Math.max(s.a, c.j0) > .4 * (c.j1 - c.j0)).length
      + SH.filter(s => s.m > c.j0 + (c.j1 - c.j0) * .15 && s.m < c.j1 - (c.j1 - c.j0) * .15 && s.a < c.i1 && s.b > c.i0 && Math.min(s.b, c.i1) - Math.max(s.a, c.i0) > .4 * (c.i1 - c.i0)).length;
    const why = `w${w | 0} h${h | 0} ` + fstr(f), touchF = b.y0 < 200, touchC = b.y1 > Hm - 120;
    const rec = f.tIn < f.tOut - 30 || (f.lIn < f.lOut - 40 && f.tIn < f.tOut - 15) || (f.rIn < f.rOut - 40 && f.tIn < f.tOut - 15);   /* утоплено: тень откоса внутри сверху / сбоку */
    const sides = (f.cT >= .5) + (f.cB >= .5) + (f.cL >= .5) + (f.cR >= .5);
    if (touchF && h >= 1500 && w >= 500 && w <= 2400 && !touchC) add('door', c, .6 + .1 * sides / 4 * 3, why, 1);
    else if (f.chr >= 50 || b.y0 < 350 || touchC) { if (w >= 250 && h >= 250) zones.push({ ...b, why }) }
    else if (rec && w >= 180 && h >= 180) { const wv = f.ied25 * 10 + f.bri * 2 + f.chr / 40; add(w >= 400 && h >= 400 && wv >= .6 ? 'win' : 'nis', c, .5 + .1 * sides, why + ' wv' + wv.toFixed(2)) }
    else if (!rec && w >= 180 && h >= 180 && w <= 700 && h <= 700 && sides >= 3) add('shch', c, .4 + .1 * sides, why);
    else if (w >= 250 && h >= 250) zones.push({ ...b, why });
  }
  /* дверь по краям: две длинные вертикали от пола (наличник / откос) 550–1500 мм друг от друга + перекладина сверху */
  { const SD = SV.filter(s => ym(s.b + 1) < 260 && s.len >= 1400 && ym(s.a) >= 1700 && ym(s.a) <= Hm - 150), pr = [];
    for (const p of SD) for (const q of SD) {
      if (q.m <= p.m) continue; const wm = (q.m - p.m) * r; if (wm < 550 || wm > 1500 || Math.abs(p.a - q.a) * r > 150) continue;
      if (Math.max(Math.abs(p.stp), Math.abs(q.stp)) < 10 || (Math.abs(p.lin) > Math.abs(p.stp) && Math.abs(q.lin) > Math.abs(q.stp))) continue;   /* швы плитки — линии без ступени: не наличник */
      const jt = Math.min(p.a, q.a); let ct = 0, bj = jt; for (let j = jt - 3; j <= Math.max(p.a, q.a) + 3; j++) { const v = covH(j, p.m, q.m); if (v > ct) { ct = v; bj = j } }
      if (ct < .6) continue; pr.push({ i0: p.m, i1: q.m, j0: bj, j1: Math.max(p.b, q.b), sc: (p.n + q.n) / (2 * (Math.max(p.b, q.b) - bj + 1)) + ct, why: `pair ${p.stp | 0}/${q.stp | 0} ct${ct.toFixed(2)}` });
    }
    pr.sort((a, b) => b.sc - a.sc);
    for (const d of pr) {
      const b = box(d.i0, d.j0, d.i1, d.j1); b.y0 = 0; const e = big.find(e => iouB(e, b) > .2);
      if (e) { if (e.k === 'door' && !e.pr && b.x0 >= e.x0 - 50 && b.x1 <= e.x1 + 50 && b.y1 <= e.y1 + 50) { Object.assign(e, { x0: b.x0, x1: b.x1, y1: b.y1, px: [d.i0, d.j0, d.i1, d.j1], pr: 1, conf: Math.max(e.conf, .7), why: e.why + ' | ' + d.why }) } continue }   /* дверь по маске уточняется по рёбрам */
      add('door', d, .5 + .2 * Math.min(1, d.sc - 1), d.why, 1); big[big.length - 1].pr = 1;
    }
  }
  tick('big');
  /* короб / колонна: вертикали во всю высоту со ступенью яркости (швы плитки и мрамора — линии без ступени — не в счёт) */
  const vH = (H - bp - Math.max(bp, fb)) * r;
  const SF = SV.filter(s => s.len >= .85 * vH && Math.abs(s.stp) >= 15 && s.m > bp + 2 && s.m < W - bp - 3 && !big.some(e => xm(s.m) > e.x0 - 30 && xm(s.m) < e.x1 + 30)).sort((a, b) => a.m - b.m);
  const longIn = (i0, i1) => SV.some(s => s.len >= .5 * vH && s.m > i0 + 6 && s.m < i1 - 6);   /* внутри полосы — длинные вертикали (труба, шов): не короб / колонна */
  const used = new Set();
  { const pr = [];
    for (const p of SF) for (const q of SF) {
      if (q.m <= p.m) continue; const wm = (q.m - p.m) * r; if (wm < 170 || wm > 1200) continue;
      if (SF.some(s => s !== p && s !== q && s.m > p.m + 3 && s.m < q.m - 3) || longIn(p.m, q.m)) continue;   /* внутри — без других рёбер */
      const o1 = Math.round(60 / r), o2 = Math.round(200 / r), fi = stat(DfL, p.m + 3, 0, q.m - 3, H - 1), fl_ = stat(DfL, p.m - o2, 0, p.m - o1, H - 1), fr_ = stat(DfL, q.m + o1, 0, q.m + o2, H - 1);   /* стена — за тенью и каналом у ребра: 60–200 мм */
      if (!(p.stp * q.stp < 0 || (fi - fl_) * (fi - fr_) > 64)) continue;   /* грань короба отличается от стены по обе стороны */
      pr.push({ p, q, sc: Math.abs(p.stp) + Math.abs(q.stp) });
    }
    pr.sort((a, b) => b.sc - a.sc);
    for (const { p, q, sc } of pr) { if (used.has(p) || used.has(q)) continue; used.add(p); used.add(q); add('kor', { i0: p.m, i1: q.m, j0: Math.min(p.a, q.a), j1: Math.max(p.b, q.b) }, Math.min(.8, .4 + sc / 200), `pair ${p.stp | 0}/${q.stp | 0}`, 1); big[big.length - 1].y1 = Hm }
    for (const s of SF) {
      if (used.has(s)) continue; const xl = xm(s.m), side = xl < L / 2 ? 0 : 1, wm = side ? L - xl : xl;
      if (wm < 250 || wm > 1500) continue;
      if (SF.some(t => t !== s && (side ? t.m > s.m + 3 : t.m < s.m - 3)) || (side ? longIn(s.m, W - 1) : longIn(0, s.m))) continue;
      used.add(s); add('kol', side ? { i0: s.m, i1: W - 1, j0: s.a, j1: s.b } : { i0: 0, i1: s.m, j0: s.a, j1: s.b }, .5, `edge ${s.stp | 0}`, 1); const e = big[big.length - 1]; e.y1 = Hm; if (side) e.x1 = L; else e.x0 = 0;
    }
  }
  /* ═ трассы: прямые полосы постоянной ширины вдоль осей (кабель-каналы, трубы); ведение по сериям маски ═ */
  const ZM = new Uint8Array(N), zmark = (x0, y0, x1, y1, m) => { const i0 = cl_(Math.floor((x0 - m) / r), 0, W - 1), i1 = cl_(Math.ceil((x1 + m) / r), 0, W - 1), j0 = cl_(Math.floor((Hm - y1 - m) / r), 0, H - 1), j1 = cl_(Math.ceil((Hm - y0 + m) / r), 0, H - 1); for (let j = j0; j <= j1; j++) ZM.fill(1, j * W + i0, j * W + i1 + 1) };
  for (const e of big) { const m = e.k === 'win' ? 120 : e.k === 'door' ? 100 : e.k === 'kol' || e.k === 'kor' ? 60 : 40; zmark(e.x0, (e.k === 'win' ? e.y0 - 110 : e.y0), e.x1, e.y1, m) } for (const z of zones) zmark(z.x0, z.y0, z.x1, z.y1, 40);
  const tS = Math.max(12, 3.5 * sgS);
  const tR = Math.max(9, 2.5 * sgS);
  /* два масштаба: каналы — отличие от медианы ±60 мм (тень угла и свет не мешают), трубы — от медианы ±200 мм */
  const bgE = medBg(Y, 0, 8, 60), DfE = new Float32Array(N); let MR = new Uint8Array(N), MRe = new Uint8Array(N);
  (() => { for (let k = 0; k < N; k++) { DfE[k] = Y[k] - bgE[k]; MR[k] = V[k] && !ZM[k] && Math.abs(DfS[k]) > tR ? 1 : 0; MRe[k] = V[k] && !ZM[k] && Math.abs(DfE[k]) > tR ? 1 : 0 } })();
  MR = cls(MR, 2); MRe = cls(MRe, 1);
  const runsOf = (MR, vert) => { const Lr = vert ? H : W, Lc = vert ? W : H, rs = []; for (let t = 0; t < Lr; t++) { const row = []; let s0 = -1; for (let u = 0; u <= Lc; u++) { const on = u < Lc && MR[vert ? t * W + u : u * W + t]; if (on && s0 < 0) s0 = u; if (!on && s0 >= 0) { row.push([s0, u - 1]); s0 = -1 } } rs.push(row) } return rs };
  const rts = [];
  const trace = (M, vert, D, mode) => {
    const rs = runsOf(M, vert), Lr = rs.length, used = rs.map(q => new Uint8Array(q.length)), wmin = Math.max(3, Math.round(15 / r)), wmax = Math.round(260 / r), gapM = Math.max(4, Math.round(120 / r)), minL = Math.round(300 / r);
    for (let t0 = 0; t0 < Lr; t0++) for (let q0 = 0; q0 < rs[t0].length; q0++) {
      if (used[t0][q0]) continue; const [s0, e0] = rs[t0][q0], w0 = e0 - s0 + 1; if (w0 < wmin || w0 > wmax) continue;
      const path = [[t0, s0, e0]]; used[t0][q0] = 1;
      for (const dir of [1, -1]) {
        let t = t0, miss = 0, c0 = (s0 + e0) / 2;   /* центр плывёт понемногу: стена по неточным углам чуть наклонена */
        while (true) {
          t += dir; if (t < 0 || t >= Lr) break; let hit = 0;
          for (let q = 0; q < rs[t].length; q++) { const [s1, e1] = rs[t][q]; if (s1 <= c0 + 1 && e1 >= c0 - 1) { const ww = e1 - s1 + 1, cc = (s1 + e1) / 2; if (ww <= 2.5 * w0 + 2 && ww >= .4 * w0 && Math.abs(cc - c0) <= Math.max(2, .4 * w0)) { path.push([t, s1, e1]); used[t][q] = 1; hit = 1; if (ww <= 1.4 * w0 + 1) c0 += Math.max(-.25, Math.min(.25, cc - c0)) } break } }
          if (hit) miss = 0; else if (++miss > gapM) break;
        }
      }
      if (path.length < minL * .6) continue;
      const ws = path.map(p => p[2] - p[1] + 1).sort((a, b) => a - b), wm = ws[ws.length >> 1];
      if (wm < wmin) continue;
      let fp = path.filter(p => p[2] - p[1] + 1 >= .65 * wm && p[2] - p[1] + 1 <= 1.3 * wm + 1), tl = 0, cm = 0, tm = 0;   /* ось — прямая МНК по центрам (наклон ≤ 4°) */
      for (let it = 0; it < 2 && fp.length > 2; it++) {
        let n = 0, St = 0, Sc = 0, Stc = 0, Stt = 0; for (const p of fp) { const c = (p[1] + p[2]) / 2; n++; St += p[0]; Sc += c; Stc += p[0] * c; Stt += p[0] * p[0] }
        const den = n * Stt - St * St; tl = den > 0 ? (n * Stc - St * Sc) / den : 0; tm = St / n; cm = Sc / n;
        fp = fp.filter(p => Math.abs((p[1] + p[2]) / 2 - (cm + tl * (p[0] - tm))) <= Math.max(1.5, .25 * wm));
      }
      if (fp.length < 3 || Math.abs(tl) > .07) continue;
      const keep = fp.sort((a, b) => a[0] - b[0]);
      let best = null, cur = null;   /* самый длинный участок с разрывами ≤ gapM */
      for (const p of keep) { if (cur && p[0] - cur.b <= gapM) { cur.b = p[0]; cur.rows.push(p) } else { cur = { a: p[0], b: p[0], rows: [p] } } if (!best || cur.b - cur.a > best.b - best.a) best = cur }
      if (!best || best.b - best.a + 1 < minL || best.rows.length < .7 * (best.b - best.a + 1)) continue;
      const tc = (best.a + best.b) / 2; rts.push({ vert, c: cm + tl * (tc - tm), tl, w: wm, a: best.a, b: best.b, rows: best.rows, D, mode });
    }
  };
  tick('rmask');
  trace(MR, 1, DfS, 'p'); trace(MR, 0, DfS, 'p'); trace(MRe, 1, DfE, 'e'); trace(MRe, 0, DfE, 'e');
  /* соседние параллельные полосы (тень + тело трубы + теневая сторона) — в одну */
  rts.sort((p, q) => p.c - q.c);
  for (let i = 0; i < rts.length; i++) for (let j = i + 1; j < rts.length; j++) {
    const p = rts[i], q = rts[j]; if (p.vert !== q.vert || p.mode !== q.mode) continue;
    const g = (q.c - q.w / 2) - (p.c + p.w / 2), ov = Math.min(p.b, q.b) - Math.max(p.a, q.a);
    if (g > Math.max(3, 45 / r) || g < -Math.min(p.w, q.w) || ov < .5 * Math.min(p.b - p.a, q.b - q.a)) continue;
    const l = Math.min(p.c - p.w / 2, q.c - q.w / 2), rr = Math.max(p.c + p.w / 2, q.c + q.w / 2), lg = p.b - p.a >= q.b - q.a ? p : q;
    rts[i] = { vert: p.vert, D: p.D, mode: p.mode, c: (l + rr) / 2, tl: lg.tl, w: rr - l, a: lg.a, b: lg.b, rows: lg.rows, parts: (p.parts || 1) + (q.parts || 1) }; rts.splice(j, 1); j = i;
  }
  tick('trace');
  const RT = [];
  for (const t of rts) {   /* поперечный профиль DfS; края полосы — резкие с обеих сторон (плавный перепад света / тень в углу — не трасса) */
    const half = Math.ceil(t.w / 2) + 2, n = 2 * half + 1, P = new Float32Array(n), Q = new Int32Array(n), c0 = Math.round(t.c), Mx = t.vert ? W : H, tm = (t.a + t.b) / 2, cu = u => Math.round(t.c + t.tl * (u - tm));
    for (let u = t.a; u <= t.b; u++) for (let d = -half; d <= half; d++) { const v = cu(u) + d; if (v < 0 || v >= Mx) continue; P[d + half] += t.D[t.vert ? u * W + v : v * W + u]; Q[d + half]++ }
    for (let q = 0; q < n; q++) P[q] = Q[q] ? P[q] / Q[q] : 0;
    const PS = t.D === DfS ? P : new Float32Array(n);   /* для труб — профиль по крупному фону (±200 мм): тень с плавным краем не похожа на силуэт */
    if (PS !== P) { Q.fill(0); for (let u = t.a; u <= t.b; u++) for (let d = -half; d <= half; d++) { const v = cu(u) + d; if (v < 0 || v >= Mx) continue; PS[d + half] += DfS[t.vert ? u * W + v : v * W + u]; Q[d + half]++ } for (let q = 0; q < n; q++) PS[q] = Q[q] ? PS[q] / Q[q] : 0 }
    const DD = t.vert ? DV : DH, cov = off => { let c = 0; for (let u = t.a; u <= t.b; u++) { const v0 = Math.round(t.c + t.tl * (u - tm) + off); let on = 0; for (let v = v0 - 1; v <= v0 + 1; v++) if (v >= 0 && v < Mx && DD[t.vert ? u * W + v : v * W + u]) on = 1; c += on } return c / (t.b - t.a + 1) };   /* покрытие краем вдоль наклонной */
    const ce0 = cov(-t.w / 2), ce1 = cov(t.w / 2);
    let mx = -1e9, mn = 1e9, nb = 0, sb = 0; for (let q = 0; q < n; q++) { mx = Math.max(mx, P[q]); mn = Math.min(mn, P[q]); if (P[q] > tR * .6) { nb++; sb += q } }
    let ia = 0, ib = 0, ga = 0, gb = 0; for (let q = 1; q < n - 1; q++) { const g = PS[q + 1] - PS[q - 1]; if (g > ga) { ga = g; ia = q } if (-g > gb) { gb = -g; ib = q } }   /* силуэт трубы — крайние резкие перепады (тень на стене — плавная, отбрасывается) */
    { const gm = Math.max(ga, gb) * .5; let lo = n, hi = -1; for (let q = 1; q < n - 1; q++) if (Math.abs(PS[q + 1] - PS[q - 1]) >= gm) { lo = Math.min(lo, q); hi = Math.max(hi, q) } if (hi > lo) { ia = lo; ib = hi } }
    const len = (t.b - t.a + 1) * r, core = []; for (let q = 0; q < n; q++) if (P[q] > tR * .6) core.push(P[q]);
    const why = `${t.vert ? 'V' : 'H'} w${(t.w * r) | 0} len${len | 0} ce${ce0.toFixed(2)}/${ce1.toFixed(2)} nb${nb} mx${mx | 0} mn${mn | 0} [${Array.from(P, v => Math.round(v)).join(',')}]`;
    if (o.dbg) dbgI.push({ k: 'rt?', ...(t.vert ? { x0: xm(t.c - t.w / 2), x1: xm(t.c + t.w / 2), y0: ym(t.b + 1), y1: ym(t.a) } : { x0: xm(t.a), x1: xm(t.b + 1), y0: ym(t.c + t.w / 2), y1: ym(t.c - t.w / 2) }), conf: 0, why });
    if (t.mode === 'e' && (ce0 < .35 || ce1 < .35)) {   /* края не у полосы: может быть, светлое ядро (канал) слилось с тенью угла — проверить края ядра */
      let qa = -1, qb = -1, best = 0; for (let q = 0, a0 = -1; q <= n; q++) { if (q < n && P[q] > tR * .6) { if (a0 < 0) a0 = q } else if (a0 >= 0) { if (q - a0 > best) { best = q - a0; qa = a0; qb = q - 1 } a0 = -1 } }
      if (best < 3) continue;
      const ca = cov(qa - half - (t.c - c0)), cb = cov(qb + 1 - half - (t.c - c0));
      if (ca < .35 || cb < .35) continue;
      const wbk = best * r; if (wbk < 12 || wbk > 70 || len < 300) continue;
      RT.push({ t: 'el', d: wbk, vert: t.vert, c: c0 - half + (qa + qb) / 2, tl: t.tl, a: t.a, b: t.b, w: best + 2, rows: t.rows, c0: c0 - half + (qa + qb) / 2, conf: Math.min(.8, .4 + .2 * Math.min(ca, cb) + (len > 1000 ? .1 : 0)), why: why + ' core' });
      continue;
    }
    const flat = core.length >= 2 && (core.filter(v => v >= .75 * mx).length >= .6 * core.length || (core.filter(v => v >= .5 * mx).length >= .85 * core.length && nb * r <= 45)), wb = nb * r;   /* канал — плоская светлая полоса; труба — «колокол» */
    let tt = '', d = 0, cc = t.c;
    if (ce0 < .35 || ce1 < .35) continue;
    if (t.mode === 'e') { if (nb && wb >= 12 && wb <= 70 && flat && mx >= tR && len >= 300) { tt = 'el'; d = wb; cc = t.c - half + sb / nb }
    else if (t.w * r <= 70 && mx >= .6 * tR && nb && len >= 300 && !(len >= .4 * (t.vert ? Hm : L) && Math.min(ga, gb) >= Math.max(tR, .35 * Math.max(ga, gb)) && !flat)) { tt = 'el'; d = Math.max(wb, t.w * r * .6); cc = t.c } }   /* бледный канал с чёткой тенью */
    if (!tt && !(nb && wb >= 12 && wb <= 70 && flat && mx >= tR) && len >= .4 * (t.vert ? Hm : L) && t.w * r >= 20 && Math.min(ga, gb) >= Math.max(tR, .35 * Math.max(ga, gb))) { const sp = Math.abs(ib - ia) * r; d = sp >= 20 && sp <= t.w * r ? sp : t.w * r; tt = d >= 80 ? 'dr' : 'wa'; cc = ia && ib ? c0 - half + (ia + ib) / 2 : t.c; t.pipe = 1 }
    if (!tt) continue;
    RT.push({ t: tt, d, vert: t.vert, c: cc, tl: t.tl, a: t.a, b: t.b, w: t.w, rows: t.rows, pipe: t.pipe, c0: t.c, conf: Math.min(.85, .45 + .2 * Math.min(ce0, ce1) + (len > 1000 ? .1 : 0)), why });
  }
  RT.sort((p, q) => p.a - q.a);
  for (let i = 0; i < RT.length; i++) for (let j = i + 1; j < RT.length; j++) {   /* соосные куски одной трассы (разрыв ≤ 150 мм: стык, тройник) — в одну */
    const p = RT[i], q = RT[j]; if (p.vert !== q.vert || (p.t === 'el') !== (q.t === 'el') || Math.abs(p.c - q.c) > Math.max(3, 15 / r) || q.a - p.b > 150 / r) continue;
    if (Math.min(p.b, q.b) - q.a > .3 * Math.min(p.b - p.a, q.b - q.a)) { if (q.b - q.a > p.b - p.a) RT[i] = q; RT.splice(j, 1); j = i; continue }   /* перекрываются вдоль — одна и та же, остаётся длинная */
    const ln = (p.b - p.a) + (q.b - q.a); RT[i] = { ...p, b: Math.max(p.b, q.b), rows: p.rows.concat(q.rows), c: (p.c * (p.b - p.a) + q.c * (q.b - q.a)) / ln, conf: Math.max(p.conf, q.conf) }; RT.splice(j, 1); j = i;
  }
  tick('rt+kor');
  /* ═ мелкие: коробки 45–140 мм (рамки розеток / выключателей, подрозетники), блоки по шагу 71 мм ═ */
  const ZS = new Uint8Array(N), zs = (x0, y0, x1, y1, m) => { const i0 = cl_(Math.floor((x0 - m) / r), 0, W - 1), i1 = cl_(Math.ceil((x1 + m) / r), 0, W - 1), j0 = cl_(Math.floor((Hm - y1 - m) / r), 0, H - 1), j1 = cl_(Math.ceil((Hm - y0 + m) / r), 0, H - 1); for (let j = j0; j <= j1; j++) ZS.fill(1, j * W + i0, j * W + i1 + 1) };
  for (const e of big) zs(e.x0, e.k === 'door' || e.k === 'kor' || e.k === 'kol' ? 0 : e.y0, e.x1, e.y1, e.k === 'door' ? 20 : 10); for (const z of zones) zs(z.x0, z.y0, z.x1, z.y1, 10);
  for (const t of RT) if (t.pipe) { const tm = (t.a + t.b) / 2; for (let u = t.a; u <= t.b; u++) { const cc = t.c0 + t.tl * (u - tm), v0 = Math.max(0, Math.floor(cc - t.w / 2) - 2), v1 = Math.min((t.vert ? W : H) - 1, Math.ceil(cc + t.w / 2) + 2); for (let v = v0; v <= v1; v++) ZS[t.vert ? u * W + v : v * W + u] = 1 } }
  for (const t of RT) if (!t.pipe) for (const [u, s1, e1] of t.rows) { if (u < t.a || u > t.b) continue; for (let v = Math.max(0, s1 - 1); v <= Math.min((t.vert ? W : H) - 1, e1 + 1); v++) ZS[t.vert ? u * W + v : v * W + u] = 1 }
  const tSm = Math.max(12, 3.5 * sgS);
  /* две маски: отличие от фона (MS) и замкнутые контуры краёв, залитые (ME: белая рамка на белой плитке видна только контуром) */
  let MS = new Uint8Array(N), ME = new Uint8Array(N); (() => { for (let k = 0; k < N; k++) { MS[k] = V[k] && !ZS[k] && Math.abs(DfS[k]) > tSm ? 1 : 0; ME[k] = V[k] && !ZS[k] && (EV[k] || EH[k]) ? 1 : 0 } })();
  const ro = Math.max(1, Math.round(12 / r)); MS = opn(cls(MS, 1), ro); ME = opn(holeFill(cls(ME, 1), Math.round(170 / r)), ro);
  const sm = [];
  for (const [LS, src] of [[label(MS), 'd'], [label(ME), 'e']]) for (const c of LS.cs) {
    if ((c.i1 - c.i0 + 1) * r < 40 || (c.j1 - c.j0 + 1) * r < 40 || (c.i1 - c.i0 + 1) * r > 600 || (c.j1 - c.j0 + 1) * r > 600) continue;
    const rows = new Int32Array(c.j1 - c.j0 + 1), cols = new Int32Array(c.i1 - c.i0 + 1);
    for (let j = c.j0; j <= c.j1; j++) for (let i = c.i0, k = j * W + i; i <= c.i1; i++, k++) if (LS.Lb[k] === c.id) { rows[j - c.j0]++; cols[i - c.i0]++ }
    const mr = Math.max(...rows), mc = Math.max(...cols); let r0 = 0, r1 = rows.length - 1, c0 = 0, c1 = cols.length - 1;   /* хвосты (провод, канал) отрезаются: строки / столбцы < 40 % максимума */
    while (r0 < r1 && rows[r0] < .4 * mr) r0++; while (r1 > r0 && rows[r1] < .4 * mr) r1--; while (c0 < c1 && cols[c0] < .4 * mc) c0++; while (c1 > c0 && cols[c1] < .4 * mc) c1--;
    const i0 = c.i0 + c0, i1 = c.i0 + c1, j0 = c.j0 + r0, j1 = c.j0 + r1, b = box(i0, j0, i1, j1), w = b.x1 - b.x0, h = b.y1 - b.y0;
    if (c.i0 <= bp + 1 || c.i1 >= W - bp - 2 || c.j0 <= bp + 1 || c.j1 >= H - Math.max(bp, fb) - 2) continue;   /* у края рабочей области — тень угла, плинтус */
    if (Math.min(w, h) < 45 || Math.max(w, h) > 420) continue;
    let n = 0, cn = 0; const cw = Math.max(1, Math.round(Math.min(i1 - i0 + 1, j1 - j0 + 1) * .18));   /* углы: у круга пустые, у рамки заполнены */
    for (const [ia, ja] of [[i0, j0], [i1 - cw + 1, j0], [i0, j1 - cw + 1], [i1 - cw + 1, j1 - cw + 1]]) for (let j = ja; j < ja + cw; j++) for (let i = ia; i < ia + cw; i++) { cn++; if (LS.Lb[j * W + i] === c.id) n++ }
    const cr = cn ? n / cn : 1, md = stat(DfS, i0, j0, i1, j1), chr = stat(DcL, i0, j0, i1, j1);
    if (src === 'e') {   /* по контуру — только прямоугольник с краями по ≥ 3 сторонам; уже найденное по отличию — не дублировать */
      const sides = (covH(j0, i0, i1) >= .6) + (covH(j1, i0, i1) >= .6) + (covV(i0, j0, j1) >= .6) + (covV(i1, j0, j1) >= .6);
      if (sides < 4 || cr < .45 || Math.min(w, h) < 65 || Math.min(w, h) > 130 || sm.some(p => p.src === 'd' && Math.min(p.w, p.h) >= 55 && iouB(p, b) > .2)) { if (o.dbg && Math.min(w, h) > 40) dbgI.push({ k: 'e?', ...b, conf: 0, why: `sides${sides} cr${cr.toFixed(2)} w${w | 0} h${h | 0}` }); continue }
    }
    sm.push({ ...b, w, h, i0, i1, j0, j1, cr, md, chr, src, nfill: c.n / ((i1 - i0 + 1) * (j1 - j0 + 1)) });
  }
  sm.sort((a, b) => a.x0 - b.x0);
  for (let i = 0; i < sm.length; i++) for (let j = i + 1; j < sm.length; j++) {   /* коробки встык одного размера — блок (по горизонтали или по вертикали) */
    const a = sm[i], b = sm[j], hz = Math.abs(a.h - b.h) < 22 && Math.abs((a.y0 + a.y1) - (b.y0 + b.y1)) < 32 && b.x0 - a.x1 < 22 && b.x0 - a.x1 > -15 && a.h <= 150 && b.h <= 150,
      vt = Math.abs(a.w - b.w) < 22 && Math.abs((a.x0 + a.x1) - (b.x0 + b.x1)) < 32 && Math.min(Math.abs(b.y0 - a.y1), Math.abs(a.y0 - b.y1)) < 22 && a.w <= 150 && b.w <= 150 && (b.y0 >= a.y1 - 15 || a.y0 >= b.y1 - 15);
    if (!hz && !vt) continue;
    const m = { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), i0: Math.min(a.i0, b.i0), i1: Math.max(a.i1, b.i1), j0: Math.min(a.j0, b.j0), j1: Math.max(a.j1, b.j1), cr: Math.min(a.cr, b.cr), md: (a.md + b.md) / 2, chr: (a.chr + b.chr) / 2, nfill: (a.nfill + b.nfill) / 2 };
    m.w = m.x1 - m.x0; m.h = m.y1 - m.y0; sm[i] = m; sm.splice(j, 1); j = i;
  }
  const doors = big.filter(e => e.k === 'door');
  for (const q of sm) {
    const { w, h } = q, vert = h > 1.4 * w, hor = w > 1.4 * h, s = Math.min(w, h), L1 = Math.max(w, h);
    const n = vert || hor ? Math.min(5, Math.max(2, Math.round((L1 - s) / 71) + 1)) : 1, pitchOk = n === 1 || Math.abs((L1 - s) - (n - 1) * 71) < 40;
    const round = q.cr < .45 && n === 1 ? Math.abs(w - h) < .25 * L1 : q.cr < .45;
    const why = `w${w | 0} h${h | 0} cr${q.cr.toFixed(2)} md${q.md | 0} chr${q.chr | 0} fill${q.nfill.toFixed(2)} n${n}`;
    if (!pitchOk) { if (o.dbg) dbgI.push({ k: 'sm?', ...q, conf: 0, why: why + ' pitch' }); continue }
    if (round && (s < 55 || s > 85)) { if (o.dbg) dbgI.push({ k: 'sm?', ...q, conf: 0, why: why + ' Ø' }); continue }   /* Ø50 — канализация, Ø40 — выводы воды: не коробки */
    if (round && q.md > -65) { if (o.dbg) dbgI.push({ k: 'sm?', ...q, conf: 0, why: why + ' светлый круг' }); continue }   /* пустой подрозетник — глубокая тёмная дыра; светлый круг — фитинг, моток провода */
    if (!round && (s < 55 || s > 140)) { if (o.dbg) dbgI.push({ k: 'sm?', ...q, conf: 0, why: why + ' size' }); continue }
    if (q.chr > 45 && !(q.md < -40)) { if (o.dbg) dbgI.push({ k: 'sm?', ...q, conf: 0, why: why + ' color' }); continue }
    /* розетка или выключатель: в центре каждого поста розетки — два тёмных гнезда */
    let hole = 1e9; const yc = (q.y0 + q.y1) / 2, xc = (q.x0 + q.x1) / 2;
    if (!round) { const ws_ = Math.round((q.i1 - q.i0) * .2), hs_ = Math.round((q.j1 - q.j0) * .2), fm = stat(Y, q.i0 + ws_, q.j0 + hs_, q.i1 - ws_, q.j1 - hs_), rr = Math.max(1, Math.round(20 / r));
      for (let g = 0; g < n; g++) { const cx = vert ? xc : q.x0 + s / 2 + g * 71, cy = vert ? q.y1 - s / 2 - g * 71 : yc, ci = Math.round(cx / r - .5), cj = Math.round((Hm - cy) / r - .5); let mnv = 1e9;
        for (let j = cj - rr; j <= cj + rr; j++) for (let i = ci - rr; i <= ci + rr; i++) if (i >= 0 && j >= 0 && i < W && j < H) mnv = Math.min(mnv, Y[j * W + i]);
        hole = Math.min(hole, fm - mnv) } }
    const yb = vert ? q.y0 + s / 2 : yc, nearD = doors.some(d => Math.min(Math.abs(xc - d.x0), Math.abs(xc - d.x1)) < 500);
    let k = 'roz';
    if (!round && ((hole < 22 && yb >= 600 && yb <= 1600) || (hole < 35 && yb >= 750 && yb <= 1400 && nearD))) k = 'vyk';
    const conf = Math.min(.9, .5 + (round || hole >= 35 || hole < 15 ? .2 : 0) + (q.nfill > .6 ? .1 : 0) + (Math.abs(q.md) > 25 ? .1 : 0));
    const it = { k, x0: q.x0, y0: q.y0, x1: q.x1, y1: q.y1, conf: +conf.toFixed(2), n, why: why + ` hole${hole < 1e8 ? hole | 0 : '-'}` };
    if (vert) it.vert = 1; if (round) { it.d = Math.round(s); it.box = 1 }
    items.push(it);
  }
  tick('small');
  for (const e of big) items.push({ k: e.k, x0: e.x0, y0: e.y0, x1: e.x1, y1: e.y1, conf: +e.conf.toFixed(2), why: e.why });
  const C = Array.isArray(o.C) && o.C.length === 3 && o.C[2] > 300 ? o.C : null;   /* центр камеры (мм стены): поправка параллакса выступающих (трубы стоят от стены) */
  for (const t of RT) {
    const hl = (t.b - t.a + 1) / 2, ca = t.c - t.tl * hl, cb = t.c + t.tl * hl;   /* ось по наклонной: у начала (a) и у конца (b) */
    let x0 = t.vert ? xm(Math.min(ca, cb) - t.w / 2) : xm(t.a), x1 = t.vert ? xm(Math.max(ca, cb) + t.w / 2) : xm(t.b + 1), y0 = t.vert ? ym(t.b + 1) : ym(Math.max(ca, cb) + t.w / 2), y1 = t.vert ? ym(t.a) : ym(Math.min(ca, cb) - t.w / 2), cx = xm(t.c + .5), cy = ym(t.c + .5), d = t.d;
    let pa = t.vert ? [[xm(cb + .5), y0], [xm(ca + .5), y1]] : [[x0, ym(ca + .5)], [x1, ym(cb + .5)]];
    if (C && t.t !== 'el') {   /* видимая ширина — d / cos угла взгляда; ось — на d/2 + 25 мм от стены */
      const ap = t.vert ? cx : cy, cc = t.vert ? C[0] : C[1]; d = d * C[2] / Math.hypot(ap - cc, C[2]); const s = 1 - (d / 2 + 25) / C[2];
      const fx = x => C[0] + (x - C[0]) * s, fy = y => C[1] + (y - C[1]) * s;
      if (t.vert) { cx = fx(cx); x0 = cx - d / 2; x1 = cx + d / 2; y0 = Math.max(0, fy(y0)); y1 = Math.min(Hm, fy(y1)) } else { cy = fy(cy); y0 = cy - d / 2; y1 = cy + d / 2; x0 = Math.max(0, fx(x0)); x1 = Math.min(L, fx(x1)) }
      pa = pa.map(([x, y]) => [Math.min(L, Math.max(0, fx(x))), Math.min(Hm, Math.max(0, fy(y)))]);
    }
    if (!t.vert && t.t !== 'el' && d < 40) t.t = 'el';   /* тонкая горизонтальная полоса — кабель-канал (трубы вдоль стены — толще или вертикальны) */
    const it = { k: 'rt', t: d >= 80 && t.t !== 'el' ? 'dr' : t.t === 'el' ? 'el' : 'wa', d: Math.round(d), x0, y0, x1, y1, pts: pa, conf: +t.conf.toFixed(2) };
    if (o.dbg) it.why = t.why; items.push(it);
  }
  /* итог: мм с точностью 1, «why» — только в отладке, дубли одного вида (перекрытие > 50 %) — по уверенности */
  for (const e of items) { for (const k of ['x0', 'y0', 'x1', 'y1']) e[k] = Math.round(e[k]); if (e.pts) e.pts = e.pts.map(p => p.map(Math.round)); if (!o.dbg) delete e.why }
  items.sort((a, b) => b.conf - a.conf);
  const rtDup = (a, b) => { const va = Math.abs(a.pts[1][1] - a.pts[0][1]) > Math.abs(a.pts[1][0] - a.pts[0][0]), vb = Math.abs(b.pts[1][1] - b.pts[0][1]) > Math.abs(b.pts[1][0] - b.pts[0][0]); if (va !== vb) return false;
    const ax = va ? 0 : 1, al = 1 - ax, ov = Math.min(Math.max(a.pts[0][al], a.pts[1][al]), Math.max(b.pts[0][al], b.pts[1][al])) - Math.max(Math.min(a.pts[0][al], a.pts[1][al]), Math.min(b.pts[0][al], b.pts[1][al])), la = Math.abs(a.pts[1][al] - a.pts[0][al]), lb = Math.abs(b.pts[1][al] - b.pts[0][al]);
    return Math.abs(a.pts[0][ax] - b.pts[0][ax]) < Math.max(a.d, b.d) / 2 + 40 && ov > .5 * Math.min(la, lb) };   /* одна трасса, найденная дважды (тень + тело трубы) */
  for (let i = 0; i < items.length; i++) for (let j = items.length - 1; j > i; j--) {
    const a = items[i], b = items[j]; if (a.k !== b.k) continue;
    if (a.k === 'rt' ? rtDup(a, b) : iouB(a, b) > .5) { if (a.k === 'rt' && Math.abs(b.y1 - b.y0) + Math.abs(b.x1 - b.x0) > 1.3 * (Math.abs(a.y1 - a.y0) + Math.abs(a.x1 - a.x0)) && (a.t === 'el') === (b.t === 'el')) items[i] = b; items.splice(j, 1) }
  }
  if (o.dbg) for (const z of zones) dbgI.push({ k: 'zone', ...z, conf: 0 });
  if (o.dbg) {
    const b = (A, s, z) => { const q = new Float32Array(N); for (let k = 0; k < N; k++) q[k] = z + A[k] * s; return q };
    const ed = new Float32Array(N); for (let k = 0; k < N; k++) ed[k] = EV[k] ? 255 : EH[k] ? 128 : 0;
    return { items: items.concat(dbgI), dbg: { dfl: b(DfL, 2, 128), mb: b(MB, 255, 0), ed, mr: b(MR, 255, 0), zm: b(ZM, 255, 0), dfs: b(DfS, 3, 128), ms: b(MS, 255, 0), zs: b(ZS, 255, 0) }, sg: [sgS, sgL, sgC, tE], TM };
  }
  return items;
}
function solveLin(A, b) {             // A — массив строк n×n, b — n; Гаусс с выбором ведущего
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r] }
  return x;
}
const FWK = { roz: ['розетки', 'розетка', '#E0442B'], vyk: ['выкл.', 'выкл.', '#E07A00'], win: ['окно', 'окно', '#1F6FD1'], door: ['дверь', 'дверь', '#6B7785'], nis: ['ниша', 'ниша', '#2E9E4F'], kor: ['короб', 'короб', '#8D6E63'], kol: ['колонна', 'колонна', '#B8602E'],
  st: ['стояк', 'стояк', '#7B3FC4'], rt: ['трасса', 'трасса', '#E07A00'], shch: ['щит', 'щит', '#5B5BD0'], hvs: ['ХВС', 'ХВС', '#3D9BFF'], gvs: ['ГВС', 'ГВС', '#FF5C5C'], kan: ['канализ.', 'канализ.', '#8D6E63'], vent: ['вент.', 'вент.', '#1FA98F'],
  gaz: ['газ', 'газ', '#C98A00'], svet: ['свет', 'свет', '#D4A300'], slab: ['ТВ', 'ТВ', '#3D7BE0'] };
window.MeasureFW = {img: fwImg, rectify: fwRectify, detect: fwDetect, hApply, FWK};
})();
