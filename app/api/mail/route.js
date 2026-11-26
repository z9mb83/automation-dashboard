import { sampleMailThreads } from '../../../lib/sample';
import { maskDeep } from '../../../lib/roles';

export const dynamic = 'force-dynamic';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const feed = () => ({ base: (process.env.SHEET_API_URL || '').trim(), key: (process.env.SHEET_API_KEY || '').trim() });
const withQuery = (base, q) => base + (base.includes('?') ? '&' : '?') + q;

async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('The sheet feed did not return data (HTTP ' + res.status + ').'); }
}

// GET /api/mail -> email reply tracker (Mail Threads tab). Login is checked by middleware.js.
export async function GET(req) {
  const role = req.headers.get('x-dash-role') || '';
  const out = (d) => json(role === 'viewer' ? maskDeep(d) : d);   // viewer: names / emails / subjects masked
  const { base, key } = feed();
  if (!base || !key) return out({ ...sampleMailThreads(), sample: true });
  try {
    const res = await fetch(withQuery(base, `mail=threads&key=${encodeURIComponent(key)}`), { cache: 'no-store', redirect: 'follow' });
    const data = await readJson(res);
    if (data.error) return json({ error: data.error === 'unauthorized' ? 'The sheet key on Vercel does not match.' : data.error }, 502);
    if (!Array.isArray(data.threads)) return json({ error: 'The sheet feed is an older version without email replies: deploy the new web-app version in Apps Script.' }, 502);
    return out(data);
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 502);
  }
}

// POST /api/mail { mailbox, threadId, handled: true|false } -> "Mark handled" / "Undo"
export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return json({ ok: false, message: 'Bad request.' }, 400); }
  if (!body.mailbox || !body.threadId) return json({ ok: false, message: 'Bad request.' }, 400);
  const { base, key } = feed();
  if (!base || !key) return json({ ok: false, message: 'Sample mode: the sheet feed is not connected, nothing was saved.' });
  try {
    const res = await fetch(withQuery(base, `action=mailhandled&key=${encodeURIComponent(key)}`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', redirect: 'follow',
      body: JSON.stringify({ mailbox: String(body.mailbox), threadId: String(body.threadId), handled: body.handled !== false, by: 'Dashboard' }),
    });
    return json(await readJson(res));
  } catch (e) {
    return json({ ok: false, message: String(e.message || e).slice(0, 300) }, 502);
  }
}
