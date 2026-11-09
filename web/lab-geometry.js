/* Measure Lab 0.5: native heads and keypad, centered tangent fields.
 * The frozen v81 stays immutable. Numeric labels are additive; heads, RZ line
 * geometry, drawing lifecycle and keypad remain native v81. */
(() => {
  'use strict';
  const settings=()=>window.MeasureLabSettings?.current||{textPx:13,fieldPx:22,sideElements:true};
  const dpi=()=>window.devicePixelRatio||1;
  const appearance=()=>window.MeasureLabAppearance;
  const annotationScale=()=>appearance()?.scale()||1;
  const hit=(p,r)=>{if(!r)return false;const g=r.layout;if(!g)return p[0]>=r[0]&&p[0]<=r[2]&&p[1]>=r[1]&&p[1]<=r[3];const dx=p[0]-g.center[0],dy=p[1]-g.center[1],c=Math.cos(g.angle),s=Math.sin(g.angle);return Math.abs(dx*c+dy*s)<=g.width/2+5*dpi()&&Math.abs(-dx*s+dy*c)<=g.height/2+5*dpi();};
  const lab=window.MeasureLabGeometry={version:5,arrowLabels:new Map(),dimensionLabels:new Map(),sideCache:new Map(),sidePending:new Set(),lastSides:[],autoAnchors:[]};
  lab.arrowLength=(lw)=>zArrL(lw);

  // This is exactly the post layout used by native drawMk (including the
  // photo-derived center offset). One source for visible posts and their hits.
  rzIcons=function(e){
    const W=wf(),s=f81gIcS(e),c=toW(e.c,W),N=rzN(e),st=+e.st||0,z=w3IcZ();
    const sp=N>1&&st?Math.hypot(...sub(toScr(...fromW([c[0]+st,c[1]],W)),s)):0;
    return {z,cs:sp>=z?Array.from({length:N},(_,i)=>toScr(...fromW([c[0]-(N-1)*st/2+i*st,c[1]],W))):Array.from({length:N},(_,i)=>[s[0]+(i-(N-1)/2)*z*.84,s[1]])};
  };
  // Use native head scaling by default. The optional size preference is a
  // multiplier around the native formula, never a fixed screen-size replacement.
  const nativeArrowLength=zArrL;
  zArrL=function(lw){const factor=Number(settings().arrowPx)||9,scale=annotationScale();return nativeArrowLength(lw/scale)*scale*(factor/9);};
  lab.projectEndpoint=function(point,drawing,field){
    if(!point||S.mode==='plan')return toScr(...point);
    const constrained=drawing&&window.MeasureLabSnap?.projectDrawing?.(drawing);if(constrained?.[field])return constrained[field].slice();
    const ref=drawing?.labAnchors?.[field];
    if(ref){const resolved=window.MeasureLabSnap?.resolveRef(ref);if(resolved)return resolved.screen.slice();}
    // Compatibility for previews/historical callers only; saved drawings use
    // durable element/post identity, never an exact-coordinate lookup.
    if(!drawing){const candidate=window.MeasureLabSnap?.candidates().find(c=>c.ref&&Math.hypot(c.point[0]-point[0],c.point[1]-point[1])<.001);if(candidate)return candidate.screen.slice();}
    return toScr(...point);
  };
  function alignScreenEndpoint(A,B,visible){
    const dx=B[0]-A[0],dy=B[1]-A[1],length=Math.hypot(dx,dy)||1,u=[dx/length,dy/length],delta=[visible[0]-B[0],visible[1]-B[1]],along=delta[0]*u[0]+delta[1]*u[1];
    return {A:[A[0]+delta[0]-u[0]*along,A[1]+delta[1]-u[1]*along],B:visible.slice()};
  }
  lab.projectRz=function(q,G,P){
    const A=P(G.A),B=P(G.B),icons=rzIcons(G.e),post=Math.max(0,Math.min(icons.cs.length-1,(+q.rz.p||1)-1));
    return alignScreenEndpoint(A,B,icons.cs[post]||B);
  };
  // Auto dimensions already contain correct millimeter values. Correct only
  // their visible endpoint when native icons spread a grouped outlet in pixels.
  const nativeAdimRefs=adimRefs;
  adimRefs=function(e){const result=nativeAdimRefs.apply(this,arguments);if(lab.inAuto)lab.autoContext={e,result};return result;};
  const nativeDimLine=dimLine;
  dimLine=function(a,b,side,text,color){
    lab.lastAutoLine=null;
    if(lab.inAuto&&lab.autoContext){
      const {e}=lab.autoContext;
      if(KD[e.k]?.pt&&layOn(e)){
        const X=rzX(),N=rzN(e),B=toScr(...b),icons=rzIcons(e);let post=0,best=Infinity;
        for(let j=0;j<N;j++){const p=toScr(...fromWc(rzPost(e,j+1,X),X.W,X.C)),distance=Math.hypot(p[0]-B[0],p[1]-B[1]);if(distance<best){best=distance;post=j;}}
        if(best<2*dpi()){
          const adjusted=alignScreenEndpoint(toScr(...a),B,icons.cs[post]);
          lab.lastAutoLine={A:adjusted.A.slice(),B:adjusted.B.slice()};
          lab.autoAnchors.push({id:e.id,post:post+1,physical:B.slice(),visible:icons.cs[post].slice(),A:adjusted.A.slice(),B:adjusted.B.slice(),text:String(text)});
          return nativeDimLine(toPl(...adjusted.A),toPl(...adjusted.B),side,text,color);
        }
      }
    }
    return nativeDimLine.apply(this,arguments);
  };
  const nativeAutoDraw=drawAutoDims;
  drawAutoDims=function(){lab.inAuto=true;lab.autoAnchors=[];try{return nativeAutoDraw.apply(this,arguments);}finally{lab.inAuto=false;lab.autoContext=null;}};

  // A single tangent layout drives paint, rotated hit tests and the inline input.
  function labelGeometry(A,B,text){
    const dx=B[0]-A[0],dy=B[1]-A[1];if(Math.hypot(dx,dy)<=1)return null;
    let angle=Math.atan2(dy,dx);if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
    const d=dpi(),cfg=settings();cx.save();cx.font=`bold ${12*d}px system-ui`;const tw=cx.measureText(text).width;cx.restore();
    return {center:[(A[0]+B[0])/2,(A[1]+B[1])/2],angle,width:Math.max(tw+8*d*annotationScale(),(appearance()?.fieldPx()||cfg.fieldPx||10)*d),height:(appearance()?.fieldPx()||Math.max(cfg.fieldPx||16,(cfg.textPx||12)+2))*d,text};
  }
  function labelLayout(q){return labelGeometry(lab.projectEndpoint(q.a,q,'a'),lab.projectEndpoint(q.b,q,'b'),q.k==='arr'?((q.vm??q.v)>0?String(q.vm??q.v):'мм'):String(dmVal(q)));}
  function labelRect(g){
    if(!g)return null;const d=5*dpi(),c=Math.abs(Math.cos(g.angle)),s=Math.abs(Math.sin(g.angle)),w=c*g.width/2+s*g.height/2+d,h=s*g.width/2+c*g.height/2+d,r=[g.center[0]-w,g.center[1]-h,g.center[0]+w,g.center[1]+h,...g.center];r.layout=g;return r;
  }
  function paintLabel(g,color,border=false){
    if(!g)return null;const d=dpi();cx.save();cx.translate(...g.center);cx.rotate(g.angle);cx.font=`bold ${12*d}px system-ui`;cx.textBaseline='middle';cx.textAlign='center';cx.fillStyle='rgba(255,255,255,.96)';cx.fillRect(-g.width/2,-g.height/2,g.width,g.height);
    if(border){cx.strokeStyle=color;cx.lineWidth=d*(appearance()?.strokeFactor()||1);cx.strokeRect(-g.width/2,-g.height/2,g.width,g.height);}
    cx.fillStyle=color;cx.fillText(g.text,0,0);cx.restore();return labelRect(g);
  }
  lab.labelLayout=labelLayout;lab.labelHit=hit;
  lab.drawLabel=function(q){const r=paintLabel(labelLayout(q),zdSel(q)?'#1F6FD1':q.c||kC(q.k||'dim'));if(q.id&&r)(q.k==='arr'?lab.arrowLabels:lab.dimensionLabels).set(q.id,r);return r;};
  lab.drawRzLabel=function(A,B,o){return paintLabel(labelGeometry(A,B,String(o.lab)),o.col||'#1F6FD1',true);};
  const nativeZdDraw=zdDraw;
  zdDraw=function(q){const result=nativeZdDraw.apply(this,arguments);if(q.k==='arr'&&q.a&&q.b)lab.drawLabel(q);return result;};
  function activeLabel(k){if(k?.t==='lab-arr')return lab.arrowLabels.get(k.id);if(k?.t==='lab-dim')return lab.dimensionLabels.get(k.id);if(k?.t==='rz')return RZ.scr[k.id]?.r;return null;}
  function orientField(){
    const i=$('w3f'),r=activeLabel(i._k);if(!i.classList.contains('on')||!r?.layout)return;
    const canvas=cv.getBoundingClientRect(),d=dpi();i.style.left=(canvas.left+r[4]/d)+'px';i.style.top=(canvas.top+r[5]/d)+'px';i.style.transform=`rotate(${r.layout.angle}rad)`;i.style.transformOrigin='center';
  }
  function keepFieldVisible(){
    const i=$('w3f');if(!i.classList.contains('on')||!activeLabel(i._k)?.layout)return;
    const r=i.getBoundingClientRect(),canvas=cv.getBoundingClientRect(),kb=$('zkb').getBoundingClientRect(),top=Math.max(8,canvas.top+8),bottom=Math.min(innerHeight-8,document.body.classList.contains('kb')&&kb.height>0?kb.top-8:innerHeight-8);
    const dx=r.left<8?8-r.left:r.right>innerWidth-8?innerWidth-8-r.right:0,dy=r.top<top?top-r.top:r.bottom>bottom?bottom-r.bottom:0;
    if(Math.abs(dx)>.5||Math.abs(dy)>.5){S.view.ox+=dx*dpi();S.view.oy+=dy*dpi();draw();}
  }
  window.addEventListener('resize',()=>requestAnimationFrame(keepFieldVisible));
  const nativeOpenAt=w3FOpenAt;
  w3FOpenAt=function(c,k){const i=$('w3f');i.style.transform='';const r=activeLabel(k);const result=nativeOpenAt.call(this,r?[r[4],r[5]]:c,k);i.style.transform='';orientField();keepFieldVisible();requestAnimationFrame(()=>{if(i._k===k){orientField();keepFieldVisible();}});return result;};
  const nativeOpen=w3FOpen;
  w3FOpen=function(){const i=$('w3f');i.style.transform='';const result=nativeOpen.apply(this,arguments);i.style.transform='';return result;};
  const nativeDraw=draw;
  draw=function(){window.MeasureLabSnap?.syncAll();lab.arrowLabels.clear();lab.dimensionLabels.clear();const result=nativeDraw.apply(this,arguments);orientField();return result;};
  function editArrow(q){if(!q||q.k!=='arr')return;const r=lab.arrowLabels.get(q.id);if(!r)return;w3FOpenAt([r[4],r[5]],{t:'lab-arr',id:q.id,v:(q.vm??q.v)>0?(q.vm??q.v):''});}
  function editDimension(q){const r=lab.dimensionLabels.get(q.id);if(!r)return;w3FOpenAt([r[4],r[5]],{t:'lab-dim',id:q.id,v:q.vm>0?q.vm:''});}
  const nativeFieldSet=w3FSet;
  w3FSet=function(k,n){
    if(k?.t==='lab-arr'||k?.t==='lab-dim'){
      const q=k.t==='lab-arr'?S.drw.find(q=>q.id===k.id&&q.k==='arr'):S.dms.find(q=>q.id===k.id&&!q.rz);if(!q||!(Number.isFinite(+n)&&+n>0))return;
      snap();q.vm=r1(+n);if(k.t==='lab-arr'){delete q.v;q.labMeasure=true;}saveSess();mkPanel();draw();return;
    }
    return nativeFieldSet.apply(this,arguments);
  };
  const nativeZdPanel=zdPanel;
  zdPanel=function(pp){const result=nativeZdPanel.apply(this,arguments),q=zdGet(S.dsel);if(q?.k==='arr'){const b=document.createElement('button');b.id='lab-arrow-value';b.type='button';b.textContent=(q.vm??q.v)>0?`${q.vm??q.v} мм`:'Ввести размер';b.onclick=()=>editArrow(q);pp.querySelector('.row')?.prepend(b);}return result;};
  cv.addEventListener('pointerdown',event=>{
    if(S.mode==='plan'||S.show>=0||S.tool!=='mk'||!['sel','arr','dim'].includes(S.mk)||ptr.size)return;
    const r=cv.getBoundingClientRect(),p=[(event.clientX-r.left)*dpi(),(event.clientY-r.top)*dpi()];
    for(const [id,rect] of lab.arrowLabels)if(hit(p,rect)){const q=S.drw.find(q=>q.id===id);if(q){event.preventDefault();event.stopImmediatePropagation();editArrow(q);}return;}
    for(const [id,rect] of lab.dimensionLabels)if(hit(p,rect)){const q=S.dms.find(q=>q.id===id);if(q){event.preventDefault();event.stopImmediatePropagation();editDimension(q);}return;}
  },true);
  const nativeDmOut=dmOut;
  dmOut=function(){const result=nativeDmOut.apply(this,arguments);for(const record of result.drw||[]){const q=S.drw.find(q=>q.id===record.id);if(q?.k==='arr'&&(q.vm??q.v)>0){record.v=+(q.vm??q.v);record.measurement={reference:'tip',units:'mm'};}}return result;};

  // Adjacent wall content uses the actual saved neighbor's exported mm geometry.
  // v81's side face represents the first <=1000 mm from the common corner.
  // Clip to that same face: an element beyond it is omitted, never squeezed in.
  function neighborRecord(id){if(lab.sideCache.has(id))return lab.sideCache.get(id);if(!lab.sidePending.has(id)){lab.sidePending.add(id);dbGet('sess',id).then(rec=>{lab.sideCache.set(id,rec||null);lab.sidePending.delete(id);draw();}).catch(()=>lab.sidePending.delete(id));}return null;}
  function renderSides(M){lab.lastSides=[];if(!settings().sideElements||!M||!S.room0)return;const room=S.room0,m=room.ms,faces=w3Faces(M),d=dpi();
    for(const key of ['L','R']){const face=faces.find(f=>f.k===key);if(!face?.vis||!M.sd[key])continue;const j=M.sd[key].j,sid=room.segs?.[j];if(!sid)continue;const record=neighborRecord(sid),out=record?.out;if(!out)continue;
      const [pa,pb]=plSeg(m,j),raw=Math.hypot(pb[0]-pa[0],pb[1]-pa[1]);if(!(raw>0))continue;
      const measured=out.dims?.Lb?.v||record.q4?.L||plLen(m,j)?.v||raw,nb=w3Ax(m,j),corner=key==='L'?M.ax.Lp:M.ax.Rp,atLeft=Math.hypot(corner[0]-nb.Lp[0],corner[1]-nb.Lp[1])<.5,span=Math.min(1000,raw)*measured/raw;
      const top=M.P[key==='L'?'A':'B'],bottom=M.P[key==='L'?'D':'C'],farTop=M.P[key+'T'],farBottom=M.P[key+'B'];
      const project=(x,y)=>{const t=(atLeft?x:measured-x)/span,h=y/M.H;return w3S([bottom[0]+(farBottom[0]-bottom[0])*t+(top[0]-bottom[0]+((farTop[0]-farBottom[0])-(top[0]-bottom[0]))*t)*h,bottom[1]+(farBottom[1]-bottom[1])*t+(top[1]-bottom[1]+((farTop[1]-farBottom[1])-(top[1]-bottom[1]))*t)*h,bottom[2]+(farBottom[2]-bottom[2])*t+(top[2]-bottom[2]+((farTop[2]-farBottom[2])-(top[2]-bottom[2]))*t)*h]);};
      cx.save();cx.beginPath();face.ks.forEach((k,i)=>{const p=w3S(M.P[k]);i?cx.lineTo(...p):cx.moveTo(...p);});cx.closePath();cx.clip();cx.globalAlpha=.8;cx.lineWidth=1.25*d;cx.setLineDash([]);
      let count=0;
      for(const element of out.els||[]){if(element.t==='pt'||element.cand)continue;let points;if(element.t==='poly'&&element.pts)points=element.pts;else if((element.t==='rc'||element.t==='rect')&&Number.isFinite(+element.x)&&Number.isFinite(+element.W))points=[[element.x,element.y],[element.x+element.W,element.y],[element.x+element.W,element.y+element.H],[element.x,element.y+element.H]];else if(Number.isFinite(+element.x0)&&Number.isFinite(+element.x1))points=[[element.x0,element.y0],[element.x1,element.y0],[element.x1,element.y1],[element.x0,element.y1]];if(!points)continue;const ds=points.map(p=>atLeft?p[0]:measured-p[0]);if(Math.min(...ds)>span||Math.max(...ds)<0)continue;const P=points.map(p=>project(+p[0],+p[1]));cx.strokeStyle='#687f93';cx.fillStyle='rgba(214,230,240,.32)';cx.beginPath();P.forEach((p,i)=>i?cx.lineTo(...p):cx.moveTo(...p));cx.closePath();cx.fill();cx.stroke();if((element.t==='win'||element.kind==='win')&&P.length===4){cx.beginPath();cx.moveTo((P[0][0]+P[1][0])/2,(P[0][1]+P[1][1])/2);cx.lineTo((P[2][0]+P[3][0])/2,(P[2][1]+P[3][1])/2);cx.stroke();}count++;}
      for(const element of [...(out.pts||[]),...(out.els||[]).filter(e=>e.t==='pt')]){const distance=atLeft?+element.x:measured-element.x;if(!(distance>=0&&distance<=span)||element.cand)continue;const p=project(+element.x,+element.y);cx.strokeStyle=(element.t==='gvs'||element.kind==='gvs')?'#c46f62':'#527eaa';cx.fillStyle='#fff';cx.beginPath();cx.arc(p[0],p[1],3.5*d,0,Math.PI*2);cx.fill();cx.stroke();count++;}
      cx.restore();lab.lastSides.push({side:key,neighbor:j,session:sid,count,spanMm:span,flipped:!atLeft});
    }
  }
  const oldW3Draw=w3Draw;
  w3Draw=function(top){const result=oldW3Draw.apply(this,arguments);if(!top)try{renderSides(w3Model());}catch(error){console.warn('Measure Lab adjacent walls',error);}return result;};
  const oldOpenSess=openSess;
  openSess=async function(){lab.sideCache.clear();const result=await oldOpenSess.apply(this,arguments);draw();return result;};
  window.addEventListener('measure-lab-settings',()=>draw());
  Object.assign(PM,{labGeometry:lab,labArrowEdit:editArrow,draw:(...args)=>draw(...args),openSess:(...args)=>openSess(...args),rzDraw:(...args)=>rzDraw(...args),rzPlan:(...args)=>rzPlan(...args),rzTapPlan:(...args)=>rzTapPlan(...args),zdPanel:(...args)=>zdPanel(...args),dmDraw:(...args)=>dmDraw(...args),dmOut:(...args)=>dmOut(...args),rzArrow:(...args)=>rzArrow(...args),zdDraw:(...args)=>zdDraw(...args),w3FSet:(...args)=>w3FSet(...args),w3FOpen:(...args)=>w3FOpen(...args),drawAutoDims:(...args)=>drawAutoDims(...args),rzIcons:(...args)=>rzIcons(...args)});
  lab.redraw=()=>draw();
  lab.annotationValue=(id,value)=>{const q=S.drw.find(q=>q.id===id&&q.k==='arr');if(!q||!(Number.isFinite(+value)&&+value>0))return false;snap();q.vm=+value;q.labMeasure=true;saveSess();draw();return true;};
  draw();
})();
