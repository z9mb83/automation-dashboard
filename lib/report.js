/**
 * Download report: turns the feed's lead list (feed ?report=leads) into the sheets of an Excel file.
 * Pure functions, unit-tested in test/report.test.mjs.
 *
 * A lead is in the report when, inside the chosen dates (India time), it was sent the message
 * OR it replied. So "Today" also shows replies that arrived today to messages sent earlier.
 */
import { BRANDS } from './brands.js';

export const TYPES = { mail: 'Mail', whatsapp: 'WhatsApp', combined: 'Combined' };
const brandName = (code) => (BRANDS.find((b) => b.code === code) || {}).name || code;
const inRange = (stamp, from, to) => { const d = String(stamp || '').slice(0, 10); return !!d && d >= from && d <= to; };
const yes = (v) => (v ? 'Yes' : '');
const MAIL_SENT = ['Sent', 'Bounced', 'Unsubscribed'];

/** 'yyyy-mm-dd' (India time) for a Date. */
export function indiaDate(now = new Date()) { return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10); }

/** Validates query values. Returns {type, brand, from, to} or {error}. */
export function reportParams(q, today) {
  const type = TYPES[q.type] ? q.type : 'combined';
  const brand = q.brand && BRANDS.some((b) => b.code === q.brand) ? q.brand : 'ALL';
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const from = ok(q.from) ? q.from : today, to = ok(q.to) ? q.to : from;
  if (from > to) return { error: 'The start date is after the end date.' };
  return { type, brand, from, to };
}

function pick(leads, { type, brand, from, to }) {
  return leads.filter((l) => brand === 'ALL' || l.brand === brand).filter((l) => {
    const m = l.mail && (inRange(l.mail.sentAt, from, to) || (l.mail.replied && inRange(l.mail.repliedAt, from, to)));
    const w = l.whatsapp && (inRange(l.whatsapp.sentAt, from, to) || (l.whatsapp.replied && inRange(l.whatsapp.repliedAt, from, to)));
    return type === 'mail' ? m : type === 'whatsapp' ? w : m || w;
  });
}

function counts(leads, codes, { from, to }) {
  return codes.map((code) => {
    const mine = leads.filter((l) => l.brand === code);
    const mail = mine.map((l) => l.mail).filter(Boolean), wa = mine.map((l) => l.whatsapp).filter(Boolean);
    const sentM = mail.filter((m) => inRange(m.sentAt, from, to));
    const sentW = wa.filter((w) => inRange(w.sentAt, from, to));
    return {
      code, name: brandName(code),
      mailSent: sentM.filter((m) => MAIL_SENT.includes(m.status)).length,
      mailFailed: sentM.filter((m) => m.status === 'Failed').length,
      mailBounced: sentM.filter((m) => m.status === 'Bounced' || m.status === 'Unsubscribed').length,
      mailReplies: mail.filter((m) => m.replied && inRange(m.repliedAt, from, to)).length,
      waSent: sentW.filter((w) => w.status === 'Sent').length,
      waFailed: sentW.filter((w) => w.status !== 'Sent').length,
      waDelivered: sentW.filter((w) => w.delivery === 'Delivered' || w.delivery === 'Read').length,
      waRead: sentW.filter((w) => w.delivery === 'Read').length,
      waNotDelivered: sentW.filter((w) => String(w.delivery).startsWith('Failed')).length,
      waReplies: wa.filter((w) => w.replied && inRange(w.repliedAt, from, to)).length,
    };
  });
}

export const periodText = ({ from, to }) => (from === to ? from : `${from} to ${to}`);

/** Report file name, e.g. "Combined report - All brands - 2026-10-17.xlsx" */
export function reportFileName(p) {
  return `${TYPES[p.type]} report - ${p.brand === 'ALL' ? 'All brands' : p.brand} - ${periodText(p)}.xlsx`;
}

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 + '%' : '');

/** feed = {generatedAt, leads}; p = reportParams(). Returns [{name, rows, header, widths}] for buildXlsx. */
export function reportSheets(feed, p) {
  const codes = p.brand === 'ALL' ? BRANDS.map((b) => b.code) : [p.brand];
  const leads = pick(feed.leads || [], p);
  const c = counts(feed.leads || [], codes, p);
  const sum = (k) => c.reduce((s, r) => s + r[k], 0);
  const showMail = p.type !== 'whatsapp', showWa = p.type !== 'mail';

  const summary = [
    [{ v: `${TYPES[p.type]} report`, bold: true }],
    ['Period', periodText(p) + ' (India time)'],
    ['Brand', p.brand === 'ALL' ? 'All brands' : `${p.brand} - ${brandName(p.brand)}`],
    ['Generated', `${feed.generatedAt || ''} India time`],
    ['Leads in this report', leads.length],
    [],
  ];
  const head = ['Brand'];
  if (showMail) { head.push('Emails sent', 'Failed', 'Bounced / unsubscribed', 'Email replies', 'Reply rate') }
  if (showWa) { head.push('WhatsApp sent', 'Not sent (failed)', 'Delivered', 'Read', 'Not delivered', 'WhatsApp replies', 'Reply rate') }
  summary.push(head.map((v) => ({ v, bold: true })));
  const line = (label, r) => {
    const row = [label];
    if (showMail) row.push(r.mailSent, r.mailFailed, r.mailBounced, r.mailReplies, pct(r.mailReplies, r.mailSent));
    if (showWa) row.push(r.waSent, r.waFailed, r.waDelivered, r.waRead, r.waNotDelivered, r.waReplies, pct(r.waReplies, r.waSent));
    return row;
  };
  c.forEach((r) => summary.push(line(`${r.code} - ${r.name}`, r)));
  if (c.length > 1) {
    const t = Object.fromEntries(Object.keys(c[0]).filter((k) => typeof c[0][k] === 'number').map((k) => [k, sum(k)]));
    summary.push(line('Total', t).map((v) => ({ v, bold: true })));
  }
  summary.push([], ['Replies count the replies received in the period, also to messages sent earlier.']);
  const sheets = [{ name: 'Summary', rows: summary, header: -1, widths: [34, ...head.slice(1).map(() => 14)] }];

  const sort = (get) => [...leads].sort((a, b) => String(get(b) || '').localeCompare(String(get(a) || '')));
  if (p.type === 'mail') {
    sheets.push({ name: 'Emails', header: 0, widths: [8, 24, 30, 16, 12, 17, 30, 40, 9, 17, 40],
      rows: [['Brand', 'Name', 'Email', 'Phone', 'Status', 'Sent at', 'Sent from', 'Subject', 'Replied', 'Replied at', 'Error'],
        ...sort((l) => l.mail.sentAt).map((l) => [l.brand, l.name, l.email, l.phone, l.mail.status, l.mail.sentAt, l.mail.from,
          l.mail.subject, yes(l.mail.replied), l.mail.repliedAt, l.mail.error])] });
  } else if (p.type === 'whatsapp') {
    sheets.push({ name: 'WhatsApp', header: 0, widths: [8, 24, 16, 30, 12, 17, 22, 9, 17, 50, 40],
      rows: [['Brand', 'Name', 'Phone', 'Email', 'Status', 'Sent at', 'Delivery', 'Replied', 'Replied at', 'Last reply', 'Message ID / error'],
        ...sort((l) => l.whatsapp.sentAt).map((l) => [l.brand, l.name, l.phone, l.email, l.whatsapp.status, l.whatsapp.sentAt,
          l.whatsapp.delivery, yes(l.whatsapp.replied), l.whatsapp.repliedAt, l.whatsapp.lastReply, l.whatsapp.info])] });
  } else {
    const m = (l, k) => (l.mail ? l.mail[k] : ''), w = (l, k) => (l.whatsapp ? l.whatsapp[k] : '');
    const last = (l) => [m(l, 'sentAt'), w(l, 'sentAt'), m(l, 'repliedAt'), w(l, 'repliedAt')].sort().pop();
    sheets.push({ name: 'Leads', header: 0, widths: [8, 24, 30, 16, 9, 12, 17, 30, 9, 17, 12, 17, 20, 9, 17, 50],
      rows: [['Brand', 'Name', 'Email', 'Phone', 'Any reply', 'Email status', 'Email sent at', 'Sent from', 'Email replied', 'Email replied at',
        'WhatsApp status', 'WhatsApp sent at', 'WhatsApp delivery', 'WhatsApp replied', 'WhatsApp replied at', 'WhatsApp last reply'],
        ...sort(last).map((l) => [l.brand, l.name, l.email, l.phone, yes((l.mail && l.mail.replied) || (l.whatsapp && l.whatsapp.replied)),
          m(l, 'status'), m(l, 'sentAt'), m(l, 'from'), yes(m(l, 'replied')), m(l, 'repliedAt'),
          w(l, 'status'), w(l, 'sentAt'), w(l, 'delivery'), yes(w(l, 'replied')), w(l, 'repliedAt'), w(l, 'lastReply')])] });
  }
  return sheets;
}
