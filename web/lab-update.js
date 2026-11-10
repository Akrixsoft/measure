/* Measure — автообновление: веб-часть и APK (AKX-2026-0014). Нативная часть: android/.../Updater.java, мост AkrixUpdate (MainActivity [BLOCK UPD-BRIDGE]).
   ═══ [BLOCK UPD-READY] сигнал готовности: страница загрузила скрипты и открыла IndexedDB (DB.db) → AkrixUpdate.ready(MeasureVersion).
       Нет сигнала за Updater.READY_TIMEOUT_MS — новая веб-версия помечается сбойной, при следующем запуске — предыдущая/встроенная.
       После ready натив сам в фоне проверяет version.json (офлайн — молча).
   ═══ [BLOCK UPD-MENU] «⟳ Проверить обновления» в штатном меню ⋮ (#zMenu): ручная проверка — результат всегда в тосте.
   ═══ [BLOCK UPD-EVENTS] window.akrixUpdateEvent(json) — события натива: checking / offline / error / none / busy /
       web-downloading / web-ready / web-needs-apk / web-failed / apk-available / apk-progress / apk-ready / apk-failed / apk-denied.
       Фоновая (не ручная) проверка показывает только находки: web-ready и apk-available.
   ═══ [BLOCK UPD-TOAST] тост с кнопкой (#labUpd): «Перезапустить» (веб) / «Обновить» (APK). Перед перезапуском — сохранение (PM.flushAll, PM.saveNow).
   Без моста (браузер, тесты) — кнопка сообщает, что обновление работает только в приложении. */
(() => {
  'use strict';
  const native = () => window.AkrixUpdate && typeof AkrixUpdate.check === 'function' ? AkrixUpdate : null;
  const say = t => { if (typeof window.toast === 'function') window.toast(t); };
  const ver = () => String(window.MeasureVersion || '');

  /* ═══ [BLOCK UPD-TOAST] ═══ */
  let box = null, hideT = 0;
  function card(text, action, label, sticky) {
    if (!box) {
      box = document.createElement('div'); box.id = 'labUpd'; box.setAttribute('role', 'status');
      box.innerHTML = '<span class="lab-upd-t"></span><button type="button" class="lab-upd-a"></button><button type="button" class="lab-upd-x" aria-label="Закрыть">✕</button>';
      box.querySelector('.lab-upd-x').onclick = () => hide();
      document.body.appendChild(box);
    }
    clearTimeout(hideT);
    box.querySelector('.lab-upd-t').textContent = text;
    const a = box.querySelector('.lab-upd-a');
    a.hidden = !action; a.textContent = label || ''; a.onclick = action ? () => { hide(); action(); } : null;
    box.classList.add('on');
    if (!sticky) hideT = setTimeout(hide, 6000);
  }
  function hide() { clearTimeout(hideT); if (box) box.classList.remove('on'); }

  async function saveAll() {
    const a = document.activeElement;
    if (a && a.matches && a.matches('input,textarea,select')) { a.blur(); await new Promise(r => setTimeout(r, 0)); }
    if (window.PM && PM.flushAll) await PM.flushAll();
    if (window.PM && PM.saveNow) await PM.saveNow();
  }
  async function restart() {
    const n = native(); if (!n) return;
    try { await saveAll(); } catch (e) { say('Не сохранено: ' + (e && e.message || e) + ' — перезапуск отменён'); return; }
    n.restart();
  }
  function installApk() { const n = native(); if (n) { say('Загрузка обновления…'); n.downloadApk(); } }
  const mb = b => b > 0 ? ' (' + (b / 1048576).toFixed(1) + ' МБ)' : '';

  /* ═══ [BLOCK UPD-EVENTS] ═══ */
  window.akrixUpdateEvent = raw => {
    let e; try { e = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (x) { return; }
    if (!e || typeof e.type !== 'string') return;
    const m = !!e.manual;
    switch (e.type) {
      case 'checking': if (m) say('Проверка обновлений…'); break;
      case 'busy': if (m) say('Обновление уже проверяется'); break;
      case 'offline': if (m) say('Нет связи с GitHub — работает текущая версия ' + ver()); break;
      case 'error': if (m) say('Обновление не проверено: ' + (e.reason || 'ошибка')); break;
      case 'none': if (m) say('Установлена последняя версия ' + (e.version || ver())); break;
      case 'web-downloading': if (m) say('Загрузка версии ' + e.version + '…'); break;
      case 'web-ready': card('Загружена версия ' + e.version + ' — применится при следующем запуске', restart, 'Перезапустить', true); break;
      case 'web-needs-apk': if (m) say('Версия ' + e.version + ' требует обновить приложение'); break;
      case 'web-failed': if (m) say('Обновление не загружено — работает текущая версия'); break;
      case 'apk-available': card('Доступно приложение Measure ' + e.versionName + mb(e.size), installApk, 'Обновить', true); break;
      case 'apk-progress': card('Загрузка приложения: ' + e.pct + '%', null, '', true); break;
      case 'apk-ready': card('Проверено — открывается установщик Android', null, '', false); break;
      case 'apk-failed': card('Приложение не загружено: ' + (e.reason || 'ошибка'), null, '', false); break;
      case 'apk-denied': card('Установка не разрешена. Настройки → Приложения → Measure → «Установка неизвестных приложений»', installApk, 'Повторить', true); break;
    }
  };

  /* ═══ [BLOCK UPD-MENU] ═══ */
  const menu = document.getElementById('zMenu');
  if (menu && !document.getElementById('bLabUpd')) {
    const b = document.createElement('button'); b.id = 'bLabUpd'; b.type = 'button'; b.textContent = '⟳ Проверить обновления';
    b.title = 'Новая версия с GitHub: веб-часть — без переустановки, приложение — через установщик Android';
    b.onclick = () => { menu.classList.remove('on'); const n = native(); if (n) n.check(); else say('Обновление работает только в приложении Measure для Android'); };
    menu.appendChild(b);
  }

  /* ═══ [BLOCK UPD-READY] ═══ */
  let tries = 0;
  (function ready() {
    const n = window.AkrixUpdate;
    if (!n || typeof n.ready !== 'function') return;
    if (typeof DB !== 'undefined' && DB && DB.db) { n.ready(ver()); return; }   // global DB (inline v81)
    if (++tries < 150) setTimeout(ready, 100);   // ≤15 с; дальше молчим — натив откатит
  })();
  window.MeasureLabUpdate = {ver, saveAll, card, hide};
})();
