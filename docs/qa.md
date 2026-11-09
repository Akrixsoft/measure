# Independent QA — Measure Lab

## Baseline (v81)

Executed 2026-11-08 with system Chromium through Playwright. Fresh isolated browser context, viewport 412×915, DPR2, mobile/touch emulation. Native file-save bridge replaced by an in-memory recorder; no real user data or Bluetooth calls used.

Baseline SHA256 matches `b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191`.

`node tests/qa-browser.cjs web/v81.html`: 10/11 checks passed. The deliberately retained failing check independently reproduces a product defect.

- Open room has an explicitly empty name and 3 polyline points, `closed:false`.
- Export preserves open contour, exactly two walls, measured L=4000/3000, stable wall IDs.
- Open room is included in object export, geometry persists across reload, wall can be opened/measured.
- Standalone plane created with `PM.newSess('QA plane','')` and measured to 3500×2650 produces `cvBase81() === null` and object export `rooms:[]`. This is the confirmed no-room export failure.
- No JavaScript page errors during these scenarios.

Raw evidence: `tests/qa-baseline-result.json`. Test script writes nonzero exit code when any acceptance check fails; the baseline failure is expected and must become a pass on the experimental version.

## Integrated acceptance plan

Run the same geometry/export/persistence test on actual integrated experimental HTML. Add UI assertions for settings text min6/field min10, preference persistence, equal square scrolling wall buttons, tool row/modifiers positions and repeatable-tool behavior. Independently inspect dimension/arrow data persistence and attachment coordinates at several zooms. Verify baseline remains byte-exact after integration and Android packaging.

Android review must cover application ID, private origins, bridge/nav allowlist, offline assets and extension references, async flush before switching, JSON/image chooser MIME selection, granted camera URI permissions and signed APK manifest/assets. Real BLE connection, camera hardware and share-sheet behavior cannot be established by browser tests or static review; require phone testing.

Old v80 tests t44/t45 use obsolete edge identifiers/3D expectations in v81; their historical failures are not automatically counted as newly introduced defects.

## Final integrated result

`QA_EXTRA=1 node tests/qa-browser.cjs web/experimental.html`: **36/36 passed**.

This includes actual export button→native bridge→valid Akrix v3 object, standalone wall and open unnamed room, geometry reload, settings minima6/10 and persistence, effective canvas font6px at DPR2, four equal28×28 wall buttons, visible modifiers above full-width toolbar, arrow anchors stable at0.5×/1×/2× zoom, screen-sized arrowheads, numeric arrow editor, window/communication/dimension/arrow export, session reload, standalone JSON import with name:'' and closed:false, arrow value import and re-export, open-room manager, and exact native chooser transaction code both succeeding and refusing simulated storage write failures. No page errors.

The initial arrow-restore assertion expected internal `q.vm`; the importer legitimately stores the exported `q.v`. The display, editor and re-export support both. QA was corrected to validate the semantic numeric value and actual re-export rather than demanding one internal property. This was a test assertion issue, not an established product defect.

`node tests/qa-ui-final.cjs`: **9/9 passed**.

- Three communication placements complete; persist=true keeps the tool ready, persist=false returns to selection.
- Original v81 settings DOM survives opening and closing the new settings dialog.
- Exact Android chooser script refuses switching while a settings/editor dialog is open.
- In a shared Chromium browser context, the exact Android URLs `https://v81.measure-lab.local/index.html` and `https://experimental.measure-lab.local/index.html` maintain separate actual Measure IndexedDB records and localStorage values. Writes in experimental do not appear in original.
- No page errors in final interactions.

Core integrated and UI checks: **45/45** (the additional adjacent-wall checks below bring the final total to50/50). Browser emulation establishes application behavior, not actual Android WebView, native activity, Bluetooth hardware, camera hardware or Android share-sheet behavior.

Screenshots visually inspected at412×915 DPR2:

- `tests/qa-tool-layout.png`: active wall tools across full second-bottom row, modifiers right above, ordinary two-headed dimension without perpendicular end ticks, one-headed400mm arrow, placed communications.
- `tests/qa-settings-minima.png`: settings values text6 and field10 with live sample, no horizontal clipping of dialog controls at the tested width.
- `tests/qa-integrated-wall.png`: restored standalone wall and123mm one-headed annotation.

Rich consumer fixtures are `tests/rich-export.json`, `tests/standalone-export.json`, `tests/open-room-export.json`. Constructor source-contract testing is owned by export agent. Adjacent-face communications have the additional executed saved-neighbor scenario documented below. Full hardware/end-to-end constructor and recognition regression remains outside this first APK browser gate.

## Adjacent-wall concern closed before APK handoff

`node tests/qa-adjacent.cjs`: **5/5 passed** after fixing a defect found by this independent browser scenario.

Actual fixture: closed rectangular plan4000×3000; save real wall0 and adjacent wall1. Wall1 has a window200×500 and an outlet within400mm of the common corner. Its actual stored `out.els` shape uses `t:'rect'` for the window (not only the previously assumed `t:'rc'`). Before the alias correction, only the outlet rendered (`count:1`). Geometry agent added support for the observed `rect` shape; the unchanged scenario then rendered both (`count:2`).

Main wall0 identifies neighboring wall1 on its left face, with reversed common-corner direction (`flipped:true`) and a1000mm side span. Verified at60°,90°,115°,135° visible faces; final screenshots use135° for clarity. Turning `sideElements` off yields no projected side records and changes canvas pixels. No side-render warnings or page errors.

Evidence: `tests/qa-adjacent-result.json`, visually inspected `tests/qa-adjacent-on.png` and `tests/qa-adjacent-off.png`.

**Final independent total:50/50 passing browser checks.** physical device and complete constructor/hardware limitations remain.
