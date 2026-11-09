/* Measure Lab 0.4: place -> selected/move -> blank tap deselects -> place next.
 * Native gestures, pinch, undo and object move code are retained. */
(() => {
  'use strict';
  const api=window.MeasureLabPlacement={version:4};
  const objectTool=()=>S.mode!=='plan'&&S.tool==='mk'&&S.show<0&&S.mosaic&&!q4Need()&&KD[S.mk]&&!KD[S.mk].line&&!(rzOk()&&RZT[RZ.t]);
  const snapshot=()=>JSON.stringify({lines:S.lines,els:S.els,man:S.man,notes:S.notes,dms:S.dms,drw:S.drw,rts:S.rts,polys:S.polys});
  api.begin=function(p,event){
    if(!objectTool()||!gest||ptr.size!==1)return false;
    const hit=mkHit(p);let current=S.els.find(e=>e.id===S.sel);
    if(!current&&hit){current=S.els.find(e=>e.id===hit.id);S.sel=current?.id||null;S.dsel=null;}
    if(!current)return false;
    const same=!!hit&&hit.id===current.id;
    gest.labPlacement={id:current.id,tool:S.mk,clearOnTap:!same,before:snapshot(),undo:S.und.slice(),redo:S.red?S.red.slice():[]};
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
    if(state){if(state.clearOnTap)S.sel=null;S.pend=null;mkPanel();draw();return;}
    return nativeTap.apply(this,arguments);
  };
  const nativePick=pickTool0;
  pickTool0=function(k){
    if(k!==S.mk&&gest?.labPlacement&&!gest.labPlacement.cancelled){rollback(gest);gest.labPlacement.cancelled=true;gest.edrag=null;gest.znp=1;gest.moved=true;}
    if(k!==S.mk&&KD[k]&&!KD[k].line){S.sel=null;S.pend=null;}
    return nativePick.apply(this,arguments);
  };
  PM.labPlacement=api;
})();
