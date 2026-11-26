import { NextResponse } from 'next/server';
import { sampleSnapshot } from '../../../lib/sample';
import { dataForRole } from '../../../lib/roles';

export const dynamic = 'force-dynamic';

// Reads the sheet feed (Apps Script web app). The key stays on the server; the browser only sees the numbers.
// Viewer login: names, numbers, emails and message text are masked here, on the server (lib/roles.js).
export async function GET(req) {
  const role = req.headers.get('x-dash-role') || '';
  const base = (process.env.SHEET_API_URL || '').trim(), key = (process.env.SHEET_API_KEY || '').trim();
  if (!base || !key) return NextResponse.json(dataForRole({ ...sampleSnapshot(), sample: true }, role), { headers: { 'Cache-Control': 'no-store' } });
  try {
    const url = base + (base.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key);
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('feed did not return JSON (HTTP ' + res.status + ') - check SHEET_API_URL and that the web app access is "Anyone"'); }
    if (data.error === 'unauthorized') throw new Error('feed: unauthorized - the SHEET_API_KEY on Vercel does not match the sheet key (' + key.length + ' characters; a sheet key has 64). Create a new key in the sheet and paste it again.');
    if (data.error) throw new Error('feed: ' + data.error);
    return NextResponse.json(dataForRole(data, role), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e).slice(0, 300) }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
