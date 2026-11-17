import { readUpload } from '../../../lib/upload';
import { BRANDS } from '../../../lib/brands';

export const dynamic = 'force-dynamic';
// "Send next 30" sends one by one through Meta (~1 s each); the sheet stops itself after ~45 s.
export const maxDuration = 60;

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const feed = () => ({ base: (process.env.SHEET_API_URL || '').trim(), key: (process.env.SHEET_API_KEY || '').trim() });
const okBrand = (b) => BRANDS.some((x) => x.code === b);

async function callSheet(action, fields) {
  const { base, key } = feed();
  if (!base || !key) return { ok: false, message: 'Sample mode: the sheet feed is not connected, nothing was saved or sent.' };
  const url = base + (base.includes('?') ? '&' : '?') + `action=${action}&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields), cache: 'no-store', redirect: 'follow' });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok: false, message: 'The sheet did not answer (HTTP ' + res.status + '). If this keeps happening, deploy the new web-app version in Apps Script.' }; }
}

// POST /api/whatsapp
//   multipart form: brand + file (.csv / .xlsx)  -> numbers added to that brand (consent Yes)
//   JSON {action: 'queue' | 'sendnext', brand}  -> waiting count / send the next 30 (daily cap from the Limits tab)
//   JSON {action: 'brands'}                      -> brand cards (logo, template, waiting, sent today)
//   JSON {action: 'rowstatus', brand, rows}      -> WhatsApp status of those brand-tab rows (upload results table)
// Login is checked by middleware.js; the sheet key stays on the server.
export async function POST(req) {
  try {
    const type = req.headers.get('content-type') || '';
    if (type.includes('multipart/form-data')) {
      const form = await req.formData();
      const brand = String(form.get('brand') || ''), file = form.get('file');
      if (!okBrand(brand)) return json({ ok: false, message: 'Choose a brand.' }, 400);
      if (!file || typeof file.arrayBuffer !== 'function') return json({ ok: false, message: 'Choose a file.' }, 400);
      let parsed;
      try { parsed = readUpload(file.name, await file.arrayBuffer()); } catch (e) { return json({ ok: false, message: String(e.message || e) }, 400); }
      if (!parsed.items.length) return json({ ok: false, message: 'No phone number column found in the file.' }, 400);
      const out = await callSheet('bulkadd', { brand, rows: parsed.items });
      return json({ ...out, file: { rows: parsed.total, valid: parsed.valid, column: parsed.phoneHeader || `column ${parsed.phoneCol + 1}` } });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || ''), brand = String(body.brand || '');
    if (action === 'brands') return json(await callSheet('brands', {}));
    if (!['queue', 'sendnext', 'rowstatus'].includes(action)) return json({ ok: false, message: 'Unknown action.' }, 400);
    if (!okBrand(brand)) return json({ ok: false, message: 'Choose a brand.' }, 400);
    if (action === 'rowstatus') {
      const rows = (Array.isArray(body.rows) ? body.rows : []).map(Number).filter((n) => n >= 3).slice(0, 20000);
      return json(await callSheet('rowstatus', { brand, rows }));
    }
    return json(await callSheet(action, { brand, count: 30 }));
  } catch (e) {
    return json({ ok: false, message: String(e.message || e).slice(0, 300) }, 502);
  }
}
