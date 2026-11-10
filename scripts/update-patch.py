#!/usr/bin/env python3
"""82.18 (AKX-2026-0014): attach lab-version.js (single version source) before lab-title.js and the auto-update module
(lab-update.css + lab-update.js) after it. Inline v81 code is not changed. Idempotent."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()
if 'src="lab-update.js"' in html:
    print('82.18 update already integrated'); raise SystemExit(0)
old = '<script src="lab-title.js"></script>\n</body>'
if html.count(old) != 1:
    raise SystemExit('Expected exactly one match: ' + old)
new = ('<script src="lab-version.js"></script>\n<script src="lab-title.js"></script>\n'
       '<link rel="stylesheet" href="lab-update.css">\n<script src="lab-update.js"></script>\n</body>')
html = html.replace(old, new)
path.write_text(html)
print('82.18 update integrated')
