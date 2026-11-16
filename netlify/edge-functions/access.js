// Access gate: runs on Netlify's edge before every request, so nothing on the site (pages, scripts,
// frames, photos) is sent to a browser that hasn't been approved.
//
//   visitor  -> sees the "Request access" page, sends name + email
//   owner    -> opens /_access/admin, enters the admin key, approves / denies / revokes
//   visitor  -> the waiting page lets them in by itself once approved
//
// Requests are kept in Netlify Blobs (store "access"). Needs two environment variables on the site:
//   ACCESS_ADMIN_KEY  the password for /_access/admin
//   ACCESS_SECRET     signs the session cookie
//   GATE_PROXY_KEY    (optional) the key shared with the Vercel copy of the site, see middleware.js
import { getStore } from '@netlify/blobs';

export const config = { path: '/*' };

const OWNER = 'Design Dervish';          // shown on the gate and in the watermark
const WATERMARK = true;                  // small "Private preview for <name>" label on every page
const DEFAULT_DAYS = 7;                  // how long an approval lasts unless the admin picks another length
const SESSION_SECONDS = 600;             // approvals are re-checked this often, so a revoke bites within 10 minutes
const MAX_PENDING_PER_IP = 3;
const MAX_RECORDS = 500;
const PUBLIC = new Set(['/robots.txt', '/img/og.jpg', '/img/logo-mark.webp', '/img/gate-hero.webp', '/img/gate-hero-w.webp', '/img/gate-hero-s.webp', '/img/gate-hero-t.webp', '/img/gate-hero-m.webp']);   // link preview picture and tab icon

const enc = new TextEncoder();
const env = (k) => Netlify.env.get(k) || '';
const store = () => getStore({ name: 'access', consistency: 'strong' });
const now = () => Date.now();

const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const rand = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n) : '');

async function sign(text, secret = env('ACCESS_SECRET')) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
const cookie = (name, value, age) => `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});
const html = (body, status = 200) => new Response(body, {
  status, headers: {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow',
    'x-frame-options': 'DENY', 'referrer-policy': 'same-origin',
  },
});

// ---- sessions -------------------------------------------------------------------------------

async function makeSession(rec, secret) {
  const body = b64u(enc.encode(JSON.stringify({ id: rec.id, n: rec.name, exp: now() + SESSION_SECONDS * 1000 })));
  return `${body}.${await sign(body, secret)}`;
}
async function readSession(value) {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig || !same(sig, await sign(body))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(unb64u(body)));
    return s.exp > now() ? s : null;
  } catch { return null; }
}

// state of a stored request right now
function stateOf(rec) {
  if (!rec) return 'none';
  if (rec.status === 'approved' && rec.expiresAt && rec.expiresAt < now()) return 'expired';
  return rec.status;   // pending | approved | denied | revoked
}

// the visitor's own request, from the long-lived cookie "id.secret"
async function recordFromCookie(value) {
  if (!value) return null;
  const [id, secret] = value.split('.');
  if (!id || !secret || !/^[\w-]{6,40}$/.test(id)) return null;
  const rec = await store().get(`req/${id}`, { type: 'json' });
  return rec && same(rec.secret, secret) ? rec : null;
}

// The Vercel copy of the site (middleware.js) sends its /_access/ calls here, so both addresses share one
// list of approvals. It has its own key (GATE_PROXY_KEY, set on both sites) and proves itself with a header signed
// with it; only then are the visitor details it passes on trusted. Its sessions are signed with that key too, so
// the main signing secret never leaves Netlify.
async function viaProxy(req) {
  const key = env('GATE_PROXY_KEY');
  return !!key && same(req.headers.get('x-gate-proxy') || '', await sign('proxy', key));
}
async function visitor(req, context) {
  if (await viaProxy(req)) {
    return { ip: clip(req.headers.get('x-gate-ip') || '', 60), country: clip(req.headers.get('x-gate-country') || '', 60), city: clip(req.headers.get('x-gate-city') || '', 80) };
  }
  return { ip: context.ip || '', country: (context.geo && context.geo.country && context.geo.country.name) || '', city: (context.geo && context.geo.city) || '' };
}

// ---- the gate -------------------------------------------------------------------------------

export default async function handler(req, context) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (!env('ACCESS_SECRET') || !env('ACCESS_ADMIN_KEY')) return new Response('Access gate is not configured.', { status: 503 });
  if (PUBLIC.has(path)) return context.next();
  if (path === '/access-form.html' && req.method === 'POST') return context.next();   // Netlify Forms: emails the owner
  if (path.startsWith('/_access/')) return api(req, url, context);

  const jar = cookies(req);
  let session = await readSession(jar.aa_s);
  let fresh = null;

  if (!session) {
    const rec = await recordFromCookie(jar.aa_req);
    if (stateOf(rec) === 'approved') {
      fresh = await makeSession(rec);
      session = { id: rec.id, n: rec.name };
      if ((req.headers.get('sec-fetch-dest') || '') === 'document' || (req.headers.get('accept') || '').includes('text/html')) {
        rec.visits = (rec.visits || 0) + 1;
        rec.lastSeen = now();
        context.waitUntil(store().setJSON(`req/${rec.id}`, rec).catch(() => {}));
      }
    }
  }

  if (!session) {
    const wantsPage = req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html');
    return wantsPage ? html(GATE, 401) : new Response('Private preview. Access is by approval only.', {
      status: 401, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const res = await context.next();
  const type = res.headers.get('content-type') || '';
  let out;
  if (res.status === 200 && type.includes('text/html')) {
    // every page is stamped with who it was served to: a visible label and a hidden note in the source
    let text = await res.text();
    const who = esc(session.n || 'guest');
    const stamp = `<!-- Private preview. Served to ${who} (ref ${esc(session.id)}). (c) ${OWNER}. Not licensed for reuse. -->`;
    text = text.replace(/<head[^>]*>/i, (m) => `${m}\n${stamp}`);
    if (WATERMARK) text = text.replace(/<\/body>/i, `${LABEL.replace('{who}', who)}</body>`);
    out = new Response(text, res);
    out.headers.delete('content-length');
    out.headers.delete('etag');
    out.headers.set('cache-control', 'private, no-store');
  } else {
    out = new Response(res.body, res);
    if (!/^\/(frames|img)\//.test(path)) out.headers.set('cache-control', 'private, no-cache');
  }
  if (fresh) out.headers.append('set-cookie', cookie('aa_s', fresh, SESSION_SECONDS));
  return out;
}

// ---- /_access/* -----------------------------------------------------------------------------

async function api(req, url, context) {
  const path = url.pathname;
  const jar = cookies(req);

  // the waiting page polls this; once approved it gets its session cookie here
  if (path === '/_access/status' && req.method === 'GET') {
    const rec = await recordFromCookie(jar.aa_req);
    const state = stateOf(rec);
    if (state !== 'approved') return json({ state });
    if (url.searchParams.get('visit')) {   // a page view on the Vercel copy
      rec.visits = (rec.visits || 0) + 1;
      rec.lastSeen = now();
      context.waitUntil(store().setJSON(`req/${rec.id}`, rec).catch(() => {}));
    }
    const secret = (await viaProxy(req)) ? env('GATE_PROXY_KEY') : undefined;
    return json({ state }, 200, { 'set-cookie': cookie('aa_s', await makeSession(rec, secret), SESSION_SECONDS) });
  }

  // the "Request access" page itself, for the Vercel copy to show
  if (path === '/_access/gate' && req.method === 'GET') return html(GATE, 401);

  if (path === '/_access/request' && req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
    const name = clip(body.name, 80), email = clip(body.email, 120).toLowerCase();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please enter your name and a valid email.' }, 400);
    const { ip, country, city } = await visitor(req, context);
    const s = store();
    const { blobs } = await s.list({ prefix: 'req/' });
    if (blobs.length >= MAX_RECORDS) return json({ error: 'Requests are closed right now.' }, 429);
    const all = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })));
    if (all.filter((r) => r && r.status === 'pending' && r.ip === ip).length >= MAX_PENDING_PER_IP) {
      return json({ error: 'You already have a request waiting.' }, 429);
    }
    const rec = {
      id: rand(9), secret: rand(24), status: 'pending', name, email,
      company: clip(body.company, 120), note: clip(body.note, 400),
      ip, country, city,
      createdAt: now(), visits: 0,
    };
    await s.setJSON(`req/${rec.id}`, rec);
    return json({ state: 'pending' }, 200, { 'set-cookie': cookie('aa_req', `${rec.id}.${rec.secret}`, 31536000) });
  }

  // personal link made by the admin: /_access/invite/<id>.<secret>
  if (path.startsWith('/_access/invite/') && req.method === 'GET') {
    const token = path.slice('/_access/invite/'.length);
    const rec = await recordFromCookie(token);
    if (stateOf(rec) !== 'approved') return html(GATE, 401);
    return new Response(null, { status: 302, headers: { location: '/', 'cache-control': 'no-store', 'set-cookie': cookie('aa_req', token, 31536000) } });
  }

  if (path === '/_access/admin' && req.method === 'GET') return html(ADMIN);

  if (path.startsWith('/_access/admin/')) {
    if (!same(req.headers.get('x-admin-key') || '', env('ACCESS_ADMIN_KEY'))) {
      await new Promise((r) => setTimeout(r, 400));   // slows guessing
      return json({ error: 'Wrong key' }, 401);
    }
    const s = store();

    if (path === '/_access/admin/list' && req.method === 'GET') {
      const { blobs } = await s.list({ prefix: 'req/' });
      const all = (await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })))).filter(Boolean);
      all.sort((a, b) => b.createdAt - a.createdAt);
      return json({ now: now(), records: all.map(({ secret, ...r }) => ({ ...r, state: stateOf(r) })) });
    }

    if (req.method !== 'POST') return json({ error: 'not found' }, 404);
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
    const days = Math.min(Math.max(Number(body.days) || DEFAULT_DAYS, 1), 365);

    if (path === '/_access/admin/invite') {
      const name = clip(body.name, 80);
      if (name.length < 2) return json({ error: 'Name needed' }, 400);
      const rec = {
        id: rand(9), secret: rand(24), status: 'approved', name, email: clip(body.email, 120).toLowerCase(),
        company: '', note: 'Invited by admin', invited: true, createdAt: now(), approvedAt: now(),
        expiresAt: now() + days * 86400000, visits: 0,
      };
      await s.setJSON(`req/${rec.id}`, rec);
      return json({ token: `${rec.id}.${rec.secret}` });
    }

    if (path === '/_access/admin/act') {
      const id = clip(body.id, 40);
      if (!/^[\w-]{6,40}$/.test(id)) return json({ error: 'bad id' }, 400);
      const rec = await s.get(`req/${id}`, { type: 'json' });
      if (!rec) return json({ error: 'not found' }, 404);
      if (body.action === 'delete') { await s.delete(`req/${id}`); return json({ ok: true }); }
      if (body.action === 'approve') { rec.status = 'approved'; rec.approvedAt = now(); rec.expiresAt = now() + days * 86400000; }
      else if (body.action === 'deny') rec.status = 'denied';
      else if (body.action === 'revoke') rec.status = 'revoked';
      else return json({ error: 'bad action' }, 400);
      await s.setJSON(`req/${id}`, rec);
      return json({ ok: true });
    }
  }

  return json({ error: 'not found' }, 404);
}

// ---- pages ----------------------------------------------------------------------------------

const LABEL = '<div aria-hidden="true" style="position:fixed;left:10px;bottom:10px;z-index:2147483000;pointer-events:none;'
  + 'font:500 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.02em;color:rgba(255,255,255,.82);background:rgba(0,11,34,.55);'
  + 'padding:6px 10px;border-radius:999px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)">'
  + `Private preview for {who} &middot; &copy; ${OWNER}</div>`;

const BASE_CSS = `
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{background:#000b22;color:#f3efe6;font:400 16px/1.55 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
h1{font:600 clamp(28px,5vw,40px)/1.1 'Inter Tight',Inter,system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 12px}
em{font-family:'Instrument Serif',Georgia,serif;font-weight:400;color:#e4cf9f}
p{margin:0 0 14px;color:rgba(243,239,230,.74)}
label{display:block;font-size:13px;font-weight:500;color:rgba(243,239,230,.8);margin:14px 0 6px}
input,textarea,select{width:100%;font:inherit;color:#f3efe6;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px 14px;outline:none}
input:focus,textarea:focus,select:focus{border-color:#c9a96e;box-shadow:0 0 0 3px rgba(201,169,110,.25)}
textarea{resize:vertical;min-height:72px}
button{font:600 15px/1 Inter,system-ui,sans-serif;border:0;border-radius:999px;padding:14px 22px;cursor:pointer;background:#c9a96e;color:#001233}
button:hover{background:#e4cf9f}button:disabled{opacity:.55;cursor:default}
button:focus-visible,a:focus-visible{outline:2px solid #e4cf9f;outline-offset:3px}
.tag{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#c9a96e;margin-bottom:18px}
.err{color:#ffb4a8;font-size:14px;min-height:20px;margin:10px 0 0}
`;

const GATE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#000b22">
<title>Private preview</title>
<link rel="icon" href="/img/logo-mark.webp">
<meta property="og:title" content="Private preview"><meta property="og:description" content="This website concept is shared by invitation. Request access to view it.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=Inter+Tight:wght@500;600&display=swap">
<style>${BASE_CSS}
.hero{position:fixed;inset:0;z-index:0;cursor:pointer;background:#000b22}
.hero img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top}
.cue{position:fixed;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1;display:flex;align-items:center;gap:10px;white-space:nowrap;padding:12px 18px;font-size:14px;color:#f3efe6;background:rgba(0,11,34,.78);border:1px solid rgba(255,255,255,.28);box-shadow:0 10px 30px rgba(0,0,0,.35);transition:opacity .25s}
.cue:hover{background:rgba(0,11,34,.92)}.cue svg{animation:nudge 1.6s ease-in-out infinite}@keyframes nudge{50%{transform:translateY(4px)}}
.cue.off{opacity:0;pointer-events:none}
.gap{height:100vh;height:100svh}
.sheet{position:relative;z-index:2;min-height:100vh;min-height:100svh;display:grid;align-content:center;justify-items:center;gap:clamp(26px,5vh,44px);padding:clamp(48px,9vh,96px) 16px;background:rgba(0,11,34,.975);border-top:1px solid rgba(255,255,255,.14);box-shadow:0 -30px 80px rgba(0,0,0,.5)}
.pitch{text-align:center;max-width:640px}.pitch h1{font-size:clamp(36px,7vw,62px);margin-bottom:14px}.pitch p{font-size:clamp(16px,2.2vw,18px);margin:0}
main{width:100%;max-width:500px;background:#f6f1e6;color:#001233;border-radius:6px;padding:9px;box-shadow:0 40px 90px rgba(0,0,0,.55)}
.frame{border:1px solid #c9a96e;outline:1px solid rgba(201,169,110,.5);outline-offset:-6px;padding:clamp(30px,6vw,46px) clamp(22px,5vw,42px) clamp(24px,5vw,34px);text-align:center}
.kicker{font-size:11.5px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:#7a5f2a;margin:0 -.32em 0 0}
.rule{display:flex;align-items:center;gap:12px;max-width:210px;margin:14px auto 18px}.rule::before,.rule::after{content:'';flex:1;height:1px;background:#c9a96e}.rule i{width:6px;height:6px;background:#c9a96e;transform:rotate(45deg)}
main h1{font:400 clamp(32px,6.4vw,44px)/1.06 'Instrument Serif',Georgia,serif;letter-spacing:0;color:#001233;margin:0 0 10px}main h1 em{color:#7a5f2a;font-style:italic}
main p{color:rgba(0,18,51,.74)}
main form{text-align:left;margin-top:20px}
main label{font-size:11.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:rgba(0,18,51,.68);margin:18px 0 2px}main label span{text-transform:none;letter-spacing:0;font-weight:400}
main input,main textarea{color:#001233;background:transparent;border:0;border-bottom:1px solid rgba(0,18,51,.32);border-radius:0;padding:8px 2px}
main input:focus,main textarea:focus{border-color:#7a5f2a;box-shadow:0 1px 0 #7a5f2a}
main button{background:#001233;color:#f6f1e6;letter-spacing:.03em}main button:hover{background:#0f2552}main button:focus-visible{outline-color:#7a5f2a}
main .err{color:#a3271a}
.lock{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:#001233;box-shadow:0 0 0 3px #f6f1e6,0 0 0 4px #c9a96e;margin:0 auto 16px}
.row{display:grid;gap:0 12px;grid-template-columns:1fr 1fr}@media(max-width:480px){.row{grid-template-columns:1fr}}
form button{width:100%;margin-top:26px}
.foot{font-size:12.5px;color:rgba(0,18,51,.55);margin:24px 0 0;text-align:center}
.dots::after{content:'';animation:d 1.4s steps(4) infinite}@keyframes d{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}
@media(prefers-reduced-motion:reduce){.dots::after{animation:none;content:'...'}.cue svg{animation:none}}
[hidden]{display:none!important}
</style></head><body>
<div class="hero" id="hero"><picture><source media="(max-width:700px) and (orientation:portrait)" srcset="/img/gate-hero-m.webp"><source media="(orientation:portrait)" srcset="/img/gate-hero-t.webp"><source media="(min-aspect-ratio:19/10)" srcset="/img/gate-hero-w.webp"><source media="(max-aspect-ratio:33/20)" srcset="/img/gate-hero-s.webp"><img src="/img/gate-hero.webp" width="1920" height="1080" alt="Preview of the home page of this website concept" draggable="false"></picture></div>
<button class="cue" id="cue" type="button">Want the full preview? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>
<div class="gap"></div>
<div class="sheet" id="sheet">
<div class="pitch">
  <span class="tag">Private preview</span>
  <h1>Want the <em>full preview?</em></h1>
  <p>That was the first screen. The complete concept, with every page and the scroll-to-build animation, is shared by invitation only.</p>
</div>
<main><div class="frame">
  <div class="lock" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e4cf9f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></div>
  <p class="kicker">Invitation</p>
  <div class="rule" aria-hidden="true"><i></i></div>

  <section id="ask" hidden>
    <h1>Request your <em>invitation</em></h1>
    <p>Tell us who you are. Once your request is approved, the full preview opens on this device.</p>
    <form id="f" novalidate>
      <div class="row">
        <div><label for="name">Your name</label><input id="name" name="name" autocomplete="name" maxlength="80" required></div>
        <div><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" maxlength="120" required></div>
      </div>
      <label for="company">Company <span>(optional)</span></label><input id="company" name="company" autocomplete="organization" maxlength="120">
      <label for="note">Why you'd like to see it <span>(optional)</span></label><textarea id="note" name="note" maxlength="400"></textarea>
      <button id="go" type="submit">Request my invitation</button>
      <p class="err" id="err" role="alert"></p>
    </form>
  </section>

  <section id="wait" hidden>
    <h1>Request sent<span class="dots"></span></h1>
    <p>Thanks. Your request is waiting for approval. Keep this page open, or come back later on this same device and browser: it opens by itself once you're approved.</p>
  </section>

  <section id="no" hidden>
    <h1 id="noTitle">Access isn't available</h1>
    <p id="noText">This preview isn't open to you right now. If you think that's a mistake, contact the person who shared the link.</p>
  </section>

  <p class="foot">This demo preview belongs to the owner who created it.</p>
</div></main>
</div>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); }, timer, first = true;
  function down(smooth) { $('sheet').scrollIntoView({ behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' }); }
  $('hero').addEventListener('click', function () { down(true); }); $('cue').addEventListener('click', function () { down(true); });
  addEventListener('scroll', function () { $('cue').classList.toggle('off', scrollY > 40); }, { passive: true });
  function show(id) { ['ask', 'wait', 'no'].forEach(function (s) { $(s).hidden = s !== id; }); }
  function apply(state) {
    if (state === 'approved') { location.reload(); return; }
    if (first && state && state !== 'none') down(false);   // returning visitor: straight to their status
    first = false;
    if (state === 'pending') { show('wait'); clearTimeout(timer); timer = setTimeout(check, 6000); return; }
    if (state === 'expired') { $('noTitle').textContent = 'Your access has ended'; $('noText').textContent = 'Your preview period is over. Contact the person who shared the link to open it again.'; show('no'); return; }
    if (state === 'denied' || state === 'revoked') { show('no'); return; }
    show('ask');
  }
  function check() {
    fetch('/_access/status', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (d) { apply(d.state); }).catch(function () { timer = setTimeout(check, 10000); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('wait').hidden) check(); });
  $('f').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = { name: $('name').value, email: $('email').value, company: $('company').value, note: $('note').value };
    $('err').textContent = ''; $('go').disabled = true;
    fetch('/_access/request', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (r) {
        $('go').disabled = false;
        if (!r.ok) { $('err').textContent = r.d.error || 'Something went wrong. Please try again.'; return; }
        // tell the owner by email (Netlify Forms); the request itself is already saved
        var p = new URLSearchParams(data); p.set('form-name', 'access-request'); p.set('review', location.origin + '/_access/admin');
        fetch('/access-form.html', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: p.toString() }).catch(function () {});
        apply('pending');
      })
      .catch(function () { $('go').disabled = false; $('err').textContent = 'Could not reach the server. Please try again.'; });
  });
  check();
})();
</script>
</body></html>`;

const ADMIN = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Access admin</title>
<style>${BASE_CSS}
body{padding:28px 16px 60px}
.wrap{max-width:980px;margin:0 auto}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:22px}
h1{margin:0;font-size:26px}h2{font:600 15px/1.2 Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#c9a96e;margin:30px 0 12px}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:16px 18px;margin-bottom:10px;display:grid;gap:10px 18px;grid-template-columns:1fr auto;align-items:center}
@media(max-width:640px){.card{grid-template-columns:1fr}}
.who{font-weight:600;font-size:16px;overflow-wrap:anywhere}.meta{font-size:13px;color:rgba(243,239,230,.62);overflow-wrap:anywhere}
.note{font-size:14px;color:rgba(243,239,230,.8);margin-top:4px;overflow-wrap:anywhere}
.acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.acts select{width:auto;padding:9px 10px;border-radius:999px;font-size:13px}
button{padding:10px 16px;font-size:13.5px}
button.ghost{background:transparent;color:#f3efe6;border:1px solid rgba(255,255,255,.22)}button.ghost:hover{background:rgba(255,255,255,.08)}
button.bad{background:transparent;color:#ffb4a8;border:1px solid rgba(255,180,168,.4)}button.bad:hover{background:rgba(255,180,168,.1)}
.pill{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:999px;margin-left:8px;vertical-align:middle}
.pending{background:rgba(201,169,110,.2);color:#e4cf9f}.approved{background:rgba(120,200,150,.18);color:#a6e3bd}
.denied,.revoked,.expired{background:rgba(255,180,168,.14);color:#ffb4a8}
.empty{color:rgba(243,239,230,.5);font-size:14px;margin:0}
#login{max-width:380px;margin:12vh auto 0}#login button{width:100%;margin-top:16px}
.inv{display:grid;gap:10px;grid-template-columns:1fr 1fr auto auto;align-items:end}@media(max-width:720px){.inv{grid-template-columns:1fr}}
.inv label{margin-top:0}.inv select{border-radius:12px}
#link{margin-top:12px;font-size:14px;overflow-wrap:anywhere}#link code{color:#e4cf9f}
[hidden]{display:none!important}
</style></head><body>
<div id="login" hidden>
  <span class="tag">Access admin</span><h1>Enter your admin key</h1>
  <form id="lf"><label for="key">Admin key</label><input id="key" type="password" autocomplete="current-password" required>
  <button type="submit">Open</button><p class="err" id="lerr" role="alert"></p></form>
</div>
<div class="wrap" id="app" hidden>
  <header><h1>Who can see the preview</h1><div class="acts"><button class="ghost" id="refresh">Refresh</button><button class="ghost" id="out">Lock</button></div></header>
  <h2>Waiting for you</h2><div id="pending"></div>
  <h2>Has access</h2><div id="approved"></div>
  <h2>Invite someone directly</h2>
  <form class="inv" id="inv">
    <div><label for="iname">Name</label><input id="iname" maxlength="80" required></div>
    <div><label for="iemail">Email (optional)</label><input id="iemail" type="email" maxlength="120"></div>
    <div><label for="idays">Lasts</label><select id="idays"><option value="1">1 day</option><option value="3">3 days</option><option value="7" selected>7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div>
    <button type="submit">Create link</button>
  </form>
  <div id="link"></div>
  <h2>Closed</h2><div id="closed"></div>
</div>
<script>
(function () {
  var $ = function (id) { return document.getElementById(id); }, key = '';
  try { key = sessionStorage.getItem('aa_key') || ''; } catch (e) {}
  function call(path, body) {
    return fetch('/_access/admin/' + path, { method: body ? 'POST' : 'GET', cache: 'no-store',
      headers: body ? { 'x-admin-key': key, 'content-type': 'application/json' } : { 'x-admin-key': key }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { if (r.status === 401) throw new Error('key'); return r.json(); });
  }
  function when(t) { return t ? new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(label, cls, fn) { var b = el('button', cls, label); b.type = 'button'; b.onclick = fn; return b; }
  function days() { var s = el('select'); [[1, '1 day'], [3, '3 days'], [7, '7 days'], [14, '14 days'], [30, '30 days']].forEach(function (o) { var p = el('option', '', o[1]); p.value = o[0]; if (o[0] === 7) p.selected = true; s.appendChild(p); }); s.setAttribute('aria-label', 'Access length'); return s; }
  function act(id, action, d) { call('act', { id: id, action: action, days: d }).then(load).catch(fail); }
  function card(r) {
    var c = el('div', 'card'), info = el('div'), who = el('div', 'who', r.name), acts = el('div', 'acts');
    who.appendChild(el('span', 'pill ' + r.state, r.state));
    info.appendChild(who);
    info.appendChild(el('div', 'meta', [r.email, r.company, [r.city, r.country].filter(Boolean).join(', '), 'asked ' + when(r.createdAt)].filter(Boolean).join(' · ')));
    if (r.state === 'approved' || r.state === 'expired') info.appendChild(el('div', 'meta', (r.state === 'expired' ? 'ended ' : 'until ') + when(r.expiresAt) + ' · ' + (r.visits || 0) + ' visit' + (r.visits === 1 ? '' : 's') + (r.lastSeen ? ' · last seen ' + when(r.lastSeen) : '')));
    if (r.note) info.appendChild(el('div', 'note', r.note));
    if (r.state === 'approved') acts.appendChild(btn('Revoke', 'bad', function () { act(r.id, 'revoke'); }));
    else {
      var s = days(); acts.appendChild(s);
      acts.appendChild(btn(r.state === 'pending' ? 'Approve' : 'Open again', '', function () { act(r.id, 'approve', Number(s.value)); }));
      if (r.state === 'pending') acts.appendChild(btn('Deny', 'bad', function () { act(r.id, 'deny'); }));
      else acts.appendChild(btn('Delete', 'ghost', function () { act(r.id, 'delete'); }));
    }
    c.appendChild(info); c.appendChild(acts); return c;
  }
  function fill(id, list, empty) { var box = $(id); box.textContent = ''; if (!list.length) box.appendChild(el('p', 'empty', empty)); list.forEach(function (r) { box.appendChild(card(r)); }); }
  function load() {
    return call('list').then(function (d) {
      $('login').hidden = true; $('app').hidden = false;
      try { sessionStorage.setItem('aa_key', key); } catch (e) {}
      var n = d.records.filter(function (r) { return r.state === 'pending'; });
      document.title = (n.length ? '(' + n.length + ') ' : '') + 'Access admin';
      fill('pending', n, 'No one is waiting.');
      fill('approved', d.records.filter(function (r) { return r.state === 'approved'; }), 'No one has access.');
      fill('closed', d.records.filter(function (r) { return r.state !== 'pending' && r.state !== 'approved'; }), 'Nothing here.');
    });
  }
  function fail(e) {
    if (e && e.message === 'key') { key = ''; try { sessionStorage.removeItem('aa_key'); } catch (x) {} $('app').hidden = true; $('login').hidden = false; $('lerr').textContent = 'That key was not accepted.'; }
  }
  $('lf').addEventListener('submit', function (e) { e.preventDefault(); key = $('key').value.trim(); $('lerr').textContent = ''; load().catch(fail); });
  $('refresh').onclick = function () { load().catch(fail); };
  $('out').onclick = function () { key = ''; try { sessionStorage.removeItem('aa_key'); } catch (x) {} $('app').hidden = true; $('login').hidden = false; $('key').value = ''; };
  $('inv').addEventListener('submit', function (e) {
    e.preventDefault();
    call('invite', { name: $('iname').value, email: $('iemail').value, days: Number($('idays').value) }).then(function (d) {
      var box = $('link'); box.textContent = '';
      if (d.token) { box.appendChild(document.createTextNode('Personal link (works only for this invite): ')); box.appendChild(el('code', '', location.origin + '/_access/invite/' + d.token)); $('iname').value = ''; $('iemail').value = ''; load(); }
      else box.textContent = d.error || 'Could not create the link.';
    }).catch(fail);
  });
  setInterval(function () { if (key && !document.hidden) load().catch(fail); }, 20000);
  if (key) load().catch(fail); else $('login').hidden = false;
})();
</script>
</body></html>`;
