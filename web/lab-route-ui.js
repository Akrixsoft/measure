/* Route type and modifiers; no dialogs on creation and no geometry mutations. */
(() => {
  'use strict';
  const catalog=window.MeasureLabRouteCatalog;if(!catalog)return;
  const byId=id=>document.getElementById(id);
  const wallSelected=()=>S.rts.find(q=>q.id===S.dsel)||null;
  const isFloor=()=>S.mode==='plan'&&(PL.tool==='prt'||!!window.MeasureLabFloorRoutes?.selected());
  const isWall=()=>S.mode!=='plan'&&S.tool==='mk'&&(S.mk==='wrt'||!!wallSelected());
  const active=()=>isFloor()||isWall();
  function selected(){return isFloor()?window.MeasureLabFloorRoutes?.selected()||null:wallSelected();}
  function type(){const q=selected();return q?.t||(isFloor()?window.MeasureLabFloorRoutes?.defaultType:window.MeasureLabRoutes?.type?.())||zo(isFloor()?'prt':'wrt').rt||'wa';}
  function setType(id){
    if(!catalog.byId[id])return;
    if(isFloor()&&window.MeasureLabFloorRoutes){MeasureLabFloorRoutes.setType(id);}
    else if(window.MeasureLabRoutes?.setType){MeasureLabRoutes.setType(id);}
    else{const q=wallSelected();if(q&&q.t!==id){snap();q.t=id;delete q.cand;unsnap();saveSess();}zo('wrt').rt=id;prefSave();mkPanel();draw();}
    render();
  }
  let rendering=false;
  function render(){
    if(rendering)return;rendering=true;
    try{
      const on=active(),row=byId('zopt');document.body.classList.toggle('lab-route-options',on);
      if(on){
        const key=isFloor()?'prt':'wrt',o=zo(key),q=selected(),signature=JSON.stringify([key,q?.id,type(),o.L,o.P,o.dash,o.sn,q?.dash]);
        if(row.dataset.labRoute!==signature||!row.querySelector('#labRouteType')){
          row.dataset.labRoute=signature;row.replaceChildren();
          const label=document.createElement('label');label.className='lab-route-type';label.innerHTML='<span>Тип</span><select id="labRouteType" aria-label="Тип трассы"></select>';
          const select=label.querySelector('select');for(const t of catalog.types){const option=document.createElement('option');option.value=t.id;option.textContent=t.label+' · '+t.short;select.appendChild(option);}select.value=type();select.onchange=()=>setType(select.value);row.appendChild(label);
          const controls=document.createElement('div');controls.id='labRouteModifiers';for(const [key,title,icon] of [['L','Под прямым углом','L'],['P','Параллельно предыдущему сегменту','∥'],['dash','Дополнительный пунктир','┅'],['sn','Привязка','🧲']]){const b=document.createElement('button');b.type='button';b.dataset.labRouteMod=key;b.title=title;b.setAttribute('aria-label',title);const enabled=key==='dash'&&q?.dash!=null?!!q.dash:!!o[key];b.className=enabled?'on':'';b.textContent=icon;b.onclick=()=>{o[key]=enabled?0:1;if(key==='dash'&&q){if(isFloor())plSnap();else snap();q.dash=!!o.dash;if(isFloor())saveRoom();else{unsnap();saveSess();}}prefSave();render();draw();};controls.appendChild(b);}row.appendChild(controls);
        }
        row.classList.add('on');
      }else if(row.dataset.labRoute){   /* 82.18 F1: выход из трассы — содержимое и класс сняты, кэш штатных plMods / zOpt0 сброшен, L / 🧲 и опции рисуются заново */
        delete row.dataset.labRoute;delete row.dataset.h;row.replaceChildren();row.classList.remove('on');try{options(zCur());}catch(e){}
      }
      let floor=byId('labFloorTools');if(!floor){floor=document.createElement('div');floor.id='labFloorTools';floor.innerHTML=`<button type="button" data-lab-floor="route">${kIcoD('wrt')}<span>Трасса пола</span></button><button type="button" data-lab-floor="dimension">${kIcoD('dim')}<span>Размер пола</span></button>`;byId('zf').insertBefore(floor,byId('zb'));floor.querySelector('[data-lab-floor=route]').onclick=()=>{window.MeasureLabFloorRoutes?.setRouteTool();render();};floor.querySelector('[data-lab-floor=dimension]').onclick=()=>{window.MeasureLabFloorRoutes?.setDimensionTool();render();};}
      floor.hidden=!(S.mode==='plan'&&S.room&&window.MeasureLabFloorRoutes);
      floor.querySelector('[data-lab-floor=route]').classList.toggle('on',PL.tool==='prt');floor.querySelector('[data-lab-floor=dimension]').classList.toggle('on',PL.tool==='labFloorDim');
    }finally{rendering=false;}
  }
  const layout=zLay;zLay=function(){const r=layout.apply(this,arguments);render();return r;};
  const panel=mkPanel;mkPanel=function(){const r=panel.apply(this,arguments);render();return r;};
  const options=zOpt;zOpt=function(){const r=options.apply(this,arguments);render();return r;};
  const planMods=plMods;plMods=function(){const r=planMods.apply(this,arguments);render();return r;};
  const api=window.MeasureLabRouteUI={refresh:render,setType,selected,active};Object.assign(PM,{labRouteUI:api,zLay:(...a)=>zLay(...a),mkPanel:(...a)=>mkPanel(...a)});
  render();
})();
