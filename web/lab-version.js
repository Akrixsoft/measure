/* Measure — ЕДИНСТВЕННЫЙ источник версии (AKX-2026-0014).
   ═══ [BLOCK VERSION] MeasureVersion — версия веб-части и APK: build.gradle (versionName, versionCode = major*1000+minor),
       scripts/build_apk.py (имя measure-<версия>.apk), scripts/web_bundle.py (манифест version.json), титул (lab-title.js).
       Формат: 82.18 или 82.18.1 (третья цифра — только веб-обновление, versionCode тот же).
   ═══ [BLOCK MIN-APK] MeasureMinApk — минимальный versionCode APK, нативный мост которого (AkrixUpdate v1, AkrixBT, AkrixApp, AkrixLab)
       подходит этой веб-части. Повышать только при изменении нативного моста; веб-обновление не ставится на более старый APK. */
window.MeasureVersion = '82.23';
window.MeasureMinApk = 82018;
/* ═══ [BLOCK BOOT-ERR] 82.18 (аудит m6): исключения web/lab-*.js при старте — первым скриптом Lab, чтобы lab-update.js не отправил ready
       (натив откатит бандл). Только запись первой ошибки; поведение страницы не меняется. */
window.MeasureLabBootErr = null;
(() => { const on = e => { const f = String((e && (e.filename || (e.reason && e.reason.stack))) || ''); if (!window.MeasureLabBootErr && /\/lab-[\w-]+\.js/.test(f)) window.MeasureLabBootErr = f; };
  addEventListener('error', on); addEventListener('unhandledrejection', on); window.MeasureLabBootErrOff = () => { removeEventListener('error', on); removeEventListener('unhandledrejection', on); }; })();
