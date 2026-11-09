#!/usr/bin/env python3
"""Assemble experimental app from exact frozen baseline plus reviewed patches."""
from pathlib import Path
import hashlib, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'web/v81.html'
EXPECTED='b6c6987e16e63adf77b0e46a762805393b3e108955822001aed579f0c988d191'
assert hashlib.sha256(BASE.read_bytes()).hexdigest()==EXPECTED,'Frozen v81 changed'
text=BASE.read_text()
for f in ('lab-ui.css','lab-ui.js','lab-snap.js','lab-geometry.js','lab-export.js','lab-manual.js','lab-placement.js','lab-comms-ui.js','lab-comms-ui.css','lab-route-catalog.js','lab-routes.js','lab-route-ui.js','lab-route-ui.css','lab-floor-routes.js'):
 assert (ROOT/'web'/f).exists(), f'Missing extension: {f}'
# Exact source patch scripts, if required by an owner agent, write only experimental.html.
OUT=ROOT/'web/experimental.html'
OUT.write_text(text)
for patch in ('ui-patch.py','geometry-patch.py','export-patch.py','manual-patch.py','placement-patch.py','labels-patch.py','comms-patch.py','appearance-patch.py','routes-patch.py','floor-routes-patch.py','angle-patch.py'):
 p=ROOT/'scripts'/patch
 if p.exists(): subprocess.run([sys.executable,str(p),str(OUT)],check=True,cwd=ROOT)
text=OUT.read_text()
assert text.count('</head>')==1 and text.count('</body>')==1
text=text.replace('</head>','<link rel="stylesheet" href="lab-ui.css">\n<link rel="stylesheet" href="lab-comms-ui.css">\n<link rel="stylesheet" href="lab-route-ui.css">\n</head>')
text=text.replace('</body>','<script src="lab-ui.js"></script>\n<script src="lab-route-catalog.js"></script>\n<script src="lab-snap.js"></script>\n<script src="lab-geometry.js"></script>\n<script src="lab-export.js"></script>\n<script src="lab-manual.js"></script>\n<script src="lab-placement.js"></script>\n<script src="lab-comms-ui.js"></script>\n<script src="lab-routes.js"></script>\n<script src="lab-floor-routes.js"></script>\n<script src="lab-route-ui.js"></script>\n</body>')
OUT.write_text(text)
print('Integrated extensions; original v81 SHA256 verified')
