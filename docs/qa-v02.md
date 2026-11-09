# Measure Lab 0.2 — independent regression for user feedback

## What was reproduced in0.1

`QA_SOURCE=v01 node tests/qa-arrows-v02.cjs` serves the committed0.1 HTML and extensions from git commit4f944c5, not the live working extension files.

Independent fixture: three separate outlets, a three-post outlet group, automatic horizontal/vertical dimensions, manually drawn one-head/two-head arrows and bound communication arrows. Canvas operations and screen hit records were captured at0.1,0.2,0.35,0.5,1 and2× scale with an additional pan.

Confirmed failures:

- Bound arrows ended at physical projected post coordinates while the native renderer spread the grouped outlet icons in screen pixels. The visible mismatch was17.78px at0.1×,17.08px at0.2×,16.02px at0.35×,14.97px at0.5× and11.46px at1× for outer posts.
- A real pointer drag creating an ordinary arrow immediately opened the custom modal and keyboard.
- Deliberately tapping the arrow label used the custom modal instead of native v81 `#w3f` and keypad.
- Original snapping did not include exact existing outlet centers.

The first reproduction run recorded22/37 checks passing; it intentionally contains failures and is not the final0.2 acceptance set. Evidence: `tests/qa-arrows-v02-v01.json`.

## Additional defect caught during correction

The first new snap implementation resolved a visible third post to its correct world coordinate2971, then `zMod` re-snapped its physical projection to the middle post2900. A real pointer gesture stored the wrong post; the drawn head and endpoint handle then remained36.96device pixels from the intended third icon. Root fixed this second snap pass to use the same displayed-post projection. The unchanged real gesture now stores2971 and the real filled arrowhead and endpoint handle stay at the intended icon at all tested scales.

## Final result

`node tests/qa-arrows-v02.cjs`: **78/78 passed**, no JavaScript page errors.

Verified behavior:

- Frozen original v81 SHA256 remains unchanged.
- Three bound arrows' actual screen endpoint records match their visible independent/grouped outlet posts, including first and third packed posts, with0px mismatch at0.1×/0.2×/0.35×/0.5×/1×/2× and pan.
- Instrumented real Canvas `stroke` and filled head paths land at the intended endpoints; finite label rectangles and hit areas are collected. This is stronger than checking unchanged world a/b data alone.
- Independent and grouped automatic dimensions project to visible post endpoints; grouped auto scenario temporarily excludes explicit RZ dimensions so the native intentional suppression does not make the assertions vacuous.
- Default arrowhead size follows the original v81 linewidth/zoom formula:12.144,12.144,14.0163,15.8800,20.2400,25.7971device pixels at the six tested scales.
- Actual pointer creation of an ordinary arrow opens no modal, inline input or keyboard.
- Deliberate arrow label tap activates the native v81 `#w3f` and `#zkb`; computed input styling is15px font,28px height and the original gold border.
- Actual pointer creation of a bound communication arrow also does not open an editor.
- Real `dmTap` with tool magnet enabled stores the exact existing outlet center; with it disabled it keeps the raw pointer position.
- The ordinary arrow exposes the native magnet button; clicking it enables snapping. A real pointer drag to a visually packed third post stores the exact world coordinate, and actual head fill plus endpoint hit/handle follow that third icon at all six scales.

Evidence: `tests/qa-arrows-v02-current.json`, `tests/qa-arrows-v02-current.log` and the test script itself.

Screenshots inspected:

- `tests/qa-arrows-v02-current-inline.png` — original native inline editor and keypad, no custom dialog.
- `tests/qa-arrows-v02-current-bound-zoom02.png` — bound arrows on reduced-scale outlet fixture.
- `tests/qa-arrows-v02-current-snapped-group02.png` — real snapped generic arrow still attached to the displayed third post at0.2×.

## Independent source review and limits

The previous custom `dmDraw`, shortened `rzArrow` renderer, head-size override and automatic creation modal were removed. Narrow guarded patches preserve native v81 drawing functions while removing unwanted perpendicular dimension ticks, suppressing automatic editor entry and aligning projected post endpoints/hits. Numeric labels use native field/keypad on deliberate action. The snap correction retains ordinary exact world coordinates and uses the same visible-post projection for repeated resolution.

At extreme zoom-out, native fixed-screen-size labels and outlet glyphs can still crowd or overlap; restoring v81 scale behavior does not implement a new decluttering algorithm. This test does not claim all crowded-label usability problems are solved. Real Android hardware, keyboard/IME interactions, Bluetooth and camera behavior remain phone checks; the native HTML behavior was tested in mobile Chromium emulation.

## Final narrow auto-reference-handle gate

Root identified a further source-level concern: selected automatic dimensions could use adjusted displayed post endpoints for strokes but keep the blue reference handle in `S.adH` at the unadjusted world projection. Geometry agent added a guarded change to compute the handle from the same last projected A/B used by `dimLine`.

`QA_AUTO_HANDLE_ONLY=1 node tests/qa-arrows-v02.cjs`: **16/16 passed** on the final integrated source. Selected three-post outlet, no explicit RZ dimensions; scales0.1,0.2,0.5,1,2 and pan. At each scale:

- `S.adH.dy.p` equals the adjusted actual reference-line point exactly.
- The actual Canvas blue-circle arc is drawn at that handle point.
- The real filled dimension head and blue circle agree.

No page errors. Screenshot inspected: `tests/qa-arrows-v02-auto-handles02.png`. Evidence: `tests/qa-arrows-v02-auto-handles.json`.

The first expected-point comparison accidentally selected a different1400mm dimension by identical text. Matching by the physical endpoint resolved the test ambiguity; the actual head/blue-circle capture had already agreed. This was a QA matching issue, not another product defect.

Final scoped acceptance evidence is **78 main checks plus16 final auto-handle checks**. Unrelated tests were not repeated after the narrow handle-only correction.

### Final source SHA256 snapshot

```text
b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191  web/v81.html
4ce286cd8e6570ad0a6f4597b0d73904a82654bd80ea4dcdf14c230cd8149336  web/experimental.html
9a54db554c29cac5f60c369593e7199e560e83edd2d46ddd6a8ef5289be46f3b  web/lab-ui.js
2b02a7e997e91b627c5894071e15029bfc8bc5fe83a3b70f25df66fd67833cc8  web/lab-ui.css
367bac1d272fde46a8aaaa802976ecfd300df9cc0ed32b4b5faf9b0842380456  web/lab-geometry.js
5b6f03b646fdccadcf309b618aba7a5a0c2552ff6f2d80ab31cd06270aa6b3dc  web/lab-snap.js
4e16eb6ab640cae9026f4d299dbb7b1f44b8fe08159714778443921376ca4155  web/lab-export.js
9f25831fa080472dd2dfe2e368f75943231c5d437c3fab5dc1ebaf7f2eef6ad1  scripts/geometry-patch.py
```
