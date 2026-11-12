// AKX-2026-0015 · 82.35.15: ⋮ → «Проверить обновления» при уже скачанной версии — «Перезапустить», а не «обновлений нет». Натив AkrixUpdate — заглушка.
require('./qa-h-0015.cjs')(process.argv[3], 9359).then(async h => {
  const {ok, W, tap, M, btn, finish} = h;
  const mock = pend => M(`(() => { window.__rs = 0; window.AkrixUpdate = {check() { akrixUpdateEvent({type: 'checking', manual: true}); setTimeout(() => akrixUpdateEvent({type: 'none', manual: true, version: '82.35.13'}), 50); },
    state() { return JSON.stringify({version: '82.35.13', pending: ${pend ? "'82.35.14'" : 'null'}}); }, restart() { window.__rs = 1; }}; })()`);
  const card = () => M(`(() => { const b = document.getElementById('cUpd'); return {on: b.classList.contains('on'), t: b.querySelector('span').textContent, k: b.querySelector('button').textContent}; })()`);
  await mock(true); await btn('#bMore'); await W(150); await btn('#bUpdChk'); await W(300);
  let c = await card(); ok('скачано 82.35.14 → карточка «Загружена версия 82.35.14 · Перезапустить»', c.on && c.t.includes('82.35.14') && c.k === 'Перезапустить', c);
  await btn('#cUpd button'); await W(300); ok('«Перезапустить» → натив restart()', (await M('window.__rs')) === 1);
  await mock(false); await btn('#bMore'); await W(150); await btn('#bUpdChk'); await W(300);
  c = await card(); ok('ничего не скачано → «обновлений нет»', c.on && c.t.includes('обновлений нет'), c);
  await btn('#bMore'); await W(150); await btn('#bStripRs'); await W(150);
  ok('⋮ → «Строки инструментов — по умолчанию» срабатывает', (await M("document.getElementById('cToast').textContent")).includes('по умолчанию'));
  await finish();
});
