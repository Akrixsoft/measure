"""82.16: attach lab-title.js (current version on the title, no «＋ Плоскость») after lab-icons.js. Inline v81 is not changed."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'web/experimental.html'
html = path.read_text()
old = '<script src="lab-icons.js"></script>\n</body>'
if html.count(old) != 1:
    raise SystemExit('Expected exactly one match: ' + old)
html = html.replace(old, '<script src="lab-icons.js"></script>\n<script src="lab-title.js"></script>\n</body>')
path.write_text(html)
print('82.16 title integrated')
