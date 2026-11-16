# Aspen Homes: the scroll-to-build website

This homepage takes its layout from the two Instagram reels. The whole screen shows the build site, and the house goes up as you scroll. The navy, logo, copy, photos, reviews, phone numbers and links come from aspenhomesoftx.com. On top of that sits a luxury layer: a warm ivory paper colour, a brass accent and Instrument Serif italics for emphasis words.

Open `index.html` to view it, straight from the folder. It needs no build step and no server, and every feature (the 3D model and the assistant included) works that way. To demo it on a phone over your Wi-Fi:

```
cd aspen-cinematic
python -m http.server 8080
```

Then open `http://<this PC's IP>:8080` on the phone. You can find the IP with `ipconfig`. The phone and PC must be on the same network.

## Files

| File | What it does |
|---|---|
| `index.html` | The home page |
| `custom-homes.html`, `gallery.html`, `process.html` | The inner pages. Generated: edit `pages-src/` and run `python -I tools/pages.py` |
| `pages-src/` | The inner pages' own content (everything between the header and the footer) |
| `pages.js` | The gallery's 3D ring, sliding filters and leaning photos, the floating section bar (Homes and Process), the Homes page's Photo / 3D model switch, and the process page's picture that follows the steps |
| `img/aspen/` | Aspen's real project photos, from the galleries on aspenhomesoftx.com |
| `styles.css` | All styles. Colours and fonts are tokens at the top (`--navy`, `--brass`, `--ivory`, `--serif`) |
| `main.js` | The scroll-to-build hero, the coin loader, header, menu, section highlighting, page-switch overlay, heading reveals, service hover preview, reviews marquee |
| `motion.js` | Gliding same-page links, magnetic buttons, the drifting type band, the CTA glow, pausing loops off screen |
| `features.js` | The frame-to-finish slider, the pinned gallery and its photo viewer, the Plan Your Home sketch, the service-area map, the chat launcher |
| `house3d.js` | The 3D model and Design Studio in the planner (three.js r149 from jsDelivr; both load only when the planner comes near) |
| `chat.js` | The Aspen Assistant: the small chat bottom right, in demo mode |
| `netlify/functions/chat.mjs` | For later: the server side of a live AI assistant (not used by the demo) |
| `package.json` | For later: holds only that function's dependency (`@anthropic-ai/sdk`) |
| `tools/pages.py` | Builds the inner pages from `pages-src/` plus the header, footer and buttons in `index.html` |
| `tools/gallery_src.py` | Writes `pages-src/gallery.html` from its photo list (add photos there) |
| `tools/small_photos.py` | Makes the 640px copies (`-sm.webp`) of the photos in `img/aspen/` |
| `tools/dusk_to_sets.py` | Turns the dusk render into `frames/p|d|q/dusk.webp` |
| `../blender/dusk.py` | Relights the hero's last frame for dusk and renders it (see "The dusk finale") |

To go back to the original blue accent, set `--brass` and `--brass-ink` to `#0466c8` in `styles.css`.

## Page sections

1. **Loader.** The round Aspen coin flips in the middle of the screen. It starts grey and fills with colour, inside a brass ring, as a large count rises to 100. Then the screen lifts away and the coin flies into the logo in the header, which catches a brass sheen. It waits 2.4 seconds at most.
2. **Hero (scroll to build).** The screen is pinned to a full-screen image while 150 frames play:
   - the stages are plan, site and slab (a concrete pump pours it), framing, roof and walls, finishes and move-in
   - a blue drafting grid sits over the wireframe frames and fades as the slab goes in
   - each stage has its own caption, a build-progress counter, the Hutto coordinates and a stage rail
   - after the last frame, the same view fades into dusk: the sky deepens and the windows and porch lamps glow ("The dusk finale" below)
   - the last screen shows "Plan your home" and "Call" buttons
3. **Type band.** Two rows of large type ("Designed in-house, Built on your lot…" and the four services) drift sideways, speed up while you scroll and turn round when you scroll back.
4. **Trust strip.** Right under the type band: a 10-year structural warranty (Maverick Builder Warranty), fixed-price turnkey proposals, third-party inspections at every major stage, the in-house architect and design center, and Google reviews. All from Aspen's own process and warranty pages.
5. **Story.** Aspen's own copy, plus four real facts that count up: 9 towns, 4 services, 1 in-house architect, open 7 days a week.
6. **Services.** A large list, each with a real Aspen photo. On desktop each name rolls letter by letter into brass on hover, and a photo preview follows the cursor. On phones each service is a card with its photo on top.
7. **Frame to finish.** A drag slider over the same house at framing and at move-in, made from two hero frames (see below). It sweeps across once by itself the first time it comes into view. Keyboard users get a slider (arrow keys).
8. **Homes.** On desktop the section pins and the gallery travels sideways as you scroll, with the photos drifting inside their frames. On phones it's a swipe carousel. Pressing a photo opens a full-screen viewer: the photo grows out of its card, with arrows, thumbnails, the arrow keys, swipe and Esc.
9. **Build-On-Your-Lot.** The in-house architect copy and the list of what Aspen builds.
10. **Plan your home.** A four-step brief: home type, size and rooms (or what to update, for a remodel), lot, town and timing, then name and email. As you answer, the house is modelled live in two views:
   - **3D model:** a lit, shadowed model of the house on its lot. The walls rise and the roof drops on whenever the shape changes. It turns slowly by itself; drag to turn it, double-click to reset. Each style has its own build: a hill-country custom home with a stone base, an entry tower and garages; a farmhouse with front gables and a cedar porch; a barndominium with a metal roof and a wraparound porch; a remodel shown as a glass outline of today's house with the new work in brass and labelled.
   - **Elevation:** the blueprint front elevation, with the title block showing your name.
   - **Design Studio** (under the 3D model): a light slider from day through golden hour and dusk to night, which moves the sun, colours the sky, lights the windows and turns on the porch lamps; and swatches for siding (Alabaster, Greige, Sage, Iron), roof (Charcoal, Black, Galvalume, Bronze), stone (Limestone, Brick, Slate) and accents (Cedar, Black, White oak). The model recolours instantly.

   The last step's button, "Create my Home Brief", opens a one-page brief: Aspen's header and a brief number, a picture of their 3D design as they left it, everything they chose (finishes included), the elevation drawing, Aspen's next steps and the contact details. From there they can save it as a PDF (it prints on exactly one Letter page; choose "Save as PDF" as the printer), email it to alan@aspenhomesoftx.com, or send it on WhatsApp. Only a name is required.
11. **Reviews.** Real reviews in a sliding marquee that pauses on hover or focus.
12. **Service area.** The 9 towns with straight-line miles from Hutto, above a real map of Central Texas (Leaflet with OpenStreetMap tiles, warmed to grey-ivory). A line runs from Hutto (the Aspen coin) to each town in the same direction as before, every town is labelled with its name and miles, and the rings at 15, 30 and 45 miles are true to scale. Pointing at a town (on the map or in the list) turns its line brass with light running out from Hutto; while the map is on screen a slow tour lights each town in turn until you point at it. On phones the dots and lines stay and one town's label shows at a time. The map can be dragged and zoomed with + and − (the wheel and one finger keep scrolling the page). It loads only when the section nears the screen; until its tiles are in, or if they can't load, the drawing of the same lines shows instead.
    - **Map tiles.** OpenStreetMap's tile servers are free for a site like this with the credit shown, but they aren't meant for heavy traffic. For a busy launch, switch the tile URL in `features.js` to a provider plan (MapTiler, Stadia or similar; most need a free key tied to the domain). CARTO's basemaps now need a key (they show an "API key required" watermark without one).
13. **Call to action and footer.** A brass glow follows the pointer behind "Let's build it.", with Call and Contact buttons. In the footer, the WhatsApp logo sits with Facebook, Instagram and Google under Follow Us, and the large wordmark rises into place.

Throughout the page:

- **Header.** The menu goes to Homes, Gallery, Process, Reviews and Plan your home. The logo is larger and catches a brass sheen each time you move into another section or open a page, and the menu underlines where you are.
- **Nothing leaves the site.** Every service, gallery and process link stays inside the demo. Clicking a town in the service area opens the planner with that town picked. The only link to aspenhomesoftx.com is the "website concept" note in the footer (and the full-gallery note on the gallery page).
- **Page switch.** Links to other pages close over the site with a navy circle and the spinning coin, then open the next page.
- **WhatsApp and the assistant.** A round green WhatsApp logo sits bottom left and the Aspen Assistant (the coin) bottom right. On phones both appear once you've scrolled past the hero.

## Inner pages

- **Homes we build** (`custom-homes.html`): custom homes, luxury farmhouses, barndominiums and remodeling, each with a real photo, its own copy and a call to action. Every photo has a **Photo / 3D model** switch: the 3D model is the planner's model of that house type (a two-storey farmhouse, a hill-country custom home, a barndominium with a wraparound porch, a remodel with the new work in brass), with Day, Golden, Dusk and Night light. Drag to turn it.
- **Gallery** (`gallery.html`): opens with a **3D ring** of the work. Drag or swipe to turn it, use the arrows or arrow keys, or let it turn slowly by itself; the photo in front is named underneath, and pressing it opens the full-screen viewer. Below it, a filterable grid (Exteriors, Kitchens, Bathrooms, Living, Outdoor living, Build stages). The filters change the ring too.
- **Our process** (`process.html`): Aspen's six steps with a picture that changes as you read; build on your lot; the Maverick Builder Warranty; questions and answers.

The copy is written from Aspen's own pages (their process, build-on-your-lot, service and warranty pages). The header, footer, corner buttons and chat are copied from `index.html` by `tools/pages.py`, so change them there and run it again.

**Photos.** The 26 photos in the gallery and on the Homes page are Aspen's own, from the galleries on aspenhomesoftx.com (exteriors, kitchens, bathrooms, living rooms, outdoor living), plus 7 stages of the build animation labelled "rendering". Aspen's galleries have no barndominium photo, so the barndominium service uses their timber-beamed great room until they send one. To add photos: put them in `img/aspen/`, add a line to `PHOTOS` in `tools/gallery_src.py`, then run `python -I tools/gallery_src.py` and `python -I tools/pages.py`.

## The dusk finale

The hero's dusk frame is a real render of the same Blender scene, relit: a low orange sun, an evening sky and the rooms and porch lamps on. `dusk.py` runs after `aspen_build.py` in the same Blender session and doesn't change it:

```
cd ../blender
blender -b --factory-startup -P aspen_build.py -P dusk.py -- --full --res 2560x1440 --samples 40 --dusk-out OUT_DIR --sky-elev 0.3 --sky 0.34 --exposure 0.15 --sun 0.7 --lamps 3.0 --rooms 3.2
cd ../aspen-cinematic
python -I tools/dusk_to_sets.py OUT_DIR/dusk_final.png
```

Re-run both after re-rendering the frames. The page fades to dusk only once the camera has stopped on the last view, so the two images always line up.

## WhatsApp

Every WhatsApp link opens a chat with **+1 (512) 848-5647**, Aspen's main number, with a message ready to send. Check that this number is on WhatsApp (ideally WhatsApp Business). To use another number, replace `15128485647` in `index.html` and in `WHATSAPP` in `features.js`; it's the country code plus the number, digits only.

## The Aspen Assistant (demo)

The coin in the bottom-right corner opens a small chat. Right now it's a demo: it calls no AI service. It answers common questions (building on your lot, the towns, the services, pricing, timing, hours, how to reach a person) from built-in replies in `chat.js`, all taken from aspenhomesoftx.com, after a short typing pause. Anything it doesn't recognise goes to the phone number and WhatsApp. It never quotes prices or timelines.

**Switching to a live AI later.** The pieces are already here:

1. Add an Anthropic API key to the Netlify site: `netlify env:set ANTHROPIC_API_KEY <your key>`.
2. Set `LIVE_AI = true` at the top of `chat.js`.
3. Deploy with `python -I tools/deploy.py --with-ai`, which also publishes `netlify/functions/chat.mjs`.

The function asks Claude (`claude-opus-5-5` at low effort, for quick, short replies) with a system prompt of Aspen's facts only, and tells it never to invent prices, timelines, warranties or financing. If Claude declines a request, the API re-runs it on Anthropic's recommended fallback model. If the function fails, the chat falls back to the built-in replies. Each live reply is billed to the API key.

## The planner's email

The brief goes out through a `mailto:` link, so nothing is stored and no server is needed. The address is `EMAIL` near the top of the planner code in `features.js`. To collect briefs in Netlify instead, add `name="home-brief" data-netlify="true"` to the `<form>` and post the fields with `fetch('/', …)` in the submit handler.

## Motion and accessibility

- **Tab switching.** In Chrome, Edge and Safari 18.2+ pages switch with a native view transition: the header and the two corner buttons stay put while the old page lifts away and the new one rises in, with no wait (`@view-transition` in `styles.css`). Chrome and Edge also prerender an inner page while you hover its link, so it opens instantly; the home page is only prefetched (speculation rules in the head). Other browsers keep the coin overlay.
- **Header.** One brass line glides between the tabs as you hover them and rests on the current page (or, on the home page, the section you're in). A thin brass line under the header fills as you read (drawn by the browser from the scroll position, no script).
- **Homes and Process.** Once the page's own section buttons scroll away, they follow you as a floating bar under the header (it moves up when the header hides); an ivory highlight slides to the section you're reading. On phones the bar scrolls sideways and keeps the current section in view.
- **Gallery.** The filter highlight slides between the buttons, photos glide to their new places when you filter (new ones rise in), and with a mouse each photo leans toward the pointer with a soft glare.
- **Reviews.** Drag or flick the reviews with a mouse or a finger (vertical swipes still scroll the page); a flick carries on for up to about a screen.
- **Process questions.** Answers open and close smoothly, one at a time (native `<details name>`; the height animation needs a recent Chrome or Edge, other browsers open instantly).
- **Native scrolling.** The page scrolls with the browser's own scrolling everywhere (it runs off the main thread, so it never stutters or trails the wheel). Same-page links glide to their section.
- **Side scroll.** A mouse's side wheel (thumb wheel or wheel tilt), Shift + wheel, or a sideways trackpad swipe moves whatever slider is under the pointer, on every page: the gallery's 3D ring (one click, one photo, settling on a whole photo), the photo viewer (one click, one photo; the thumbnail strip keeps its own sideways scroll), the Homes gallery on the home page (it glides through the pinned section, never past it), the frame-to-finish slider, the reviews, and the 3D models (they turn). Normal up and down scrolling is never touched, and side scrolling anywhere else does what the browser normally does.
- **Desktop only.** The magnetic buttons, the letter roll and the pinned gallery run only with a mouse. The normal system cursor is used everywhere.
- **Reduced motion.** Visitors with reduced motion turned on see the finished house without the scroll animation and get none of the motion above. The slider, planner and map still work, with no animation.
- **Keyboard.** Every control works from the keyboard. Same-page links move focus to their section, and tabbing into the pinned gallery scrolls the page to the card you reach.
- **Phones.** The hero frame is shown wider than the screen and feathered into a soft copy of itself, so the house stays readable in portrait.

## Speed

- **Frame sets.** The hero frames come in three sizes:
  - `frames/p` is 1280 px, for phones
  - `frames/d` is 1920 px, for laptops
  - `frames/q` is 2560 px, for 1440p, 4K and retina screens

  Each screen downloads only the smallest set that is sharp on it. Because the frames are always moving, screen density counts up to 1.5x only, so a 2x laptop gets `d` (about 8 MB) rather than `q` (about 12 MB). On Data Saver it always gets `p`.
- **Only real frames.** Only every other frame is rendered (001, 003, … 149), and `data-step="2"` on the hero tells the page so. It never asks for the missing ones. If you render every frame, remove `data-step`.
- **Loading order.** The first pass (every 16th frame, about 1 MB) loads behind the coin. The rest wait until the browser is idle or you start scrolling, so they never compete with the first paint. The canvas never paints more pixels than the frames hold.
- **Decoding.** Frames are kept as small compressed files (about 100 KB each). Only the frames near where the scroll is heading (8 on each side) are decoded, off the main thread, into bitmaps the GPU draws at once; the rest are released. Keeping all 76 decoded would hold about 600 MB and make every draw wait, which is what made the hero stutter before. Frames are drawn at `medium` smoothing (a third of the cost of `high`, no visible difference in motion). The first frame is preloaded as a fetch, matching how `main.js` loads it.
- **Loaded only when needed.** three.js and the 3D model load only when the planner comes near the screen. The dusk frame (31 to 96 KB) loads with the rest of the frames, after the first screen. A first visit loads four small scripts (about 70 KB before compression), the stylesheet, two font families and the logos, and no photo until you scroll to it.
- **Below the fold.** Sections use `content-visibility: auto`, images are responsive (`srcset`) and lazy-loaded, and the fonts don't block the first paint.
- **Tab features.** None of them runs per frame while you scroll: the progress line is a scroll-driven CSS animation, the floating bar and the header line move on events, and the highlights slide with CSS transitions. Measured main-thread cost per scroll step: about 0.03 ms.
- **Off-screen.** No animation runs off-screen: the hero, the band, the gallery, the 3D ring, the 3D models and the cursor preview only animate while visible, and the reviews marquee and map pulses pause when scrolled away.
- **3D ring.** Cards fade with opacity only (drawn by the GPU, written in 2% steps), the far side of the ring isn't drawn, and the cards use the 640px copies (photos and build stages). There are no mirror reflections: they repainted all 20 cards every frame. The ring is laid out from the same numbers as the CSS, so building it never forces a layout of the page while it loads.
- **Photo viewer.** It opens at once on the card's own picture, then swaps in the full photo once it's downloaded and decoded; the next and previous photos are fetched ahead, so the arrows (and side scroll) never decode a large photo on screen. There's no blur behind it (the viewer is 94% opaque, so the blur was GPU work nobody saw), and its thumbnails are the 640px copies.
- **3D models.** Rendered at up to 2x density on desktop and 1.5x on phones.
- **Measured** (Chrome, Intel Iris Xe laptop, 90 Hz screen, scrolling 30 px per frame): every page holds 90 fps, and the gallery shows its first photo in about 0.3 s on a first visit with no script stalls while it loads. Before this pass the hero averaged 29 ms a frame with 20 main-thread stalls up to 121 ms, and the gallery ring ran at about 3 fps.
- **Hosting.** When hosting, serve `frames/` with a long cache lifetime, for example `Cache-Control: public, max-age=31536000, immutable`.

## Publishing (Netlify)

The demo is live at **https://aspen-homes-concept.netlify.app**. To publish changes, run this from this folder:

```
python -I tools/deploy.py
```

It uploads only the pages, their scripts, `img/` and `frames/`, not the README, `pages-src/` or tools. Add `--with-ai` to also publish the chat function (see the assistant section).

Add `--draft` to publish to the test address (https://gate-test--aspen-homes-concept.netlify.app) instead of the live site.

## Private preview (access gate)

Nobody can load the site without approval. `netlify/edge-functions/access.js` runs on Netlify before every request and sends pages, scripts, frames and photos only to approved visitors; everyone else gets the "Request access" page.

- **Approving people.** Open `/_access/admin` and enter the admin key (in `ACCESS-ADMIN-KEY.txt`, which is never published). Approve, deny or revoke requests there, choose how long access lasts (7 days by default), or create a personal invite link for someone. A waiting visitor is let in by itself once approved, on the device they asked from.
- **What a visitor without access sees.** The real home hero (scroll to build) and, after it, the "Want the full preview?" invitation card. `tools/deploy.py` cuts that hero-only page (`teaser.html`) out of `index.html` on every publish. For it to run, `styles.css`, `main.js`, `motion.js`, the hero frames and the logos are open to everyone; every other page, script and photo stays locked.
- **Email.** Each request also emails the Netlify account address (Netlify Forms, form `access-request` in `access-form.html`).
- **Tracing.** Every page is stamped with the approved person's name: a small label in the corner and a comment in the page source. Set `WATERMARK = false` in `access.js` to hide the label.
- **Revoking** takes effect within 10 minutes (`SESSION_SECONDS`).
- **Settings.** The site needs the environment variables `ACCESS_ADMIN_KEY` and `ACCESS_SECRET`. Requests are stored in Netlify Blobs (store `access`).
- **Vercel copy.** `middleware.js` is the same gate for a Vercel deployment of this repo (`vercel.json` holds its settings, `.vercelignore` keeps the README and tools out). It keeps no list of its own: it checks sessions itself and passes `/_access/*` through to the Netlify site, so one admin page covers both addresses. It needs the environment variable `GATE_PROXY_KEY` on the Vercel project, with the same value as on Netlify (kept in `VERCEL-GATE-KEY.txt`, never published). Without it the Vercel site answers 503 to everything.
- **Limit.** An approved visitor's browser still downloads the page, so they can save it. The gate controls who gets in and records who it was; it can't stop an approved person copying.

- **Search engines.** The site is kept out of them three ways: a `noindex` meta tag, an `X-Robots-Tag` header in `_headers`, and `robots.txt`. That way it never competes with aspenhomesoftx.com.
- **Footer.** The footer says the page is a website concept and links to the official site.
- **Netlify badge.** The "Powered by Netlify" badge is turned off in the site settings (`built_with_badge_enabled`).

## Rebuilding the frames (Blender)

```
blender -b --factory-startup -P ../blender/aspen_build.py -- --full --render --res 2560x1440 --samples 14 --out ../blender/frames_qhd
python -I ../blender/frames_to_sets.py ../blender/frames_qhd . ../flow-keyframes
```

`--full` renders the house, the lot, the pasture, the oaks and the sky in one pass. Add `--step 2` to render every other frame first; the page uses the nearest available frame until the gaps are filled.

After re-rendering, rebuild the frame-to-finish images. The camera drifts during the build, so the script lines the finished frame up with the framing frame before cropping both:

```
python tools/compare_frames.py          # frames 81 and 121
python tools/compare_frames.py 79 121   # or pick two others
```

It needs `opencv-python` and `numpy`.

## Swapping in the Google Flow video

```
python -I tools/video_to_frames.py "C:\path\to\flow-video.mp4"
```

This turns the video into 150 frames (change this with `--frames 180`) and updates `data-frames`. Use `--start` and `--end`, in seconds, to trim the video. It writes every frame, so it also removes `data-step` from the hero.

The tool also writes the p/d/q frame sets, capped at the video's own resolution. After running it, adjust each caption's `data-from` and `data-to` frame numbers so the captions line up with your video.
