"""82.18 (AKX-2026-0008/0009): attach lab-tb.css / lab-tb.js (футляр в каждом режиме, группа «Холст», без 📐) after lab-title.js.
Order: … lab-sketch.js, lab-icons.js, lab-title.js, lab-tb.js. Inline v81 is not changed."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()
old = '<script src="lab-title.js"></script>\n</body>'
if html.count(old) != 1:
    raise SystemExit('Expected exactly one match: ' + old)
html = html.replace(old, '<script src="lab-title.js"></script>\n<link rel="stylesheet" href="lab-tb.css">\n<script src="lab-tb.js"></script>\n</body>')
path.write_text(html)
print('82.18 toolbars integrated')
