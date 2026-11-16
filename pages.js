/* Aspen Homes inner pages: the gallery's 3D ring and filters, the process page's picture that follows
   the steps, and the Photo / 3D model switch on each house type of the Homes page. */
(() => {
  'use strict';

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // side scroll on a mouse (thumb wheel, wheel tilt, Shift + wheel) or a sideways trackpad swipe, in pixels; 0 for normal scrolling
  const side = (e) => (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0) * (e.deltaMode === 1 ? 40 : 1);
  const script = (src) => new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = fail;
    document.head.append(s);
  });
  // slide a highlight (pill) behind the chosen element; both live in the same positioned container
  const pillTo = (pill, el, instant) => {
    if (!el) return;
    if (instant) pill.style.transition = 'none';
    pill.style.width = `${el.offsetWidth}px`;
    pill.style.height = `${el.offsetHeight}px`;
    pill.style.transform = `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
    if (instant) { void pill.offsetWidth; pill.style.transition = ''; }
  };
  let threeReady = null;
  const loadThree = () => threeReady || (threeReady = script('https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js').then(() => script('house3d.js')));

  /* ------------------------------------------------ gallery: a 3D ring of the work */
  const ringSec = document.querySelector('.ring');
  const ring = ringSec && makeRing(ringSec);

  function makeRing(sec) {
    const stage = sec.querySelector('.ring__stage');
    const wheel = sec.querySelector('.ring__ring');
    const nowB = sec.querySelector('.ring__now b');
    const nowS = sec.querySelector('.ring__now span');
    const MAX = 20;
    let cards = [], N = 0, step = 0, R = 0, rot = 0, vel = 0, target = null, drag = null, idleAt = 0, running = false, visible = false, front = -1;

    function build(items) {
      wheel.innerHTML = '';
      cards = items.slice(0, MAX).map((a, i) => {
        const img = a.querySelector('img');
        const src = (img.getAttribute('srcset') || '').split(',')[0].trim().split(' ')[0] || img.getAttribute('src');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ring__card';
        b.setAttribute('aria-label', `${a.dataset.title.replace(/&middot;/g, '·')}, open photo`);
        b.tabIndex = -1;
        b.innerHTML = `<img src="${src}" alt="" draggable="false" decoding="async">`;
        b.addEventListener('click', () => {
          if (drag && drag.moved) return;
          if (i === front) a.click();                  // the grid's link opens the full-screen viewer
          else goTo(i);
        });
        wheel.append(b);
        return { el: b, a, o: -1 };
      });
      N = cards.length;
      layout();
      rot = 0; vel = 0; target = 0; front = -1;
      kick();
    }

    function layout() {
      if (!N) return;
      // the card width from the same rule as the CSS (--cw: clamp(190px, 21vw, 290px)); reading offsetWidth
      // here would force a layout of the whole page while it is still loading
      const w = Math.min(290, Math.max(190, innerWidth * 0.21));
      step = 360 / N;
      R = Math.round((w / 2) / Math.tan(Math.PI / Math.max(N, 9)) * 1.12);   // few photos still spread out
      cards.forEach((c, i) => { c.el.style.transform = `rotateY(${i * step}deg) translateZ(${R}px)`; });
    }

    const nearest = () => Math.round(-rot / step);
    const idx = (k) => ((k % N) + N) % N;
    function goTo(i) {
      const k = nearest();
      let d = idx(i) - idx(k);
      if (d > N / 2) d -= N;
      if (d < -N / 2) d += N;
      target = -(k + d) * step;
      vel = 0;
      idleAt = performance.now() + 5000;
      kick();
    }

    function frame(now) {
      if (!running) return;
      if (!drag) {
        if (target !== null) {
          rot += (target - rot) * (calm ? 1 : 0.12);
          if (Math.abs(target - rot) < 0.02) { rot = target; target = null; }
        } else if (Math.abs(vel) > 0.04) {
          rot += vel;
          vel *= 0.94;
          if (Math.abs(vel) <= 0.04) target = -nearest() * step;   // settle on the nearest photo
        } else if (!calm && now > idleAt) {
          rot -= 0.05;                                             // a slow turn while nobody is touching it
        }
      }
      wheel.style.transform = `translateZ(${-R}px) rotateX(-4deg) rotateY(${rot}deg)`;
      let best = -2, bi = 0;
      cards.forEach((c, i) => {
        const a = ((i * step + rot) % 360 + 540) % 360 - 180;     // -180..180, 0 = facing you
        const f = Math.cos(a * Math.PI / 180);
        // side photos fade into the navy; opacity is drawn by the GPU, and 2% steps keep style writes rare
        const o = Math.round((0.14 + 0.86 * Math.max(0, (f + 0.25) / 1.25)) * 50) / 50;
        if (o !== c.o) { c.o = o; c.el.style.opacity = String(o); }
        if (f > best) { best = f; bi = i; }
      });
      if (bi !== front) {
        front = bi;
        cards.forEach((c, i) => c.el.classList.toggle('is-front', i === bi));
        const a = cards[bi].a;
        nowB.textContent = a.dataset.title.replace(/&middot;/g, '·').replace(/&amp;/g, '&');
        nowS.textContent = `${a.dataset.tag.replace(/&middot;/g, '·')} · ${String(bi + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
      }
      requestAnimationFrame(frame);
    }
    function kick() {
      const want = visible && N > 0;
      if (want && !running) { running = true; requestAnimationFrame(frame); } else if (!want) running = false;
    }
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; kick(); }).observe(stage);

    // drag (mouse, pen, or a sideways swipe; vertical swipes still scroll the page)
    stage.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, r: rot, t: performance.now(), last: e.clientX, moved: false, id: e.pointerId };
      vel = 0; target = null;
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; stage.setPointerCapture(drag.id); stage.classList.add('is-drag'); }
      if (!drag.moved) return;
      const k = 180 / (Math.PI * R);                               // degrees per pixel at the front of the ring
      rot = drag.r + dx * k;
      vel = (e.clientX - drag.last) * k;
      drag.last = e.clientX;
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved;
      stage.classList.remove('is-drag');
      idleAt = performance.now() + 5000;
      setTimeout(() => { drag = null; }, 0);                       // let the click handler see "moved" first
      if (moved && Math.abs(vel) < 0.04) target = -nearest() * step;
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => stage.addEventListener(t, end));

    // side scroll turns the ring smoothly and settles on the nearest photo when you stop
    let settle = 0;
    stage.addEventListener('wheel', (e) => {
      const dx = side(e);
      if (!dx || !N) return;
      e.preventDefault();
      const k = step / 100;                           // one click of a side wheel (100 px) = one photo
      target = (target === null ? rot : target) - dx * k;
      vel = 0;
      idleAt = performance.now() + 5000;
      clearTimeout(settle);
      settle = setTimeout(() => { const base = target === null ? rot : target; target = -Math.round(-base / step) * step; kick(); }, 160);
      kick();
    }, { passive: false });

    // buttons and keys
    sec.querySelectorAll('[data-ring]').forEach((b) => b.addEventListener('click', () => goTo(idx(front) + +b.dataset.ring)));
    stage.tabIndex = 0;
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(front + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(front - 1); }
      else if (e.key === 'Enter' && cards[front]) { e.preventDefault(); cards[front].a.click(); }
    });
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
    return { build };
  }

  /* ------------------------------------------------ gallery: filter by kind (the ring follows) */
  const gal = document.querySelector('.gal');
  if (gal) {
    const buttons = [...gal.querySelectorAll('[data-filter]')];
    const items = [...gal.querySelectorAll('.gal__item')];
    const count = gal.querySelector('.gal__count');
    const label = (f) => buttons.find((b) => b.dataset.filter === f).firstChild.textContent.trim().toLowerCase();
    const filters = gal.querySelector('.gal__filters');
    const fpill = document.createElement('span');
    fpill.className = 'gal__pill';
    fpill.setAttribute('aria-hidden', 'true');
    filters.prepend(fpill);
    filters.classList.add('has-pill');
    const apply = (f, animate) => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.filter === f)));
      pillTo(fpill, buttons.find((x) => x.dataset.filter === f), !animate);
      // photos that stay glide from where they were (FLIP); new ones rise in one after another
      const flip = animate && !calm && items[0] && items[0].animate;
      const before = flip ? new Map(items.filter((it) => !it.hidden).map((it) => [it, it.getBoundingClientRect()])) : null;
      let n = 0;
      const shown = [];
      items.forEach((it) => {
        const show = f === 'all' || it.dataset.cat === f;
        it.hidden = !show;
        if (!show) return;
        n++;
        shown.push(it);
      });
      if (flip) {
        let k = 0;
        shown.forEach((it) => {
          const a = before.get(it), b = it.getBoundingClientRect();
          if (a) {
            const dx = a.left - b.left, dy = a.top - b.top;
            if (Math.abs(dx) + Math.abs(dy) > 1) it.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
          } else {
            it.animate([{ opacity: 0, transform: 'translateY(20px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: Math.min(k++, 10) * 35, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
          }
        });
      }
      count.textContent = f === 'all' ? `Showing all ${n}` : `Showing ${n} ${label(f)}`;
      // the ring shows real photos first; build stages only when that filter is picked
      if (ring) ring.build(f === 'all' ? shown.filter((it) => it.dataset.cat !== 'stages') : shown);
    };
    buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter, true)));
    apply('all', false);
    const pressed = () => buttons.find((x) => x.getAttribute('aria-pressed') === 'true');
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => pillTo(fpill, pressed(), true));
    let gt = 0;
    addEventListener('resize', () => { clearTimeout(gt); gt = setTimeout(() => pillTo(fpill, pressed(), true), 150); });

    // photos lean toward the mouse with a soft glare (mouse only; the glare is CSS, --gx/--gy place it)
    if (!calm && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let card = null, box = null, px = 0, py = 0, raf = 0;
      const draw = () => {
        raf = 0;
        if (!card) return;
        const x = (px - box.left) / box.width, y = (py - box.top) / box.height;
        card.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 7).toFixed(2)}deg) rotateY(${((x - 0.5) * 9).toFixed(2)}deg)`;
        card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      };
      const drop = () => { if (card) card.style.transform = ''; card = null; };
      gal.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        const c = e.target.closest('.gal__item');
        if (c !== card) { drop(); card = c; if (card) box = card.getBoundingClientRect(); }
        if (!card) return;
        px = e.clientX;
        py = e.clientY;
        if (!raf) raf = requestAnimationFrame(draw);
      });
      gal.addEventListener('pointerleave', drop);
      addEventListener('scroll', () => { if (card) box = card.getBoundingClientRect(); }, { passive: true });
    }
  }

  /* ------------------------------------------------ Homes & Process: the section buttons follow you as a floating bar */
  const jump = document.querySelector('.jump');
  const jumpLinks = jump ? [...jump.querySelectorAll('a[href^="#"]')] : [];
  const jumpTargets = jumpLinks.map((a) => document.getElementById(a.hash.slice(1)));
  if (jumpLinks.length > 1 && jumpTargets.every(Boolean) && 'IntersectionObserver' in window) {
    const nav = document.getElementById('nav');
    const dock = document.createElement('nav');
    dock.className = 'dock';
    dock.setAttribute('aria-label', 'Sections of this page');
    const dpill = document.createElement('span');
    dpill.className = 'dock__pill';
    dpill.setAttribute('aria-hidden', 'true');
    dock.append(dpill);
    const tabs = jumpLinks.map((a) => { const b = a.cloneNode(true); dock.append(b); return b; });
    document.body.append(dock);
    let now = -1, shown = false, pastJump = false, beforeEnd = true;
    const place = (instant) => {
      const a = tabs[now];
      if (!a) return;
      pillTo(dpill, a, instant);
      // phones: the bar scrolls sideways, so keep the current section in view
      const l = a.offsetLeft, r = l + a.offsetWidth;
      if (l < dock.scrollLeft || r > dock.scrollLeft + dock.clientWidth) dock.scrollTo({ left: l - 12, behavior: calm || instant ? 'auto' : 'smooth' });
    };
    const select = (i) => {
      if (i === now || i < 0) return;
      const first = now < 0;
      now = i;
      tabs.forEach((a, n) => { if (n === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
      place(first || !shown);
    };
    const follow = () => dock.style.setProperty('--dock-y', `${nav && !nav.classList.contains('hide') ? nav.offsetHeight + 10 : 12}px`);
    const update = () => {
      const on = pastJump && beforeEnd;
      if (on === shown) return;
      shown = on;
      follow();
      dock.classList.toggle('is-on', on);
      if (on) place(true);
    };
    const spyJ = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) select(jumpTargets.indexOf(e.target)); }), { rootMargin: '-40% 0px -55% 0px' });
    jumpTargets.forEach((t) => spyJ.observe(t));
    new IntersectionObserver((e) => { pastJump = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; update(); }).observe(jump);
    const end = document.querySelector('main > .cta') || document.querySelector('.foot');
    if (end) new IntersectionObserver((e) => { beforeEnd = !e[0].isIntersecting && e[0].boundingClientRect.top > 0; update(); }, { rootMargin: '0px 0px -25% 0px' }).observe(end);
    // sit under the header, or move up when the header slides away
    if (nav) new MutationObserver(() => { follow(); setTimeout(follow, 450); }).observe(nav, { attributes: true, attributeFilter: ['class'] });
    let dt = 0;
    addEventListener('resize', () => { clearTimeout(dt); dt = setTimeout(() => { follow(); place(true); }, 150); });
  }

  /* ------------------------------------------------ process: the picture and counter follow the step you're reading */
  const steps = document.querySelector('.steps');
  if (steps) {
    const cards = [...steps.querySelectorAll('.step-card')];
    const pics = [...steps.querySelectorAll('.steps__media img')];
    const num = steps.querySelector('.steps__num');
    const bar = steps.querySelector('.steps__bar i');
    let now = 0;
    const set = (i) => {
      if (i === now) return;
      now = i;
      cards.forEach((c, n) => c.classList.toggle('is-on', n === i));
      pics.forEach((p, n) => p.classList.toggle('is-on', n === i));
      num.textContent = String(i + 1).padStart(2, '0');
      bar.style.transform = `scaleX(${(i + 1) / cards.length})`;
    };
    bar.style.transform = `scaleX(${1 / cards.length})`;
    new IntersectionObserver((e, io) => {
      if (!e[0].isIntersecting) return;
      io.disconnect();
      pics.forEach((p) => { p.loading = 'eager'; });
    }, { rootMargin: '600px' }).observe(steps);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) set(cards.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    cards.forEach((c) => io.observe(c));
  }

  /* ------------------------------------------------ Homes page: Photo or 3D model for each house type */
  const HOUSES = {
    custom: { type: 'custom', sqft: 3400, beds: 4, baths: 3, stories: 1, scope: [] },
    farmhouse: { type: 'farmhouse', sqft: 3600, beds: 4, baths: 4, stories: 2, scope: [] },
    barndo: { type: 'barndo', sqft: 3000, beds: 4, baths: 3, stories: 1, scope: [] },
    remodel: { type: 'remodel', sqft: 2600, beds: 3, baths: 2, stories: 1, scope: ['Kitchen', 'Bathrooms', 'Porch', 'Addition'] },
  };
  document.querySelectorAll('.kind__media').forEach((fig) => {
    const view = fig.querySelector('.kind__3d');
    if (!view) return;
    const canvas = view.querySelector('canvas');
    const views = [...fig.querySelectorAll('.kind__view button')];
    const light = fig.querySelector('.kind__light');
    const times = [...light.querySelectorAll('button')];
    let model = null, time = 0.5;
    const fail = () => {
      fig.classList.remove('is-3d', 'is-loading3d');
      fig.querySelector('.kind__view').hidden = true;      // no WebGL or offline: keep the photo
    };
    const set = (v) => {
      views.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
      fig.classList.toggle('is-3d', v === '3d');
      view.setAttribute('aria-hidden', String(v !== '3d'));
      light.hidden = v !== '3d';
      if (v !== '3d') { if (model) model.setActive(false); return; }
      if (model) { model.setActive(true); return; }
      fig.classList.add('is-loading3d');
      loadThree().then(() => {
        model = window.AspenHouse3D && window.AspenHouse3D.mount(canvas, view.querySelector('.sheet__tags'), { calm });
        if (!model) return fail();
        model.setTime(time);
        model.build(HOUSES[view.dataset.model], true);
        fig.classList.remove('is-loading3d');
      }).catch(fail);
    };
    views.forEach((b) => b.addEventListener('click', () => set(b.dataset.v)));
    times.forEach((b) => b.addEventListener('click', () => {
      time = +b.dataset.t;
      times.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (model) model.setTime(time);
    }));
  });
})();
