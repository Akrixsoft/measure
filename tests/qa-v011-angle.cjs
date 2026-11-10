// AKX-2026-0009: ∠° tilts the whole wall view (v81 isometric shift); screen angle of the depth axis = slider value.
const {start}=require('./qa-v011-harness.cjs');let h;(async()=>{h=await start();const {p,check}=h;await h.wall();
await p.evaluate(async()=>{const rid=PM.S.room0.id;await PM.openRoom(rid);await PM.openWall(0);PM.tool('mk');PM.zmSet('mk');PM.S.els=[{id:'tilt-col',k:'kol',c:fromW([1000,1350]),W:400,H:2700,D:400}];await PM.saveNow();PM.W3.a=90;PM.fit();window.__angleView={...PM.S.view};PM.draw()});
const original=await p.evaluate(async()=>({front:Object.fromEntries(['A','B','C','D'].map(k=>[k,PM.w3Model().P[k]])),plan:JSON.stringify(PM.S.room0.ms),els:JSON.stringify(PM.S.els),exported:JSON.stringify(await PM.exportObjObj()),mos:PM.S.mosaic?Array.from(mosM()):null,glyph:w3IcZ(),scale:PM.W3.f}));
// v81 default (a = 90) must stay exactly the v81 projection: depth per mm = (0.6*(2x/L-1), -0.6).
const v81=await p.evaluate(()=>{const m=PM.w3Model(),L=m.L,P=[[0,0,1000],[L,0,1000],[L/2,1000,500]],tol=1e-9;return P.every(q=>{const a=w3Pl(q),b=fromW([q[0]+q[2]*0.6*(2*q[0]/L-1),q[1]-0.6*q[2]]);return Math.abs(a[0]-b[0])<tol&&Math.abs(a[1]-b[1])<tol})});check(v81,'90 degrees is bit-for-bit the v81 default projection');
async function penSet(target){const r=await p.locator('#w3sl input').boundingBox(),y=r.y+r.height/2;let x=r.x+8+target/180*(r.width-16),v=null;for(let i=0;i<8;i++){await h.drag('pen',[x,y],[x+.01,y],{css:true});await p.waitForTimeout(40);v=await p.evaluate(()=>+document.querySelector('#w3sl input').value);if(v===target)break;x+=(target-v)*(r.width-16)/180;x=Math.max(r.x+1,Math.min(r.x+r.width-1,x))}return v}
const deg=(u,v)=>{let t=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1])*180/Math.PI;if(t<-179)t+=360;return t};
const frames=[];
for(const angle of [0,45,90,135,180]){if(!await p.locator('#w3sl').isVisible())await p.locator('#mdT [data-w3s="a"]').click();const got=await penSet(angle);
 const f=await p.evaluate(()=>{PM.draw();const m=PM.w3Model(),P=m.P,S2=k=>w3S(P[k]),V=w3Vols(m).find(v=>v.id==='tilt-col'),sub2=(a,b)=>[a[0]-b[0],a[1]-b[1]],mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
  const front=Object.fromEntries(['A','B','C','D'].map(k=>[k,P[k]])),scr=Object.fromEntries(['A','B','C','D','FL','FR','LB','RB','LT','RT'].filter(k=>P[k]).map(k=>[k,S2(k)]));
  const faces=w3Faces(m),vis=Object.fromEntries(faces.map(x=>[x.k,x.vis]));
  // volume depth edge vs floor depth field at the same x (floor depth vector is linear in x between D->FL and C->FR)
  const t=V?V.x0/m.L:0,fd=[(scr.FL[0]-scr.D[0])*(1-t)+(scr.FR[0]-scr.C[0])*t,(scr.FL[1]-scr.D[1])*(1-t)+(scr.FR[1]-scr.C[1])*t].map(q=>q/1000),vd=V?sub2(w3S(V.P.KLB),w3S(V.P.WLB)).map(q=>q/V.D):null;
  const nm=(PM.S.w3T||[]).filter(q=>q.k==='nm').map(q=>{const F=faces.find(x=>x.k===q.s);return{s:q.s,c:q.c,inside:!!F&&inPoly(q.c,F.ks.map(k=>S2(k)))}});
  return{value:PM.W3.a,label:document.querySelector('#w3sl .v').textContent,ticks:[...document.querySelectorAll('#w3sl .t span')].map(s=>s.textContent),range:(i=>[i.min,i.max,i.step])(document.querySelector('#w3sl input')),front,scr,vis,fd,vd,nm,plan:JSON.stringify(PM.S.room0.ms),els:JSON.stringify(PM.S.els),mos:(()=>{if(!PM.S.mosaic)return null;const v=PM.S.view;PM.S.view={...__angleView};const r=Array.from(mosM());PM.S.view=v;return r})(),glyph:w3IcZ(),scale:PM.W3.f,farHit:w3Hit(S2('LB')),pvL:w3PV(m).has('LB'),pvR:w3PV(m).has('RB')}});
 const s=f.scr,u=[s.C[0]-s.D[0],s.C[1]-s.D[1]],axis=[(s.FL[0]+s.FR[0])/2-(s.D[0]+s.C[0])/2,(s.FL[1]+s.FR[1])/2-(s.D[1]+s.C[1])/2],shown=deg(u,axis);
 const left=deg(u,[s.LB[0]-s.D[0],s.LB[1]-s.D[1]]),right=deg(u,[s.RB[0]-s.C[0],s.RB[1]-s.C[1]]),lenL=Math.hypot(s.LB[0]-s.D[0],s.LB[1]-s.D[1]),lenR=Math.hypot(s.RB[0]-s.C[0],s.RB[1]-s.C[1]);
 frames.push({angle,got,shown,left,right,lenL,lenR,...f});
 check(got===angle&&f.value===angle&&f.label===angle+'°','pen sets ∠° slider to '+angle+' through the interface',{got,value:f.value,label:f.label});
 check(JSON.stringify(f.range)===JSON.stringify(['0','180','1'])&&JSON.stringify(f.ticks)===JSON.stringify(['0° · слева','90° · прямо','180° · справа']),angle+' slider range 0..180 step 1 with v81 ticks',f);
 check(Math.abs(shown-angle)<=1,angle+' screen angle wall line -> floor depth axis equals slider value',{shown:+shown.toFixed(3)});
 check(Math.hypot(s.LB[0]-s.FL[0],s.LB[1]-s.FL[1])<.5&&Math.hypot(s.RB[0]-s.FR[0],s.RB[1]-s.FR[1])<.5,angle+' floor and side walls share their bottom edges (LB=FL, RB=FR on screen)',{LB:s.LB,FL:s.FL,RB:s.RB,FR:s.FR});
 check((lenL<1||Math.abs(left-(90+angle/2))<=1)&&(lenR<1||Math.abs(right-angle/2)<=1),angle+' side walls keep the v81 fan: left 90+a/2, right a/2 (or edge-on)',{left,right,lenL,lenR});
 check(f.vd&&Math.abs(f.vd[0]-f.fd[0])<.01&&Math.abs(f.vd[1]-f.fd[1])<.01,angle+' column volume depth follows the floor depth field',{vd:f.vd,fd:f.fd});
 check(f.nm.every(q=>q.inside),angle+' side wall names stay on their tilted faces',f.nm);
 check(f.pvL||f.farHit!=='LB',angle+' hidden side point cannot be edited',{pvL:f.pvL,farHit:f.farHit});
 check(JSON.stringify(f.front)===JSON.stringify(original.front)&&f.plan===original.plan&&f.els===original.els,angle+' measured front, plan and wall objects unchanged');
 check(JSON.stringify(f.mos)===JSON.stringify(original.mos)&&f.glyph===original.glyph&&f.scale===original.scale,angle+' front photo transform and Aa/icon size unchanged');
 if([0,90,135,180].includes(angle))await p.screenshot({path:h.root+`/tests/qa-v011-angle${angle}.png`});}
const tilt=frames.map(f=>f.scr.FL[0]-f.scr.D[0]);check(tilt.every((v,i)=>!i||v<tilt[i-1]),'whole view tilts monotonically one way as the slider grows',tilt);
const exported=await p.evaluate(async()=>JSON.stringify(await PM.exportObjObj()));const strip=s=>JSON.stringify(JSON.parse(s).rooms.map(r=>({pts:r.ms.pts,angs:r.ms.angs,dims:r.ms.dims,shp:r.ms.shp})));check(strip(exported)===strip(original.exported),'display slider does not alter exported plan, dims or measured angles');
check(h.errors.length===0,'no browser errors',h.errors);h.save('qa-v011-angle.json',{frames,original:{front:original.front}});await h.close();process.exitCode=h.checks.some(c=>!c.ok)?1:0})().catch(async e=>{console.error(e);if(h)await h.close();process.exitCode=1});
