/* Measure 82.18 — футляр в каждом режиме, нижняя строка без дублей, одна 🗑, без 📐 (AKX-2026-0012 инженер C; AKX-2026-0009 F1/F3/F5/F7).
   П2 футляр: штатные tbOpen() (стена ⌖, «Коммуникации и размеры» — 🖍 #zpF) и zpTb() (план — 🖍 #labPlF первой кнопкой #plb)
      + группа Lab «Холст» (cam gal note room plan exp imp — без open/obj/close) → MeasureLabSketch.cmd(a);
      план: плитки «Зона» (MeasureLab012.open('pick')) и «Размер пола» (MeasureLabFloorRoutes). Плитки — штатные .tl 36×36, значки 22.
   П3 фото: выбранное фото-справка (S.rsel — стена и подложка холста) — блок в самой нижней строке #zpb:
      🖍 | 🔍 распознать · ⤢ на весь экран · ▣ на стену (+ ⌗ углы / ▣ стена по фото, если их даёт холст) | цвета | ↶ ↷ 🗑.
      Плавающая плашка #rfb скрыта (её кнопки вызываются из блока); на плане блок заменяет #plb — нижняя строка одна.
   Одна 🗑: удаление выбранного — только #bDelS; кнопки ✕ / 🗑 удаления в плашках (#pp, #rfb, «Зоны») скрыты CSS — их случаи
      штатно удаляет zDelSel. Касание ↶ ↷ 🗑 не снимает выбор фото (POP81).
   Раскладка: #zopt — справа в ряду #zb (как v81), трасса — своей строкой на всю ширину; «Трасса / Размер пола» — в футляре плана;
      «Зоны» (#lab12-plan) — строкой стека #zf, а не плавающей; #rzT — в потоке #zpb.
   П4: 📐 нигде — замена после вывода (mkPanel, toast, rzUi, rzMenu, #ss). Поверх неизменной v81 (обёртки): tbOpen, zpTb, plBar, mkChips,
      zpbDraw, lay05, zLay, mkPanel, toast, rzUi, rzMenu, rfUi. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabTb) return;
  const api = window.MeasureLabTb = {version: 2};
  const $i = id => document.getElementById(id);

  /* ═══ [BLOCK TB-SYM] значки Lab — в скрытый <svg> штатных символов; 32×32, полноцветные, палитра v81, без currentColor ═══ */
  const SYM = '<symbol id="t-export" viewBox="0 0 32 32"><path d="M7 3h12l6 6v20H7z" fill="#E8EBEF" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M19 3v6h6" fill="none" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 25V13" stroke="#2E9E4F" stroke-width="3" stroke-linecap="round"/><path d="M10.5 18L16 12.5l5.5 5.5" fill="none" stroke="#2E9E4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
    + '<symbol id="t-import" viewBox="0 0 32 32"><path d="M7 3h12l6 6v20H7z" fill="#E8EBEF" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M19 3v6h6" fill="none" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 12v12" stroke="#1F6FD1" stroke-width="3" stroke-linecap="round"/><path d="M10.5 19L16 24.5l5.5-5.5" fill="none" stroke="#1F6FD1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
    + '<symbol id="t-scan" viewBox="0 0 32 32"><rect x="3" y="5" width="20" height="16" rx="2" fill="#E8EBEF" stroke="#8B93A1" stroke-width="1.6"/><path d="M6 18l5-6 4 4 3-3 3 5z" fill="#2E9E4F"/><circle cx="21" cy="19" r="6" fill="#fff" stroke="#1F6FD1" stroke-width="2.6"/><path d="M25.3 23.3l4 4" stroke="#1F6FD1" stroke-width="3.2" stroke-linecap="round"/></symbol>'
    + '<symbol id="t-full" viewBox="0 0 32 32"><rect x="5" y="5" width="22" height="22" rx="3" fill="#E8EBEF" stroke="#8B93A1" stroke-width="1.6"/><path d="M9 14V9h5M18 9h5v5M23 18v5h-5M14 23H9v-5" fill="none" stroke="#1F6FD1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
    + '<symbol id="t-note" viewBox="0 0 32 32"><path d="M5 4h22v17l-7 7H5z" fill="#F6E08A" stroke="#C99A00" stroke-width="1.6" stroke-linejoin="round"/><path d="M20 28v-7h7" fill="#E8C24A" stroke="#C99A00" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 10h14M9 14.5h14M9 19h8" stroke="#1A2027" stroke-width="2" stroke-linecap="round"/></symbol>'
    + '<symbol id="t-room" viewBox="0 0 32 32"><path d="M4 6h18v20H4z" fill="#E8EBEF" stroke="#1F9EA8" stroke-width="2.4" stroke-linejoin="round"/><path d="M4 16h8v10M12 6v5" fill="none" stroke="#1F9EA8" stroke-width="2.2"/><circle cx="24" cy="23" r="6.5" fill="#2E9E4F"/><path d="M24 19.5v7M20.5 23h7" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></symbol>'
    + '<symbol id="t-prd" viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" rx="1.5" fill="#E8C9A0" stroke="#8A5A2B" stroke-width="1.8"/><path d="M16 6v20M4 13h12" stroke="#8A5A2B" stroke-width="1.6"/><path d="M12 18v3M20 15v3" stroke="#1A2027" stroke-width="2" stroke-linecap="round"/><path d="M6 26v2M26 26v2" stroke="#5B6472" stroke-width="2" stroke-linecap="round"/></symbol>'
    + '<symbol id="t-zone" viewBox="0 0 32 32"><path d="M4 5h24v22H4z" fill="#E8EBEF" stroke="#5B6472" stroke-width="2"/><path d="M5 6h12v10H5z" fill="#F2C200" opacity=".85"/><path d="M17 16h10v10H17z" fill="#1F6FD1" opacity=".75"/><path d="M17 5v22M4 16h24" stroke="#5B6472" stroke-width="1.6" stroke-dasharray="3 2"/></symbol>';
  { const c = document.querySelector('svg symbol#t-cup'); if (c && !$i('t-scan')) c.parentNode.insertAdjacentHTML('beforeend', SYM); }
  const svgU = (id, vb) => `<svg viewBox="${vb || '0 0 32 32'}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  /* ═══ [BLOCK TB-CMD] команды холста: контракт 82.18 MeasureLabSketch.cmd(a); до слияния — мост к «Скетчу» 82.17 ═══ */
  const SK = () => window.MeasureLabSketch;
  const skOn = () => { const s = SK(); try { return !!(s && s.isOpen && s.isOpen()); } catch (e) { return false; } };
  function skCmd(a) {
    const s = SK(); if (!s) return false;
    if (typeof s.cmd === 'function') { s.cmd(a); return true; }
    if (a === 'room' && typeof s.roomCreate === 'function') { s.roomCreate('Помещение ' + (((s.state && s.state.rooms) || []).length + 1)); return true; }
    const b = document.querySelector(`#labSketch [data-sa="${a}"], #zf .sk-row [data-sa="${a}"]`); if (b) { b.click(); return true; }   // «Скетч» 82.17
    return false;
  }
  api.cmd = skCmd;

  /* ═══ [BLOCK TB-LAB] группы Lab в штатном листе: «Холст» (только на холсте), план — «Зона», «Размер пола». У плиток нет data-k / data-pk ═══ */
  const CANVAS = [   // [команда, подпись, цвет рамки, значок]
    ['cam', 'Фото камерой на холст', '#1F6FD1', () => kIco('rfc')],
    ['gal', 'Фото из галереи на холст', '#2E9E4F', () => svgU('t-image')],
    ['note', 'Заметка на холсте', '#F2C200', () => svgU('t-note')],
    ['room', 'Новое помещение', '#1F9EA8', () => svgU('t-room')],
    ['plan', 'План помещений', '#1F9EA8', () => svgU('t-rooms')],
    ['exp', 'Перенос холста: сохранить', '#2E9E4F', () => svgU('t-export')],
    ['imp', 'Перенос холста: загрузить', '#1F6FD1', () => svgU('t-import')]];
  const fr = () => window.MeasureLabFloorRoutes;
  const z12 = () => window.MeasureLab012;
  const PLAN = [
    ['zone', 'Зона: области внутри помещения', '#F2C200', () => svgU('t-zone'), () => !!(z12() && typeof z12().open === 'function'), () => { z12().open('pick'); try { mkPanel(); draw(); } catch (e) { } }],
    ['prd', 'Изделие', '#8A5A2B', () => svgU('t-prd'), () => !!(window.MeasureLabPrd && typeof MeasureLabPrd.open === 'function'), () => MeasureLabPrd.open()],
    ['fdim', 'Размер пола', '#1F6FD1', () => kIcoD('dim'), () => !!(fr() && fr().setDimensionTool), () => { fr().setDimensionTool(); try { mkChips(); mkPanel(); draw(); } catch (e) { } }]];
  function tiles(list, act) { return list.map(([a, ti, c, ic]) => `<div class="tl${act === a ? ' on' : ''}" data-lab-tb="${a}" style="--c:${c}" title="${esc(ti)}">${ic()}<span>${esc(ti)}</span></div>`).join(''); }
  function labTbExtend(kind) {
    const t = $i('tb'); if (!t || !t.classList.contains('on') || t.querySelector('[data-lab-g]')) return;
    const add = (name, html) => { if (!html) return; const h = document.createElement('h4'); h.textContent = name; const g = document.createElement('div'); g.className = 'g'; g.dataset.labG = name; g.innerHTML = html;
      const gg = t.querySelector('.gg7'), last = [...t.querySelectorAll(':scope>.g')].pop(); if (kind === 'tb' && gg) gg.append(h, g); else if (last) last.after(h, g); else t.append(h, g); };
    if (kind === 'plan') add('План Lab', tiles(PLAN.filter(x => x[4]()), PL.tool === 'labFloorDim' ? 'fdim' : z12() && z12().isOpen && z12().isOpen() ? 'zone' : ''));
    if (skOn()) add('Холст', tiles(CANVAS));
    t.querySelectorAll('[data-lab-tb]').forEach(d => d.onclick = () => { d.classList.remove('on'); t.classList.remove('on'); const a = d.dataset.labTb, p = PLAN.find(x => x[0] === a); if (p) return p[5](); skCmd(a); });
    if (kind === 'tb') rzRemap(t);
  }
  api.extend = labTbExtend;
  /* rz + футляр (допущение, проект 2d): коммуникации — инструментом режима (rzPick, как ряд rz); остальное — выход из rz и штатный pickTool */
  function rzRemap(t) {
    let ok = false; try { ok = rzOk(); } catch (e) { } if (!ok) return;
    const order = (window.MeasureLabComms && MeasureLabComms.order) || [];
    t.querySelectorAll('.tl[data-k]').forEach(d => { const k = d.dataset.k;
      d.onclick = () => { if (d.dataset.drag) { delete d.dataset.drag; return; } t.classList.remove('on');
        if (order.includes(k)) return rzPick(k);
        try { PM.rzToggle(false); } catch (e) { } pickTool(k); }; });
  }
  const tb0 = tbOpen; tbOpen = function () { const r = tb0.apply(this, arguments); try { labTbExtend('tb'); } catch (e) { console.error(e); } return r; };
  const zp0 = zpTb; zpTb = function () { const r = zp0.apply(this, arguments); try { labTbExtend('plan'); } catch (e) { console.error(e); } return r; };

  /* ═══ [BLOCK TB-PLF] план: вход в футляр — первой кнопкой нижней строки #plb (на месте дублей колонны / ниши) ═══ */
  function labPlF() {
    const b = $i('plb'); if (!b || b.querySelector('#labPlF')) return;
    b.insertAdjacentHTML('afterbegin', `<button id="labPlF" title="Футляр: инструменты плана">${svgU('t-cup')}</button><span class="sep" data-lab-plf></span>`);
    $i('labPlF').onclick = () => zpTb();
  }
  const pb0 = plBar; plBar = function () { const r = pb0.apply(this, arguments); try { labPlF(); } catch (e) { } return r; };
  labPlF();
  /* «Размер пола» (Lab) активен — временная кнопка в ряду плана, как у штатного активного инструмента */
  const mc0 = mkChips; mkChips = function () { const r = mc0.apply(this, arguments);
    try { const ch = $i('ch'); if (ch && S.mode === 'plan' && PL.tool === 'labFloorDim' && !ch.querySelector('[data-lab-fdim]')) { const b = document.createElement('div'); b.className = 'pb on'; b.dataset.labFdim = '1'; b.title = 'Размер пола'; b.style.setProperty('--c', '#1F6FD1'); b.innerHTML = kIcoD('dim'); b.onclick = () => { PL.tool = 'sel'; mkChips(); mkPanel(); draw(); }; const plus = ch.querySelector('#plAll'); ch.insertBefore(b, plus || null); } } catch (e) { }
    layout(); return r; };

  /* ═══ [BLOCK TB-PHOTO] блок выбранного фото — в самой нижней строке #zpb ═══ */
  const phSel = () => { try { const sk = SK(); if (sk && typeof sk.block === 'function' && sk.block()) return false;   // фото подложки холста — блок модуля холста (⌗ ▣), без второго блока
    return S.mode !== 'plan' && !!S.rsel && !!rfGet(S.rsel) && rfOn(); } catch (e) { return false; } };
  api.photo = phSel;
  let phKey = '';
  function phButtons() {
    const r = rfGet(S.rsel), s = SK(), m = $i('rfbM'), onW = !!(r && r.on);
    let h = `<button data-lab-ph="scan" title="Распознать: AI или вручную">${svgU('t-scan')}</button>`
      + `<button data-lab-ph="full" title="На весь экран">${svgU('t-full')}</button>`
      + (m && getComputedStyle(m).display !== 'none' && !m.hidden ? `<button data-lab-ph="wall" class="${onW ? 'on' : ''}" title="${esc(m.title || 'На стену: выпрямить по 4 углам')}">${svgU('t-wallseg')}</button>` : '');
    const extra = s && typeof s.photoCmds === 'function' ? (s.photoCmds(r) || []) : [];   // холст 82.18: ⌗ углы, ▣ стена по фото — [{a, title, icon, on}]
    for (const x of extra) h += `<button data-lab-skp="${esc(x.a)}" class="${x.on ? 'on' : ''}" title="${esc(x.title || '')}">${x.icon || kIcoD('pts')}${x.n != null ? `<i>${esc(x.n)}</i>` : ''}</button>`;
    return h;
  }
  const zpb0 = zpbDraw; zpbDraw = function () {
    const res = zpb0.apply(this, arguments), el = $i('zpb'); if (!el) return res;
    try {
      const ch = $i('ch');   // против дублей: вид пера в полосе, если он уже в ряду
      el.querySelectorAll(':scope>[data-zk]').forEach(x => x.classList.toggle('lab-dup', !!(ch && ch.querySelector(`.pb[data-k="${x.dataset.zk}"]`))));
      const old = el.querySelector('#labPh'); if (old) old.remove();
      const on = phSel(); document.body.classList.toggle('lab-ph', on); if (!on) return res;
      let f = el.querySelector('#zpF'); if (!f) { el.insertAdjacentHTML('afterbegin', `<button id="zpF" title="Футляр: все инструменты, цвета">${svgU('t-cup')}</button>`); f = el.querySelector('#zpF'); f.onclick = () => tbOpen(); }
      if (!el.querySelector(':scope>.zcols')) { const c = kC(S.mk), z = document.createElement('span'); z.className = 'zcols';
        z.innerHTML = zColL().map(q => `<button class="cl${c === q ? ' on' : ''}" data-zc="${q}" style="background:${q}!important" title="Цвет ${q}"></button>`).join('');
        z.querySelectorAll('[data-zc]').forEach(x => x.onclick = () => zCol(x.dataset.zc)); const u = $i('zur'); el.insertBefore(z, u && u.parentElement === el ? u : null); }
      const box = document.createElement('span'); box.id = 'labPh'; box.innerHTML = `<span class="sep"></span>${phButtons()}<span class="sep"></span>`;
      f.after(box);
      box.querySelectorAll('[data-lab-ph]').forEach(x => x.onclick = () => { const id = {scan: 'rfbR', full: 'rfbV', wall: 'rfbM'}[x.dataset.labPh], b = $i(id); if (b && !b.disabled) b.click(); setTimeout(phRefresh, 50); });
      box.querySelectorAll('[data-lab-skp]').forEach(x => x.onclick = () => { skCmd(x.dataset.labSkp); setTimeout(phRefresh, 50); });
      const u = $i('zur'); if (u && u.parentElement !== el) el.appendChild(u);   // ↶ ↷ 🗑 — в этой же строке справа
    } catch (e) { console.error(e); }
    return res;
  };
  const lay0 = lay05; lay05 = function () { const res = lay0.apply(this, arguments); try { if (phSel()) { const u = $i('zur'), el = $i('zpb'); if (u && el && u.parentElement !== el) el.appendChild(u); } } catch (e) { } return res; };
  function phRefresh() {
    const r = phSel() && rfGet(S.rsel), key = r ? [r.id, !!r.on, ...(((SK() || {}).photoCmds && SK().photoCmds(r)) || []).map(x => x.a + x.on + x.n)].join('|') : '';
    if (key === phKey) return; const was = phKey; phKey = key;
    document.body.classList.toggle('lab-ph', !!r);
    try { zpbDraw(); } catch (e) { } if (!r && was) { try { lay05(); } catch (e) { } }   // снятие выбора: lay05 возвращает ↶ ↷ 🗑 на штатное место
  }
  api.photoRefresh = phRefresh;
  const rfUi0 = rfUi; rfUi = function () { const r = rfUi0.apply(this, arguments); try { phRefresh(); } catch (e) { } return r; };   // rfUi — после каждой отрисовки
  /* касание ↶ ↷ 🗑 и блока фото не снимает выбор фото (штатно #rfb снимал выбор при касании вне себя) */
  try { const q = POP81.find(x => x.s === '#rfb'); if (q) q.op = [q.op, '#zur', '#labPh', '#zpF', '#tb'].filter(Boolean).join(','); } catch (e) { }

  /* ═══ [BLOCK TB-LAYOUT] строки стека #zf без «ступенек» (AKX-2026-0009 F1, F3, F5) ═══ */
  function layout() {
    const zf = $i('zf'), zb = $i('zb'), opt = $i('zopt'), ch = $i('ch'); if (!zf || !zb || !opt || !ch) return;
    const own = document.body.classList.contains('lab-route-options');   // тип трассы + модификаторы — своя строка во всю ширину
    if (own) { if (opt.parentNode !== zf || opt.nextElementSibling !== zb) zf.insertBefore(opt, zb); }
    else if (opt.parentNode !== zb || opt.previousElementSibling !== ch) ch.after(opt);   // модификаторы — справа в ряду инструментов (v81)
    const p12 = $i('lab12-plan');
    if (p12) {   // «Зоны» — строкой стека, над рядом инструментов; без содержимого (зоны закрыты) — строки нет
      if (p12.parentNode !== zf) zf.insertBefore(p12, zf.contains(opt) && opt.parentNode === zf ? opt : zb); else if (p12.nextElementSibling !== zb && !(p12.nextElementSibling === opt && opt.parentNode === zf)) zf.insertBefore(p12, opt.parentNode === zf ? opt : zb);
      const z = z12(), closed = !!(z && typeof z.isOpen === 'function' && !z.isOpen());
      p12.classList.toggle('lab-tb-off', closed);
    }
    const pp = $i('labprd-plan');   // «Изделия» (AKX-2026-0013, lab-prd) — так же строкой стека над рядом инструментов, не плавающей
    if (pp) { const ref = opt.parentNode === zf ? opt : zb; if (pp.parentNode !== zf || pp.nextElementSibling !== ref) zf.insertBefore(pp, ref); }
  }
  api.layout = layout;
  const zl0 = zLay; zLay = function () { const r = zl0.apply(this, arguments); try { layout(); } catch (e) { } return r; };
  const mp1 = mkPanel; mkPanel = function () { const r = mp1.apply(this, arguments); try { layout(); } catch (e) { } return r; };
  new MutationObserver(() => { try { layout(); } catch (e) { } }).observe(document.body, {attributes: true, attributeFilter: ['class']});
  /* F1: после выхода из трассы штатные модификаторы (L / 🧲 плана, опции инструмента) рисуются заново — lab-route-ui.js сбрасывает кэш */

  /* ═══ [BLOCK TB-NO-RULER] значок 📐 не выводится (v81 не меняется — замена после вывода) ═══ */
  const NO = '\u{1F4D0}', RZN = 'Коммуникации и размеры';
  const icoHtml = h => `<span class="lab-ic">${h}</span>`;
  function scrub(root, text) {   // text — подстановка словами (rz), иначе значок: панель 4 точек — «4 угла», остальное — t-image («план — фото / скан»)
    if (!root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), L = []; while (w.nextNode()) if (w.currentNode.nodeValue.includes(NO)) L.push(w.currentNode);
    for (const n of L) {
      if (text) { n.nodeValue = n.nodeValue.split(NO).join(text).replace(/\s{2,}/g, ' '); continue; }
      const p = n.parentElement, ic = icoHtml(p && p.matches('#pp .t') ? kIcoD('pts') : svgU('t-image')), f = document.createDocumentFragment();
      n.nodeValue.split(NO).forEach((s, i) => { if (i) { const tp = document.createElement('template'); tp.innerHTML = ic; f.append(tp.content); } if (s) f.append(document.createTextNode(i ? s.replace(/^\s+/, ' ') : s)); });
      n.replaceWith(f);
    }
    for (const e of [root, ...root.querySelectorAll('[title]')]) if (e.title && e.title.includes(NO)) e.title = e.title.split(NO).join(text || 'план').replace(/\s{2,}/g, ' ');
  }
  api.scrub = scrub;
  const noRuler = t => String(t).replace(new RegExp('«' + NO + '\\s*([^»]*)»', 'gu'), '«$1»').replace(new RegExp(NO + '\\s*', 'gu'), '«план» ').trim();
  api.noRuler = noRuler;
  const toast0 = toast; toast = function (t) { return toast0.call(this, noRuler(t)); };
  const mp0 = mkPanel; mkPanel = function () { const r = mp0.apply(this, arguments); try { scrub($i('pp')); } catch (e) { } return r; };
  const ru0 = rzUi; rzUi = function () { const r = ru0.apply(this, arguments); try { scrub($i('rzT'), RZN); scrub($i('zf'), RZN); } catch (e) { } return r; };
  if (typeof rzMenu === 'function') { const rm0 = rzMenu; rzMenu = function () { const r = rm0.apply(this, arguments); try { scrub($i('rzM'), RZN); } catch (e) { } return r; }; }
  new MutationObserver(() => { try { for (const id of ['pp', 'ss', 'tb']) { const e = $i(id); if (e && (e.textContent.includes(NO) || e.querySelector(`[title*="${NO}"]`))) scrub(e); } } catch (e) { } }).observe(document.body, {childList: true, subtree: true});
  try { scrub($i('pp')); scrub($i('rzT'), RZN); scrub($i('ss')); } catch (e) { }
  /* ═══ [BLOCK TB-W3] 82.18 g2 (QA Д7): ∠° / Aa и строка стен (#w3p) в виде стены на холсте.
     w3Row() вызывается из каждого draw(), в том числе из отрисовки подложки и снимков других областей (MeasureLabCtx.paint
     подменяет S: стены там нет) — класс body.w3 и бегунок #w3sl снимались через ~1,3 с (снимок по простою) и сразу после
     активации стены касанием области. Во время подмены S строка не трогается; после — пересчёт по настоящему S. ═══ */
  if (typeof w3Row === 'function') {
    const wr0 = w3Row;
    const swapped = () => { try { return !!(window.MeasureLabCtx && MeasureLabCtx.painting && MeasureLabCtx.painting()); } catch (e) { return false; } };
    w3Row = function () { if (swapped()) return; return wr0.apply(this, arguments); };
    api.w3Row = () => w3Row();
  }
  /* ═══ [BLOCK TB-ROWS2] 82.18 g2 (QA Д13): строки стабильны.
     1) ↶ ↷ 🗑 (#zur) — в нижней строке #zpb, когда она видна: lay05 во время своей клавиатуры (#zkb, body.kb) видел #zpb скрытой
        и переносил #zur в ряд инструментов, а обратно — только по следующему касанию.
     2) Лента цветов (#zpb .zcols): штатный stripShow докручивает до выбранного цвета на произвольный сдвиг — первый видимый
        кружок обрезан; сдвиг округляется до целого шага кружка (выбранный остаётся виден). ═══ */
  const zurHome = () => { try {
    const u = $i('zur'), el = $i('zpb'); if (!u || !el || document.body.classList.contains('kb')) return;
    if (S.mode === 'plan' || zCur() !== 'mk' || !el.offsetParent) return;
    if (u.parentElement !== el) el.appendChild(u);
    const zc = el.querySelector('.zcols'); if (zc && api.snapStrip) api.snapStrip(zc, zc.querySelector('.cl.on'));
  } catch (e) { } };
  api.zurHome = zurHome;
  { const l0 = lay05; lay05 = function () { const r = l0.apply(this, arguments); zurHome(); return r; }; }
  new MutationObserver(() => { if (!document.body.classList.contains('kb')) requestAnimationFrame(zurHome); }).observe(document.body, {attributes: true, attributeFilter: ['class']});
  if (typeof stripShow === 'function') {
    const ss0 = stripShow;
    /* r2b (QA2 Н9): лента цветов строки пера — одна строка с явной прокруткой (край гаснет, «›» / «‹»: lab-more-r / lab-more-l).
       Первый показ — с первого цвета (чёрный); при перерисовке строки положение прокрутки сохраняется (api.zcolsX);
       выбранный касанием цвет (.cl.on) после перерисовки не уходит из видимой части — лента докручивается к нему до целого кружка. */
    const moreUpd = box => { try { const m = box.scrollWidth - box.clientWidth; box.classList.toggle('lab-more-r', m > 2 && box.scrollLeft < m - 2); box.classList.toggle('lab-more-l', m > 2 && box.scrollLeft > 2); } catch (e) { } };
    api.zcolsX = 0; api.zcolsPick = 0;
    document.addEventListener('click', ev => { const b = ev.target && ev.target.closest && ev.target.closest('.zcols [data-zc]'); if (b) { api.zcolsPick = 1; const zc = b.closest('.zcols'); if (zc) api.zcolsX = zc.scrollLeft; } }, true);   // выбор цвета касанием ленты — после перерисовки он в видимой части
    const keepOn = box => {   // выбранный — целиком в видимой части (сдвиг к краю кружка)
      const it = box.querySelector('.cl.on'); if (!it) return; const br = box.getBoundingClientRect(), r = it.getBoundingClientRect(), pad = 0;
      if (r.left < br.left) box.scrollLeft -= br.left - r.left + 2; else if (r.right > br.right - pad) box.scrollLeft += r.right - (br.right - pad) + 2;
    };
    const snapStrip = box => { try {
      if (!box || !box.classList.contains('zcols')) return;
      if (!box._labInit) { box._labInit = 1; box.scrollLeft = api.zcolsX || 0; if (api.zcolsPick) { api.zcolsPick = 0; keepOn(box); }
        box.addEventListener('scroll', () => { moreUpd(box); if (box.isConnected && box.offsetWidth) api.zcolsX = box.scrollLeft; }, {passive: true}); }
      api.zcolsX = box.scrollLeft; moreUpd(box);
    } catch (e) { } };
    api.moreUpd = moreUpd;
    stripShow = function (box, it) { if (box && box.classList && box.classList.contains('zcols')) { requestAnimationFrame(() => snapStrip(box)); return; } return ss0.apply(this, arguments); };
    api.snapStrip = snapStrip;
  }
  PM.labTb = api;
})();
