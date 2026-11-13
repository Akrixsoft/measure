/* Measure Lab 0.5: durable object/post endpoint references.
 * World coordinates remain ordinary v81 millimeters; drawing refs carry identity
 * so a packed glyph, rounding, object move or wall flip cannot change the post. */
(() => {
  'use strict';
  const d=()=>devicePixelRatio||1,copy=x=>JSON.parse(JSON.stringify(x));
  const nativeSnap=zSnap;
  const api=window.MeasureLabSnap={version:5,migrations:[],orphans:[],inCreation:false};
  const enabled=k=>!!zo(k).sn;
  if(!ZOPT.arr.includes('sn'))ZOPT.arr.push('sn');
  if(zo('arr').sn==null)zo('arr').sn=window.MeasureLabSettings?.current.snap!==false?1:0;
  let excludeDrawing=null,pendingRef=null,pendingPick=false,activePick=null;
  function postRef(e,index){return {v:1,e:e.id,kind:'post',p:index+1,n:Math.max(1,Math.round(+e.N||1))};}
  function resolveRef(ref){
    if(!ref||ref.v!==1||typeof ref.e!=='string')return null;
    const e=S.els.find(e=>e.id===ref.e);if(!e||!KD[e.k])return null;
    if(ref.kind==='center')return {point:e.c.slice(),screen:KD[e.k].pt?f81gIcS(e):toScr(...e.c),e};
    if(ref.kind!=='post'||!KD[e.k].pt)return null;
    const count=Math.max(1,Math.round(+e.N||1)),index=Math.max(0,Math.min(count-1,(+ref.p||1)-1)),W=wf(),c=toW(e.c,W),step=+e.st||71;
    const point=fromW([c[0]+(index-(count-1)/2)*step,c[1]],W),icons=rzIcons(e);
    return {point,screen:icons.cs[index]?.slice()||toScr(...point),e,p:index+1,n:count};
  }
  function candidates(){
    const out=[],add=(point,screen,kind,id,ref)=>{if(point?.every(Number.isFinite)&&screen?.every(Number.isFinite))out.push({point:point.slice(),screen:screen.slice(),kind,id,...(ref?{ref}: {})});};
    for(const e of S.els){if(!KD[e.k]||!layOn(e)||e.cand)continue;
      if(KD[e.k].pt){const count=Math.max(1,Math.round(+e.N||1));for(let i=0;i<count;i++){const ref=postRef(e,i),r=resolveRef(ref);if(r)add(r.point,r.screen,'post',e.id,ref);}}
      else{add(e.c,toScr(...e.c),'center',e.id,{v:1,e:e.id,kind:'center'});for(const p of elRect(e))add(p,toScr(...p),'corner',e.id);}
    }
    for(const k of LINE_K)for(const p of S.lines[k]||[])add(p,toScr(...p),'wall',k);
    for(const q of [...S.dms,...S.drw]){if(q.id===excludeDrawing)continue;for(const f of ['a','b'])if(q[f]){const r=q.labAnchors?.[f]&&resolveRef(q.labAnchors[f]);add(q[f],r?.screen||toScr(...q[f]),'drawing',q.id);}}
    return out;
  }
  function pick(point,screen,allow,limit=16*d()){
    let best=null;for(const c of candidates()){if(allow&&!allow(c.point))continue;const distance=Math.hypot(c.screen[0]-screen[0],c.screen[1]-screen[1]);if(distance<limit){limit=distance;best=c;}}
    api.last=best;return best;
  }
  function nearest(point,screen,allow){const result=pick(point,screen,allow);return result?result.point.slice():point;}
  function setRef(q,field,ref){
    if(ref){q.labAnchors=q.labAnchors||{};q.labAnchors[field]=copy(ref);}else if(q.labAnchors){delete q.labAnchors[field];if(!Object.keys(q.labAnchors).length)delete q.labAnchors;}
    q.labAnchorVersion=1;
  }
  // A modifier is a geometric constraint, not a hint that magnet snapping
  // may override. Its direction is stored in wall coordinates, not pixels.
  function constraintFor(k,a,b,fixed){
    const o=zo(k);if(!o.L&&!o.P)return null;const W=wf(),A=toW(a,W),B=toW(nativeMod(k,a,b),W);
    let dx=B[0]-A[0],dy=B[1]-A[1],kind='parallel';
    if(o.L){kind='axis';if(Math.abs(dx)>=Math.abs(dy)){dx=Math.sign(dx)||1;dy=0;}else{dy=Math.sign(dy)||1;dx=0;}}
    else if(o.P&&S.zRef){const p=toW(S.zRef[0],W),q=toW(S.zRef[1],W);dx=q[0]-p[0];dy=q[1]-p[1];}
    else return null;
    const length=Math.hypot(dx,dy);if(!(length>1e-9))return null;
    return {v:1,kind,dx:dx/length,dy:dy/length,fixed:fixed==='b'?'b':'a'};
  }
  function constrainDrawing(q){
    const c=q?.labConstraint;if(!c||c.v!==1||!q.a||!q.b)return false;
    const length=Math.hypot(+c.dx,+c.dy);if(!(length>1e-9))return false;
    const u=[c.dx/length,c.dy/length],fixed=c.fixed==='b'?'b':'a',free=fixed==='a'?'b':'a',W=wf(),A=toW(q[fixed],W),B=toW(q[free],W),v=[B[0]-A[0],B[1]-A[1]],cross=Math.abs(v[0]*u[1]-v[1]*u[0]);
    let changed=false;
    if(q.labAnchors?.[free]&&cross>1e-7){setRef(q,free,null);changed=true;}
    const t=v[0]*u[0]+v[1]*u[1],point=fromW([A[0]+u[0]*t,A[1]+u[1]*t],W);
    if(Math.hypot(point[0]-q[free][0],point[1]-q[free][1])>1e-8){q[free]=point;changed=true;}
    return changed;
  }
  function projectDrawing(q){
    const c=q?.labConstraint;if(!c||c.v!==1||!q.a||!q.b||S.mode==='plan')return null;
    const W=wf(),A=toW(q.a,W),origin=toScr(...q.a),axis=toScr(...fromW([A[0]+c.dx*1000,A[1]+c.dy*1000],W)),dx=axis[0]-origin[0],dy=axis[1]-origin[1],length=Math.hypot(dx,dy);if(!(length>1e-8))return null;
    const u=[dx/length,dy/length],result={};
    for(const f of ['a','b']){const r=q.labAnchors?.[f]&&resolveRef(q.labAnchors[f]);result[f]=r?r.screen.slice():toScr(...q[f]);}
    const fixed=c.fixed==='b'?'b':'a',free=fixed==='a'?'b':'a',v=[result[free][0]-result[fixed][0],result[free][1]-result[fixed][1]],t=v[0]*u[0]+v[1]*u[1];
    result[free]=[result[fixed][0]+u[0]*t,result[fixed][1]+u[1]*t];return result;
  }
  // A legacy endpoint is migrated only when its intended post is unique and
  // genuinely close. No large-distance or axis-only inference is permitted.
  function inferLegacy(point){
    const posts=candidates().filter(c=>c.ref?.kind==='post'),physical=toScr(...point);
    const ranked=posts.map(c=>({...c,mm:Math.hypot(c.point[0]-point[0],c.point[1]-point[1]),px:Math.hypot(c.screen[0]-physical[0],c.screen[1]-physical[1])}));
    const model=ranked.filter(c=>c.mm<=Math.min(20,(+(S.els.find(e=>e.id===c.id)?.st)||71)/4)).sort((a,b)=>a.mm-b.mm);
    if(model.length===1||(model.length>1&&model[1].mm-model[0].mm>=3))return model[0]||null;
    // Screen proximity alone changes with zoom and cannot establish old intent.
    return null;
  }
  function syncDrawing(q,migrate=true){
    if(!q||q.rz||!q.a||!q.b||!(q.k==='arr'||S.dms.includes(q)))return false;
    let changed=false;
    if(migrate&&!api.inCreation&&!q.labAnchorVersion){
      const magnet=enabled(q.k==='arr'?'arr':'dim');
      for(const f of ['a','b'])if(magnet&&!q.labAnchors?.[f]){const candidate=inferLegacy(q[f]);if(candidate){setRef(q,f,candidate.ref);api.migrations.push({id:q.id,endpoint:f,ref:copy(candidate.ref)});changed=true;}}
      q.labAnchorVersion=1;
    }
    for(const f of ['a','b']){const ref=q.labAnchors?.[f];if(!ref)continue;const resolved=resolveRef(ref);if(!resolved){api.orphans.push({id:q.id,endpoint:f,e:ref.e});setRef(q,f,null);changed=true;continue;}
      if(resolved.p){ref.p=resolved.p;ref.n=resolved.n;}
      if(Math.hypot(q[f][0]-resolved.point[0],q[f][1]-resolved.point[1])>1e-8){q[f]=resolved.point.slice();changed=true;}
    }
    return constrainDrawing(q)||changed;
  }
  function syncAll(migrate=true){if(S.mode==='plan')return false;let changed=false;for(const q of [...S.dms,...S.drw])changed=syncDrawing(q,migrate)||changed;return changed;}
  zSnap=function(point,screen){if(api.inCreation)return activePick?activePick.point.slice():point;if(activePick)return activePick.point.slice();return nearest(point,screen);};
  const nativeMod=zMod;
  zMod=function(k,a,q){
    const value=nativeMod.apply(this,arguments);if(!['arr','dim'].includes(k)||!enabled(k))return value;
    const target=api.inCreation?activePick:(activePick||pick(q,toScr(...q)));
    if(!target)return value;
    // Keep zMod itself native-constrained. Pair-level preview/creation can move
    // the free start to a line through the exact chosen target afterwards.
    return zo(k).L||zo(k).P?nativeMod(k,a,target.point):target.point.slice();
  };
  const nativeTap=dmTap;
  dmTap=function(point,screen){
    const k=S.mk;if(S.mode==='plan'||!['arr','dim'].includes(k))return nativeTap.apply(this,arguments);
    const hadStart=!!S.pend,oldIds=new Set([...S.dms,...S.drw].map(q=>q.id)),candidate=enabled(k)?pick(point,screen):null;
    if(!hadStart){pendingRef=candidate?.ref?copy(candidate.ref):null;pendingPick=!!candidate;}
    const constraint=hadStart?constraintFor(k,S.pend,candidate?candidate.point:point,candidate&&!pendingPick?'b':'a'):null;
    activePick=candidate;api.inCreation=true;
    let result;try{result=nativeTap.call(this,candidate?candidate.point.slice():point,screen);}finally{activePick=null;api.inCreation=false;}
    const created=[...S.dms,...S.drw].filter(q=>q.id&&!oldIds.has(q.id));
    for(const q of created){q.labAnchorVersion=1;if(pendingRef)setRef(q,'a',pendingRef);if(candidate?.ref)setRef(q,'b',candidate.ref);if(candidate)q.b=candidate.point.slice();if(constraint)q.labConstraint=copy(constraint);syncDrawing(q,false);S.zRef=[q.a.slice(),q.b.slice()];if(S.pend)S.pend=q.b.slice();}
    if(created.length){const last=created.at(-1);pendingRef=S.pend&&last.labAnchors?.b?copy(last.labAnchors.b):null;pendingPick=!!(S.pend&&pendingRef);saveSess();draw();}
    else if(!S.pend){pendingRef=null;pendingPick=false;}
    return result;
  };
  const nativePreview=zdrPv;
  zdrPv=function(z){
    const result=nativePreview.apply(this,arguments);if(!result?.q||!['arr','dim'].includes(z.k))return result;
    const start=enabled(z.k)?pick(z.a,toScr(...z.a)):null,end=enabled(z.k)&&z.b?pick(toPl(...z.b),z.b):null,q=result.q;
    if(start){q.a=start.point.slice();if(start.ref)setRef(q,'a',start.ref);}
    if(end){q.b=end.point.slice();if(end.ref)setRef(q,'b',end.ref);}
    const constraint=constraintFor(z.k,q.a,end?end.point:toPl(...z.b),end&&!start?'b':'a');if(constraint){q.labConstraint=constraint;constrainDrawing(q);}
    return result;
  };
  const nativeHandles=zdHd;
  zdHd=function(q){const list=nativeHandles.apply(this,arguments);if(q&&!q.rz&&(q.k==='arr'||S.dms.includes(q))){list.slice(0,2).forEach((h,i)=>h.labEndpoint=i===0?'a':'b');}return list;};
  const nativeHandleMove=zdHdMove;
  zdHdMove=function(g,p){
    const q=zdGet(S.dsel),k=q?.k==='arr'?'arr':q&&!q.rz&&S.dms.includes(q)?'dim':null,field=g.dhd?.labEndpoint;
    if(!k||!field)return nativeHandleMove.apply(this,arguments);
    const setter=g.dhd.set,screen=add(p,g.dhd.o||[0,0]);excludeDrawing=q.id;
    const candidate=enabled(k)?pick(toPl(...screen),screen):null;
    const other=field==='a'?'b':'a',fixed=q.labAnchors?.[other]?other:candidate?.ref?field:other,constraint=constraintFor(k,q[other],candidate?candidate.point:toPl(...screen),fixed);
    g.dhd.set=point=>{setRef(q,field,candidate?.ref||null);if(constraint)q.labConstraint=copy(constraint);else delete q.labConstraint;setter(candidate?candidate.point.slice():point);constrainDrawing(q);};
    try{return nativeHandleMove.apply(this,arguments);}finally{g.dhd.set=setter;excludeDrawing=null;}
  };
  const nativeMove=zdMove;
  zdMove=function(q,delta){if(q?.labAnchors&&delta&&Math.hypot(...delta)>1e-8)delete q.labAnchors;return nativeMove.apply(this,arguments);};
  const nativeSave=doSave;
  doSave=async function(){syncAll();return nativeSave.apply(this,arguments);};
  const nativeOut=dmOut;
  dmOut=function(){syncAll();const result=nativeOut.apply(this,arguments);for(const list of [result.dm,result.drw])for(const item of list||[]){const q=[...S.dms,...S.drw].find(q=>q.id===item.id);if(q?.labAnchors)item.labAnchors=transformRefs(q.labAnchors,false);if(q?.labAnchorVersion===1)item.labAnchorVersion=1;if(q?.labConstraint)item.labConstraint=transformConstraint(q.labConstraint,false);}return result;};
  function transformRefs(refs,flip){
    if(!refs||typeof refs!=='object')return undefined;const result={};
    for(const field of ['a','b']){const ref=refs[field];if(!ref||ref.v!==1||typeof ref.e!=='string'||!['post','center'].includes(ref.kind))continue;
      const r=copy(ref);if(r.kind==='post'){r.n=Math.max(1,Math.round(+r.n||1));r.p=Math.max(1,Math.min(r.n,Math.round(+r.p||1)));if(flip)r.p=r.n+1-r.p;}result[field]=r;}
    return Object.keys(result).length?result:undefined;
  }
  function transformConstraint(value,flip){
    if(!value||value.v!==1||!['axis','parallel'].includes(value.kind))return undefined;
    const dx=(flip?-1:1)*Number(value.dx),dy=Number(value.dy),length=Math.hypot(dx,dy);if(!(length>1e-9))return undefined;
    return {v:1,kind:value.kind,dx:dx/length,dy:dy/length,fixed:value.fixed==='b'?'b':'a'};
  }
  Object.assign(api,{candidates,point:nearest,pick,enabled,nativeSnap,resolveRef,setRef,syncDrawing,syncAll,transformRefs,constraintFor,constrainDrawing,projectDrawing,transformConstraint});
  PM.labSnap=api;
})();
