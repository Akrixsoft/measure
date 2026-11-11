/* Measure 82.18 — стартовое окно «Проекты» вместо #ss (AKX-2026-0012, инженер A; architect.md §3).
   Строка «клиент · проект», дата справа; папки, перемещение, архив, корзина с восстановлением; «Удалить навсегда» — только из корзины.
   Меню строки: кнопка ⋮ на каждой строке + долгое нажатие 450 мс (сдвиг > 8 px отменяет), лист снизу. Превью нет.
   ═══ [BLOCK LP-UI]     разметка окна
   ═══ [BLOCK LP-RENDER] уровни: Проекты › Папка, Архив, Корзина, поиск; сортировка по дате / по имени (localStorage measure.prjSort)
   ═══ [BLOCK LP-INPUT]  касание строки — открыть; ⋮ / долгое нажатие — меню; contextmenu пера подавлен
   ═══ [BLOCK LP-MENU]   листы: проект, папка, «В папку…», меню окна (⚙, копия, восстановить, версия)
   ═══ [BLOCK LP-OPEN]   открыть проект: холст поверх (MeasureLabSketch.open(pid)); список — поверх холста, холст не закрывается
   ═══ [BLOCK LP-WRAP]   sessList(on) → show()/hide(); lastOpen() → последний проект или список
   ═══ [BLOCK LP-TITLE]  #labPrjT «клиент · проект» в шапке холста вместо #hdIn; касание — меню проекта
   Контракт (architect.md §8.3): MeasureLabProjects: show(), hide(), refresh() (+ isOpen(), open(pid), current()) */
(() => {
  'use strict';
  if (!window.PM || !window.MeasureLabStore || window.MeasureLabProjects) return;
  const ST = MeasureLabStore, api = window.MeasureLabProjects = {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  // сообщения: при открытом списке — в свой тост снизу (штатный тост v81 сверху закрыл бы первую строку), иначе — штатный
  const say = t => { if (root && root.classList.contains('on')) return note(t); try { toast(t); } catch (e) { } };
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  const MON = ['янв.', 'февр.', 'марта', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  function fdate(t) {   // сегодня — «16:58», в этом году — «9 нояб.», раньше — «27.02.2024»
    if (!t) return ''; const d = new Date(t), n = new Date(), p = x => String(x).padStart(2, '0');
    if (d.toDateString() === n.toDateString()) return p(d.getHours()) + ':' + p(d.getMinutes());
    if (d.getFullYear() === n.getFullYear()) return d.getDate() + ' ' + MON[d.getMonth()];
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
  }
  api.fdate = fdate;
  const IC = {
    search: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    sort: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h11M4 17h6"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    nfold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="M12 10v6M9 13h6" stroke-linecap="round"/></svg>',
    fold: '<svg class="lp-ic" viewBox="0 0 28 22"><path d="M0 3a3 3 0 0 1 3-3h7l3 3h12a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3z" fill="#FF8A00"/></svg>'
  };

  /* ═══ [BLOCK LP-UI] ═══ */
  const root = document.createElement('div'); root.id = 'labPrj'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Проекты');
  root.innerHTML = `<div class="lp-hd"><button class="lp-ib" data-lp="search" title="Поиск" aria-label="Поиск">${IC.search}</button><div class="lp-cr"></div><input class="lp-q" type="search" placeholder="Клиент, проект, помещение" autocomplete="off" hidden><button class="lp-ib" data-lp="sort" title="Сортировка" aria-label="Сортировка">${IC.sort}</button><button class="lp-ib" data-lp="menu" title="Ещё" aria-label="Ещё">${IC.more}</button></div>
<div class="lp-sub"><span class="lp-sp"></span><button class="lp-nf" data-lp="newfld">${IC.nfold}Новая папка</button></div>
<div class="lp-ls" role="list"></div>
<button class="lp-fab" data-lp="new" title="Новый проект" aria-label="Новый проект">${IC.plus}</button>
<div class="lp-to" role="status"><span></span><button data-lp="undo">↶ Вернуть</button></div>
<div class="lp-sh"><div class="lp-pn"></div></div>
<div class="lp-dg"><div class="lp-bx"></div></div>`;
  document.body.appendChild(root);
  document.body.classList.add('lab-prj');
  const $p = q => root.querySelector(q), ls = $p('.lp-ls'), cr = $p('.lp-cr'), qIn = $p('.lp-q'), sh = $p('.lp-sh'), dg = $p('.lp-dg');
  const V = {view: 'root', fid: null, q: null, sort: (() => { try { return localStorage.getItem('measure.prjSort') === 'name' ? 'name' : 'date'; } catch (e) { return 'date'; } })(), on: false, cur: null, data: null};
  api.state = V;

  /* ═══ [BLOCK LP-RENDER] ═══ */
  async function load() {   // проекты, папки и сводка по записям замеров (дата, имена помещений, фото)
    await ST.migrate();
    const [L, F, all] = await Promise.all([ST.projects(), ST.folders(), (async () => (await dbAll('sess').catch(() => [])) || [])()]), C = {};
    for (const c of await ST.db.all('cv')) C[c.pid] = c;
    const info = {};
    for (const P of L) info[P.id] = {upd: Math.max(P.upd || 0, (C[P.id] || {}).upd || 0), rooms: [], ph: 0};
    const byOid = new Map(L.map(p => [p.id, p])), byObj = new Map(L.map(p => [p.obj, p])), roomP = {};
    for (const r of all) if (r.kind === 'room') { const P = (r.oid && byOid.get(r.oid)) || (!r.oid && byObj.get(r.obj || '')); if (!P) continue; roomP[r.id] = P; if (!r.pstub && r.name) info[P.id].rooms.push(r.name); }
    for (const o of all) { const P = o.kind === 'room' ? roomP[o.id] : o.room && o.room !== '~board' ? roomP[o.room] : (o.labOid && byOid.get(o.labOid)) || (!o.labOid && byObj.get(o.obj || '')); if (!P) continue;
      const i = info[P.id]; if (!(o.del && !P.del)) i.upd = Math.max(i.upd, o.upd || o.created || 0); i.ph += (o.refs || []).length + (o.frames || []).length; }
    V.data = {L, F, info}; return V.data;
  }
  const dateOf = P => (V.data.info[P.id] || {}).upd || P.upd || P.created;
  function sorted(L) { return L.slice().sort(V.sort === 'name' ? (a, b) => ST.label(a).localeCompare(ST.label(b), 'ru') || dateOf(b) - dateOf(a) : (a, b) => dateOf(b) - dateOf(a)); }
  const rowP = (P, extra) => `<div class="lp-row" role="listitem" data-pid="${esc(P.id)}"><span class="lp-t">${P.client ? '<b>' + esc(P.client) + '</b>' : ''}${P.client && P.name ? ' · ' : ''}${esc(P.name || (P.client ? '' : 'Без названия'))}${extra ? '<small>' + esc(extra) + '</small>' : ''}</span><span class="lp-d">${fdate(V.view === 'trash' ? P.del : dateOf(P))}</span><button class="lp-more" data-more aria-label="Меню проекта">${IC.more}</button></div>`;
  function crumbs() {
    const up = t => `<button class="lp-up" data-lp="up">${t}</button><i>›</i>`;
    if (V.view === 'root') return '<button class="lp-cur" data-lp="top">Проекты</button>';
    if (V.view === 'folder') { const f = V.data.F.find(x => x.id === V.fid); return up('Проекты') + `<button class="lp-cur">${esc(f ? f.name : 'Папка')}</button>`; }
    return up('Проекты') + `<button class="lp-cur">${V.view === 'arch' ? 'Архив' : 'Корзина'}</button>`;
  }
  async function render(reload) {
    if (reload !== false || !V.data) await load();
    const {L, F} = V.data, live = L.filter(p => !p.del && !p.arch), srch = V.q != null;
    cr.innerHTML = crumbs(); cr.hidden = srch; qIn.hidden = !srch; $p('[data-lp="search"]').innerHTML = srch ? IC.close : IC.search;
    $p('[data-lp="sort"]').title = 'Сортировка: ' + (V.sort === 'name' ? 'по имени' : 'по дате');
    $p('.lp-sub').style.display = V.view === 'root' && !srch ? '' : 'none';
    $p('.lp-fab').hidden = V.view === 'arch' || V.view === 'trash';
    let h = '';
    if (srch) {
      const q = norm(V.q.trim()), hit = P => !q || norm([P.client, P.name, ...(V.data.info[P.id] || {}).rooms || []].join(' ')).includes(q);
      const R = sorted(L.filter(p => !p.del && hit(p)));
      for (const P of R) { const f = F.find(x => x.id === P.folder); h += rowP(P, P.arch ? 'архив' : f ? f.name : ''); }
      if (!R.length) h = '<div class="lp-empty">Ничего не найдено</div>';
    } else if (V.view === 'root') {
      const fs = F.filter(f => !f.parent).sort((a, b) => V.sort === 'name' ? a.name.localeCompare(b.name, 'ru') : (a.order || 0) - (b.order || 0) || b.created - a.created);
      for (const f of fs) { const inF = live.filter(p => p.folder === f.id), d = Math.max(f.created || 0, ...inF.map(dateOf));
        h += `<div class="lp-row lp-fold" role="listitem" data-fid="${esc(f.id)}">${IC.fold}<span class="lp-t">${esc(f.name)}</span><span class="lp-d">${inF.length} · ${fdate(d)}</span><button class="lp-more" data-more aria-label="Меню папки">${IC.more}</button></div>`; }
      const ps = sorted(live.filter(p => !p.folder || !F.some(f => f.id === p.folder)));
      for (const P of ps) h += rowP(P);
      if (!fs.length && !ps.length) h += '<div class="lp-empty">Проектов нет · ＋ — новый проект</div>';
      const na = L.filter(p => p.arch && !p.del).length, nt = L.filter(p => p.del).length;
      if (na) h += `<div class="lp-row lp-sec" data-view="arch"><span class="lp-t">▸ Архив (${na})</span></div>`;
      if (nt) h += `<div class="lp-row lp-sec" data-view="trash"><span class="lp-t">▸ Корзина (${nt})</span></div>`;
    } else if (V.view === 'folder') {
      const ps = sorted(live.filter(p => p.folder === V.fid)); for (const P of ps) h += rowP(P);
      if (!ps.length) h = '<div class="lp-empty">Папка пуста · ⋮ у проекта → «В папку…»</div>';
    } else {
      const ps = V.view === 'arch' ? sorted(L.filter(p => p.arch && !p.del)) : L.filter(p => p.del).sort((a, b) => b.del - a.del);
      for (const P of ps) h += rowP(P);
      if (!ps.length) h = `<div class="lp-empty">${V.view === 'arch' ? 'Архив пуст' : 'Корзина пуста'}</div>`;
    }
    ls.innerHTML = h;
  }
  api.refresh = () => V.on ? render() : Promise.resolve();
  function go(view, fid) { V.view = view; V.fid = fid || null; V.q = null; ls.scrollTop = 0; $p('.lp-to').classList.remove('on'); last = null; return render(false); }

  /* ═══ [BLOCK LP-INPUT] ═══ */
  let lp = null, swallow = false;   // swallow — тот click, которым кончается долгое нажатие (приходит на фон листа)
  root.addEventListener('pointerdown', () => { swallow = false; }, true);
  root.addEventListener('click', ev => { if (swallow) { swallow = false; ev.stopPropagation(); ev.preventDefault(); } }, true);
  const rowOf = t => t && t.closest && t.closest('.lp-row');
  ls.addEventListener('pointerdown', ev => {
    const r = rowOf(ev.target); if (!r || ev.target.closest('[data-more]') || r.dataset.view || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    clearTimeout(lp && lp.t); lp = {r, x: ev.clientX, y: ev.clientY, id: ev.pointerId, t: setTimeout(() => { r.classList.remove('lp-hold'); swallow = true; lp = null; try { navigator.vibrate && navigator.vibrate(18); } catch (e) { } menuFor(r); }, 450)};
    r.classList.add('lp-hold');
  });
  const lpEnd = () => { if (lp) { clearTimeout(lp.t); lp.r.classList.remove('lp-hold'); lp = null; } };
  ls.addEventListener('pointermove', ev => { if (lp && lp.id === ev.pointerId && Math.hypot(ev.clientX - lp.x, ev.clientY - lp.y) > 8) lpEnd(); });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) ls.addEventListener(t, lpEnd);
  ls.addEventListener('scroll', lpEnd, {passive: true});
  root.addEventListener('contextmenu', ev => { if (!ev.target.closest('input')) ev.preventDefault(); });
  ls.addEventListener('click', ev => {
    const r = rowOf(ev.target); if (!r) return;
    if (ev.target.closest('[data-more]')) { ev.stopPropagation(); return menuFor(r); }
    if (r.dataset.view) return go(r.dataset.view);
    if (r.dataset.fid) return go('folder', r.dataset.fid);
    if (r.dataset.pid) { if (V.view === 'trash') return menuFor(r); return open(r.dataset.pid); }
  });
  root.addEventListener('click', ev => {
    const b = ev.target.closest('[data-lp]'); if (!b || !root.contains(b)) return; const a = b.dataset.lp;
    if (a === 'search') { if (V.q != null) { V.q = null; qIn.value = ''; return render(false); } V.q = ''; render(false).then(() => qIn.focus()); return; }
    if (a === 'sort') { V.sort = V.sort === 'date' ? 'name' : 'date'; try { localStorage.setItem('measure.prjSort', V.sort); } catch (e) { } say('Сортировка: ' + (V.sort === 'name' ? 'по имени' : 'по дате')); return render(false); }
    if (a === 'menu') return mainMenu();
    if (a === 'up' || a === 'top') return go('root');
    if (a === 'new') return newProject();
    if (a === 'newfld') return newFolder();
    if (a === 'undo') return undoLast();
  });
  qIn.addEventListener('input', () => { V.q = qIn.value; render(false); });
  sh.addEventListener('click', ev => { if (ev.target === sh) closeSheet(); });
  dg.addEventListener('click', ev => { if (ev.target === dg) closeDlg(); });

  /* ═══ [BLOCK LP-MENU] ═══ */
  function sheet(title, items) {   // items: {t, ic, fn, red, arm, sel, sub}
    const pn = $p('.lp-pn'); pn.innerHTML = (title ? `<h4>${esc(title)}</h4>` : '') + items.map((it, i) => it.html != null ? it.html : `<button class="lp-mi${it.red ? ' lp-red' : ''}${it.sel ? ' lp-sel' : ''}" data-mi="${i}" data-act="${esc(it.id || '')}"><span class="lp-mx">${it.ic || ''}</span>${esc(it.t)}${it.sub ? '<small>' + esc(it.sub) + '</small>' : ''}</button>`).join('');
    pn.querySelectorAll('[data-mi]').forEach(b => b.onclick = ev => { ev.stopPropagation(); const it = items[+b.dataset.mi];
      if (it.arm && !b.classList.contains('lp-arm')) { b.classList.add('lp-arm'); b.lastChild.textContent = it.arm; setTimeout(() => { if (b.isConnected) { b.classList.remove('lp-arm'); b.lastChild.textContent = it.t; } }, 3000); return; }
      if (!it.keep) closeSheet(); it.fn && it.fn(); });
    sh.classList.add('on'); return pn;
  }
  const closeSheet = () => sh.classList.remove('on');
  function dlg(title, html, buttons) {
    const bx = $p('.lp-bx'); bx.innerHTML = `<h4>${esc(title)}</h4>${html}<div class="lp-bt">${buttons.map((b, i) => `<button data-dg="${i}" class="${b.cls || ''}">${esc(b.t)}</button>`).join('')}</div>`;
    bx.querySelectorAll('[data-dg]').forEach(x => x.onclick = async () => { const b = buttons[+x.dataset.dg]; if (b.fn && await b.fn(bx) === false) return; closeDlg(); });
    bx.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { const pr = bx.querySelector('.lp-pr'); if (pr) pr.click(); } }));
    dg.classList.add('on'); const f = bx.querySelector('input'); if (f) setTimeout(() => f.focus(), 30); return bx;
  }
  const closeDlg = () => dg.classList.remove('on');
  api.closeOverlays = () => { closeSheet(); closeDlg(); };
  const P_ = pid => V.data && V.data.L.find(p => p.id === pid);
  function menuFor(r) {
    if (r.dataset.fid) return folderMenu(r.dataset.fid);
    const P = P_(r.dataset.pid); if (P) projectMenu(P);
  }
  function projectMenu(P) {
    if (P.del) return sheet(ST.label(P), [
      {id: 'restore', t: 'Вернуть', ic: '↺', fn: () => act(ST.restore(P.id), 'Возвращено: ' + ST.label(P))},
      {id: 'purge', t: 'Удалить навсегда…', ic: '✕', red: 1, fn: () => purgeDlg(P)}]);
    return sheet(ST.label(P), [
      {id: 'open', t: 'Открыть', ic: '↗', fn: () => open(P.id)},
      {id: 'rename', t: 'Переименовать', ic: '✎', fn: () => renameDlg(P)},
      {id: 'move', t: 'В папку…', ic: '📁', fn: () => moveMenu(P)},
      P.arch ? {id: 'unarch', t: 'Из архива', ic: '⇡', fn: () => act(ST.archive(P.id, false), 'Из архива: ' + ST.label(P))}
        : {id: 'arch', t: 'В архив', ic: '⇣', fn: () => act(ST.archive(P.id, true), 'В архиве: ' + ST.label(P), {t: 'arch', pid: P.id})},
      {id: 'del', t: 'Удалить', ic: '🗑', red: 1, arm: 'В корзину? Нажмите ещё раз', fn: () => act(ST.trash(P.id), 'В корзине: ' + ST.label(P), {t: 'trash', pid: P.id})}]);
  }
  function folderMenu(fid) {
    const f = V.data.F.find(x => x.id === fid); if (!f) return;
    sheet(f.name, [
      {id: 'open', t: 'Открыть', ic: '↗', fn: () => go('folder', fid)},
      {id: 'rename', t: 'Переименовать', ic: '✎', fn: () => dlg('Папка', `<label>Название</label><input data-f value="${esc(f.name)}">`, [{t: 'Отмена'}, {t: 'Готово', cls: 'lp-pr', fn: async bx => { const n = bx.querySelector('[data-f]').value.trim(); if (!n) return false; await ST.putFolder({...f, name: n}); await render(); }}])},
      {id: 'del', t: 'Удалить папку', ic: '🗑', red: 1, fn: async () => { if (await ST.delFolder(fid)) { say('Папка удалена'); render(); } else say('Папка не пуста — перенесите проекты'); }}]);
  }
  function moveMenu(P) {
    const F = V.data.F.filter(f => !f.parent).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    sheet('В папку: ' + ST.label(P), [
      {id: 'fld:', t: 'Проекты (без папки)', ic: '⌂', sel: !P.folder, fn: () => act(ST.move(P.id, null), 'Проекты: ' + ST.label(P))},
      ...F.map(f => ({id: 'fld:' + f.id, t: f.name, ic: '📁', sel: P.folder === f.id, fn: () => act(ST.move(P.id, f.id), f.name + ': ' + ST.label(P))})),
      {id: 'fld+', t: 'Новая папка', ic: '＋', fn: () => newFolder(f => act(ST.move(P.id, f.id), f.name + ': ' + ST.label(P)))}]);
  }
  function mainMenu() {
    const ver = (window.MeasureLabTitle && MeasureLabTitle.version) || '';
    const pn = sheet('', [
      {id: 'set', t: 'Настройки', ic: '⚙', fn: () => { const s = document.getElementById('set'); if (s) s.classList.add('on'); }},
      {id: 'bak', t: 'Резервная копия', ic: '💾', fn: () => zBackup()},
      {id: 'res', t: 'Восстановить из копии', ic: '♻', fn: () => { const f = document.getElementById('fRes'); if (f) f.click(); }},
      {html: `<div class="lp-ver">Measure ${esc(ver)}</div>`}]);
    void pn;
  }
  let last = null, toT = 0;
  async function act(p, msg, undo) {
    try { await p; } catch (e) { console.error(e); return note('Не выполнено: ' + (e && e.message || e)); }
    await render(); if (!msg) return;
    note(msg, undo);
  }
  function note(msg, undo) {
    const to = $p('.lp-to'); to.querySelector('span').textContent = msg; to.querySelector('button').hidden = !undo; last = undo || null; to.classList.add('on');
    clearTimeout(toT); toT = setTimeout(() => { to.classList.remove('on'); last = null; }, undo ? 6000 : 2500);
  }
  async function undoLast() {
    const u = last; last = null; $p('.lp-to').classList.remove('on'); if (!u) return;
    if (u.t === 'trash') await ST.restore(u.pid); else if (u.t === 'arch') await ST.archive(u.pid, false);
    await render(); note('Возвращено');
  }
  function fields(c, n) { return `<label>Клиент</label><input data-c value="${esc(c || '')}" placeholder="Имя клиента" autocomplete="off"><label>Проект (необязательно)</label><input data-n value="${esc(n || '')}" placeholder="Кухня, квартира, адрес…" autocomplete="off">`; }
  const val = (bx, q) => bx.querySelector(q).value.trim();
  function newProject() {
    dlg('Новый проект', fields('', ''), [{t: 'Отмена'}, {t: 'Создать', cls: 'lp-pr', fn: async bx => { const c = val(bx, '[data-c]'), n = val(bx, '[data-n]'); if (!c && !n) { bx.querySelector('[data-c]').focus(); say('Введите клиента'); return false; }
      const P = await ST.create({client: c, name: n, folder: V.view === 'folder' ? V.fid : null}); closeDlg(); await open(P.id); }}]);
  }
  api.newProject = newProject;
  function renameDlg(P) {
    dlg('Переименовать', fields(P.client, P.name), [{t: 'Отмена'}, {t: 'Готово', cls: 'lp-pr', fn: async bx => { const c = val(bx, '[data-c]'), n = val(bx, '[data-n]'); if (!c && !n) return false; await ST.rename(P.id, c, n); await render(); titleUpd(); }}]);
  }
  function newFolder(then) {
    dlg('Новая папка', '<label>Название</label><input data-f placeholder="Отработанное, 2026…" autocomplete="off">', [{t: 'Отмена'}, {t: 'Создать', cls: 'lp-pr', fn: async bx => { const n = val(bx, '[data-f]'); if (!n) return false; const f = await ST.putFolder({name: n}); await render(); if (then) then(f); }}]);
  }
  async function purgeDlg(P) {
    const n = await ST.photoCount(P.id);
    dlg('Удалить навсегда', `<p>«${esc(ST.label(P))}» — замеры, стены, холст и фото (${n}). Вернуть будет нельзя.</p>`, [{t: 'Отмена'}, {t: 'Удалить навсегда', cls: 'lp-dn', fn: () => act(ST.purge(P.id), 'Удалено навсегда: ' + ST.label(P))}]);
  }

  /* ═══ [BLOCK LP-OPEN] ═══ */
  const SK = () => window.MeasureLabSketch;
  const v8218 = () => { const B = SK(); return !!(B && typeof B.migrateCanvas === 'function'); };   // холст 82.18 (инженер B): open(pid)
  async function open(pid) {
    const P = await ST.get(pid); if (!P || P.del) { say('Проект не найден'); return false; }
    const B = SK();
    try { localStorage.setItem('measure.lastPrj', pid); } catch (e) { }
    V.cur = pid;
    if (B && B.isOpen && B.isOpen() && typeof B.pid === 'function' && B.pid() === pid) { hide(); titleUpd(); return true; }   // тот же проект — мгновенно
    hide();
    try {
      if (B && v8218()) await B.open(pid);
      else if (B && typeof B.open === 'function') await B.open(P.obj);   // холст 82.17 — по строке obj, до прихода модуля B
      else { const R = await ST.records(pid), r = R && R.rooms.find(x => !x.del && !x.pstub); if (r) await openRoom(r.id); }
    } catch (e) { console.error('Measure 82.18 open project', e); say('Проект не открыт: ' + (e && e.message || e)); show(); return false; }
    titleUpd(); return true;
  }
  api.open = open;
  api.current = () => V.cur;
  function show() {
    try { flushAll(); } catch (e) { }   // запись — без ожидания: холст под списком остаётся открытым
    closeSheet(); closeDlg();
    if (!V.on) { V.on = true; if (V.view !== 'folder' || !V.data || !V.data.F.some(f => f.id === V.fid)) { if (V.view === 'folder') V.view = 'root'; } }
    root.classList.add('on'); document.body.classList.add('lab-prj-on');
    vis(true);
    return render();
  }
  // признак «список открыт» для модулей поверх холста (панель зон lab-v012 и др.): штатный #ss.on (сам #ss скрыт CSS),
  // body.lab-prj-on и событие window 'measure-lab-projects' {on}
  function vis(on) { try { $('ss').classList.toggle('on', on); } catch (e) { } try { dispatchEvent(new CustomEvent('measure-lab-projects', {detail: {on}})); } catch (e) { } try { draw(); } catch (e) { } }
  function hide() { const was = V.on || root.classList.contains('on'); V.on = false; closeSheet(); closeDlg(); root.classList.remove('on'); document.body.classList.remove('lab-prj-on'); $p('.lp-to').classList.remove('on'); if (was || $('ss').classList.contains('on')) vis(false); }
  // системная «назад» при открытом списке (вызывает window.AkrixBack холста): окно ввода → лист → поиск → папка/архив/корзина → true;
  // на верхнем уровне — false (оболочка: выбор версии, как прежде). Синхронно.
  function back() {
    if (!V.on) return false;
    if (dg.classList.contains('on')) { closeDlg(); return true; }
    if (sh.classList.contains('on')) { closeSheet(); return true; }
    if (V.q != null) { V.q = null; qIn.value = ''; render(false); return true; }
    if (V.view !== 'root') { go('root'); return true; }
    return false;
  }
  Object.assign(api, {show, hide, back, isOpen: () => V.on, root});

  /* ═══ [BLOCK LP-WRAP] ═══ */
  const list81 = sessList;
  sessList = async function (on) { if (on === false) return hide(); return show(); };
  PM.sessList = (...a) => sessList(...a);
  api.list81 = list81;   // штатный список v81 — только для отладки
  const last81 = lastOpen;
  lastOpen = async function () {
    await ST.migrate();
    let pid = null; try { pid = (JSON.parse(localStorage.getItem('measure.lab.canvas') || 'null') || {}).pid || localStorage.getItem('measure.lastPrj'); } catch (e) { }   // последний открытый холст (запись инженера B), иначе — свой ключ
    let P = pid && await ST.get(pid); if (!P || P.del || P.arch) { try { pid = localStorage.getItem('measure.lastPrj'); } catch (e) { } P = pid && await ST.get(pid); }
    if (P && !P.del && !P.arch) return open(pid);
    return false;   // иначе — список (штатный старт вызывает sessList(true))
  };
  PM.lastOpen = () => lastOpen();
  api.last81 = last81;

  /* ═══ [BLOCK LP-TITLE] ═══ */
  const top = document.getElementById('top'), hd = document.getElementById('hdIn');
  const tb = document.createElement('div'); tb.id = 'labPrjT'; tb.setAttribute('role', 'button'); tb.tabIndex = 0; tb.title = 'Проект: переименовать, в папку, перенос';
  if (top && hd) hd.before(tb);
  async function titleUpd() {
    const B = SK(); let pid = (B && typeof B.pid === 'function' && B.pid()) || V.cur;
    const on = !!(B && B.isOpen && B.isOpen());
    if (on && !pid) { const P = await ST.current(); pid = P && P.id; }
    const P = pid && await ST.get(pid);
    tb.textContent = P ? ST.label(P) : '';
    document.body.classList.toggle('lab-prj-t', !!(on && P));
  }
  api.titleUpd = titleUpd;
  tb.onclick = async () => {
    const B = SK(), pid = (B && typeof B.pid === 'function' && B.pid()) || V.cur, P = pid && await ST.get(pid); if (!P) return;
    await load(); root.classList.add('on'); document.body.classList.add('lab-prj-on'); V.on = true;   // меню проекта — поверх холста
    const back = () => { if (!sh.classList.contains('on') && !dg.classList.contains('on')) hide(); };
    const pn = sheet(ST.label(P), [
      ...(await roomItems(P)),   // r2c Н6: помещения проекта — явный выбор текущего на плане (LP-ROOMS)
      {id: 'rename', t: 'Переименовать', ic: '✎', fn: () => renameDlg(P)},
      {id: 'move', t: 'В папку…', ic: '📁', fn: () => moveMenu(P)},
      {id: 'exp', t: 'Перенос холста: сохранить', ic: '⇪', fn: () => { const S2 = SK(); if (S2 && S2.cmd) S2.cmd('exp'); }},
      {id: 'imp', t: 'Перенос холста: загрузить', ic: '⇩', fn: () => { const S2 = SK(); if (S2 && S2.cmd) S2.cmd('imp'); }},
      {id: 'list', t: 'Все проекты', ic: '☰', fn: () => show()}]);
    void pn; ls.innerHTML = '';
    const mo = new MutationObserver(() => { if (!sh.classList.contains('on') && !dg.classList.contains('on')) { mo.disconnect(); setTimeout(back, 0); } });
    mo.observe(sh, {attributes: true}); mo.observe(dg, {attributes: true});
  };
  /* 82.18 fix (аудит m9): заголовок — не на каждое изменение класса body (lab-tb/lab-prd/lab-v012 меняют их при отрисовке, titleUpd читает IndexedDB),
     а только при смене «холст открыт» / «список открыт» и при переходе холста (measure-lab-activate); подряд идущие — одним вызовом. */
  let tuR = 0, tuK = '';
  const titleSoon = () => { if (tuR) return; tuR = 1; queueMicrotask(() => { tuR = 0; titleUpd(); }); };
  new MutationObserver(() => { const b = document.body.classList, k = (b.contains('lab-sketch') ? 1 : 0) + ',' + (b.contains('lab-prj-on') ? 1 : 0); if (k !== tuK) { tuK = k; titleSoon(); } }).observe(document.body, {attributes: true, attributeFilter: ['class']});
  addEventListener('measure-lab-activate', titleSoon);
  addEventListener('measure-lab-project', e => { const d = e.detail || {}; if (d.pid && d.pid === V.cur) titleUpd(); if (d.op === 'purge' && d.pid === V.cur) V.cur = null; });

  /* ═══ [BLOCK LP-ROOMS] AKX-2026-0012 r2c Н6: шапка проекта → «⌂ помещение» (и пустое) — текущее помещение плана (MeasureLabStore.pickRoom).
     Штатно v81 помещение меняется касанием стены другого помещения; пустое помещение так не выбрать — отсюда. Одно помещение — пунктов нет. ═══ */
  async function roomItems(P) {
    if (!ST.records || !ST.pickRoom) return [];
    const R = await ST.records(P.id), rooms = R ? R.rooms.filter(r => !r.del && !r.pstub).sort((a, b) => (a.created || 0) - (b.created || 0)) : [];
    if (rooms.length < 2) return [];
    const cur = S.mode === 'plan' && S.room ? S.room.id : ST.curRoom(P.id);
    return rooms.map(r => { const n = (r.ms && r.ms.pts || []).length; return {id: 'room:' + r.id, t: (r.name || 'Помещение') + (n < 2 ? ' · пусто' : ''), ic: '⌂', sel: r.id === cur, sub: r.id === cur ? 'текущее на плане' : '', fn: () => ST.pickRoom(P.id, r.id)}; });
  }

  /* ═══ [BLOCK LP-ASK] AKX-2026-0012 Д9: вопрос окном списка (и поверх холста) → Promise со значением кнопки; касание фона / «назад» — null ═══ */
  api.ask = (title, text, buttons) => new Promise(res => {
    const was = V.on; let done = false;
    if (!was) { root.classList.add('on'); document.body.classList.add('lab-prj-on'); V.on = true; ls.innerHTML = ''; }
    const fin = v => { if (done) return; done = true; mo.disconnect(); if (!was) hide(); res(v); };
    dlg(title, `<p>${esc(text)}</p>`, buttons.map(b => ({t: b.t, cls: b.pr ? 'lp-pr' : '', fn: () => { fin(b.v); }})));
    const mo = new MutationObserver(() => { if (!dg.classList.contains('on')) setTimeout(() => fin(null), 0); });
    mo.observe(dg, {attributes: true, attributeFilter: ['class']});
  });

  /* ═══ [BLOCK LP-EXIT] AKX-2026-0012 Д10 (решение владельца): системная «назад» — всегда двойное нажатие для выхода.
     В корне списка проектов первое нажатие — тост «Ещё раз — выход» и true; второе за 2 с — false (оболочка: прежнее поведение). ═══ */
  const EX = {t: 0};
  const back0 = window.AkrixBack;
  window.AkrixBack = function () {
    if (!V.on) { EX.t = 0; return typeof back0 === 'function' ? back0.apply(this, arguments) : false; }
    let r = false; try { r = back(); } catch (e) { console.error('AkrixBack', e); }   // окно → лист → поиск → папка (и без открытого холста)
    if (r === true) { EX.t = 0; return true; }
    const t = Date.now(); if (EX.t && t - EX.t <= 2000) { EX.t = 0; return false; }
    EX.t = t; note('Ещё раз — выход'); return true;
  };
  api.exitArmed = () => !!EX.t && Date.now() - EX.t <= 2000;

  // старт: если штатный старт успел показать #ss или открыть помещение до загрузки модуля — взять под список / холст
  setTimeout(async () => {
    try {
      if ($('ss').classList.contains('on') && !V.on) show();
      else if (!V.on && !(SK() && SK().isOpen && SK().isOpen()) && (S.room || S.sess) && !/[?&]nolist/.test(location.search)) { await ST.migrate(); const P = await ST.current(); if (P) open(P.id); }
    } catch (e) { }
  }, 0);
})();
