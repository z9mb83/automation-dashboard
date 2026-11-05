import { BRANDS } from '../../../lib/brands';
import { RATES, costSummary, smsCounts, whatsappCounts } from '../../../lib/costs';
import { sampleInbox } from '../../../lib/sample';
import { addDays, indiaDate } from '../../../lib/sms';
import { sampleSmsRows, smsRows, telinfyKey } from '../../../lib/telinfy';

export const dynamic = 'force-dynamic';

const SMS_START = '2026-10-01';             // first Telinfy SMS went out in October 2026
const CACHE_MS = 5 * 60 * 1000;
let cache = null;                           // { at, body } per server instance

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function inboxFeed() {
  const base = (process.env.SHEET_API_URL || '').trim(), key = (process.env.SHEET_API_KEY || '').trim();
  if (!base || !key) return { ...sampleInbox(), sample: true };
  const res = await fetch(base + (base.includes('?') ? '&' : '?') + 'inbox=all&key=' + encodeURIComponent(key), { cache: 'no-store', redirect: 'follow' });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('The sheet feed did not return data (HTTP ' + res.status + ').'); }
  if (data.error) throw new Error('Sheet feed: ' + data.error);
  return data;
}

/** Every SMS since SMS_START, asked for one month at a time (Telinfy does not document a range limit). */
async function allSms(today) {
  if (!telinfyKey()) return { rows: sampleSmsRows(addDays(today, -20), today), sample: true };
  const rows = [];
  for (let from = SMS_START; from <= today; from = addDays(from, 31)) {
    const to = addDays(from, 30) < today ? addDays(from, 30) : today;
    rows.push(...await smsRows(from, to));
  }
  return { rows };
}

// GET /api/costs -> what sending has cost so far (WhatsApp + SMS; email is free). Read-only.
export async function GET(req) {
  const fresh = new URL(req.url).searchParams.get('fresh');
  if (cache && !fresh && Date.now() - cache.at < CACHE_MS) return json(cache.body);
  const today = indiaDate();
  const [inbox, sms] = await Promise.allSettled([inboxFeed(), allSms(today)]);
  const errors = [];
  if (inbox.status === 'rejected') errors.push('WhatsApp: ' + String(inbox.reason.message || inbox.reason).slice(0, 150));
  if (sms.status === 'rejected') errors.push('SMS: ' + String(sms.reason.message || sms.reason).slice(0, 150));
  if (errors.length === 2) return json({ error: errors.join(' · ') }, 502);
  const wa = whatsappCounts(inbox.status === 'fulfilled' ? inbox.value : {});
  const smsRowsList = sms.status === 'fulfilled' ? sms.value.rows : [];
  const body = {
    generatedAt: new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace('T', ' '),
    since: { sms: SMS_START },
    sample: (inbox.value && inbox.value.sample) || (sms.value && sms.value.sample) || false,
    errors,
    ...costSummary({ wa, sms: smsCounts(smsRowsList), codes: BRANDS.map((b) => b.code), thisMonth: today.slice(0, 7), rates: RATES }),
  };
  if (!errors.length) cache = { at: Date.now(), body };
  return json(body);
}
