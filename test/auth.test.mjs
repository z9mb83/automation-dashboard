import test from 'node:test';
import assert from 'node:assert';
import { safeEqual, sessionToken } from '../lib/auth.js';
import { sampleSnapshot } from '../lib/sample.js';

test('session token depends on password and key, compare is exact', async () => {
  process.env.DASHBOARD_PASSWORD = 'pw1'; process.env.SHEET_API_KEY = 'k'.repeat(64);
  const a = await sessionToken();
  process.env.DASHBOARD_PASSWORD = 'pw2';
  const b = await sessionToken();
  assert.strictEqual(a.length, 64);
  assert.notStrictEqual(a, b);
  assert.ok(safeEqual(a, a) && !safeEqual(a, b) && !safeEqual('', '') && !safeEqual(a, a.slice(1)));
  delete process.env.DASHBOARD_PASSWORD;
  assert.strictEqual(await sessionToken(), '');
});

test('sample snapshot has the feed shape', () => {
  const s = sampleSnapshot(new Date('2026-09-29T05:00:00Z'));
  assert.strictEqual(s.daily.length, 30);
  assert.strictEqual(s.today, '2026-09-29');
  assert.deepStrictEqual(s.brands.map((b) => b.code), ['SB', '99M', '99S', 'PE', 'SC']);
  for (const k of ['mailboxes', 'recentReplies', 'recentSends', 'recentWhatsApp', 'settings']) assert.ok(k in s);
});

test('axis ticks are clean whole numbers', async () => {
  const { niceTicks } = await import('../lib/ticks.js');
  assert.deepStrictEqual(niceTicks(37), { max: 40, ticks: [0, 10, 20, 30, 40] });
  assert.deepStrictEqual(niceTicks(2), { max: 2, ticks: [0, 1, 2] });
  assert.deepStrictEqual(niceTicks(0), { max: 1, ticks: [0, 1] });
  assert.strictEqual(niceTicks(1340).max, 1500);
});
