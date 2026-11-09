# Lab 0.9 generic zone relocation

Focused browser result: **16/16 passed**, no browser errors. Run `node tests/qa-v09-zone.cjs` with Playwright Chromium, mobile viewport 412×915 and DPR2.

The native toolbox contains `zon` exactly once, under “Коммуникации”; it is absent from “Зоны и геометрия.” A saved custom order of the twelve previous communication tools remains intact, with `zon` appended as the thirteenth tool using its native purple dashed-rectangle icon. The migrated order persists across reload without duplication.

Trusted pen gestures create a selected generic zone, move it without changing size or cloning, and deselect it on a blank tap. No automatic arrows are created. The new zone survives native session save/reload and JSON export/import. A preexisting native zone fixture retains its coordinates, size and note through session reopening and remains a generic zone after JSON exchange.

Evidence: `tests/qa-v09-zone.json` and `tests/qa-v09-zone.png`. The screenshot was independently viewed: both generic zones and the purple dashed icon appear correctly. Source review confirms the native `zon` type/rectangle behavior is preserved; only its category and communication-row availability change. The header mode icon remains unchanged while the five separate design options await selection.

Original v81 SHA256 remains `b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191`. No physical Android, BLE or camera claims are made. QA changed only its focused test, evidence and this report.
