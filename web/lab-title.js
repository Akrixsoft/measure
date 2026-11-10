/* Measure — титул и список замеров.
   ═══ [BLOCK TITLE-VER] актуальная версия на титуле: список замеров («Measure v81» → «Measure 82.xx»), настройки, значок версии.
       AKX-2026-0014: показывается реально загруженная веб-версия — window.MeasureVersion из lab-version.js того же бандла
       (встроенного или скачанного; единственный источник номера). Запасной путь — AkrixLab.version() (натив: версия отданного бандла).
   ═══ [BLOCK LIST-ROWS] объект + «✎ Скетч» в одной строке.
   ═══ [BLOCK LIST-NOPLANE] «＋ Плоскость» убрана (владелец 10.11.2026: любая плоскость — часть помещения); старые плоскости в списке открываются как прежде. */
(() => {
  'use strict';
  /* ═══ [BLOCK TITLE-VER] ═══ */
  const full = s => { const m = s && String(s).match(/\d+(?:\.\d+)+/); return m ? m[0] : ''; };
  let v = full(window.MeasureVersion);
  if (!v) try { v = full(window.AkrixLab && AkrixLab.version && AkrixLab.version()); } catch (e) { }
  if (!v) v = '82';
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
