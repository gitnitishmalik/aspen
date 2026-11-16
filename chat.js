/* Aspen Assistant: a small chat in the bottom-right corner.
   Demo mode (LIVE_AI = false): it answers from the built-in replies below, all taken from
   aspenhomesoftx.com, and calls no AI service. Set LIVE_AI = true once the Netlify function and its
   API key are set up (see README); it then asks /api/chat first and uses these replies as a fallback.
   A plain script, so it also works when index.html is opened straight from the folder. */
(() => {
  'use strict';

  const LIVE_AI = false;
  const ENDPOINT = '/api/chat';
  const PHONE = '(512) 848-5647';
  const STORE = 'aspen-chat';

  const panel = document.getElementById('chat');
  const launcher = document.querySelector('.fab--ai');
  if (!panel || !launcher) return;
  const log = panel.querySelector('.chat__log');
  const form = panel.querySelector('.chat__form');
  const input = panel.querySelector('#chatInput');
  const sendBtn = form.querySelector('button');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const history = [];
  let busy = false;

  /* ------------------------------------------------ built-in replies */
  const KB = [
    { k: ['lot', 'land', 'own a lot', 'build on', 'my property', 'acre', 'site prep', 'excavat'],
      a: 'Bring us your lot and we\'ll handle everything from excavating and site prep to construction and cleanup. Pick one of our floor plans and customize it, or design new plans with our in-house architect.' },
    { k: ['area', 'areas', 'town', 'towns', 'where', 'serve', 'location', 'located', 'hutto', 'round rock', 'georgetown', 'liberty hill', 'austin', 'taylor', 'marble falls', 'horseshoe', 'spicewood', 'near me'],
      a: 'We build across Central Texas: Hutto, Round Rock, Georgetown, Liberty Hill, Austin, Taylor, Marble Falls, Horseshoe Bay and Spicewood. Our office is in Hutto.' },
    { k: ['barndo', 'barndominium', 'barn', 'shop'],
      a: 'Yes, we build barndominiums that blend style and strength, designed with our in-house architect and built on your lot.' },
    { k: ['farmhouse', 'board and batten'],
      a: 'Luxury farmhouses are one of our specialties: built to last and designed with our in-house architect.' },
    { k: ['remodel', 'renovat', 'kitchen', 'bath', 'bathroom', 'porch', 'patio', 'addition', 'flooring'],
      a: 'We remodel kitchens and bathrooms, add porches and patios, and build home additions. A quick call is the best way to scope it: ' + PHONE + '.' },
    { k: ['architect', 'design', 'floor plan', 'floorplan', 'plans', 'blueprint', 'draw'],
      a: 'We have an in-house architect. Choose one of our floor plans and customize it, or create new plans together from scratch.' },
    { k: ['price', 'cost', 'how much', 'budget', 'quote', 'estimate', 'per square', 'sq ft', 'afford'],
      a: 'Every home is priced to its plan, size, finishes and lot, so we don\'t quote online. A short call gets you a real number: ' + PHONE + ', or message us on WhatsApp.' },
    { k: ['how long', 'timeline', 'weeks', 'months', 'schedule', 'when can', 'start'],
      a: 'Timing depends on the plan, the lot and permits, so the team sets your schedule on the first call. Call ' + PHONE + ' or message us on WhatsApp.' },
    { k: ['process', 'steps', 'how does it work', 'how it works', 'stages'],
      a: 'It starts with your plan, then site prep and the slab, framing, the roof and walls, your finishes, and finally cleanup and your keys.' },
    { k: ['hour', 'hours', 'open', 'close', 'weekend', 'saturday', 'sunday'],
      a: 'We\'re open Monday to Friday 8:00 AM to 5:00 PM, and Saturday and Sunday 10:00 AM to 3:30 PM.' },
    { k: ['contact', 'phone', 'call', 'email', 'talk', 'person', 'human', 'someone', 'reach', 'whatsapp', 'visit', 'meet'],
      a: 'Happy to connect you with the team: call ' + PHONE + ', tap the green WhatsApp button, or email alan@aspenhomesoftx.com.' },
    { k: ['review', 'reviews', 'rating', 'google'],
      a: 'Our clients mention our attention to detail, the quality of the work and how easy the process felt. Their reviews are on Google and further down this page.' },
    { k: ['warranty', 'financ', 'loan', 'mortgage', 'insurance', 'permit', 'hoa'],
      a: 'That depends on your project, so the team will answer it directly. Call ' + PHONE + '.' },
    { k: ['who are you', 'about', 'family', 'experience', 'company'],
      a: 'Aspen Homes is a family-owned custom home builder in Hutto, Texas, with decades of combined experience.' },
    { k: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'howdy'],
      a: 'Hi! Are you thinking about building a new home, or updating the one you have?' },
    { k: ['thank', 'thanks', 'great', 'awesome', 'perfect'],
      a: 'You\'re welcome! The team is a call or a WhatsApp message away whenever you\'re ready.' },
  ];

  function answer(text) {
    const q = ` ${text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ')} `;
    let best = null, score = 0;
    KB.forEach((item) => {
      const s = item.k.reduce((n, word) => n + (q.includes(word.length < 5 ? ` ${word} ` : word) ? word.length : 0), 0);
      if (s > score) { score = s; best = item; }
    });
    return best ? best.a : 'Good question! The team can answer that best: call ' + PHONE + ' or tap the WhatsApp button.';
  }

  async function ask(text) {
    if (LIVE_AI) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        });
        if (res.ok) { const data = await res.json(); if (data && data.reply) return data.reply; }
      } catch (e) { /* fall through to the built-in replies */ }
    }
    await new Promise((r) => setTimeout(r, calm ? 200 : 650 + Math.random() * 450));   // a natural pause
    return answer(text);
  }

  /* ------------------------------------------------ messages */
  function bubble(role, text) {
    const el = document.createElement('div');
    el.className = `msg msg--${role}`;
    const p = document.createElement('p');
    p.textContent = text;
    el.append(p);
    log.append(el);
    log.scrollTop = log.scrollHeight;
  }
  function typing() {
    const el = document.createElement('div');
    el.className = 'msg msg--assistant msg--typing';
    el.innerHTML = '<p><i></i><i></i><i></i></p>';
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  async function send(text) {
    const t = text.trim().slice(0, 500);
    if (!t || busy) return;
    busy = true;
    sendBtn.disabled = true;
    history.push({ role: 'user', content: t });
    bubble('user', t);
    const dots = typing();
    const reply = await ask(t);
    dots.remove();
    history.push({ role: 'assistant', content: reply });
    bubble('assistant', reply);
    try { sessionStorage.setItem(STORE, JSON.stringify(history.slice(-20))); } catch (e) { /* private mode */ }
    busy = false;
    sendBtn.disabled = false;
  }
  try {
    JSON.parse(sessionStorage.getItem(STORE) || '[]').forEach((m) => {
      if (m && m.content && (m.role === 'user' || m.role === 'assistant')) { history.push(m); bubble(m.role, m.content); }
    });
  } catch (e) { /* nothing saved */ }

  /* ------------------------------------------------ open and close */
  let back = null;
  function open() {
    back = document.activeElement;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));
    launcher.setAttribute('aria-expanded', 'true');
    launcher.setAttribute('aria-label', 'Close the Aspen assistant');
    launcher.classList.add('is-open');
    document.body.classList.add('chat-open');
    if (matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
  }
  function close() {
    panel.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-label', 'Open the Aspen assistant');
    launcher.classList.remove('is-open');
    document.body.classList.remove('chat-open');
    setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 300);
    if (back && back.focus) back.focus({ preventScroll: true });
  }

  launcher.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.querySelector('.chat__close').addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  panel.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => send(b.dataset.ask)));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = '';
    send(v);
  });
})();
