/* Measure 82.14 — значок режима «Коммуникации и размеры»: вариант 2 «точка + два направления» (выбор владельца 10.11.2026)
   вместо угольника 📐. Кнопка v81 #mdT [data-rz] создаётся один раз при загрузке; меняется только её содержимое. */
(() => {
  'use strict';
  /* ═══ [BLOCK ICON-RZ] ═══ */
  const SVG = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="13" r="4"/><circle cx="18" cy="13" r="1" fill="currentColor" stroke="none"/><path d="M4 5v18m0-18-2 3m2-3 2 3M4 23l-2-3m2 3 2-3M12 27h16m-16 0 3-2m-3 2 3 2m13-2-3-2m3 2-3 2M9 13h4m5 6v3"/></svg>';
  const b = document.querySelector('#mdT [data-rz]');
  if (b && !b.dataset.labIcon) { b.innerHTML = SVG; b.dataset.labIcon = 'rz2'; }
  window.MeasureLabIcons = {rz: SVG};
})();
