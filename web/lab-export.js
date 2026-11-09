/* Measure Lab: real Akrix object export for standalone, manually measured planes.
 * The working room exporter and Akrix v3 contract are deliberately reused.
 * Does not close an open room or require its name. */
(() => {
  'use strict';
  const base81 = cvBase81;
  const object81 = exportObjObj;
  const room81 = exportRoomObj;
  const warn81 = cvWarn81;
  const json81 = exportJson;
  const clone = o => JSON.parse(JSON.stringify(o));
  const standalone = () => S.mode !== 'plan' && !!S.sess && !S.sess.room && !S.room0;

  function planeSize() {
    const q = S.q4 || {}, out = S.sess && S.sess.out || {}, dm = out.dims || {};
    const L = +q.L || +(S.man || {}).Lb || +(dm.Lb || {}).v || +(dm.Lt || {}).v || 0;
    const H = +q.H || +(S.man || {}).Hl || +(dm.Hl || {}).v || +(dm.Hr || {}).v || 0;
    return { L: r1(L), H: r1(H), LMeasured: !!(q.ok && !q.aL && !q.pL || +(S.man || {}).Lb > 0 || dm.Lb && /рулетка|замер|4 угла/.test(dm.Lb.src || '')), HMeasured: !!(q.ok && !q.aH && !q.pH || +(S.man || {}).Hl > 0 || +(S.man || {}).Hr > 0) };
  }

  function planeRoom() {
    if (!standalone()) return null;
    const s = S.sess, d = planeSize();
    // No invented dimensions: an untouched empty plane cannot become a real wall.
    if (!(Number.isFinite(d.L) && d.L > 0 && Number.isFinite(d.H) && d.H > 0)) return null;
    const key = String(s.id), rid = 'r_lab_plane_' + key, wid = 'w_lab_plane_' + key;
    return { id: rid, kind: 'room', obj: s.obj || '', name: s.name && s.name !== 'Плоскость' ? s.name : '', created: s.created || 0,
      oid: 'o_lab_plane_' + key, segs: { 0: s.id }, gn: { 0: 1 }, gnHi: 1, wid: { 0: wid },
      ms: { pts: [[0, 0], [d.L, 0]], closed: false, H: d.HMeasured ? d.H : '',
        dims: d.LMeasured ? [{ id: 'd_lab_plane_' + key, a: { p: 0 }, b: { p: 1 }, v: d.L }] : [],
        angs: {}, arcs: {}, rnd: {}, wsd: { 0: -1 } } };
  }

  cvBase81 = function () { return base81.apply(this, arguments) || planeRoom(); };

  async function planeObject() {
    // Capture the actual session before awaiting to detect navigation while exporting.
    const sid = S.sess && S.sess.id;
    await saveNow();
    if (!standalone() || !S.sess || S.sess.id !== sid) throw new Error('Замер сменился во время выгрузки. Повтори выгрузку текущей стены.');
    const r = planeRoom();
    if (!r) throw new Error('Для выгрузки отдельной стены введи её длину L и высоту H.');
    // doSave has a historical catch around exportObj; refresh explicitly and surface errors.
    const out = exportObj();
    if (!out || !out.dims) throw new Error('Не удалось получить размеры стены.');
    S.sess.out = out;
    await dbPut('sess', clone(S.sess));
    const room = await room81(r);
    const walls = Object.values(room.ms.wl || {});
    if (walls.length !== 1 || !(+walls[0].L > 0)) throw new Error('Не удалось подготовить стену для конструктора.');
    return { app: 'akrix-zamer', v: 3, kind: 'object', date: room.date,
      obj: r.obj, oid: r.oid, rooms: [room], gnMax: 1 };
  }

  exportObjObj = async function () {
    if (standalone()) return planeObject();
    await saveNow();
    if (S.sess) await dbPut('sess', clone(S.sess));
    if (S.room) { clearTimeout(roomT); await dbPut('sess', clone(S.room)); }
    const result = await object81.apply(this, arguments);
    if (!result || !result.rooms || !result.rooms.length) throw new Error('Нет стен для выгрузки. Добавь хотя бы один отрезок стены.');
    return result;
  };
  // Consumers and tests call PM's exported function reference, not the lexical binding.
  PM.exportObjObj = (...args) => exportObjObj(...args);

  cvWarn81 = async function () {
    if (standalone()) {
      const r = planeRoom(); if (!r) return [];
      const li = (await wlInf(r))[0];
      return li && !li.ok ? [{ t: 'С1 ≈ ' + nf81(li.v), l: 1, src: li.src, g: null }] : [];
    }
    // Open rooms are a supported survey, not an incomplete closed polygon.
    return (await warn81.apply(this, arguments)).filter(w => !(w.g && w.g.f === 'cl'));
  };

  // Original v81 exportJson silently returns when S.sol is absent, although q4.blank
  // provides a fully measured manual wall. Route that case into the object exporter.
  exportJson = async function () {
    if (standalone()) return cvFile81();
    if (!S.sol && !(S.q4 && S.q4.ok)) { toast('Для выгрузки укажи размеры стены.'); return false; }
    if (!S.sol && S.q4 && S.q4.ok) return cvFile81();
    return json81.apply(this, arguments);
  };

  // Export handlers are called by onclick without awaiting; catch rejection at the
  // boundary so a failed save cannot appear as an unresponsive button.
  const report = error => { console.error('Measure Lab export failed', error); toast('Выгрузка не выполнена: ' + (error && error.message || 'неизвестная ошибка')); return false; };
  for (const name of ['cvShare81', 'cvFile81', 'exportJson']) {
    const fn = name === 'cvShare81' ? cvShare81 : name === 'cvFile81' ? cvFile81 : exportJson;
    const guarded = async function () { try { return await fn.apply(this, arguments); } catch (error) { return report(error); } };
    if (name === 'cvShare81') cvShare81 = guarded;
    else if (name === 'cvFile81') cvFile81 = guarded;
    else exportJson = guarded;
  }

  // If the plane has not been dimensioned, original zExp says only “empty canvas”.
  const exp81 = zExp;
  zExp = function () {
    const result = exp81.apply(this, arguments);
    if (standalone() && !planeRoom()) {
      const box = $('zx');
      if (box && !box.querySelector('[data-lab-plane-dims]')) {
        const row = document.createElement('div'); row.className = 'row';
        const b = document.createElement('button'); b.dataset.labPlaneDims = '1';
        b.textContent = 'Указать L × H отдельной стены';
        b.onclick = () => { zmSet('plan'); bwPanel(); };
        row.appendChild(b); box.appendChild(row);
      }
    }
    return result;
  };

  // The v81 restore path substitutes a display label for an empty name. Keep the
  // optional data field genuinely empty; display-only fallbacks belong in the UI.
  const import81 = zImpExp;
  zImpExp = async function (o) {
    const source = (o && o.kind === 'object' ? o.rooms || [] : [o]).filter(r => r && r.ms && Array.isArray(r.ms.pts) && r.ms.pts.length >= 2);
    const before = new Set((await dbAll('sess')).map(r => r.id));
    const count = await import81.apply(this, arguments);
    if (!count) return count;
    const made = (await dbAll('sess')).filter(r => r.kind === 'room' && !before.has(r.id)).sort((a, b) => a.created - b.created);
    if (made.length === source.length) for (let i = 0; i < made.length; i++) {
      if (source[i].name !== '') continue;
      made[i].name = '';
      await dbPut('sess', clone(made[i]));
      if (S.room && S.room.id === made[i].id) S.room.name = '';
      if (S.room0 && S.room0.id === made[i].id) S.room0.name = '';
      const other = (S.objRooms || []).find(r => r.id === made[i].id); if (other) other.name = '';
    }
    try { title(); mkPanel(); draw(); } catch (error) { console.warn('Measure Lab imported room title refresh', error); }
    return count;
  };

  window.MeasureLabExport = Object.freeze({ isStandalone: standalone, planeRoom,
    object: (...a) => exportObjObj(...a), warnings: (...a) => cvWarn81(...a),
    source: 'Akrix object v3 / room v3 / ms.geo v1; no synthetic closure' });
})();
