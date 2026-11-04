# Measure (бывш. «Замер Akrix»)

Приложение замера помещений для Akrix: план, стены, фото, лазерная рулетка Bosch GLM, выгрузка в конструктор Akrix.

- Сайт (PWA): https://akrixsoft.github.io/measure/ — `index.html`, `sw.js`, `manifest.webmanifest`, иконки, лист маркеров.
- APK: `apk/measure.apk` (собирает `.github/workflows/measure-apk.yml` при изменениях в `android/`), версия — `apk/version.json`.
- `android/` — оболочка WebView + Bluetooth GLM (applicationId `ge.akrix.measure`).
- `logo/` — логотип, `design/` — утверждённый макет интерфейса (https://claude.ai/artifact/JAxzAH9cPPVw79V4nj6JWo).

Исходники страницы, тесты, история версий и записки — akrix-soft/measure (eNN.py → build.py → pub_measure.py).
