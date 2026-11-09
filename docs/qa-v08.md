# Lab 0.8 targeted QA

New communication tools: **23/23 passed**, no browser errors. Independent icon preview interaction: **8/8 passed**.

`node tests/qa-v08-comms.cjs` runs mobile Chromium 412×915, DPR2, with trusted CDP pen/touch input. A stored custom order containing the previous ten communication tools migrates to twelve without losing that order or duplicating entries. Every row button has its native SVG icon; the row remains horizontally scrollable.

Actual pen gestures create a selected native “не сверлить” rectangle, move it intact without cloning, and deselect it on a blank tap. No automatic arrows appear. The test then creates and selects a manual RZ arrow, switches to “трасса,” confirms the old RZ selection clears, and completes a native three-point route by tapping its last point again. The existing manual arrow remains; no automatic dimensions are added. Both new object types survive native save/reload and JSON export/import. A trusted touch hold-and-drag reorders the added route entry, and the twelve-entry order survives reload.

Evidence: `tests/qa-v08-comms.json`, `tests/qa-v08-comms.png`. Source review confirms the tool list matches native toolbox semantics: ten point communications plus `znd` and `wrt`; non-RZT tools use the native drawing path, and migration appends the missing tools after the saved custom order.

`node tests/qa-v08-preview.cjs` verifies all five standalone preview cards update the displayed icon and selected label, with no mobile horizontal overflow or browser errors. Evidence: `tests/qa-v08-icon-preview.json`, `tests/qa-v08-icon-preview-mobile.png`. The five options are previews awaiting the owner's choice; the application's existing header icon is unchanged.

Original v81 SHA256 remains `b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191`. These are browser checks, not physical Android camera/stylus/BLE tests. QA changed tests and this report only.
