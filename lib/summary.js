/**
 * One plain-English sentence on top of each chart, so nobody has to read the chart to get the point.
 * Pure functions (unit-tested in test/summary.test.mjs). All counts come from the dashboard view.
 */

const n = (x) => (x || 0).toLocaleString('en-IN');
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);
/** '40%', or 'under 1%' when a non-zero part rounds to 0 */
export const pctText = (part, whole) => (part > 0 && pct(part, whole) === 0 ? 'under 1%' : `${pct(part, whole)}%`);
const plural = (x, one, many) => `${n(x)} ${x === 1 ? one : many}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (d) => { const [, m, dd] = d.split('-'); return `${+dd} ${MONTHS[+m - 1]}`; };

const dayTotal = (d, series) => series.reduce((s, k) => s + ((d.values || {})[k.key] || 0), 0);
const brandTotals = (days, series) =>
  series.map((s) => ({ ...s, value: days.reduce((t, d) => t + ((d.values || {})[s.key] || 0), 0) })).sort((a, b) => b.value - a.value);

/** "196 emails sent in the last 7 days, about 28 a day. Busiest day: 25 Sep (34)." */
export function perDaySummary(days, series, { one, many, verb }) {
  const totals = days.map((d) => dayTotal(d, series));
  const total = totals.reduce((a, b) => a + b, 0);
  if (!total) return `No ${many} ${verb} in this period.`;
  const active = totals.filter((t) => t > 0).length;
  let best = 0;
  totals.forEach((t, i) => { if (t > totals[best]) best = i; });
  let s = `${plural(total, one, many)} ${verb} in the last ${days.length} days`;
  if (active > 1) s += `, about ${n(Math.round(total / active))} a day on days with activity`;
  s += `. Busiest day: ${day(days[best].date)} (${n(totals[best])}).`;
  const top = brandTotals(days, series);
  if (series.length > 1 && top[0].value && top[0].value / total >= 0.5) s += ` Most came from ${top[0].label}.`;
  return s;
}

/** "Most emails went from Shaadi Bells (74 of 196). Best reply rate: 99 Staffing Services (3.8%)." */
export function brandSummary(rows) {
  const total = rows.reduce((s, r) => s + r.sent, 0);
  if (!total) return 'No emails sent in this period.';
  if (rows.length === 1) {
    const r = rows[0];
    return `${plural(r.sent, 'email', 'emails')} sent and ${plural(r.replies, 'reply', 'replies')} (${r.sent ? ((r.replies / r.sent) * 100).toFixed(1) : 0}% reply rate).`;
  }
  const top = [...rows].sort((a, b) => b.sent - a.sent)[0];
  let s = `Most emails went from ${top.label} (${n(top.sent)} of ${n(total)}).`;
  const fair = rows.filter((r) => r.sent >= 10 && r.replies > 0); // too few sends say nothing about a rate
  if (fair.length) {
    const best = fair.sort((a, b) => b.replies / b.sent - a.replies / a.sent)[0];
    s += ` Best reply rate: ${best.label} (${((best.replies / best.sent) * 100).toFixed(1)}%).`;
  } else s += ' No brand has enough replies yet to compare reply rates.';
  return s;
}

/** Lead pipeline donut. totals: {toDraft, drafts, approved, sentOnly, replied, leads} */
export function pipelineSummary(t) {
  const leads = (t.toDraft || 0) + (t.drafts || 0) + (t.approved || 0) + (t.sentOnly || 0) + (t.replied || 0);
  if (!leads) return 'No leads in the sheet yet.';
  const emailed = (t.sentOnly || 0) + (t.replied || 0);
  let s = `Of ${plural(leads, 'lead', 'leads')}, ${n(emailed)} (${pctText(emailed, leads)}) have been emailed and ${n(t.replied || 0)} replied (${pctText(t.replied || 0, emailed)} of those emailed).`;
  if (t.approved) s += ` ${n(t.approved)} are approved and waiting to send.`;
  if (t.drafts) s += ` ${plural(t.drafts, 'draft needs', 'drafts need')} review.`;
  return s;
}

/** WhatsApp delivery donut. totals: {read, delivered (not read), pending, failed} */
export function deliverySummary(t) {
  const all = (t.read || 0) + (t.delivered || 0) + (t.pending || 0) + (t.failed || 0);
  if (!all) return 'No WhatsApp messages sent yet.';
  const parts = [`Of ${plural(all, 'message', 'messages')} sent, ${pctText(t.read, all)} were read`];
  if (t.delivered) parts.push(`${pctText(t.delivered, all)} arrived but are not read yet`);
  let s = parts.join(' and ') + '.';
  if (t.failed) s += ` ${plural(t.failed, 'message', 'messages')} did not arrive (reasons in the list).`;
  if (t.pending) s += ` ${n(t.pending)} ${t.pending === 1 ? 'has' : 'have'} no delivery report (mostly sent before 29 Sep, when reports started).`;
  return s;
}
