import { SMS_SHEETS, smsTarget, smsUploadBody, smsUrl } from '../../../lib/smssend';
import { readUpload } from '../../../lib/upload';

export const dynamic = 'force-dynamic';
// "Send next 100" runs the sheet's own batch sender: 2 Telinfy calls + a status write, usually 10-30 s.
export const maxDuration = 60;

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function call(t, action, post, body = {}) {
  if (!t.url || !t.key) return { ok: false, notSetUp: true, message: `Not connected yet: add ${t.urlVar} and ${t.keyVar} in Vercel settings.` };
  const res = await fetch(smsUrl(t, action), post
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', redirect: 'follow' }
    : { cache: 'no-store', redirect: 'follow' });
  const text = await res.text();
  try {
    const out = JSON.parse(text);
    if (out.error === 'unauthorized') return { ok: false, message: `The ${t.sheet} sheet refused the key: check ${t.keyVar} in Vercel (sheet menu SMS → Dashboard access key).` };
    return out;
  } catch {
    return { ok: false, message: `The ${t.sheet} sheet did not answer (HTTP ${res.status}). Check ${t.urlVar} (the /exec link) and that the web app access is "Anyone".` };
  }
}

// POST /api/sms-send
//   {action: 'status'}               -> one card per SMS brand (waiting, sent today, live / dry run, sending hours)
//   {action: 'sendnext', brand}      -> send the next 100 SMS for that brand (same rules as the sheet menu)
//   multipart form: brand + file (.csv / .xlsx) -> numbers added below the last row of that brand's OCR sheet
//                                      (already in the sheet / invalid / repeated numbers are skipped; nothing is sent)
// Login is checked by middleware.js; the sheet keys stay on the server.
export async function POST(req) {
  try {
    if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await req.formData();
      const t = smsTarget(String(form.get('brand') || '')), file = form.get('file');
      if (!t) return json({ ok: false, message: 'This brand has no SMS sheet.' }, 400);
      if (!file || typeof file.arrayBuffer !== 'function') return json({ ok: false, message: 'Choose a file.' }, 400);
      let parsed;
      try { parsed = readUpload(file.name, await file.arrayBuffer(), 'whatsapp'); } catch (e) { return json({ ok: false, message: String(e.message || e) }, 400); }
      const up = smsUploadBody(parsed, file.name);
      if (up.error) return json({ ok: false, message: up.error }, 400);
      return json({ ...(await call(t, 'bulkadd', true, up.body)), file: up.file });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    if (action === 'status') {
      const brands = await Promise.all(SMS_SHEETS.map(async (s) => {
        const r = await call(smsTarget(s.code), 'status', false).catch((e) => ({ ok: false, message: String(e.message || e) }));
        return r.ok ? { code: s.code, sheet: s.sheet, ...r.status } : { code: s.code, sheet: s.sheet, error: r.message, notSetUp: !!r.notSetUp };
      }));
      return json({ ok: true, brands });
    }
    if (action === 'sendnext') {
      const t = smsTarget(String(body.brand || ''));
      if (!t) return json({ ok: false, message: 'This brand has no SMS sheet.' }, 400);
      return json(await call(t, 'sendnext', true));
    }
    return json({ ok: false, message: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ ok: false, message: String(e.message || e).slice(0, 300) }, 502);
  }
}
