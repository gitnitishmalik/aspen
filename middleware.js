// Access gate for the Vercel copy of the site. Vercel runs this before every request, so nothing (pages,
// scripts, frames, photos) is sent to a browser that hasn't been approved.
//
// Approvals live in one place: the Netlify site (netlify/edge-functions/access.js). This file checks the
// signed session cookie itself and passes everything under /_access/ (request form, status, admin page)
// through to Netlify, so one admin page covers both addresses.
//
// Needs the environment variable ACCESS_SECRET on the Vercel project, with the same value as on Netlify.

const GATE_ORIGIN = 'https://aspen-homes-concept.netlify.app';
const OWNER = 'Design Dervish';
const WATERMARK = true;                  // small "Private preview for <name>" label on every page
const SESSION_SECONDS = 600;
const PUBLIC = new Set(['/robots.txt', '/img/og.jpg', '/img/logo-mark.webp']);

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sign(text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.ACCESS_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
async function readSession(value) {
  if (!value) return null;
  const [body, sig] = value.split('.');
  if (!body || !sig || !same(sig, await sign(body))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(unb64u(body)));
    return s.exp > Date.now() ? s : null;
  } catch { return null; }
}

const pass = (headers) => new Response(null, { headers: { 'x-middleware-next': '1', ...headers } });   // carry on to the file
const deny = (text, status) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

// headers that tell Netlify this call comes from here, and who the visitor is
async function proxyHeaders(req) {
  return {
    'x-gate-proxy': await sign('proxy'),
    'x-gate-ip': (req.headers.get('x-real-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || '').trim(),
    'x-gate-country': req.headers.get('x-vercel-ip-country') || '',
    'x-gate-city': decodeURIComponent(req.headers.get('x-vercel-ip-city') || ''),
  };
}

// send a request on to the Netlify gate and hand its answer back unchanged (cookies included)
async function toGate(req, path) {
  const headers = await proxyHeaders(req);
  for (const h of ['cookie', 'content-type', 'accept', 'x-admin-key']) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const res = await fetch(GATE_ORIGIN + path, { method: req.method, headers, body: hasBody ? await req.arrayBuffer() : undefined, redirect: 'manual' });
  const out = new Headers();
  for (const h of ['content-type', 'cache-control', 'location', 'x-robots-tag', 'x-frame-options', 'referrer-policy']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  for (const c of res.headers.getSetCookie()) out.append('set-cookie', c);
  return new Response(res.body, { status: res.status, headers: out });
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (!process.env.ACCESS_SECRET) return deny('Access gate is not configured.', 503);
  if (PUBLIC.has(path)) return pass();
  // this middleware fetching a page for itself (see below)
  if (same(req.headers.get('x-gate-internal') || '', await sign('internal'))) return pass();

  try {
    if (path.startsWith('/_access/')) return await toGate(req, path + url.search);
    if (path === '/access-form' || path === '/access-form.html') {
      return req.method === 'POST' ? await toGate(req, '/access-form.html') : deny('Not found', 404);
    }

    const jar = cookies(req);
    const isPage = req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html');
    let session = await readSession(jar.aa_s);
    let fresh = '';

    // no valid session: ask Netlify whether this visitor's request has been approved
    if (!session && jar.aa_req) {
      const res = await fetch(`${GATE_ORIGIN}/_access/status${isPage ? '?visit=1' : ''}`, {
        headers: { ...(await proxyHeaders(req)), cookie: `aa_req=${jar.aa_req}` },
      });
      const set = res.headers.getSetCookie().find((c) => c.startsWith('aa_s='));
      if (res.ok && set) {
        session = await readSession(set.slice(5).split(';')[0]);
        if (session) fresh = set;
      }
    }

    if (!session) {
      if (!isPage) return deny('Private preview. Access is by approval only.', 401);
      return await toGate(new Request(req.url, { headers: { accept: 'text/html' } }), '/_access/gate');
    }

    if (!isPage) return pass(fresh ? { 'set-cookie': fresh } : {});

    // a page: fetch it and stamp it with who it was served to (a visible label and a note in the source)
    const res = await fetch(req.url, { headers: { 'x-gate-internal': await sign('internal'), accept: 'text/html' }, redirect: 'manual' });
    const type = res.headers.get('content-type') || '';
    const headers = new Headers({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
    if (type) headers.set('content-type', type);
    if (res.headers.get('location')) headers.set('location', res.headers.get('location'));
    if (fresh) headers.append('set-cookie', fresh);
    if (res.status !== 200 || !type.includes('text/html')) return new Response(res.body, { status: res.status, headers });
    const who = esc(session.n || 'guest');
    let text = await res.text();
    text = text.replace(/<head[^>]*>/i, (m) => `${m}\n<!-- Private preview. Served to ${who} (ref ${esc(session.id)}). (c) ${OWNER}. Not licensed for reuse. -->`);
    if (WATERMARK) text = text.replace(/<\/body>/i, `${LABEL.replace('{who}', who)}</body>`);
    return new Response(text, { status: 200, headers });
  } catch {
    return deny('The preview is unavailable right now. Please try again in a moment.', 503);   // never fail open
  }
}

const LABEL = '<div aria-hidden="true" style="position:fixed;left:10px;bottom:10px;z-index:2147483000;pointer-events:none;'
  + 'font:500 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.02em;color:rgba(255,255,255,.82);background:rgba(0,11,34,.55);'
  + 'padding:6px 10px;border-radius:999px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)">'
  + `Private preview for {who} &middot; &copy; ${OWNER}</div>`;
