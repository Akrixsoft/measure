"""82.14: attach lab-icons.js (comms-mode button icon, option 2) after lab-sketch.js. Inline v81 code is not changed."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()
old = '<script src="lab-sketch.js"></script>\n</body>'
if html.count(old) != 1:
    raise SystemExit('Expected exactly one match: ' + old)
html = html.replace(old, '<script src="lab-sketch.js"></script>\n<script src="lab-icons.js"></script>\n</body>')
path.write_text(html)
print('82.14 icons integrated')
