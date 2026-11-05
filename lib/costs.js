/**
 * Sending costs (pure, unit-tested in test/costs.test.mjs).
 *
 * WhatsApp (Meta Cloud API, India, per-message pricing): a template message is charged when it is DELIVERED.
 *   Our outreach templates are marketing templates. Typed replies inside the 24-hour window and the automatic
 *   opt-out confirmation are service messages: free. Failed messages are free. Meta adds 18% GST to its invoice.
 * SMS (Telinfy): Rs 0.22 is deducted from the wallet for every SMS submitted, delivered or not (DND too).
 * Email: Gmail accounts, no per-email cost.
 * Rates change (Meta can change them every quarter) - update RATES and the dashboard follows.
 */
export const RATES = {
  waMarketing: 0.8631,   // Rs per delivered marketing template, India, Meta rate card (excl. GST)
  gst: 0.18,             // GST on Meta's invoice
  sms: 0.22,             // Rs per SMS, as deducted by Telinfy
  checked: '2026-11-05',
};

const month = (t) => String(t || '').slice(0, 7);
const r2 = (n) => Math.round(n * 100) / 100;
const blankWa = () => ({ charged: 0, unknown: 0, failed: 0, free: 0 });

/** inbox = { chats, messages } from the sheet feed (?inbox=all). Counts per brand and per month. */
export function whatsappCounts(inbox) {
  const brandOf = {};
  (inbox.chats || []).forEach((c) => { brandOf[c.id] = c.brand; });
  const byBrand = {}, byMonth = {};
  (inbox.messages || []).forEach((m) => {
    if (m.dir !== 'out') return;
    const brand = brandOf[m.chat] || String(m.chat || '').split('|')[0], mo = month(m.time);
    const kind = m.kind || (m.auto ? 'auto' : m.template ? 'template' : 'reply');
    let key;
    if (kind !== 'template') key = 'free';                       // typed reply / opt-out confirmation (service)
    else if (m.status === 'failed') key = 'failed';
    else if (m.status === 'delivered' || m.status === 'read') key = 'charged';
    else key = 'unknown';                                        // sent, no delivery report (older messages)
    (byBrand[brand] = byBrand[brand] || blankWa())[key] += 1;
    (byMonth[mo] = byMonth[mo] || blankWa())[key] += 1;
  });
  return { byBrand, byMonth };
}

/** sms = normalized rows from lib/sms.js (each has brand, template, sentAt). */
export function smsCounts(rows) {
  const byBrand = {}, byMonth = {};
  rows.forEach((r) => {
    const b = r.brand || 'OTHER', mo = month(r.sentAt);
    byBrand[b] = (byBrand[b] || 0) + 1;
    byMonth[mo] = (byMonth[mo] || 0) + 1;
  });
  return { byBrand, byMonth };
}

const waMoney = (c, rates) => {
  const base = c.charged * rates.waMarketing;
  return { base: r2(base), gst: r2(base * rates.gst), total: r2(base * (1 + rates.gst)),
    unknownMax: r2(c.unknown * rates.waMarketing * (1 + rates.gst)) };
};
const sum = (list, k) => list.reduce((s, x) => s + (x[k] || 0), 0);

/** Everything the costs panel shows. codes = brand codes in display order. */
export function costSummary({ wa, sms, codes, thisMonth, rates = RATES }) {
  const brands = codes.map((code) => {
    const w = wa.byBrand[code] || blankWa(), s = sms.byBrand[code] || 0;
    const wm = waMoney(w, rates), sm = r2(s * rates.sms);
    return { code, wa: { ...w, ...wm }, sms: { count: s, total: sm }, total: r2(wm.total + sm) };
  });
  const waAll = ['charged', 'unknown', 'failed', 'free'].reduce((o, k) => ({ ...o, [k]: sum(Object.values(wa.byBrand), k) }), {});
  const smsAll = Object.values(sms.byBrand).reduce((s, n) => s + n, 0);
  const waM = waMoney(waAll, rates), smsM = r2(smsAll * rates.sms);
  const months = [...new Set([...Object.keys(wa.byMonth), ...Object.keys(sms.byMonth)])].filter(Boolean).sort().reverse().map((mo) => {
    const w = wa.byMonth[mo] || blankWa(), s = sms.byMonth[mo] || 0, x = waMoney(w, rates);
    return { month: mo, waCharged: w.charged, wa: x.total, sms: s, smsTotal: r2(s * rates.sms), total: r2(x.total + s * rates.sms) };
  });
  const cur = months.find((m) => m.month === thisMonth) || { month: thisMonth, wa: 0, smsTotal: 0, total: 0, waCharged: 0, sms: 0 };
  return {
    total: r2(waM.total + smsM),
    whatsapp: { ...waAll, ...waM },
    sms: { count: smsAll, total: smsM },
    email: { total: 0 },
    thisMonth: cur, months, brands, rates,
  };
}

export const rupees = (n, digits = 2) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const monthName = (ym) => {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return ym ? `${M[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : '';
};
