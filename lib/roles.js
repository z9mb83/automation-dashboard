/**
 * Three logins (26 Nov 2026, roles re-cut the same day), checked on the server (middleware.js + each API route):
 *   owner  - DASHBOARD_PASSWORD: read-only results. Replies (WhatsApp inbox shows only people who replied, cannot
 *            reply; email replies), sent numbers / charts, the WhatsApp + SMS templates in use, and costs.
 *            No uploads, no sending, no "Send next", no new contacts, no report downloads.
 *   admin  - ADMIN_PASSWORD: runs everything (uploads, sending, inbox with every chat incl. sent-only, replies,
 *            report downloads, the "What is switched on" panel) but never sees money (costs, wallet, cost columns).
 *   viewer - no password: analytics only, real figures with names, numbers, emails and message text masked.
 * Pure functions, unit-tested in test/roles.test.mjs.
 */
export const ROLES = ['owner', 'admin', 'viewer'];
export const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', viewer: 'Viewer' };

const CAPS = {
  owner: ['analytics', 'inbox', 'money', 'templates'],
  admin: ['analytics', 'inbox', 'allChats', 'reply', 'send', 'reports', 'mailHandle', 'status', 'templates'],
  viewer: ['analytics'],
};
export const can = (role, what) => (CAPS[role] || []).includes(what);

/** Which pages / API routes a role may open at all (finer checks, e.g. inbox and SMS actions, live in the routes). */
export function pathAllowed(role, method, pathname) {
  if (!ROLES.includes(role)) return false;
  const p = pathname.replace(/\/+$/, '') || '/';
  const always = ['/', '/api/data', '/api/logo', '/api/logout', '/api/me', '/api/sms', '/api/whatsapp'];
  if (always.includes(p)) return true;
  if (p === '/api/mail') return method === 'GET' || can(role, 'mailHandle');
  if (p === '/inbox') return can(role, 'inbox');
  if (p === '/api/inbox') return can(role, 'inbox') && (method === 'GET' || can(role, 'reply'));
  if (p === '/api/report') return can(role, 'reports');
  if (p === '/api/costs') return can(role, 'money');
  if (p === '/api/sms-send') return can(role, 'send') || can(role, 'templates');   // owner: only the status (templates)
  if (p.startsWith('/api/')) return can(role, 'send');                            // anything new: the operator (admin)
  return true;                                                                    // other pages / static files
}

/** WhatsApp / email route actions: sending and uploads only for admin; the brand cards (templates) for everyone. */
export const whatsappActionAllowed = (role, action) => can(role, 'send') || action === 'brands' || action === 'mailbrands';

/** Send SMS route: status (counts + template) for owner and admin; sending / uploads only for admin. */
export const smsActionAllowed = (role, action) => can(role, 'send') || (action === 'status' && can(role, 'templates'));

/** Inbox actions (reply, opt out, add contact, send template): only admin. The owner's inbox is read-only. */
export const inboxActionAllowed = (role, action) => can(role, 'send') || (can(role, 'reply') && (action === 'reply' || action === 'optout'));

/** Owner inbox: only chats where the person wrote to us (admin sees every chat, incl. sent-only). */
export function inboxForRole(data, role) {
  if (can(role, 'allChats') || !data || !Array.isArray(data.chats)) return data;
  const wrote = new Set((data.messages || []).filter((m) => m.dir === 'in').map((m) => m.chat));
  data.chats.forEach((c) => { if (c.lastInTime) wrote.add(c.id); });
  return { ...data, chats: data.chats.filter((c) => wrote.has(c.id)), messages: (data.messages || []).filter((m) => wrote.has(m.chat)) };
}

/* ---------- masking for the viewer ---------- */

/** '919811122233' / '98111 22233' -> '+91 98xxx xx233'; anything else with 6+ digits keeps only its last 3. */
export function maskPhone(v) {
  const s = String(v ?? '');
  const d = s.replace(/\D/g, '');
  if (d.length < 6) return s ? '•••' : '';
  const n = d.length === 12 && d.startsWith('91') ? d.slice(2) : d;
  if (n.length === 10) return `+91 ${n.slice(0, 2)}xxx xx${n.slice(7)}`;
  return 'xxxxxxx' + n.slice(-3);
}

/** 'ankit@brightfoods.in' -> 'a•••@b•••.in' */
export function maskEmail(v) {
  const s = String(v ?? '');
  const m = /^([^@\s]+)@([^@\s.]+)(\.[^@\s]+)?$/.exec(s.trim());
  if (!m) return s.includes('@') ? '•••@•••' : s;
  return `${m[1][0]}•••@${m[2][0]}•••${m[3] || ''}`;
}

/** 'Ankit Mehta' -> 'A. M.' */
export function maskName(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const w = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2);
  return w.length ? w.map((x) => x[0].toUpperCase() + '.').join(' ') : '•••';
}

export const HIDDEN = '(hidden in viewer mode)';
const NAME_KEYS = new Set(['name', 'handledBy', 'by', 'company']);
const CONTACT_KEYS = new Set(['email', 'phone', 'to', 'from', 'mailbox', 'mobile', 'number']);
const TEXT_KEYS = new Set(['message', 'subject', 'text', 'lastText', 'lastReply', 'details', 'snippet', 'body']);
const EMAIL_RE = /[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[a-z]{2,}/gi;
const PHONE_RE = /\+?\d{10,13}|\b\d{5}\s\d{5}\b/g;

const maskContact = (v) => (String(v).includes('@') ? maskEmail(v) : /\d{6}/.test(String(v).replace(/\D/g, '')) ? maskPhone(v) : maskName(v));
const scrub = (s) => s.replace(EMAIL_RE, (e) => maskEmail(e)).replace(PHONE_RE, (p) => maskPhone(p));

/** Deep copy with every name, contact and message text masked (numbers, dates and counts unchanged). */
export function maskDeep(x, key = '') {
  if (Array.isArray(x)) return x.map((v) => maskDeep(v, key));
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, maskDeep(v, k)]));
  if (typeof x !== 'string' || !x) return x;
  if (TEXT_KEYS.has(key)) return HIDDEN;
  if (NAME_KEYS.has(key)) return maskName(x);
  if (CONTACT_KEYS.has(key)) return maskContact(x);
  return scrub(x);
}

/** What /api/data sends to each role (the role travels along so the page can show the right menus). */
export function dataForRole(data, role) {
  return role === 'viewer' ? { ...maskDeep(data), role } : { ...data, role };
}

/** What /api/sms sends: wallet balance only for the owner, numbers masked for the viewer. */
export function smsForRole(data, role) {
  const out = can(role, 'money') ? data : { ...data, wallet: null, walletNote: '' };
  return role === 'viewer' ? { ...out, rows: (out.rows || []).map((r) => ({ ...r, phone: maskPhone(r.phone) })) } : out;
}
