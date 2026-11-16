"""Write pages-src/gallery.html from the photo list below, then run tools/pages.py.

  python -I tools/gallery_src.py && python -I tools/pages.py

To add a photo: put it in img/aspen/, run tools/small_photos.py, and add a line to PHOTOS
(file, width, height, category, title, alt).
The 3D ring at the top shows the first 20 photos of the chosen filter; the grid shows them all.
"""
import os

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CATS = [('exteriors', 'Exteriors'), ('kitchens', 'Kitchens'), ('bathrooms', 'Bathrooms'),
        ('living', 'Living'), ('outdoor', 'Outdoor living'), ('stages', 'Build stages')]
NAME = dict(CATS)

# file, width, height, category, title, alt  (order = order on the page; categories interleave for variety)
PHOTOS = [
    ('img/aspen/ext-06.webp', 1024, 683, 'exteriors', 'Modern farmhouse', 'White farmhouse with black-trimmed gables, cedar posts and a curved front walk'),
    ('img/aspen/kit-02.webp', 1024, 683, 'kitchens', 'Open kitchen', 'Open kitchen with a long wood island, pendant lights and a wall of glass doors'),
    ('img/aspen/out-02.webp', 1077, 720, 'outdoor', 'Timber pavilion', 'Cedar timber-frame pavilion over a stone patio at sunset'),
    ('img/primary-bath.webp', 800, 1201, 'bathrooms', 'Primary bath', 'Primary bathroom with marble floors, a walk-in shower and a lit vanity'),
    ('img/modern-farmhouse.webp', 1024, 683, 'exteriors', 'Farmhouse at dusk', 'White modern farmhouse with black windows at the end of a long concrete drive at dusk'),
    ('img/aspen/liv-06.webp', 1100, 733, 'living', 'Great room', 'Open great room with exposed timber beams, built-in shelving and a long dining table'),
    ('img/aspen/kit-03.webp', 1024, 683, 'kitchens', 'Waterfall island', 'White kitchen with a waterfall quartz island, brass pendants and a gold faucet'),
    ('img/aspen/ext-05.webp', 1024, 1535, 'exteriors', 'Front entry', 'Front entry and walk of a white farmhouse in evening light'),
    ('img/aspen/out-03.webp', 1099, 686, 'outdoor', 'Backyard living', 'Stone and stucco home with a covered patio and a green lawn'),
    ('img/aspen/bath-03.webp', 827, 1238, 'bathrooms', 'Marble shower', 'Marble walk-in shower and a freestanding tub with brass fixtures'),
    ('img/stone-ranch.webp', 1024, 683, 'exteriors', 'Limestone ranch', 'Single-storey limestone ranch home under a clear sky'),
    ('img/aspen/liv-02.webp', 1087, 815, 'living', 'Open living', 'Open living room looking into a kitchen with a stone backsplash'),
    ('img/aspen/kit-05.webp', 1024, 683, 'kitchens', 'Kitchen and light', 'Bright kitchen with a wood-front island, pendants and tall black windows'),
    ('img/aspen/ext-09.webp', 1024, 683, 'exteriors', 'Two-storey rear', 'Back of a white two-storey home with a covered balcony and patio'),
    ('img/aspen/bath-04.webp', 1024, 1535, 'bathrooms', 'Brass rain shower', 'Brass rain shower fixtures on marble tile'),
    ('img/aspen/out-01.webp', 1117, 746, 'outdoor', 'Covered porch', 'Long covered porch with cedar posts and a view over the yard'),
    ('img/game-room.webp', 1134, 850, 'living', 'Game room', 'Large game room with a coffered ceiling and built-in cabinets'),
    ('img/aspen/ext-07.webp', 1006, 671, 'exteriors', 'Farmhouse side', 'Side of a white farmhouse with new landscaping and a gravel drive'),
    ('img/aspen/kit-04.webp', 1024, 683, 'kitchens', 'Galley kitchen', 'White galley kitchen with black counters and open shelving'),
    ('img/aspen/liv-04.webp', 1148, 861, 'living', 'Dining nook', 'Arched opening into a dining nook beside the kitchen'),
    ('img/board-batten-farmhouse.webp', 1114, 743, 'exteriors', 'Board-and-batten farmhouse', 'White board-and-batten farmhouse with a metal roof on a green lawn'),
    ('img/aspen/bath-05.webp', 883, 1326, 'bathrooms', 'Walk-in shower', 'Walk-in shower with large white tile and black fixtures'),
    ('img/aspen/out-04.webp', 1062, 708, 'outdoor', 'Poolside porch', 'Screened porch with a dining table beside the pool'),
    ('img/aspen/kit-06.webp', 1372, 915, 'kitchens', 'Brass details', 'Brass faucet and pendant over a white quartz island'),
    ('img/aspen/liv-05.webp', 1175, 783, 'living', 'Family room', 'Family room with a leather sectional and large windows'),
    ('img/aspen/ext-12.webp', 859, 1287, 'exteriors', 'Porch detail', 'Cedar porch ceiling meeting a white stucco wall'),
]
SMALL = {'img/modern-farmhouse.webp': 'img/modern-farmhouse-sm.webp 640w', 'img/stone-ranch.webp': 'img/stone-ranch-sm.webp 640w',
         'img/board-batten-farmhouse.webp': 'img/board-batten-farmhouse-sm.webp 640w', 'img/game-room.webp': 'img/game-room-sm.webp 640w',
         'img/primary-bath.webp': 'img/primary-bath-sm.webp 480w'}
STAGES = [('001', '01 &middot; Design', 'the house as a wireframe plan on the lot'), ('045', '02 &middot; Site &amp; slab', 'the slab being poured by a concrete pump'),
          ('069', '03 &middot; Framing', 'timber walls framed on the slab'), ('095', '04 &middot; Roof &amp; walls', 'shingles and siding going on, with scaffolding'),
          ('121', '05 &middot; Finishes', 'the finished house with its front walk and new lawn'), ('149', '06 &middot; Move-in', 'the front of the finished farmhouse'),
          ('dusk', 'Lights on', 'the finished farmhouse at dusk with its windows and porch lights glowing')]
SIZES = '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw'


def item(src, w, h, cat, title, tag, alt, srcset=None):
    ss = f' srcset="{srcset}"' if srcset else ''
    return (f'        <a class="gal__item" data-cat="{cat}" href="{src}" data-lightbox data-title="{title}" data-tag="{tag}">'
            f'<img src="{src}"{ss} sizes="{SIZES}" width="{w}" height="{h}" alt="{alt}" loading="lazy" decoding="async">'
            f'<span><b>{title}</b>{tag}</span></a>\n')


def small_of(src):
    """The 640px copy made by tools/small_photos.py, used on phones and on the 3D ring's cards."""
    if src in SMALL:
        return SMALL[src]
    sm = src[:-5] + '-sm.webp'
    return f'{sm} 640w' if os.path.exists(os.path.join(here, sm)) else None


rows = ''
for src, w, h, cat, title, alt in PHOTOS:
    small = small_of(src)
    rows += item(src, w, h, cat, title, NAME[cat], alt, f'{small}, {src} {w}w' if small else None)
for n, title, what in STAGES:
    rows += item(f'frames/d/{n}.webp', 1920, 1080, 'stages', title, 'Build stage &middot; rendering', f'Rendering: {what}',
                 f'img/stages/{n}-sm.webp 640w, frames/p/{n}.webp 1280w, frames/d/{n}.webp 1920w')

counts = {c: sum(1 for p in PHOTOS if p[3] == c) for c, _ in CATS}
counts['stages'] = len(STAGES)
total = len(PHOTOS) + len(STAGES)
buttons = f'          <button type="button" aria-pressed="true" data-filter="all">All <span>{total}</span></button>\n'
for c, label in CATS:
    buttons += f'          <button type="button" aria-pressed="false" data-filter="{c}">{label} <span>{counts[c]}</span></button>\n'

page = f'''    <!-- PAGE HERO -->
    <header class="phero phero--short">
      <img class="phero__img" src="img/aspen/out-02.webp" sizes="100vw" width="1077" height="720" alt="" fetchpriority="high">
      <div class="phero__in">
        <p class="crumbs"><a href="index.html">Home</a><span aria-hidden="true">/</span>Gallery</p>
        <p class="eyebrow">Gallery</p>
        <h1 class="phero__title"><span class="ln"><span>Homes we're proud</span></span><span class="ln"><span>to put our <em>name</em> on.</span></span></h1>
      </div>
    </header>

    <!-- 3D RING: drag to turn through the work, press a photo to open it (pages.js builds it from the grid) -->
    <section class="ring" aria-labelledby="ring-title">
      <div class="ring__head">
        <p class="kicker kicker--light">The collection</p>
        <h2 id="ring-title" class="title title--light" data-split>Walk through <span>our <em>work.</em></span></h2>
      </div>
      <div class="ring__stage" aria-roledescription="carousel" aria-label="Aspen projects in 3D">
        <div class="ring__ring"></div>
      </div>
      <div class="ring__bar">
        <button type="button" class="ring__btn" data-ring="-1" aria-label="Previous photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
        <p class="ring__now" aria-live="polite"><b></b><span></span></p>
        <button type="button" class="ring__btn" data-ring="1" aria-label="Next photo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
      <p class="ring__hint" aria-hidden="true">Drag to turn &middot; press a photo to open it</p>
    </section>

    <!-- GALLERY: filter, then press a photo to open the viewer -->
    <section class="gal" aria-labelledby="gal-title">
      <h2 id="gal-title" class="sr">Photos and renderings</h2>
      <div class="gal__bar">
        <div class="gal__filters" role="group" aria-label="Show">
{buttons}        </div>
        <p class="gal__count" aria-live="polite">Showing all {total}</p>
      </div>

      <div class="gal__grid">
{rows}      </div>
      <p class="gal__note">Aspen projects across Central Texas, plus stages from our build animation. <a href="https://aspenhomesoftx.com/gallery/">See more on aspenhomesoftx.com</a>.</p>
    </section>

    <!-- CTA -->
    <section class="cta" aria-labelledby="cta-title">
      <div class="cta__glow" aria-hidden="true"></div>
      <p class="kicker kicker--light">Like what you see?</p>
      <h2 id="cta-title" data-split>Let's <em>build</em> yours.</h2>
      <p>Sketch your home in two minutes, in 3D, with your finishes and your light.</p>
      <div class="cta__row">
        <a class="btn btn--light" href="index.html#plan">Plan your home</a>
        <a class="btn btn--ghost" href="tel:5128485647">(512) 848-5647</a>
      </div>
    </section>
'''
with open(os.path.join(here, 'pages-src', 'gallery.html'), 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(page)
print('gallery source written:', total, 'items', counts)
