/* Aspen Homes motion layer: gliding same-page links, magnetic buttons, the type band that drifts
   with the scroll, and the CTA spotlight. Pointer effects run only with a mouse; nothing here runs
   with reduced motion. The normal system cursor is kept everywhere. */
(() => {
  'use strict';

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // side scroll on a mouse (thumb wheel, wheel tilt, Shift + wheel) or a sideways trackpad swipe, in pixels; 0 for normal scrolling
  const side = (e) => (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0) * (e.deltaMode === 1 ? 40 : 1);

  /* ------------------------------------------------ scrolling stays native (the browser scrolls off the main thread,
     so it never stutters); only links and buttons that jump within the page glide there */
  const Scroll = { active: false, to: (y) => scrollTo({ top: y, behavior: calm ? 'auto' : 'smooth' }) };
  window.AspenScroll = Scroll;

  // same-page links glide to their section and move focus there for keyboard and screen-reader users
  const pagePath = (u) => u.pathname.replace(/(?:index)?(?:\.html)?$/, '');   // "/gallery" and "/gallery.html" are one page
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    let u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin || pagePath(u) !== pagePath(location)) return;   // another page
    const id = u.hash.slice(1);
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const y = el.getBoundingClientRect().top + scrollY;
    Scroll.to(y);
    if (history.pushState) history.pushState(null, '', `#${id}`);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });

  if (calm) return;

  /* ------------------------------------------------ magnetic buttons (a light pull toward the pointer) */
  if (fine) {
    document.querySelectorAll('.btn, .pill, .social a').forEach((el) => {
      const pull = el.closest('.social') ? 0.3 : 0.18;
      let box = null;
      el.addEventListener('pointerenter', () => { box = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || !box) return;
        el.classList.add('is-mag');
        el.style.setProperty('--mx', `${((e.clientX - box.left - box.width / 2) * pull).toFixed(1)}px`);
        el.style.setProperty('--my', `${((e.clientY - box.top - box.height / 2) * pull).toFixed(1)}px`);
      });
      el.addEventListener('pointerleave', () => {
        box = null;
        el.classList.remove('is-mag');
        el.style.setProperty('--mx', '0px');
        el.style.setProperty('--my', '0px');
      });
    });
  }

  /* ------------------------------------------------ band: drifts sideways, speeds up and turns with the scroll */
  const band = document.querySelector('.band');
  if (band) {
    const rows = [...band.querySelectorAll('.band__row')].map((row) => {
      const track = row.querySelector('.band__track');
      for (let k = 0; k < 3; k++) row.append(track.cloneNode(true));
      return { row, track, dir: +row.dataset.speed || 1, x: 0, w: 1 };
    });
    const measure = () => rows.forEach((r) => { r.w = r.track.offsetWidth || 1; });
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    addEventListener('resize', measure);

    let on = false, lastY = scrollY, vel = 0, sign = 1;
    const frame = () => {
      const y = scrollY, dy = y - lastY;
      lastY = y;
      vel += (clamp(dy, -80, 80) - vel) * 0.12;
      if (Math.abs(dy) > 0.5) sign = dy > 0 ? 1 : -1;
      const speed = 0.6 + Math.abs(vel) * 0.25;
      rows.forEach((r) => {
        r.x -= r.dir * speed * sign;
        if (r.x <= -r.w) r.x += r.w;
        if (r.x > 0) r.x -= r.w;
        r.row.style.transform = `translate3d(${r.x.toFixed(1)}px, 0, 0)`;
      });
      if (on) requestAnimationFrame(frame);
    };
    rows[1] && (rows[1].x = -rows[1].w / 2);
    new IntersectionObserver((e) => {
      const vis = e[0].isIntersecting;
      if (vis && !on) { on = true; lastY = scrollY; requestAnimationFrame(frame); } else if (!vis) on = false;
    }).observe(band);
  }

  /* ------------------------------------------------ reviews: drag, flick or side-scroll the marquee (it pauses under the pointer)
     With reduced motion the marquee is a plain sideways scroller instead (styles.css), so none of this runs. */
  const mq = document.querySelector('.marquee');
  const mqTrack = mq && mq.querySelector('.marquee__track');
  if (mqTrack && !calm) {
    let cur = 0, goal = 0, raf = 0, loopW = 0, held = null;
    const loop = () => loopW || (loopW = mqTrack.scrollWidth / 2 || 1);   // the reviews are written twice: one copy = one loop
    addEventListener('resize', () => { loopW = 0; });
    const render = () => {
      const L = loop();
      // shifting by one copy looks identical, so the offset never grows
      const shift = cur < -L ? L : cur > 0 ? -L : 0;
      if (shift) { cur += shift; goal += shift; if (held) held.base += shift; }
      mqTrack.style.translate = `${cur.toFixed(1)}px 0`;   // adds to the marquee's own animation
    };
    const glide = () => {
      cur += (goal - cur) * 0.14;
      if (Math.abs(goal - cur) < 0.3) cur = goal;
      render();
      raf = cur !== goal ? requestAnimationFrame(glide) : 0;
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(glide); };
    mq.addEventListener('wheel', (e) => {
      const dx = side(e);
      if (!dx) return;
      e.preventDefault();
      goal -= dx * 1.5;
      go();
    }, { passive: false });
    // drag with a mouse or a finger (vertical swipes still scroll the page); a flick keeps it gliding
    mq.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      held = { x: e.clientX, base: goal, last: e.clientX, t: performance.now(), v: 0, id: e.pointerId, moved: false };
    });
    mq.addEventListener('pointermove', (e) => {
      if (!held) return;
      const dx = e.clientX - held.x;
      if (!held.moved) {
        if (Math.abs(dx) < 6) return;
        held.moved = true;
        try { mq.setPointerCapture(held.id); } catch (err) { /* the pointer already lifted */ }
        mq.classList.add('is-held');
      }
      const now = performance.now();
      held.v = ((e.clientX - held.last) / Math.max(1, now - held.t)) * 16;   // px per frame
      held.last = e.clientX;
      held.t = now;
      goal = cur = held.base + dx;
      render();
    });
    const release = () => {
      if (!held) return;
      if (held.moved) { goal += clamp(held.v, -40, 40) * 14; go(); }   // a flick carries on, up to about a screen
      mq.classList.remove('is-held');
      held = null;
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => mq.addEventListener(t, release));
  }

  /* ------------------------------------------------ looping animations (reviews marquee, map pulses) rest off screen */
  const loops = document.querySelectorAll('.marquee, .map');
  if (loops.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('is-off', !e.isIntersecting)));
    loops.forEach((el) => { el.classList.add('is-off'); io.observe(el); });
  }

  /* ------------------------------------------------ CTA: a brass glow follows the pointer */
  const cta = document.querySelector('.cta');
  const glow = cta && cta.querySelector('.cta__glow');
  if (glow && fine) {
    cta.addEventListener('pointermove', (e) => {
      const r = cta.getBoundingClientRect();
      glow.style.setProperty('--gx', `${e.clientX - r.left}px`);
      glow.style.setProperty('--gy', `${e.clientY - r.top}px`);
      glow.style.setProperty('--go', '1');
    });
    cta.addEventListener('pointerleave', () => glow.style.setProperty('--go', '0'));
  }
})();
