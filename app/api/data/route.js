import { NextResponse } from 'next/server';
import { sampleSnapshot } from '../../../lib/sample';

export const dynamic = 'force-dynamic';

// Reads the sheet feed (Apps Script web app). The key stays on the server; the browser only sees the numbers.
export async function GET() {
  const base = process.env.SHEET_API_URL, key = process.env.SHEET_API_KEY;
  if (!base || !key) return NextResponse.json({ ...sampleSnapshot(), sample: true }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const url = base + (base.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key);
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('feed did not return JSON (HTTP ' + res.status + ') - check SHEET_API_URL and that the web app access is "Anyone"'); }
    if (data.error) throw new Error('feed: ' + data.error);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e).slice(0, 300) }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
