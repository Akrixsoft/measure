/* Measure Lab 0.4: place -> selected/move -> blank tap deselects -> place next.
 * Native gestures, pinch, undo and object move code are retained. */
(() => {
  'use strict';
  const api=window.MeasureLabPlacement={version:4};
  const objectTool=()=>S.mode!=='plan'&&S.tool==='mk'&&S.show<0&&S.mosaic&&!q4Need()&&KD[S.mk]&&!KD[S.mk].line&&!(rzOk()&&RZT[RZ.t]);
  const snapshot=()=>JSON.stringify({lines:S.lines,els:S.els,man:S.man,notes:S.notes,dms:S.dms,drw:S.drw,rts:S.rts,polys:S.polys,refs:S.refs||[]});   /* 82.18: снимок как у snap() (undo-patch: + refs) */
  /* 82.18 g2 (QA Д5): поле размера при активном инструменте — только точным касанием подписи (рамка без запаса);
     объект выбирается только инструментом выбора или касанием уже выбранного; касание мимо выбранного снимает выбор и ставит объект (как v81). */
  const fieldHit=p=>{if(typeof w3FHit!=='function')return null;const d=devicePixelRatio||1;let best=null,bd=1e9;
    for(const l of S.w3L||[]){const dx=p[0]-l.c[0],dy=p[1]-l.c[1],r=Math.hypot(dx,dy);let inR;
      if(l.w){const ca=Math.cos(l.an||0),sa=Math.sin(l.an||0),u=dx*ca+dy*sa,v=-dx*sa+dy*ca;inR=Math.abs(u)<=l.w/2&&Math.abs(v)<=l.h/2;}else inR=r<10*d;
      if(inR&&r<bd){bd=r;best=l;}}
    return best;};
  api.fieldHit=fieldHit;
  api.begin=function(p,event){
    if(!objectTool()||!gest||ptr.size!==1)return false;
    const hit=mkHit(p);let current=S.els.find(e=>e.id===S.sel);
    /* 82.18 F2 (AKX-2026-0009): поля и ручки размера выбранного объекта — при любом инструменте; перенос — только протяжкой тела */
    {const f=fieldHit(p);if(f){gest.labField=f;if(current){gest.labPlacement={id:current.id,tool:S.mk,clearOnTap:false,field:1};return true;}}}   /* выбран объект — касание подписи открывает поле, выбор остаётся (F2); ничего не выбрано — r2b (QA2 Н1): протяжка от подписи рисует инструментом, короткое касание — поле (tap / zdrEnd) */
    if(current){const hd=hHit(p);if(hd){gest.hdrag=hd;gest.labPlacement={id:current.id,tool:S.mk,clearOnTap:false,handle:1};return true;}}
    if(!current)return false;
    const same=!!hit&&hit.id===current.id;
    if(!same){S.sel=null;S.pend=null;mkPanel();draw();return false;}   /* g2 Д5: мимо выбранного — выбор снят, жест — инструменту (ставит объект) */
    gest.labPlacement={id:current.id,tool:S.mk,clearOnTap:false,before:snapshot(),undo:S.und.slice(),redo:S.red?S.red.slice():[]};
    // While selected, a stylus drag moves this object; a stationary outside tap
    // only clears selection. The native >=8px threshold separates the actions.
    gest.edrag={id:current.id,q0:toPl(...p),c0:current.c.slice(),snapped:false};
    S.pend=null;mkPanel();draw();return true;
  };
  const nativeMove=mkDrag;
  mkDrag=function(g,p){if(g.labPlacement&&!g.edrag.snapped){g.labPlacement.before=snapshot();g.labPlacement.undo=S.und.slice();g.labPlacement.redo=S.red?S.red.slice():[];}return nativeMove.apply(this,arguments);};
  function rollback(g){
    const state=g?.labPlacement;if(!state)return;
    if(g.edrag?.snapped&&S.und[S.und.length-1]===state.before){
      const restored=JSON.parse(state.before);S.und=state.undo;Object.assign(S,restored);S.red=state.redo;saveSess();
    }
    S.sel=S.els.some(e=>e.id===state.id)?state.id:null;
    S.loupe=null;mkPanel();draw();
  }
  api.pinch=function(g){if(!g?.labPlacement?.cancelled)rollback(g);};
  api.cancel=function(event,g){if(event.type!=='pointercancel'||!g?.labPlacement)return false;if(!g.labPlacement.cancelled)rollback(g);return true;};
  const nativeTap=tap;
  tap=function(p){
    const state=gest?.labPlacement;
    if(gest&&gest.labField&&!gest.moved&&(!state||state.field)){const f=gest.labField;return w3FOpen(f);}
    if(state&&state.field)return;   /* 82.18 F2: поле размера открывается при любом инструменте */
    if(state&&state.handle){const h=mkHit(p);if(!h||h.id!==state.id){S.sel=null;S.pend=null;mkPanel();draw();return nativeTap.apply(this,arguments);}return;}   /* r2b: касание без протяжки у ручки, мимо тела выбранного — как касание мимо (выбор снят, жест инструменту); ручка тянется только протяжкой */
    if(!state&&S.mode!=='plan'&&S.tool==='mk'&&S.show<0&&S.mosaic&&!q4Need()&&typeof w3FHit==='function'){const f=S.mk==='sel'||S.mk==='rsel'?w3FHit(p):fieldHit(p);if(f)return w3FOpen(f);}   /* 82.18 F2: и в «выборе» — поле поверх объекта открывается (v81: только вне объекта) */
    if(state){if(state.clearOnTap)S.sel=null;S.pend=null;mkPanel();draw();return;}
    return nativeTap.apply(this,arguments);
  };
  /* r2b: инструмент протяжки (прямоугольник, размер, линия…) забирает касание в zdrStart; короткое касание по подписи — поле */
  if(typeof zdrEnd==='function'){const ze0=zdrEnd;zdrEnd=function(g,p){const f=g&&g.labField,z=g&&g.zdr,short=!!(z&&!z.mv&&!g.pinch);const r=ze0.apply(this,arguments);if(f&&short&&!g.labFieldDone){g.labFieldDone=1;w3FOpen(f);}return r;};}
  const nativePick=pickTool0;
  pickTool0=function(k){
    if(k!==S.mk&&gest?.labPlacement&&!gest.labPlacement.cancelled){rollback(gest);gest.labPlacement.cancelled=true;gest.edrag=null;gest.znp=1;gest.moved=true;}
    if(k!==S.mk&&KD[k]&&!KD[k].line){S.sel=null;S.pend=null;}
    return nativePick.apply(this,arguments);
  };
  PM.labPlacement=api;
})();
