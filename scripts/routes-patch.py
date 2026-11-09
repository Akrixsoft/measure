#!/usr/bin/env python3
"""Route rendering and additive export metadata in the experimental copy only."""
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
changes=[
("в выгрузку: wl.rt — точки x, y от левого края и пола", "Тяните крайние точки для изменения линии или середину для переноса"),
("Трасса по полу / потолку: касания — точки, касание последней — готово", "Трасса на плане: проведите линию, затем измените её точки"),
("for (const q of S.rts) { const sel = zdSel(q); zwPath(q.pts);", "for (const q of S.rts) { if(window.MeasureLabRoutes){MeasureLabRoutes.paint(q);continue;} const sel = zdSel(q); zwPath(q.pts);"),
("t: q.t, ...(num(q.d) ? { d: num(q.d) } : {}), pts: q.pts.map(w)", "t: q.t, ...(window.MeasureLabRoutes?MeasureLabRoutes.exportMeta(q):{}), ...(num(q.d) ? { d: num(q.d) } : {}), pts: q.pts.map(w)"),
("W.rt = out.rt.map(q => ({ ...q, pts: q.pts.map(xy) }))", "W.rt = out.rt.map(q => ({ ...q, ...(window.MeasureLabRoutes?MeasureLabRoutes.exportMeta(q,flip):{}), pts: q.pts.map(xy) }))"),
("const rts = (W.rt || []).map(q => ({ id: q.id || nid('t'), t: q.t || 'el',", "const rts = (W.rt || []).map(q => ({ id: q.id || nid('t'), ...(window.MeasureLabRoutes?MeasureLabRoutes.exportMeta(q,flip):{}), t: q.t || 'el',"),
]
for a,b in changes:
 n=s.count(a)
 if n!=1:raise SystemExit(f'Route patch expected1 got{n}: {a[:100]}')
 s=s.replace(a,b)
p.write_text(s)
print('Applied wall-route renderer and style/anchor metadata patches')
