# Lab 0.6 floor regression

Independent targeted browser result: **72/72 passed**, no browser errors. Root also ran the existing arrow suite on this build: **101/101 passed** (`tests/qa-v06-arrows.json`).

`node tests/qa-v06-floor.cjs` uses mobile Chromium 412×915, DPR2. The open fixture has eight vertices/seven segments and a reentrant 270° corner between C3 and C4. A closed counterpart uses the same vertices. Checks cover long C1, short C3/C4, C7 at the open end, and the closing C8.

The actual Canvas floor fill follows a four-corner local extrusion below the selected wall. It spans only the selected wall width, has positive depth, and remains noncrossing. C3 also passes view angles 45° and 135°. Raster samples along the former hidden neighbor vertical inside the plain main wall contain zero hidden-dash pixels. Screenshots independently confirm the removed crossing floor and false vertical.

The native floor selector works at an open endpoint. The new schematic floor points are excluded from visible/editable points; the missing-neighbor floor corner has no point hit or new floor snap candidate. Existing main and adjacent wall coordinates and side metadata match the prechange build exactly for all nine wall views. Open/closed plan vertices survive viewing, saving, reopening and native export; the test compares against native pre-view export coordinates, including its established Y-axis convention.

Historical `QA_SOURCE=v05` serves every web file from commit `cc91677`. It passed 41/59 checks and reproduced triangular open-end floor, crossed concave floor, and false hidden line visible in the C3 screenshot. Current results: `tests/qa-v06-current-floor.json`. Comparison screenshots: `tests/qa-v06-{v05,current}-open-C3.png` and corresponding C4 images.

Source review: the patch adds local FL/FR extrusion points for floor painting, preserves measured main-wall and neighbor coordinates, excludes schematic points from editing, and applies the existing even-odd main-wall clipping to hidden neighbors with or without a photo. Real measured grid deviations remain intact; the schematic floor is not a newly measured room boundary.

Original v81 SHA256 remains `b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191`. Browser checks do not substitute for physical Android/stylus/BLE/camera testing. No product files were changed by QA.
