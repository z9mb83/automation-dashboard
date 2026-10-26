import test from 'node:test';
import assert from 'node:assert/strict';
import { prettyPhone, matchesSearch, filterChats, chatFacts, listTime, dayLabel, threadItems, newContactBody, waLink, telLink } from '../lib/inbox.js';
import { sampleInbox } from '../lib/sample.js';

const chats = [
  { id: 'SB|919811122233', brand: 'SB', phone: '919811122233', name: 'Rohit Sharma', email: 'rohit@x.com', flag: '', optedOut: false },
  { id: '99M|919400000202', brand: '99M', phone: '919400000202', name: '', email: '', flag: 'Possible opt-out', optedOut: false },
  { id: 'PE|447700900123', brand: 'PE', phone: '447700900123', name: 'UK lead', email: '', flag: '', optedOut: false },
];
const messages = [
  { id: 'o1', chat: 'SB|919811122233', dir: 'out', time: '2026-10-22 10:00:00', text: 'Hi', status: 'read' },
  { id: 'i1', chat: 'SB|919811122233', dir: 'in', time: '2026-10-23 09:00:00', text: 'Call me' },
  { id: 'o2', chat: '99M|919400000202', dir: 'out', time: '2026-10-21 10:00:00', text: 'Hi', status: 'delivered' },
  { id: 'i2', chat: '99M|919400000202', dir: 'in', time: '2026-10-21 12:00:00', text: 'Not interested' },
  { id: 'o3', chat: 'PE|447700900123', dir: 'out', time: '2026-10-20 10:00:00', text: 'Hello', status: 'failed' },
];

test('numbers: full, formatted, dial and WhatsApp links', () => {
  assert.equal(prettyPhone('9811122233'), '+91 98111 22233');
  assert.equal(prettyPhone('919811122233'), '+91 98111 22233');
  assert.equal(prettyPhone('447700900123'), '+447700900123');
  assert.equal(telLink('98111 22233'), 'tel:+919811122233');
  assert.equal(waLink('+91 98111-22233'), 'https://wa.me/919811122233');
});

test('search by any part of the number in any format, or by name/email', () => {
  for (const q of ['98111', '+91 98111 22233', '09811122233', '22233', 'rohit', 'ROHIT@X']) assert.ok(matchesSearch(chats[0], q), q);
  for (const q of ['12345', 'anita']) assert.ok(!matchesSearch(chats[0], q), q);
});

test('filters and unread counts', () => {
  assert.deepEqual(chatFacts(chats[0], messages, {}), { unread: 1, replied: true, failed: false, lastOutStatus: 'read', flagged: false });
  assert.equal(chatFacts(chats[0], messages, { 'SB|919811122233': '2026-10-23 09:00:00' }).unread, 0);
  const ids = (f, extra = {}) => filterChats(chats, messages, { filter: f, ...extra }).map((c) => c.brand);
  assert.deepEqual(ids('replied'), ['SB', '99M']);
  assert.deepEqual(ids('failed'), ['PE']);
  assert.deepEqual(ids('flagged'), ['99M']);
  assert.deepEqual(ids('waiting'), []);
  assert.deepEqual(ids('all', { brand: '99M' }), ['99M']);
  assert.deepEqual(ids('all', { q: '7700' }), ['PE']);
  assert.deepEqual(ids('unread', { lastSeen: { 'SB|919811122233': '2026-10-23 09:00:00' } }), ['99M']);
});

test('times and thread day separators', () => {
  assert.equal(listTime('2026-10-23 09:05:00', '2026-10-23'), '09:05');
  assert.equal(listTime('2026-10-22 09:05:00', '2026-10-23'), 'Yesterday');
  assert.equal(listTime('2026-10-01 09:05:00', '2026-10-23'), '1 Oct');
  assert.equal(listTime('2025-12-31 09:05:00', '2026-01-02'), '31 Dec 2025');
  assert.equal(dayLabel('2026-10-23', '2026-10-23'), 'Today');
  assert.equal(dayLabel('2026-10-21', '2026-10-23'), '21 October 2026');
  const items = threadItems(messages, 'SB|919811122233');
  assert.deepEqual(items.map((x) => x.day || x.id), ['2026-10-22', 'o1', '2026-10-23', 'i1']);
});

test('new contact form', () => {
  assert.equal(newContactBody({ phone: '98111 22233' }).error, 'Choose a brand.');
  assert.match(newContactBody({ brand: 'SB', phone: '12345' }).error, /mobile number/);
  assert.match(newContactBody({ brand: 'SB', phone: '9811122233', email: 'x@' }).error, /email/);
  assert.deepEqual(newContactBody({ brand: 'SB', phone: '98111 22233', name: ' Rohit ', send: 1 }),
    { brand: 'SB', phone: '919811122233', name: 'Rohit', email: '', details: '', source: 'Cold', send: true });
});

test('sample inbox has the feed shape', () => {
  const s = sampleInbox(new Date('2026-10-23T06:00:00Z'));
  assert.ok(s.chats.length >= 5 && s.messages.length >= 6);
  for (const c of s.chats) assert.ok(s.messages.some((m) => m.chat === c.id), c.id);
});

import { replyWindow, needsReply, replyQueue, istMs, istStamp } from '../lib/inbox.js';

test('24-hour reply window: countdown levels and the Needs reply queue', () => {
  const now = istMs('2026-10-26 17:30:00');
  assert.equal(istStamp(now), '2026-10-26 17:30:00');
  const ch = (id, lastInTime, extra = {}) => ({ id, brand: 'SB', phone: '91' + id.padStart(10, '0'), name: id, lastInTime, flag: '', optedOut: false, ...extra });
  const chats = [ch('1', '2026-10-26 13:31:00'), ch('2', '2026-10-25 18:00:00'), ch('3', '2026-10-25 17:45:00'), ch('4', '2026-10-24 21:05:00'), ch('5', ''), ch('6', '2026-10-26 16:00:00', { optedOut: true, flag: 'Opted out' })];
  const msgs = [
    { chat: '1', dir: 'in', time: '2026-10-26 13:31:00' },
    { chat: '2', dir: 'out', time: '2026-10-25 10:00:00', status: 'read' }, { chat: '2', dir: 'in', time: '2026-10-25 18:00:00' },
    { chat: '3', dir: 'in', time: '2026-10-25 17:45:00' }, { chat: '3', dir: 'out', time: '2026-10-25 17:50:00', status: 'sent', kind: 'reply' },
    { chat: '4', dir: 'in', time: '2026-10-24 21:05:00' },
    { chat: '6', dir: 'in', time: '2026-10-26 16:00:00' }];
  const w = (id) => replyWindow(chats.find((c) => c.id === id), msgs, now);
  assert.deepEqual([w('1').level, w('1').label], ['ok', '20 h 01 m left to reply']);
  assert.equal(w('2').level, 'urgent');                     // 18:00 yesterday -> 30 minutes left
  assert.equal(w('2').short, '30m left');
  assert.equal(w('3').level, 'urgent');
  assert.deepEqual([w('4').open, w('4').level], [false, 'closed']);
  assert.equal(w('5').level, 'never');
  assert.equal(replyWindow(ch('8', '2026-10-25 19:30:00'), [], now).level, 'soon');   // 2 h left
  assert.ok(needsReply(chats[0], msgs, now));
  assert.ok(!needsReply(chats[2], msgs, now));              // we already answered after their message
  assert.ok(!needsReply(chats[5], msgs, now));              // opted out
  assert.deepEqual(replyQueue(chats, msgs, now).map((c) => c.id), ['2', '1']);   // least time left first
});
