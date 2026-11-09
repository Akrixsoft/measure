'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const path = require('path');
const input = process.argv[2];
if (!input) throw new Error('Usage: node tests/export-consumer.cjs <actual-export.json>');
const o = JSON.parse(fs.readFileSync(input, 'utf8'));
assert.equal(o.app, 'akrix-zamer');
assert.equal(o.kind, 'object');
assert.equal(o.v, 3);
assert.ok(o.rooms.length);
const context = {P: {}, zwSet: null};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'constructor-zwSet-v894.js'), 'utf8'), context);
context.object = o;
assert.equal(vm.runInContext('zwSet(object)', context), true, 'Actual v894 constructor import accepts the object');
const z = context.P.zam;
assert.equal(z.rooms.length, o.rooms.length);
assert.equal(z.oid, o.oid);
let n = 0;
for (let i = 0; i < o.rooms.length; i++) {
  const original = o.rooms[i], imported = z.rooms[i], m = imported.ms;
  assert.equal(imported.id, String(original.id));
  assert.equal(imported.name, original.name || '');
  assert.equal(m.closed, original.ms.closed, 'Open survey is not silently closed');
  const count = m.closed ? m.pts.length : m.pts.length - 1;
  assert.equal(count, Object.keys(m.wl).length);
  assert.equal(count, m.geo.walls.length, 'Every exported segment has physical geometry');
  for (const g of m.geo.walls) {
    const w = m.wl[g.k];
    assert.equal(w.id, g.id);
    assert.equal(m.wid[g.k], g.id);
    assert.ok(Number.isFinite(w.L) && w.L > 0);
    assert.ok(Number.isFinite(w.H) && w.H > 0);
    assert.ok(Math.abs(Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) - g.L) < 0.3);
    n++;
  }
}
console.log(`PASS: actual constructor zwSet accepts ${z.rooms.length} room(s), ${n} wall(s), names/IDs/open contour/geometry preserved`);
