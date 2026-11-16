"""Build the frame-to-finish slider images from two hero frames.

  python tools/compare_frames.py            # framing frame 81, finished frame 121
  python tools/compare_frames.py 79 121     # pick other frames

Run it from the aspen-cinematic folder after re-rendering the frames. The camera drifts during the
build, so the finished frame is warped onto the framing frame (SIFT features on the ground, a RANSAC
homography), then both are cropped to the same 16:9 box. Needs opencv-python and numpy.
Writes img/compare-frame(.webp|-sm.webp) and img/compare-finish(.webp|-sm.webp).
"""
import os
import sys

import cv2
import numpy as np

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
a_id, b_id = (int(sys.argv[1]), int(sys.argv[2])) if len(sys.argv) > 2 else (81, 121)


def load(i):
    path = os.path.join(here, 'frames', 'q', f'{i:03d}.webp')
    im = cv2.imread(path, cv2.IMREAD_COLOR)
    if im is None:
        sys.exit(f'missing frame: {path}')
    return im


A, B = load(a_id), load(b_id)
sift = cv2.SIFT_create(4000)
ka, da = sift.detectAndCompute(cv2.cvtColor(A, cv2.COLOR_BGR2GRAY), None)
kb, db = sift.detectAndCompute(cv2.cvtColor(B, cv2.COLOR_BGR2GRAY), None)
good = [m for m, n in cv2.BFMatcher().knnMatch(db, da, k=2) if m.distance < 0.72 * n.distance]
if len(good) < 12:
    sys.exit('not enough matching features between the two frames; pick frames closer together')
src = np.float32([kb[g.queryIdx].pt for g in good]).reshape(-1, 1, 2)
dst = np.float32([ka[g.trainIdx].pt for g in good]).reshape(-1, 1, 2)
H, inliers = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
print(f'{int(inliers.sum())} of {len(good)} matches agree')

h, w = A.shape[:2]
warped = cv2.warpPerspective(B, H, (w, h), flags=cv2.INTER_LANCZOS4)
valid = cv2.warpPerspective(np.full((h, w), 255, np.uint8), H, (w, h), flags=cv2.INTER_NEAREST)

# largest centred 16:9 box that the warped frame fully covers
box = None
for f in np.arange(1.0, 0.6, -0.005):
    x0, y0 = int(w / 2 - w * f / 2), int(h / 2 - h * f / 2)
    x1, y1 = int(w / 2 + w * f / 2), int(h / 2 + h * f / 2)
    if valid[y0:y1, x0:x1].min() == 255:
        box = (x0, y0, x1, y1)
        break
if not box:
    sys.exit('the frames are too far apart to crop a shared view')
x0, y0, x1, y1 = box
for name, im in (('frame', A), ('finish', warped)):
    crop = im[y0:y1, x0:x1]
    for width, suffix in ((1920, ''), (1280, '-sm')):
        out = cv2.resize(crop, (width, round(width * crop.shape[0] / crop.shape[1])), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(here, 'img', f'compare-{name}{suffix}.webp'), out, [cv2.IMWRITE_WEBP_QUALITY, 80])
print('wrote img/compare-frame*.webp and img/compare-finish*.webp')
