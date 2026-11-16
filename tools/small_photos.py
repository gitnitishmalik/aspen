"""Make a 640px-wide copy (name-sm.webp) of every photo in img/aspen/, and of the gallery's build stages
(img/stages/), that doesn't have one yet.

  python tools/small_photos.py

The gallery grid uses them on phones and the 3D ring uses them on its cards, so a phone or the ring
never decodes a full-size photo it would only show small. Run it after adding photos, then
tools/gallery_src.py and tools/pages.py.
"""
import os

from PIL import Image

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
folder = os.path.join(here, 'img', 'aspen')
W = 640
made = 0
for name in sorted(os.listdir(folder)):
    if not name.endswith('.webp') or name.endswith('-sm.webp'):
        continue
    src = os.path.join(folder, name)
    dst = os.path.join(folder, name[:-5] + '-sm.webp')
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        continue
    with Image.open(src) as im:
        if im.width <= W:
            continue
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        h = round(im.height * W / im.width)
        im.resize((W, h), Image.LANCZOS).save(dst, 'WEBP', quality=78, method=6)
        made += 1

# the build stages shown in the gallery: 640px copies in img/stages/ (cards, the ring and the viewer's thumbnails)
stages = os.path.join(here, 'img', 'stages')
os.makedirs(stages, exist_ok=True)
for n in ('001', '045', '069', '095', '121', '149', 'dusk'):
    src = os.path.join(here, 'frames', 'd', n + '.webp')
    dst = os.path.join(stages, n + '-sm.webp')
    if not os.path.exists(src) or (os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src)):
        continue
    with Image.open(src) as im:
        im = im.convert('RGB')
        im.resize((W, round(im.height * W / im.width)), Image.LANCZOS).save(dst, 'WEBP', quality=78, method=6)
        made += 1
print(f'made {made} small copies in img/aspen/ and img/stages/')
