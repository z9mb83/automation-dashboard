import { buildXlsx } from '../../../lib/xlsx';
import { indiaDate, reportFileName, reportParams, reportSheets } from '../../../lib/report';
import { sampleLeads } from '../../../lib/sample';
import { smsFileName, smsParams, smsReportSheets } from '../../../lib/sms';
import { sampleSmsRows, smsRows, telinfyKey } from '../../../lib/telinfy';

export const dynamic = 'force-dynamic';

const fail = (msg, status = 400) => Response.json({ error: msg }, { status, headers: { 'Cache-Control': 'no-store' } });

const xlsx = (sheets, name) => new Response(buildXlsx(sheets), { headers: {
  'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'Content-Disposition': `attachment; filename="${name.replace(/[^\w .-]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  'Cache-Control': 'no-store',
} });

// SMS (OCR sheets, Telinfy): its own report from Telinfy's delivery reports
async function smsReport(q) {
  const today = indiaDate();
  const p = smsParams({ from: q.from || today, to: q.to || q.from || today }, today);
  if (p.error) return fail(p.error);
  const brand = /^(SB|PE|SC|99S|99M)$/.test(q.brand || '') ? q.brand : 'ALL';
  let rows;
  try { rows = telinfyKey() ? await smsRows(p.from, p.to) : sampleSmsRows(p.from, p.to); }
  catch (e) { return fail('Could not read Telinfy reports: ' + String(e.message || e).slice(0, 200), 502); }
  const now = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ');
  return xlsx(smsReportSheets(rows, { ...p, brand }, now), smsFileName({ ...p, brand }));
}

// GET /api/report?type=mail|whatsapp|combined|sms&brand=ALL|SB|...&from=yyyy-mm-dd&to=yyyy-mm-dd  ->  .xlsx download
// (login is checked by middleware.js; the sheet key stays on the server)
export async function GET(req) {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  if (q.type === 'sms') return smsReport(q);
  const p = reportParams(q, indiaDate());
  if (p.error) return fail(p.error);
  const base = (process.env.SHEET_API_URL || '').trim(), key = (process.env.SHEET_API_KEY || '').trim();
  let feed;
  if (!base || !key) feed = sampleLeads();
  else {
    try {
      const url = base + (base.includes('?') ? '&' : '?') + 'report=leads&key=' + encodeURIComponent(key);
      const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
      const text = await res.text();
      try { feed = JSON.parse(text); } catch { return fail('The sheet feed did not return data (HTTP ' + res.status + ').', 502); }
      if (feed.error) return fail('Sheet feed: ' + feed.error, 502);
      if (!Array.isArray(feed.leads)) return fail('The sheet feed is an older version without reports: deploy the new web-app version in Apps Script.', 502);
    } catch (e) {
      return fail('Could not reach the sheet feed: ' + String(e.message || e).slice(0, 200), 502);
    }
  }
  return xlsx(reportSheets(feed, p), reportFileName(p));
}
