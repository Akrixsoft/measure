"""Apply 82.14 «Скетч» integration to experimental.html (after integrate.py, v012-patch.py, v013-patch.py).
Inline v81 code is not changed: only the module stylesheet and script are attached after lab-v013.js."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()

def replace(old, new):
    global html
    if html.count(old) != 1:
        raise SystemExit(f'Expected exactly one match: {old[:100]}')
    html = html.replace(old, new)

replace('<script src="lab-v013.js"></script>\n</body>',
        '<script src="lab-v013.js"></script>\n<link rel="stylesheet" href="lab-sketch.css">\n<script src="lab-sketch.js"></script>\n</body>')
path.write_text(html)
print('82.14 sketch integrated')
