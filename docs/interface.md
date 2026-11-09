# Measure Lab: интерфейс и настройки

База: неизменённая копия Measure v81, отдельно от production и оригинальной страницы в APK.

## Реализовано

- `web/lab-ui.css`: квадратные кнопки номеров стен 28×28 px с горизонтальной прокруткой. Число стен не уменьшает кнопки и шрифт. Собственная строка инструментов `#ch` занимает ширину `#zb`; `#zopt` вынесен над ней вправо. Брендинг и родные инструменты v81 сохранены.
- `web/lab-ui.js`: реальный диалог настроек вместо прежнего маленького всплывающего блока. Предыдущие настройки фото, Bosch GLM, AI, дисторсии и прочие элементы `#set` сохраняют DOM и обработчики и доступны в раскрывающемся разделе.
- Настройки: текст 6–28 px, поля 10–64 px, линии 0,5–8 px, наконечники 4–20 px, точки 2–12 px, элементы боковых стен, сетка геометрии 3×3 в плоском виде, привязки, сохранение активного инструмента. У размеров есть диапазон и числовой ввод. Живой пример, отдельное сохранение `measure.lab.settings` и сброс новых параметров.
- Основной canvas `#cv` получает собственный аксессор `font`: отрисовка и `measureText` используют один настроенный экранный размер, а не меняются независимо. DOM-поля `#w3f`/`#dmIn` используют соответствующие CSS-переменные. `scripts/ui-patch.py` задаёт поля 3D в геометрии размещения и зонах касания с учётом настроенной высоты и текста; поле не ниже текста + 2 px, чтобы текст не обрезался.
- Собственная панель помещений/групп стен в `⋮`. Создание, открытие и переименование не требуют замыкания контура. Новая группа предлагает родной инструмент стен. Сохранение и экспорт остаются штатными; модуль экспорта отдельно обрабатывает одиночные плоскости.
- Кнопка `⇄ Выбрать версию приложения` вызывает сохранение, затем `AkrixLab.chooseVersion()`. При открытии вне APK показывает объяснение.
- Повторяемые инструменты сохраняются после завершения команд, ранее переключавших план в выбор. Выключенная настройка сбрасывает инструмент после фактического создания объекта, не после первого незавершённого касания.

## Контракт с другими модулями

`window.MeasureLabSettings.current`: `textPx`, `fieldPx`, `linePx`, `arrowPx`, `pointPx`, `sideElements`, `persistTool`, `grid`, `snap`. Изменения вызывают событие `measure-lab-settings` с актуальным объектом в `detail`. Geometry-модуль использует те же настройки. Его ответственность: наконечники, размеры, точки и содержимое боковых граней.

`window.MeasureLabUI`: `settings()`, `rooms()`, `close()`, `apply()`, `versionChooser()`, `layout()`.

Проверяемые селекторы: `#bSet`, `#labModal [data-lab-setting=textPx]`, `#labModal [data-lab-setting=fieldPx]` (range и number); `#bLabRooms`, `#labNewRoom`, `[data-lab=create-room]`, `[data-lab-room-rename]`, `#labRename`, `[data-lab=rename-save]`; `#bLabVersions`; `#wrowC button`; `#ch`; `#zopt`.

## Ограничения и проверка

Текст основного холста настраивается совместно, без отдельных размеров каждого вида подписи. Размер полей является минимумом: текст большего размера увеличивает поле, чтобы оставаться читаемым. Сетка в настройках — существующий сетка геометрии 3×3 в плоском виде, а не новая миллиметровая подложка.

Создание второго помещения при пустом имени объекта назначает объекту автоматическое имя для штатной группировки v81; имя самого помещения может остаться пустым. Это не меняет замкнутость и не добавляет стены.

Статически выполнены `node --check web/lab-ui.js` и проверка точного единственного совпадения base-патча. Независимые интеграционные браузерные проверки выполняет QA после объединения модулей главным агентом.

### 0.7: размеры коммуникаций

`lab-comms-ui.js/css` загружаются последними. В режиме 📐 верхний ряд содержит все доступные точечные коммуникации из `KINDS`, нижний — выбор, единую стрелку по направлению жеста, лупу, прокручиваемую палитру и родные отмену / повтор / удаление. Старый инструмент `vert` мигрирует в `arr`; геометрия жестов остаётся родной. Переключение номера поста выбранной стрелки сохраняется.

Порядок коммуникаций: удержание 420 мс и перенос на другую кнопку. Короткое горизонтальное движение до удержания прокручивает ряд. Порядок хранится в `measure.lab.rz.order`; исходный набор v81 используется при первой миграции. Палитра меняет выбранную стрелку с записью в историю, а также цвет следующих стрелок (`measure.lab.rz.color`). `comms-patch.py` добавляет цвет в `rz.c` при JSON-выгрузке и восстанавливает в `q.c` при импорте; старые файлы сохраняют синий цвет. Цвет используется линией, наконечником, полем и ручками выделения. Размещение коммуникации не добавляет стрелку и не открывает поле автоматически.

API тестирования: `MeasureLabComms.order`, `.color`, `.chooseColor(hex)`, `.refresh()`. Селекторы: `#ch [data-lab-rz-comm]`, `#labRzBottom [data-lab-rz-tool]`, `#labRzPalette [data-lab-rz-color]`, родной `#rzPo`. Стили ограничены `body.rz`, обычный набор инструментов не меняется.

### 0.8: полный набор коммуникаций

В строку режима добавлены оба недостающих штатных инструмента из группы v81 «Коммуникации»: `znd` («не сверлить») и `wrt` (трасса). Теперь доступны 12 кнопок: десять точечных коммуникаций, прямоугольная запретная зона и трасса из нескольких точек. Иконки и построение остаются штатными: зона хранится как прямоугольный объект `S.els`, трасса — как полилиния `S.rts`; точечными объектами они не становятся. Касание последней точки завершает трассу; родная панель позволяет задать её вид и диаметр.

Миграция сохраняет относительный порядок прежних десяти кнопок и добавляет недостающие инструменты в конец. Оба новых инструмента участвуют в том же удержании и переносе, сохраняются в `measure.lab.rz.order` и восстанавливаются модулем после штатной фильтрации набора v81. Выбор коммуникации снимает прежнее выделение стрелки режима, чтобы оно не скрывало родную панель зоны или трассы. Размещение не создаёт автоматических стрелок. Новая иконка режима не назначается до выбора пользователем.

Проверки: `node --check web/lab-comms-ui.js`; независимая QA проверяет реальные жесты зоны и трассы, миграцию порядка, JSON-выгрузку и повторное открытие. `MeasureLabComms.version` — 8; селекторы новых кнопок: `[data-lab-rz-comm=znd]`, `[data-lab-rz-comm=wrt]`.

## 0.9 — generic zone in communications

Native `zon` is now part of the communications group and the mode row, in addition to the former twelve entries. A guarded patch moves the sole toolkit entry from the geometry group. Saved tool order is retained with `zon` appended once. The existing native rectangle model and selected-object workflow are reused; this does not convert the zone into a point or create automatic dimensions.

### 0.10: ползунок Aa

`MeasureLabAppearance` задаёт единый масштаб подписей стены из `W3.f` (30–160%). Текст: `max(6, textPx × Aa)`; высота и минимальная ширина поля: `max(10, fieldPx × Aa, текст + 2)`. Размер применяется один раз, включая родные подписи, которые уже запрашивают шрифт с `W3.f`. План использует масштаб 1.

Толщина ручных размеров, обычных стрелок и стрелок коммуникаций меняется пропорционально Aa; настройки толщины и наконечника остаются отдельными множителями. Значки коммуникаций всегда используют родные 22 CSS px независимо от Aa; упаковка постов, привязки, координаты и значения в мм не меняются. `appearance-patch.py` выполняется после остальных патчей исходника и изменяет только эти точки отрисовки. Координатный `rzD`, физические линии объектов, инструменты фото и нативная клавиатура не менялись.

## 0.10 — Aa annotations independent of communication glyphs

`MeasureLabAppearance` computes one wall-only Aa factor from native `W3.f`, effective text (minimum 6 CSS px), field height (minimum 10 CSS px and text+2), and the line preference factor. Canvas font assignment applies that factor once; native `w3IcZ` is fixed at 22 CSS px. Packed post paint, snapping and endpoint projection therefore share a layout that does not change with Aa. `appearance-patch.py` must run after UI, geometry, labels and communications patches; it scales only dimension/arrow strokes and fields, leaving physical outlines and pointer coordinate conversion alone. Arrowheads remove the Aa factor before native length clamping and apply it afterwards so small Aa values still change the visible head. The native 15 px inline editor and keypad are preserved.

## 0.11 — route type/modifier controls and real floor tools

`lab-route-catalog.js` extends native route type arrays without replacing legacy keys, exposes typed patterns/colors/codes, and accepts both boolean/numeric dash flags. `lab-route-ui.js/css` renders the selected/default type on the left of the modifier row with L/P/dash/snap to its right, plus real-plan route/dimension actions using the same native route symbol. Wall/floor records retain their native route containers. The legend preview under `previews/route-legend` is an application convention, not a standards claim. Route defaults use separate composable preference wrappers because native `PREF` only restores a subset of fields.
