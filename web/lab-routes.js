/* Wall routes: native records, drag creation, selected vertices and atomic edits. */
(() => {
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x)), dpi=()=>devicePixelRatio||1;
  const snapApi=()=>window.MeasureLabSnap;
  const active=()=>S.mode!=='plan'&&S.tool==='mk'&&S.mk==='wrt'&&S.show<0&&S.mosaic&&!q4Need();
  const selected=()=>S.rts.find(q=>q.id===S.dsel)||null;
  const options=()=>zo('wrt');
  // v81's PREF constructor intentionally reads only its original fields and
  // drops PREF.opt on reload. Keep route defaults in a scoped durable record.
  const defaultsKey='measure.lab.routes.wall.options',optionKeys=['rt','rd','L','P','dash','sn'];
  try{const stored=JSON.parse(localStorage.getItem(defaultsKey)||'{}');if(stored&&typeof stored==='object')for(const k of optionKeys)if(Object.prototype.hasOwnProperty.call(stored,k))options()[k]=stored[k];}catch(e){}
  const prefSave0=prefSave;
  prefSave=function(){try{localStorage.setItem(defaultsKey,JSON.stringify(Object.fromEntries(optionKeys.filter(k=>options()[k]!=null).map(k=>[k,options()[k]]))));}catch(e){}return prefSave0.apply(this,arguments);};
  ZOPT.wrt=['L','P','dash','sn'];
  if(options().sn==null)options().sn=1;
  if(options().dash==null)options().dash=1;
  const api=window.MeasureLabRoutes={version:11,active,selected,preview:null};
  function pick(point,screen){
    if(!options().sn)return null;
    let best=snapApi()?.pick(point,screen)||null,limit=best?Math.hypot(best.screen[0]-screen[0],best.screen[1]-screen[1]):16*dpi();
    for(const route of S.rts){if(route.id===state()?.id)continue;const points=project(route);for(let i=0;i<points.length;i++){const distance=Math.hypot(points[i][0]-screen[0],points[i][1]-screen[1]);if(distance<limit){limit=distance;best={point:route.pts[i].slice(),screen:points[i].slice(),kind:'route',id:route.id};}}}
    return best;
  }
  function constrain(a,b,start,end,k='wrt'){
    const q={a:(start?.point||a).slice(),b:(end?.point||b).slice(),labAnchorVersion:1};
    if(start?.ref||end?.ref)q.labAnchors={...(start?.ref?{a:clone(start.ref)}:{}),...(end?.ref?{b:clone(end.ref)}:{})};
    const constraint=snapApi()?.constraintFor(k,q.a,q.b,end&&!start?'b':'a');
    if(constraint){q.labConstraint=constraint;snapApi().constrainDrawing(q);}
    return q;
  }
  function proxy(q){return {a:q.pts[0].slice(),b:q.pts.at(-1).slice(),...(q.labAnchors?{labAnchors:clone(q.labAnchors)}:{}),...(q.pts.length===2&&q.labConstraint?{labConstraint:clone(q.labConstraint)}:{}),labAnchorVersion:1};}
  function applyPair(q,p){q.pts[0]=p.a.slice();q.pts[q.pts.length-1]=p.b.slice();q.labAnchorVersion=1;if(p.labAnchors&&Object.keys(p.labAnchors).length)q.labAnchors=clone(p.labAnchors);else delete q.labAnchors;if(q.pts.length===2&&p.labConstraint)q.labConstraint=clone(p.labConstraint);else delete q.labConstraint;}
  function sync(q){
    if(!q?.pts||q.pts.length<2)return;
    const p=proxy(q);for(const f of ['a','b']){const ref=p.labAnchors?.[f];if(!ref)continue;const r=snapApi()?.resolveRef(ref);if(r)p[f]=r.point.slice();else{delete p.labAnchors[f];}}
    if(p.labConstraint)snapApi()?.constrainDrawing(p);applyPair(q,p);
  }
  function project(q){
    const points=q.pts.map(p=>toScr(...p));if(points.length<2)return points;
    const p=proxy(q),pair=snapApi()?.projectDrawing(p);
    for(const [f,i]of [['a',0],['b',points.length-1]])points[i]=pair?.[f]||snapApi()?.resolveRef(p.labAnchors?.[f])?.screen||points[i];
    return points;
  }
  function state(){const z=gest?.zdr;return z?.labRoute&&z.tk===zdrTk()?z:null;}
  function display(q){const z=state();return z?.id===q.id&&z.preview?z.preview:q;}
  function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
  function hit(p){
    const list=S.rts.slice().reverse(),q=selected();if(q)list.unshift(q);
    for(const route of list){const points=project(route);for(let i=1;i<points.length;i++)if(segmentDistance(p,points[i-1],points[i])<12*dpi())return route;}
    return null;
  }
  function handle(p,q){if(!q)return null;const points=project(q);let radius=16*dpi(),best=null;for(let i=1;i<points.length;i++)radius=Math.min(radius,Math.max(5*dpi(),Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])/3));for(let i=0;i<points.length;i++){const distance=Math.hypot(points[i][0]-p[0],points[i][1]-p[1]);if(distance<radius){radius=distance;best={i,o:[points[i][0]-p[0],points[i][1]-p[1]]};}}return best;}
  function editVertex(q,i,point,screen){
    const last=q.pts.length-1,candidate=pick(point,screen),field=i===0?'a':i===last?'b':null;
    if(!field){q.pts[i]=(candidate?.point||point).slice();return;}
    const p=proxy(q),other=field==='a'?'b':'a';p[field]=(candidate?.point||point).slice();
    snapApi()?.setRef(p,field,candidate?.ref||null);
    if(q.pts.length===2){const fixed=p.labAnchors?.[other]?other:candidate?.ref?field:other,c=snapApi()?.constraintFor('wrt',p[other],p[field],fixed);if(c){p.labConstraint=c;snapApi().constrainDrawing(p);}else delete p.labConstraint;}
    applyPair(q,p);
  }
  const start0=zdrStart;
  zdrStart=function(p,event){
    if(!active())return start0.apply(this,arguments);
    const g=gest;if(!g)return false;
    S.zpl=[];S.pend=null;
    const q=selected(),h=handle(p,q),body=h?q:hit(p),a=toPl(...p);
    const z={k:'wrt',labRoute:h?'handle':body?'move':'create',p0:p.slice(),a,tk:zdrTk(),id:body?.id||null,initial:body?clone(body):null,h,start:body?null:pick(a,p)};
    if(body){S.dsel=body.id;S.sel=null;S.msel=[];}else{S.dsel=null;S.sel=null;S.msel=[];}
    g.zdr=z;api.preview=null;mkPanel();draw();return true;
  };
  function update(z,p){
    if(z.tk!==zdrTk())return null;
    const point=toPl(...p);let q;
    if(z.labRoute==='create'){
      const pair=constrain(z.a,point,z.start,pick(point,p));q={t:options().rt||'el',d:options().rd||'',pts:[pair.a,pair.b],dash:!!options().dash,labAnchorVersion:1};applyPair(q,pair);
      z.ok=zdrOk(z,p)&&Math.hypot(q.pts[1][0]-q.pts[0][0],q.pts[1][1]-q.pts[0][1])>=100;
    }else{
      q=clone(z.initial);z.ok=!!gest?.moved;
      if(z.labRoute==='handle'){const screen=[p[0]+z.h.o[0],p[1]+z.h.o[1]];editVertex(q,z.h.i,toPl(...screen),screen);}
      else{const delta=sub(point,z.a);q.pts=q.pts.map(v=>add(v,delta));delete q.labAnchors;delete q.labConstraint;q.labAnchorVersion=1;}
    }
    z.b=p.slice();z.preview=q;api.preview=q;return q;
  }
  const move0=zdrMove;
  zdrMove=function(g,p){if(!g.zdr?.labRoute)return move0.apply(this,arguments);const z=g.zdr;if(z.tk!==zdrTk()){g.zdr=null;g.znp=1;api.preview=null;return draw();}update(z,p);if(z.ok)z.mv=1;draw();};
  const end0=zdrEnd;
  zdrEnd=function(g,p){
    const z=g.zdr;if(!z?.labRoute)return end0.apply(this,arguments);
    api.preview=null;g.moved=true;
    if(z.tk!==zdrTk()){g.zdr=null;return draw();}
    update(z,p);
    g.zdr=null;
    if(z.ok&&z.mv&&z.preview){
      snap();let q;
      if(z.labRoute==='create'){q={id:'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),...clone(z.preview)};S.rts.push(q);}
      else{q=S.rts.find(q=>q.id===z.id);if(q)Object.assign(q,clone(z.preview));}
      if(q){S.dsel=q.id;S.sel=null;S.zRef=[q.pts[0].slice(),q.pts.at(-1).slice()];saveSess();}
    }
    api.preview=null;mkChips();mkPanel();draw();
  };
  const preview0=zdrPv;
  zdrPv=function(z){return z?.labRoute?null:preview0.apply(this,arguments);};
  // Atomic previews never mutate saved records. Native pointercancel and pinch
  // discard g.zdr, so no rollback can remove an unrelated action or undo entry.
  const tap0=dmTap;
  dmTap=function(){if(active())return;return tap0.apply(this,arguments);};
  const pick0=pickTool0;
  pickTool0=function(k){if(k!==S.mk&&gest?.zdr?.labRoute){gest.zdr=null;gest.znp=1;gest.moved=true;api.preview=null;}return pick0.apply(this,arguments);};
  const hd0=zdHd;
  zdHd=function(q){if(!S.rts.includes(q))return hd0.apply(this,arguments);const shown=display(q),points=project(shown);return points.map((s,i)=>({s,set:v=>editVertex(q,i,v,toScr(...v))}));};
  const hit0=zwHit;
  zwHit=function(p){const q=hit(p);if(q)return q.id;const records=S.rts;S.rts=[];try{return hit0.apply(this,arguments);}finally{S.rts=records;}};
  function paint(q,preview=false){
    const z=state();if(!preview&&z?.id===q.id&&z.preview&&z.mv)return;
    const points=project(q);if(points.length<2)return;
    const catalog=window.MeasureLabRouteCatalog,type=catalog?.get?.(q.t)||catalog?.byId?.[q.t],style=catalog?.style?.(q,dpi()),selectedRoute=preview||zdSel(q);
    cx.save();cx.strokeStyle=style?.color||type?.color||RT_C[q.t]||'#e07a00';cx.lineWidth=zdW(3,selectedRoute);cx.lineJoin='round';cx.lineCap='round';
    const pattern=style?.dash||(q.dash===false?[]:q.dash===true?catalog?.pattern?.(q.t,dpi())||[10*dpi(),4*dpi()]:[10*dpi(),4*dpi()]);cx.setLineDash(Array.isArray(pattern)?pattern:[]);
    cx.beginPath();points.forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.stroke();
    // A printed grayscale copy still identifies the route type. This is a plain
    // tangent caption, with no editable measurement field or automatic input.
    const code=style?.shortcode||style?.short||type?.short;
    if(code){let segment=null,length=0;for(let i=1;i<points.length;i++){const n=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);if(n>length){length=n;segment=[points[i-1],points[i]];}}
      cx.font=`700 ${12*dpi()}px system-ui`;const width=cx.measureText(code).width,height=(window.MeasureLabAppearance?.textPx?.()||window.MeasureLabSettings?.current.textPx||12)*dpi()+4*dpi();
      if(segment&&length>width+24*dpi()){const [a,b]=segment;let angle=Math.atan2(b[1]-a[1],b[0]-a[0]);if(angle>Math.PI/2)angle-=Math.PI;if(angle<=-Math.PI/2)angle+=Math.PI;
        cx.translate((a[0]+b[0])/2,(a[1]+b[1])/2);cx.rotate(angle);cx.setLineDash([]);cx.fillStyle='rgba(255,255,255,.94)';cx.fillRect(-width/2-3*dpi(),-height/2,width+6*dpi(),height);cx.fillStyle=style?.color||type?.color||RT_C[q.t]||'#333';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(code,0,0);
      }
    }
    cx.restore();
  }
  const draw0=zwDraw;
  zwDraw=function(){const out=draw0.apply(this,arguments),z=state();if(z?.mv&&z.preview){paint(z.preview,true);zdDots(project(z.preview));}return out;};
  const save0=doSave;
  doSave=function(){S.rts.forEach(sync);return save0.apply(this,arguments);};
  const out0=zwOut;
  zwOut=function(){S.rts.forEach(sync);return out0.apply(this,arguments);};
  const drawAll0=draw;
  draw=function(){if(S.mode!=='plan')S.rts.forEach(sync);return drawAll0.apply(this,arguments);};
  function exportMeta(q,flip=false){return {...(typeof q.dash==='boolean'?{dash:q.dash}:{}),...(q.labAnchorVersion===1?{labAnchorVersion:1}:{}),...(q.labAnchors?{labAnchors:snapApi().transformRefs(q.labAnchors,flip)}:{}),...(q.labConstraint?{labConstraint:snapApi().transformConstraint(q.labConstraint,flip)}:{})};}
  function setType(id){if(!RT_T.some(t=>t[0]===id))return false;const q=selected();if(q&&q.t!==id){snap();q.t=id;delete q.cand;saveSess();}options().rt=id;prefSave();mkPanel();zLay();draw();return true;}
  Object.assign(api,{constrain,project,paint,pick,hit,handle,sync,editVertex,exportMeta,setType,type:()=>selected()?.t||options().rt||'el',refresh:()=>{mkPanel();zLay();draw();}});
  Object.defineProperty(api,'preview',{get:()=>state()?.preview||null,set:()=>{}});
  Object.assign(PM,{labRoutes:api,draw:(...a)=>draw(...a)});
})();
