import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildXlsx } from '../lib/xlsx.js';
import { parseCsv, parseXlsx, pickEmails, pickNumbers, readUpload } from '../lib/upload.js';

test('csv with header: finds phone and name columns', () => {
  const r = pickNumbers(parseCsv('Name,City,Phone\r\nAmit,Chd,9876543210\n"Neha, Dr",Moh,"+91 98111 11111"\n,,\nBad,X,123\n'));
  assert.equal(r.header, true);
  assert.equal(r.phoneCol, 2); assert.equal(r.nameCol, 0);
  assert.deepEqual(r.items.map((x) => x.phone), ['9876543210', '+91 98111 11111', '123']);
  assert.equal(r.items[1].name, 'Neha, Dr');
  assert.equal(r.valid, 2);
});

test('csv without header: column with most phone numbers', () => {
  const r = pickNumbers(parseCsv('x;9876543210\ny;9811111111\n'));
  assert.equal(r.header, false); assert.equal(r.phoneCol, 1); assert.equal(r.total, 2);
});

test('xlsx from Excel/openpyxl (shared strings, numbers)', () => {
  const r = readUpload('numbers.xlsx', readFileSync(new URL('./fixtures/numbers.xlsx', import.meta.url)));
  assert.equal(r.phoneCol, 1); assert.equal(r.nameCol, 0);
  assert.deepEqual(r.items.map((x) => x.phone), ['98765 43210', '919811111111', '+91-9822222222']);
  assert.equal(r.items[0].name, 'Amit');
});

test('xlsx with inline strings (own writer) and big numbers', () => {
  const buf = buildXlsx([{ name: 'S', rows: [['Phone'], ['9876543210'], [919811111111]] }]);
  const r = pickNumbers(parseXlsx(buf));
  assert.deepEqual(r.items.map((x) => x.phone), ['9876543210', '919811111111']);
});

test('old .xls is refused with a clear message', () => {
  assert.throws(() => readUpload('a.xls', Buffer.from('x')), /xlsx or \.csv/);
});

test('ignores look-alike headings: Contact Person, Serial No, other columns', () => {
  const r = pickNumbers(parseCsv('Serial No,Contact Person,Email,City,Mobile No,Alternate\n1,Amit,a@x.com,Chd,9876543210,\n2,Neha,n@x.com,Moh,+91 98111 11111,9822222222\n'));
  assert.equal(r.phoneCol, 4); assert.equal(r.nameCol, 1);
  assert.deepEqual(r.items.map((x) => [x.phone, x.name]), [['9876543210', 'Amit'], ['+91 98111 11111', 'Neha']]);
});

test('no phone-like heading: column with most phone numbers', () => {
  const r = pickNumbers(parseCsv('Name,City,Details\nAmit,Chd,9876543210\nNeha,Moh,9811111111\n'));
  assert.equal(r.phoneCol, 2); assert.equal(r.nameCol, 0);
});

test('email list: email column, name, details from company/designation/city', () => {
  const r = pickEmails(parseCsv('Sr,Contact Name,Company,Designation,Email ID,Phone,City\n1,Amit,Acme Ltd,HR Head,amit@acme.com,9876543210,Chd\n2,Neha,,CTO,NEHA@x.in,,Moh\n3,Bad,,,,,\n'));
  assert.equal(r.emailCol, 4); assert.equal(r.nameCol, 1);
  assert.deepEqual(r.items.map((x) => x.email), ['amit@acme.com', 'NEHA@x.in']);
  assert.equal(r.items[0].details, 'Company: Acme Ltd; Designation: HR Head; City: Chd');
  assert.equal(r.valid, 2);
});

test('readUpload mail kind on xlsx', () => {
  const buf = buildXlsx([{ name: 'S', rows: [['Name', 'Email'], ['Amit', 'a@b.com']] }]);
  const r = readUpload('x.xlsx', buf, 'mail');
  assert.deepEqual(r.items, [{ email: 'a@b.com', name: 'Amit', details: '' }]);
});
