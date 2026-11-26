/**
 * Inbox helpers (pure, unit-tested in test/inbox.test.mjs).
 * Data shape from the sheet feed ?inbox=all:
 *   chats:    [{ id: 'SB|919811122233', brand, phone, name, email, row, optedOut, flag, lastTime, lastText, lastDir, waStatus, delivery }]
 *   messages: [{ id, chat, dir: 'out'|'in', time: 'yyyy-mm-dd hh:mm[:ss]', text, status?, error?, template?, auto?, type?, flag? }]
 */

export const digits = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };

/** '919811122233' -> '+91 98111 22233' (other countries: '+' and the digits). */
export function prettyPhone(p) {
  const d = digits(p);
  if (!d) return '';
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`;
}

export const telLink = (p) => `tel:+${digits(p)}`;
export const waLink = (p) => `https://wa.me/${digits(p)}`;

/** Search by any part of the number (any format) or the name / email. */
export function matchesSearch(chat, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  const d = s.replace(/\D/g, '');
  if (d.length >= 3 && (chat.phone || '').includes(d.replace(/^0+/, ''))) return true;
  return [chat.name, chat.email].some((v) => String(v || '').toLowerCase().includes(s));
}

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'needs', label: 'Needs reply' },
  { key: 'unread', label: 'Unread' },
  { key: 'replied', label: 'Replied' },
  { key: 'waiting', label: 'No reply yet' },
  { key: 'failed', label: 'Not delivered' },
  { key: 'flagged', label: 'Opt-outs' },
];

/** Per-chat facts used by the filters and the list. lastSeen = { chatId: 'time' } (this browser). */
export function chatFacts(chat, messages, lastSeen = {}) {
  const mine = messages.filter((m) => m.chat === chat.id);
  const seen = lastSeen[chat.id] || '';
  const incoming = mine.filter((m) => m.dir === 'in');
  const outgoing = mine.filter((m) => m.dir === 'out');
  const lastOut = outgoing[outgoing.length - 1];
  return {
    unread: incoming.filter((m) => m.time > seen).length,
    replied: incoming.length > 0,
    failed: !!lastOut && lastOut.status === 'failed',
    lastOutStatus: lastOut ? lastOut.status : '',
    flagged: !!chat.flag || chat.optedOut,
  };
}

export function filterChats(chats, messages, { q = '', brand = 'ALL', filter = 'all', lastSeen = {}, nowMs = Date.now() } = {}) {
  if (filter === 'needs') return replyQueue(chats, messages, nowMs).filter((c) => (brand === 'ALL' || c.brand === brand) && matchesSearch(c, q));
  return chats.filter((c) => {
    if (brand !== 'ALL' && c.brand !== brand) return false;
    if (!matchesSearch(c, q)) return false;
    const f = chatFacts(c, messages, lastSeen);
    if (filter === 'unread') return f.unread > 0;
    if (filter === 'replied') return f.replied;
    if (filter === 'waiting') return !f.replied && !f.failed && !f.flagged;
    if (filter === 'failed') return f.failed;
    if (filter === 'flagged') return f.flagged;
    return true;
  });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const prevDay = (d) => new Date(Date.parse(d + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);

/** Chat-list time: '14:05' today, 'Yesterday', else '21 Oct'. today = 'yyyy-mm-dd' (India time). */
export function listTime(time, today) {
  const d = String(time || '').slice(0, 10);
  if (!d) return '';
  if (d === today) return String(time).slice(11, 16);
  if (d === prevDay(today)) return 'Yesterday';
  return `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}${d.slice(0, 4) !== today.slice(0, 4) ? ' ' + d.slice(0, 4) : ''}`;
}

/** Day separator label in a thread: 'Today', 'Yesterday', '21 October 2026'. */
export function dayLabel(d, today) {
  if (d === today) return 'Today';
  if (d === prevDay(today)) return 'Yesterday';
  const full = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${+d.slice(8, 10)} ${full[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
}

/** Messages of one chat with day separators: [{day}, msg, msg, {day}, ...]. */
export function threadItems(messages, chatId) {
  const out = [];
  let last = '';
  messages.filter((m) => m.chat === chatId).forEach((m) => {
    const d = m.time.slice(0, 10);
    if (d !== last) { out.push({ day: d }); last = d; }
    out.push(m);
  });
  return out;
}

/** What the "New contact" form sends; returns {error} or the cleaned body. */
export function newContactBody(f) {
  const brand = String(f.brand || '').trim();
  const phone = digits(f.phone);
  if (!brand) return { error: 'Choose a brand.' };
  if (phone.length < 11 || phone.length > 15) return { error: 'Enter a full mobile number (10 digits, or with country code).' };
  const email = String(f.email || '').trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'That email address does not look right.' };
  return { brand, phone, name: String(f.name || '').trim(), email, details: String(f.details || '').trim(), source: f.source || 'Cold', send: !!f.send };
}

/* ---------- 24-hour reply window (WhatsApp: free text only within 24 h of the customer's last message) ---------- */

export const WINDOW_MS = 24 * 3600 * 1000;

/** India time 'yyyy-mm-dd hh:mm[:ss]' -> epoch ms (0 if unknown). */
export function istMs(t) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(t || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - 330 * 60000 : 0;
}

/** epoch ms -> India time 'yyyy-mm-dd hh:mm:ss'. */
export function istStamp(ms) { return new Date(ms + 330 * 60000).toISOString().slice(0, 19).replace('T', ' '); }

function lastIncoming(chat, messages) {
  if (chat.lastInTime) return chat.lastInTime;
  const mine = messages.filter((m) => m.chat === chat.id && m.dir === 'in');
  return mine.length ? mine[mine.length - 1].time : '';
}

/**
 * { open, leftMs, level: 'ok' | 'soon' (< 3 h) | 'urgent' (< 1 h) | 'closed' | 'never', label, short }
 * 'never' = they have not written to us yet, so typing is not possible.
 */
export function replyWindow(chat, messages, nowMs) {
  const last = lastIncoming(chat, messages);
  if (!last) return { open: false, leftMs: 0, level: 'never', label: 'They have not messaged you yet', short: '' };
  const leftMs = istMs(last) + WINDOW_MS - nowMs;
  if (leftMs <= 0) return { open: false, leftMs: 0, level: 'closed', label: 'Reply window closed', short: '' };
  const h = Math.floor(leftMs / 3600000), m = Math.max(1, Math.floor((leftMs % 3600000) / 60000));
  const text = h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`;
  const level = leftMs < 3600000 ? 'urgent' : leftMs < 3 * 3600000 ? 'soon' : 'ok';
  return { open: true, leftMs, level, label: `${text} left to reply`, short: h ? `${h}h left` : `${m}m left` };
}

/** They wrote last (or after our last typed/template message) and the window is still open. */
export function needsReply(chat, messages, nowMs) {
  if (chat.optedOut || chat.flag === 'Opted out') return false;
  const w = replyWindow(chat, messages, nowMs);
  if (!w.open) return false;
  const mine = messages.filter((m) => m.chat === chat.id);
  const lastIn = mine.filter((m) => m.dir === 'in').pop();
  const lastOut = mine.filter((m) => m.dir === 'out' && m.status !== 'failed' && !m.auto).pop();
  return !lastOut || lastOut.time < lastIn.time;
}

/** Chats that need a reply, the least time left first. */
export function replyQueue(chats, messages, nowMs) {
  return chats.filter((c) => needsReply(c, messages, nowMs))
    .sort((a, b) => replyWindow(a, messages, nowMs).leftMs - replyWindow(b, messages, nowMs).leftMs);
}

/* ---------- brand tabs (26 Nov 2026) ---------- */

/**
 * Totals for the brand tabs above the chat list: { ALL: {chats, unread, needs}, SB: {...}, ... }.
 * unread = unread incoming messages (same as the Unread filter), needs = chats waiting for a reply inside the 24 h window.
 * A chat with an unknown brand only counts in ALL.
 */
export function brandCounts(chats, messages, { brands = [], lastSeen = {}, nowMs = Date.now() } = {}) {
  const zero = () => ({ chats: 0, unread: 0, needs: 0 });
  const out = { ALL: zero() };
  brands.forEach((b) => { out[b] = zero(); });
  const waiting = new Set(replyQueue(chats, messages, nowMs).map((c) => c.id));
  chats.forEach((c) => {
    const unread = chatFacts(c, messages, lastSeen).unread, needs = waiting.has(c.id) ? 1 : 0;
    [out.ALL, out[c.brand]].forEach((t) => { if (t) { t.chats++; t.unread += unread; t.needs += needs; } });
  });
  return out;
}

/** Brand from the link (?brand=sb) or the saved choice; anything unknown means all brands. */
export function pickBrand(value, codes) {
  const v = String(value || '').trim().toUpperCase();
  return codes.includes(v) ? v : 'ALL';
}
