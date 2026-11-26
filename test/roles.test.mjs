import test from 'node:test';
import assert from 'node:assert/strict';
import { can, pathAllowed, inboxActionAllowed, whatsappActionAllowed, smsActionAllowed, inboxForRole, maskPhone, maskEmail, maskName, maskDeep, dataForRole, smsForRole, HIDDEN } from '../lib/roles.js';
import { loginRole, roleForPassword, tokenFor, roleOf } from '../lib/auth.js';
import { sampleSnapshot, sampleInbox, sampleMailThreads } from '../lib/sample.js';
import { smsReportSheets } from '../lib/sms.js';

test('owner: read-only results and money; admin: runs everything without money; viewer: analytics', () => {
  assert.ok(can('owner', 'money') && can('owner', 'templates') && can('owner', 'inbox'));
  assert.ok(!can('owner', 'send') && !can('owner', 'reply') && !can('owner', 'reports') && !can('owner', 'status'));
  assert.ok(can('admin', 'send') && can('admin', 'reply') && can('admin', 'reports') && can('admin', 'status') && can('admin', 'allChats'));
  assert.ok(!can('admin', 'money'));
  assert.ok(!can('viewer', 'inbox') && !can('viewer', 'reports') && !can('viewer', 'money') && can('viewer', 'analytics'));
  assert.ok(!can('', 'analytics'));
});

test('pages and API routes per login', () => {
  const ok = (r, m, p) => pathAllowed(r, m, p);
  // owner: inbox read-only, costs, SMS status (templates); no report downloads, no inbox actions
  assert.ok(ok('owner', 'GET', '/inbox') && ok('owner', 'GET', '/api/inbox') && ok('owner', 'GET', '/api/costs') && ok('owner', 'POST', '/api/sms-send'));
  assert.ok(!ok('owner', 'POST', '/api/inbox') && !ok('owner', 'GET', '/api/report') && !ok('owner', 'POST', '/api/mail'));
  // admin: everything except costs
  for (const [m, p] of [['GET', '/inbox'], ['POST', '/api/inbox'], ['GET', '/api/report'], ['POST', '/api/mail'], ['POST', '/api/sms-send'], ['POST', '/api/whatsapp']]) assert.ok(ok('admin', m, p), p);
  assert.ok(!ok('admin', 'GET', '/api/costs'));
  // viewer
  for (const p of ['/inbox', '/api/inbox', '/api/report', '/api/costs', '/api/sms-send']) assert.ok(!ok('viewer', 'GET', p), p);
  assert.ok(!ok('viewer', 'POST', '/api/mail') && ok('viewer', 'GET', '/api/mail'));
  assert.ok(ok('viewer', 'GET', '/') && ok('viewer', 'GET', '/api/data') && ok('viewer', 'GET', '/api/sms'));
  assert.ok(!ok('viewer', 'GET', '/api/something-new') && !ok('owner', 'GET', '/api/something-new') && ok('admin', 'GET', '/api/something-new') && !ok('', 'GET', '/'));
});

test('inbox, WhatsApp and SMS actions', () => {
  for (const a of ['reply', 'optout', 'add', 'send']) { assert.ok(inboxActionAllowed('admin', a), a); assert.ok(!inboxActionAllowed('owner', a), a); assert.ok(!inboxActionAllowed('viewer', a), a); }
  assert.ok(whatsappActionAllowed('owner', 'brands') && whatsappActionAllowed('viewer', 'brands'));
  assert.ok(!whatsappActionAllowed('owner', 'sendnext') && !whatsappActionAllowed('owner', 'upload') && whatsappActionAllowed('admin', 'sendnext'));
  assert.ok(smsActionAllowed('owner', 'status') && !smsActionAllowed('owner', 'sendnext') && !smsActionAllowed('owner', 'upload'));
  assert.ok(smsActionAllowed('admin', 'sendnext') && smsActionAllowed('admin', 'upload') && !smsActionAllowed('viewer', 'status'));
});

test('owner inbox keeps only people who wrote to us; admin sees every chat', () => {
  const d = { chats: [{ id: 'a' }, { id: 'b' }, { id: 'c', lastInTime: '2026-11-26 10:00' }],
    messages: [{ chat: 'a', dir: 'out' }, { chat: 'b', dir: 'out' }, { chat: 'b', dir: 'in' }] };
  const o = inboxForRole(d, 'owner');
  assert.deepEqual(o.chats.map((c) => c.id), ['b', 'c']);
  assert.ok(o.messages.every((m) => m.chat === 'b'));
  assert.equal(inboxForRole(d, 'admin'), d);
  const s = inboxForRole(sampleInbox(), 'owner');
  assert.ok(s.chats.length > 0 && s.chats.every((c) => s.messages.some((m) => m.chat === c.id && m.dir === 'in') || c.lastInTime));
});

test('masking', () => {
  assert.equal(maskPhone('919811122233'), '+91 98xxx xx233');
  assert.equal(maskPhone('98111 22233'), '+91 98xxx xx233');
  assert.equal(maskPhone('447700900123'), 'xxxxxxx123');
  assert.equal(maskEmail('ankit@brightfoods.in'), 'a•••@b•••.in');
  assert.equal(maskName('Ankit Mehta'), 'A. M.');
  assert.equal(maskName(''), '');
  const m = maskDeep({ name: 'Ankit Mehta', email: 'a@b.com', phone: '9811122233', message: 'call me', to: 'x@y.in', count: 5,
    time: '2026-11-26 10:00', lastResult: 'Sent to ankit@brightfoods.in', note: 'from 9811122233' });
  assert.deepEqual(m, { name: 'A. M.', email: 'a•••@b•••.com', phone: '+91 98xxx xx233', message: HIDDEN, to: 'x•••@y•••.in', count: 5,
    time: '2026-11-26 10:00', lastResult: 'Sent to a•••@b•••.in', note: 'from +91 98xxx xx233' });
});

test('viewer data: same figures, no names, numbers, emails or message text anywhere', () => {
  const raw = sampleSnapshot(new Date('2026-11-26T05:00:00Z'));
  const v = dataForRole(raw, 'viewer');
  assert.equal(v.role, 'viewer');
  assert.deepEqual(v.daily, raw.daily);
  assert.deepEqual(v.brands.map((b) => b.sent), raw.brands.map((b) => b.sent));
  const text = JSON.stringify(v);
  assert.ok(!/[\w.+-]{2,}@/.test(text) && !/@[\w-]{2,}\./.test(text), 'no readable email');
  assert.ok(!/\d{10}/.test(text), 'no full phone number');
  assert.ok(!text.includes("I'm interested") && !text.includes('Sample lead'));
  assert.equal(dataForRole(raw, 'admin').recentWaReplies[0].phone, raw.recentWaReplies[0].phone);
  const mail = JSON.stringify(maskDeep(sampleMailThreads()));
  assert.ok(!mail.includes('Ankit') && !mail.includes('ankit@') && !mail.includes('9811100001'));
});

test('SMS: wallet only for the owner, phones masked for the viewer, no cost column for the admin download', () => {
  const d = { rows: [{ phone: '9811122233', template: 'x' }], wallet: 512.5, walletNote: 'ok' };
  assert.equal(smsForRole(d, 'owner').wallet, 512.5);
  assert.equal(smsForRole(d, 'admin').wallet, null);
  assert.equal(smsForRole(d, 'admin').rows[0].phone, '9811122233');
  assert.equal(smsForRole(d, 'viewer').rows[0].phone, '+91 98xxx xx233');
  const rows = [{ id: 1, template: 'shaadi', brand: 'SB', phone: '9811122233', sentAt: '2026-11-26 10:00:00', doneAt: '', outcome: 'delivered', reason: '', code: 0 }];
  const p = { from: '2026-11-26', to: '2026-11-26' };
  assert.ok(JSON.stringify(smsReportSheets(rows, p)).includes('Cost'));
  assert.ok(!JSON.stringify(smsReportSheets(rows, { ...p, money: false })).includes('Cost'));
});

test('logins: owner and admin passwords, viewer without; cookies tell them apart', async () => {
  const env = { DASHBOARD_PASSWORD: 'own-pass', ADMIN_PASSWORD: 'adm-pass', SHEET_API_KEY: 'k'.repeat(64) };
  assert.equal(roleForPassword('own-pass', env), 'owner');
  assert.equal(roleForPassword('adm-pass', env), 'admin');
  assert.equal(roleForPassword('nope', env), '');
  assert.equal(roleForPassword('adm-pass', { ...env, ADMIN_PASSWORD: '' }), '');
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    const [o, a, v] = [await tokenFor('owner'), await tokenFor('admin'), await tokenFor('viewer')];
    assert.ok(o && a && v && new Set([o, a, v]).size === 3);
    assert.equal(await roleOf(o), 'owner'); assert.equal(await roleOf(a), 'admin'); assert.equal(await roleOf(v), 'viewer');
    assert.equal(await roleOf('x'.repeat(64)), '');
    delete process.env.ADMIN_PASSWORD;
    assert.equal(await tokenFor('admin'), '');
    assert.equal(await roleOf(a), '');
  } finally { for (const k of Object.keys(env)) { if (k in saved) process.env[k] = saved[k]; else delete process.env[k]; } }
});

test('sign-in page: each password only opens its own login', () => {
  const env = { DASHBOARD_PASSWORD: 'own-pass', ADMIN_PASSWORD: 'adm-pass' };
  assert.equal(loginRole('owner', 'own-pass', env), 'owner');
  assert.equal(loginRole('owner', 'adm-pass', env), '');
  assert.equal(loginRole('admin', 'adm-pass', env), 'admin');
  assert.equal(loginRole('admin', 'own-pass', env), '');
  assert.equal(loginRole('admin', '', { ...env, ADMIN_PASSWORD: '' }), '');
  assert.equal(loginRole('viewer', '', env), 'viewer');
  assert.equal(loginRole('', 'own-pass', env), '');
});
