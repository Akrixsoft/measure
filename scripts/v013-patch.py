"""Apply 0.13 integration to experimental.html (after integrate.py and v012-patch.py)."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()

def replace(old, new):
    global html
    if html.count(old) != 1:
        raise SystemExit(f'Expected exactly one match: {old[:100]}')
    html = html.replace(old, new)

replace('<script src="lab-route-ui.js"></script>\n</body>',
        '<script src="lab-route-ui.js"></script>\n<script src="lab-v013.js"></script>\n</body>')
path.write_text(html)
