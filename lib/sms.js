/**
 * SMS reports (Telinfy, sender 099559) for the OCR -> DLT SMS sheets. Pure functions, unit-tested in test/sms.test.mjs.
 *
 * Telinfy GET /api/v1/sms/reports?startDate&endDate returns
 *   { success, message, count, data: [{ record_id, message, mobile_number, status, sender_name, recv_timestamp, done_timestamp, error_code }] }
 * status 1 = delivered, 6 = failed (error_code says why). Timestamps are UTC ISO strings.
 * Telinfy's own template column is not reliable, so each SMS is matched to its DLT template by its text.
 */

// DLT templates (sender 099559). Order matters: the first match wins.
export const SMS_TEMPLATES = [
  { key: 'SHAADI', name: 'Shaadi - Outreach', brand: 'SB', test: (t) => /^Elite Matrimonial Solutions/i.test(t) },
  { key: 'SHAADI_OLD', name: 'Shaadi - Outreach (old)', brand: 'SB', test: (t) => /Elite Matrimonial Solutions/i.test(t) },
  { key: 'PEG', name: 'Property Experts Group', brand: 'PE', test: (t) => /Property Experts Group/i.test(t) },
  { key: 'SKYLINE', name: 'Skyline Capital', brand: 'SC', test: (t) => /Skyline/i.test(t) },
  { key: 'STAFFING', name: '99 Staffing Services', brand: '99S', test: (t) => /^99 Staffing Services/i.test(t) },
  { key: 'CONSULTING', name: '99 Consulting Services', brand: '99M', test: (t) => /^99 Consulting Services:/i.test(t) },
];
const OTHER = { key: 'OTHER', name: 'Other text', brand: '' };
export const templateOf = (text) => SMS_TEMPLATES.find((x) => x.test(String(text || ''))) || OTHER;

/** What happened to an SMS, from Telinfy's status + error code (same codes as the dashboard CSV). */
export const OUTCOMES = [
  { key: 'delivered', label: 'Delivered' },
  { key: 'dnd', label: 'Blocked by DND' },
  { key: 'invalid', label: 'Number not in use / barred' },
  { key: 'unreachable', label: 'Phone off / inbox full' },
  { key: 'other', label: 'Other failure' },
  { key: 'pending', label: 'No report yet' },
];
const ERRORS = {
  650: ['dnd', 'Blocked by DND (customer preference)'],
  3: ['invalid', 'Number not in use (unknown subscriber)'],
  2: ['invalid', 'Number barred by the operator'],
  34: ['unreachable', 'Phone switched off / out of coverage'],
  12: ['unreachable', 'SMS inbox full'],
  5: ['other', 'Operator system failure'],
  19: ['other', 'Operator error'],
  42: ['other', 'Other operator error'],
};
export function outcome(status, code) {
  const s = Number(status), c = Number(code);
  if (s === 1 || (c === 0 && s !== 6 && s)) return { key: 'delivered', reason: 'Delivered' };
  if (s === 6 || c) { const e = ERRORS[c]; return e ? { key: e[0], reason: e[1] } : { key: 'other', reason: 'Failed (code ' + c + ')' }; }
  return { key: 'pending', reason: 'Waiting for the operator report' };
}

/** UTC ISO -> India time 'yyyy-mm-dd hh:mm:ss' ('' if missing). */
export function istFromUtc(iso) {
  const ms = Date.parse(iso || '');
  return Number.isFinite(ms) ? new Date(ms + 330 * 60000).toISOString().slice(0, 19).replace('T', ' ') : '';
}
export const indiaDate = (now = new Date()) => new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** One Telinfy record -> what the dashboard needs (no message text: the template says it). */
export function normalize(r) {
  const t = templateOf(r.message), o = outcome(r.status, r.error_code);
  const d = String(r.mobile_number || '').replace(/\D/g, '');
  return {
    id: r.record_id, template: t.key, brand: t.brand, phone: d.length === 12 && d.startsWith('91') ? d.slice(2) : d,
    sentAt: istFromUtc(r.recv_timestamp), doneAt: istFromUtc(r.done_timestamp),
    outcome: o.key, reason: o.reason, code: Number(r.error_code) || 0,
  };
}

/** Telinfy response -> normalized rows sent within [from, to] (India dates), oldest first. */
export function parseReports(json, from, to) {
  if (!json || json.success === false) throw new Error((json && json.message) || 'Telinfy returned no data');
  return (Array.isArray(json.data) ? json.data : []).map(normalize)
    .filter((r) => r.sentAt && r.sentAt.slice(0, 10) >= from && r.sentAt.slice(0, 10) <= to)
    .sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : a.id - b.id));
}

/** Validates ?from&to (India dates, at most 92 days). Defaults: last `days` days ending today. */
export function smsParams(q, today, days = 7) {
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const to = ok(q.to) ? q.to : today, from = ok(q.from) ? q.from : addDays(to, -(days - 1));
  if (from > to) return { error: 'The start date is after the end date.' };
  if (Date.parse(to) - Date.parse(from) > 91 * 86400000) return { error: 'Choose at most 92 days at a time.' };
  return { from, to };
}

const blank = () => ({ sent: 0, delivered: 0, dnd: 0, invalid: 0, unreachable: 0, other: 0, pending: 0 });
const add = (c, r) => { c.sent += 1; c[r.outcome] += 1; return c; };

/** Rate per SMS in rupees (Telinfy's report shows 0.22 INR per SMS for these templates). */
export const RATE = 0.22;

/** Totals per template + per day; brand = 'ALL' or a brand code. */
export function smsSummary(rows, { from, to, brand = 'ALL' } = {}) {
  const mine = rows.filter((r) => brand === 'ALL' || r.brand === brand);
  const total = mine.reduce(add, blank());
  const byTemplate = [...SMS_TEMPLATES, OTHER].map((t) => ({ key: t.key, name: t.name, brand: t.brand,
    ...mine.filter((r) => r.template === t.key).reduce(add, blank()) })).filter((t) => t.sent);
  const days = [];
  if (from && to) for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, values: {}, delivered: 0, sent: 0 });
  mine.forEach((r) => {
    const day = days.find((x) => x.date === r.sentAt.slice(0, 10));
    if (!day) return;
    day.values[r.template] = (day.values[r.template] || 0) + 1; day.sent += 1; if (r.outcome === 'delivered') day.delivered += 1;
  });
  const settled = total.sent - total.pending;
  return { total, byTemplate, days, deliveredPct: settled ? Math.round((total.delivered / settled) * 1000) / 10 : 0,
    cost: Math.round(total.sent * RATE * 100) / 100 };
}

/** Numbers worth removing from the sheets (DND or not in use): one row per number, latest result. */
export function stopList(rows) {
  const m = new Map();
  rows.filter((r) => r.outcome === 'dnd' || r.outcome === 'invalid').forEach((r) => m.set(r.phone, r));
  return [...m.values()].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

const tplName = (k) => (SMS_TEMPLATES.find((t) => t.key === k) || OTHER).name;
const pctText = (a, b) => (b ? Math.round((a / b) * 1000) / 10 + '%' : '');

/** Excel sheets for the report download (same shape as lib/report.js -> lib/xlsx.js). */
export function smsReportSheets(rows, { from, to, brand = 'ALL' }, generatedAt = '') {
  const s = smsSummary(rows, { from, to, brand });
  const mine = rows.filter((r) => brand === 'ALL' || r.brand === brand);
  const head = ['Template', 'Sent', 'Delivered', 'Blocked by DND', 'Not in use / barred', 'Phone off / inbox full', 'Other failure', 'No report yet', 'Delivery rate', 'Cost (Rs, est.)'];
  const line = (label, c) => [label, c.sent, c.delivered, c.dnd, c.invalid, c.unreachable, c.other, c.pending, pctText(c.delivered, c.sent - c.pending), Math.round(c.sent * RATE * 100) / 100];
  const summary = [
    [{ v: 'SMS report', bold: true }],
    ['Period', (from === to ? from : `${from} to ${to}`) + ' (India time)'],
    ['Templates', brand === 'ALL' ? 'All' : s.byTemplate.map((t) => t.name).join(', ') || brand],
    ['Generated', generatedAt ? generatedAt + ' India time' : ''],
    ['Source', 'Telinfy delivery reports, sender 099559'],
    [],
    head.map((v) => ({ v, bold: true })),
    ...s.byTemplate.map((t) => line(t.name, t)),
  ];
  if (s.byTemplate.length > 1) summary.push(line('Total', s.total).map((v) => ({ v, bold: true })));
  summary.push([], ['Cost is an estimate at Rs ' + RATE + ' per SMS (Telinfy charges failed and DND messages too).']);
  const days = [['Day', ...s.byTemplate.map((t) => t.name), 'Total', 'Delivered'],
    ...s.days.filter((d) => d.sent).map((d) => [d.date, ...s.byTemplate.map((t) => d.values[t.key] || 0), d.sent, d.delivered])];
  const detail = [['Sent at', 'Template', 'Mobile', 'Result', 'Reason', 'Error code', 'Report at'],
    ...[...mine].reverse().map((r) => [r.sentAt, tplName(r.template), r.phone, (OUTCOMES.find((o) => o.key === r.outcome) || {}).label || r.outcome, r.reason, r.code, r.doneAt])];
  const stop = [['Mobile', 'Template', 'Why', 'Last sent'], ...stopList(mine).map((r) => [r.phone, tplName(r.template), r.reason, r.sentAt])];
  return [
    { name: 'Summary', rows: summary, header: -1, widths: [30, 9, 11, 15, 18, 20, 14, 14, 13, 14] },
    { name: 'Per day', rows: days, header: 0, widths: [12, ...s.byTemplate.map(() => 22), 9, 11] },
    { name: 'All SMS', rows: detail, header: 0, widths: [19, 24, 13, 26, 38, 10, 19] },
    { name: 'Stop texting (DND, invalid)', rows: stop, header: 0, widths: [13, 24, 40, 19] },
  ];
}

export const smsFileName = ({ from, to, brand = 'ALL' }) => `SMS report - ${brand === 'ALL' ? 'All templates' : brand} - ${from === to ? from : from + ' to ' + to}.xlsx`;

/** Pulls the first balance-like number out of Telinfy's wallet response (shape is not documented). */
export function walletBalance(json) {
  let found = null;
  const walk = (v) => {
    if (found !== null || !v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (found !== null) return;
      if (/^wallet$|balance|credit|amount/i.test(k) && x !== '' && Number.isFinite(Number(x))) { found = Number(x); return; }
      if (x && typeof x === 'object') walk(x);
    }
  };
  walk(json);
  return found;
}
