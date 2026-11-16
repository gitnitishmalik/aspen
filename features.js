/* Aspen Homes features: the frame-to-finish compare slider, the pinned horizontal gallery,
   the "Plan your home" brief (it draws a front elevation as you answer) and the service-area map. */
(() => {
  'use strict';

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  const fmt = (n) => n.toLocaleString('en-US');
  // side scroll on a mouse (thumb wheel, wheel tilt, Shift + wheel) or a sideways trackpad swipe, in pixels; 0 for normal scrolling
  const side = (e) => (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0) * (e.deltaMode === 1 ? 40 : 1);
  const once = (el, fn, margin = '0px') => {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: margin, threshold: 0.35 });
    io.observe(el);
  };

  /* ================================================ frame to finish: compare slider */
  const cmp = document.querySelector('.compare');
  if (cmp) {
    const range = cmp.querySelector('.compare__range');
    let drag = false, touched = false, anim = 0, pos = 50;
    const set = (v) => {
      const p = clamp(v, 0, 100);
      pos = p;
      cmp.style.setProperty('--pos', `${p}%`);
      cmp.style.setProperty('--pn', p.toFixed(1));
      range.value = Math.round(p);
      range.setAttribute('aria-valuetext', `${Math.round(p)}% framing, ${100 - Math.round(p)}% finished`);
    };
    const at = (e) => { const r = cmp.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; };
    const stopAnim = () => { cancelAnimationFrame(anim); touched = true; };

    cmp.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      stopAnim();
      drag = true;
      cmp.classList.add('is-drag');
      // a mouse jumps to where you press; a finger waits to see if you're scrolling or dragging
      if (e.pointerType === 'mouse') { set(at(e)); cmp.setPointerCapture(e.pointerId); }
    });
    cmp.addEventListener('pointermove', (e) => { if (drag) set(at(e)); });
    ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave'].forEach((t) =>
      cmp.addEventListener(t, (e) => { if (t === 'pointerleave' && e.pointerType === 'mouse' && drag && cmp.hasPointerCapture(e.pointerId)) return; drag = false; cmp.classList.remove('is-drag'); }));
    range.addEventListener('input', () => { stopAnim(); set(+range.value); });
    cmp.addEventListener('wheel', (e) => {
      const dx = side(e);
      if (!dx) return;
      e.preventDefault();
      stopAnim();
      set(pos + (dx / cmp.clientWidth) * 100);
    }, { passive: false });
    set(50);

    // first time it comes into view, sweep across once so people see it moves
    if (!calm) once(cmp, () => {
      if (touched) return;
      const keys = [[0, 50], [900, 84], [2000, 18], [2900, 50]];
      const t0 = performance.now() + 600;
      const run = (now) => {
        if (touched) return;
        const t = now - t0;
        if (t >= 0) {
          let i = 0;
          while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
          const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
          set(va + (vb - va) * ease(clamp((t - ta) / (tb - ta), 0, 1)));
          if (t >= keys[keys.length - 1][0]) return;
        }
        anim = requestAnimationFrame(run);
      };
      anim = requestAnimationFrame(run);
    });
  }

  /* ================================================ homes: pinned horizontal gallery (desktop) */
  const homes = document.querySelector('.homes');
  if (homes) {
    const pin = homes.querySelector('.homes__pin');
    const track = homes.querySelector('.homes__track');
    const intro = homes.querySelector('.homes__intro');
    const prog = homes.querySelector('.homes__progress');
    const cards = [...track.querySelectorAll('.card')];
    const imgs = cards.map((c) => c.querySelector('.card__media img'));
    const desk = matchMedia('(min-width: 861px) and (hover: hover) and (pointer: fine)');
    let pinned = false, dist = 0, running = false, geo = [];

    const measure = () => {
      if (!pinned) return;
      const last = track.lastElementChild;
      const pad = parseFloat(getComputedStyle(track).paddingRight) || 0;
      // the track grows to fit its cards, so measure against the pinned viewport, not the track
      dist = Math.max(0, last.offsetLeft + last.offsetWidth + pad - pin.clientWidth);
      homes.style.height = `${Math.round(dist + innerHeight)}px`;
      geo = cards.map((c) => ({ x: c.offsetLeft, w: c.offsetWidth }));
    };
    const layout = () => {
      const want = desk.matches && !calm;
      if (want !== pinned) {
        pinned = want;
        homes.classList.toggle('is-pinned', pinned);
        if (pinned) track.prepend(intro); else { pin.prepend(intro); homes.style.height = ''; track.style.transform = ''; }
      }
      measure();
    };
    const frame = () => {
      const r = homes.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
      const x = -p * dist;
      track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      prog.style.setProperty('--hp', p.toFixed(4));
      const vw = innerWidth;
      geo.forEach((g, i) => {
        if (!imgs[i]) return;
        const left = g.x + x;
        if (left + g.w < -50 || left > vw + 50) return;
        const t = (left + g.w / 2 - vw / 2) / vw;
        imgs[i].style.setProperty('--px', `${(-t * g.w * 0.07).toFixed(1)}px`);
      });
      if (running) requestAnimationFrame(frame);
    };

    layout();
    if (desk.addEventListener) desk.addEventListener('change', layout);
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
    addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    new IntersectionObserver((e) => {
      const vis = e[0].isIntersecting && pinned;
      if (vis && !running) { running = true; requestAnimationFrame(frame); } else if (!vis) running = false;
    }, { rootMargin: '100px' }).observe(homes);

    // side scroll travels the gallery: it glides the page through the pinned section, never past it
    let goal = null, goalT = 0;
    homes.addEventListener('wheel', (e) => {
      if (!pinned) return;                         // phones and tablets: the track scrolls sideways by itself
      const dx = side(e);
      if (!dx) return;
      e.preventDefault();
      const now = performance.now();
      if (goal === null || now - goalT > 400) goal = scrollY;
      goalT = now;
      const top = homes.getBoundingClientRect().top + scrollY;
      goal = clamp(goal + dx * 1.4, top, top + homes.offsetHeight - innerHeight);
      scrollTo({ top: goal, behavior: calm ? 'auto' : 'smooth' });
    }, { passive: false });

    // keyboard: tabbing to a card that's off to the side scrolls the page until it's in view
    track.addEventListener('focusin', (e) => {
      if (!pinned) return;
      const el = e.target.closest('.card, .homes__intro');
      if (!el || !dist) return;
      const p = clamp((el.offsetLeft - innerWidth * 0.2) / dist, 0, 1);
      const top = homes.getBoundingClientRect().top + scrollY;
      const y = top + p * (homes.offsetHeight - innerHeight);
      (window.AspenScroll ? window.AspenScroll.to : (v) => scrollTo(0, v))(y);
    });
  }

  /* ================================================ plan your home */
  const form = document.getElementById('planner');
  if (form) {
    const TYPES = { custom: 'Custom home', farmhouse: 'Luxury farmhouse', barndo: 'Barndominium', remodel: 'Remodel or addition' };
    const EMAIL = 'alan@aspenhomesoftx.com';
    const steps = [...form.querySelectorAll('.step')];
    const dots = [...form.querySelectorAll('.planner__steps li')];
    const barEl = form.querySelector('.planner__bar');
    const back = form.querySelector('[data-back]');
    const next = form.querySelector('[data-next]');
    const sends = [...form.querySelectorAll('[data-send]')];   // "Create my Home Brief" on the last step
    const WHATSAPP = '15128485647';
    const done = form.querySelector('.planner__done');
    const copied = form.querySelector('.planner__copied');
    const sqft = form.querySelector('#sqft');
    const sqftOut = form.querySelector('#sqftOut');
    const sqftLabel = form.querySelector('#sqftLabel');
    const segs = form.querySelector('.segs');
    const scope = form.querySelector('.scope');
    const svg = document.getElementById('sheetSvg');
    const g = document.getElementById('sheetDraw');
    const outs = {};
    document.querySelectorAll('[data-out]').forEach((el) => { outs[el.dataset.out] = el; });
    let at = 0, shape = '';

    const read = () => {
      const f = new FormData(form);
      return {
        type: f.get('type'), sqft: +f.get('sqft'), beds: +f.get('beds'), baths: +f.get('baths'), stories: +f.get('stories'),
        scope: f.getAll('scope'), lot: f.get('lot'), town: f.get('town'), when: f.get('when'),
        name: String(f.get('name') || '').trim(), email: String(f.get('email') || '').trim(),
        phone: String(f.get('phone') || '').trim(), notes: String(f.get('notes') || '').trim(),
      };
    };

    /* ---------- step flow */
    const show = (i, focus) => {
      at = i;
      steps.forEach((s, n) => { s.hidden = n !== i; s.classList.toggle('is-on', n === i); });
      dots.forEach((d, n) => {
        d.classList.toggle('on', n === i);
        d.classList.toggle('done', n < i);
        if (n === i) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      barEl.style.setProperty('--sp', ((i + 1) / steps.length).toFixed(3));
      back.hidden = i === 0;
      next.hidden = i === steps.length - 1;
      sends.forEach((b) => { b.hidden = i !== steps.length - 1; });
      if (!focus) return;
      const top = form.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.6) (window.AspenScroll ? window.AspenScroll.to : (v) => scrollTo(0, v))(scrollY + top - 110);
      const first = steps[i].querySelector('input:checked, input:not([type=radio]):not([type=checkbox]), select, input');
      if (first) first.focus({ preventScroll: true });
    };
    next.addEventListener('click', () => { if (at < steps.length - 1) show(at + 1, true); });
    back.addEventListener('click', () => { if (at > 0) show(at - 1, true); });

    /* ---------- validation (on blur once touched, and on create): a name is required, email is optional */
    const rules = {
      pName: (v) => (v ? '' : 'Please add your name so the brief is drawn up for you.'),
      pEmail: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'That email looks incomplete. Check it has an @ and a domain, like name@email.com.'),
    };
    const check = (id) => {
      const el = form.querySelector(`#${id}`);
      const msg = rules[id](el.value.trim());
      el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      form.querySelector(`#${id}Err`).textContent = msg;
      return !msg;
    };
    Object.keys(rules).forEach((id) => {
      const el = form.querySelector(`#${id}`);
      el.addEventListener('blur', () => { if (el.value.trim() || el.getAttribute('aria-invalid') === 'true') check(id); });
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') check(id); });
    });

    /* ---------- the brief as plain text (email, WhatsApp, copy) */
    const roomsLine = (s) => `${s.beds === 6 ? '6+' : s.beds} bedrooms, ${s.baths === 5 ? '5+' : s.baths} bathrooms, ${s.stories === 2 ? 'two stories' : 'one story'}`;
    const finishLine = () => `${studio.names.siding} siding, ${studio.names.roof.toLowerCase()} roof, ${studio.names.masonry.toLowerCase()} stone, ${studio.names.accent.toLowerCase()} accents`;
    const where = (s) => (/Texas/.test(s.town) ? s.town : `${s.town}, TX`);
    const brief = (s, no) => {
      const lines = ['Hello Aspen Homes,', '', 'I\'d like to talk about a project. Here is my Home Brief' + (no ? ` (${no})` : '') + ':', ''];
      lines.push(`Project: ${TYPES[s.type]}`);
      if (s.type === 'remodel') {
        lines.push(`Home today: about ${fmt(s.sqft)} sq ft`);
        lines.push(`Updating: ${s.scope.length ? s.scope.join(', ') : 'Not sure yet'}`);
      } else {
        lines.push(`Size: about ${fmt(s.sqft)} sq ft, ${roomsLine(s)}`);
        lines.push(`Finishes: ${finishLine()}`);
      }
      lines.push(`Lot: ${s.lot}`);
      lines.push(`Location: ${where(s)}`);
      lines.push(`Timing: ${s.when}`);
      if (s.notes) lines.push('', `Notes: ${s.notes}`);
      lines.push('', `Name: ${s.name}`);
      if (s.email) lines.push(`Email: ${s.email}`);
      if (s.phone) lines.push(`Phone: ${s.phone}`);
      lines.push('', 'Made with the Plan Your Home sketch on the Aspen Homes website.');
      return lines.join('\n');
    };

    /* ---------- the Home Brief: one designed page with the 3D picture, to save as PDF or send */
    const dlg = document.getElementById('briefDlg');
    const page = document.getElementById('brief');
    const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
    let current = null;   // { s, no, text }

    function briefNo() {
      const d = new Date();
      const p2 = (n) => String(n).padStart(2, '0');
      return `AH-${String(d.getFullYear()).slice(2)}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${Math.floor(100 + Math.random() * 900)}`;
    }

    function renderBrief(s, no) {
      const shot = model && model.snapshot ? model.snapshot() : null;
      const elev = svg.cloneNode(true);
      elev.removeAttribute('id');
      elev.classList.remove('draw');
      elev.setAttribute('aria-hidden', 'true');
      const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const row = (k, v) => (v ? `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : '');
      const homeRows = s.type === 'remodel'
        ? row('Project', TYPES[s.type]) + row('Home today', `About ${fmt(s.sqft)} sq ft`) + row('Updating', s.scope.length ? s.scope.join(', ') : 'Not sure yet')
        : row('Home', TYPES[s.type]) + row('Living space', `About ${fmt(s.sqft)} sq ft`) + row('Rooms', roomsLine(s)) +
          row('Siding', studio.names.siding) + row('Roof', studio.names.roof) + row('Stone', studio.names.masonry) + row('Accents', studio.names.accent);
      page.innerHTML = `
        <header class="brief__head">
          <img src="img/logo-white.webp" width="800" height="241" alt="Aspen Homes">
          <div><p class="brief__kind">Home Brief</p><p class="brief__meta">${esc(no)} &middot; ${esc(date)}</p></div>
        </header>
        <section class="brief__hero">
          ${shot ? `<img src="${shot}" alt="3D model of the home in this brief">` : ''}
          <p class="brief__for"><span>Drawn up for</span><b>${esc(s.name)}</b><span>${esc(where(s))}</span></p>
        </section>
        <section class="brief__cols">
          <div>
            <h2>The home</h2>
            <dl class="brief__dl">${homeRows}</dl>
          </div>
          <div>
            <h2>The plan</h2>
            <dl class="brief__dl">${row('Lot', s.lot)}${row('Location', where(s))}${row('Timing', s.when)}${row('Email', s.email)}${row('Phone', s.phone)}</dl>
            ${s.notes ? `<p class="brief__notes"><span>Notes</span>${esc(s.notes)}</p>` : ''}
          </div>
        </section>
        <section class="brief__elev"><h2>Front elevation <small>Sketch, not to scale</small></h2></section>
        <section class="brief__next">
          <h2>What happens next</h2>
          <ol>
            <li><b>Talk it through.</b> A short call with the Aspen team to go over this brief and your lot.</li>
            <li><b>Plans and specifications.</b> Start from an Aspen floor plan or design from scratch with our in-house architect, then walk through finishes and lot costs.</li>
            <li><b>Proposal and selections.</b> A fixed-price turnkey proposal, selections with an interior designer at our design center, then a pre-construction meeting.</li>
          </ol>
        </section>
        <footer class="brief__foot">
          <span>Aspen Homes &middot; Family-owned custom home builder &middot; Hutto, TX 78634</span>
          <span>(512) 848-5647 &middot; alan@aspenhomesoftx.com</span>
          <span class="brief__fine">A sketch to start the conversation, not a quote or a construction drawing.</span>
        </footer>`;
      page.querySelector('.brief__elev').append(elev);
    }

    function openBrief() {
      if (!current) return;
      renderBrief(current.s, current.no);
      document.body.style.overflow = 'hidden';
      dlg.showModal();
      dlg.querySelector('.bd__scroll').scrollTop = 0;
    }
    dlg.addEventListener('close', () => { document.body.style.overflow = ''; document.documentElement.classList.remove('print-brief'); });
    dlg.querySelector('[data-brief-close]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector('[data-brief-pdf]').addEventListener('click', () => {
      // the print stylesheet shows only the brief, on one Letter page; choose "Save as PDF" as the printer
      document.documentElement.classList.add('print-brief');
      const prev = document.title;
      document.title = `Aspen Home Brief ${current.no}`;   // becomes the PDF's file name
      window.print();
      document.title = prev;
      document.documentElement.classList.remove('print-brief');
    });
    dlg.querySelector('[data-brief-email]').addEventListener('click', () => {
      const s = current.s;
      const subject = `Home Brief ${current.no}: ${TYPES[s.type]} in ${where(s).replace('Elsewhere in Central Texas', 'Central Texas')}`;
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(current.text)}`;
    });
    dlg.querySelector('[data-brief-wa]').addEventListener('click', () => {
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(current.text)}`, '_blank', 'noopener');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (at < steps.length - 1) { show(at + 1, true); return; }   // Enter on an early step moves on
      const bad = ['pName', 'pEmail'].filter((id) => !check(id));
      if (bad.length) { form.querySelector(`#${bad[0]}`).focus(); return; }
      const s = read();
      const no = briefNo();
      current = { s, no, text: brief(s, no) };
      form.dataset.brief = current.text;
      form.classList.add('is-done');
      done.hidden = false;
      openBrief();
    });
    form.querySelector('[data-open-brief]').addEventListener('click', openBrief);

    form.querySelector('[data-copy]').addEventListener('click', () => {
      const text = form.dataset.brief || brief(read());
      const ok = () => { copied.textContent = `Copied. Paste it into an email to ${EMAIL} or a WhatsApp message.`; };
      const fallback = () => {
        const t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.append(t); t.select();
        try { document.execCommand('copy'); ok(); } catch (err) { copied.textContent = 'Copy did not work here. Please call (512) 848-5647.'; }
        t.remove();
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
    });
    form.querySelector('[data-restart]').addEventListener('click', () => {
      form.reset();
      form.classList.remove('is-done');
      done.hidden = true;
      copied.textContent = '';
      Object.keys(rules).forEach((id) => { form.querySelector(`#${id}`).removeAttribute('aria-invalid'); form.querySelector(`#${id}Err`).textContent = ''; });
      shape = '';
      update(true);
      show(0, true);
    });

    /* ---------- drawing: a front elevation built from the answers */
    const G = 330;           // ground line (viewBox is 800 x 420)
    const FT = 7;            // px per foot
    let out = [], k = 0;
    // pathLength="1" lets every line draw in with one dash; dashed lines ('d') keep real lengths
    const P = (d, cls = '') => { out.push(`<path${/\bd\b/.test(cls) ? '' : ' pathLength="1"'} class="s ${cls}" style="--k:${k++}" d="${d}"/>`); };
    const F = (d, cls = '') => { out.push(`<path class="f ${cls}" d="${d}"/>`); };
    const T = (x, y, s, cls = 'lbl', anchor = 'middle') => { out.push(`<text class="${cls} fade" style="--k:${k++}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${s}</text>`); };
    const R = (x, y, w, h) => `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h${(-w).toFixed(1)}z`;
    const box = (x, y, w, h, cls = '') => { F(R(x, y, w, h)); P(R(x, y, w, h), cls); };

    const win = (x, y, w, h, cls = '', lintel = false) => {
      box(x, y, w, h, cls);
      P(`M${(x + w / 2).toFixed(1)} ${y.toFixed(1)}v${h.toFixed(1)}M${x.toFixed(1)} ${(y + h * 0.55).toFixed(1)}h${w.toFixed(1)}`, `t ${cls}`);
      if (lintel) P(`M${(x - 4).toFixed(1)} ${(y - 5).toFixed(1)}h${(w + 8).toFixed(1)}`, 'b');
    };
    const door = (cx, w, h, cls = '') => {
      box(cx - w / 2, G - h, w, h, cls);
      P(`M${cx.toFixed(1)} ${(G - h).toFixed(1)}V${G}`, `t ${cls}`);
      box(cx - w / 2, G - h - 12, w, 8, `t ${cls}`);
    };
    // spread n windows over open stretches of wall, in proportion to their width
    const spread = (spans, n, y, w, h, cls, lintel) => {
      const open = spans.map(([a, b]) => [a, b, Math.max(0, b - a)]).filter((s) => s[2] > w + 16);
      const total = open.reduce((t, s) => t + s[2], 0);
      if (!total) return;
      let left = n;
      open.forEach((s, i) => {
        let c = i === open.length - 1 ? left : Math.round((n * s[2]) / total);
        c = Math.min(c, Math.floor(s[2] / (w + 14)), left);
        left -= c;
        for (let j = 0; j < c; j++) win(s[0] + (s[2] * (j + 1)) / (c + 1) - w / 2, y, w, h, cls, lintel);
      });
    };
    const posts = (a, b, top, every) => {
      const n = Math.max(2, Math.round((b - a) / every) + 1);
      let d = '';
      for (let i = 0; i < n; i++) { const x = a + ((b - a) * i) / (n - 1); d += `M${x.toFixed(1)} ${G}V${top.toFixed(1)}`; }
      P(d, 'b');
      P(`M${(a - 8).toFixed(1)} ${top.toFixed(1)}H${(b + 8).toFixed(1)}`, 'b');
    };
    const callout = (x, y, ly, text) => {
      out.push(`<circle class="fade" style="--k:${k++}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="var(--brass)"/>`);
      P(`M${x.toFixed(1)} ${y.toFixed(1)}V${(ly + 6).toFixed(1)}`, 'b t');
      T(x, ly, text, 'lbl lbl--b');
    };

    function elevation(s) {
      out = []; k = 0;
      const remodel = s.type === 'remodel';
      const stories = remodel ? 1 : s.stories;
      const wallH = (s.type === 'barndo' ? 11 : 10) * FT;
      const widthFt = Math.round(Math.sqrt((s.sqft / stories) * 1.6));
      let W = clamp(widthFt * FT, 240, 640);
      const add = remodel && s.scope.includes('Addition') ? clamp(W * 0.36, 96, 150) : 0;
      if (W + add > 700) W = 700 - add;   // keep a house plus its addition on the sheet
      const x0 = 400 - (W + add) / 2, x1 = x0 + W;
      const top = G - wallH * stories;
      const beds = Math.min(s.beds || 3, 6);

      // ground, earth hatch, scale bar
      out.push(`<rect class="earth fade" style="--k:0" x="16" y="${G}" width="768" height="14"/>`);
      P(`M16 ${G}H784`);
      P('M36 34V44M71 37V41M106 34V44M141 37V41M176 34V44M36 39H176', 't');   // 5 ft ticks at 7 px/ft
      T(36, 60, '0', 'lbl', 'start'); T(106, 60, '10', 'lbl'); T(176, 60, '20 ft', 'lbl', 'middle');

      if (s.type === 'farmhouse') {
        const rh = 56;
        F(`M${x0 - 12} ${top}L${x0 + rh * 1.15} ${top - rh}H${x1 - rh * 1.15}L${x1 + 12} ${top}Z`);
        P(`M${x0 - 12} ${top}L${x0 + rh * 1.15} ${top - rh}H${x1 - rh * 1.15}L${x1 + 12} ${top}Z`);
        let shingles = '';
        for (let yy = top - 9; yy > top - rh + 4; yy -= 9) {
          const f = (top - yy) / rh;
          shingles += `M${(x0 - 12 + f * (rh * 1.15 + 12)).toFixed(1)} ${yy}H${(x1 + 12 - f * (rh * 1.15 + 12)).toFixed(1)}`;
        }
        P(shingles, 't');
        box(x0, top, W, G - top);
        // front gables, board-and-batten, black trim
        const gw = clamp(W * 0.3, 96, 176), gx = x0 + W * 0.66;
        const gables = [[gx, gw, gw * 0.66]];
        if (W > 300) gables.push([x0 + W * 0.2, gw * 0.62, gw * 0.42]);
        gables.forEach(([cx, w, ph]) => {
          const l = cx - w / 2, r = cx + w / 2;
          F(`M${l} ${G}V${top}L${cx} ${top - ph}L${r} ${top}V${G}Z`);
          P(`M${l} ${G}V${top}L${cx} ${top - ph}L${r} ${top}V${G}`);
          let bb = '';
          for (let x = l + 7; x < r - 4; x += 8) {
            const yTop = top - ph * (1 - Math.abs(x - cx) / (w / 2)) + 4;
            bb += `M${x.toFixed(1)} ${G}V${yTop.toFixed(1)}`;
          }
          P(bb, 't');
          P(`M${l - 8} ${top + 6}L${cx} ${top - ph - 6}L${r + 8} ${top + 6}`, 'k');
        });
        // main gable: big window (and upstairs window), attic window; the front door sits in the
        // small gable, or on the porch when the house is too narrow for a second gable
        win(gx - gw * 0.24, G - 54, gw * 0.48, 38, '', true);
        if (stories === 2) win(gx - gw * 0.2, top + 16, gw * 0.4, 34, '', true);
        win(gx - 9, top - gw * 0.66 * 0.55, 18, 18);
        const small = gables[1];
        const gl = gx - gw / 2;
        const dx = small ? small[0] : x0 + (gl - x0) * 0.5;
        door(dx, 30, 50);
        const spans = small
          ? [[x0 + 6, small[0] - small[1] / 2 - 6], [small[0] + small[1] / 2 + 8, gl - 8], [gx + gw / 2 + 8, x1 - 6]]
          : [[x0 + 6, dx - 24], [dx + 24, gl - 8], [gx + gw / 2 + 8, x1 - 6]];
        spread(spans, Math.max(2, beds - 1), G - 50, 20, 36, '', true);
        if (stories === 2) spread([[x0 + 6, gl - 8], [gx + gw / 2 + 8, x1 - 6]], beds, top + 16, 20, 32, '', true);
        const pl = small ? small[0] + small[1] / 2 : x0;
        if (gl - pl > 70) posts(pl + 16, gl - 16, G - 52, 52);   // cedar porch posts in front of the wall
      } else if (s.type === 'barndo') {
        const rise = W * 0.16;
        F(`M${x0} ${G}V${top}L400 ${top - rise}L${x1} ${top}V${G}Z`);
        P(`M${x0} ${G}V${top}L400 ${top - rise}L${x1} ${top}V${G}Z`);
        let rib = '';
        for (let x = x0 + 10; x < x1 - 4; x += 10) {
          const yTop = top - rise * (1 - Math.abs(x - 400) / (W / 2)) + 3;
          rib += `M${x.toFixed(1)} ${G - 22}V${yTop.toFixed(1)}`;
        }
        P(rib, 't');
        P(`M${x0} ${G - 22}H${x1}`, 't');
        P(`M${x0 - 18} ${top + 8}L400 ${top - rise - 6}L${x1 + 18} ${top + 8}`, 'k');
        win(392, top - rise * 0.5, 16, 16);
        const shopW = clamp(W * 0.2, 60, 92);
        const sx = x1 - 22 - shopW;
        box(sx, G - 50, shopW, 50);
        let roll = '';
        for (let y = G - 44; y < G; y += 7) roll += `M${sx} ${y}h${shopW}`;
        P(roll, 't');
        door(x0 + W * 0.38, 32, 48);
        spread([[x0 + 10, x0 + W * 0.38 - 26], [x0 + W * 0.38 + 26, sx - 12]], Math.max(2, beds - 1), G - 46, 22, 30);
        if (stories === 2) spread([[x0 + 10, x1 - 10]], beds + 1, top + 18, 22, 30);
        // wraparound porch across the front, drawn last so the posts stand in front
        F(R(x0 - 26, G - 62, W + 52, 8));
        P(R(x0 - 26, G - 62, W + 52, 8), 'b');
        posts(x0 - 18, x1 + 18, G - 54, 64);
      } else if (s.type === 'custom') {
        const rh = 32;
        F(`M${x0 - 14} ${top}L${x0 + 46} ${top - rh}H${x1 - 46}L${x1 + 14} ${top}Z`);
        P(`M${x0 - 14} ${top}L${x0 + 46} ${top - rh}H${x1 - 46}L${x1 + 14} ${top}Z`);
        let seam = '';
        for (let x = x0 + 4; x < x1; x += 11) {
          const dl = x < x0 + 46 ? (x - (x0 - 14)) / 60 : x > x1 - 46 ? ((x1 + 14) - x) / 60 : 1;
          seam += `M${x.toFixed(1)} ${top}V${(top - rh * clamp(dl, 0, 1)).toFixed(1)}`;
        }
        P(seam, 't');
        box(x0, top, W, G - top);
        const stoneTop = G - 26;
        out.push(`<rect class="stone fade" style="--k:${k++}" x="${x0}" y="${stoneTop}" width="${W}" height="26"/>`);
        P(`M${x0} ${stoneTop}H${x1}`, 't');
        // entry tower with its own hip roof
        const tw = clamp(W * 0.2, 72, 112), tx = x0 + W * 0.38, tt = top - 44;
        F(R(tx - tw / 2, tt, tw, G - tt));
        P(R(tx - tw / 2, tt, tw, G - tt));
        F(`M${tx - tw / 2 - 12} ${tt}L${tx - tw / 2 + 22} ${tt - 26}H${tx + tw / 2 - 22}L${tx + tw / 2 + 12} ${tt}Z`);
        P(`M${tx - tw / 2 - 12} ${tt}L${tx - tw / 2 + 22} ${tt - 26}H${tx + tw / 2 - 22}L${tx + tw / 2 + 12} ${tt}Z`);
        out.push(`<rect class="stone fade" style="--k:${k++}" x="${tx - tw / 2}" y="${stoneTop}" width="${tw}" height="26"/>`);
        win(tx - tw * 0.28, tt + 14, tw * 0.56, G - tt - 86);
        box(tx - 12, G - 54, 24, 54, 'b');
        // garage bays at the right end
        const bays = W > 420 ? 2 : 1, bw = 58;
        const gx0 = x1 - 16 - bays * (bw + 10) + 10;
        for (let b = 0; b < bays; b++) {
          const bx = gx0 + b * (bw + 10);
          box(bx, G - 42, bw, 42);
          let pnl = '';
          for (let y = G - 34; y < G; y += 8.5) pnl += `M${bx} ${y.toFixed(1)}h${bw}`;
          P(pnl, 't');
        }
        const spans = [[x0 + 10, tx - tw / 2 - 8], [tx + tw / 2 + 8, gx0 - 14]];
        spread(spans, Math.max(2, beds), G - 58, 26, 30);
        if (stories === 2) spread([[x0 + 10, tx - tw / 2 - 8], [tx + tw / 2 + 8, x1 - 10]], beds + 1, top + 16, 26, 30);
      } else {
        // remodel: today's house in dashed lines, the new work in brass
        F(`M${x0 - 10} ${top}L${x0 + W * 0.24} ${top - 44}H${x1 - W * 0.24}L${x1 + 10} ${top}Z`);
        P(`M${x0 - 10} ${top}L${x0 + W * 0.24} ${top - 44}H${x1 - W * 0.24}L${x1 + 10} ${top}Z`, 'd');
        F(R(x0, top, W, G - top));
        P(R(x0, top, W, G - top), 'd');
        [0.14, 0.34, 0.62, 0.82].forEach((f) => P(R(x0 + W * f - 10, G - 46, 20, 30), 'd'));
        P(R(x0 + W * 0.48 - 13, G - 48, 26, 48), 'd');
        T(x0 + W * 0.58, top - 16, 'Existing', 'lbl');
        let lab = 0;
        const ly = () => top - 74 - (lab++ % 2) * 22;
        if (add) {
          const a0 = x1, a1 = x1 + add, acx = (a0 + a1) / 2, ah = add * 0.44;
          F(`M${a0} ${G}V${top}L${acx} ${top - ah}L${a1} ${top}V${G}Z`);
          out.push(`<path class="bf fade" style="--k:${k++}" d="M${a0} ${G}V${top}L${acx} ${top - ah}L${a1} ${top}V${G}Z"/>`);
          P(`M${a0} ${G}V${top}L${acx} ${top - ah}L${a1} ${top}V${G}`, 'b');
          P(`M${a0 - 6} ${top + 5}L${acx} ${top - ah - 5}L${a1 + 6} ${top + 5}`, 'b k');
          win(acx - add * 0.22, G - 50, add * 0.44, 34, 'b');
          T(acx, top - ah - 18, 'New addition', 'lbl lbl--b');
        }
        if (s.scope.includes('Porch')) {
          posts(x0 + 16, x1 - 16, G - 50, 50);
          callout(x0 + W * 0.42, G - 50, ly(), 'New porch');
        }
        if (s.scope.includes('Kitchen')) callout(x0 + W * 0.14, G - 31, ly(), 'Kitchen');
        if (s.scope.includes('Bathrooms')) callout(x0 + W * 0.72, G - 31, ly(), 'Bathrooms');
        if (s.scope.includes('Flooring')) {
          P(`M${x0 + 4} ${G - 4}H${x1 - 4}`, 'b');
          callout(x0 + W * 0.9, G - 4, ly(), 'Flooring');
        }
      }

      // width dimension and level marks
      const dy = G + 46;
      P(`M${x0} ${G + 10}V${dy + 8}M${x1 + add} ${G + 10}V${dy + 8}`, 't');
      P(`M${x0} ${dy}H${x1 + add}M${x0 - 5} ${dy + 5}l10 -10M${x1 + add - 5} ${dy + 5}l10 -10`);
      const ftTotal = Math.round((W + add) / FT);
      T((x0 + x1 + add) / 2, dy - 9, `&#8776; ${ftTotal}&#8242;-0&#8243;`, 'lbl--dim');
      const lx = Math.max(20, x0 - 100);
      P(`M${lx} ${top}H${x0 - 30}`, 't d');
      T(lx, top - 6, `Plate ${10 * stories + (s.type === 'barndo' ? stories : 0)}&#8242;`, 'lbl', 'start');
      return out.join('');
    }

    const sizeText = (s) => `${fmt(s.sqft)} sq ft${s.type !== 'remodel' && s.stories === 2 ? ' · 2 stories' : ''}`;
    const roomText = (s) => (s.type === 'remodel'
      ? (s.scope.length ? s.scope.join(', ') : 'Tell us on the call')
      : `${s.beds === 6 ? '6+' : s.beds} bed · ${s.baths === 5 ? '5+' : s.baths} bath`);

    function update(animate) {
      const s = read();
      const remodel = s.type === 'remodel';
      segs.hidden = remodel;
      scope.hidden = !remodel;
      sqftLabel.textContent = remodel ? 'Your home today' : 'Living space';
      sqftOut.textContent = `${fmt(s.sqft)} sq ft`;
      sqft.style.setProperty('--fill', `${(((s.sqft - +sqft.min) / (+sqft.max - +sqft.min)) * 100).toFixed(1)}%`);
      outs.type.textContent = TYPES[s.type];
      outs.size.textContent = sizeText(s);
      outs.rooms.textContent = roomText(s);
      outs.town.textContent = /Texas/.test(s.town) ? s.town : `${s.town}, TX`;
      outs.name.textContent = s.name || 'You';
      svg.setAttribute('aria-label', `Front elevation sketch of a ${TYPES[s.type].toLowerCase()}, about ${fmt(s.sqft)} square feet${remodel ? '' : `, ${s.stories === 2 ? 'two stories' : 'one story'}`}.`);
      // redraw with the line-drawing animation only when the shape of the house changes
      const key = `${s.type}|${remodel ? s.scope.join() : s.stories}`;
      const drawIn = !calm && (animate || key !== shape);
      shape = key;
      g.innerHTML = elevation(s);
      if (drawIn) { svg.classList.remove('draw'); void svg.getBBox(); svg.classList.add('draw'); }
      else svg.classList.remove('draw');
      if (model) model.build(s, drawIn);
    }

    /* ---------- 3D model: three.js loads only when the planner comes near, then mirrors every answer */
    const sheet = document.querySelector('.sheet');
    const stage = sheet.querySelector('.sheet__stage');
    const tabs = [...sheet.querySelectorAll('[role="tab"]')];
    let model = null;
    const setView = (view, focus) => {
      stage.dataset.view = view;
      tabs.forEach((t) => {
        const on = t.dataset.view === view;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      sheet.querySelector('#view3d').setAttribute('aria-hidden', String(view !== '3d'));
      sheet.querySelector('#viewPlan').setAttribute('aria-hidden', String(view !== 'plan'));
      if (model) model.setActive(view === '3d');
    };
    tabs.forEach((t, n) => {
      t.addEventListener('click', () => setView(t.dataset.view));
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        setView(tabs[(n + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].dataset.view, true);
      });
    });
    const no3d = () => { setView('plan'); sheet.querySelector('.sheet__tabs').hidden = true; sheet.classList.add('no-3d'); };
    sheet.addEventListener('house:touched', () => sheet.classList.add('is-touched'));

    /* ---------- Design Studio: finishes and light for the 3D model, remembered for the brief */
    const studioEl = document.getElementById('studio');
    const tod = document.getElementById('tod');
    const todOut = document.getElementById('todOut');
    const studio = {
      finish: { siding: 'alabaster', roof: 'charcoal', masonry: 'limestone', accent: 'cedar' },
      names: { siding: 'Alabaster', roof: 'Charcoal', masonry: 'Limestone', accent: 'Cedar' },
      time: 0,
    };
    const todName = (v) => (v < 0.3 ? 'Day' : v < 0.62 ? 'Golden hour' : v < 0.9 ? 'Dusk' : 'Night');
    studioEl.addEventListener('change', (e) => {
      const i = e.target;
      if (i.type !== 'radio' || !(i.name in studio.finish)) return;
      studio.finish[i.name] = i.value;
      studio.names[i.name] = i.dataset.name;
      studioEl.querySelector(`[data-pick="${i.name}"]`).textContent = i.dataset.name;
      if (model) model.setFinish(studio.finish);
    });
    tod.addEventListener('input', () => {
      studio.time = +tod.value / 100;
      const name = todName(studio.time);
      todOut.textContent = name;
      tod.setAttribute('aria-valuetext', name);
      tod.style.setProperty('--fill', `${tod.value}%`);
      if (model) model.setTime(studio.time);
    });
    // plain <script> tags rather than modules, so the 3D view also works when index.html is opened from the folder
    const script = (src) => new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = fail;
      document.head.append(s);
    });
    once(sheet, () => {
      script('https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js')
        .then(() => script('house3d.js'))
        .then(() => {
          model = window.AspenHouse3D && window.AspenHouse3D.mount(document.getElementById('house3d'), sheet.querySelector('.sheet__tags'), { calm });
          if (!model) return no3d();
          sheet.classList.add('is-3d-ready');
          model.setFinish(studio.finish);
          model.setTime(studio.time);
          model.setActive(stage.dataset.view === '3d');
          model.build(read(), true);
        })
        .catch(no3d);   // offline or no WebGL: the elevation still works
    }, '800px 0px');
    setView('3d');

    form.addEventListener('input', (e) => {
      if (e.target.name === 'name') outs.name.textContent = e.target.value.trim() || 'You';
      else if (e.target.name === 'sqft') update(false);
    });
    form.addEventListener('change', (e) => { if (e.target.type === 'radio' || e.target.type === 'checkbox' || e.target.tagName === 'SELECT') update(false); });
    update(false);
    show(0, false);
    // draw the first sketch when the section comes into view
    if (!calm) once(sheet, () => { shape = ''; update(true); }, '0px 0px -10% 0px');
  }

  /* ================================================ gallery: full-screen photo viewer */
  const lb = document.getElementById('lightbox');
  const shots = [...document.querySelectorAll('[data-lightbox]')];
  if (lb && shots.length && typeof lb.showModal === 'function') {
    const img = lb.querySelector('.lb__img');
    const capB = lb.querySelector('.lb__cap b');
    const capS = lb.querySelector('.lb__cap span');
    const count = lb.querySelector('.lb__count');
    const thumbs = lb.querySelector('.lb__thumbs');
    const stageEl = lb.querySelector('.lb__stage');
    const items = shots.map((a) => {
      const im = a.querySelector('img');
      const small = (im.getAttribute('srcset') || '').split(',')[0].trim().split(' ')[0];
      return { full: a.getAttribute('href'), thumb: small || im.src, alt: im.alt, title: a.dataset.title, tag: a.dataset.tag, card: a };
    });
    let at = 0, opener = null, sx = null, swiped = false;
    const pad = (n) => String(n).padStart(2, '0');

    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Photo ${i + 1}: ${it.title}`);
      const t = document.createElement('img');
      t.loading = 'lazy'; t.alt = ''; t.src = it.thumb;   // loading first, or the browser fetches at once
      b.append(t);
      b.addEventListener('click', () => paint(i, i > at ? 1 : -1));
      thumbs.append(b);
    });

    // full photos are downloaded and decoded before they go on screen, and the next and previous ones are
    // fetched ahead, so the arrows swap at once instead of decoding a large photo mid-animation
    const ahead = new Map();
    const fetchFull = (i) => {
      const src = items[(i + items.length) % items.length].full;
      if (!ahead.has(src)) {
        const im = new Image();
        im.decoding = 'async';
        im.src = src;
        ahead.set(src, (im.decode ? im.decode() : new Promise((ok) => { im.onload = im.onerror = ok; })).catch(() => {}));
      }
      return ahead.get(src);
    };
    let paintId = 0;
    function paint(i, dir) {
      at = (i + items.length) % items.length;
      const it = items[at], id = ++paintId;
      capB.textContent = it.title;
      capS.textContent = it.tag;
      count.textContent = `${pad(at + 1)} / ${pad(items.length)}`;
      [...thumbs.children].forEach((b, n) => b.setAttribute('aria-current', String(n === at)));
      fetchFull(at).then(() => {
        if (id !== paintId) return;                    // a later press already moved on
        img.src = it.full;
        img.alt = it.alt;
        if (dir && !calm && img.animate) {
          img.animate([{ opacity: 0, transform: `translateX(${dir * 48}px)` }, { opacity: 1, transform: 'none' }], { duration: 440, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
      });
      fetchFull(at + 1);
      fetchFull(at - 1);
    }
    function openAt(i) {
      opener = items[i].card;
      // open on the card's own picture (already decoded), then the full photo replaces it when it's ready
      const cardImg = items[i].card.querySelector('img');
      img.src = cardImg.currentSrc || items[i].full;
      img.alt = items[i].alt;
      paint(i, 0);
      document.body.style.overflow = 'hidden';
      lb.showModal();
      // the photo grows out of the card you pressed
      const from = items[i].card.querySelector('img').getBoundingClientRect();
      const grow = () => {
        const to = img.getBoundingClientRect();
        if (calm || !img.animate || !to.width) return;
        img.animate([
          { transform: `translate(${(from.left + from.width / 2 - to.left - to.width / 2).toFixed(1)}px, ${(from.top + from.height / 2 - to.top - to.height / 2).toFixed(1)}px) scale(${(from.width / to.width).toFixed(3)})`, opacity: 0.5 },
          { transform: 'none', opacity: 1 },
        ], { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
      };
      if (img.complete && img.naturalWidth) grow(); else img.addEventListener('load', grow, { once: true });
    }
    function shut() {
      if (!lb.open) return;
      if (calm) { lb.close(); return; }
      lb.classList.add('is-closing');
      setTimeout(() => { lb.classList.remove('is-closing'); lb.close(); }, 240);
    }

    shots.forEach((a, i) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;   // let people open the photo in a new tab
      e.preventDefault();
      openAt(i);
    }));
    lb.addEventListener('close', () => { document.body.style.overflow = ''; if (opener) opener.focus({ preventScroll: true }); });
    lb.addEventListener('cancel', (e) => { e.preventDefault(); shut(); });   // Esc fades out instead of snapping
    lb.querySelector('.lb__close').addEventListener('click', shut);
    lb.querySelector('.lb__prev').addEventListener('click', () => paint(at - 1, -1));
    lb.querySelector('.lb__next').addEventListener('click', () => paint(at + 1, 1));
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') paint(at + 1, 1);
      else if (e.key === 'ArrowLeft') paint(at - 1, -1);
    });
    lb.addEventListener('click', (e) => {
      if (swiped) { swiped = false; return; }
      if (e.target === lb || e.target === stageEl) shut();   // a click on the dark area closes
    });
    let acc = 0, accT = 0, lockUntil = 0;
    lb.addEventListener('wheel', (e) => {
      const dx = side(e);
      if (!dx || e.target.closest('.lb__thumbs')) return;
      e.preventDefault();
      const now = performance.now();
      if (now - accT > 250) acc = 0;
      accT = now;
      acc += dx;
      if (now < lockUntil || Math.abs(acc) < 40) return;
      const dir = acc > 0 ? 1 : -1;
      paint(at + dir, dir);
      acc = 0;
      lockUntil = now + 320;
    }, { passive: false });
    stageEl.addEventListener('pointerdown', (e) => { sx = e.clientX; swiped = false; });
    stageEl.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const d = e.clientX - sx;
      sx = null;
      if (Math.abs(d) > 50) { swiped = true; paint(at + (d < 0 ? 1 : -1), d < 0 ? 1 : -1); }
    });
  }

  /* ================================================ service area: map drawn from the towns' coordinates */
  const mapSvg = document.getElementById('mapSvg');
  if (mapSvg) {
    const fig = mapSvg.closest('.map');
    const links = [...document.querySelectorAll('.towns a[data-ll]')];
    const towns = links.map((a) => {
      const [lat, lon] = a.dataset.ll.split(',').map(Number);
      return { a, lat, lon, name: a.querySelector('span').textContent };
    });
    const W = 640, H = 360;
    const lonMin = -98.5, lonMax = -97.28, latMin = 30.16, latMax = 30.76;
    const kx = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
    const sc = Math.min(W / ((lonMax - lonMin) * kx), H / (latMax - latMin));
    const ox = (W - (lonMax - lonMin) * kx * sc) / 2, oy = (H - (latMax - latMin) * sc) / 2;
    const px = (lat, lon) => [ox + (lon - lonMin) * kx * sc, oy + (latMax - lat) * sc];
    const perMile = sc / 69;
    const [hx, hy] = px(towns[0].lat, towns[0].lon);
    // labels sit on the side away from each town's spoke to Hutto (Horseshoe Bay is too near the edge, so below)
    const left = new Set(['Round Rock', 'Georgetown', 'Liberty Hill', 'Spicewood', 'Marble Falls']);
    const below = new Set(['Horseshoe Bay']);
    let html = '', k = 0;

    [15, 30, 45].forEach((mi) => {
      const r = mi * perMile;
      html += `<circle class="ring pop" style="--k:${k++}" cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${r.toFixed(1)}"/>`;
      const a = (150 * Math.PI) / 180;
      html += `<text class="ring-t pop" style="--k:${k}" x="${(hx + r * Math.cos(a)).toFixed(1)}" y="${(hy + r * Math.sin(a) - 4).toFixed(1)}" text-anchor="middle">${mi} MI</text>`;
    });
    const road = (pts, label, lx, ly, anchor) => {
      const d = pts.map(([la, lo], i) => { const [x, y] = px(la, lo); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join('');
      html += `<path class="road pop" style="--k:${k++}" d="${d}"/><text class="road-t pop" style="--k:${k}" x="${lx}" y="${ly}" text-anchor="${anchor}">${label}</text>`;
    };
    road([[30.76, -97.66], [30.6333, -97.676], [30.508, -97.68], [30.40, -97.70], [30.267, -97.742], [30.16, -97.77]], 'I-35', 438, 22, 'start');
    road([[30.508, -97.68], [30.5427, -97.5467], [30.5708, -97.4092], [30.60, -97.28]], 'US 79', 634, 84, 'end');
    towns.forEach((t, i) => {
      if (!i) return;
      const [x, y] = px(t.lat, t.lon);
      html += `<path class="spoke" pathLength="1" style="--k:${i}" data-i="${i}" d="M${hx.toFixed(1)} ${hy.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}"/>`;
    });
    towns.forEach((t, i) => {
      const [x, y] = px(t.lat, t.lon);
      const side = left.has(t.name) ? -1 : 1;
      t.x = x; t.y = y;
      html += `<g class="pt pop${i ? '' : ' hq'}" style="--k:${k++}" data-i="${i}">`;
      if (!i) html += `<circle class="pulse" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/><circle class="pulse" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`;
      html += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i ? 4.5 : 6}"/>`;
      html += below.has(t.name)
        ? `<text x="${x.toFixed(1)}" y="${(y + 20).toFixed(1)}" text-anchor="middle">${t.name.toUpperCase()}</text></g>`
        : `<text x="${(x + side * 10).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${side < 0 ? 'end' : 'start'}">${t.name.toUpperCase()}</text></g>`;
    });
    mapSvg.innerHTML = html;

    const pts = [...mapSvg.querySelectorAll('.pt')];
    const spokes = [...mapSvg.querySelectorAll('.spoke')];
    const hooks = [];
    let sticky = -1;                                  // a town tapped on the real map stays highlighted
    const focusTown = (i) => {
      pts.forEach((p) => p.classList.toggle('on', +p.dataset.i === i));
      spokes.forEach((s) => s.classList.toggle('on', +s.dataset.i === i));
      links.forEach((a, n) => a.classList.toggle('on', n === i));
      hooks.forEach((h) => h(i));
    };
    links.forEach((a, i) => {
      // a town link opens the planner with that town already picked
      a.addEventListener('click', () => {
        const sel = document.getElementById('town');
        if (!sel || !a.dataset.town) return;
        sel.value = a.dataset.town;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      a.addEventListener('pointerenter', () => focusTown(i));
      a.addEventListener('focus', () => focusTown(i));
      a.addEventListener('pointerleave', () => focusTown(sticky));
      a.addEventListener('blur', () => focusTown(sticky));
    });
    pts.forEach((p) => {
      p.addEventListener('pointerenter', () => focusTown(+p.dataset.i));
      p.addEventListener('pointerleave', () => focusTown(sticky));
    });
    if (calm) fig.classList.add('in'); else once(fig, () => fig.classList.add('in'), '0px 0px -10% 0px');

    /* ---- the real map: Leaflet with OpenStreetMap tiles, loaded when the section nears the screen.
       The same lines run from Hutto to each town, every town is labelled with its name and miles, and the rings
       are true to scale. If the library or the tiles can't load, the drawing above simply stays. */
    const box = fig.querySelector('.map__real');
    const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
    const load = (tag, attrs) => new Promise((ok, fail) => {
      const el = Object.assign(document.createElement(tag), attrs);
      el.onload = ok;
      el.onerror = fail;
      document.head.append(el);
    });
    if (box) once(fig, () => {
      Promise.all([load('link', { rel: 'stylesheet', href: LEAFLET + 'leaflet.min.css' }), load('script', { src: LEAFLET + 'leaflet.min.js' })])
        .then(() => { try { realMap(window.L); } catch (err) { /* keep the drawing */ } })
        .catch(() => {});
    }, '700px 0px');

    function realMap(L) {
      if (!L) return;
      const touch = matchMedia('(pointer: coarse)').matches;
      // one finger keeps scrolling the page on phones; the wheel keeps scrolling it everywhere
      const map = L.map(box, {
        zoomControl: false, scrollWheelZoom: false, dragging: !touch, touchZoom: false, tap: false, keyboard: false,
        boxZoom: false, zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 7, maxZoom: 13,
      });
      map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
      // frame every town first (Leaflet needs a view before layers), leaving room for the labels at the edges
      const bounds = L.latLngBounds(towns.map((t) => [t.lat, t.lon]));
      const fit = () => {
        const narrow = box.clientWidth < 640;
        map.fitBounds(bounds, { paddingTopLeft: narrow ? [24, 44] : [90, 64], paddingBottomRight: narrow ? [24, 30] : [140, 52], animate: false });
      };
      fit();
      L.control.zoom({ position: 'topright' }).addTo(map);
      // OpenStreetMap's own tiles: free for a site like this with the credit shown (a busy launch should move to a tile plan)
      const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 13,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const hq = towns[0];
      const rad = Math.PI / 180;
      const kx = Math.cos(hq.lat * rad);
      // a point some miles from Hutto along a compass bearing
      const from = (mi, deg) => [hq.lat + (mi / 69) * Math.cos(deg * rad), hq.lon + ((mi / 69) * Math.sin(deg * rad)) / kx];
      [15, 30, 45].forEach((mi) => {
        L.circle([hq.lat, hq.lon], { radius: mi * 1609.34, className: 'map-ring', interactive: false, fill: false }).addTo(map);
        L.marker(from(mi, 250), { icon: L.divIcon({ className: 'map-ringlabel', html: `<span>${mi} MI</span>`, iconSize: [0, 0] }), interactive: false, keyboard: false }).addTo(map);
      });

      // the line from Hutto to a town: the same direction as the drawing, with a gentle curve
      const arc = (a, b) => {
        const ax = a.lon * kx, ay = a.lat, bx = b.lon * kx, by = b.lat;
        const cx = (ax + bx) / 2 - (by - ay) * 0.12, cy = (ay + by) / 2 + (bx - ax) * 0.12;
        const out = [];
        for (let n = 0; n <= 40; n++) {
          const t = n / 40, u = 1 - t;
          out.push([u * u * ay + 2 * u * t * cy + t * t * by, (u * u * ax + 2 * u * t * cx + t * t * bx) / kx]);
        }
        return out;
      };
      const routes = [], flows = [], pins = [];
      towns.forEach((t, i) => {
        if (!i) return;
        const pts = arc(hq, t);
        const line = L.polyline(pts, { className: 'map-route', interactive: false, smoothFactor: 0 }).addTo(map);
        const flow = L.polyline(pts, { className: 'map-flow', interactive: false, smoothFactor: 0 }).addTo(map);
        routes[i] = line.getElement();
        routes[i].setAttribute('pathLength', '1');
        routes[i].style.setProperty('--k', i);
        flows[i] = flow.getElement();
      });

      // labels sit on the side with the most room (checked at desktop and phone widths)
      const SIDE = { Hutto: 't', Taylor: 'r', 'Round Rock': 'l', Georgetown: 't', Austin: 'r', 'Liberty Hill': 't', Spicewood: 'r', 'Marble Falls': 't', 'Horseshoe Bay': 'b' };
      const PHONE = { Hutto: 't', Taylor: 'l', 'Round Rock': 'b', Georgetown: 'l', Austin: 'r', 'Liberty Hill': 'r', Spicewood: 'r', 'Marble Falls': 'r', 'Horseshoe Bay': 'r' };
      towns.forEach((t, i) => {
        const miles = (t.a.querySelector('small') || {}).textContent || '';
        const tag = `<span class="tag"><b>${t.name}</b><small>${miles}</small></span>`;
        const html = i ? `<i></i>${tag}` : `<span class="coin"><img src="img/logo-mark.webp" alt=""></span>${tag}`;
        const m = L.marker([t.lat, t.lon], {
          icon: L.divIcon({ className: `map-pin map-pin--${SIDE[t.name] || 'r'} map-pin--m${PHONE[t.name] || 'r'}${i ? '' : ' map-pin--hq'}`, html, iconSize: [0, 0] }),
          keyboard: false, riseOnHover: true, zIndexOffset: i ? 0 : 1000,
        }).addTo(map);
        pins[i] = m.getElement();
        pins[i].style.setProperty('--k', i);
        if (!i) return;
        m.on('mouseover', () => focusTown(i));
        m.on('mouseout', () => focusTown(sticky));
        m.on('click', () => { sticky = sticky === i ? -1 : i; focusTown(sticky); });
      });
      map.on('click', () => { sticky = -1; focusTown(-1); });
      hooks.push((i) => {
        routes.forEach((p, n) => p && p.classList.toggle('on', n === i));
        flows.forEach((p, n) => p && p.classList.toggle('on', n === i));
        pins.forEach((p, n) => p && p.classList.toggle('on', n === i));
      });

      // a slow tour: each town's line lights up in turn while the map is on screen; pointing at the map or the
      // list (or tapping a town) takes over, and the tour picks up again a few seconds after
      if (!calm && 'IntersectionObserver' in window) {
        let next = 1, timer = 0, visible = false, pausedUntil = 0;
        const tick = () => {
          if (!visible) return;
          if (performance.now() > pausedUntil && sticky < 0) { focusTown(next); next = next % (towns.length - 1) + 1; }
          timer = setTimeout(tick, 2600);
        };
        new IntersectionObserver((e) => {
          visible = e[0].isIntersecting;
          clearTimeout(timer);
          if (visible) timer = setTimeout(tick, 1400); else focusTown(sticky);
        }, { threshold: 0.45 }).observe(box);
        const pause = () => { pausedUntil = performance.now() + 9000; };
        ['pointermove', 'pointerdown'].forEach((t) => box.addEventListener(t, pause, { passive: true }));
        links.forEach((a) => { a.addEventListener('pointerenter', pause); a.addEventListener('focus', pause); });
      }
      if ('ResizeObserver' in window) {
        let w = 0;
        new ResizeObserver(() => { if (box.clientWidth && box.clientWidth !== w) { w = box.clientWidth; map.invalidateSize(false); fit(); } }).observe(box);
      }
      // show the map once its first tiles are in (the drawing stays if they never arrive)
      tiles.once('load', () => requestAnimationFrame(() => fig.classList.add('is-real')));
    }
  }
})();
