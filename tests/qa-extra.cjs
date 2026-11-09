const fs=require('fs'),path=require('path');
module.exports=async({pg,chk,root})=>{
 await pg.evaluate(()=>{MeasureLabUI.settings()});
 for(const [key,value] of [['textPx',6],['fieldPx',10]]){const n=pg.locator(`#labModal input[type=number][data-lab-setting=${key}]`);chk(await n.getAttribute('min')===String(value),`${key} input allows minimum ${value}`);await n.fill(String(value));await n.dispatchEvent('input');}
 chk(await pg.evaluate(()=>MeasureLabSettings.current.textPx===6&&MeasureLabSettings.current.fieldPx===10),'settings apply text6/field10');
 const font=await pg.evaluate(()=>{const g=document.getElementById('cv').getContext('2d');g.font='bold 31px system-ui';return g.font});chk(font.includes('12px'),'canvas font setter honors6px at DPR2',font);
 await pg.evaluate(()=>MeasureLabUI.close());await pg.reload();await pg.waitForFunction(()=>window.MeasureLabUI);
 chk(await pg.evaluate(()=>MeasureLabSettings.current.textPx===6&&MeasureLabSettings.current.fieldPx===10),'settings persist after reload');
 // Restore normal legible defaults for further screenshots while retaining minima evidence.
 await pg.evaluate(()=>{Object.assign(MeasureLabSettings.current,MeasureLabSettings.defaults);MeasureLabUI.apply()});
 await pg.evaluate(async()=>{await PM.newRoom('QA geometry','Open');Object.assign(PM.S.room.ms,{pts:[[0,0],[4000,0],[4000,3000],[0,3000]],closed:true,H:2700});PM.gnFix();await PM.openWall(0);PM.bwSet(4000,2700);PM.zmSet('mk');document.body.classList.remove('tz');PM.fit();PM.draw()});await pg.waitForTimeout(500);
 const tabs=await pg.locator('#wrowC button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height}}));chk(tabs.length>=4&&tabs.every(r=>Math.abs(r.w-r.h)<.01&&Math.abs(r.w-tabs[0].w)<.01),'wall buttons equal squares',tabs);
 await pg.evaluate(()=>{PM.pickTool('dim');PM.mkPanel();PM.zLay()});await pg.waitForTimeout(150);
 const row=await pg.evaluate(()=>{const z=document.getElementById('zb').getBoundingClientRect(),ch=document.getElementById('ch').getBoundingClientRect(),opt=document.getElementById('zopt').getBoundingClientRect();return {z:[z.left,z.right,z.top],ch:[ch.left,ch.right,ch.top],opt:[opt.left,opt.right,opt.top,opt.bottom],parent:document.getElementById('zopt').parentElement.id}});
 chk(row.parent==='zf'&&row.opt[3]>row.opt[2]&&row.opt[3]<=row.z[2]+1,'modifiers above tools',row);chk(Math.abs(row.z[0]-row.ch[0])<=10&&Math.abs(row.z[1]-row.ch[1])<=10,'tool row spans full strip',row);
 await pg.evaluate(()=>{PM.S.els.push({id:'qa-window',k:'win',c:[1700,1450],W:800,H:600,note:'QA window'},{id:'qa-outlet',k:'roz',c:[500,400],note:'QA outlet'});PM.S.dms.push({id:'qa-dim',a:[400,400],b:[1200,400],vm:800,t:'both'});PM.S.drw.push({id:'qa-arrow',k:'arr',a:[1400,700],b:[1200,700],c:'#1f6fd1'});PM.labGeometry.annotationValue('qa-arrow',450);PM.draw()});
 const zooms=await pg.evaluate(()=>{const out=[];for(const factor of [.5,1,2]){PM.S.view.s=PM.S.fitS*factor;PM.draw();const q=PM.S.drw.find(x=>x.id==='qa-arrow'),r=PM.labGeometry.arrowLabels.get(q.id);out.push({factor,a:q.a,b:q.b,vm:q.vm,label:r,head:PM.labGeometry.arrowLength()})}return out});
 chk(zooms.every(z=>z.vm===450&&JSON.stringify(z.a)==='[1400,700]'&&JSON.stringify(z.b)==='[1200,700]'),'arrow mm anchor data stable at0.5/1/2x',zooms.map(z=>({factor:z.factor,a:z.a,b:z.b,vm:z.vm})));
 chk(zooms.every(z=>z.label?.length===6&&Number.isFinite(z.label[0])),'numeric arrow label projects at every zoom');
 const heads=zooms.map(z=>z.head);chk(heads.every(h=>Math.abs(h-heads[0])<.01),'arrowheads screen size stable across zoom',heads);
 await pg.evaluate(()=>{PM.labArrowEdit(PM.S.drw.find(x=>x.id==='qa-arrow'))});await pg.locator('#lab-arrow-number').fill('475');await pg.locator('#lab-arrow-editor [data-la=save]').click();chk(await pg.evaluate(()=>PM.S.drw.find(q=>q.id==='qa-arrow').vm===475),'numeric arrow editor changes value');
 await pg.evaluate(()=>PM.saveNow());await pg.waitForTimeout(500);
 const exported=await pg.evaluate(()=>PM.exportObjObj());fs.writeFileSync(path.join(root,'tests','rich-export.json'),JSON.stringify(exported,null,2));
 const wall=Object.values(exported.rooms[0].ms.wl).find(w=>(w.drw||[]).length);
 chk(!!wall&&(wall.els||[]).some(e=>e.t==='win')&&(wall.pts||[]).length>0,'export contains window and communication',wall&&{els:wall.els,pts:wall.pts});
 chk(!!wall&&(wall.dm||[]).some(q=>q.v===800),'export contains measured dimension');chk(!!wall&&(wall.drw||[]).some(q=>q.k==='arr'&&q.v===475),'export contains one-head arrow value');
 const rid=await pg.evaluate(()=>PM.S.sess.id);await pg.reload();await pg.waitForFunction(()=>window.MeasureLabUI);await pg.evaluate(id=>PM.openSess(id),rid);await pg.waitForTimeout(250);chk(await pg.evaluate(()=>PM.S.drw.some(q=>q.k==='arr'&&q.vm===475)),'arrow value survives app reload');
 // Import true object into fresh room; preserve open-room/blank name and annotation values.
 const standalone=await pg.evaluate(async()=>{await PM.newSess('QA roundtrip','');PM.bwSet(3500,2650);PM.S.drw.push({id:'qa-round-arrow',k:'arr',a:[700,500],b:[400,500],c:'#1f6fd1',vm:123});return PM.exportObjObj()});fs.writeFileSync(path.join(root,'tests','standalone-export.json'),JSON.stringify(standalone,null,2));
 await pg.evaluate(o=>zImpExp(o),standalone);await pg.waitForTimeout(250);const imported=await pg.evaluate(()=>({name:PM.S.room.name,closed:PM.S.room.ms.closed,pts:PM.S.room.ms.pts,segs:PM.S.room.segs}));chk(imported.name===''&&imported.closed===false&&imported.pts.length===2,'standalone restores as unnamed open one-wall room',imported);
 await pg.evaluate(()=>PM.openWall(0));await pg.waitForTimeout(200);chk(await pg.evaluate(()=>PM.S.drw.some(q=>q.k==='arr'&&(q.vm??q.v)===123)),'arrow value survives JSON restore');const reexport=await pg.evaluate(()=>PM.exportObjObj());chk(reexport.rooms.some(r=>Object.values(r.ms.wl).some(w=>(w.drw||[]).some(q=>q.k==='arr'&&q.v===123))),'restored arrow reexports numeric value');
 await pg.evaluate(()=>MeasureLabUI.rooms());await pg.waitForTimeout(150);chk(await pg.locator('#labModal').innerText().then(t=>t.includes('открытое помещение')),'room manager recognizes unnamed open room');await pg.evaluate(()=>MeasureLabUI.close());
 // Evaluate exact Android version-switch transaction code, not an invented substitute.
 const java=fs.readFileSync(path.join(root,'android/app/src/main/java/ge/akrix/zamer/MainActivity.java'),'utf8'),match=java.match(/String code=("(?:[^"\\]|\\.)*");/);if(match){const code=JSON.parse(match[1]);await pg.evaluate(()=>{window.__choose={ready:0,errors:[]};window.AkrixLab={readyToChoose(){__choose.ready++},saveFailed(m){__choose.errors.push(m)}}});await pg.evaluate(code);chk(await pg.evaluate(()=>__choose.ready===1&&__choose.errors.length===0),'exact native chooser script commits before switch');
 await pg.evaluate(()=>{window.__origTx=DB.db.transaction.bind(DB.db);DB.db.transaction=()=>{throw Error('QA blocked write')}});await pg.evaluate(code);chk(await pg.evaluate(()=>__choose.ready===1&&__choose.errors.some(s=>s.includes('QA blocked write'))),'native chooser refuses switch on storage failure');await pg.evaluate(()=>{DB.db.transaction=__origTx});}
 await pg.screenshot({path:path.join(root,'tests','qa-integrated-wall.png')});
};
