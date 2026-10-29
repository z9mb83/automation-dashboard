import { indiaDate, smsParams } from '../../../lib/sms';
import { sampleSmsRows, smsRows, smsWallet, telinfyKey } from '../../../lib/telinfy';

export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const stamp = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ');

// GET /api/sms?from=yyyy-mm-dd&to=yyyy-mm-dd  ->  { generatedAt, from, to, rows, wallet, sample? }
// Reads Telinfy delivery reports (read-only; never sends). Login is checked by middleware.js.
export async function GET(req) {
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const p = smsParams(q, indiaDate(), Number(q.days) > 0 ? Math.min(92, Number(q.days)) : 7);
  if (p.error) return json({ error: p.error }, 400);
  if (!telinfyKey()) return json({ generatedAt: stamp(), ...p, rows: sampleSmsRows(p.from, p.to), wallet: null, sample: true });
  try {
    const [rows, wallet] = await Promise.all([smsRows(p.from, p.to), smsWallet()]);
    return json({ generatedAt: stamp(), ...p, rows, wallet: wallet.balance, walletNote: wallet.note });
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 300) }, 502);
  }
}
