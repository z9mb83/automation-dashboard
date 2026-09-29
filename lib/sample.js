// Demo data with the same shape as the sheet feed (used only when SHEET_API_URL/KEY are not set).
import { BRANDS } from './brands.js';

export function sampleSnapshot(now = new Date()) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ist = new Date(now.getTime() + 330 * 60000);
  const day = (d) => d.toISOString().slice(0, 10);
  const today = day(ist);
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(ist.getTime() - i * 86400000), sunday = d.getUTCDay() === 0;
    const mail = {}, replies = {}, whatsapp = {}, failed = {};
    BRANDS.forEach((b, j) => {
      mail[b.code] = sunday ? 0 : Math.round([14, 7, 9, 3, 3][j] * (0.6 + rnd() * 0.6));
      if (rnd() < 0.12) replies[b.code] = 1;
      if (rnd() < 0.08) failed[b.code] = 1;
    });
    daily.push({ date: day(d), mail, replies, whatsapp, failed });
  }
  const brands = BRANDS.map((b, j) => ({
    code: b.code, name: b.name, leads: [459, 358, 420, 331, 309][j], withEmail: [440, 350, 400, 320, 300][j],
    toDraft: [60, 20, 40, 30, 25][j], drafts: [5, 0, 3, 0, 1][j], approved: [300, 250, 280, 260, 250][j],
    sent: [86, 60, 70, 20, 18][j], replied: [1, 1, 0, 0, 0][j], bounced: [4, 3, 5, 1, 1][j], failed: [0, 1, 0, 0, 0][j],
    phones: [30, 3, 2, 0, 0][j], consent: [10, 3, 0, 0, 0][j], waSent: [0, 3, 0, 0, 0][j], waFailed: 0,
    mailOn: true, waOn: b.code === '99M', sentToday: daily[29].mail[b.code], failedToday: daily[29].failed[b.code] || 0,
    sent7: daily.slice(-7).reduce((s, d) => s + (d.mail[b.code] || 0), 0),
    replies7: daily.slice(-7).reduce((s, d) => s + (d.replies[b.code] || 0), 0),
  }));
  const boxes = { SB: ['linkwithshaadi', 'linkwithshaadi1', 'linkwithshaadi9', 'linkwithshaadi3', 'linkwithshaadi10'], '99M': ['linkwithmarketing', 'linkwithmarketing3'],
    '99S': ['linkwithstaffing', 'linkwithstaffing1', 'linkwithstaffing5'], PE: ['linkwithproperty'], SC: ['linkwithskyline'] };
  const mailboxes = [];
  Object.entries(boxes).forEach(([code, list]) => list.forEach((m, i) => mailboxes.push({
    brand: code, email: m + '@gmail.com', enabled: true, stage: 'Stage ' + (1 + (i % 3)), dailyLimit: 3 + (i % 3) * 2,
    sentToday: Math.min(3 + (i % 3) * 2, 2 + i), paused: m === 'linkwithshaadi', lastResult: m === 'linkwithshaadi' ? 'OAuth invalid_grant' : 'Sent' })));
  return {
    generatedAt: ist.toISOString().slice(0, 16).replace('T', ' '), timezone: 'Asia/Kolkata', today, brands, daily, mailboxes,
    recentReplies: [
      { time: today + ' 16:19', brand: '99M', name: 'Sample lead', email: 'lead@example.com', phone: '' },
      { time: daily[25].date + ' 11:02', brand: 'SB', name: 'Sample family', email: 'family@example.com', phone: '98xxxxxx10' }],
    recentSends: BRANDS.map((b, j) => ({ time: today + ' 1' + j + ':2' + j, brand: b.code, from: boxes[b.code][0] + '@gmail.com', to: 'lead' + j + '@example.com', result: 'Sent', error: '' })),
    recentWhatsApp: [{ time: today + ' 17:55', brand: '99M', phone: '9181****342', template: 'marketing', result: 'Sent' }],
    settings: { whatsappLive: false, whatsappAuto: 'Off' },
  };
}
