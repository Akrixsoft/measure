/* Measure 82.18 — футляр в каждом режиме и группа «Холст» (AKX-2026-0008/0009, проект архитектора architect-toolbars.md).
   П2: штатные tbOpen() / zpTb() + плитки Lab «Холст» (команды «Скетча» → MeasureLabSketch.cmd); вход в футляр на плане — #labPlF
       первой кнопкой #plb (дубли колонны / ниши убраны CSS); в «Коммуникациях и размерах» — 🖍 #zpF (CSS), плитки коммуникаций → rzPick.
   П4: значок 📐 нигде не выводится — замена после вывода (mkPanel, toast, rzUi, rzMenu).
   Работает поверх неизменной v81 (обёртки): tbOpen, zpTb, plBar, mkPanel, toast, rzUi, rzMenu, kIco, kIcoD, pickTool, rzPick, rzOk. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabTb) return;
  const api = window.MeasureLabTb = {version: 1};

  /* ═══ [BLOCK TB-SYM] значки Lab — в скрытый <svg> штатных символов; 32×32, полноцветные, палитра v81, без currentColor ═══ */
  const SYM = '<symbol id="t-sketch" viewBox="0 0 32 32"><rect x="3.5" y="3.5" width="19" height="25" rx="2" fill="#E8EBEF" stroke="#1F6FD1" stroke-width="2"/><path d="M7.5 9.5h11M7.5 13.5h8M7.5 17.5h5" stroke="#8B93A1" stroke-width="1.7" stroke-linecap="round"/><path d="M15.5 21.5l10-10 3.2 3.2-10 10z" fill="#F2C200" stroke="#1A2027" stroke-width=".8" stroke-linejoin="round"/><path d="M15.5 21.5l-1.6 4.8 4.8-1.6z" fill="#E8C9A0" stroke="#1A2027" stroke-width=".8" stroke-linejoin="round"/><path d="M25.5 11.5l3.2 3.2 1-1a1.6 1.6 0 0 0 0-2.3l-.9-.9a1.6 1.6 0 0 0-2.3 0z" fill="#E0442B"/></symbol>'
    + '<symbol id="t-obj" viewBox="0 0 32 32"><path d="M3 9a2.5 2.5 0 0 1 2.5-2.5h7l2.6 3h11.4A2.5 2.5 0 0 1 29 12v13a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 25z" fill="#F2B233"/><path d="M3 13h26" stroke="#C98A00" stroke-width="1.6"/><path d="M8 18h16M8 22.5h10" stroke="#7A5200" stroke-width="2" stroke-linecap="round"/></symbol>'
    + '<symbol id="t-export" viewBox="0 0 32 32"><path d="M7 3h12l6 6v20H7z" fill="#E8EBEF" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M19 3v6h6" fill="none" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 25V13" stroke="#2E9E4F" stroke-width="3" stroke-linecap="round"/><path d="M10.5 18L16 12.5l5.5 5.5" fill="none" stroke="#2E9E4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
    + '<symbol id="t-import" viewBox="0 0 32 32"><path d="M7 3h12l6 6v20H7z" fill="#E8EBEF" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M19 3v6h6" fill="none" stroke="#8B93A1" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 12v12" stroke="#1F6FD1" stroke-width="3" stroke-linecap="round"/><path d="M10.5 19L16 24.5l5.5-5.5" fill="none" stroke="#1F6FD1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></symbol>'
    + '<symbol id="t-close" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="5" fill="#E8EBEF" stroke="#8B93A1" stroke-width="1.6"/><path d="M11 11l10 10M21 11L11 21" stroke="#E0442B" stroke-width="3.4" stroke-linecap="round"/></symbol>';
  { const c = document.querySelector('svg symbol#t-cup'); if (c && !document.getElementById('t-sketch')) c.parentNode.insertAdjacentHTML('beforeend', SYM); }
  const svgU = id => `<svg viewBox="0 0 32 32" aria-hidden="true"><use href="#${id}"/></svg>`;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  /* ═══ [BLOCK TB-LAB] группа «Холст» в штатном листе футляра (tbOpen) и инструментов плана (zpTb).
     У плиток нет data-k / data-pk: штатные обработчики (pickTool, tbDrag, ★) к ним не относятся — это действия, а не инструменты ряда. ═══ */
  const SK = () => window.MeasureLabSketch;
  const TILES = [   // [команда, подпись, цвет рамки, значок, видна в «Скетче»]
    ['open', 'Скетч объекта: холст — фото, стены, план, заметки', '#1F6FD1', () => svgU('t-sketch'), 0],
    ['cam', 'Фото камерой на холст', '#1F6FD1', () => kIco('rfc'), 1],
    ['gal', 'Фото из галереи на холст', '#2E9E4F', () => svgU('t-image'), 1],
    ['note', 'Заметка на холсте', '#E8EBEF', () => kIcoD('txt'), 1],
    ['plan', 'План помещений объекта', '#1F9EA8', () => svgU('t-rooms'), 1],
    ['obj', 'Объект холста: открыть другой', '#F2B233', () => svgU('t-obj'), 1],
    ['exp', 'Перенос холста: сохранить JSON', '#2E9E4F', () => svgU('t-export'), 1],
    ['imp', 'Перенос холста: загрузить JSON', '#1F6FD1', () => svgU('t-import'), 1],
    ['close', 'Закрыть холст', '#E0442B', () => svgU('t-close'), 1]];
  function labTbExtend(kind) {
    const t = document.getElementById('tb'); if (!t || !t.classList.contains('on') || t.querySelector('[data-lab-g]')) return;
    const sk = SK(), on = !!(sk && sk.isOpen()), list = TILES.filter(x => !!x[4] === on);
    const h = document.createElement('h4'); h.textContent = 'Холст';
    const g = document.createElement('div'); g.className = 'g'; g.dataset.labG = 'sk';
    g.innerHTML = list.map(([a, ti, c, ic]) => `<div class="tl" data-lab-tb="${a}" style="--c:${c}" title="${esc(ti)}">${ic()}<span>${esc(ti)}</span></div>`).join('');
    const gg = t.querySelector('.gg7'), last = [...t.querySelectorAll(':scope>.g')].pop();
    if (kind === 'tb' && gg) gg.append(h, g); else if (last) last.after(h, g); else t.append(h, g);
    g.querySelectorAll('[data-lab-tb]').forEach(d => d.onclick = () => { d.classList.remove('on'); t.classList.remove('on'); const s = SK(); if (s && s.cmd) s.cmd(d.dataset.labTb); });
    if (kind === 'tb') rzRemap(t);
  }
  api.extend = labTbExtend;
  /* rz + футляр (проект 2d, допущение): коммуникации — инструментом режима (rzPick, как ряд rz); остальное — выход из rz и штатный pickTool */
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
    const b = document.getElementById('plb'); if (!b || b.querySelector('#labPlF')) return;
    b.insertAdjacentHTML('afterbegin', `<button id="labPlF" title="Футляр: инструменты плана">${svgU('t-cup')}</button><span class="sep" data-lab-plf></span>`);
    document.getElementById('labPlF').onclick = () => zpTb();
  }
  const pb0 = plBar; plBar = function () { const r = pb0.apply(this, arguments); try { labPlF(); } catch (e) { } return r; };
  labPlF();

  /* ═══ [BLOCK TB-NO-RULER] значок 📐 не выводится (v81 не меняется — замена после вывода) ═══ */
  const NO = '\u{1F4D0}', RZN = '«Коммуникации и размеры»';
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
    for (const e of [root, ...root.querySelectorAll('[title]')]) if (e.title && e.title.includes(NO)) e.title = e.title.split(NO).join(RZN).replace(/\s{2,}/g, ' ');
  }
  api.scrub = scrub;
  const noRuler = t => String(t).replace(new RegExp('«' + NO + '\\s*([^»]*)»', 'gu'), '«$1»').replace(new RegExp(NO + '\\s*', 'gu'), '«план» ').trim();
  api.noRuler = noRuler;
  const toast0 = toast; toast = function (t) { return toast0.call(this, noRuler(t)); };
  const mp0 = mkPanel; mkPanel = function () { const r = mp0.apply(this, arguments); try { scrub(document.getElementById('pp')); } catch (e) { } return r; };
  const ru0 = rzUi; rzUi = function () { const r = ru0.apply(this, arguments); try { scrub(document.getElementById('rzT'), RZN); } catch (e) { } return r; };
  if (typeof rzMenu === 'function') { const rm0 = rzMenu; rzMenu = function () { const r = rm0.apply(this, arguments); try { scrub(document.getElementById('rzM'), RZN); } catch (e) { } return r; }; }
  try { scrub(document.getElementById('pp')); scrub(document.getElementById('rzT'), RZN); } catch (e) { }
})();
