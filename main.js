/* Aspen Homes homepage: the house builds as you scroll, plus loader, header, menu and reveals.
   motion.js adds smooth scroll, the cursor and magnetic buttons; features.js adds the compare
   slider, the pinned gallery, the home planner and the service-area map. */
(() => {
  'use strict';

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const body = document.body;

  /* ------------------------------------------------ scroll to build */
  const scrolly = document.getElementById('build');
  // the hero only exists on the home page; inner pages open straight away
  if (scrolly) hero();
  else requestAnimationFrame(() => { body.classList.remove('is-loading'); body.classList.add('ready'); });

  function hero() {
    const stage = scrolly.querySelector('.stage');
    const canvas = document.getElementById('stage');
    const ctx = canvas.getContext('2d', { alpha: false });
    const N = +scrolly.dataset.frames || 150;
    const caps = [...scrolly.querySelectorAll('.cap')];
    const rail = [...scrolly.querySelectorAll('.rail li')];
    const finale = scrolly.querySelector('.finale');
    const hudPct = document.getElementById('hudPct');
    const hudStage = document.getElementById('hudStage');
    const stageNames = ['Design', 'Foundation', 'Framing', 'Roof & walls', 'Finishes', 'Move-in'];

    // pick the smallest frame set that is sharp on this screen (data-sets="name:width,...")
    const sets = (scrolly.dataset.sets || 'p:1280,d:1920,q:2560').split(',')
      .map((s) => { const [name, w] = s.split(':'); return { name, w: +w }; })
      .sort((a, b) => a.w - b.w);
    const portrait = innerHeight > innerWidth;
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    // frames are always in motion, so density is capped at 1.5x: a 2x laptop gets the 1920 set (8 MB)
    // instead of the 2560 one (12 MB) with no visible difference while scrubbing
    const need = Math.max(innerWidth, innerHeight * 16 / 9 * (portrait ? 0 : 1)) *
      Math.min(window.devicePixelRatio || 1, 1.5) * (portrait ? 1.42 : 1);
    const pick = saveData ? sets[0] : (sets.find((s) => s.w * 1.2 >= need) || sets[sets.length - 1]);
    const set = pick.name;
    const url = (i) => `frames/${set}/${String(i).padStart(3, '0')}.webp`;
    // data-step="2" means only every other frame was rendered (001, 003, ...): never request the gaps
    const STEP = Math.max(1, +scrolly.dataset.step || 1);
    const has = (i) => (i - 1) % STEP === 0;
    let last = N;
    while (!has(last)) last--;
    let shown = 0, want = true;
    // the frames play over the first FRAMES of the scroll; then the same view fades to dusk (frames/<set>/dusk.webp)
    const FRAMES = 0.86;
    let dusk = null, duskK = 0, lastDusk = 0;

    // Every frame arrives as a small compressed file (about 100 KB), but only the frames near where the scroll
    // is heading are decoded, off the main thread, into bitmaps the GPU draws at once. Keeping all 76 decoded
    // would hold ~600 MB and make every draw wait on the GPU. From file:// (no fetch) plain images are used.
    const viaBlob = location.protocol !== 'file:' && 'createImageBitmap' in window && 'fetch' in window;
    const files = new Array(N + 1);           // compressed frames (Blob), or Image from file://
    const asked = new Array(N + 1);           // download promises
    const ready = new Map();                  // frame -> drawable (ImageBitmap or Image)
    const busy = new Map();                   // frame -> decode promise
    const NEAR = (pick.w > 2000 ? 5 : 8) * STEP;   // decoded window on each side, in frame numbers
    let centre = 1;

    function fetchFrame(src) {
      if (viaBlob) return fetch(src).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
      return new Promise((resolve) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => resolve(im));
        im.onerror = () => resolve(null);
        im.src = src;
      });
    }
    const decode = (f) => (viaBlob ? createImageBitmap(f) : Promise.resolve(f));
    const drop = (bm) => { if (viaBlob && bm && bm.close) bm.close(); };

    function loadDusk() {
      fetchFrame(`frames/${set}/dusk.webp`).then((f) => f && decode(f)).then((bm) => { if (bm) { dusk = bm; want = true; } }, () => {});
    }

    function load(i) {
      if (!has(i)) return Promise.resolve();
      return asked[i] || (asked[i] = fetchFrame(url(i)).then((f) => {
        files[i] = f;
        if (f && Math.abs(i - centre) <= NEAR) pump();
      }));
    }

    // keep the frames around `centre` decoded (nearest first, three at a time) and let the rest go
    function pump() {
      const lo = centre - NEAR, hi = centre + NEAR;
      ready.forEach((bm, i) => { if (viaBlob && (i < lo || i > hi)) { drop(bm); ready.delete(i); } });
      for (let d = 0; d <= NEAR && busy.size < 3; d++) {
        for (const i of d ? [centre - d, centre + d] : [centre]) {
          if (busy.size >= 3 || i < 1 || i > N || !files[i] || ready.has(i) || busy.has(i)) continue;
          busy.set(i, decode(files[i]).then((bm) => {
            busy.delete(i);
            if (Math.abs(i - centre) > NEAR && viaBlob) drop(bm);
            else { ready.set(i, bm); if (Math.abs(i - shown) <= NEAR) want = true; }
            pump();
          }, () => { busy.delete(i); }));
        }
      }
    }

    // a frame decoded right now (for the first paint)
    function ensure(i) {
      centre = i;
      return load(i).then(() => { pump(); return busy.get(i); });
    }

    // coarse to fine: every 16th frame first, then fill the gaps
    const order = (() => {
      const seen = new Set(), out = [];
      for (const step of [16, 8, 4, 2, 1]) {
        for (let i = 1; i <= N; i += step) if (has(i) && !seen.has(i)) { seen.add(i); out.push(i); }
        if (!seen.has(last)) { seen.add(last); out.push(last); }
      }
      return out;
    })();
    const firstPass = order.slice(0, Math.ceil(N / 16) + 1);

    function loadAll() {
      const queue = order.slice();
      const worker = async () => { while (queue.length) await load(queue.shift()); };
      for (let k = 0; k < 4; k++) worker();
    }

    function nearest(i) {
      for (let d = 0; d < N; d++) {
        if (ready.has(i - d)) return ready.get(i - d);
        if (ready.has(i + d)) return ready.get(i + d);
      }
      return null;
    }

    // phones: soft fill from a tiny copy, then the sharp frame feathered top and bottom
    const tiny = document.createElement('canvas');
    tiny.width = 24; tiny.height = 16;
    const tctx = tiny.getContext('2d');
    const soft = document.createElement('canvas');
    const sctx = soft.getContext('2d');

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      // never paint more pixels than the frames hold (about 1.3x their width)
      const cap = (pick.w * (portrait ? 0.9 : 1.15)) / Math.max(w, 1);
      const k = Math.min(dpr, Math.max(1, cap));
      canvas.width = Math.round(w * k);
      canvas.height = Math.round(h * k);
      want = true;
    }

    function draw(i) {
      const im = nearest(i);
      if (!im) return;
      paint(im);
      if (dusk && duskK > 0) {
        ctx.globalAlpha = duskK;
        paint(dusk);
        ctx.globalAlpha = 1;
      }
    }

    function paint(im) {
      const cw = canvas.width, ch = canvas.height, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      if (cw / ch >= 1.05) {
        const s = Math.max(cw / iw, ch / ih);
        const w = iw * s, h = ih * s;
        ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
        return;
      }
      tctx.drawImage(im, 0, 0, 24, 16);
      const s = Math.max(cw / 24, ch / 16);
      ctx.drawImage(tiny, (cw - 24 * s) / 2, (ch - 16 * s) / 2, 24 * s, 16 * s);
      const w = cw * 1.42, h = Math.round(w * ih / iw);
      if (soft.width !== cw || soft.height !== h) { soft.width = cw; soft.height = h; }
      sctx.globalCompositeOperation = 'source-over';
      sctx.clearRect(0, 0, cw, h);
      sctx.drawImage(im, (cw - w) / 2, 0, w, h);
      sctx.globalCompositeOperation = 'destination-in';
      const g = sctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.18, '#000');
      g.addColorStop(0.82, '#000');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, cw, h);
      ctx.drawImage(soft, 0, Math.round(ch * 0.47 - h / 2));
    }

    function progress() {
      const r = scrolly.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
    }

    let current = 1, stepNow = -2, lastP = -1, lastF = -1, running = false;

    function ui(p, f, whole = p) {
      // the frame keeps easing after the scroll stops, so the caption must follow f, not only p
      if (whole === lastP && f === lastF) return;
      lastP = whole; lastF = f;
      const st = stage.style;
      st.setProperty('--p', p.toFixed(4));
      const intro = clamp(1 - p / 0.06, 0, 1);
      st.setProperty('--intro', intro.toFixed(3));
      st.setProperty('--intro-vis', intro > 0 ? 'visible' : 'hidden');
      st.setProperty('--cue', p < 0.015 ? '1' : '0');
      // drafting grid sits over the wireframe frames and fades as the slab goes in
      st.setProperty('--bp', clamp(1 - (f - 1) / 26, 0, 1).toFixed(3));
      hudPct.textContent = String(Math.round(p * 100)).padStart(3, '0');
      let k = -1;
      caps.forEach((c, n) => { if (f >= +c.dataset.from && f <= +c.dataset.to) k = n; });
      const capK = p > 0.05 ? k : -1;
      if (capK !== stepNow) {
        stepNow = capK;
        caps.forEach((c, n) => c.classList.toggle('on', n === capK));
        rail.forEach((li, n) => { li.classList.toggle('on', n <= k); li.classList.toggle('now', n === k); });
        hudStage.textContent = stageNames[Math.max(0, k)];
      }
      const end = whole > 0.965;
      finale.classList.toggle('on', end);
      stage.classList.toggle('final', end);
    }

    function tick() {
      const p = progress();
      const fp = clamp(p / FRAMES, 0, 1);            // progress through the frames
      const target = 1 + fp * (N - 1);
      const aim = clamp(Math.round(target), 1, N);
      if (aim !== centre) { centre = aim; pump(); }
      current += (target - current) * 0.2;
      if (Math.abs(target - current) < 0.05) current = target;
      const f = clamp(Math.round(current), 1, N);
      // dusk only over the final view, once the camera has stopped
      duskK = f >= last - 1 ? clamp((p - FRAMES - 0.015) / 0.09, 0, 1) : 0;
      if (Math.abs(duskK - lastDusk) > 0.003) { lastDusk = duskK; want = true; stage.style.setProperty('--dusk', duskK.toFixed(3)); }
      if (f !== shown || want) { draw(f); shown = f; want = false; }
      ui(fp, f, p);
      if (running) requestAnimationFrame(tick);
    }

    function start() { if (!running) { running = true; requestAnimationFrame(tick); } }
    function stop() { running = false; }

    let resizeT = 0;
    addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { size(); if (calm) draw(last); }, 120); });

    /* ------------------------------------------------ loader: the count eases toward real progress */
    const loader = document.getElementById('loader');
    const bar = document.getElementById('loaderBar');
    const pct = document.getElementById('loaderPct');
    let opened = false, closing = false, shownPct = 0, targetPct = 0;

    function count() {
      shownPct += (targetPct - shownPct) * 0.14;
      if (targetPct - shownPct < 0.6) shownPct = targetPct;
      pct.textContent = Math.round(shownPct);
      bar.style.transform = `scaleX(${shownPct / 100})`;
      loader.style.setProperty('--load', (shownPct / 100).toFixed(3));   // ring + colour of the coin
      if (!opened) requestAnimationFrame(count);
    }

    // the coin flies to the round mark at the left of the header logo, then the logo takes over with a sheen
    function land() {
      const coin = document.getElementById('coin');
      const logo = [...document.querySelectorAll('.nav__logo img')].find((im) => im.offsetParent !== null);
      if (!coin || !logo) return;
      const face = coin.querySelector('.coin__face').getBoundingClientRect();
      const r = logo.getBoundingClientRect();
      const size = r.height;                       // the mark is a square at the left of the wordmark
      const dx = r.left + size / 2 - (face.left + face.width / 2);
      const dy = r.top + size / 2 - (face.top + face.height / 2);
      coin.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(size / face.width).toFixed(3)})`;
      setTimeout(shineLogo, 850);
    }

    function open() {
      if (opened) return;
      opened = true;
      body.classList.remove('is-loading');
      loader.style.setProperty('--load', '1');
      if (!calm) land();
      loader.classList.add('done');
      requestAnimationFrame(() => body.classList.add('ready'));
      document.dispatchEvent(new CustomEvent('aspen:ready'));
      setTimeout(() => loader.remove(), 1600);
    }

    function finish() {
      if (closing) return;
      closing = true;
      targetPct = 100;
      setTimeout(open, calm ? 0 : 520);
    }

    if (calm) {
      scrolly.classList.add('is-static');
      stage.style.setProperty('--p', '1');
      ensure(last).then(() => { size(); draw(last); finish(); });
      setTimeout(finish, 1500);
    } else {
      requestAnimationFrame(count);
      ensure(1).then(() => { size(); draw(1); });
      let got = 0, rest = false;
      // the rest of the frames wait until the first pass is in and the browser is idle (or you start scrolling),
      // so they never compete with the first paint
      const loadRest = () => { if (rest) return; rest = true; loadAll(); loadDusk(); };
      const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
      Promise.all(firstPass.map((i) => load(i).then(() => {
        got++;
        targetPct = Math.max(targetPct, Math.round((got / firstPass.length) * 96));
      }))).then(() => { finish(); idle(loadRest, { timeout: 1500 }); });
      setTimeout(finish, 2400);  // never hold the page longer than this
      addEventListener('scroll', loadRest, { once: true, passive: true });
      new IntersectionObserver((e) => (e[0].isIntersecting ? start() : stop()), { rootMargin: '120px' }).observe(scrolly);
    }
  }

  /* ------------------------------------------------ header: solid after the hero, hides on scroll down */
  const nav = document.getElementById('nav');
  const burger = nav.querySelector('.nav__burger');
  const menu = document.getElementById('menu');
  let lastY = scrollY, navTick = false;
  function onScroll() {
    if (navTick) return;
    navTick = true;
    requestAnimationFrame(() => {
      navTick = false;
      const y = scrollY;
      const heroBottom = scrolly ? scrolly.getBoundingClientRect().bottom : 0;
      const past = scrolly ? heroBottom < 80 : y > 40;       // inner pages: solid once you scroll
      nav.classList.toggle('solid', past);
      body.classList.toggle('past-hero', !scrolly || heroBottom < innerHeight * 0.6);
      if (!menu.classList.contains('open')) nav.classList.toggle('hide', past && y > lastY + 4 && y > innerHeight);
      if (y < lastY - 4 || !past) nav.classList.remove('hide');
      lastY = y;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function closeMenu() {
    menu.classList.remove('open');
    nav.classList.remove('menu-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    body.style.overflow = '';
  }
  burger.addEventListener('click', () => {
    if (menu.classList.contains('open')) return closeMenu();
    menu.classList.add('open');
    nav.classList.add('menu-open');
    nav.classList.remove('hide');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    body.style.overflow = 'hidden';
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('open')) { closeMenu(); burger.focus(); } });

  /* ------------------------------------------------ logo sheen + the section you're in, highlighted in the menu */
  const logoWrap = nav.querySelector('.nav__logo');
  function shineLogo() {
    if (calm || !logoWrap) return;
    logoWrap.classList.remove('shine');
    void logoWrap.offsetWidth;            // restart the animation
    logoWrap.classList.add('shine');
  }
  logoWrap.addEventListener('animationend', () => logoWrap.classList.remove('shine'), true);
  // "/", "/index.html", "/gallery" and "/gallery.html" name pages the same way (Netlify's pretty URLs rewrite links)
  const page = (u) => u.pathname.replace(/(?:index)?(?:\.html)?$/, '');
  const samePage = (u) => u.origin === location.origin && page(u) === page(location);
  const menuLinks = [...menu.querySelectorAll('a[href]')].map((a) => ({ a, u: new URL(a.href, location.href) }));
  // a link to this page (no section) is the current page: highlight it
  menuLinks.forEach(({ a, u }) => {
    if (samePage(u) && !u.hash && page(u) !== page(new URL('index.html', location.href))) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
  });
  // links to sections of this page light up as you scroll through them
  const sectionLinks = menuLinks.filter(({ u }) => samePage(u) && u.hash);
  const spied = sectionLinks.map(({ u }) => document.getElementById(u.hash.slice(1))).filter(Boolean);
  let section = null;
  if ('IntersectionObserver' in window && spied.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || section === e.target.id) return;
        section = e.target.id;
        sectionLinks.forEach(({ a, u }) => {
          const on = u.hash === `#${section}`;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
        restInk();
        shineLogo();
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spied.forEach((s) => spy.observe(s));
  }
  if (!scrolly) setTimeout(shineLogo, 500);    // inner pages: the logo greets you as the page opens

  /* ------------------------------------------------ header: one brass line glides between the tabs (desktop) */
  const wide = matchMedia('(min-width: 961px)');
  const tabs = menuLinks.map(({ a }) => a).filter((a) => !a.classList.contains('pill'));
  const ink = document.createElement('span');
  ink.className = 'nav__ink';
  ink.setAttribute('aria-hidden', 'true');
  menu.append(ink);
  menu.classList.add('has-ink');
  function inkTo(a, instant) {
    if (!wide.matches || !a) { ink.style.opacity = '0'; return; }
    if (instant) ink.style.transition = 'none';
    ink.style.width = `${a.offsetWidth}px`;
    ink.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop + a.offsetHeight + 6}px)`;
    ink.style.opacity = '1';
    if (instant) { void ink.offsetWidth; ink.style.transition = ''; }
  }
  function restInk(instant) { inkTo(tabs.find((a) => a.classList.contains('is-active')), instant); }
  tabs.forEach((a) => {
    a.addEventListener('pointerenter', () => inkTo(a));
    a.addEventListener('focus', () => inkTo(a));
  });
  menu.addEventListener('pointerleave', () => restInk());
  menu.addEventListener('focusout', (e) => { if (!menu.contains(e.relatedTarget)) restInk(); });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => restInk(true));
  let inkT = 0;
  addEventListener('resize', () => { clearTimeout(inkT); inkT = setTimeout(() => restInk(true), 150); });

  /* ------------------------------------------------ page switch: links to other pages fade through the coin
     (browsers with cross-page view transitions animate the switch themselves, with no wait: see styles.css) */
  const nativeSwitch = location.protocol !== 'file:' && !!(window.CSS && CSS.supports && CSS.supports('view-transition-class', 'a'));
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (!/^(https?|file):$/.test(url.protocol)) return;   // tel:, mailto:
    if (samePage(url)) return;                            // a section on this page
    if (nativeSwitch) return;                             // the browser glides to the next page
    e.preventDefault();
    body.classList.add('leaving');
    setTimeout(() => { location.href = url.href; }, calm ? 0 : 620);
  });
  addEventListener('pageshow', (e) => { if (e.persisted) body.classList.remove('leaving'); });
  // the browser skips the animation for some switches (a URL typed in the address bar): no error for that
  const quiet = (e) => { const vt = e.viewTransition; if (vt) [vt.ready, vt.finished, vt.updateCallbackDone].forEach((p) => p && p.catch(() => {})); };
  addEventListener('pageswap', quiet);                  // the arriving page's twin is inline in the head

  /* ------------------------------------------------ split headings into words */
  function split(el) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const s = document.createElement('span');
            s.textContent = part;
            s.style.setProperty('--i', i++);
            w.append(s);
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }

  /* ------------------------------------------------ service names: per-letter roll on hover */
  if (!calm) {
    document.querySelectorAll('.svc__name').forEach((el) => {
      const text = el.textContent.trim();
      el.textContent = '';
      const sr = document.createElement('span');
      sr.className = 'sr';
      sr.textContent = text;
      el.append(sr);
      let i = 0;
      text.split(' ').forEach((word, n) => {
        if (n) el.append(' ');
        const roll = document.createElement('span');
        roll.className = 'roll';
        roll.setAttribute('aria-hidden', 'true');
        [...word].forEach((ch) => {
          const c = document.createElement('i');
          c.textContent = ch;
          c.style.setProperty('--i', i++);
          roll.append(c);
        });
        el.append(roll);
      });
    });
  }

  /* ------------------------------------------------ reveals, split headings, counters */
  const reveals = document.querySelectorAll('.reveal, .reveal-img, .foot__word');
  const splits = document.querySelectorAll('[data-split]');
  const counts = document.querySelectorAll('[data-count]');
  if (calm || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('in'));
  } else {
    splits.forEach(split);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        el.classList.add(el.hasAttribute('data-split') ? 'split-in' : 'in');
        if (el.dataset.count) countUp(el);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el, n) => {
      if (el.classList.contains('reveal')) el.style.transitionDelay = `${(n % 4) * 80}ms`;
      io.observe(el);
    });
    splits.forEach((el) => io.observe(el));
    counts.forEach((el) => { el.textContent = '0'; io.observe(el); });
  }

  function countUp(el) {
    const to = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ------------------------------------------------ services: image preview follows the cursor */
  const peek = document.querySelector('.peek');
  if (peek && fine && !calm) {
    document.body.append(peek);   // outside the content-visibility section so position:fixed works
    const pimg = peek.querySelector('img');
    let tx = 0, ty = 0, x = 0, y = 0, live = false;
    const follow = () => {
      x += (tx - x) * 0.14; y += (ty - y) * 0.14;
      peek.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${clamp((tx - x) * 0.04, -6, 6)}deg)`;
      if (live || Math.abs(tx - x) > 0.5) requestAnimationFrame(follow);
    };
    const rows = document.querySelectorAll('.svc a');
    const warm = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      warm.disconnect();
      rows.forEach((a) => { new Image().src = a.dataset.img; });
    }, { rootMargin: '400px' });
    warm.observe(document.querySelector('.svc'));
    rows.forEach((a) => {
      a.addEventListener('pointerenter', (e) => {
        pimg.src = a.dataset.img;
        tx = e.clientX + 36; ty = e.clientY - 140;
        if (!live) { x = tx; y = ty; live = true; requestAnimationFrame(follow); }
        peek.classList.add('on');
      });
      a.addEventListener('pointermove', (e) => { tx = e.clientX + 36; ty = e.clientY - 140; });
      a.addEventListener('pointerleave', () => { live = false; peek.classList.remove('on'); });
    });
  }

  /* ------------------------------------------------ reviews marquee: one copy for a seamless loop */
  const track = document.querySelector('.marquee__track');
  if (track && !calm) {
    [...track.children].forEach((c) => {
      const d = c.cloneNode(true);
      d.setAttribute('aria-hidden', 'true');
      track.append(d);
    });
  }
})();
