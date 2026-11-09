// Exact consumer function from Akrixsoft/akrix-soft calc/build/p894.py
// commit 320c2f9a04c981f390b24c204f1de66cf13714c8. Test evidence only.
zwSet = function (o) { const rs = o && o.kind === 'object' ? (o.rooms || []) : [o];
  const rooms = rs.filter(r => r && r.ms && Array.isArray(r.ms.pts) && r.ms.pts.length >= 2).map(r => { const ms = JSON.parse(JSON.stringify(r.ms)); delete ms.built; const q = { name: r.name || '', ms }; if (r.id != null) q.id = String(r.id); return q; });
  if (!rooms.length) return false; P.zam = { obj: o.obj || '', date: o.date || '', rooms }; if (o.oid) P.zam.oid = String(o.oid); return true; };
