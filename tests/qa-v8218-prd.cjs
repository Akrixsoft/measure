/* AKX-2026-0013 — мебельные конструкции (изделия) на плане: lab-prd.js.
   Сценарий через интерфейс: зоны-комнаты (панель «Зоны»), «Изделия» → конструкции в двух комнатах, стены пером, пальцем
   и касанием подписи С№, общая стена в двух конструкциях, тип из списка (имя = тип, «Шкаф 2»), 🗑 + ↶, перезапуск, выгрузка
   ⋮ → ⇪ → «Объект» (o.prd по З7), ♻ импорт обратно, импорт в конструктор v898 (штатный путь, imp.cjs).
   Фикстура — только исходный контур помещения (как в qa-v8218-zones). Запуск:
   NODE_PATH=/opt/npm-tools/node_modules QA_VH=797 QA_DPR=3 node tests/qa-v8218-prd.cjs
   QA_EXPORT=<файл> — куда положить выгрузку (по умолчанию $QA_SHOTS/z7-example-82.18-app.json). */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const {start} = require('./qa-v011-harness.cjs');
const SHOTS = process.env.QA_SHOTS || '/tmp/qa-v8218-prd';
const EXPORT = process.env.QA_EXPORT || SHOTS + '/z7-example-82.18-app.json';
const AKRIX = process.env.QA_AKRIX || '/home/claude/akrix-soft/Akrix/akrix-furniture.html';
const IMP = path.join(__dirname, 'akrix-imp-v898.cjs');

(async () => {
  fs.mkdirSync(SHOTS, {recursive: true});
  const h = await start();
  const {p, check} = h;
  const z = name => p.locator('[data-lab12="' + name + '"]');
  const d = (name, extra = '') => p.locator('[data-labprd="' + name + '"]' + extra);
  /* 82.18 (integration): вход плитками футляра плана (🖍 #labPlF → [data-lab-tb=zone|prd]); строки «Зоны»/«Изделия» в закрытом виде нет */
  const tile = async k => { await p.locator('#labPlF').tap(); await p.waitForTimeout(150); await p.locator('#tb [data-lab-tb="' + k + '"]').tap(); await p.waitForTimeout(150); };
  const press = async loc => { await loc.first().tap(); await p.waitForTimeout(80); };
  async function tap(type, w) { const a = await h.xy(w); await h.down(type, a); await h.up(type, a); await p.waitForTimeout(50); }
  const pen = w => tap('pen', w), finger = w => tap('touch', w);
  const shot = name => p.screenshot({path: SHOTS + '/' + name + '.png'});
  const st = () => p.evaluate(() => ({
    prd: MeasureLabPrd.list().map(q => ({id: q.id, no: q.no, type: q.type, n: q.n, room: q.room || null, w: q.w.map(x => x.wid)})),
    label: MeasureLabPrd.list().map(MeasureLabPrd.label), open: MeasureLabPrd.isOpen(),
    items: [...document.querySelectorAll('#labprd-plan [data-labprd="item"]')].map(b => b.textContent + (b.classList.contains('on') ? ' *' : '')),
    rooms: [...document.querySelectorAll('#labprd-plan [data-labprd="room"]')].map(b => b.textContent + (b.classList.contains('on') ? ' *' : '')),
    toast: document.getElementById('toast').textContent, wid: {...(S.room.wid || {})},
    zones: MeasureLab012.regions().map(({q}) => ({id: q.id, name: q.name, walls: q.walls.length}))
  }));
  const W = k => p.evaluate(k => S.room.wid[k], k);
  const errorsAt = () => h.errors.length;
  const result = {};
  try {
    /* ── 0. помещение 4000 × 3000 и две комнаты-зоны через панель «Зоны» (lab-v012) ── */
    await p.evaluate(async () => {
      await PM.newRoom('QA 8218 Изделия', 'Квартира');
      Object.assign(S.room.ms, {pts: [[0, 0], [4000, 0], [4000, 3000], [0, 3000]], closed: true, H: 2700,
        dims: [4000, 3000, 4000, 3000].map((v, i) => ({id: 'ql' + i, a: {p: i}, b: {p: (i + 1) % 4}, v}))});
      gnFix(); PEN.mode = 'auto'; PEN.seen = false; WS.mag = 1; document.body.classList.remove('tz'); fit(); draw();
    });
    await tile('zone');
    await press(z('divider')); await pen([0, 1800]); await pen([4000, 1800]);
    await press(z('fill')); await pen([2000, 900]);
    await press(z('fill')); await pen([2000, 2400]);
    const field = p.getByRole('textbox', {name: 'Имя зоны', exact: true});
    await pen([2000, 900]); await field.fill('Кухня'); await field.press('Enter');
    await press(z('assign')); await finger([2000, 0]); await finger([4000, 900]); await press(z('assigned'));
    await pen([2000, 2400]); await field.fill('Прихожая'); await field.press('Enter');
    await press(z('assign')); await finger([4000, 2400]); await finger([2000, 3000]); await finger([0, 2400]); await press(z('assigned'));
    let s = await st();
    check(s.zones.length === 2 && s.zones[0].name === 'Кухня' && s.zones[1].name === 'Прихожая' && s.zones[0].walls === 2 && s.zones[1].walls === 3,
      'Подготовка: две комнаты-зоны, стены назначены', s.zones);

    /* ── 1. вход: плитка «Изделие» футляра плана (временная кнопка в панели зон убрана) ── */
    check(await d('open').count() === 0, 'Вход: временной кнопки «Изделия» в панели зон нет');
    await tile('prd');
    s = await st();
    const vis = await p.evaluate(() => ({zones: getComputedStyle(document.getElementById('lab12-plan')).display, prd: !document.getElementById('labprd-plan').hidden,
      r: document.getElementById('labprd-plan').getBoundingClientRect().toJSON(), zf: document.getElementById('zf').getBoundingClientRect().top, zb: document.getElementById('zb').getBoundingClientRect().top, inZf: document.getElementById('labprd-plan').parentElement.id === 'zf', vh: innerHeight}));
    check(s.open && vis.prd && vis.zones === 'none' && s.rooms[0] === 'Кухня *' && s.rooms.length === 2,
      'Панель «Изделия» вместо панели зон; выбрана первая комната', {rooms: s.rooms, vis});
    check(vis.r.bottom <= (vis.inZf ? vis.zb : vis.zf) + 1 && vis.r.top > vis.vh / 2, 'Панель внизу над полосой инструментов (82.18: строка стека #zf над рядом #zb)', vis);

    /* ── 2. Кухня: тип «Кухня» — С1 пером, С2 касанием подписи С№ (пером) ── */
    const addType = async t => { await press(d('add')); await press(d('type', '[data-type="' + t + '"]')); };
    await press(d('add'));
    const types = await p.evaluate(() => [...document.querySelectorAll('#labprd-plan [data-labprd="type"]')].map(b => b.dataset.type));
    check(JSON.stringify(types) === JSON.stringify(['Кухня', 'Шкаф', 'Гардероб', 'Прихожая', 'ТВ-зона', 'Стеллаж', 'Санузел', 'Другое']) && await p.locator('#labprd-plan input').count() === 0,
      '＋: выбор типа из списка, свободного имени нет', types);
    await press(d('type', '[data-type="Кухня"]'));
    s = await st();
    check(s.prd.length === 1 && s.prd[0].no === 1 && s.prd[0].type === 'Кухня' && s.prd[0].room === s.zones[0].id && s.items[0].startsWith('Кухня · Кухня') && s.items[0].endsWith('*'),
      'Новая конструкция в текущей комнате: тип «Кухня», no = 1, выбрана', s);
    await pen([3600, 0]);
    const lab = await p.evaluate(k => { const L = (S.plLabs || []).find(r => r[3] === k), c = cv.getBoundingClientRect(); return L && [L[0] / devicePixelRatio + c.left, L[1] / devicePixelRatio + c.top]; }, 1);
    await h.down('pen', lab); await h.up('pen', lab); await p.waitForTimeout(60);
    s = await st();
    check(JSON.stringify(s.prd[0].w) === JSON.stringify([await W(0), await W(1)]), 'Стены: С1 пером по отрезку, С2 пером по подписи С№', s.prd[0].w);
    await shot('1-kitchen-set');

    /* ── 3. Кухня: «Другое» → тип «Шкаф» штатным выбором; С2 пальцем (перо обнаружено → zTapSel) ── */
    check(await p.evaluate(() => PEN.on()), 'Перо обнаружено (правило v81: палец — выбор)');
    await addType('Другое');
    await p.locator('#labprd-plan select[data-labprd="type-sel"]').selectOption('Шкаф'); await p.waitForTimeout(80);
    await finger([4000, 900]);
    s = await st();
    const w2 = await W(1);
    check(s.prd[1].type === 'Шкаф' && s.prd[1].n === 'Шкаф' && s.prd[1].no === 2 && JSON.stringify(s.prd[1].w) === JSON.stringify([w2]) && s.items[1].startsWith('Кухня · Шкаф'),
      'Смена типа выбором из списка: «Кухня · Шкаф»; С2 пальцем', {prd: s.prd[1], items: s.items});
    check(s.prd[0].w.includes(w2) && s.prd[1].w[0] === w2, 'Общая стена С2 — в двух конструкциях', s.prd.map(q => q.w));
    await shot('2-kitchen-shared');
    /* снять и вернуть стену касанием пальца */
    await finger([3600, 0]); s = await st(); const on1 = s.prd[1].w.length === 2;
    await finger([3600, 0]); s = await st();
    check(on1 && s.prd[1].w.length === 1, 'Повторное касание стены снимает её из конструкции', s.prd[1].w);

    /* ── 4. Прихожая: «Шкаф» — С3 пером, С4 пальцем ── */
    await press(d('room', '[data-room="' + s.zones[1].id + '"]'));
    s = await st();
    check(s.rooms[1] === 'Прихожая *' && s.items.length === 0, 'Выбор комнаты: список конструкций комнаты (пусто)', s);
    await addType('Шкаф'); await pen([3600, 3000]); await finger([0, 2400]);
    s = await st();
    check(s.prd[2].room === s.zones[1].id && s.prd[2].no === 3 && s.prd[2].n === 'Шкаф' && JSON.stringify(s.prd[2].w) === JSON.stringify([await W(2), await W(3)]) && s.items[0].startsWith('Прихожая · Шкаф'),
      'Прихожая · Шкаф: С3 пером, С4 пальцем, no = 3 (тип «Шкаф» в другой комнате — без номера)', s.prd[2]);
    await shot('3-hall');

    /* ── 5. второй «Шкаф» в комнате — «Шкаф 2»; 🗑 + ↶; no не переиспользуется ── */
    await addType('Шкаф');
    s = await st(); const extra = s.prd[3];
    const dis = await p.evaluate(() => document.getElementById('bDelS').classList.contains('dis'));
    check(extra.no === 4 && extra.n === 'Шкаф 2' && s.items[1].startsWith('Прихожая · Шкаф 2') && !dis, 'Второй тип «Шкаф» в комнате — «Шкаф 2»; 🗑 активна', {extra, items: s.items, dis});
    await shot('3b-two-types');
    await p.locator('#bDelS').tap(); await p.waitForTimeout(120);
    s = await st();
    check(s.prd.length === 3 && /удалена/.test(s.toast), '🗑 удаляет выбранную конструкцию', {n: s.prd.length, toast: s.toast});
    await p.locator('#zur button').first().tap(); await p.waitForTimeout(250);
    s = await st();
    check(s.prd.length === 4 && s.prd[3].id === extra.id && s.open, '↶ возвращает удалённую конструкцию', {prd: s.prd.map(q => q.n), open: s.open});
    await press(d('item', '[data-id="' + extra.id + '"]'));
    await p.locator('#bDelS').tap(); await p.waitForTimeout(120);
    await addType('Стеллаж');
    s = await st();
    check(s.prd.length === 4 && s.prd[3].no === 5, 'Номер удалённой конструкции не переиспользуется (новая — 5)', s.prd.map(q => q.no));
    await p.locator('#bDelS').tap(); await p.waitForTimeout(120);
    s = await st();
    check(s.prd.length === 3, 'Пустая лишняя конструкция удалена', s.prd.map(q => q.n));
    check(errorsAt() === 0, 'Нет ошибок страницы до перезапуска', h.errors);

    /* ── 6. перезапуск: данные из базы ── */
    const before = s.prd, rid = await p.evaluate(async () => { await PM.flushAll(); await new Promise(r => setTimeout(r, 400)); return S.room.id; });
    await p.reload(); await p.waitForFunction(() => window.MeasureLabComms && window.MeasureLabPrd);
    await p.evaluate(async rid => { await PM.openRoom(rid); fit(); draw(); }, rid);
    await p.waitForTimeout(200);
    s = await st();
    check(JSON.stringify(s.prd) === JSON.stringify(before), 'Перезапуск: конструкции, стены, участки, номера сохранены', {before, after: s.prd});
    const opened = await p.evaluate(() => { MeasureLab012.open('pick'); MeasureLab012.close(); return MeasureLabPrd.open(); });
    await p.evaluate(() => MeasureLabPrd.room(MeasureLab012.regions()[0].q.id));
    await press(d('item'));
    await p.waitForTimeout(100);
    await shot('4-after-restart');
    s = await st();
    check(opened && s.items.length === 2 && s.items[0].startsWith('Кухня · Кухня') && s.items[0].endsWith('*'), 'После перезапуска: API open, список комнаты, подсветка выбранной', s.items);
    /* другой инструмент закрывает панель (как «Зоны» Д12) */
    await p.locator('#ch [data-pk="st"]').first().tap(); await p.waitForTimeout(100);
    check(!(await p.evaluate(() => MeasureLabPrd.isOpen())), 'Другой инструмент закрывает панель «Изделия»');
    await p.locator('#ch [data-pk="sel"]').first().tap().catch(() => {}); await p.waitForTimeout(80);

    /* ── 7. выгрузка через интерфейс: ⋮ → ⇪ → «Объект» (путь APK: AkrixApp.save) ── */
    await p.evaluate(() => { window.AkrixApp = {save: (fn, type, txt) => { window.__saved = {fn, txt}; }}; });
    await press(p.locator('#bMore')); await press(p.locator('#bExp')); await press(p.locator('[data-zx="o"]'));
    await p.waitForFunction(() => window.__saved, null, {timeout: 15000});
    const saved = await p.evaluate(() => window.__saved);
    const ex = JSON.parse(saved.txt);
    fs.mkdirSync(path.dirname(EXPORT), {recursive: true}); fs.writeFileSync(EXPORT, saved.txt);
    const wid = Object.values(ex.rooms[0].ms.wid), zid = (ex.rooms[0].ms.labRooms || []).map(q => q.id);
    const keysOk = (ex.prd || []).every(q => Object.keys(q).every(k => ['id', 'no', 'type', 'name', 'room', 'walls', 'note'].includes(k))
      && typeof q.id === 'string' && Number.isInteger(q.no) && typeof q.type === 'string' && typeof q.name === 'string' && Array.isArray(q.walls) && q.walls.every(w => wid.includes(w)) && (!q.room || zid.includes(q.room)));
    check(ex.app === 'akrix-zamer' && ex.v === 3 && ex.kind === 'object' && Array.isArray(ex.prd) && ex.prd.length === 3 && keysOk,
      'Выгрузка: o.prd[] = {id, no, type, name, room?, walls, note?} (З7 + решение владельца), span нет, v3', ex.prd);
    const exp = ex.prd.map(q => [q.no, q.type, q.name, zid.indexOf(q.room), q.walls.map(w => wid.indexOf(w))]);
    check(JSON.stringify(exp) === JSON.stringify([[1, 'Кухня', 'Кухня', 0, [0, 1]], [2, 'Шкаф', 'Шкаф', 0, [1]], [3, 'Шкаф', 'Шкаф', 1, [2, 3]]]) && ex.prd.every(q => !('span' in q)),
      'Выгрузка: 2 комнаты, 3 конструкции, С2 в двух конструкциях, без span', exp);
    /* сверка с ручным примером З7 */
    const man = JSON.parse(fs.readFileSync(path.join(__dirname, '../../akrixsoft-akrix-ai-team/tasks/reports/AKX-2026-0013/exports/z7-example-82.18.json'), 'utf8'));
    /* ручной пример — до решения владельца (span, без type; обновит координатор): сверка без span/type */
    const shape = o => ({top: Object.keys(o).filter(k => k !== '_note').sort(), prd: o.prd.map(q => Object.keys(q).filter(k => k !== 'span' && k !== 'type').sort()),
      lab: o.rooms[0].ms.labRooms.map(q => Object.keys(q).sort()), mprd: o.prd.map(q => [q.walls.length, !!q.room]),
      shared: (() => { const c = {}; o.prd.forEach(q => q.walls.forEach(w => c[w] = (c[w] || 0) + 1)); return Object.values(c).filter(n => n > 1).length; })()});
    const A = shape(ex), B = shape(man);
    check(JSON.stringify(A) === JSON.stringify(B), 'Структура совпадает с ручным примером z7-example-82.18.json (кроме span/type)', {app: A, manual: B});
    result.export = {file: EXPORT, fn: saved.fn, prd: ex.prd, labRooms: ex.rooms[0].ms.labRooms.map(q => ({id: q.id, zn: q.zn, name: q.name, walls: q.walls}))};
    /* помещение отдельно (exportRoomAsObj): те же конструкции этой комнаты */
    const exr = await p.evaluate(() => PM.exportRoomAsObj());
    check(JSON.stringify(exr.prd) === JSON.stringify(ex.prd), 'Выгрузка помещения (exportRoomAsObj): o.prd тот же', (exr.prd || []).map(q => q.name));
    /* стена, удалённая из объекта, и пустая конструкция не выгружаются */
    const flt = await p.evaluate(() => MeasureLabPrd.out([{id: 'x1', no: 9, type: 'Шкаф', w: []}, {id: 'x2', no: 10, n: 'v81', room: 'nope', w: [{wid: 'w-none'}, {wid: S.room.wid[0], a: 100, b: 700}]}],
      [{ms: {wid: {0: S.room.wid[0]}, wl: {0: {id: S.room.wid[0], L: 4000}}}}]));
    check(flt.length === 1 && flt[0].id === 'x2' && !('room' in flt[0]) && !('span' in flt[0]) && flt[0].type === 'Другое' && flt[0].name === 'Другое' && JSON.stringify(flt[0].walls) === JSON.stringify([await W(0)]),
      'Фильтр выгрузки: только существующие стены и комнаты, пустые — нет; v81 без типа — «Другое», a/b v81 игнорируются', flt);

    /* ── 8. импорт своей выгрузки обратно (♻ Восстановить → файл) ── */
    await press(p.locator('#bMore'));
    await p.locator('#fRes').setInputFiles(EXPORT);
    await p.waitForFunction(() => /Импорт/.test(document.getElementById('toast').textContent), null, {timeout: 20000});
    await p.waitForTimeout(400);
    s = await st();
    const back = await p.evaluate(() => ({obj: S.room.obj, out: MeasureLabPrd.out(MeasureLabPrd.list(), [{ms: {wid: S.room.wid, wl: {}, labRooms: S.room.ms.labRooms}}])}));
    check(back.obj !== 'QA 8218 Изделия' && JSON.stringify(back.out) === JSON.stringify(ex.prd), 'Импорт обратно: конструкции восстановлены (новый объект)', {obj: back.obj, toast: s.toast, out: back.out});
    await p.evaluate(() => { MeasureLabPrd.open(); MeasureLabPrd.room(MeasureLab012.regions()[0].q.id); MeasureLabPrd.select(MeasureLabPrd.list()[1].id); });
    await p.waitForTimeout(120);
    await shot('5-imported');
    check(h.errors.length === 0, 'Нет ошибок страницы', h.errors);
  } catch (e) {
    check(false, 'Сценарий прерван', String(e && e.stack || e));
  } finally {
    await h.close();
  }
  /* ── 9. конструктор v898: штатный импорт (лист замера ⇧ → ✓ В стены, 🧩) не ломается полем prd ── */
  if (fs.existsSync(EXPORT) && fs.existsSync(AKRIX)) {
    const out = SHOTS + '/akrix'; fs.mkdirSync(out, {recursive: true});
    try {
      cp.execFileSync(process.execPath, [IMP, AKRIX, out, EXPORT], {stdio: ['ignore', 'pipe', 'pipe'], timeout: 240000, env: process.env});
      const R = JSON.parse(fs.readFileSync(out + '/import-result.json', 'utf8'))[0];
      result.akrix = {page: AKRIX, toasts: R.toasts, build: R.buildToasts, walls: (R.walls || []).length, zw: R.zw && R.zw.walls && R.zw.walls.length, errors: R.errors};
      check(R.errors.length === 0 && /стен 4/.test((R.toasts || []).join()) && (R.walls || []).length === 4 && R.zw && R.zw.walls.length === 4,
        'Конструктор v898: файл с o.prd открывается (⇧), ✓ В стены — 4 стены, 🧩 — 4 стены, ошибок нет', result.akrix);
    } catch (e) { check(false, 'Конструктор v898: импорт', String(e.stderr || e).slice(0, 800)); }
  } else check(false, 'Конструктор v898: нет файла выгрузки или страницы', {EXPORT, AKRIX});
  h.save('qa-v8218-prd.json', {screen: {vh: +process.env.QA_VH || 915, dpr: +process.env.QA_DPR || 2}, shots: SHOTS, ...result});
  const bad = h.checks.filter(c => !c.ok).length;
  console.log((bad ? 'FAIL ' : 'PASS ') + (h.checks.length - bad) + '/' + h.checks.length);
  if (bad) process.exitCode = 1;
})();
