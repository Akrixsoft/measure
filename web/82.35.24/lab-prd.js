/* ═══ [BLOCK LAB-PRD] AKX-2026-0013 / AKX-2026-0012: мебельные конструкции (изделия) на плане Замера.
   Владелец: на одном холсте — всё помещение и комнаты (зоны ms.labRooms, lab-v012); каждой стене назначаются комната
   и конструкция; в помещении может быть несколько конструкций; одна стена — в нескольких конструкциях и комнатах.
   В конструкторе каждая конструкция — своя вкладка (стоимость отдельно), §Р-2 questions-constructor.md.

   Данные — штатное хранилище изделий v81 (v57, скрыто с v59): r.prd = [{id, n, w:[{wid, a?, b?}], note?}] у ВСЕХ
   помещений объекта. Расширение (необязательные поля): room — id комнаты из labRooms; type — тип из списка TYPES;
   no — номер конструкции по проекту (не переиспользуется). Решение владельца 11.11: участок стены (a…b) не нужен — только
   целые стены (a/b v81 при чтении игнорируются); свободного имени нет — name = тип, второй такой же тип в комнате — «Шкаф 2». Служебные: r.prdT — время записи (берётся самая свежая копия), r.prdHi — счётчик no
   (если модуль проектов даёт MeasureLabStore.prdNext — берётся больший).

   Выгрузка «для Akrix» (З7, уточнение владельца): o.prd[] = {id, no, type, name, room?, walls:[wid], note?} — только стены,
   существующие в выгрузке; пустые конструкции не выгружаются; room — только если такая комната есть в выгрузке.
   Формат v3 не меняется. Импорт своей выгрузки (♻ → zImpExp) восстанавливает r.prd.

   Интерфейс: панель внизу над полосой инструментов (как «Зоны» lab-v012), вход — MeasureLabPrd.open/close/isOpen;
   вход — плитка «Изделие» футляра плана (lab-tb). Удаление — штатной 🗑, отмена — ↶ (plSnap). ═══ */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabPrd) return;
  const api = window.MeasureLabPrd = {};
  const clone = x => JSON.parse(JSON.stringify(x));
  const px = n => n * (devicePixelRatio || 1);
  const all = () => [S.room, ...(S.objRooms || [])].filter(r => r && r.ms);
  const real = () => all().filter(r => !r.pstub);
  const zones = () => real().flatMap(r => (r.ms.labRooms || []).map(q => ({r, q})));
  const zoneOf = id => id ? zones().find(z => z.q.id === id) : null;
  /* типы конструкций — единственный список модуля (обратимое допущение; правится здесь) */
  const TYPES = ['Кухня', 'Шкаф', 'Гардероб', 'Прихожая', 'ТВ-зона', 'Стеллаж', 'Санузел', 'Другое'];
  const OTHER = 'Другое';
  const typeOf = p => TYPES.includes(p && p.type) ? p.type : OTHER;   // v81 без типа — «Другое»
  api.TYPES = TYPES.slice();

  /* ── [SUB PRD-DATA] хранение ── */
  function list() {
    const R = all(); let best = null;
    for (const r of R) if (Array.isArray(r.prd) && (r.prdT || 0) > ((best && best.prdT) || 0)) best = r;
    if (!best) best = R.find(r => (r.prd || []).length);   // v81: первое помещение с изделиями
    return best ? clone(best.prd || []) : [];
  }
  const hiOf = L => Math.max(0, ...all().map(r => +r.prdHi || 0), ...L.map(p => +p.no || 0));
  function persist(r) {
    if (r === S.room) saveRoom();
    else dbPut('sess', clone(r)).catch(error => { console.error(error); toast('Не удалось сохранить помещение'); });
  }
  function write(L, hi) {
    const t = Date.now(), H = Math.max(hiOf(L), hi || 0);
    for (const r of all()) { r.prd = clone(L); r.prdT = t; r.prdHi = H; persist(r); }
  }
  function nextNo(L) {
    const ext = window.MeasureLabStore && window.MeasureLabStore.prdNext;
    return Math.max(typeof ext === 'function' ? +ext(S.room) || 0 : 0, hiOf(L) + 1);
  }
  /* изменение — одним шагом ↶: снимок холста до правки */
  function change(fn) {
    plSnap();
    const L = list(), hi = fn(L);
    write(L, hi);
    return L;
  }
  /* изделия v81 без no получают номер при первом открытии (порядок списка сохраняется) */
  function noFix() {
    const L = list(); if (!L.some(p => !(+p.no > 0))) return;
    let hi = hiOf(L); for (const p of L) if (!(+p.no > 0)) p.no = ++hi;
    write(L, hi);
  }
  function wallAt(wid) {
    for (const r of real()) for (const [k, v] of Object.entries(r.wid || {})) if (v === wid && +k < plN(r.ms)) return {r, k: +k};
    return null;
  }
  /* имя = тип; одинаковые типы в одной комнате — по порядку номера no: «Шкаф», «Шкаф 2»… */
  const roomKey = (p, Z) => (Z ? Z.has(p.room) : zoneOf(p.room)) ? p.room : '';   // Z — комнаты выгрузки (Д2: не зависит от активной поверхности)
  function nameOf(p, L, Z) {
    L = Array.isArray(L) ? L : list(); const t = typeOf(p), k = roomKey(p, Z);
    const same = L.filter(q => typeOf(q) === t && roomKey(q, Z) === k).sort((a, b) => (+a.no || 0) - (+b.no || 0));
    const i = same.findIndex(q => q.id === p.id);
    return i > 0 ? t + ' ' + (i + 1) : t;
  }
  const label = (p, L) => {
    const z = zoneOf(p.room), n = nameOf(p, L);
    return z ? z.q.name + ' · ' + n : n;
  };
  api.nameOf = (p, L) => nameOf(p, L);
  api.list = list;
  api.label = p => label(p);

  /* ── [SUB PRD-OUT] выгрузка (З7) ── */
  function out(L, rooms) {
    const W = new Map(), Z = new Set();
    for (const R of rooms || []) {
      const m = R.ms || {};
      for (const [k, wid] of Object.entries(m.wid || {})) if (wid) W.set(wid, (m.wl || {})[k] || {});
      for (const w of Object.values(m.wl || {})) if (w && w.id && !W.has(w.id)) W.set(w.id, w);
      for (const q of m.labRooms || []) if (q && q.id) Z.add(q.id);
    }
    const res = [];
    for (const p of L || []) {
      const walls = [];
      for (const x of p.w || []) if (x && W.has(x.wid) && !walls.includes(x.wid)) walls.push(x.wid);   // целые стены; a/b v81 не выгружаются
      if (!walls.length) continue;   // пустые конструкции не выгружаются
      res.push({id: p.id, no: +p.no || 0, type: typeOf(p), name: nameOf(p, L, Z),
        ...(p.room && Z.has(p.room) ? {room: p.room} : {}), walls, ...(p.note ? {note: p.note} : {})});
    }
    return res;
  }
  api.out = out;
  /* Д2 (QA 82.18): список конструкций — из записей помещений, попавших в выгрузку (o.rooms[].id), а не из S.room / S.objRooms:
     при активной стене или подложке холста S.room пуст, и o.prd терялся. Открытая в v81 копия помещения — свежее базы (берётся она). */
  async function exportedRooms(o) {
    const mem = [S.room, S.room0, ...(S.objRooms || [])].filter(r => r && r.ms), res = [];
    for (const R of o.rooms || []) {
      if (!R || !R.id) continue;
      const m = mem.find(r => r.id === R.id), d = m ? null : await dbGet('sess', R.id).catch(() => null);
      if (m || d) res.push(m || d);
    }
    return res;
  }
  function listOf(R) {
    let best = null;
    for (const r of R) if (Array.isArray(r.prd) && (r.prdT || 0) > ((best && best.prdT) || 0)) best = r;
    if (!best) best = R.find(r => (r.prd || []).length);
    return best ? clone(best.prd || []) : [];
  }
  async function attach(o) {
    try {
      if (!o || !Array.isArray(o.rooms)) return o;
      const R = await exportedRooms(o), L = R.length ? listOf(R) : list();
      const P = out(L, o.rooms);
      if (P.length) o.prd = P; else delete o.prd;
    } catch (error) { console.warn('Measure 82.18 prd export', error); }
    return o;
  }
  const objOut = exportObjObj;
  exportObjObj = async function () { return attach(await objOut.apply(this, arguments)); };
  const roomOut = exportRoomAsObj;
  exportRoomAsObj = async function () { return attach(await roomOut.apply(this, arguments)); };

  /* ── [SUB PRD-IN] импорт своей выгрузки: o.prd → r.prd помещений объекта ── */
  function inp(P) {
    return (P || []).filter(p => p && p.id && Array.isArray(p.walls)).map(p => ({
      id: String(p.id), type: TYPES.includes(p.type) ? p.type : OTHER, n: p.name || '', ...(+p.no > 0 ? {no: +p.no} : {}), ...(p.room ? {room: p.room} : {}),
      w: p.walls.map(wid => ({wid})),
      ...(p.note ? {note: p.note} : {})}));
  }
  api.inp = inp;
  const imp0 = zImpExp;
  zImpExp = async function (o) {
    const n = await imp0.apply(this, arguments);
    try {
      if (n && o && Array.isArray(o.prd) && o.prd.length && S.room) {
        const L = inp(o.prd); write(L, hiOf(L)); await flushAll();
      }
    } catch (error) { console.warn('Measure 82.18 prd import', error); }
    return n;
  };

  /* ── [SUB PRD-UI] панель ── */
  let active = false, roomSel = null, cur = null, canvasId = null, picking = false;
  const panel = document.createElement('div');
  panel.id = 'labprd-plan'; panel.hidden = true; document.body.append(panel);
  function place() {
    const zf = $('zf'), r = zf && getComputedStyle(zf).display !== 'none' ? zf.getBoundingClientRect() : null;
    const kb = document.body.classList.contains('kb');
    const bottom = r && r.height ? innerHeight - r.top + 6 : kb ? 208 : 56;
    panel.style.bottom = Math.max(8, Math.round(bottom)) + 'px';
  }
  new MutationObserver(place).observe(document.body, {attributes: true, attributeFilter: ['class']});
  addEventListener('resize', place);

  function open() {
    if (S.mode !== 'plan' || !S.room) return false;
    if (window.MeasureLab012 && MeasureLab012.isOpen()) MeasureLab012.close();
    for (const r of real()) { let ch = false; try { gnFix(r); ch = wIdFix(r); } catch (e) { } if (ch && r !== S.room) persist(r); }
    noFix(); named(list());
    active = true; canvasId = S.room.obj || S.room.id;
    if (roomSel == null || (roomSel && !zoneOf(roomSel))) roomSel = (zones()[0] || {q: {id: ''}}).q.id;
    if (cur && !list().some(p => p.id === cur)) cur = null;
    S.psel = null; S.zps = null;
    if (PL.tool !== 'sel') { picking = true; try { plPick('sel'); } finally { picking = false; } }
    document.body.classList.add('labprd-on');
    mkPanel(); status(); draw();
    return true;
  }
  function close() {
    if (!active) return;
    active = false; cur = null; choosing = false;
    document.body.classList.remove('labprd-on');
    panel.hidden = true; lastPanel = ''; draw();
  }
  api.open = open; api.close = close; api.isOpen = () => active;
  api.select = id => { cur = id; choosing = false; draw(); };
  api.room = id => { roomSel = id || ''; cur = null; choosing = false; draw(); };

  let choosing = false;   // ＋ — ряд типов; касание типа создаёт конструкцию
  function add(type) {
    if (!TYPES.includes(type)) { choosing = !choosing; cur = choosing ? null : cur; draw(); return; }
    let id = null; choosing = false;
    const L = change(L => {
      const no = nextNo(L); id = 'pr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      L.push({id, no, type, n: '', ...(roomSel ? {room: roomSel} : {}), w: []});
      return no;
    });
    named(L);
    cur = id; draw();
    toast('Касайтесь стен или С№ — включить / выключить');
  }
  /* n (имя v81) — вслед за типом, без отдельного шага ↶ (входит в тот же снимок) */
  function named(L) {
    let ch = false; for (const p of L) { const n = nameOf(p, L); if (p.n !== n) { p.n = n; ch = true; } }
    if (ch) write(L);
  }
  function retype(type) {
    if (!TYPES.includes(type) || !cur) return;
    const L = change(L => { const p = L.find(x => x.id === cur); if (p) p.type = type; });
    named(L); draw();
  }
  api.retype = retype;
  function toggleWall(w) {
    if (!cur) return toast('Выберите конструкцию или ＋');
    if (!w) return toast('Коснитесь стены или её номера С№');
    let wid = (w.r.wid || {})[w.k];
    if (!wid) { try { wIdFix(w.r); } catch (e) { } wid = (w.r.wid || {})[w.k]; }
    if (!wid) return;
    let on = false;
    change(L => {
      const p = L.find(x => x.id === cur); if (!p) return;
      const i = p.w.findIndex(x => x.wid === wid);
      if (i >= 0) p.w.splice(i, 1); else { p.w.push({wid}); on = true; }
    });
    toast('С' + wN(w.r, w.k) + (on ? ' — в конструкции' : ' — снята'));
    draw();
  }
  function remove() {
    const L0 = list(), p = L0.find(x => x.id === cur); if (!p) return false;
    const name = label(p);
    named(change(L => { const i = L.findIndex(x => x.id === cur); if (i >= 0) L.splice(i, 1); }));
    cur = null; draw(); toast('«' + name + '» удалена · ↶ — вернуть');
    return true;
  }
  api.add = add; api.remove = remove;

  /* касание на плане: подпись С№ любой стены объекта или сам отрезок (палец и перо) */
  function wallHit(p) {
    const L = cvLabAt(p);
    if (L && !L.st && L.r && !L.r.pstub && L.k != null) return {r: L.r, k: L.k};
    let best = null, gap = px(18);
    for (const r of real()) for (let k = 0; k < plN(r.ms); k++) {
      const [a, b] = plSeg(r.ms, k).map(q => toScr(...q)), v = [b[0] - a[0], b[1] - a[1]], l2 = v[0] * v[0] + v[1] * v[1] || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / l2));
      const d = Math.hypot(a[0] + v[0] * t - p[0], a[1] + v[1] * t - p[1]);
      if (d < gap) { gap = d; best = {r, k}; }
    }
    return best;
  }
  api.wallHit = wallHit;
  const live = () => active && S.mode === 'plan' && S.room;
  const tap0 = plTap, finger0 = zTapSel, lab0 = labDown;
  plTap = function (p) { if (live()) return toggleWall(wallHit(p)); return tap0.apply(this, arguments); };
  zTapSel = function (p) { if (live()) return toggleWall(wallHit(p)); return finger0.apply(this, arguments); };
  labDown = function () { if (live()) return false; return lab0.apply(this, arguments); };
  const pick0 = plPick;
  plPick = function (k) { if (active && !picking && k !== 'sel') close(); return pick0.apply(this, arguments); };
  const del0 = zDelSel;
  zDelSel = async function () { if (live() && cur) return remove(); return del0.apply(this, arguments); };
  const has0 = zSelHas;
  zSelHas = function () { if (live() && cur) return true; return has0.apply(this, arguments); };

  let lastPanel = '';
  function el(tag, props, parent) { const e = Object.assign(document.createElement(tag), props || {}); if (parent) parent.append(e); return e; }
  function render() {
    const show = S.mode === 'plan' && !!S.room && !$('ss').classList.contains('on');
    if (active && (!show || canvasId !== (S.room.obj || S.room.id) || PL.tool !== 'sel')) return close();   // другой объект / не план / другой инструмент — панель закрыта
    panel.hidden = !show || !active;
    if (panel.hidden) { lastPanel = ''; return; }
    place();
    const L = list();
    if (cur && !L.some(p => p.id === cur)) cur = null;
    if (roomSel && !zoneOf(roomSel)) roomSel = '';
    const Z = zones(), mine = L.filter(p => (roomSel ? p.room === roomSel : !zoneOf(p.room)));
    const state = JSON.stringify([L, Z.map(z => [z.q.id, z.q.name]), roomSel, cur, choosing, real().map(r => [r.id, r.wid, r.gn])]);
    try { $('bDelS').classList.toggle('dis', !zSelHas()); } catch (e) { }
    if (state === lastPanel) return;
    lastPanel = state; panel.replaceChildren();
    const row = () => el('div', {className: 'labprd-row'}, panel);
    const button = (parent, text, fn, name, on) => {
      const b = el('button', {type: 'button', textContent: text, onclick: fn}, parent);
      b.dataset.labprd = name; if (on) b.classList.add('on'); return b;
    };
    /* 1: закрыть + комнаты */
    const r1_ = row();
    button(r1_, 'Закрыть изделия', close, 'close');
    for (const {q} of Z) button(r1_, q.name, () => { roomSel = q.id; cur = null; draw(); }, 'room', roomSel === q.id).dataset.room = q.id;
    if (!Z.length || L.some(p => !zoneOf(p.room))) button(r1_, 'Без комнаты', () => { roomSel = ''; cur = null; draw(); }, 'room', roomSel === '').dataset.room = '';
    /* 2: конструкции комнаты + новая */
    const r2 = row();
    for (const q of mine) button(r2, label(q, L) + ' · стен ' + q.w.filter(x => wallAt(x.wid)).length, () => { cur = cur === q.id ? null : q.id; choosing = false; draw(); }, 'item', cur === q.id).dataset.id = q.id;
    button(r2, '＋ Конструкция', () => add(), 'add', choosing);
    /* 3: тип — новой (ряд типов) или выбранной (штатный выбор из списка) */
    if (choosing) { const r3 = row(); for (const t of TYPES) button(r3, t, () => add(t), 'type').dataset.type = t; }
    const p = mine.find(x => x.id === cur);
    if (p && !choosing) {
      const r3 = row(), f = el('select', {title: 'Тип конструкции'}, r3);
      f.setAttribute('aria-label', 'Тип конструкции'); f.dataset.labprd = 'type-sel';
      for (const t of TYPES) el('option', {value: t, textContent: t, selected: t === typeOf(p)}, f);
      f.onchange = () => retype(f.value);
    }
    el('small', {textContent: choosing ? 'Тип новой конструкции' : p ? 'Стены и С№ — касанием · 🗑 — удалить'
      : mine.length ? 'Выберите конструкцию или ＋' : '＋ — новая конструкция' + (roomSel ? ' в комнате' : '')}, panel);
  }
  /* вход — плитка «Изделие» футляра плана (lab-tb → MeasureLabPrd.open()); временная кнопка «Изделия» в панели зон убрана (82.18 int) */

  /* ── [SUB PRD-DRAW] стены текущей конструкции на плане ── */
  const draw0 = draw;
  draw = function () {
    const result = draw0.apply(this, arguments);
    if (window.MeasureLabCtx && MeasureLabCtx.painting && MeasureLabCtx.painting()) return result;   /* 82.18 int: холст рисует неактивную область с подменой S — панель не трогать */
    try { render(); } catch (error) { console.warn('Measure 82.18 prd panel', error); }
    if (!active || panel.hidden || !cur) return result;
    const p = list().find(x => x.id === cur); if (!p) return result;
    cx.save(); cx.lineCap = 'round'; cx.setLineDash([]);
    for (const x of p.w) {
      const w = wallAt(x.wid); if (!w) continue;
      const [A, B] = plSeg(w.r.ms, w.k).map(q => toScr(...q));
      cx.strokeStyle = '#e8710acc'; cx.lineWidth = px(6);
      cx.beginPath(); cx.moveTo(...A); cx.lineTo(...B); cx.stroke();
    }
    cx.restore();
    return result;
  };
})();
