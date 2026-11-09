/* RZ-only communications toolbar; native object placement and arrow gestures retained. */
(() => {
  'use strict';
  const orderKey='measure.lab.rz.order', colorKey='measure.lab.rz.color';
  // Match v81's complete communications group. The additional entries are deliberately
  // native rectangle/polyline tools, not point communications or RZ arrows.
  const all=[...KINDS.filter(k=>k.pt&&!k.hide).map(k=>k.k),'znd','wrt','zon','shield'];
  const commName=k=>k==='wrt'?'Трасса коммуникаций':kN(k);
  const commHint=k=>k==='wrt'?'Трасса коммуникаций: проведите линию; тяните крайние точки или середину для правки':k==='znd'?'Не сверлить: касание — поставить зону; выбранную зону можно перемещать':rzNm(k);
  let stored=[];try{stored=JSON.parse(localStorage.getItem(orderKey)||localStorage.getItem('measure.rzset')||'[]');}catch(e){}
  if(!Array.isArray(stored))stored=[];
  let order=[...new Set([...stored.map(k=>k==='shch'?'wire':k).filter(k=>all.includes(k)),...all])];
  let color=localStorage.getItem(colorKey)||'#1F6FD1';
  const valid=c=>/^#[0-9a-f]{6}$/i.test(c||'');if(!valid(color))color='#1F6FD1';
  const colors=['#1F6FD1','#E0442B','#2E9E4F','#D4A300','#A86BE8','#E87CB0','#E8EBEF','#22262C'];
  let drag=null,suppressUntil=0,paletteOffset=0;
  const saveOrder=()=>{localStorage.setItem(orderKey,JSON.stringify(order));RZ.set=['sel','arr','lup',...order];rzSave();};
  saveOrder();if(RZ.t==='vert')RZ.t='arr';
  const nativePick=rzPick;
  rzPick=function(k){
    // A previously selected RZ arrow otherwise hides the native tool panel,
    // including the route's finish/type/diameter controls.
    if(!RZT[k])RZ.sel=null;
    return nativePick.apply(this,arguments);
  };
  const crossed='<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M4 14h20M14 4v20m-10-10 4-3m-4 3 4 3m16-3-4-3m4 3-4 3M14 4l-3 4m3-4 3 4m-3 16-3-4m3 4 3-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function chooseColor(c){
    if(!valid(c))return;
    const q=rzQ(RZ.sel);if(q&&q.c!==c){snap();q.c=c;unsnap();saveSess();}
    color=c;localStorage.setItem(colorKey,c);draw();renderBottom();
  }
  function button(k){const b=document.createElement('button');b.type='button';b.dataset.labRzTool=k;b.className=RZ.t===k?'on':'';b.title=k==='arr'?'Стрелка-размер: горизонталь или высота по направлению жеста':rzNm(k);b.setAttribute('aria-label',b.title);b.innerHTML=k==='arr'?crossed:rzIco(k);b.onclick=()=>rzPick(k);return b;}
  function renderBottom(){
    if(!rzOk())return;const bar=$('zpb');let box=$('labRzBottom');if(!box){box=document.createElement('div');box.id='labRzBottom';bar.insertBefore(box,$('zur')?.parentElement===bar?$('zur'):null);}
    const selected=rzQ(RZ.sel)?.c||color;
    const signature=[RZ.t,selected].join('|');if(box.dataset.state===signature)return;const paletteScroll=$('labRzPalette')?.scrollLeft??paletteOffset;box.dataset.state=signature;box.replaceChildren(...['sel','arr','lup'].map(button));
    const pal=document.createElement('div');pal.id='labRzPalette';pal.onscroll=()=>{paletteOffset=pal.scrollLeft;};pal.setAttribute('aria-label','Цвет стрелок');
    colors.forEach(c=>{const b=document.createElement('button');b.type='button';b.className='lab-rz-color'+(c.toLowerCase()===selected.toLowerCase()?' on':'');b.dataset.labRzColor=c;b.style.setProperty('--rz-color',c);b.title='Цвет стрелки '+c;b.setAttribute('aria-label',b.title);b.onclick=()=>chooseColor(c);pal.appendChild(b);});box.appendChild(pal);pal.scrollLeft=paletteScroll;
  }
  function cancelDrag(){if(!drag)return;clearTimeout(drag.timer);drag.button.classList.remove('lab-rz-drag');if(drag.active)suppressUntil=performance.now()+600;drag=null;}
  function bindDrag(b,k){
    b.onpointerdown=e=>{if(e.button!==0)return;cancelDrag();suppressUntil=0;const d=drag={button:b,k,id:e.pointerId,x:e.clientX,y:e.clientY,active:false};d.timer=setTimeout(()=>{if(drag!==d)return;d.active=true;b.classList.add('lab-rz-drag');try{b.setPointerCapture(d.id);}catch(e){}navigator.vibrate?.(20);},420);};
    b.onpointermove=e=>{const d=drag;if(!d||d.id!==e.pointerId)return;if(!d.active){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>8)cancelDrag();return;}e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-lab-rz-comm]');const k2=target?.dataset.labRzComm;if(k2&&k2!==d.k){const i=order.indexOf(d.k),j=order.indexOf(k2);order.splice(i,1);order.splice(j,0,d.k);saveOrder();const row=$('ch'),at=order.indexOf(d.k),find=key=>row.querySelector(`[data-lab-rz-comm="${key}"]`);order.slice(0,at).forEach(key=>{const el=find(key);if(el)row.insertBefore(el,d.button);});order.slice(at+1).reverse().forEach(key=>{const el=find(key);if(el)row.insertBefore(el,d.button.nextSibling);});}const row=$('ch'),r=row.getBoundingClientRect();if(e.clientX<r.left+24)row.scrollLeft-=12;else if(e.clientX>r.right-24)row.scrollLeft+=12;};
    b.addEventListener('touchmove',e=>{if(drag?.active)e.preventDefault();},{passive:false});
    b.onpointerup=e=>{if(drag?.id===e.pointerId)cancelDrag();};b.onpointercancel=cancelDrag;b.onlostpointercapture=cancelDrag;
    b.onclick=e=>{if(performance.now()<suppressUntil){e.preventDefault();return;}rzPick(k);};
  }
  rzRow=function(){const row=$('ch'),rowScroll=row.scrollLeft;row.classList.add('pre');row.innerHTML='';for(const k of order){const b=document.createElement('button');b.type='button';b.className='pb'+(RZ.t===k?' on':'');b.dataset.rzt=k;b.dataset.labRzComm=k;b.title=commHint(k)+' · удерживайте и тяните для перестановки';b.setAttribute('aria-label',commName(k));b.style.setProperty('--c','#C9CED6');b.innerHTML=rzIco(k);bindDrag(b,k);row.appendChild(b);}row.scrollLeft=rowScroll;};
  const ui=rzUi;rzUi=function(){const out=ui.apply(this,arguments);renderBottom();return out;};
  const barDraw=zpbDraw;zpbDraw=function(){const out=barDraw.apply(this,arguments);renderBottom();return out;};
  const nativeMake=rzMake;rzMake=function(){const ids=new Set(S.dms.map(q=>q.id));const q=nativeMake.apply(this,arguments);if(q&&!ids.has(q.id)){q.c=color;saveSess();draw();}return q;};
  const api=window.MeasureLabComms={version:9,get order(){return order.slice();},get color(){return color;},chooseColor,refresh:()=>{if(rzOk())rzRow();renderBottom();},cancelDrag};
  Object.assign(PM,{labComms:api,rzPick:(...a)=>rzPick(...a),rzUi:(...a)=>rzUi(...a),rzMake:(...a)=>rzMake(...a)});
  rzUi();if(rzOk())rzRow();
})();
