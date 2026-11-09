# Lab 0.5 independent browser QA

Final targeted regression: **101/101 passed**, with no browser errors. Selected-object placement regression: **20/20 passed**. Root separately ran core browser 14/14 and constructor consumer checks; those are not added to the independent count.

Run: `node tests/qa-v05-regression.cjs` (Playwright Chromium, 412×915 CSS viewport, DPR2). Actual trusted CDP pen and touch events create the tested arrows; the test does not inject their endpoints. The fixture uses a 3795×2573 mm wall and three-post outlet at fractional coordinates.

Verified:

- Ordinary one-head arrows and two-head dimensions retain H/V and parallel constraints with the magnet both enabled and disabled, during the live drag preview and after release.
- Packed outlet glyph projection retains the constraint across zoom factors 0.1, 0.3, 1, 2 and 4 plus pan. When parallel and axis modifiers are both active, native final-axis precedence applies.
- A free start may move onto the constrained line through a snapped end. If the start is already bound, a conflicting second post is rejected while the first binding and constraint remain intact.
- Constraint metadata and post identity survive native session save/open and awaited JSON export/import through the wall orientation conversion.
- Instrumented actual Canvas `fillRect` and `fillText` transforms show field centers at shaft midpoints and readable tangent rotation for horizontal, vertical, diagonal and reversed arrows/dimensions. These assertions inspect painted operations rather than only the layout helper.
- Deliberate field taps open the native inline editor/keypad, matching the field rotation; numeric edits store 777. Creation opens no input. A manual RZ dimension also has centered vertical text and a rotated native editor. Opening an ordinary native field clears rotation.
- A rotated 74 px tall input near the bottom now ends at y=711; the keypad starts at y=719. An earlier run exposed a 7 px overlap, corrected by root before the final run.

Historical `QA_SOURCE=v04` serves every web file from commit `772ca12`. The corrected historical run reproduced magnet overriding constraints in preview/final and noncentered/unrotated fields (35/99 passed). The historical run predates the final RZ fixture correction, so its RZ editor failure is not used as evidence of a product defect. The final current run's RZ gates pass.

Artifacts: `tests/qa-v05-current-regression.json`, `tests/qa-v05-v04-regression.json`, and `tests/qa-v05-current-{arr,dim}-diagonal.png`, `tests/qa-v05-current-bottom-input.png`. Independent placement output remains `tests/qa-v04-placement.json` (20/20).

Source review confirmed native P-then-L precedence, persisted constraint direction/fixed-end handling, rejection of incompatible endpoint bindings, orientation conversion at export/import, and shared label paint/hit/editor geometry. Original v81 SHA256 remains `b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191`.

Limits: browser pen/touch emulation does not establish physical Android stylus, camera, BLE, or device keyboard behavior. Earlier 0.4 tests requiring a snapped post to override an active axis constraint intentionally no longer describe the requested behavior.
