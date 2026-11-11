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
        const n = Math.max(0, ...S.refs.map(r => r.n || 0)) + 1, w = Math.max(200, Math.min(600, (cv.width * .8) / v.s)), r = {id, n, iw: c.width, ih: c.height, w, x, y: p0[1], q: null, found: [], t: Date.now(), name: f.name || ''};
        const fr = window.MeasureLabSketch && MeasureLabSketch.freeBoard; if (fr) { const q = fr(r); r.x = q[0]; r.y = q[1]; }
        const im = new Image(); im.onload = () => draw(); im.src = URL.createObjectURL(blob); getG('RIMG').set(id, im);
        S.refs.push(r); add.push(r); x = r.x + r.w + w * .1;
      } catch (e) { say('Фото не добавлено: ' + e.message); }
    }
    if (!add.length) { unsnap(); return []; }
    S.rsel = add[add.length - 1].id; S.sel = null; S.msel = []; saveSess(); draw(); status();
    say(add.length > 1 ? `Фото на холсте: ${add.length} · ⌗ — 4 угла стены` : 'Фото на холсте · ⌗ — 4 угла стены, размеры — штатными стрелками');
    return add;
  }
  api.addRefs = addRefs;
  const ra0 = rfAdd; rfAdd = async function (files) { if (isB()) return addRefs([...files]); return ra0.apply(this, arguments); };

  /* ═══ [BLOCK BD-ATT] рисунки на фото: вычисляемая привязка — все точки внутри прямоугольника фото ═══ */
  const KINDS = ['dms', 'drw', 'rts', 'polys'];
  const rfH = r => r.w * r.ih / r.iw;
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
})();
