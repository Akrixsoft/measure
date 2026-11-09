const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const target=process.argv[2]||'web/experimental.html';
const extensions=(process.env.QA_EXTENSIONS||'').split(',').filter(Boolean);
const checks=[],errors=[];let browser,server;
function chk(ok,name,details){checks.push({ok:!!ok,name,...(details!==undefined?{details}:{})});console.log((ok?'PASS ':'FAIL ')+name+(details!==undefined?' '+JSON.stringify(details):''));}
(async()=>{
 chk(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'web/v81.html'))).digest('hex')==='b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191','baseline v81 byte-exact');
 server=http.createServer((req,res)=>{let f=path.join(root,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');let body=fs.readFileSync(f);if(f.endsWith('.html')&&extensions.length)body=body.toString().replace('</body>',extensions.map(x=>'<script src="/'+x+'"></script>').join('')+'</body>');res.end(body)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{window.__qaExports=[];window.AkrixApp={save(fn,mime,text){window.__qaExports.push({fn,mime,text})},version(){return'qa-browser'}};});
 const pg=await context.newPage();pg.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/${target}`;await pg.goto(url+'?nolist');await pg.waitForFunction(()=>window.PM?.newRoom);await pg.waitForTimeout(300);
 chk(await pg.evaluate(()=>!!window.PM),'app boots');
 await pg.evaluate(async()=>{await PM.newRoom('QA Open','');PM.S.room.name='';Object.assign(PM.S.room.ms,{pts:[[0,0],[4000,0],[4000,3000]],closed:false,H:2700,dims:[{id:'d0',a:{p:0},b:{p:1},v:4000},{id:'d1',a:{p:1},b:{p:2},v:3000}]});PM.gnFix();PM.mkPanel();PM.fit();PM.draw();PM.saveRoom()});await pg.waitForTimeout(650);
 const rid=await pg.evaluate(()=>PM.S.room.id);
 const open=await pg.evaluate(async()=>({room:await PM.exportRoomObj(),obj:await PM.exportObjObj()}));
 chk(open.room.ms.closed===false,'open room remains open on export');chk(Object.keys(open.room.ms.wl).length===2,'open polyline exports exactly two walls');chk(open.obj.rooms.length===1,'open room included in object');chk(Object.values(open.room.ms.wl).every(w=>w.id),'exported walls have IDs');
 const dims=Object.values(open.room.ms.wl).map(w=>w.L);chk(dims.length===2&&dims[0]===4000&&dims[1]===3000,'measured lengths retained',dims);
 await pg.reload();await pg.waitForFunction(()=>window.PM?.newRoom);await pg.evaluate(async id=>await PM.openRoom(id),rid);const restored=await pg.evaluate(()=>({pts:PM.S.room.ms.pts,closed:PM.S.room.ms.closed,name:PM.S.room.name}));chk(restored.closed===false&&JSON.stringify(restored.pts)===JSON.stringify([[0,0],[4000,0],[4000,3000]]),'open room geometry survives reload');
 await pg.evaluate(async()=>{await PM.openWall(0);PM.bwSet(4000,2700);PM.saveNow()});await pg.waitForTimeout(500);
 const wall=await pg.evaluate(()=>({mode:PM.S.mode,L:PM.S.q4?.L,H:PM.S.q4?.H}));chk(wall.mode==='wall'&&wall.L===4000&&wall.H===2700,'open room wall can be measured',wall);
 await pg.evaluate(async()=>{await PM.newSess('QA plane','');PM.bwSet(3500,2650);await PM.saveNow()});await pg.waitForTimeout(500);
 const plane=await pg.evaluate(async()=>{try{const o=await cvOut81();return {o,base:!!cvBase81()}}catch(e){return {error:e.message}}});
 chk(!!plane.o&&plane.o.rooms?.some(r=>Object.keys(r.ms.wl||{}).length>0),'standalone plane exports to object',plane.error||{rooms:plane.o?.rooms?.length,base:plane.base});
 // Preserve detailed output for agents even when this currently known regression fails.
 await pg.evaluate(()=>{document.getElementById('bMore').click();document.getElementById('bExp').click()});await pg.waitForTimeout(150);const fileButton=pg.locator('#zx [data-zx="f"]');chk(await fileButton.count()>0,'standalone plane exposes real UI export button');if(await fileButton.count()){await fileButton.click();await pg.waitForTimeout(500);const saved=await pg.evaluate(()=>window.__qaExports);chk(saved.length>0,'UI export calls native file bridge');if(saved.length){const last=JSON.parse(saved.at(-1).text);chk(last.kind==='object'&&last.rooms?.length===1&&Object.values(last.rooms[0].ms.wl).length===1,'UI native file has one real v3 wall')}}
 if(process.env.QA_EXTRA)await require('./qa-extra.cjs')({pg,chk,root});
 await pg.screenshot({path:path.join(root,'tests','qa-last-screen.png')});
 chk(errors.length===0,'no JavaScript page errors',errors);
 if(plane.o?.rooms?.length)fs.writeFileSync(path.join(root,'tests','standalone-export.json'),JSON.stringify(plane.o,null,2));fs.writeFileSync(path.join(root,'tests','open-room-export.json'),JSON.stringify(open.obj,null,2));
 const result={target,checks,errors,open,restored,plane};fs.writeFileSync(path.join(root,'tests',extensions.length?'qa-export-result.json':target.includes('v81')?'qa-baseline-result.json':'qa-integrated-result.json'),JSON.stringify(result,null,2));
 await browser.close();await new Promise(r=>server.close(r));process.exitCode=checks.some(c=>!c.ok)?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();if(server)server.close();process.exitCode=1});
