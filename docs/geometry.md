# Geometry agent — Measure Lab 0.5

Frozen `web/v81.html` is unchanged. The experimental copy uses `web/lab-geometry.js` plus exact guarded edits from `scripts/geometry-patch.py`.

## User-reported 0.1 regressions corrected

- Removed the fixed-screen-size replacement of v81 `zArrL` and the custom replacement of `dmDraw`, `rzArrow`, `rzDraw`, `rzPlan`, `rzTapPlan` and `rzOut`. Native arrow rendering, widths, heads, RZ direction and world-endpoint semantics are retained. The optional arrow-size setting is a multiplier around native `zArrL(lw)`; default 9 is exactly native scaling.
- Removed the added modal editor and the `zdrEnd` creation interceptor. Creating an arrow never opens a modal or editor. The native dimension-creation `dmInShow` call is suppressed in the experimental copy so the sequence is draw first, measure later. The analogous `rzMake` auto-open calls are suppressed only on creation; deliberate bound-arrow field taps still invoke native `rzOpen`.
- Ordinary arrow labels are passive; deliberate label click or selected-arrow `Ввести размер` opens existing native `#w3f` using `w3FOpenAt`. v81's existing keypad, focus, laser-field handling and close/save behavior remain in use. Normal dimension labels also open the same editor deliberately.
- Only the original unwanted perpendicular endpoint tick statement is removed from native `dmDraw`; native lines, heads and labels are not replaced.

## Multi-post/grouped-outlet zoom correction

The native app separates closely packed outlet icons in screen pixels, and photo-related stacked communications use `f81gIcS`. The measurement model correctly stores millimeters, but its projected physical point can therefore differ from the center of the visible glyph during zoom out.

`rzIcons` now uses exactly the center/packing expressions from the native element renderer. Auto dimensions and bound RZ dimensions use those displayed post centers for their screen endpoint. The native projection/direction and dimension renderer remain in place. The reference screen endpoint receives only a perpendicular shift to preserve native line direction. The native auto-dimension reference handle (`S.adH`) is computed from the same adjusted screen endpoints before its blue circle is drawn, avoiding a stale dot at the physical projection. World coordinates and numeric millimeter measurements are unchanged. The same exact-world-coordinate matching is applied narrowly to generic arrow and dimension endpoints, hit paths, handles and passive labels, so snapping to a packed post stays visually attached as zoom changes. Global `toScr` is not changed, and no new binding/export schema is introduced.

## Preserved 0.1 features

Ordinary `arr` numeric values save as `vm`, or imported `v`, participate in undo/save and export as additive `drw[].v` and `measurement: {reference:'tip',units:'mm'}`. These free drawing values annotate geometry; existing bound RZ values move communications according to native v81 rules.

Neighboring wall elements still read actual saved sessions and clip real millimeter coordinates to the existing side face. Saved `t:'rect'` and legacy `t:'rc'`, polygons and point communications are supported. No fake attributes or size labels are drawn. The optional setting still applies.

## QA hooks

- `PM.labGeometry.arrowLabels` and `.dimensionLabels`: passive label hit rectangles in device pixels.
- `PM.labArrowEdit(q)`: deliberate generic-arrow edit through existing `#w3f`; field key `t:'lab-arr'`.
- `.autoAnchors`: diagnostic physical/visible post endpoints, original dimension text and selected post number.
- `PM.rzIcons(e)`: actual native displayed glyph centers.
- `.lastSides`: projected neighboring saved elements.
- `.annotationValue(id,n)`: existing test helper for a saved generic arrow value.

## Validation

`node --check web/lab-geometry.js` passes. Guarded patch script applies once to a temporary copy of frozen v81. Independent QA is reproducing actual drawing/zoom/editor scenarios for 0.2, including several separate outlets, grouped N>=2 outlets, actual pointer drawing and native keypad opening only after deliberate label click. Hardware testing is not claimed.


## Durable endpoint identity (0.4 phone regression)

0.2/0.3's coordinate-only projection was insufficient: an orthogonal modifier could constrain a near-post gesture away from its model coordinate, and packed post icons deliberately move in screen pixels as zoom changes. An exact-coordinate comparison cannot recover the intended post after rounding or movement.

`lab-snap.js` now saves `labAnchors.a/b = {v:1,e:elementId,kind:'post',p:oneBasedPost,n:postCount}` (or `kind:'center'` for a non-point object's center) on actual magnet selection. The actual pointer selects the visible post. Active L/P constraints now take priority over an incompatible second target. A chosen end post is preserved by translating the opposite free endpoint onto the constrained line; if the first endpoint is already fixed, it remains fixed and an incompatible second snap is rejected. Creation, native preview and endpoint-handle editing use the same selection. There is no second snap from a packed post's physical projection.

Draw, save and export resolve references against the current element and post. Native world coordinates are updated, and the visible endpoint is projected by ID/post, not by guessing matching floats. Object movement, post count changes, non-integer coordinates and rounded import therefore preserve the intended identity. Deleting an object detaches its missing reference and retains the endpoint. Dragging an entire annotation deliberately detaches refs so it can be moved freely; moving an endpoint replaces/removes only that endpoint's reference.

Refs survive the existing JSON save/undo/backup. They are additive in `dm` and `drw` export. The guarded source patches normalize the post index (`n+1-p`) together with native wall view flips on both room export and wall import. Existing element IDs are retained by v81's importer. Ordinary dimension import explicitly preserves refs; free-arrow import already spreads additive data. Constructors that do not know this optional field can ignore it.

Existing 0.3 unbound drawings are migrated only once and only for unique nearby post identity: ≤ min(20 mm, quarter of post step) with a clear 3 mm runner-up gap and only when that tool's magnet is currently enabled; overlapping identities are left alone. Screen proximity alone is never used to infer a legacy binding because it changes with zoom. Far or ambiguous endpoints are not forcibly attached. They can be rebound deliberately with the enabled magnet. No new modal, automatic editor or automatic dimension generation is introduced.

New QA hooks: `PM.labSnap.resolveRef`, `.syncDrawing`, `.syncAll`, `.transformRefs`, `.migrations`, and `.setRef`. `MeasureLabGeometry.projectEndpoint(point,drawing,field)` consumes identity refs. Frozen v81 remains untouched.


The actual saved 0.3 QA dimension endpoint was `[2614.57,904.6867]`, 8.9233 mm below the real third post `[2614.57,913.61]`. The refined unique-near-post migration repairs this safely under the 17.825 mm quarter-step cap. The 0.3 free-arrow fixture stores the same third-post x even though its original pointer aimed at post 1: that lost gesture intent cannot be reconstructed from the saved record. Migration can stabilize its stored location at the nearest third post, but deliberately does not move it 142.6 mm to a different post without user rebinding. Magnet-disabled legacy drawings are not migrated and receive the explicit-free version marker when first processed.


## Constraint priority and stable projection (0.5)

The 0.4 rule that let an explicit magnet target override L/P is superseded. Native modifier precedence is retained: parallel projection first, then L selects the final horizontal/vertical axis when both modifiers are active.

A drawing stores `labConstraint = {v:1,kind:'axis'|'parallel',dx,dy,fixed:'a'|'b'}` in wall coordinates. Choosing a post at the end of a stroke with a free start moves that free start onto the constrained line through the exact post. When the first endpoint was already snapped/fixed, the first endpoint and constraint win; an incompatible second post binding is removed, with the endpoint deliberately marked free. Preview, committed drawing, save and redraw apply the same rule.

`labSnap.projectDrawing(q)` returns `{a,b}` in device pixels without recursion through the general geometry projector. It preserves the visible fixed post and projects the free screen endpoint onto the native wall-axis/parallel direction. This avoids diagonal rendered strokes when the native grouped-post icons spread in screen pixels at smaller zoom. The model direction is constant during zoom and pan.

Handle editing retains an already bound opposite endpoint. If the opposite endpoint is free and the dragged endpoint snaps to a post, the new post becomes fixed and the free opposite endpoint translates. Deliberately editing with L/P both disabled removes the old constraint. If object movement makes a formerly compatible second binding conflict with the stored constraint, the non-fixed binding is detached rather than turning the drawing into a diagonal.

Constraints are additive in `dm` and `drw` JSON. Export/import wall flips negate the x direction with the native endpoint flip; fixed-end identity is unchanged. No modal, automatic input focus or automatic dimensions are introduced. Original v81 remains byte-for-byte unchanged.

Syntax and exact guarded patches pass. Independent QA has verified actual touch/pen preview and final horizontal, vertical and parallel cases with magnet on/off, screen constraints at five zoom factors, native P-then-L order and rejected incompatible second bindings. Final QA also passed actual JSON export/import with flipped constraint direction, native inline input, and manual RZ label/editing checks; see docs/qa-v05.md.

## Local elevation floor (0.6)

The native floor reused neighboring walls' far lower corners `LB`/`RB`. In an open or reentrant plan those corners can lie behind the selected wall or cross each other, so the elevation painted a triangle or bowtie and made a hidden neighboring corner appear on the main wall.

The experimental model now adds schematic `FL = D + [0,0,1000]` and `FR = C + [0,0,1000]`. The floor face uses `['FL','D','C','FR']`; its painted path keeps the native detours around actual columns/boxes touching the floor. The common 1000 mm depth is a local viewing aid, using the same maximum depth as the native side context. With an ordinary level wall this is a rectangle in wall space (a trapezoid under native projection). Existing measured D/C deviations remain intact, so a deliberately sloped/deformed floor edge is not silently straightened.

Original A/B/C/D, LT/LB/RT/RB, side normals, neighboring attributes and selected-wall coordinates remain unchanged. FL/FR exist only in the transient elevation model, are excluded from `w3PV`, and cannot acquire coordinate fields, orange handles, snap targets, undo records or export dimensions. Fit includes the visible floor. No synthetic ceiling is added: the native elevation has none.

Hidden neighbor face outlines now use native even-odd clipping outside the main wall on plain canvases as well as photographs. A concave/back-facing neighbor therefore cannot draw a false dashed corner through the solid selected wall; its real outline outside that wall is retained.

Implementation is confined to guarded replacements in `scripts/geometry-patch.py`; the frozen baseline and persistent plan/exports are unchanged. Exact patch guards passed against a temporary v81 copy. Independent QA covers open and closed concave fixtures, actual painted floor paths, real neighbor geometry, hidden-edge clipping and absence of synthetic editable corners.

## Photo protection for the local floor (0.7)

The floor fill and its outline are now clipped outside the selected main wall with native canvas even-odd clipping. This applies with or without a photograph and protects the solid wall even if a saved grid deviation or a calibrated projection places part of the schematic floor inside its silhouette. Photo pixels, wall measurements, selected-wall corners, real neighboring faces, and intentional objects/annotations are unchanged. Volume rendering remains separate from this floor-only clip.

The supplied phone screenshot resembles the pre-0.6 neighbor-corner floor (its triangular tip coincides with the hidden neighbor corner); its installed APK version cannot be established from the screenshot. It is not evidence that a newly installed 0.6 reproduces that exact triangle. Tests therefore use the actual native photo loader, persisted image and perspective rectification, rather than a blank canvas stand-in. Source patch guards pass; independent photo and regression validation is recorded separately by QA.

## 0.11 — route gestures and display-only sidewall opening

`lab-routes.js` keeps native wall `S.rts` records and legacy polylines; new records are atomic two-point drags. Preview clones are committed once, with selected endpoint/body edits and durable endpoint refs. The shared catalog controls type color, explicit dash and a compact tangent code. `routes-patch.py` adds metadata preservation/flip normalization. Floor routes and dimensions are a separate real-plan module, described in `docs/floor-routes011.md`.

By explicit owner choice, `angle-patch.py` interprets `W3.a` as visual wing opening only. Left/right base rays are `(cos α,0,sin α)` / `(-cos α,0,sin α)`; the fixed front projection no longer shifts with this slider. Native neighbor IDs/spans and stored corrections remain, while measured angles, original plan and exports are not rewritten. At 90° the wing is perpendicular in 3D, at 180° it extends outward in the main wall plane. Perspective need not draw the 3D right angle as a 90° screen line. Native fit may adjust pan/zoom after release.
