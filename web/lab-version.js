/* Measure — ЕДИНСТВЕННЫЙ источник версии (AKX-2026-0014).
   ═══ [BLOCK VERSION] MeasureVersion — версия веб-части и APK: build.gradle (versionName, versionCode = major*1000+minor),
       scripts/build_apk.py (имя measure-<версия>.apk), scripts/web_bundle.py (манифест version.json), титул (lab-title.js).
       Формат: 82.18 или 82.18.1 (третья цифра — только веб-обновление, versionCode тот же).
   ═══ [BLOCK MIN-APK] MeasureMinApk — минимальный versionCode APK, нативный мост которого (AkrixUpdate v1, AkrixBT, AkrixApp, AkrixLab)
       подходит этой веб-части. Повышать только при изменении нативного моста; веб-обновление не ставится на более старый APK. */
window.MeasureVersion = '82.17';
window.MeasureMinApk = 82017;
