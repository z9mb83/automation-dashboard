import test from 'node:test';
import assert from 'node:assert/strict';
import { SMS_SHEETS, smsTarget, smsUrl } from '../lib/smssend.js';

test('only Shaadi Bells and Property Experts send SMS', () => {
  assert.deepEqual(SMS_SHEETS.map((s) => s.code), ['SB', 'PE']);
  assert.equal(smsTarget('99M', {}), null);
});

test('target is empty until both URL and key are set (no half setup)', () => {
  assert.equal(smsTarget('SB', { SMS_SB_URL: 'https://x/exec' }).url, '');
  const t = smsTarget('PE', { SMS_PE_URL: ' https://script.google.com/macros/s/abc/exec ', SMS_PE_KEY: ' k1 ' });
  assert.equal(t.url, 'https://script.google.com/macros/s/abc/exec');
  assert.equal(t.key, 'k1');
});

test('url carries the action and the encoded key', () => {
  assert.equal(smsUrl({ url: 'https://s/exec', key: 'a b' }, 'status'), 'https://s/exec?action=status&key=a%20b');
  assert.equal(smsUrl({ url: 'https://s/exec?x=1', key: 'k' }, 'sendnext'), 'https://s/exec?x=1&action=sendnext&key=k');
});
