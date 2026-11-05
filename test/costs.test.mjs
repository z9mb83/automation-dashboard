import test from 'node:test';
import assert from 'node:assert/strict';
import { RATES, costSummary, smsCounts, whatsappCounts, rupees, monthName } from '../lib/costs.js';

const inbox = {
  chats: [{ id: 'SB|919811100001', brand: 'SB' }, { id: 'PE|919811100002', brand: 'PE' }],
  messages: [
    { chat: 'SB|919811100001', dir: 'out', time: '2026-10-05 11:00:00', kind: 'template', status: 'read' },
    { chat: 'SB|919811100001', dir: 'out', time: '2026-11-02 11:00:00', kind: 'template', status: 'delivered' },
    { chat: 'SB|919811100001', dir: 'in', time: '2026-11-02 11:05:00' },
    { chat: 'SB|919811100001', dir: 'out', time: '2026-11-02 11:10:00', kind: 'reply', status: 'read' },     // free
    { chat: 'PE|919811100002', dir: 'out', time: '2026-11-03 11:00:00', kind: 'template', status: 'failed' }, // free
    { chat: 'PE|919811100002', dir: 'out', time: '2026-09-20 11:00:00', kind: 'template', status: 'sent' },   // no report
    { chat: 'PE|919811100002', dir: 'out', time: '2026-11-03 12:00:00', kind: 'auto', status: 'sent' },      // free
  ],
};
const smsRows = [{ brand: 'SB', sentAt: '2026-10-28 11:50:00' }, { brand: 'PE', sentAt: '2026-10-28 12:07:00' }, { brand: 'PE', sentAt: '2026-11-01 12:07:00' }];

test('counts: only delivered templates are charged; replies, auto and failed are free', () => {
  const w = whatsappCounts(inbox);
  assert.deepEqual(w.byBrand.SB, { charged: 2, unknown: 0, failed: 0, free: 1 });
  assert.deepEqual(w.byBrand.PE, { charged: 0, unknown: 1, failed: 1, free: 1 });
  assert.deepEqual(w.byMonth['2026-11'], { charged: 1, unknown: 0, failed: 1, free: 2 });
  assert.deepEqual(smsCounts(smsRows), { byBrand: { SB: 1, PE: 2 }, byMonth: { '2026-10': 2, '2026-11': 1 } });
});

test('money: Meta rate + 18% GST, SMS 0.22, totals per brand and month', () => {
  const s = costSummary({ wa: whatsappCounts(inbox), sms: smsCounts(smsRows), codes: ['SB', '99M', 'PE'], thisMonth: '2026-11' });
  assert.equal(s.whatsapp.base, 1.73);                   // 2 x 0.8631
  assert.equal(s.whatsapp.gst, 0.31);
  assert.equal(s.whatsapp.total, 2.04);
  assert.equal(s.whatsapp.unknownMax, 1.02);
  assert.equal(s.sms.total, 0.66);
  assert.equal(s.total, 2.7);
  assert.deepEqual(s.brands.map((b) => [b.code, b.total]), [['SB', 2.26], ['99M', 0], ['PE', 0.44]]);
  assert.deepEqual(s.months.map((m) => [m.month, m.total]), [['2026-11', 1.24], ['2026-10', 1.46], ['2026-09', 0]]);
  assert.equal(s.thisMonth.total, 1.24);
  assert.equal(s.email.total, 0);
  assert.equal(RATES.waMarketing, 0.8631);
  assert.equal(rupees(1234.5), '₹1,234.50');
  assert.equal(monthName('2026-11'), 'Nov 2026');
});
