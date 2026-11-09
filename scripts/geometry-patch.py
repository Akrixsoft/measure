#!/usr/bin/env python3
"""Guarded changes to the isolated copy; leave native renderers intact."""
from pathlib import Path
import sys
p=Path(sys.argv[1]);text=p.read_text()
replacements=[
# The schematic floor is context outside the solid selected wall. In particular,
# it must not paint over its photo when a calibrated/deformed projection puts
# part of the floor path inside the wall. Columns and other intentional markup
# keep their native rendering; only this floor fill/stroke is clipped.
("if (FL3) { pp3(FL3);", "if (FL3) { cx.save(); cx.beginPath(); cx.rect(0, 0, cv.width, cv.height); fv.M.ks.forEach((k, i) => { const q = w3S(P[k]); i ? cx.lineTo(...q) : cx.moveTo(...q) }); cx.closePath(); cx.clip('evenodd'); pp3(FL3);"),
("(W3.pl === 'floor' ? 2.5 : 1.4) * d; cx.stroke() }", "(W3.pl === 'floor' ? 2.5 : 1.4) * d; cx.stroke(); cx.restore() }"),
# The elevation floor is a local schematic extrusion of the selected wall,
# independent of the two real neighboring wall directions (including reentrant
# corners and absent neighbors at either end of an open plan).
("  W3.Lc = L; return { L, H, P, sd, nm, k, ax };", "  P.FL = [P.D[0], P.D[1], P.D[2] + 1000]; P.FR = [P.C[0], P.C[1], P.C[2] + 1000]; /* Measure Lab: local floor, not adjacent-wall closure. */\n  W3.Lc = L; return { L, H, P, sd, nm, k, ax };"),
("ks: ['LB', 'D', 'C', 'RB'].filter(x => P[x])", "ks: ['FL', 'D', 'C', 'FR'].filter(x => P[x])"),
("const FL3 = fv.floor.ks.length === 4 ? [P.LB, P.D,", "const FL3 = fv.floor.ks.length === 4 ? [P.FL, P.D,"),
("P.C, P.RB] : null;", "P.C, P.FR] : null;"),
# These two points describe only the painted schematic floor. They must never
# acquire orange point handles, dimensions, coordinate editing, or persistence.
("if (F.some(x => x.vis && x.ks.includes(k)) && !w3Occ(VV, Md.P[k], null)) o.add(k);", "if (k !== 'FL' && k !== 'FR' && F.some(x => x.vis && x.ks.includes(k)) && !w3Occ(VV, Md.P[k], null)) o.add(k);"),
# A solid main wall occludes hidden neighboring faces even without a photograph.
# Retain native even-odd clipping: real edges outside the wall remain visible.
("const nwC = !!(S.mosaic && S.mosaic.nk && LAY.foto && FA.v < 1 && fv.M && fv.M.vis);", "const nwC = !!(fv.M && fv.M.vis);"),
# Remove only the unwanted perpendicular end marks; native line, heads, labels remain.
("    for (const P of [A, B]) { cx.beginPath(); cx.moveTo(P[0] + n[0] * h, P[1] + n[1] * h); cx.lineTo(P[0] - n[0] * h, P[1] - n[1] * h); cx.stroke() }", "    /* Measure Lab: endpoint perpendicular ticks intentionally omitted. */"),
# Creation never opens an input; the passive label opens native w3f on deliberate tap.
("S.pend = k === 'dim' && o.ch ? b : null; saveSess(); mkPanel(); draw(); if (k === 'dim') dmInShow(id);", "S.pend = k === 'dim' && o.ch ? b : null; saveSess(); mkPanel(); draw(); /* Measure Lab: draw first, input only on deliberate field tap. */"),
# Preserve native RZ line/head geometry and hit collection. Correct only a post's
# visual endpoint to native packed-glyph position; measurement data stays in mm.
("const sel = on && q.id === RZ.sel, A = P(G.A), B = P(G.B), bad =", "const sel = on && q.id === RZ.sel, AB = window.MeasureLabGeometry ? MeasureLabGeometry.projectRz(q,G,P) : {A:P(G.A),B:P(G.B)}, A = AB.A, B = AB.B, bad ="),

# Scope visual projection to arrow/dimension endpoints. World values and
# unrelated geometry remain on the native toScr path.
("const A = toScr(...q.a), B = toScr(...q.b), v = sub(B, A), l = Math.hypot(...v) || 1, e = [v[0] / l, v[1] / l], n = [-e[1], e[0]], sel = zdSel(q)", "const A = window.MeasureLabGeometry?.projectEndpoint(q.a,q,'a') || toScr(...q.a), B = window.MeasureLabGeometry?.projectEndpoint(q.b,q,'b') || toScr(...q.b), v = sub(B, A), l = Math.hypot(...v) || 1, e = [v[0] / l, v[1] / l], n = [-e[1], e[0]], sel = zdSel(q)"),
("else if (q.k === 'arr') { const A = toScr(...q.a), B = toScr(...q.b), v = sub(B, A)", "else if (q.k === 'arr') { const A = window.MeasureLabGeometry?.projectEndpoint(q.a,q,'a') || toScr(...q.a), B = window.MeasureLabGeometry?.projectEndpoint(q.b,q,'b') || toScr(...q.b), v = sub(B, A)"),
("for (const q of S.dms) if (sd(p, toScr(...q.a), toScr(...q.b)) < 12 * d) return q.id;", "for (const q of S.dms) if (sd(p, window.MeasureLabGeometry?.projectEndpoint(q.a,q,'a') || toScr(...q.a), window.MeasureLabGeometry?.projectEndpoint(q.b,q,'b') || toScr(...q.b)) < 12 * d) return q.id;"),
("const P = q.pts ? q.pts.map(t => toScr(...t)) : [toScr(...q.a), toScr(...q.b)];", "const P = q.pts ? q.pts.map(t => toScr(...t)) : q.k === 'arr' && window.MeasureLabGeometry ? [MeasureLabGeometry.projectEndpoint(q.a,q,'a'),MeasureLabGeometry.projectEndpoint(q.b,q,'b')] : [toScr(...q.a), toScr(...q.b)];"),
("return ['a', 'b'].filter(f => q[f]).map(f => ({ s: toScr(...q[f]), set: v => { q[f] = v } }));", "return ['a', 'b'].filter(f => q[f]).map(f => ({ s: (q.k === 'arr' || S.dms.includes(q)) && window.MeasureLabGeometry ? MeasureLabGeometry.projectEndpoint(q[f],q,f) : toScr(...q[f]), set: v => { q[f] = v } }));"),

# Bound-communication arrow creation follows the same draw-first rule. Editing an
# existing label still uses native rzOpen via deliberate hit handling.
("mkPanel(); draw(); rzOpen(dup.id); return dup", "mkPanel(); draw(); return dup"),
("saveSess(); mkPanel(); status(); draw(); rzOpen(q.id); return q;", "saveSess(); mkPanel(); status(); draw(); return q;"),

# The native blue reference-handle is drawn before returning from auto-dimension
# drawing; use the same adjusted A/B as its visible stroke, without a ghost dot.
("if (sel && rr) { const a2 = toScr(...A), b2 = toScr(...B), v = sub(b2, a2)", "if (sel && rr) { const projected = window.MeasureLabGeometry?.lastAutoLine, a2 = projected ? projected.A : toScr(...A), b2 = projected ? projected.B : toScr(...B), v = sub(b2, a2)"),

# Additive identity refs use the same view flip as the native drawing coordinates.
# Native constructor readers ignore the optional labAnchors field.
("...(q.rz ? { rz: rzFlip(q.rz, flip) } : {})", "...(q.rz ? { rz: rzFlip(q.rz, flip) } : {}), ...(q.labAnchors ? {labAnchors:MeasureLabSnap.transformRefs(q.labAnchors,flip)} : {})"),
("W.drw = out.drw.map(q => ({ ...q, ...(q.a ?", "W.drw = out.drw.map(q => ({ ...q, ...(q.labAnchors ? {labAnchors:MeasureLabSnap.transformRefs(q.labAnchors,flip)} : {}), ...(q.a ?"),
("...(q.rz ? rzIn(q, flip) : {})", "...(q.rz ? rzIn(q, flip) : {}), ...(q.labAnchors ? {labAnchors:MeasureLabSnap.transformRefs(q.labAnchors,flip),labAnchorVersion:1} : {})"),
("const drw = (W.drw || []).map(q => ({ ...cp(q), id:", "const drw = (W.drw || []).map(q => ({ ...cp(q), ...(q.labAnchors ? {labAnchors:MeasureLabSnap.transformRefs(q.labAnchors,flip),labAnchorVersion:1} : {}), id:"),

# Native glyph rendering and all arrow/snap endpoints consume one post layout.
("if (ico) { const z = icz, sp = N1 > 1 && st ? Math.hypot(...sub(toScr(...fromW([c[0] + st, c[1]], W)), s)) : 0, cs = sp >= z ? Array.from({ length: N1 }, (_, i) => toScr(...fromW([c[0] - ((N1 - 1) * st) / 2 + i * st, c[1]], W))) : Array.from({ length: N1 }, (_, i) => [s[0] + (i - (N1 - 1) / 2) * z * 0.84, s[1]]); nI = cs.length;", "if (ico) { const z = icz, cs = rzIcons(e).cs; nI = cs.length;"),

# An explicitly free/detached endpoint must not become a legacy auto-migration
# candidate merely because it crossed an export/import boundary.
("return { id: q.id || nid('d'), a: A, b: B, t: q.t || 'both'", "return { id: q.id || nid('d'), ...(q.labAnchorVersion === 1 ? {labAnchorVersion:1} : {}), a: A, b: B, t: q.t || 'both'"),

# Preserve constraint direction in the same coordinates as mirrored endpoints.
("W.dm = out.dm.map(q => ({ ...q,", "W.dm = out.dm.map(q => ({ ...q, ...(q.labConstraint ? {labConstraint:MeasureLabSnap.transformConstraint(q.labConstraint,flip)} : {}),"),
("W.drw = out.drw.map(q => ({ ...q,", "W.drw = out.drw.map(q => ({ ...q, ...(q.labConstraint ? {labConstraint:MeasureLabSnap.transformConstraint(q.labConstraint,flip)} : {}),"),
("return { id: q.id || nid('d'), ...(q.labAnchorVersion === 1 ? {labAnchorVersion:1} : {}), a: A", "return { id: q.id || nid('d'), ...(q.labAnchorVersion === 1 ? {labAnchorVersion:1} : {}), ...(q.labConstraint ? {labConstraint:MeasureLabSnap.transformConstraint(q.labConstraint,flip)} : {}), a: A"),
("const drw = (W.drw || []).map(q => ({ ...cp(q),", "const drw = (W.drw || []).map(q => ({ ...cp(q), ...(q.labConstraint ? {labConstraint:MeasureLabSnap.transformConstraint(q.labConstraint,flip)} : {}),"),
]
for old,new in replacements:
 n=text.count(old)
 if n!=1:raise SystemExit(f'Expected exact one geometry patch, got {n}: {old[:90]}')
 text=text.replace(old,new)
p.write_text(text)
print('Applied native geometry tick/editor/post-anchor patches')
