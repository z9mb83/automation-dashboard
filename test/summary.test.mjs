import test from 'node:test';
import assert from 'node:assert/strict';
import { brandSummary, deliverySummary, perDaySummary, pipelineSummary } from '../lib/summary.js';

const series = [{ key: 'SB', label: 'Shaadi Bells' }, { key: '99M', label: '99 Marketing Services' }];
const W = { one: 'email', many: 'emails', verb: 'sent' };

test('per-day summary: total, average on active days, busiest day, dominant brand', () => {
  const days = [
    { date: '2026-09-28', values: { SB: 10, '99M': 2 } },
    { date: '2026-09-29', values: {} },
    { date: '2026-09-30', values: { SB: 20, '99M': 4 } },
  ];
  assert.equal(perDaySummary(days, series, W),
    '36 emails sent in the last 3 days, about 18 a day on days with activity. Busiest day: 30 Sep (24). Most came from Shaadi Bells.');
  assert.equal(perDaySummary([{ date: '2026-09-30', values: {} }], series, W), 'No emails sent in this period.');
  assert.equal(perDaySummary([{ date: '2026-09-30', values: { SB: 1 } }], series, { one: 'reply', many: 'replies', verb: 'received' }),
    '1 reply received in the last 1 days. Busiest day: 30 Sep (1). Most came from Shaadi Bells.');
});

test('brand summary only compares reply rates with enough sends', () => {
  assert.equal(brandSummary([{ label: 'A', sent: 74, replies: 2 }, { label: 'B', sent: 52, replies: 2 }, { label: 'C', sent: 3, replies: 1 }]),
    'Most emails went from A (74 of 129). Best reply rate: B (3.8%).');
  assert.match(brandSummary([{ label: 'A', sent: 5, replies: 0 }, { label: 'B', sent: 4, replies: 0 }]), /not enough replies|No brand has enough/);
  assert.equal(brandSummary([{ label: 'A', sent: 0, replies: 0 }]), 'No emails sent in this period.');
});

test('pipeline summary', () => {
  assert.equal(pipelineSummary({ toDraft: 10, drafts: 5, approved: 20, sentOnly: 60, replied: 5 }),
    'Of 100 leads, 65 (65%) have been emailed and 5 replied (8% of those emailed). 20 are approved and waiting to send. 5 drafts need review.');
  assert.equal(pipelineSummary({}), 'No leads in the sheet yet.');
});

test('delivery summary', () => {
  assert.match(deliverySummary({ read: 1, delivered: 0, pending: 1, failed: 0 }), /1 has no delivery report/);
  assert.match(pipelineSummary({ sentOnly: 498, replied: 2, toDraft: 0 }), /2 replied \(under 1% of those emailed\)/);
  assert.equal(deliverySummary({ read: 2, delivered: 1, pending: 0, failed: 1 }),
    'Of 4 messages sent, 50% were read and 25% arrived but are not read yet. 1 message did not arrive (reasons in the list).');
  assert.equal(deliverySummary({}), 'No WhatsApp messages sent yet.');
});
