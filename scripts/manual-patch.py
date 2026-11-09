#!/usr/bin/env python3
"""Manual wall annotations only. Keep wall size fields and stored dimensions."""
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
changes=[
('S.dimHits = []; if (S.adim) return drawAutoDims();',
 'S.dimHits = []; S.adH = []; return; /* Measure Lab 0.3: object dimensions are added manually only. */'),
('<label style="color:var(--tx)"><input type="checkbox" data-adim style="width:auto;height:auto"${S.adim ? \' checked\' : \'\'}> размеры всех</label>',''),
('<button data-rzx="auto" title="Стрелка каждой коммуникации: обычная стрелка от неё (пометка) — в стрелку-размер; остальное — по авторазмерам (по горизонтали и по высоте), введённое — введённым">⚡ стрелки по авторазмерам</button>',''),
]
for old,new in changes:
 n=s.count(old)
 if n!=1:raise SystemExit(f'Manual dimensions patch refused: expected1 got{n}: {old[:80]}')
 s=s.replace(old,new)
p.write_text(s)
print('Object auto dimensions disabled; explicit manual dimensions preserved')
