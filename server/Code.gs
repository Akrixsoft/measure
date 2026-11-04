/* =====================================================================
   Measure — сервер распознавания фото стены (Google Apps Script, веб-приложение)
   Ключ AI — только здесь: Настройки проекта → Свойства скрипта:
     ANTHROPIC_API_KEY — ключ API;  TOKEN — токен доступа (тот же — в Measure: ⋮ → ⚙ → AI-токен);  MODEL — модель (необязательно)
   Measure шлёт: {tok, img (base64 JPEG), kinds: [[ключ, название], …]} (text/plain — без CORS-предзапроса)
   Ответ: {ok, corners: [{x,y}×4 | пусто], items: [{kind, x0, y0, x1, y1, note}]} — координаты 0…1000 по ширине / высоте фото
   ===================================================================== */

/* ============ BLOCK: CONFIG ============ */
const P = PropertiesService.getScriptProperties();
const MODEL = () => P.getProperty('MODEL') || 'claude-opus-5-5';
const API = 'https://api.anthropic.com/v1/messages';

/* ============ BLOCK: HTTP ============ */
function doPost(e) {
  try {
    const q = JSON.parse(e.postData.contents || '{}');
    if (!P.getProperty('TOKEN') || q.tok !== P.getProperty('TOKEN')) return out_({ ok: false, err: 'нет доступа (токен)' });
    if (!q.img) return out_({ ok: false, err: 'нет фото' });
    return out_(recognize_(q.img, q.kinds || []));
  } catch (err) { return out_({ ok: false, err: String(err && err.message || err) }); }
}
function doGet() { return out_({ ok: true, app: 'measure-server', model: MODEL() }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============ BLOCK: РАСПОЗНАВАНИЕ ============ */
function recognize_(img, kinds) {
  const key = P.getProperty('ANTHROPIC_API_KEY'); if (!key) return { ok: false, err: 'на сервере нет ключа API' };
  const keys = kinds.map(k => k[0]); if (!keys.length) return { ok: false, err: 'нет видов' };
  const pt = { type: 'object', additionalProperties: false, required: ['x', 'y'], properties: { x: { type: 'integer' }, y: { type: 'integer' } } };
  const schema = { type: 'object', additionalProperties: false, required: ['corners', 'items'], properties: {
    corners: { type: 'array', items: pt },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'x0', 'y0', 'x1', 'y1', 'note'], properties: {
      kind: { type: 'string', enum: keys }, x0: { type: 'integer' }, y0: { type: 'integer' }, x1: { type: 'integer' }, y1: { type: 'integer' }, note: { type: 'string' } } } } } };
  const sys = 'Ты помогаешь замерщику мебели. На фото — стена помещения (стройка или ремонт). Найди на основной стене (той, что напротив камеры) коммуникации и выводы: ' +
    kinds.map(k => k[0] + ' — ' + k[1]).join('; ') + '. ' +
    'Координаты — целые 0…1000: x — доля ширины фото слева направо, y — доля высоты сверху вниз. ' +
    'corners — 4 угла основной стены по порядку: низ-лево, низ-право, верх-право, верх-лево (стык с полом и потолком); если угол за кадром — точка на краю кадра по линии стены; если стену не определить — пустой список. ' +
    'items — каждый найденный предмет: рамка x0,y0 (лево-верх) — x1,y1 (право-низ); для wrt (трасса: кабель, труба, штроба по стене) — x0,y0 начало и x1,y1 конец линии. ' +
    'Подрозетники и пустые отверстия под розетки — roz; парные — один предмет с рамкой на оба. Не выдумывай: только то, что видно. note — коротко по-русски (например: «двойной подрозетник», «вывод ХВС»).';
  const body = { model: MODEL(), max_tokens: 16000, fallbacks: 'default', system: sys,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: schema } },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } },
      { type: 'text', text: 'Распознай стену и предметы на ней.' }] }] };
  const r = UrlFetchApp.fetch(API, { method: 'post', contentType: 'application/json', muteHttpExceptions: true, payload: JSON.stringify(body),
    headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01' } });
  const code = r.getResponseCode(), o = JSON.parse(r.getContentText() || '{}');
  if (code !== 200) return { ok: false, err: 'AI ' + code + ': ' + (o.error && o.error.message || '') };
  if (o.stop_reason === 'refusal') return { ok: false, err: 'AI отказал' + (o.stop_details && o.stop_details.category ? ' (' + o.stop_details.category + ')' : '') };
  if (o.stop_reason === 'max_tokens') return { ok: false, err: 'AI: ответ обрезан' };
  const t = (o.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const res = JSON.parse(t); return { ok: true, corners: res.corners.length === 4 ? res.corners : [], items: res.items, model: o.model };
}

/* ============ BLOCK: ПРОВЕРКА (запустить в редакторе: ▶ test) ============ */
function test() { Logger.log(doGet().getContent()); Logger.log('ключ: ' + (P.getProperty('ANTHROPIC_API_KEY') ? 'есть' : 'НЕТ') + ' · токен: ' + (P.getProperty('TOKEN') ? 'есть' : 'НЕТ')); }
