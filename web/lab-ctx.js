/* Measure 82.18 — lab-ctx.js: подмена состояния S для штатной отрисовки чужой поверхности (AKX-2026-0012, §1.6).
   draw v81 рисует только текущее S. Чтобы подложка холста (фото, стрелки, размеры, текст) была видна под активной стеной
   или планом, её состояние ставится в S на время одной отрисовки и затем возвращается целиком.
   Побочные эффекты отрисовки (панели, статус, запись в базу, тосты) на время подмены заглушены.
   Работает поверх неизменной v81: S, cv, cx, draw … Ничего не пишет в базу. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabCtx) return;
  const api = window.MeasureLabCtx = {};
  const LABCTX = window.LABCTX = {painting: 0};

  /* ═══ [BLOCK CTX-KEYS] ключи S поверхности стены: из clearAll и openSess (v81) + фото-справки, вид, режим ═══ */
  const KEYS = ['sess', 'q4', 'lines', 'la', 'wsh', 'man', 'els', 'notes', 'und', 'red', 'dms', 'drw', 'rts', 'polys', 'rulers', 'refs', 'frames', 'mosaic', 'sol',
    'room0', 'planL', 'show', 'sel', 'dsel', 'nsel', 'msel', 'rsel', 'zpl', 'zRef', 'pend', 'rsr', 'detc', 'view', 'mode', 'room', 'zpen', 'loupe', 'labDrag', 'fitS'];
  api.KEYS = KEYS;
  /* функции с побочными эффектами, которые цепочка draw может вызвать: на время подмены — пустые */
  const STUBS = ['zLay', 'lay05', 'mkPanel', 'mkChips', 'status', 'strip', 'saveSess', 'saveRoom', 'toast', 'rfUi', 'w3Win', 'zpbDraw', 'updRul', 'hdrCnt', 'dmInShow'];
  const noop = () => { };
  const getG = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };          // глобальная привязка (function / let) по имени
  const setG = (n, f) => { try { (0, eval)(n + ' = window.__labCtxF'.replace('window.__labCtxF', '__labCtxF')); } catch (e) { return false; } return true; };
  function swapStubs() {
    const old = {};
    for (const n of STUBS) { const f = getG(n); if (typeof f !== 'function') continue; window.__labCtxF = noop; if (setG(n)) old[n] = f; }
    delete window.__labCtxF; return old;
  }
  function restoreStubs(old) { for (const n in old) { window.__labCtxF = old[n]; setG(n); } delete window.__labCtxF; }

  /* ═══ [BLOCK CTX-MOS] подложка без рамки: прозрачная «развёртка» 1 × 1 мм — для rfOn / drawMarkup, сама не видна ═══ */
  const MOS = {c: null};
  function boardMos(q4) { if (!MOS.c) { MOS.c = document.createElement('canvas'); MOS.c.width = 2; MOS.c.height = 2; } const H = +(q4 && q4.H) || 1, L = +(q4 && q4.L) || 1; return {c: MOS.c, x0: 0, y1: H, r: Math.max(L, H) / 2, W: 2, H: 2, board: 1}; }
  api.boardMos = boardMos;

  /* ═══ [BLOCK CTX-STATE] состояние поверхности из записи sess (как openSess, без загрузки кадров) ═══ */
  function stateOf(o, view) {
    return {sess: o, q4: o.q4 || null, lines: o.lines || {}, la: o.la || {}, wsh: o.wsh || {}, man: o.man || {}, els: o.els || [], notes: o.notes || [], und: (o.und || []).slice(), red: [],
      dms: o.dms || [], drw: o.drw || [], rts: o.rts || [], polys: o.polys || [], rulers: o.rulers || [], refs: o.refs || [], frames: [], mosaic: o.kind === 'board' ? boardMos(o.q4) : null, sol: null,
      room0: null, planL: null, show: -1, sel: null, dsel: null, nsel: null, msel: [], rsel: null, zpl: [], zRef: null, pend: null, rsr: null, detc: {}, view, mode: 'wall', room: null, zpen: null, loupe: null, labDrag: null};
  }
  api.stateOf = stateOf;

  /* ═══ [BLOCK CTX-PAINT] ctxPaint(rec, view, paint, opt): подменить S → paint() → вернуть всё как было.
     opt.noBg — не заливать холст фоном (первый fillRect на весь холст пропускается): подложка ложится на слой холста;
     opt.refs === false — без фото (второй проход поверх активной стены: только рисунки). ═══ */
  function ctxPaint(rec, view, paint, opt) {
    opt = opt || {}; if (!rec || typeof paint !== 'function') return false;
    const keep = {}; for (const k of KEYS) keep[k] = S[k];
    const st = stateOf(rec, view); if (opt.refs === false) st.refs = [];
    const fr = cx.fillRect; let skip = !!opt.noBg;
    if (skip) cx.fillRect = function (x, y, w, h) { if (skip && x === 0 && y === 0 && w === cv.width && h === cv.height) { skip = false; return; } return fr.apply(this, arguments); };
    const stubs = swapStubs(); LABCTX.painting++;
    try { Object.assign(S, st); paint(); return true; }
    catch (e) { console.error('ctxPaint', e); return false; }
    finally { LABCTX.painting--; for (const k of KEYS) S[k] = keep[k]; restoreStubs(stubs); if (opt.noBg) delete cx.fillRect; }
  }
  api.paint = ctxPaint;
  api.painting = () => LABCTX.painting > 0;
  /* для теста: снимок S по ключам (глубокое сравнение) */
  api.digest = () => { const o = {}; for (const k of KEYS) { const v = S[k]; try { o[k] = k === 'mosaic' ? (v ? [v.W, v.H, v.r, v.x0, v.y1] : null) : k === 'sess' || k === 'room' || k === 'room0' ? (v ? v.id : null) : JSON.stringify(v, (kk, vv) => kk[0] === '_' || vv instanceof HTMLElement || vv instanceof ImageBitmap ? undefined : vv); } catch (e) { o[k] = '?'; } } return JSON.stringify(o); };
})();
