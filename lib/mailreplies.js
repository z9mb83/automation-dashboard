/**
 * Email reply tracker (pure, unit-tested in test/mailreplies.test.mjs).
 * Data from the sheet feed ?mail=threads (hidden "Mail Threads" tab, filled by the email sender every 15 minutes):
 *   threads: [{ brand, email, name, phone, mailbox, threadId, subject, emailedAt, firstReplyAt, lastReplyAt,
 *               replies, lastFromUsAt, status: 'Waiting for us'|'Answered'|'Auto-reply'|'Bounce', handledAt, handledBy, updated }]
 *   sync:    [{ mailbox, lastCheck, result }]
 * Times are India time 'yyyy-mm-dd hh:mm'.
 */
import { istMs } from './inbox.js';

export const MAIL_FILTERS = [
  { key: 'waiting', label: 'Needs reply' },
  { key: 'answered', label: 'Answered' },
  { key: 'handled', label: 'Marked handled' },
  { key: 'auto', label: 'Auto-replies' },
  { key: 'bounce', label: 'Bounced' },
  { key: 'all', label: 'All' },
];

/** waiting | answered | handled | auto | bounce */
export function replyState(t) {
  if (t.status === 'Bounce') return 'bounce';
  if (t.status === 'Auto-reply') return 'auto';
  if (t.status === 'Answered') return 'answered';
  if (t.handledAt && t.handledAt >= t.lastReplyAt) return 'handled';
  return 'waiting';
}

const H = 3600000;
/** How long a lead has waited: { ms, text: '3 h 20 m' | '2 days', level: 'ok' (< 4 h) | 'soon' (< 24 h) | 'late' } */
export function waitInfo(t, nowMs) {
  const start = istMs(t.lastReplyAt);
  if (!start) return { ms: 0, text: '', level: 'ok' };
  const ms = Math.max(0, nowMs - start);
  const days = Math.floor(ms / (24 * H)), h = Math.floor(ms / H), m = Math.floor((ms % H) / 60000);
  const text = days >= 2 ? `${days} days` : days === 1 ? `1 day${h % 24 ? ` ${h % 24} h` : ''}` : h ? `${h} h ${String(m).padStart(2, '0')} m` : `${Math.max(1, m)} m`;
  return { ms, text, level: ms < 4 * H ? 'ok' : ms < 24 * H ? 'soon' : 'late' };
}

const inBrand = (brand) => (t) => brand === 'ALL' || t.brand === brand;

/** Counts for the tiles; medianAnswerMs = typical time from their reply to our answer (answered threads). */
export function mailSummary(threads, nowMs, brand = 'ALL') {
  const mine = threads.filter(inBrand(brand));
  const count = (s) => mine.filter((t) => replyState(t) === s).length;
  const waiting = mine.filter((t) => replyState(t) === 'waiting');
  const answerTimes = mine.filter((t) => replyState(t) === 'answered' && t.lastFromUsAt && t.firstReplyAt)
    .map((t) => istMs(t.lastFromUsAt) - istMs(t.firstReplyAt)).filter((x) => x >= 0).sort((a, b) => a - b);
  return {
    waiting: waiting.length, answered: count('answered'), handled: count('handled'), auto: count('auto'), bounce: count('bounce'),
    late: waiting.filter((t) => waitInfo(t, nowMs).level === 'late').length,
    oldestWait: waiting.length ? waitInfo(waiting.reduce((a, b) => (a.lastReplyAt < b.lastReplyAt ? a : b)), nowMs) : null,
    medianAnswerMs: answerTimes.length ? answerTimes[Math.floor((answerTimes.length - 1) / 2)] : null,
  };
}

export function matchesMail(t, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  const d = s.replace(/\D/g, '');
  if (d.length >= 3 && String(t.phone || '').replace(/\D/g, '').includes(d)) return true;
  return [t.name, t.email, t.subject].some((v) => String(v || '').toLowerCase().includes(s));
}

/** The list: "Needs reply" waits longest first; everything else newest reply first. */
export function mailQueue(threads, { brand = 'ALL', filter = 'waiting', q = '' } = {}) {
  const list = threads.filter(inBrand(brand)).filter((t) => filter === 'all' || replyState(t) === filter).filter((t) => matchesMail(t, q));
  return list.sort((a, b) => (filter === 'waiting' ? (a.lastReplyAt < b.lastReplyAt ? -1 : 1) : (a.lastReplyAt < b.lastReplyAt ? 1 : -1)));
}

/** Opens the exact conversation in the mailbox that sent it. */
export const gmailThreadLink = (t) => `https://mail.google.com/mail/u/${encodeURIComponent(t.mailbox)}/#all/${encodeURIComponent(t.threadId)}`;

/** Last successful check, and mailboxes whose last check failed. */
export function syncStatus(sync) {
  const ok = (sync || []).filter((s) => s.result === 'OK').map((s) => s.lastCheck).sort();
  return { running: (sync || []).length > 0, lastCheck: ok.length ? ok[ok.length - 1] : '',
    failing: (sync || []).filter((s) => s.result && s.result !== 'OK') };
}

export const durationText = (ms) => (ms === null || ms === undefined ? '–'
  : ms < H ? `${Math.max(1, Math.round(ms / 60000))} m` : ms < 48 * H ? `${Math.round(ms / H)} h` : `${Math.round(ms / (24 * H))} days`);
