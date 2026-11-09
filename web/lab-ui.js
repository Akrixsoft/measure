/* Measure Lab UI extension. Depends on the unchanged v81 classic script. */
(() => {
  'use strict';
  if (!window.PM || window.MeasureLabUI) return;
  const byId = id => document.getElementById(id);
  const escape = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEFAULTS = {textPx:13,fieldPx:22,linePx:2.2,arrowPx:9,pointPx:5,sideElements:true,persistTool:true,grid:true,snap:true};
  let stored={}; try { stored=JSON.parse(localStorage.getItem('measure.lab.settings')||'{}')||{} } catch (_) {}
  const cfg=Object.assign({},DEFAULTS,stored);
  for (const [k,min,max] of [['textPx',6,28],['fieldPx',10,64],['linePx',.5,8],['arrowPx',4,20],['pointPx',2,12]]) cfg[k]=Math.max(min,Math.min(max,Number(cfg[k])||DEFAULTS[k]));
  for (const k of ['sideElements','persistTool','grid','snap']) cfg[k]=cfg[k]!==false;
  window.MeasureLabSettings={current:cfg,defaults:DEFAULTS};
  // Aa is a wall annotation scale, independent of zoom, icons and world data.
  const appearance=window.MeasureLabAppearance={
    scale(){return S.mode==='plan'?1:Math.max(.3,Math.min(1.6,Number(W3.f)||1));},
    textPx(){return Math.max(6,cfg.textPx*this.scale());},
    fieldPx(){return Math.max(10,cfg.fieldPx*this.scale(),this.textPx()+2);},
    strokeFactor(){return this.scale()*(cfg.linePx/2.2)*lwK();}
  };
  PM.labAppearance=appearance;
  const modal=document.createElement('div'); modal.id='labModal'; modal.hidden=true; document.body.appendChild(modal);
  let tab='appearance', legacyParent=null, legacyNext=null;
  function settingsSave() { try { localStorage.setItem('measure.lab.settings',JSON.stringify(cfg)) } catch (_) {} }
  function applySettings() {
    document.documentElement.style.setProperty('--lab-text-px',cfg.textPx+'px');
    document.documentElement.style.setProperty('--lab-field-px',cfg.fieldPx+'px');
    try { WS.mag=cfg.snap?1:0; zo('dim').sn=cfg.snap?1:0; zo('arr').sn=cfg.snap?1:0; wsSave(); } catch (_) {}
    settingsSave(); window.dispatchEvent(new CustomEvent('measure-lab-settings',{detail:cfg}));
    try { draw(); } catch (e) { console.warn('Measure Lab redraw:',e.message) }
  }
  /* Only the measurement canvas is affected. measureText and fillText use the
     same effective font, so labels and hit rectangles agree after a size change. */
  const context=byId('cv').getContext('2d'), fontDescriptor=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'font');
  if (fontDescriptor && fontDescriptor.get && fontDescriptor.set) {
    Object.defineProperty(context,'font',{configurable:true,get(){return fontDescriptor.get.call(this)},set(value){
      const effective=String(value).replace(/(?:\d*\.)?\d+px/, (appearance.textPx()*(window.devicePixelRatio||1))+'px');
      fontDescriptor.set.call(this,effective);
    }});
  }
  const originalGDraw=gDraw; gDraw=function(){if(cfg.grid)return originalGDraw.apply(this,arguments)};
  const originalZLW=zLW;
  zLW=function(w){return originalZLW(w)*(cfg.linePx/2.2)};
  PM.zLW=(...a)=>zLW(...a);
  function closeModal(){
    const legacy=byId('set'); if(legacyParent && legacy){legacy.classList.remove('on');legacyParent.insertBefore(legacy,legacyNext&&legacyNext.parentNode===legacyParent?legacyNext:null)}
    legacyParent=legacyNext=null;modal.hidden=true;modal.innerHTML='';document.body.classList.remove('lab-dialog-open');
  }
  function showModal(title,body,footer=''){
    closeModal(); modal.innerHTML=`<section class="lab-dialog" role="dialog" aria-modal="true" aria-label="${escape(title)}"><header class="lab-head"><b>${escape(title)}</b><button class="lab-close" data-lab="close" aria-label="Закрыть">✕</button></header>${body}<footer class="lab-foot">${footer||'<button class="lab-primary" data-lab="close">Готово</button>'}</footer></section>`;
    modal.hidden=false;document.body.classList.add('lab-dialog-open');
  }
  function sample(){const el=byId('labSample');if(!el)return;let h=Math.max(cfg.fieldPx,cfg.textPx+2),w=Math.max(cfg.fieldPx,3.5*cfg.textPx+12);el.innerHTML=`<path d="M42 40H438V94H42Z" fill="#fff" stroke="#8997a7" stroke-width="${cfg.linePx}"/><path d="M66 70H410M66 70l${cfg.arrowPx} -${cfg.arrowPx/3}M66 70l${cfg.arrowPx} ${cfg.arrowPx/3}M410 70l-${cfg.arrowPx} -${cfg.arrowPx/3}M410 70l-${cfg.arrowPx} ${cfg.arrowPx/3}" fill="none" stroke="#1f6fd1" stroke-width="${cfg.linePx}"/><rect x="${240-w/2}" y="${70-h/2}" width="${w}" height="${h}" rx="3" fill="white" stroke="#8597ad"/><text x="240" y="70" fill="#213e62" text-anchor="middle" dominant-baseline="middle" font-family="system-ui" font-size="${cfg.textPx}">2400</text><circle cx="42" cy="40" r="${cfg.pointPx}" fill="white" stroke="#1f6fd1"/>`}
  const numberRow=(k,label,min,max,step)=>`<div class="lab-row"><label for="lab-${k}">${label}</label><input id="lab-${k}" type="range" min="${min}" max="${max}" step="${step}" data-lab-setting="${k}" value="${cfg[k]}"><input aria-label="${label}, пиксели" type="number" min="${min}" max="${max}" step="${step}" data-lab-setting="${k}" value="${cfg[k]}"><small>px</small></div>`;
  const toggleRow=(k,label,note='')=>`<div class="lab-row"><label for="lab-${k}">${label}${note?`<small>${note}</small>`:''}</label><input id="lab-${k}" type="checkbox" data-lab-setting="${k}" ${cfg[k]?'checked':''}></div>`;
  function settings(){
    const rows=tab==='appearance'?numberRow('linePx','Толщина линий',.5,8,.5)+numberRow('textPx','Размер текста',6,28,1)+numberRow('fieldPx','Размер полей',10,64,1)+numberRow('arrowPx','Наконечники стрелок',4,20,1)+numberRow('pointPx','Точки привязки',2,12,1):tab==='canvas'?toggleRow('sideElements','Элементы на боковых стенах','Коммуникации и проёмы, без размерных подписей')+toggleRow('grid','Сетка 3×3 в плоском виде','Не скрывает геометрию и грани стен')+toggleRow('snap','Привязка','К узлам, стенам и размерным точкам'):toggleRow('persistTool','Повторять рисование линий и пометок','Объекты стены: поставить → снять выделение → поставить следующий');
    showModal('Настройки Measure Lab',`<nav class="lab-tabs">${[['appearance','Вид и размеры'],['canvas','Холст'],['tools','Инструменты']].map(([k,n])=>`<button data-lab-tab="${k}" class="${tab===k?'on':''}">${n}</button>`).join('')}</nav><div class="lab-body"><div class="lab-preview"><small>Живой пример · значения в px экрана</small><svg id="labSample" viewBox="0 0 480 112" aria-label="Пример размерной линии"></svg></div>${rows}<p class="lab-note">Настройки сохраняются только для тестовой версии. Чтобы текст помещался, высота поля на холсте не меньше высоты текста плюс 2 px.</p><details><summary>Фото, дальномер, AI и прежние настройки v81</summary><div id="labLegacy"></div></details></div>`,`<button data-lab="reset" style="margin-right:auto">Сбросить новые настройки</button><button class="lab-primary" data-lab="close">Готово</button>`);
    const legacy=byId('set');if(legacy){legacyParent=legacy.parentNode;legacyNext=legacy.nextSibling;legacy.classList.remove('on');byId('labLegacy').appendChild(legacy)}sample();
  }
  function currentRoom(){return S.mode==='plan'?S.room:S.room0}
  function roomLabel(r){return r.name||'Без названия'}
  async function roomList(){
    try { await flushAll(); } catch (e) { toast('Не удалось сохранить текущий замер: '+e.message);return }
    const base=currentRoom(),all=(await dbAll('sess')).filter(r=>r.kind==='room'&&!r.del&&!r.pstub),group=base?(base.obj?all.filter(r=>r.obj===base.obj):all.filter(r=>r.id===base.id)):all;
    showModal('Помещения и открытые группы стен',`<div class="lab-body"><p class="lab-note">Помещение не обязано замыкаться. Обозначай только нужные стены; открытые проходы, арки и выходы не нужно закрывать фиктивной стеной.</p><div class="lab-list">${group.map(r=>`<div class="lab-room ${base&&r.id===base.id?'on':''}"><div><b>${escape(roomLabel(r))}</b><small>${plN(r.ms)} стен · ${r.ms.closed?'замкнутый контур':'открытое помещение'}</small></div><button data-lab-room-open="${escape(r.id)}">Открыть</button><button data-lab-room-rename="${escape(r.id)}" title="Переименовать помещение">✎</button></div>`).join('')||'<p class="lab-note">Пока нет помещений.</p>'}</div><label for="labNewRoom">Новое помещение / группа стен</label><input class="lab-input" id="labNewRoom" placeholder="Название необязательно"><div class="lab-actions"><button class="lab-primary" data-lab="create-room">＋ Добавить в объект</button><button data-lab="new-plane">＋ Отдельная плоскость</button></div></div>`);
  }
  async function createRoom(){
    const name=byId('labNewRoom').value.trim(),base=currentRoom();let obj=base?base.obj:S.sess?S.sess.obj:'';
    if(base&&!obj){obj='Объект '+new Date().toLocaleDateString('ru-RU')+' '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});base.obj=obj;await dbPut('sess',JSON.parse(JSON.stringify(base)))}
    await flushAll();closeModal();await newRoom(obj,name);if(!name&&S.room){S.room.name='';saveRoom()}plPick('st');toast('Открытое помещение: построй только нужные стены');
  }
  async function renameRoom(id){
    const r=await dbGet('sess',id);if(!r)return;
    showModal('Название помещения',`<div class="lab-body"><label for="labRename">Название / назначение</label><input class="lab-input" id="labRename" value="${escape(r.name)}" placeholder="Можно оставить пустым"><p class="lab-note">Название не зависит от замкнутости контура.</p></div>`,`<button data-lab="rooms">Отмена</button><button class="lab-primary" data-lab="rename-save" data-room="${escape(id)}">Сохранить</button>`);
    setTimeout(()=>byId('labRename')?.focus(),10);
  }
  async function versionChooser(){
    try { await flushAll();lastPut(); } catch(e) {toast('Не удалось сохранить замер: '+e.message);return}
    if(window.AkrixLab&&typeof AkrixLab.chooseVersion==='function'){AkrixLab.chooseVersion();return}
    toast('Экран выбора версий доступен в APK Measure Lab');
  }
  function layout(){
    const zf=byId('zf'),opt=byId('zopt'),zb=byId('zb'),ch=byId('ch');if(!zf||!opt||!zb||!ch)return;
    if(opt.parentNode!==zf||opt.nextElementSibling!==zb)zf.insertBefore(opt,zb);
    zf.classList.toggle('lab-tool-row',(S.mode==='plan'&&zCur()==='plan')||(S.mode!=='plan'&&S.tool==='mk'));
  }
  const oldLay=zLay; zLay=function(){const out=oldLay.apply(this,arguments);layout();return out};PM.zLay=(...a)=>zLay(...a);
  const oldChips=mkChips;mkChips=function(){const out=oldChips.apply(this,arguments);layout();return out};PM.mkChips=(...a)=>mkChips(...a);
  const planRepeat=new Set(['st','wp','rm','op','shp','nch','prt','ceil','ppen','parr','pln','ptxt']);
  function completionMark(){const m=S.room&&S.room.ms;return JSON.stringify([m&&m.pts.length,m&&m.closed,m&&(m.shp||[]).length,m&&(m.rt||[]).length,m&&m.ceil,S.els.length,S.dms.length,S.drw.length,S.rts.length,S.polys.length,S.lines])}
  function keepPlan(fn){return function(){const before=PL.tool,mark=completionMark();const restore=()=>{if(S.mode!=='plan'||!planRepeat.has(before))return;if(cfg.persistTool&&PL.tool==='sel'){PL.tool=before;mkChips();mkPanel();draw()}else if(!cfg.persistTool&&PL.tool===before&&completionMark()!==mark){PL.tool='sel';S.zpp=[];mkChips();mkPanel();draw()}};const out=fn.apply(this,arguments);if(out&&typeof out.then==='function')return out.then(v=>{restore();return v});restore();return out}}
  zpDone=keepPlan(zpDone);zpTap=keepPlan(zpTap);nchTap=keepPlan(nchTap);ulTapSel=keepPlan(ulTapSel);
  const oldMkTap=mkTap;mkTap=function(){const before=S.mk,mark=completionMark(),result=oldMkTap.apply(this,arguments);if(!cfg.persistTool&&!(KD[before]&&!KD[before].line)&&before!=='sel'&&before!=='rsel'&&S.mk===before&&completionMark()!==mark){S.mk='sel';mkChips();mkPanel();draw()}return result};
  const oldPlSnap=plSnapPt;plSnapPt=function(q,p){return WS.mag?oldPlSnap(q,p):q};
  byId('bSet').onclick=()=>{byId('zMenu').classList.remove('on');settings()};
  const menu=byId('zMenu');for(const [id,label,fn] of [['bLabRooms','⌂ Помещения / группы стен',roomList],['bLabVersions','⇄ Выбрать версию приложения',versionChooser]]){const b=document.createElement('button');b.id=id;b.textContent=label;b.onclick=()=>{menu.classList.remove('on');Promise.resolve(fn()).catch(e=>toast('Ошибка: '+e.message))};menu.appendChild(b)}
  const hint=document.createElement('p');hint.className='lab-room-help';hint.textContent='Помещение может быть открытым: построй только нужные стены. Несколько помещений одного объекта — через ⋮ → Помещения / группы стен.';byId('ss').querySelector('.nw').after(hint);
  modal.addEventListener('click',async e=>{const target=e.target.closest('button');if(e.target===modal){closeModal();return}if(!target)return;
    try {if(target.dataset.labTab){tab=target.dataset.labTab;settings();return}if(target.dataset.labRoomOpen){await flushAll();await openRoom(target.dataset.labRoomOpen);closeModal();return}if(target.dataset.labRoomRename){await renameRoom(target.dataset.labRoomRename);return}
      const action=target.dataset.lab;if(action==='close')closeModal();if(action==='reset'){Object.assign(cfg,DEFAULTS);applySettings();settings()}if(action==='rooms')await roomList();if(action==='create-room')await createRoom();if(action==='new-plane'){const base=currentRoom(),name=byId('labNewRoom').value.trim();await flushAll();closeModal();await newSess(base?base.obj:'',name)}if(action==='rename-save'){const r=await dbGet('sess',target.dataset.room),name=byId('labRename').value.trim();if(r){if(S.room&&S.room.id===r.id){plSnap();S.room.name=name;saveRoom()}else{r.name=name;r.upd=Date.now();await dbPut('sess',r);if(S.room0&&S.room0.id===r.id)S.room0.name=name;const o=S.objRooms.find(o=>o.id===r.id);if(o)o.name=name}await flushAll();mkPanel();draw()}await roomList()}
    } catch(e){toast('Ошибка: '+e.message);console.error(e)}
  });
  modal.addEventListener('input',e=>{const k=e.target.dataset.labSetting;if(!k)return;const el=e.target;if(el.type==='checkbox')cfg[k]=el.checked;else{const value=Number(el.value);if(!Number.isFinite(value))return;cfg[k]=Math.max(Number(el.min),Math.min(Number(el.max),value))}modal.querySelectorAll('[data-lab-setting="'+k+'"]').forEach(other=>{if(other!==el){if(other.type==='checkbox')other.checked=cfg[k];else other.value=cfg[k]}});applySettings();sample()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden){e.preventDefault();closeModal()}});
  // Native per-tool magnets are authoritative; keep the saved general preference in sync.
  document.addEventListener('click',event=>{const magnet=event.target.closest('[data-zo="sn"],[data-pm="m"]');if(!magnet)return;cfg.snap=magnet.dataset.zo?!!zo(S.mk).sn:!!WS.mag;settingsSave();});
  window.MeasureLabUI={settings,rooms:roomList,close:closeModal,apply:applySettings,versionChooser,layout};
  applySettings();layout();
})();
