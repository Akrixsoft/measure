// AKX-2026-0015 Б6 — холст: помещения, план помещений, заметка, перенос, проекты, лазер. Запуск: node tests/qa-b6-0015.cjs <фото> <скриншоты>
const path = require('path');
require('./qa-h-0015.cjs')(process.argv[3], 9356).then(async h => {
  const {p, ok, W, tap, drag, path: pth, M, btn, key, ctxBtn, doc, scr, shot, tool, addPhotos, finish} = h;
  const top = await M('document.getElementById("cCv").getBoundingClientRect().top');
  await addPhotos([path.join(process.argv[2], 'p1.jpg')]);
  await btn('#mdT [data-md=plan]'); await M('MeasureCore.view.ox=40;MeasureCore.view.oy=60;MeasureCore.view.s=0.1'); await tool('ct');
  // план левее фото: фото справа, контур слева
  await M('(()=>{const p=MeasureCore.doc.photos[0];p.x=3500;p.y=0;})()');
  for (const [x, y] of [[40, 200], [300, 200], [300, 400], [40, 400], [40, 200]]) await tap(x, y);
  let d = await doc(); ok('контур 4 стены', d.walls.length === 4);
  // помещение скетчем: граница внутри, ~25 px (≈250 мм) от стен
  await tool('room'); ok('инструмент «Новое помещение»', (await M('MeasureCore.tool')) === 'room');
  await pth([[65, 225], [275, 225], [275, 375], [65, 375], [66, 228]].flatMap((q, i, A) => i ? [...Array(6)].map((_, k) => [A[i - 1][0] + (q[0] - A[i - 1][0]) * (k + 1) / 6, A[i - 1][1] + (q[1] - A[i - 1][1]) * (k + 1) / 6]) : [q]));
  d = await doc(); ok('помещение: 4 ближайшие стены', d.rooms.length === 1 && d.rooms[0].walls.length === 4, d.rooms[0] && d.rooms[0].walls.length);
  // имя касанием
  const hitAt = async t => M(`(()=>{for(let y=0;y<760;y+=3)for(let x=0;x<412;x+=3){const h=MeasureCore.hit(x,y);if(h&&h.t==='${t}')return [x,y+${top}]}return null})()`);
  let s = await hitAt('rname'); ok('подпись помещения', !!s); await tap(s[0], s[1]); await p.keyboard.press('Control+A'); await p.keyboard.type('Кухня'); await btn('#cTxOk');
  d = await doc(); ok('имя — касанием: «Кухня»', d.rooms[0].name === 'Кухня', d.rooms[0].name);
  s = await hitAt('rh'); await tap(s[0], s[1]); await key('2650ok'); d = await doc(); ok('H — касанием: 2650', d.rooms[0].H === 2650);
  // радиус
  const rb = await ctxBtn('R — радиус'); ok('кнопка R', !!rb); await tap(rb[0], rb[1]); await key('100ok'); d = await doc(); ok('R 100 — дальние стены не цепляются', d.rooms[0].walls.length === 0, d.rooms[0].walls.length);
  await tap(rb[0], rb[1]); await key('600ok'); d = await doc(); ok('R 600 — снова 4', d.rooms[0].walls.length === 4);
  await shot('room');
  // план помещений
  await btn('#zpF'); await W(150); await btn('#tb .tl[data-k=plan]'); ok('лист «План помещений»', await M('document.getElementById("rmList").classList.contains("on")'));
  await btn('#rmList [data-r]'); ok('строка → выбрано помещение', (await M('MeasureCore.sel && MeasureCore.sel.t')) === 'room');
  // заметка
  await btn('#mdT [data-md=wall]'); await tool('note'); await tap(330, 600); await p.keyboard.type('замер 12.11'); await btn('#cTxOk');
  d = await doc(); const nt = d.drw.find(q => q.k === 'note'); ok('заметка на холсте', nt && nt.tx === 'замер 12.11');
  // перенос: сохранить / загрузить
  const txt = await M('MeasureCore.exportPrj()'); const o = JSON.parse(txt);
  ok('перенос: документ и картинки', o.format === 'akrix-core-canvas' && o.doc.rooms.length === 1 && Object.keys(o.imgs).length === 1);
  const id0 = d.id; await M(`MeasureCore.importPrj(${JSON.stringify(txt)})`); await W(400); d = await doc();
  ok('загрузка — новый проект, то же содержимое', d.id !== id0 && d.walls.length === 4 && d.rooms[0].name === 'Кухня' && d.photos.length === 1);
  ok('2 проекта в базе', (await M('MeasureCore.allPrj()')).length === 2);
  // 📁 проекты
  await M(`(()=>{const e=document.getElementById('labPrjT');e.value='Копия';e.onchange({target:e})})()`); await btn('#bSes'); ok('лист «Проекты»', await M('document.getElementById("pjList").classList.contains("on")'));
  const rows = await M('[...document.querySelectorAll("#pjList [data-o]")].map(b=>b.textContent)'); ok('строки проектов', rows.length === 2, rows);
  await M(`(()=>{const b=[...document.querySelectorAll('#pjList [data-o]')].find(b=>b.dataset.o==='${id0}');b.scrollIntoView();})()`);
  { const b = await M(`(()=>{const r=document.querySelector('#pjList [data-o="${id0}"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); await tap(b[0], b[1]); }
  d = await doc(); ok('открыт первый проект', d.id === id0);
  await btn('#bSes'); await btn('#pjList [data-new]'); d = await doc(); ok('новый проект пустой', d.walls.length === 0 && d.photos.length === 0);
  await btn('#bSes'); const other = await M(`[...document.querySelectorAll('#pjList [data-m]')].map(b=>b.dataset.m).find(id=>id!=='${d.id}'&&id!=='${id0}')`);
  await btn(`#pjList [data-m="${other}"]`); await btn('#pjList .pjm [data-i="1"]'); ok('⋯ → Удалить: в корзине', (await M(`MeasureCore.allPrj()`)).find(r => r.id === other).trash === 1);
  await btn('#pjList [data-sec=trash]'); await btn(`#pjList [data-m="${other}"]`); await btn('#pjList .pjm [data-i="0"]'); ok('Корзина → Восстановить', !(await M(`MeasureCore.allPrj()`)).find(r => r.id === other).trash);
  await btn('#pjList [data-x]');
  // лазер: мост APK — заглушка AkrixBT
  await M('window.__bt=[];window.AkrixBT={connect:()=>__bt.push("c"),measure:()=>__bt.push("m"),disconnect:()=>__bt.push("d")}');
  await btn('#bSes'); { const b = await M(`(()=>{const r=document.querySelector('#pjList [data-o="${id0}"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`); await tap(b[0], b[1]); }
  await btn('#bBtH'); ok('лазер: подключение', (await M('__bt.join()')) === 'c'); await M('akrixBtState("on","GLM 50 C")'); ok('лазер подключён — значок', await M('document.getElementById("bBtH").classList.contains("bt-on")'));
  await btn('#bBtH'); ok('лазер: замер по кнопке', (await M('__bt.join()')) === 'c,m');
  await btn('#mdT [data-md=plan]'); await M('MeasureCore.fitAll()'); await W(150); const lb = (await M('MeasureCore.labels()'))[0]; await tap(lb.x + lb.w / 2, lb.y + lb.h / 2 + top);
  ok('открыт ввод длины', (await M('MeasureCore.kb && MeasureCore.kb.t')) === 'wall');
  await M(`(()=>{const b=new DataView(new ArrayBuffer(11));b.setUint8(0,0xC0);b.setUint8(1,0x55);b.setUint8(2,0x10);b.setFloat32(7,2.345,true);akrixBtPkt([...new Uint8Array(b.buffer)].map(x=>x.toString(16).padStart(2,'0')).join(' '))})()`);
  d = await doc(); const w = d.walls.find(x => x.id === lb.id), A = d.nodes.find(n => n.id === w.a), B = d.nodes.find(n => n.id === w.b);
  ok('замер лазера → длина стены 2345', Math.abs(Math.hypot(B.x - A.x, B.y - A.y) - 2345) < 1);
  await finish();
});
