# Measure Lab0.4 — independent device-input regression

## Final gate

**104/104 anchor checks +20/20 placement checks +25/25 lifecycle checks passed.** These are scoped mobile-browser checks, not a claim that every application or Android-hardware scenario is covered.

Commands:

```sh
node tests/qa-v04-anchors.cjs
node tests/qa-v04-placement.cjs
node tests/qa-v04-lifecycle.cjs
```

The tests use real Chromium input dispatch: trusted `pointerType:'touch'` and `pointerType:'pen'` events through CDP, not synthetic direct calls that insert perfect arrow endpoints. Mobile viewport412×915, DPR2. Canvas stroke/fill paths, actual rendered icon `drawImage` centers and endpoint hit/handle coordinates are captured independently. No JavaScript page errors occurred.

## Reproduced0.3 defect

`QA_SOURCE=v03 node tests/qa-v04-anchors.cjs` serves the actual committed0.3 snapshot05e3bdf. Fixture: measured3795×2573 wall; triple outlet centered at2543.27/913.61 with71.3mm post pitch; two additional outlets. The first ordinary dimension is drawn by touch with the default orthogonal constraint L=1 and magnet enabled. Pointer start is naturally offset0.93CSSpx from the exact post height; the endpoint is near the displayed outer post. The arrow is drawn with a real pen gesture.

The old dimension stored y904.6867 rather than outlet y913.61, an8.923mm difference. Since0.3 relied on an exact coordinate match to infer the displayed post, the actual head and handle visibly separated from the packed outlet glyph during zoom-out. At0.1× the dimension mismatch was35.47device pixels. The old ordinary arrow also selected the wrong stored post in this scenario. The historical reproduction intentionally fails:23/79 checks passed. Evidence: `tests/qa-v04-v03-anchors.json` and reproduction log.

## Durable-reference checks

The same trusted touch/pen gestures on0.4 produce explicit object/post references on the correct third and first posts. At0.1,0.2,0.35,0.5,1,2,4×, then reverse zoom back to1 and0.2× with pan:

- Actual filled heads and native endpoint handles coincide with the corresponding visible post,0px mismatch in this fixture.
- The expected post coincides with the actual Canvas icon center, rather than only a duplicated projection calculation.
- Save/reload preserves references and correct visual targets.
- A real pen selects and moves the referenced group from2543.27/913.61 to2802.334/1047.939. Both arrows follow the moving group at all tested scales.
- Actual object JSON export/import preserves first/third post identities through wall orientation conversion; head/handle checks still pass afterward.
- A pen-drawn arrow with the magnet deliberately disabled ends a few millimeters from a post and remains explicitly free. Its free marker survives export/import and it is not silently rebound on zoom.

The initial movement fixture stayed in native view mode after `openSess` and then hit an overlapping dimension in selection mode. It was corrected to enter actual markup mode and select the existing group with the active object tool. The accepted run explicitly proves the object coordinates changed; it does not count a no-movement frame as successful following.

Evidence: `tests/qa-v04-current-anchors.json`, log and `tests/qa-v04-current-fractional-zoom02.png`.

## New placement algorithm

Using trusted pen input:

- A water outlet is selected immediately after creation.
- Dragging the selected water outlet moves it without cloning.
- A stationary blank tap only clears selection; the next blank tap creates the next water outlet.
- Repeated blank taps cannot create one water outlet per tap without the intervening deselection step.
- Switching to socket placement clears the old water selection; selected sockets move instead of cloning.
- Rectangular zones follow the same selection/move/deselect/next-placement rule. Moving a selected zone preserves its dimensions.
- A real touch drag demonstrably moves a selected zone first. A second touch and touch-cancel then roll it back without a phantom clone.
- Changing tools during an active pen drag rolls the original object back, consumes the remainder of the gesture and leaves the new tool active with no resurrected selection or phantom creation.
- No automatic dimension records, hit rectangles or blue automatic handles are added.

Evidence: `tests/qa-v04-placement.json`, log and visually inspected `tests/qa-v04-placement.png`.

## Reference lifecycle and historical safety

The lifecycle gate starts from JSON produced by the real gestures above.

- Real native2-post and4-post buttons update reference ordinals/counts. Handles remain on the referenced displayed posts at0.1/0.35/1/4×.
- A real pen endpoint drag rebinds the ordinary arrow to another existing outlet ID.
- Dragging the whole arrow body moves it freely and detaches references; it retains the explicit-free marker.
- Deleting the referenced outlet preserves the manual dimension at its last world location and clears the orphan reference instead of deleting user data.
- Actual saved0.3 gesture records receive a unique nearby-post repair only with the magnet enabled. The observed8.923mm dimension displacement is safely repaired to its stored nearest third post.
- The old ordinary arrow record already contains third-post coordinates although its original pointer gesture targeted the first post. That first-post intent is absent from the old data and cannot be recovered safely. Migration stabilizes the stored nearest third post; reattaching to a different intended post remains an explicit user action.
- Historical data kept free while the magnet is disabled does not later attach merely because the user zooms or enables the magnet.

A first whole-arrow drag trial hit the overlapping neighboring dimension. The final trial uses an isolated72% point on the arrow shaft and records the actual native gesture target (`ddrag`, no handle drag), proving that the requested arrow moved and detached. This was a test hit-target ambiguity, not a product source change.

Evidence: `tests/qa-v04-lifecycle.json` and log.

## Limits

Fixed-screen-size fields can crowd at very small scales; this release fixes identity and projected anchors, not general label decluttering. Actual Android WebView, a physical stylus/IME, GLM Bluetooth, camera and hardware share-sheet behavior still require phone testing. Original v81 is preserved byte-for-byte.
