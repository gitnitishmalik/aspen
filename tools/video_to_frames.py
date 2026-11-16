"""Turn a finished video (for example the Google Flow build film) into the hero's scroll frames.

  python -I tools/video_to_frames.py path/to/video.mp4 [--frames 150] [--start 0] [--end 0]

Run it from the aspen-cinematic folder. It needs ffmpeg on PATH and Pillow (pip install pillow).
It replaces frames/p, frames/d and frames/q (1280 / 1920 / 2560 px, capped at the video's own width)
and sets data-frames and data-sets in index.html.
--start / --end trim the video in seconds (0 = whole video).
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from PIL import Image

args = sys.argv[1:]
if not args or args[0].startswith('-'):
    sys.exit(__doc__)


def opt(name, default):
    return float(args[args.index(name) + 1]) if name in args else default


video = args[0]
count = int(opt('--frames', 150))
start, end = opt('--start', 0.0), opt('--end', 0.0)
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video],
                       capture_output=True, text=True, check=True)
length = (end or float(probe.stdout.strip())) - start
tmp = tempfile.mkdtemp()
try:
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(length), '-i', video,
                    '-vf', 'fps=%f' % (count / length), '-frames:v', str(count),
                    os.path.join(tmp, '%04d.png')], check=True)
    pngs = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    src_w = Image.open(os.path.join(tmp, pngs[0])).width
    # same set names the page uses: p (phones), d (laptops), q (large screens), never above the source
    sets = [(n, min(w, src_w), q) for n, w, q in (('p', 1280, 64), ('d', 1920, 66), ('q', 2560, 62))]
    sets = [s for k, s in enumerate(sets) if k == 0 or s[1] > sets[k - 1][1]]
    for name in ('p', 'd', 'q', 'm'):
        shutil.rmtree(os.path.join(here, 'frames', name), ignore_errors=True)
    for name, _, _ in sets:
        os.makedirs(os.path.join(here, 'frames', name))
    for n, f in enumerate(pngs, 1):
        im = Image.open(os.path.join(tmp, f)).convert('RGB')
        for name, w, q in sets:
            out = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS) if im.width > w else im
            out.save(os.path.join(here, 'frames', name, '%03d.webp' % n), 'WEBP', quality=q, method=5)
    page = os.path.join(here, 'index.html')
    with open(page, encoding='utf-8') as fh:
        html = fh.read()
    html = re.sub(r'data-frames="\d+"', 'data-frames="%d"' % len(pngs), html)
    html = re.sub(r' data-step="\d+"', '', html)   # every frame exists now, so the page may load them all
    html = re.sub(r'data-sets="[^"]*"', 'data-sets="%s"' % ','.join('%s:%d' % (n, w) for n, w, _ in sets), html)
    with open(page, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('wrote', len(pngs), 'frames; data-frames updated. Re-check the data-from/data-to stage ranges on the captions.')
finally:
    shutil.rmtree(tmp, ignore_errors=True)
