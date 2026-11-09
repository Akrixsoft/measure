# Measure Lab0.3 — manual dimensions only

## Independent result

`node tests/qa-manual-v03.cjs`: **56/56 passed**, no JavaScript page errors.

Real pointer interactions in mobile Chromium412×915, DPR2:

- Place three sockets sequentially, two water outlets, two zones and two windows.
- Place two switches on a second saved wall.
- For every completed placement, the selected wall-object tool stays active, including with the optional drawing-repeat setting disabled.
- Placement creates no `S.dms` or `S.drw` records. Instrumented `dimLine` and `drawAutoDims` have zero calls; automatic hit rectangles and blue reference handles remain absent. The main wall's four overall size fields remain visible.
- The old “размеры всех” checkbox and bulk automatic communication-arrow command are absent.
- A manually pointer-drawn ordinary arrow still renders, opens native input only after deliberate field tap, and saves500mm.
- A manually pointer-drawn two-headed dimension still renders and edits to777mm, deliberately different from its800mm geometric span.
- A user-selected communication reference side creates a manual bound arrow; its field remains editable and stores500mm.
- Exactly those two dimensions and one ordinary arrow persist across app reload and JSON export/import. The restored free dimension retains777mm, the explicit bound dimension500mm and the ordinary arrow500mm.
- Frozen v81 remains byte-exact.

Evidence: `tests/qa-manual-v03-result.json`, `tests/qa-manual-v03.log`, `tests/qa-manual-v03.cjs`.

Screenshots visually inspected:

- `tests/qa-manual-v03-placements.png` — three sockets, two water outlets, two zones, two windows, with no object-dimension arrows; overall wall size fields retained.
- `tests/qa-manual-v03-created.png` — only the explicitly drawn777mm dimension,500mm ordinary arrow and500mm bound communication arrow.

## Source review

The guarded `scripts/manual-patch.py` returns from `drawDims` immediately after painting overall wall dimensions and clearing old object-dimension hits/handles. This blocks both automatic-all and selected-object fallback dimensions. It does not bypass the separate explicit `dmDraw`/`rzDraw` paths or delete persisted measurements. `web/lab-manual.js` disables later automatic drawing entry points and clears obsolete automatic-handle caches without touching user `S.dms`.

The former automatic-dimension assertions in v0.2 are intentionally superseded by this new requirement. This report does not add their old pass counts to the manual-only gate or claim automatic dimensions should continue to appear.

## Limits

Browser tests establish HTML/application behavior; physical Android WebView, BLE, camera and hardware share-sheet behavior still require device testing. No production source or original v81 was edited for this QA.

## SHA256 of tested source

```text
b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191  web/v81.html
986834ef2528e219e4afebc73ac04a6d93266bf7b790d63f9c75753b7baf48e5  web/experimental.html
51075cfa5d13fdddf904e08ec3f5a4348349991a55ecde3942b84edbe207eeab  web/lab-manual.js
eb85af8f757f92d841272d7530e0c4f6ab803b1f5e888450645cca16b1a8ae85  scripts/manual-patch.py
```
