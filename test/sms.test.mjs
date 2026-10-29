import test from 'node:test';
import assert from 'node:assert/strict';
import { templateOf, outcome, istFromUtc, normalize, parseReports, smsParams, smsSummary, stopList, smsReportSheets, smsFileName, walletBalance } from '../lib/sms.js';
import { sampleSmsRows } from '../lib/telinfy.js';
import { buildXlsx } from '../lib/xlsx.js';

const PEG = '99 Consulting Services - Property Experts Group. Trusted real estate guidance with 30+ Years Experience.';
const SHAADI = 'Elite Matrimonial Solutions. Confidential Matchmaking with 30+ Years Experience. Sector 18A, Chandigarh.';
const rec = (id, message, status, error_code, recv, mobile = '91981400' + String(id).padStart(4, '0')) =>
  ({ record_id: id, message, mobile_number: mobile, status, sender_name: '099559', recv_timestamp: recv, done_timestamp: recv, error_code });

// Shape seen from Telinfy GET /api/v1/sms/reports on 28 Oct 2026 (numbers made up)
const telinfy = { success: true, message: 'SMS reports retrieved successfully', count: 6, data: [
  rec(1, PEG, 1, 0, '2026-10-28T07:25:57.000Z'),
  rec(2, PEG, 6, 650, '2026-10-28T07:25:57.000Z'),
  rec(3, SHAADI, 6, 34, '2026-10-28T06:20:41.000Z'),
  rec(4, SHAADI, 1, 0, '2026-10-28T06:21:41.000Z'),
  rec(5, PEG, 6, 3, '2026-10-27T18:40:00.000Z'),          // 00:10 IST on 28 Oct
  rec(6, PEG, 1, 0, '2026-10-27T18:20:00.000Z'),          // 23:50 IST on 27 Oct: outside the day
] };

test('templates are matched by text; outcomes by status + error code', () => {
  assert.equal(templateOf(PEG).key, 'PEG');
  assert.equal(templateOf(SHAADI).key, 'SHAADI');
  assert.equal(templateOf('99 Consulting Services - Elite Matrimonial Solutions. Confidential').key, 'SHAADI_OLD');
  assert.equal(templateOf('99 Staffing Services: Simplify your hiring').brand, '99S');
  assert.equal(templateOf('99 Consulting Services: Helping businesses').brand, '99M');
  assert.equal(templateOf('hello').key, 'OTHER');
  assert.equal(outcome(1, 0).key, 'delivered');
  assert.equal(outcome(6, 650).key, 'dnd');
  assert.equal(outcome(6, 3).key, 'invalid');
  assert.equal(outcome(6, 34).key, 'unreachable');
  assert.equal(outcome(6, 99).key, 'other');
  assert.equal(outcome(0, 0).key, 'pending');
});

test('UTC -> India time and the day filter', () => {
  assert.equal(istFromUtc('2026-10-28T07:25:57.000Z'), '2026-10-28 12:55:57');
  const rows = parseReports(telinfy, '2026-10-28', '2026-10-28');
  assert.deepEqual(rows.map((r) => r.id), [5, 3, 4, 1, 2]);           // oldest first, record 6 is 27 Oct India time
  assert.deepEqual(normalize(telinfy.data[0]), { id: 1, template: 'PEG', brand: 'PE', phone: '9814000001',
    sentAt: '2026-10-28 12:55:57', doneAt: '2026-10-28 12:55:57', outcome: 'delivered', reason: 'Delivered', code: 0 });
  assert.throws(() => parseReports({ success: false, message: 'bad key' }, 'a', 'b'), /bad key/);
});

test('params: default range, validation', () => {
  assert.deepEqual(smsParams({}, '2026-10-29'), { from: '2026-10-23', to: '2026-10-29' });
  assert.deepEqual(smsParams({}, '2026-10-29', 30), { from: '2026-09-30', to: '2026-10-29' });
  assert.ok(smsParams({ from: '2026-10-29', to: '2026-10-01' }, 'x').error);
  assert.ok(smsParams({ from: '2026-01-01', to: '2026-10-01' }, 'x').error);
});

test('summary per template, per day, brand filter, stop list', () => {
  const rows = parseReports(telinfy, '2026-10-27', '2026-10-28');
  const s = smsSummary(rows, { from: '2026-10-27', to: '2026-10-28' });
  assert.deepEqual(s.total, { sent: 6, delivered: 3, dnd: 1, invalid: 1, unreachable: 1, other: 0, pending: 0 });
  assert.deepEqual(s.byTemplate.map((t) => [t.key, t.sent, t.delivered]), [['SHAADI', 2, 1], ['PEG', 4, 2]]);
  assert.deepEqual(s.days.map((d) => [d.date, d.sent, d.values.PEG || 0]), [['2026-10-27', 1, 1], ['2026-10-28', 5, 3]]);
  assert.equal(s.deliveredPct, 50);
  assert.equal(s.cost, 1.32);
  assert.equal(smsSummary(rows, { from: '2026-10-27', to: '2026-10-28', brand: 'SB' }).total.sent, 2);
  assert.deepEqual(stopList(rows).map((r) => r.outcome).sort(), ['dnd', 'invalid']);
});

test('Excel report: four sheets, phone numbers as text, file name', () => {
  const rows = parseReports(telinfy, '2026-10-28', '2026-10-28');
  const sheets = smsReportSheets(rows, { from: '2026-10-28', to: '2026-10-28' }, '2026-10-29 10:40');
  assert.deepEqual(sheets.map((x) => x.name), ['Summary', 'Per day', 'All SMS', 'Stop texting (DND, invalid)']);
  assert.equal(sheets[2].rows.length, 6);                             // header + 5
  assert.equal(sheets[2].rows[1][2], '9814000002');                   // newest first, string
  const total = sheets[0].rows.find((r) => r[0] && r[0].v === 'Total');
  assert.deepEqual(total.map((c) => c.v), ['Total', 5, 2, 1, 1, 1, 0, 0, '40%', 1.1]);
  assert.ok(buildXlsx(sheets).length > 1000);
  assert.equal(smsFileName({ from: '2026-10-01', to: '2026-10-28', brand: 'PE' }), 'SMS report - PE - 2026-10-01 to 2026-10-28.xlsx');
});

test('wallet balance is found in any shape; sample rows stay in range', () => {
  assert.equal(walletBalance({ success: true, data: { balance: '10500.25' } }), 10500.25);
  assert.equal(walletBalance({ credits: 12 }), 12);
  assert.equal(walletBalance({ success: true }), null);
  const rows = sampleSmsRows('2026-10-20', '2026-10-28');
  assert.ok(rows.length > 100);
  assert.ok(rows.every((r) => r.sentAt >= '2026-10-20' && r.sentAt < '2026-10-29'));
});
