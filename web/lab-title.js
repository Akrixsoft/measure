/* Measure — титул.
   ═══ [BLOCK TITLE-VER] актуальная версия на титуле: «Measure 82.xx» — бренд, настройки, значок версии, меню окна «Проекты».
       AKX-2026-0014: показывается реально загруженная веб-версия — window.MeasureVersion из lab-version.js того же бандла
       (встроенного или скачанного; единственный источник номера). Запасной путь — AkrixLab.version() (натив: версия отданного бандла).
   82.18 (AKX-2026-0012): блоки LIST-ROWS и LIST-NOPLANE убраны — штатный список #ss скрыт, стартовое окно — «Проекты» (lab-projects.js). */
(() => {
  'use strict';
  /* ═══ [BLOCK TITLE-VER] ═══ */
  const full = s => { const m = s && String(s).match(/\d+(?:\.\d+)+/); return m ? m[0] : ''; };
  let v = full(window.MeasureVersion);
  if (!v) try { v = full(window.AkrixLab && AkrixLab.version && AkrixLab.version()); } catch (e) { }
  if (!v) v = '82';
  const set = (id, t) => { const e = document.getElementById(id); if (e) e.textContent = t; };
  set('zVer', 'Measure ' + v); set('zVer2', 'Measure ' + v); set('zVerB', v);
  window.MeasureLabTitle = {version: v};
})();
