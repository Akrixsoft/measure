/* Measure 82.18 — lab-board.js: подложка холста проекта — запись sess {kind:'board'} (AKX-2026-0012, §1.6, §5.2).
   Подложка — штатная пустая плоскость v81 (q4.blank) без рамки стены: на ней работают ВСЕ штатные инструменты
   (размеры и стрелки с полем значения, текст, перо, фигуры, выноски), фото холста — штатные фото-справки S.refs.
   Здесь — только отличия поведения v81 при S.sess.kind === 'board':
     рамки нет (w3Model → null, линии рамки пустые, развёртка 2 × 2 px прозрачная), статус «Холст», без предупреждений и снимка выгрузки,
     касание фото с инструментом рисования рисует на фото (не тянет фото), фото добавляются в видимую часть холста без экрана распознавания,
     рисунки, целиком лежащие на фото, двигаются / масштабируются / удаляются вместе с фото одним шагом ↶.
   Работает поверх неизменной v81 (обёртки): blankMos, openSess, w3Model, status, zWarn, exportObj, rfHit, rfAdd, rfDel, zaAdd, draw. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabBoard) return;
  const api = window.MeasureLabBoard = {version: 1};
  const isB = () => S.mode !== 'plan' && !!(S.sess && S.sess.kind === 'board');
  api.is = isB;
  const getG = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };
  const say = t => { try { toast(t); } catch (e) { } };

  /* ═══ [BLOCK BD-REC] новая запись подложки проекта ═══ */
  api.record = (pid, obj) => { const ts = Date.now(); return {id: 'b' + ts.toString(36) + Math.random().toString(36).slice(2, 5), kind: 'board', room: '~board', labOid: pid, obj: obj || '', name: 'Холст', created: ts, upd: ts, frames: [],
    q4: {L: 1, H: 1, ok: 1, fr: {}, blank: 1, board: 1, aL: 1, aH: 1}, lines: {}, la: {}, man: {}, wsh: {}, els: [], notes: [], und: [], dms: [], drw: [], rts: [], polys: [], rulers: [], refs: []}; };

  /* ═══ [BLOCK BD-FRAME] без рамки стены ═══ */
  const mos = () => (window.MeasureLabCtx ? MeasureLabCtx.boardMos(S.q4) : {c: document.createElement('canvas'), x0: 0, y1: 1, r: .5, W: 2, H: 2, board: 1});
  const bm0 = blankMos; blankMos = function () { return S.q4 && S.q4.board ? mos() : bm0.apply(this, arguments); };
  const os0 = openSess; openSess = async function (id) { const r = await os0.apply(this, arguments); if (isB()) { S.lines = {}; if (!S.mosaic || !S.mosaic.board) S.mosaic = mos(); } return r; };
  const w3m0 = w3Model; w3Model = function () { return isB() ? null : w3m0.apply(this, arguments); };
  const st0 = status; status = function () { if (isB()) { const e = $('st'); if (e) e.innerHTML = `Холст · фото <b>${(S.refs || []).length}</b> · размеров <b>${(S.dms || []).length}</b>`; return; } return st0.apply(this, arguments); };
  const zw0 = zWarn; zWarn = function () { return isB() ? [] : zw0.apply(this, arguments); };
  const on0 = zOpenN; zOpenN = function () { return isB() ? (S.dms || []).filter(d => !(+d.vm > 0)).length : on0.apply(this, arguments); };   // ✓: на подложке — только размеры без числа (L / H стены нет)
  const ex0 = exportObj; exportObj = function () { if (isB()) throw new Error('подложка холста не выгружается'); return ex0.apply(this, arguments); };   // doSave: у подложки out нет
  const ro0 = openRoom; openRoom = async function (id) { if (id === '~board') return; return ro0.apply(this, arguments); };   // v81 «к плану помещения» с подложки — не помещение

  /* ═══ [BLOCK BD-HIT] фото на подложке тянется только выбором; с инструментом рисования касание фото — рисунок на фото ═══ */
  const DRAWK = () => S.tool === 'mk' && !['sel', 'rsel'].includes(S.mk);
  const rh0 = rfHit; rfHit = function () { if (isB() && DRAWK()) return null; return rh0.apply(this, arguments); };

  const KINDS = ['dms', 'drw', 'rts', 'polys'], GAPV = 40, GP = {ids: []};
  const rfH = r => r.w * r.ih / r.iw;
  /* ═══ [BLOCK BD-ADD] фото — в видимую часть холста, ширина 600 мм подложки, без экрана распознавания; ↶ — шаг-снимок ═══ */
  async function addRefs(files, at) {
    if (!isB()) return; const v = S.view, d = devicePixelRatio || 1, H = (typeof zFreeH === 'function' ? zFreeH() : cv.height);
    /* 82.18 fix (QA Д1): добавление фото — шаг-снимок (refs в снимке undo-patch), не замыкание ZA: ↶ ↷ переживают перезапуск.
       Снимок того же состояния уже сделан обёрткой rfAdd (lab-history) — второй не нужен (unsnap снимает и его метку журнала). */
    snap(); { const U = S.und; if (U.length > 1 && U[U.length - 1] === U[U.length - 2]) unsnap(); }
    const p0 = at || toPl(cv.width * .08, H * .12); let x = p0[0]; const add = [];
    for (const f of files) {
      try {
        const bmp = await createImageBitmap(f, {imageOrientation: 'from-image'}).catch(() => createImageBitmap(f)), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
        c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
        const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85)), id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); await dbPut('img', blob, 'ref:' + id);
        const n = Math.max(0, ...S.refs.map(r => r.n || 0)) + 1, w = 600, r = {id, n, iw: c.width, ih: c.height, w, x, y: p0[1], q: null, found: [], t: Date.now(), name: f.name || ''};
        /* r5 (правило 3): новое фото — ниже последнего объекта холста (по одному и группой — последовательно вертикально); другие объекты не двигаются */
        const bl = window.MeasureLabSketch && MeasureLabSketch.below && MeasureLabSketch.below(); if (bl) { r.x = bl.x; r.y = -(bl.y + GAPV); }
        const im = new Image(); im.onload = () => draw(); im.src = URL.createObjectURL(blob); getG('RIMG').set(id, im);
        S.refs.push(r); add.push(r); x = r.x;
      } catch (e) { say('Фото не добавлено: ' + e.message); }
    }
    if (!add.length) { unsnap(); return []; }
    S.rsel = add.length === 1 ? add[0].id : null; GP.ids = add.length > 1 ? add.map(r => r.id) : []; S.sel = null; S.msel = []; saveSess();
    try { const SK = window.MeasureLabSketch; if (SK && SK.showRect) SK.showRect(Math.min(...add.map(r => r.x)), Math.min(...add.map(r => -r.y)), Math.max(...add.map(r => r.x + r.w)), Math.max(...add.map(r => -r.y + rfH(r)))); } catch (e) { }   // вид — на добавленные фото (камера)
    draw(); status();
    say(add.length > 1 ? `Фото на холсте: ${add.length} · ⌗ — 4 угла стены` : 'Фото на холсте · ⌗ — 4 угла стены, размеры — штатными стрелками');
    return add;
  }
  api.addRefs = addRefs;
  const ra0 = rfAdd; rfAdd = async function (files) { if (isB()) return addRefs([...files]); return ra0.apply(this, arguments); };

  /* ═══ [BLOCK BD-ATT] рисунки на фото: вычисляемая привязка — все точки внутри прямоугольника фото ═══ */
  const inRef = (r, p) => p[0] >= r.x && p[0] <= r.x + r.w && p[1] <= r.y && p[1] >= r.y - rfH(r);
  function pts(q) { try { const P = zdPts(q); if (P && P.length) return P; } catch (e) { } const P = []; (function walk(o) { if (Array.isArray(o)) { if (o.length === 2 && typeof o[0] === 'number' && typeof o[1] === 'number') P.push(o); else o.forEach(walk); } else if (o && typeof o === 'object') for (const k in o) if (k[0] !== '_') walk(o[k]); })(q); return P; }
  function attached(r) { const out = []; for (const k of KINDS) for (const q of S[k] || []) { const P = pts(q); if (P.length && P.every(p => inRef(r, p))) out.push(q); } return out; }
  api.attached = id => { const r = (S.refs || []).find(x => x.id === id); return r && isB() ? attached(r) : []; };
  function mapPts(o, f) { if (Array.isArray(o)) { if (o.length === 2 && typeof o[0] === 'number' && typeof o[1] === 'number') return f(o); return o.map(x => mapPts(x, f)); } if (o && typeof o === 'object') { const n = {}; for (const k in o) n[k] = k[0] === '_' ? o[k] : mapPts(o[k], f); return n; } return o; }
  const xf = (a, b) => p => { const k = b[2] / a[2]; return [b[0] + (p[0] - a[0]) * k, b[1] + (p[1] - a[1]) * k]; };
  /* r4 (QA-4 М1): фото на новое место и ширину (раскладка «вписать всё» холста) — вместе с разметкой на фото и рядом с ним (все точки в пределах фото,
     расширенного на 30 % ширины), выноски — тоже; пропорции фото сохраняются. Только на активной подложке; шагом ↶ не записывается (раскладка). */
  api.placeRef = (id, x, y, w) => {
    if (!isB()) return false; const r = (S.refs || []).find(q => q.id === id); if (!r || !(w > 0)) return false;
    const a = [r.x, r.y, r.w], b = [x, y, w]; if (a.every((v, i) => Math.abs(v - b[i]) < 1e-6)) return true;
    const m = r.w * .3, h = rfH(r), near = p => p[0] >= r.x - m && p[0] <= r.x + r.w + m && p[1] <= r.y + m && p[1] >= r.y - h - m, f = xf(a, b);
    for (const k of KINDS) for (const q of S[k] || []) { const P = pts(q); if (P.length && P.every(near)) { const o = mapPts(q, f); for (const kk of Object.keys(o)) if (kk !== 'id') q[kk] = o[kk]; } }
    for (const n of S.notes || []) { const P = [n.p, n.t].filter(Array.isArray); if (P.length && P.every(near)) { if (Array.isArray(n.p)) n.p = f(n.p); if (Array.isArray(n.t)) n.t = f(n.t); } }
    r.x = x; r.y = y; r.w = w; return true;
  };
  function put(list, src) { for (const [q, o] of list) for (const k of Object.keys(o)) if (k !== 'id') q[k] = src(o)[k]; }
  /* перенос фото (штатный жест v81): привязанные рисунки — следом, на лету; шаг ↶ — общий с фото */
  const MV = {r: null, o0: null, att: null};
  window.addEventListener('pointerdown', () => { MV.r = null; if (!isB()) return; const RS = S.refs || []; MV.all = RS.map(r => [r, [r.x, r.y, r.w], attached(r).map(q => [q, JSON.parse(JSON.stringify(q))])]); }, true);
  function follow() {
    const RG = getG('RG'); if (!isB() || !RG || !RG.r || !RG.o0 || !MV.all) return;
    const e = MV.all.find(x => x[0] === RG.r); if (!e) return; const a = e[1], b = [RG.r.x, RG.r.y, RG.r.w]; if (a.every((v, i) => v === b[i])) return;
    put(e[2], o => mapPts(o, xf(a, b)));
  }
  const dr0 = draw; draw = function () { try { follow(); } catch (e) { } return dr0.apply(this, arguments); };
  const za0 = zaAdd; zaAdd = function (u, r) {
    const RG = getG('RG');
    if (isB() && RG && RG.r && MV.all) { const e = MV.all.find(x => x[0] === RG.r); if (e && e[2].length) { const a = e[1], b = [RG.r.x, RG.r.y, RG.r.w], L = e[2], f = xf(a, b);
      put(L, o => mapPts(o, f)); const u0 = u, r0 = r; u = () => { put(L, o => JSON.parse(JSON.stringify(o))); u0(); }; r = () => { put(L, o => mapPts(o, f)); r0(); }; } }
    return za0.call(this, u, r);
  };
  /* удаление фото (🗑): вместе с рисунками на нём — одним шагом */
  const rd0 = rfDel; rfDel = function (id) {
    if (!isB()) return rd0.apply(this, arguments);
    const i = S.refs.findIndex(r => r.id === id); if (i < 0) return; const r = S.refs[i], att = attached(r), pos = att.map(q => KINDS.map(k => (S[k] || []).indexOf(q)));
    const rm = () => { S.refs = S.refs.filter(x => x !== r); for (const k of KINDS) S[k] = (S[k] || []).filter(q => !att.includes(q)); S.rsel = null; S.dsel = null; };
    rm(); za0(() => { S.refs.splice(Math.min(i, S.refs.length), 0, r); att.forEach((q, j) => KINDS.forEach((k, m) => { if (pos[j][m] >= 0) S[k].splice(Math.min(pos[j][m], S[k].length), 0, q); })); saveSess(); draw(); }, () => { rm(); saveSess(); draw(); });
    saveSess(); draw(); status(); say(att.length ? `Фото и ${att.length} рис. на нём удалены · ↶ — вернуть` : 'Фото удалено · ↶ — вернуть');
  };

  /* r5 (правило 4): щипок по фото на подложке — пределы масштаба не от рамки стены (у подложки рамки нет: L = 1 → фото только уменьшалось) */
  const pz0 = f81gPz; f81gPz = function (k, w0) { if (isB()) return Math.max(40 / Math.max(1, w0), Math.min(20, k)); return pz0.apply(this, arguments); };
  /* ═══ [BLOCK BD-R5] r5 (правила владельца 3–6): выделение фото (касание — одно, рамка — группа), перенос группы, масштаб за углы, подрезка.
     Разметка на фото (все точки внутри фото) — вместе с фото. Каждое действие — шаг-снимок ↶ (refs в снимке), переживает перезапуск.
     Щипок по выделенному фото — масштаб фото (штатный жест v81 RG, разметка — follow), по пустому месту — масштаб вида. ═══ */
  const clone = o => JSON.parse(JSON.stringify(o));
  const skOn = () => !!(window.MeasureLabSketch && MeasureLabSketch.isOpen && MeasureLabSketch.isOpen());
  const selTool = () => S.tool === 'mk' && ['sel', 'rsel'].includes(S.mk);
  const refOf = id => (S.refs || []).find(r => r.id === id);
  const grp = () => { GP.ids = GP.ids.filter(id => refOf(id)); return GP.ids; };
  api.group = () => (isB() ? grp().slice() : []);
  api.setGroup = ids => { GP.ids = (ids || []).filter(id => refOf(id)); S.rsel = GP.ids.length === 1 ? GP.ids[0] : null; if (GP.ids.length > 1) S.rsel = null; draw(); };
  const scr = ev => { const b = cv.getBoundingClientRect(), d = devicePixelRatio || 1; return [(ev.clientX - b.left) * d, (ev.clientY - b.top) * d]; };
  /* рамка «выбор рамкой» v81: в группу — фото, которых рамка коснулась (как рисунки v78.2) */
  const zp0 = zrsPick; zrsPick = function (x0, y0, x1, y1) {
    const res = zp0.apply(this, arguments);
    try { if (isB()) { GP.ids = (S.refs || []).filter(r => { if (r.on) return false; const a = toScr(r.x, r.y), b = toScr(r.x + r.w, r.y - rfH(r)); return Math.min(a[0], b[0]) < x1 && Math.max(a[0], b[0]) > x0 && Math.min(a[1], b[1]) < y1 && Math.max(a[1], b[1]) > y0; }).map(r => r.id);
      S.rsel = GP.ids.length === 1 ? GP.ids[0] : null; if (GP.ids.length) say(GP.ids.length > 1 ? `Выбрано фото: ${GP.ids.length} · тяните любое — переносится группа` : 'Фото выбрано'); } } catch (e) { }
    return res;
  };
  /* ручки масштаба выбранного фото — у углов, снаружи (углы стены ⌗ — внутри фото, не путаются) */
  function hnd(r) { const d = devicePixelRatio || 1, h = rfH(r), P = [toScr(r.x, r.y), toScr(r.x + r.w, r.y), toScr(r.x + r.w, r.y - h), toScr(r.x, r.y - h)], c = [(P[0][0] + P[2][0]) / 2, (P[0][1] + P[2][1]) / 2];
    return P.map(q => { const dx = q[0] - c[0], dy = q[1] - c[1], l = Math.hypot(dx, dy) || 1; return [q[0] + dx / l * 9 * d, q[1] + dy / l * 9 * d]; }); }
  function hndHit(r, p) { const d = devicePixelRatio || 1; return hnd(r).findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 22 * d); }
  const oneSel = () => (!grp().length || GP.ids.length === 1) && S.rsel ? refOf(S.rsel) : null;
  /* подрезка: ref.crop = {x, y, w, h, ow, oh} — px исходного снимка; iw × ih — размер подрезки, q — в px подрезки; исходник (img ref:id) не меняется */
  const full = r => ({x: 0, y: 0, w: r.crop ? r.crop.ow : r.iw, h: r.crop ? r.crop.oh : r.ih});
  function setCrop(r, c2) {
    const c1 = r.crop || {x: 0, y: 0, w: r.iw, h: r.ih}, F = full(r), k = r.w / r.iw, ox = r.x - c1.x * k, oy = r.y + c1.y * k;
    r.x = ox + c2.x * k; r.y = oy - c2.y * k; r.w = c2.w * k; r.iw = c2.w; r.ih = c2.h;
    if (r.q) r.q = mapPts(r.q, p => [p[0] + c1.x - c2.x, p[1] + c1.y - c2.y]);
    if (c2.x <= 0 && c2.y <= 0 && c2.w >= F.w && c2.h >= F.h) delete r.crop; else r.crop = {x: c2.x, y: c2.y, w: c2.w, h: c2.h, ow: F.w, oh: F.h};
  }
  api.setCrop = (id, c) => { const r = refOf(id); if (!r || !isB()) return false; snap(); setCrop(r, c || full(r)); saveSess(); draw(); return true; };
  const CROPC = new Map();
  const rfi0 = rfImg; rfImg = function (r) {   // подрезанное фото — вырез исходника (кэш по параметрам подрезки)
    if (!r || !r.crop) return rfi0.apply(this, arguments);
    const c = r.crop, key = r.id + ':' + [c.x, c.y, c.w, c.h].map(Math.round).join(','); let o = CROPC.get(key); if (o) return o;
    const im = rfi0({id: r.id}); if (!im) return null;
    const sx = im.naturalWidth / (c.ow || im.naturalWidth); o = document.createElement('canvas'); o.width = Math.max(1, Math.round(c.w * sx)); o.height = Math.max(1, Math.round(c.h * sx));
    o.getContext('2d').drawImage(im, c.x * sx, c.y * sx, c.w * sx, c.h * sx, 0, 0, o.width, o.height); o.naturalWidth = o.width; o.complete = true; CROPC.set(key, o); return o;
  };
  const CR = {on: false, id: null, pre: null, c: null};
  function crBar(on) {
    let b = document.getElementById('labCrop'); if (!on) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'labCrop'; b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));z-index:60;display:flex;gap:8px;background:#fff;border-radius:12px;padding:6px 8px;box-shadow:0 4px 16px rgba(0,0,0,.25);font:600 15px system-ui';
      b.innerHTML = '<button id="labCrX" style="min-width:44px;min-height:40px">✕</button><button id="labCrRs" style="min-height:40px">Сброс</button><button id="labCrOk" style="min-height:40px;background:#1F6FD1;color:#fff;border:0;border-radius:8px;padding:0 14px">✓ Подрезать</button>';
      document.body.appendChild(b); b.querySelector('#labCrX').onclick = () => cropEnd(false); b.querySelector('#labCrRs').onclick = () => { const r = refOf(CR.id); if (r) CR.c = full(r); cropEnd(true); }; b.querySelector('#labCrOk').onclick = () => cropEnd(true); }
  }
  function cropStart(id) {
    if (!isB() || CR.on) return false; const r = refOf(id); if (!r) return false;
    CR.on = true; CR.id = id; CR.pre = clone(r); CR.c = r.crop ? {x: r.crop.x, y: r.crop.y, w: r.crop.w, h: r.crop.h} : full(r);
    setCrop(r, full(r)); GP.ids = []; S.rsel = id; crBar(true); draw(); say('Подрезка: тяните углы или рамку · ✓ — подрезать'); return true;
  }
  function restore(r, pre) { for (const k of Object.keys(r)) if (!(k in pre)) delete r[k]; Object.assign(r, clone(pre)); }
  function cropEnd(ok) {
    if (!CR.on) return; const r = refOf(CR.id), c = CR.c, pre = CR.pre; CR.on = false; CR.id = null; crBar(false);
    if (r) { restore(r, pre); if (ok) { const c0 = r.crop || full(r); if (['x', 'y', 'w', 'h'].some(k => Math.abs(c0[k] - c[k]) > .5)) { snap(); setCrop(r, c); saveSess(); say(r.crop ? 'Фото подрезано · ↶ — вернуть' : 'Подрезка снята · ↶ — вернуть'); } } }
    draw(); try { zpbDraw(); } catch (e) { }
  }
  api.cropStart = cropStart; api.cropEnd = cropEnd; api.cropState = () => (CR.on ? {id: CR.id, c: {...CR.c}} : null);
  api.cropSet = c => { if (!CR.on) return false; CR.c = {...c}; draw(); return true; };
  function crRect(r) { const k = r.w / r.iw, c = CR.c; return [toScr(r.x + c.x * k, r.y - c.y * k), toScr(r.x + (c.x + c.w) * k, r.y - (c.y + c.h) * k)]; }
  function crHit(r, p) { const d = devicePixelRatio || 1, [a, b] = crRect(r), P = [a, [b[0], a[1]], b, [a[0], b[1]]], i = P.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 24 * d);
    if (i >= 0) return i; return p[0] > Math.min(a[0], b[0]) && p[0] < Math.max(a[0], b[0]) && p[1] > Math.min(a[1], b[1]) && p[1] < Math.max(a[1], b[1]) ? 'mv' : null; }
  /* жесты: перехват до штатных (window, capture; холст Lab пропускает касание активной подложки штатно) */
  const PH = {id: null, g: null};
  window.addEventListener('pointerdown', ev => {
    if (ev.target !== cv || !skOn() || !isB() || S.show >= 0) return;
    if (PH.id != null) { ev.stopImmediatePropagation(); ev.preventDefault(); return; }   // второй палец во время своего жеста — без штатного
    const p = scr(ev), w = toPl(...p), take = g => { ev.stopImmediatePropagation(); ev.preventDefault(); PH.id = ev.pointerId; PH.g = g; try { cv.setPointerCapture(ev.pointerId); } catch (e) { } };
    if (CR.on) { const r = refOf(CR.id); if (!r) return cropEnd(false); const h = crHit(r, p); const k = r.w / r.iw, F = full(r), c0 = {...CR.c};
      if (h != null) { const u0 = [(w[0] - r.x) / k, (r.y - w[1]) / k]; return take({move: q => { const u = [Math.max(0, Math.min(F.w, (q[0] - r.x) / k)), Math.max(0, Math.min(F.h, (r.y - q[1]) / k))], m = 20;
        if (h === 'mv') { const dx = u[0] - u0[0], dy = u[1] - u0[1]; CR.c = {x: Math.max(0, Math.min(F.w - c0.w, c0.x + dx)), y: Math.max(0, Math.min(F.h - c0.h, c0.y + dy)), w: c0.w, h: c0.h}; return; }
        let x0 = c0.x, y0 = c0.y, x1 = c0.x + c0.w, y1 = c0.y + c0.h; if (h === 0 || h === 3) x0 = Math.min(u[0], x1 - m); else x1 = Math.max(u[0], x0 + m); if (h === 0 || h === 1) y0 = Math.min(u[1], y1 - m); else y1 = Math.max(u[1], y0 + m);
        CR.c = {x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0)}; }}); }
      if (rfHit(p) === r) take({move: () => { }});   // фото под подрезкой не тянется
      return; }
    if (!selTool()) return;
    const one = oneSel(), hi = one ? hndHit(one, p) : -1;
    if (one && hi >= 0) {   // масштаб за угол: противоположный угол на месте, пропорции фото сохраняются
      const r = one, a0 = [r.x, r.y, r.w], h0 = rfH(r), A = [[r.x + r.w, r.y - h0], [r.x, r.y - h0], [r.x, r.y], [r.x + r.w, r.y]][hi], att = attached(r).map(q => [q, clone(q)]); let moved = 0;
      return take({move: q => { const dx = Math.abs(q[0] - A[0]), dy = Math.abs(q[1] - A[1]), nw = Math.max(40, dx, dy * r.iw / r.ih), nh = nw * r.ih / r.iw;
        if (!moved) { if (Math.abs(nw - a0[2]) * S.view.s < 3) return; moved = 1; snap(); }
        const x = hi === 0 || hi === 3 ? A[0] - nw : A[0], y = hi === 0 || hi === 1 ? A[1] + nh : A[1]; r.x = x; r.y = y; r.w = nw; put(att, o => mapPts(o, xf(a0, [x, y, nw]))); },
        end: () => { if (moved) { saveSess(); status(); } }}); }
    const g = grp();
    if (g.length > 1) { const hit = rfHit(p);
      if (hit && g.includes(hit.id)) {   // перенос группы: фото, разметка на них и рисунки, выбранные той же рамкой
        const L = g.map(refOf).filter(Boolean).map(r => [r, r.x, r.y]), Q = new Set(); for (const [r] of L) for (const q of attached(r)) Q.add(q);
        for (const k of KINDS) for (const q of S[k] || []) if ((S.msel || []).includes(q.id)) Q.add(q);
        const D = [...Q].map(q => [q, clone(q)]); let moved = 0;
        return take({move: q => { const dx = q[0] - w[0], dy = q[1] - w[1]; if (!moved) { if (Math.hypot(dx, dy) * S.view.s < 6 * (devicePixelRatio || 1)) return; moved = 1; snap(); }
          for (const [r, x, y] of L) { r.x = x + dx; r.y = y + dy; } put(D, o => mapPts(o, p2 => [p2[0] + dx, p2[1] + dy])); },
          end: () => { if (moved) { saveSess(); status(); } }}); }
      GP.ids = []; draw();
    }
  }, true);
  window.addEventListener('pointermove', ev => { if (ev.pointerId !== PH.id) return; ev.stopImmediatePropagation(); ev.preventDefault(); if (PH.g && PH.g.move) PH.g.move(toPl(...scr(ev))); draw(); }, true);
  const phUp = ev => { if (ev.pointerId !== PH.id) return; ev.stopImmediatePropagation(); const g = PH.g; PH.id = null; PH.g = null; if (g && g.end && ev.type === 'pointerup') g.end(); draw(); };
  window.addEventListener('pointerup', phUp, true); window.addEventListener('pointercancel', phUp, true);
  /* отрисовка: группа (пунктир), ручки масштаба выбранного фото, рамка подрезки (снаружи — затемнение) */
  const dr1 = draw; draw = function () {
    const res = dr1.apply(this, arguments);
    try {
      if (CR.on && !isB()) cropEnd(false);
      if (!isB() || !skOn()) return res; const d = devicePixelRatio || 1; cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0);
      for (const id of grp()) { const r = refOf(id); if (!r) continue; const a = toScr(r.x, r.y), b = toScr(r.x + r.w, r.y - rfH(r)); cx.strokeStyle = '#1F6FD1'; cx.lineWidth = 3 * d; cx.setLineDash([10 * d, 6 * d]); cx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); cx.setLineDash([]); }
      const one = !CR.on && selTool() && oneSel();
      if (one) for (const q of hnd(one)) { cx.fillStyle = '#fff'; cx.strokeStyle = '#1F6FD1'; cx.lineWidth = 2.5 * d; cx.fillRect(q[0] - 8 * d, q[1] - 8 * d, 16 * d, 16 * d); cx.strokeRect(q[0] - 8 * d, q[1] - 8 * d, 16 * d, 16 * d); }
      const cr = CR.on && refOf(CR.id);
      if (cr) { const A = toScr(cr.x, cr.y), B = toScr(cr.x + cr.w, cr.y - rfH(cr)), [a, b] = crRect(cr); cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath(); cx.rect(A[0], A[1], B[0] - A[0], B[1] - A[1]); cx.rect(a[0], b[1], b[0] - a[0], a[1] - b[1]); cx.fill('evenodd');
        cx.strokeStyle = '#fff'; cx.lineWidth = 2.5 * d; cx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]); for (const q of [a, [b[0], a[1]], b, [a[0], b[1]]]) { cx.fillStyle = '#1F6FD1'; cx.beginPath(); cx.arc(q[0], q[1], 10 * d, 0, 7); cx.fill(); } }
      cx.restore();
    } catch (e) { }
    return res;
  };
  /* ▣ Стена по рамке: фото — в реальный масштаб (рамка = L × H области стены), разметка на фото — вместе; запись подложки (подложка может быть неактивна).
     Состояние до / после — в шаг холста 'wall' (↶ ↷ — lab-history). */
  function attachedIn(rec, r) { const out = []; for (const k of KINDS) for (const q of rec[k] || []) { const P = pts(q); if (q.id && P.length && P.every(p => inRef(r, p))) out.push([k, q]); } return out; }
  const phState = (r, L) => ({ref: {x: r.x, y: r.y, w: r.w}, it: L.map(([k, q]) => [k, q.id, clone(q)])});
  api.scaleRec = (rec, id, f) => { const r = (rec.refs || []).find(x => x.id === id); if (!r || !(f > 0)) return null; const L = attachedIn(rec, r), a = phState(r, L), A = [r.x, r.y, r.w], B = [r.x, r.y, r.w * f], m = xf(A, B);
    for (const [, q] of L) { const o = mapPts(q, m); for (const kk of Object.keys(o)) if (kk !== 'id') q[kk] = o[kk]; } r.w = B[2]; return {id, a, b: phState(r, L)}; };
  api.phApply = (rec, st, id) => { if (!rec || !st) return; const r = (rec.refs || []).find(x => x.id === (id || st.id)); if (r) Object.assign(r, st.ref);
    for (const [k, id, o] of st.it || []) { const q = (rec[k] || []).find(x => x.id === id); if (q) for (const kk of Object.keys(o)) if (kk !== 'id') q[kk] = clone(o[kk]); } };
})();
