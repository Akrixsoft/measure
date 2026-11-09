"""Apply the audited 0.12 changes to the experimental inline application."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()

def replace(old, new):
    global html
    if html.count(old) != 1:
        raise SystemExit(f'Expected exactly one match: {old[:100]}')
    html = html.replace(old, new)

replace("{ k: 'shch', n: 'щит', pt: 1, c: '#7b3fc4' },",
        "{ k: 'shch', n: 'Щит (старая отметка)', pt: 1, hide: 1, c: '#7b3fc4' }, { k: 'wire', n: 'Провод', pt: 1, c: '#7b3fc4' }, { k: 'shield', n: 'Электрощит', rc: 1, c: '#7b3fc4' },")
replace("const ZN_K = ['zon', 'znd', 'znt', 'znf'];", "const ZN_K = ['zon', 'znd', 'znt', 'znf', 'shield'];")
replace("...KINDS.filter(k => k.pt).map(k => k.k), 'znd', 'wrt', 'zon'", "...KINDS.filter(k => k.pt && !k.hide).map(k => k.k), 'znd', 'wrt', 'zon', 'shield'")
replace("const AK_PT = { shch: 'el',", "const AK_PT = { shch: 'el', wire: 'wire',")
replace("y: e.y, W: e.W, H: e.H, note: e.note || '' });", "y: e.y, W: e.W, H: e.H, ...(e.D != null ? { D: e.D } : {}), ...(e.labEdges ? { labEdges: MeasureLab012.flipEdges(e.labEdges, flip) } : {}), note: e.note || '' });")
replace("...(e.fx ? { fx: e.fx } : {}), ...(e.fy != null ? { fy: e.fy } : {})", "...(e.labEdges ? { labEdges: e.labEdges } : {}), ...(e.fx ? { fx: e.fx } : {}), ...(e.fy != null ? { fy: e.fy } : {})")
replace("W: +q.W || '', H: +q.H || '', D: '', N: '', st: '', note: q.note || '' }) }",
        "W: +q.W || '', H: +q.H || '', D: num(q.D), N: '', st: '', ...(q.labEdges ? { labEdges: MeasureLab012.flipEdges(q.labEdges, flip) } : {}), note: q.note || '' }) }")
replace("S.room.ms.pts[gest.ndrag] = toPl(...p).map(Math.round);",
        "S.room.ms.pts[gest.ndrag] = MeasureLab012.snapNode(p, S.room, gest.ndrag);")
replace("const re = r0 && r0.ms.ul &&", "const re = r0 && r0.ms.ul && !r0.ms.labManualWalls &&")
replace("const od = re ? opWorld(S.room.ms) : [];", "if (MeasureLab012.blocksNative(pts, re ? r0 : null)) { toast('Контур пересекает назначенное помещение'); return }\n  const od = re ? opWorld(S.room.ms) : [];")
replace("if (w.close) return stClose(w.pre);", "if (w.close) { if (MeasureLab012.blocksNative(S.room.ms.pts, S.room)) { toast('Контур пересекает назначенное помещение'); return draw() } return stClose(w.pre) }")
replace("ms: { v: 1, lvl: 'd', pts: m.pts.map", "ms: { ...MeasureLab012.planMeta(m0, true), v: 1, lvl: 'd', pts: m.pts.map")
replace("ms = { pts, closed: !!M.closed", "ms = { ...MeasureLab012.planMeta(M, true), pts, closed: !!M.closed")
replace("if (gest && gest.ndrag != null && gest.moved) { saveRoom();", "if (gest && gest.ndrag != null && gest.moved) { if (S.room.ms.ul) S.room.ms.labManualWalls = true; saveRoom();")
replace("for (const q of m.pdrw || []) q.pts = PP(q.pts);",
        "for (const q of [...(m.pdrw || []), ...(m.labRooms || []), ...(m.labDividers || [])]) q.pts = PP(q.pts);")
replace("delete b.ms.ceil; delete b.ms.raw;", "delete b.ms.ceil; delete b.ms.raw; delete b.ms.labRooms; delete b.ms.labDividers; delete b.ms.labAssigned;")
replace("&& !(r.pool || []).length && !r.ul", "&& !(r.pool || []).length && !(r.ms.labRooms || []).length && !(r.ms.labDividers || []).length && !r.ul")
replace('<script src="lab-comms-ui.js"></script>', '<link rel="stylesheet" href="lab-v012.css">\n<script src="lab-v012.js"></script>\n<script src="lab-comms-ui.js"></script>')
path.write_text(html)
