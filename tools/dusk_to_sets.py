"""Turn the dusk render of the last frame into the website's frame sets.

  python -I tools/dusk_to_sets.py PATH/TO/dusk_final.png

Render it first with ../blender/dusk.py (see the README). Writes frames/p|d|q/dusk.webp at the same
sizes and quality as the build frames, so the hero can fade the final view into dusk.
"""
import os
import sys
from PIL import Image

src = sys.argv[1]
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
im = Image.open(src).convert('RGB')
for name, w, q in (('p', 1280, 64), ('d', 1920, 66), ('q', 2560, 62)):
    out = im if im.width == w else im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    path = os.path.join(here, 'frames', name, 'dusk.webp')
    out.save(path, 'WEBP', quality=q, method=5)
    print(path, out.size, round(os.path.getsize(path) / 1024), 'KB')
