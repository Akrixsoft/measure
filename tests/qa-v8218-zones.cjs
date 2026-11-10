/* AKX-2026-0010 — «Зоны» на плане (бывш. «Помещения» Lab 0.12): проверка Д1–Д12 через интерфейс.
   Касания пером и пальцем — события CDP по холсту, кнопки — tap(). Состояние приложения только читается;
   фикстурами задаются лишь исходные стены/подложка (как в qa-v012-*). Запуск:
   NODE_PATH=/opt/npm-tools/node_modules QA_VH=797 QA_DPR=3 node tests/qa-v8218-zones.cjs */
const fs = require('fs');
const {start} = require('./qa-v011-harness.cjs');
const SHOTS = process.env.QA_SHOTS || '/tmp/qa-v8218';

(async () => {
  fs.mkdirSync(SHOTS, {recursive: true});
  const h = await start();
  const {p, check} = h;
  const btn = name => p.locator('[data-lab12="' + name + '"]');
  const has = async name => (await btn(name).count()) > 0;
  const press = async name => { await btn(name).tap(); await p.waitForTimeout(60); };
  /* 82.18 (integration): закрытые зоны строкой не показываются — вход плиткой «Зона» футляра плана (🖍 #labPlF → [data-lab-tb=zone]);
     открытая панель закрывается своей кнопкой «Закрыть зоны», если она видна, иначе MeasureLab012.close(). Поведение не меняется. */
  /* 82.18: инструмент плана — видимая кнопка строки, иначе из футляра плана (🖍 #labPlF → #tb [data-pk]) */
  const pickPl = async k => {
    const vis = p.locator('[data-pk="' + k + '"]:visible');
    if (await vis.count()) await vis.first().tap();
    else { await p.locator('#labPlF').tap(); await p.waitForTimeout(150); await p.locator('#tb [data-pk="' + k + '"]').tap(); }
    await p.waitForTimeout(100);
  };
  const toggleZones = async () => {
    if (await p.evaluate(() => MeasureLab012.isOpen())) {
      if (await btn('toggle').isVisible()) return press('toggle');
      await p.evaluate(() => MeasureLab012.close()); await p.waitForTimeout(60); return;
    }
    await p.locator('#labPlF').tap(); await p.waitForTimeout(150);
    await p.locator('#tb [data-lab-tb=zone]').tap(); await p.waitForTimeout(150);
  };
  async function tap(type, w) { const a = await h.xy(w); await h.down(type, a); await h.up(type, a); await p.waitForTimeout(40); }
  const pen = w => tap('pen', w), finger = w => tap('touch', w);
  const shot = name => p.screenshot({path: SHOTS + '/' + name + '.png'});
  const st = () => p.evaluate(() => ({
    zones: MeasureLab012.regions().map(({r, q}) => ({room: r.id, name: q.name, src: q.src, n: q.pts.length, walls: q.walls.length})),
    dividers: MeasureLab012.regions && (S.room.ms.labDividers || []).length,
    toast: document.getElementById('toast').textContent, psel: S.psel, tool: PL.tool,
    buttons: [...document.querySelectorAll('#lab12-plan [data-lab12]')].map(b => b.dataset.lab12),
    toggle: document.querySelector('[data-lab12="toggle"]')?.textContent, rooms: [S.room, ...S.objRooms].filter(r => r && !r.pstub && r.ms.pts.length).length,
    panel: document.getElementById('lab12-plan').hidden ? null : document.getElementById('lab12-plan').getBoundingClientRect().toJSON()
  }));
  const room = (name, ms) => p.evaluate(async ([name, ms]) => {
    await PM.newRoom('QA 8218 ' + name, name);
    Object.assign(S.room.ms, ms); gnFix(); PEN.mode = 'auto'; PEN.seen = false; WS.mag = 1;
    document.body.classList.remove('tz'); fit(); draw(); return S.room.id;
  }, [name, ms]);
  const box = {pts: [[0, 0], [5000, 0], [5000, 3000], [0, 3000]], closed: true, H: 2700};
  try {
    /* ── 1. Обычная замкнутая комната: Д3, Д10, Д9 ── */
    await room('Кухня-гостиная', box);
    await toggleZones();
    let s = await st();
    check(s.toggle === 'Закрыть зоны' && !s.buttons.includes('base'), 'Д10/Д3: панель «Зоны», в обычной комнате нет «Разделить исходный контур»', s.buttons);
    await press('divider'); await pen([2500, 0]); await pen([2500, 3000]);
    await press('fill'); await pen([1200, 1500]);
    s = await st();
    check(s.zones.length === 1 && s.zones[0].name === 'Зона 1' && s.zones[0].src === 'fill', 'Д3: «Заливка стен» в замкнутой комнате создаёт зону сразу', {zones: s.zones, toast: s.toast});
    await press('fill'); await pen([3700, 1500]);
    await press('manual');
    for (const q of [[300, 300], [4700, 300], [4700, 2700], [300, 2700]]) await pen(q);
    await press('commit');
    s = await st();
    check(s.zones.length === 2 && s.zones[1].name === 'Зона 2' && /перекрывает другую зону/.test(s.toast),
      'Д3/Д10: вторая зона «Зона 2», перекрытие зон отклоняется понятным текстом', {zones: s.zones.map(z => z.name), toast: s.toast});
    await press('cancel');
    await pen([1200, 1500]);
    const field = p.getByRole('textbox', {name: 'Имя зоны', exact: true});
    check(await field.count() === 1 && await p.getByRole('textbox', {name: 'Имя помещения', exact: true}).count() === 0,
      'Д10: поле панели — «Имя зоны», не совпадает с именем помещения');
    await field.fill('Прихожая'); await field.press('Enter');
    s = await st();
    const ui = await p.evaluate(() => {
      const r = el => el && el.getClientRects().length ? el.getBoundingClientRect() : null, pan = r(document.getElementById('lab12-plan'));
      const cut = (a, b) => !!(a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom);
      toast('Проверка тоста'); const t = r(document.getElementById('toast'));
      return {panel: pan.toJSON(), zfTop: r(document.getElementById('zf'))?.top, zfBottom: r(document.getElementById('zf'))?.bottom, inZf: document.getElementById('lab12-plan').parentElement.id === 'zf', toast: cut(pan, t),
        fit: cut(pan, r(document.getElementById('bFit'))), md: cut(pan, r(document.getElementById('mdT'))), vh: innerHeight, dpr: devicePixelRatio};
    });
    check(!ui.toast && !ui.fit && !ui.md && (ui.inZf ? ui.panel.top >= ui.zfTop - 1 && ui.panel.bottom <= ui.zfBottom + 1 : ui.panel.bottom <= ui.zfTop + 1) && ui.panel.top > ui.vh / 2,   // 82.18: панель — строка стека #zf (lab-tb)
      'Д9: панель внизу над полосой, не перекрывает тост и кнопки вида', ui);
    await shot('1-zones');

    /* ── 2. Д7: граница сдвинута → зоны отмечены, «Перезалить» тем же способом ── */
    await pen([2500, 1500]);
    check(await has('edit-divider'), 'Т14: касание границы выбирает её');
    await press('edit-divider'); await pen([2000, 0]); await pen([2000, 3000]);
    s = await st();
    let stale = await p.evaluate(() => MeasureLab012.stale().length);
    check(stale === 2 && /изменились/.test(s.toast), 'Д7: после правки границы обе зоны отмечены как устаревшие, есть подсказка', {stale, toast: s.toast});
    await shot('2-stale');
    await pen([1000, 1500]);
    check((await btn('refill').textContent()).includes('⟳'), 'Д7: у устаревшей зоны «Перезалить ⟳»');
    await press('refill'); await pen([1000, 1500]);
    stale = await p.evaluate(() => MeasureLab012.stale());
    s = await st();
    check(stale.length === 1 && s.zones.find(z => z.name === 'Прихожая').src === 'fill', 'Д7/Т11: перезаливка по стенам снимает отметку с зоны', {stale, zones: s.zones});

    /* ── 3. Д2: удалить зону кнопкой, ↶, корзиной ── */
    await pen([3700, 1500]);
    await p.locator('#bDelS').tap(); await p.waitForTimeout(100);   // 82.18: одна 🗑 — кнопки «Удалить …» панели скрыты (lab-tb), тот же zDelSel
    s = await st();
    check(s.zones.length === 1 && /удалена/.test(s.toast), 'Д2: 🗑 удаляет выбранную зону', {zones: s.zones.map(z => z.name), toast: s.toast});
    await p.locator('#zur button').first().tap(); await p.waitForTimeout(150);
    s = await st();
    check(s.zones.length === 2, 'Д2: ↶ возвращает удалённую зону', s.zones.map(z => z.name));
    await pen([3700, 1500]);
    await p.locator('#bDelS').tap(); await p.waitForTimeout(100);
    s = await st();
    check(s.zones.length === 1 && s.zones[0].name === 'Прихожая', 'Д2: корзина удаляет выбранную зону', s.zones.map(z => z.name));
    /* zn (AKX-2026-0012 §7): номер по проекту, после удаления «Зоны 2» новый — 3, не 2 */
    await press('fill'); await pen([3700, 1500]);
    let zn = await p.evaluate(() => MeasureLab012.regions().map(({q}) => [q.name, q.zn]));
    check(JSON.stringify(zn) === JSON.stringify([['Прихожая', 1], ['Зона 3', 3]]), 'zn: номера зон постоянные, удалённый номер не переиспользуется', zn);
    await p.locator('#bDelS').tap(); await p.waitForTimeout(100);

    /* ── 4. Правка стен: Д5, Д11, Д6, Д12 ── */
    await press('walls');
    s = await st();
    check(s.buttons.includes('back') && !s.buttons.includes('manual'), 'Д5: в режиме стен есть «← Зоны»', s.buttons);
    await pen([0, 1500]);
    s = await st();
    check(s.psel?.t === 's' && s.buttons.includes('shift'), 'Т15: пером выбрана стена, кнопки правки стены', {psel: s.psel, b: s.buttons});
    const wall = s.psel.i;
    await press('shift'); await press('cancel');
    s = await st();
    check(s.psel?.t === 's' && s.psel.i === wall && s.buttons.includes('shift') && !s.buttons.includes('manual'),
      'Д11: «Отмена» в «Сдвиге» возвращает к выбранной стене', {psel: s.psel, b: s.buttons});
    /* Д6б: повторное касание выбранной стены открывает поле длины с клавиатурой — панель не пропадает */
    await pen([0, 1500]); await p.waitForTimeout(200);
    const kb = await p.evaluate(() => ({kb: document.body.classList.contains('kb'), hidden: getComputedStyle(document.getElementById('lab12-plan')).display === 'none',
      h: document.getElementById('lab12-plan').getBoundingClientRect().height, focus: document.activeElement?.id || document.activeElement?.tagName}));
    await shot('4-keyboard');
    check(kb.kb && !kb.hidden && kb.h < 60, 'Д6б: при клавиатуре панель видна одним рядом', kb);
    await p.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(150);
    await press('shift'); await pen([-400, 1500]);
    s = await st();
    const x = await p.evaluate(() => S.room.ms.pts.map(q => q[0]));
    check(Math.min(...x) === -400 && s.psel?.t === 's', 'Т16: сдвиг стены с зонами внутри выполняется', {x, toast: s.toast});
    check((await p.evaluate(() => MeasureLab012.stale().length)) === 1, 'Д7: зона, упиравшаяся в сдвинутую стену, отмечена');
    await press('split-wall');
    s = await st();
    check(s.psel?.t === 's' && s.buttons.includes('split-wall') && s.buttons.includes('delete-wall'),
      'Д6а: после «Разбить стену» выбран участок, кнопки стены остались', {psel: s.psel, b: s.buttons});
    await shot('3-split');
    await press('back');
    s = await st();
    check(s.buttons.includes('manual') && s.buttons.includes('walls'), 'Д5: «← Зоны» возвращает к выбору зон', s.buttons);
    await p.locator('#ch [data-pk="st"]').first().tap(); await p.waitForTimeout(100);
    s = await st();
    check(s.toggle === 'Зоны' && s.buttons.length === 1 && s.tool !== 'sel', 'Д12: другой инструмент закрывает панель зон', {b: s.buttons, tool: s.tool});

    /* ── 5. Д8: помещение без стен ── */
    await room('Пусто', {pts: [], closed: false});
    await toggleZones(); await press('fill'); await pen([1000, 1000]);
    s = await st();
    check(s.zones.length === 0 && /Нет стен и границ/.test(s.toast), 'Д8: «Заливка» без стен — понятный отказ', s.toast);
    await press('manual');
    for (const q of [[0, 0], [2000, 0], [2000, 1500], [0, 1500]]) await pen(q);
    await press('commit');
    s = await st();
    check(s.zones.length === 1 && s.zones[0].src === 'manual', 'Д8: «Контур» создаёт зону без стен', {zones: s.zones, toast: s.toast});

    /* ── 6. Д4: перо обнаружено (PEN.mode auto) — правило v81 и палец в панели ── */
    await room('Перо', box);
    await toggleZones();
    await pen([2500, 1500]);   // перо обнаружено
    check(await p.evaluate(() => PEN.on()), 'Д4: перо обнаружено, PEN.on()');
    await press('manual'); await finger([500, 500]);
    s = await st();
    const draft = await p.evaluate(() => document.querySelector('[data-lab12="commit"]') ? 3 : 0);
    check(/перо/.test(s.toast) && draft === 0, 'Д4: точка «Контура» пальцем не ставится — подсказка вместо тишины', s.toast);
    const v0 = await p.evaluate(() => ({...S.view}));
    await h.drag('touch', [1000, 1000], [2500, 1800]);
    const v1 = await p.evaluate(() => ({...S.view}));
    check(v0.x !== v1.x || v0.y !== v1.y || JSON.stringify(v0) !== JSON.stringify(v1), 'Д4: правило v81 — палец при пере двигает вид', {v0, v1});
    await press('cancel'); await press('fill'); await finger([2500, 1500]);
    s = await st();
    check(s.zones.length === 1, 'Д4: «Заливка» касанием пальца (как ⌂ v81)', {zones: s.zones, toast: s.toast});
    await finger([2500, 1500]);
    check(await has('delete-zone'), 'Д4: зона выбирается пальцем');
    await press('assign'); await finger([0, 1500]); await finger([2500, 3000]);
    await press('assigned');
    s = await st();
    check(s.zones[0].walls === 2, 'Д4: стены зоны назначаются пальцем', s.zones);
    const wid = await p.evaluate(() => ({walls: MeasureLab012.regions()[0].q.walls, wid: Object.values(S.room.wid || {})}));
    check(wid.walls.length === 2 && wid.walls.every(id => typeof id === 'string' && wid.wid.includes(id)), 'walls: состав зоны — постоянные ID стен (r.wid), не индексы', wid);
    /* зона 0.12 без zn (старое сохранение) получает номер при показе плана */
    const mig = await p.evaluate(() => { S.room.ms.labRooms.push({id: 'old-012', name: 'Старая', pts: [[100, 100], [900, 100], [900, 900], [100, 900]], walls: []}); delete S.room.ms.labRooms[0].zn; draw();
      return MeasureLab012.regions().map(({q}) => q.zn); });
    check(mig.length === 2 && mig.every(n => n > 0) && new Set(mig).size === 2, 'zn: зоны без номера (0.12) получают уникальный zn', mig);

    /* ── 7. Д1: подложка с двумя комнатами, граница в A, затем штатный ⌂ по B ── */
    await room('Скан', {pts: [], closed: false});
    const W = await p.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 360;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 640, 360);
      g.strokeStyle = '#000'; g.lineWidth = 12; g.strokeRect(65, 65, 505, 235);
      g.beginPath(); g.moveTo(320, 65); g.lineTo(320, 300); g.stroke();
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      await ulAdd(new File([blob], 'qa-8218.png', {type: 'image/png'}));
      localStorage.setItem('measure.plx', JSON.stringify(['rm'])); mkChips(); fit(); draw();
      const u = ulGet().ul, w = (x, y) => [u.x0 + x * u.s, u.y0 - y * u.s];
      return {A: w(190, 180), A1: w(120, 180), B: w(450, 265),   // B — ниже подписи стены-заготовки С5
        cut: [w(190, 65), w(190, 300)]};
    });
    await pickPl('rm');
    await pen(W.A); await p.waitForTimeout(400);
    s = await st();
    check(s.rooms === 1, 'Д1: штатный ⌂ по A создаёт помещение A', {rooms: s.rooms, toast: s.toast});
    await toggleZones();
    await press('divider'); await pen(W.cut[0]); await pen(W.cut[1]);
    await toggleZones();
    await pickPl('rm');
    await pen(W.B); await p.waitForTimeout(400);
    s = await st();
    check(s.rooms === 2 && s.zones.length === 0, 'Д1: после границы штатный ⌂ по B создаёт помещение со стенами, а не зону', {rooms: s.rooms, zones: s.zones, toast: s.toast});
    await toggleZones(); await press('image'); await pen(W.A1); await p.waitForTimeout(200);
    s = await st();
    check(s.zones.length === 1 && s.zones[0].src === 'image' && s.zones[0].name === 'Зона 1', 'Д1: «Заливка фото» из панели «Зоны» создаёт зону', {zones: s.zones, toast: s.toast});
    await shot('5-underlay');

    /* ── 8. Выгрузка: формат v3 + расширения 0.12 без новых полей ── */
    const ex = await p.evaluate(async () => { await PM.flushAll(); return PM.exportObjObj(); });
    const zones = ex.rooms.flatMap(r => r.ms.labRooms || []);
    check(zones.length === 1 && zones.every(q => !('src' in q) && q.id && q.name && q.zn === 1 && Array.isArray(q.pts) && Array.isArray(q.walls))
      && ex.rooms.every(r => !('labZnHi' in r.ms)),
      'Контракт: ms.labRooms {id,name,pts,walls} + необязательное zn; служебные src/labZnHi не выгружаются', zones.map(q => Object.keys(q)));
    check(h.errors.length === 0, 'Нет ошибок страницы', h.errors);
  } catch (e) {
    check(false, 'Сценарий прерван', String(e && e.stack || e));
  } finally {
    h.save('qa-v8218-zones.json', {screen: {vh: +process.env.QA_VH || 915, dpr: +process.env.QA_DPR || 2}, shots: SHOTS});
    await h.close();
    const bad = h.checks.filter(c => !c.ok).length;
    console.log((bad ? 'FAIL ' : 'PASS ') + (h.checks.length - bad) + '/' + h.checks.length);
    if (bad) process.exitCode = 1;
  }
})();
