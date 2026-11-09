'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const file=process.argv[2]||path.join(__dirname,'qa-v011-floor.json'),r=JSON.parse(fs.readFileSync(file,'utf8')),o=r.saved?.obj||r;
assert.equal(o.app,'akrix-zamer');assert.equal(o.kind,'object');
const c={P:{},zwSet:null,object:o};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'constructor-zwSet-v894.js'),'utf8'),c);assert.equal(vm.runInContext('zwSet(object)',c),true);
let routes=0,dimensions=0;
for(let i=0;i<o.rooms.length;i++){const source=o.rooms[i].ms,imported=c.P.zam.rooms[i].ms;assert.equal(JSON.stringify(imported.rt||[]),JSON.stringify(source.rt||[]),'real constructor zwSet preserves route style, IDs, type and floor coordinates');assert.equal(JSON.stringify(imported.labFloorDims||[]),JSON.stringify(source.labFloorDims||[]),'real constructor zwSet preserves additional floor dimension data');for(const d of imported.labFloorDims||[]){assert.ok(d.id);assert.ok(d.a.every(Number.isFinite)&&d.b.every(Number.isFinite));if(d.v!=null)assert.ok(d.v>0);dimensions++;}routes+=(imported.rt||[]).length;}
assert.ok(routes>0);assert.ok(dimensions>0);console.log(`PASS: actual constructor zwSet preserves ${routes} floor route(s) and ${dimensions} arbitrary floor dimension(s). This is metadata retention, not a constructor rendering test.`);
