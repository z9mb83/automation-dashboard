import test from 'node:test';
import assert from 'node:assert/strict';
import { smsUploadBody, smsUrl, smsTarget } from '../lib/smssend.js';
import { readUpload } from '../lib/upload.js';

test('Send SMS upload: the file is read and becomes the bulkadd body for the brand sheet', () => {
  const csv = Buffer.from('Name,Mobile\nAsha,98111 22233\nRavi,+91 90000 00001\n');
  const up = smsUploadBody(readUpload('list.csv', csv, 'whatsapp'), 'list.csv');
  assert.deepEqual(up.file, { rows: 2, valid: 2, column: 'Mobile' });
  assert.equal(up.body.file, 'list.csv');
  assert.deepEqual(up.body.rows, [{ phone: '98111 22233', name: 'Asha' }, { phone: '+91 90000 00001', name: 'Ravi' }]);
  const t = smsTarget('PE', { SMS_PE_URL: 'https://example.test/exec', SMS_PE_KEY: 'k' });
  assert.equal(smsUrl(t, 'bulkadd'), 'https://example.test/exec?action=bulkadd&key=k');
});

test('Send SMS upload: a file without phone numbers is refused before anything reaches the sheet', () => {
  const up = smsUploadBody(readUpload('x.csv', Buffer.from('Name,City\nAsha,Delhi\n'), 'whatsapp'), 'x.csv');
  assert.match(up.error, /No phone number column/);
  assert.equal(smsTarget('99M'), null);   // brands without an SMS sheet are refused by the route
});
