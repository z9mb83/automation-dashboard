// Server-only: talks to Telinfy with TELINFY_API_KEY (Vercel environment variable). The key never reaches the browser.
import { addDays, normalize, parseReports, walletBalance } from './sms.js';

const BASE = 'https://hub.telinfy.com/unified/developer/api/v1/sms';
export const telinfyKey = () => (process.env.TELINFY_API_KEY || '').trim();

async function call(path) {
  const res = await fetch(BASE + path, { headers: { 'x-api-key': telinfyKey() }, cache: 'no-store' });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('Telinfy did not return data (HTTP ' + res.status + ')'); }
  if (res.status === 401 || res.status === 403) throw new Error('Telinfy refused the API key (HTTP ' + res.status + '). Check TELINFY_API_KEY on Vercel, and that IP whitelisting is off in Telinfy.');
  if (!res.ok) throw new Error('Telinfy error (HTTP ' + res.status + '): ' + String(json.message || '').slice(0, 150));
  return json;
}

/** SMS sent between two India dates. Asks Telinfy for one extra day each side (its day boundary may be UTC) and trims. */
export async function smsRows(from, to) {
  const json = await call(`/reports?startDate=${addDays(from, -1)}&endDate=${addDays(to, 1)}`);
  return parseReports(json, from, to);
}

export async function smsWallet() {
  try { return walletBalance(await call('/wallet')); } catch { return null; }
}

/** Demo rows (used only when TELINFY_API_KEY is not set). */
export function sampleSmsRows(from, to) {
  let seed = 11, id = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const texts = { PEG: '99 Consulting Services - Property Experts Group. Trusted real estate guidance', SHAADI: 'Elite Matrimonial Solutions. Confidential Matchmaking' };
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (new Date(d + 'T00:00:00Z').getUTCDay() === 0) continue;
    [['PEG', 120], ['SHAADI', 70]].forEach(([k, n]) => {
      for (let i = 0; i < Math.round(n * (0.5 + rnd())); i++) {
        const x = rnd(), code = x < 0.52 ? 0 : x < 0.88 ? 650 : x < 0.93 ? 3 : x < 0.97 ? 34 : 42;
        const utc = new Date(Date.parse(d + 'T06:20:00Z') + Math.floor(rnd() * 5 * 3600) * 1000).toISOString();
        out.push(normalize({ record_id: id++, message: texts[k], mobile_number: '919' + String(800000000 + Math.floor(rnd() * 199999999)),
          status: code ? 6 : 1, error_code: code, recv_timestamp: utc, done_timestamp: utc }));
      }
    });
  }
  return out;
}
