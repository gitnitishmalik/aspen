// Aspen Assistant: the website chat posts here (/api/chat) and this calls Claude.
// Needs ANTHROPIC_API_KEY set in the Netlify site's environment variables. Without it the
// function answers 503 and the chat on the page falls back to its built-in answers.
import Anthropic from '@anthropic-ai/sdk';

// Netlify stops synchronous functions after 10 s, so give the API 9 s and don't retry:
// the page has its own fallback answers if this fails.
const client = new Anthropic({ timeout: 9000, maxRetries: 0 });

// Facts only from aspenhomesoftx.com. Keep this text stable between requests so it caches.
const SYSTEM = `You are the Aspen Assistant, the website chat for Aspen Homes, a family-owned custom home builder in Hutto, Texas.

Facts you can rely on (do not add to them):
- Aspen Homes is family-owned, with decades of combined experience. Office: Hutto, TX 78634.
- Services: custom homes; luxury farmhouses; barndominiums; remodeling, including kitchen remodels, bathroom remodels, porch additions and home additions.
- Build-on-your-lot: the client provides the lot and Aspen handles everything from excavating and site prep to construction and cleanup. Aspen can also demolish an existing house and start over with a custom plan.
- Design: Aspen employs an in-house architect. Clients choose one of Aspen's in-house floor plans and customize it, or work with the architect to create new plans from scratch.
- How a build goes: design, site prep and the slab, framing (walls, trusses, sheathing), roof and walls (shingles, siding, windows), finishes (trim, lighting, chosen touches), then cleanup and move-in.
- Service area: Hutto, Round Rock, Georgetown, Liberty Hill, Austin, Taylor, Marble Falls, Horseshoe Bay and Spicewood.
- Phone: (512) 848-5647 or (512) 845-1844. WhatsApp: (512) 848-5647. Email: alan@aspenhomesoftx.com, dusty@aspenhomesoftx.com, andrew@aspenhomesoftx.com.
- Hours: Monday to Friday 8:00 AM to 5:00 PM; Saturday and Sunday 10:00 AM to 3:30 PM.
- Clients' reviews praise their attention to detail, quality of work, professionalism and an easy process. Reviews are on Google.
- On this website, the "Plan your home" section lets a visitor sketch their home in a few steps and send the brief to the team.

How to answer:
- Be warm, clear and brief: two to four short sentences, plain text, no markdown, no lists unless asked.
- Never invent prices, price per square foot, timelines, warranties, financing, permits, materials or availability. If asked, say it depends on the plan, the lot and the finishes, and offer a call with the team or the "Plan your home" brief.
- Don't give legal, financial, engineering or code-compliance advice; suggest talking to the team.
- If the question isn't about Aspen Homes or building and remodeling homes, steer back politely.
- When someone wants a person, a quote or a visit, give the phone number and mention WhatsApp.
- Never ask for payment details, passwords or ID numbers.
- Reply in the visitor's language.`;

const MAX_TURNS = 16;
const MAX_CHARS = 1500;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// Only plain text turns from the page, oldest dropped first, starting with a user turn
function clean(list) {
  if (!Array.isArray(list)) return null;
  const out = list
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }));
  while (out.length && out[0].role !== 'user') out.shift();
  if (!out.length || out[out.length - 1].role !== 'user') return null;
  return out;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
  const messages = clean(body && body.messages);
  if (!messages) return json({ error: 'bad_messages' }, 400);

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2048,                       // replies are meant to be a few sentences
      output_config: { effort: 'low' },       // chat: fast, short answers
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',                   // a declined request is re-run on Anthropic's recommended model
      cache_control: { type: 'ephemeral' },   // caches the stable system prompt + earlier turns
      system: SYSTEM,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return json({ reply: 'I can\'t help with that one here. For anything about your home, the team is happy to talk: call (512) 848-5647 or message us on WhatsApp.' });
    }
    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    if (!reply) return json({ error: 'empty' }, 502);
    return json({ reply });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error('Anthropic key rejected:', error.status);
      return json({ error: 'not_configured' }, 503);
    }
    if (error instanceof Anthropic.BadRequestError) {
      console.error('Bad request to Anthropic:', error.message);
      return json({ error: 'bad_request' }, 400);
    }
    if (error instanceof Anthropic.APIConnectionError) return json({ error: 'unreachable' }, 504);  // includes timeouts
    if (error instanceof Anthropic.APIError) {
      console.error('Anthropic API error:', error.status, error.message);
      return json({ error: 'upstream' }, 502);
    }
    console.error(error);
    return json({ error: 'server' }, 500);
  }
};

export const config = { path: '/api/chat' };
