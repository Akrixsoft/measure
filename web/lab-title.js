/* Measure 82.17 — титул и список замеров.
   ═══ [BLOCK TITLE-VER] актуальная версия на титуле: список замеров («Measure v81» → «Measure 82.17»), настройки, значок версии.
   ═══ [BLOCK LIST-ROWS] объект + «✎ Скетч» в одной строке.
   ═══ [BLOCK LIST-NOPLANE] «＋ Плоскость» убрана (владелец 10.11.2026: любая плоскость — часть помещения); старые плоскости в списке открываются как прежде. */
(() => {
  'use strict';
  /* ═══ [BLOCK TITLE-VER] ═══ */
  let v = '82.17';
  try { const s = window.AkrixLab && AkrixLab.version && String(AkrixLab.version()); const m = s && s.match(/\d+\.\d+/); if (m) v = m[0]; } catch (e) { }
  const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  set('zVer', 'Measure ' + v); set('zVer2', 'Measure ' + v); set('zVerB', v);
  /* ═══ [BLOCK LIST-NOPLANE] ═══ */
  const b = document.getElementById('bNew'); if (b) b.hidden = true;
  const n = document.getElementById('nPl'); if (n) n.placeholder = 'Помещение (кухня, прихожая…)';
  const sl = document.getElementById('sl');   // пустой список — без упоминания плоскости
  const fixSl = () => { for (const d of sl ? sl.querySelectorAll('div') : []) if (d.childElementCount === 0 && d.textContent.includes('＋ Плоскость')) d.textContent = d.textContent.replace(/\s*\(или ＋ Плоскость[^)]*\)/, ''); };
  if (sl) { new MutationObserver(fixSl).observe(sl, {childList: true}); fixSl(); }
  /* ═══ [BLOCK LIST-ROWS] строки списка: «Объект + ✎ Скетч», «Помещение + ＋ Помещение» — без висящей кнопки ═══ */
  const nw = document.querySelector('#ss .nw'), ob = document.getElementById('nObj'), sk = nw && nw.querySelector('[data-sk-open]');
  if (nw && ob && sk) { ob.after(sk); const br = document.createElement('span'); br.className = 'lab-nw-br'; sk.after(br); ob.style.flex = '1 1 0'; ob.style.minWidth = '0'; if (n) { n.style.flex = '1 1 0'; n.style.minWidth = '0'; } br.style.cssText = 'flex-basis:100%;height:0'; }
  window.MeasureLabTitle = {version: v};
})();
