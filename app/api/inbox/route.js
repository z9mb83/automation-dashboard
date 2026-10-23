import { sampleInbox } from '../../../lib/sample';

export const dynamic = 'force-dynamic';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const feed = () => ({ base: (process.env.SHEET_API_URL || '').trim(), key: (process.env.SHEET_API_KEY || '').trim() });
const withQuery = (base, q) => base + (base.includes('?') ? '&' : '?') + q;

async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('The sheet feed did not return data (HTTP ' + res.status + ').'); }
}

// GET /api/inbox            -> all chats and messages
// GET /api/inbox?ver=1      -> just the change stamp (asked every few seconds)
// Login is checked by middleware.js; the sheet key stays on the server.
export async function GET(req) {
  const ver = new URL(req.url).searchParams.get('ver');
  const { base, key } = feed();
  if (!base || !key) { const s = sampleInbox(); return json(ver ? { version: s.version } : { ...s, sample: true }); }
  try {
    const res = await fetch(withQuery(base, `inbox=${ver ? 'ver' : 'all'}&key=${encodeURIComponent(key)}`), { cache: 'no-store', redirect: 'follow' });
    const data = await readJson(res);
    if (data.error) return json({ error: data.error === 'unauthorized' ? 'The sheet key on Vercel does not match.' : data.error }, 502);
    if (!ver && !Array.isArray(data.chats)) return json({ error: 'The sheet feed is an older version without the inbox: deploy the new web-app version in Apps Script.' }, 502);
    return json(data);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 502);
  }
}

// POST /api/inbox  { action: 'add' | 'send' | 'optout', ...fields }
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return json({ ok: false, message: 'Bad request.' }, 400); }
  const action = String(body.action || '');
  if (!['add', 'send', 'optout'].includes(action)) return json({ ok: false, message: 'Unknown action.' }, 400);
  const { base, key } = feed();
  if (!base || !key) return json({ ok: false, message: 'Sample mode: the sheet feed is not connected, nothing was saved or sent.' });
  try {
    const { action: _a, ...fields } = body;
    const res = await fetch(withQuery(base, `action=${action}&key=${encodeURIComponent(key)}`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields), cache: 'no-store', redirect: 'follow',
    });
    return json(await readJson(res));
  } catch (e) {
    return json({ ok: false, message: String(e.message || e).slice(0, 300) }, 502);
  }
}
