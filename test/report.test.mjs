import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { reportParams, reportSheets, reportFileName, indiaDate } from '../lib/report.js';
import { buildXlsx } from '../lib/xlsx.js';

const lead = (brand, row, mail, whatsapp) => ({ brand, row, name: 'N' + row, email: `e${row}@x.com`, phone: '919811100' + row, mail, whatsapp });
const M = (sentAt, extra = {}) => ({ status: 'Sent', sentAt, from: 'box@gmail.com', subject: 'S', error: '', replied: false, repliedAt: '', ...extra });
const W = (sentAt, extra = {}) => ({ status: 'Sent', sentAt, delivery: 'Delivered', consent: true, info: 'wamid', replied: false, repliedAt: '', lastReply: '', ...extra });
const feed = { generatedAt: '2026-10-17 16:40', leads: [
  lead('SB', 3, M('2026-10-17 11:00'), null),
  lead('SB', 4, M('2026-10-10 11:00', { replied: true, repliedAt: '2026-10-17 10:00' }), W('2026-10-17 12:00', { delivery: 'Read' })),
  lead('SB', 5, M('2026-10-10 11:00'), null),                                   // old, no reply: never in a "today" report
  lead('99M', 6, M('2026-10-17 12:00', { status: 'Bounced' }), W('2026-10-16 12:00', { replied: true, repliedAt: '2026-10-16 13:00', lastReply: 'Call me' })),
  lead('99M', 7, null, W('2026-10-17 09:00', { status: 'Failed', delivery: '' })),
] };

test('params: defaults to today, validates dates and brand', () => {
  assert.deepEqual(reportParams({}, '2026-10-17'), { type: 'combined', brand: 'ALL', from: '2026-10-17', to: '2026-10-17' });
  assert.deepEqual(reportParams({ type: 'mail', brand: 'SB', from: '2026-10-01', to: '2026-10-17' }, 'x'), { type: 'mail', brand: 'SB', from: '2026-10-01', to: '2026-10-17' });
  assert.equal(reportParams({ brand: 'NOPE', type: 'bad' }, '2026-10-17').brand, 'ALL');
  assert.ok(reportParams({ from: '2026-10-17', to: '2026-10-01' }, 'x').error);
  assert.equal(indiaDate(new Date('2026-10-16T20:00:00Z')), '2026-10-17');   // 01:30 IST next day
  assert.equal(reportFileName({ type: 'mail', brand: 'SB', from: '2026-10-01', to: '2026-10-17' }), 'Mail report - SB - 2026-10-01 to 2026-10-17.xlsx');
});

test('today, mail: sent today or replied today; summary counts per brand', () => {
  const s = reportSheets(feed, reportParams({ type: 'mail' }, '2026-10-17'));
  assert.deepEqual(s.map((x) => x.name), ['Summary', 'Emails']);
  assert.deepEqual(s[1].rows.slice(1).map((r) => r[2]), ['e6@x.com', 'e3@x.com', 'e4@x.com']);  // newest send first
  const sb = s[0].rows.find((r) => String(r[0]).startsWith('SB -'));
  assert.deepEqual(sb.slice(1), [1, 0, 0, 1, '100%']);   // 1 sent today, the reply came today to an older email
  const m = s[0].rows.find((r) => String(r[0]).startsWith('99M -'));
  assert.deepEqual(m.slice(1), [1, 0, 1, 0, '0%']);
});

test('date range, WhatsApp only and one brand', () => {
  const s = reportSheets(feed, reportParams({ type: 'whatsapp', brand: '99M', from: '2026-10-16', to: '2026-10-17' }, 'x'));
  assert.deepEqual(s[1].rows.slice(1).map((r) => [r[0], r[4], r[9]]), [['99M', 'Failed', ''], ['99M', 'Sent', 'Call me']]);
  const row = s[0].rows.find((r) => String(r[0]).startsWith('99M -'));
  assert.deepEqual(row.slice(1), [1, 1, 1, 0, 0, 1, '100%']);
  assert.ok(!s[0].rows.some((r) => String(r[0]).startsWith('SB -')));
});

test('combined: one row per lead with both channels', () => {
  const s = reportSheets(feed, reportParams({}, '2026-10-17'));
  const rows = s[1].rows;
  assert.equal(rows[0][4], 'Any reply');
  assert.equal(rows.length - 1, 4);
  const r4 = rows.find((r) => r[2] === 'e4@x.com');
  assert.deepEqual([r4[4], r4[5], r4[8], r4[10], r4[12]], ['Yes', 'Sent', 'Yes', 'Sent', 'Read']);
});

test('xlsx: valid zip, phone numbers stay text, xml escaped', () => {
  const buf = buildXlsx([{ name: 'A/B?', rows: [['Phone', 'Note'], ['919811100003', 'a < b & "c"'], [12, '']], header: 0, widths: [10, 10] }]);
  assert.equal(buf.readUInt32LE(0), 0x04034b50);
  // walk the local file headers and inflate the sheet
  const files = {}; let o = 0;
  while (buf.readUInt32LE(o) === 0x04034b50) {
    const size = buf.readUInt32LE(o + 18), nl = buf.readUInt16LE(o + 26), name = buf.slice(o + 30, o + 30 + nl).toString();
    files[name] = inflateRawSync(buf.slice(o + 30 + nl, o + 30 + nl + size)).toString(); o += 30 + nl + size;
  }
  assert.ok(files['xl/workbook.xml'].includes('name="A B "'));
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('t="inlineStr"><is><t xml:space="preserve">919811100003</t>'));
  assert.ok(sheet.includes('a &lt; b &amp; &quot;c&quot;'));
  assert.ok(sheet.includes('<c r="A3"><v>12</v></c>'));
  assert.ok(sheet.includes('state="frozen"') && sheet.includes('<autoFilter ref="A1:B3"/>'));
});
