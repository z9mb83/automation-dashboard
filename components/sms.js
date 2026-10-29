'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { brandVar } from '../lib/brands';
import { OUTCOMES, RATE, SMS_TEMPLATES, smsSummary, stopList } from '../lib/sms';
import { ChartCard, Donut, Legend, StackedColumns, dayLabel, fmt } from './charts';
import { perDaySummary } from '../lib/summary';

const OUTCOME_COLORS = { delivered: 'var(--good)', dnd: 'var(--critical)', invalid: 'var(--warning)', unreachable: 'var(--series-1)', other: 'var(--stage-1)', pending: 'var(--axis)' };
const tplName = (k) => (SMS_TEMPLATES.find((t) => t.key === k) || { name: 'Other text' }).name;
const label = (k) => (OUTCOMES.find((o) => o.key === k) || { label: k }).label;
const rupees = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pretty = (p) => (String(p).length === 10 ? `+91 ${String(p).slice(0, 5)} ${String(p).slice(5)}` : p);

/** /api/sms loader, shared by the SMS page and the Home card. */
export function useSms(days) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sms?days=' + days, { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setData(j); setError('');
    } catch (e) { setError(String(e.message || e)); } finally { setLoading(false); }
  }, [days]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, load };
}

/** Home page card. */
export function SmsChoice({ go }) {
  const { data } = useSms(7);
  const today = data ? smsSummary(data.rows, { from: data.to, to: data.to }) : null;
  const week = data ? smsSummary(data.rows, { from: data.from, to: data.to }) : null;
  return (
    <button className="card choice" onClick={() => go('sms')} aria-label="Open SMS">
      <div className="choice-head"><SmsIcon /><h2>SMS</h2><span className="chev" aria-hidden="true">&rarr;</span></div>
      <div className="choice-stats">
        <div><div className="value">{today ? fmt(today.total.sent) : '…'}</div><div className="label">sent today</div></div>
        <div><div className="value">{week ? week.deliveredPct + '%' : '…'}</div><div className="label">delivered, 7 days</div></div>
        <div><div className="value">{week ? fmt(week.total.dnd) : '…'}</div><div className="label">DND blocked, 7 days</div></div>
      </div>
      <p className="sub">OCR sheets (Shaadi, Property) via Telinfy: delivery per template, DND and failed numbers</p>
    </button>
  );
}

export function SmsView({ range, brand }) {
  const { data, error, loading, load } = useSms(range);
  const s = useMemo(() => (data ? smsSummary(data.rows, { from: data.from, to: data.to, brand }) : null), [data, brand]);
  const stops = useMemo(() => (data ? stopList(data.rows.filter((r) => brand === 'ALL' || r.brand === brand)) : []), [data, brand]);

  if (!data) return error ? <div className="banner err">Could not load SMS reports: {error}</div> : <p className="muted">Loading SMS reports from Telinfy…</p>;
  const series = s.byTemplate.map((t) => ({ key: t.key, label: t.name, color: brandVar(t.brand || 'SB') }));
  const failed = s.total.sent - s.total.delivered - s.total.pending;
  return (
    <div className={loading ? 'stale' : ''}>
      {data.sample ? <div className="banner">Showing <b>sample SMS data</b>: add TELINFY_API_KEY on Vercel to see the real Telinfy reports.</div> : null}
      {error ? <div className="banner err">Could not refresh: {error}. Showing the last good data.</div> : null}
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
        Telinfy reports, updated {data.generatedAt.slice(11)} India time · <button className="linkbtn" onClick={load}>{loading ? 'Updating…' : 'Refresh'}</button>
      </p>
      <div className="grid kpis">
        <div className="card tile hero"><div className="label">SMS sent</div><div className="value">{fmt(s.total.sent)}</div><div className="note">last {range} days</div></div>
        <div className="card tile"><div className="label">Delivered</div><div className="value">{fmt(s.total.delivered)}</div><div className="note">{s.deliveredPct}% of those with a report</div></div>
        <div className="card tile"><div className="label">Blocked by DND</div><div className="value">{fmt(s.total.dnd)}</div><div className="note">charged but never delivered</div></div>
        <div className="card tile"><div className="label">Other failures</div><div className="value">{fmt(failed - s.total.dnd)}</div><div className="note">number not in use, phone off…</div></div>
        <div className="card tile"><div className="label">Cost (estimate)</div><div className="value">{rupees(s.cost)}</div><div className="note">₹{RATE} per SMS · {rupees(s.total.dnd * RATE)} on DND</div></div>
        <div className="card tile"><div className="label">Telinfy wallet</div><div className="value" style={{ fontSize: data.wallet === null ? 18 : undefined }}>{data.wallet === null ? '–' : rupees(data.wallet)}</div><div className="note">balance now</div></div>
      </div>

      <div className="section">
        <ChartCard title="SMS sent per day" sub={`Last ${range} days, by template · hover a day for details`}
          summary={perDaySummary(s.days, series, { one: 'SMS', many: 'SMS', verb: 'sent' })}
          legend={series.length > 1 ? <Legend items={series} /> : null}
          chart={<StackedColumns days={s.days} series={series} unit="SMS sent" height={220} />}
          table={<table><thead><tr><th>Day</th>{series.map((x) => <th key={x.key} className="r">{x.label}</th>)}<th className="r">Total</th><th className="r">Delivered</th></tr></thead>
            <tbody>{[...s.days].reverse().map((d) => <tr key={d.date}><td>{dayLabel(d.date)}</td>{series.map((x) => <td key={x.key} className="r">{d.values[x.key] || 0}</td>)}
              <td className="r"><b>{d.sent}</b></td><td className="r">{d.delivered}</td></tr>)}</tbody></table>} />
      </div>

      <div className="grid two section">
        <ChartCard title="What happened to the SMS" sub={`Last ${range} days · from the operators' delivery reports`}
          summary={s.total.sent ? `${fmt(s.total.delivered)} of ${fmt(s.total.sent)} SMS were delivered; ${fmt(s.total.dnd)} were blocked by DND.` : 'No SMS in this period.'}
          chart={<Donut slices={OUTCOMES.map((o) => ({ key: o.key, label: o.label, color: OUTCOME_COLORS[o.key], value: s.total[o.key] || 0 })).filter((x) => x.value)} centerLabel="SMS" />}
          table={<table><thead><tr><th>Result</th><th className="r">SMS</th></tr></thead>
            <tbody>{OUTCOMES.map((o) => <tr key={o.key}><td>{o.label}</td><td className="r">{s.total[o.key] || 0}</td></tr>)}</tbody></table>} />
        <section className="card">
          <h2>Per template</h2><p className="sub">Each SMS is matched to its DLT template by its text</p>
          <div className="tablewrap"><table className="stack">
            <thead><tr><th>Template</th><th className="r">Sent</th><th className="r">Delivered</th><th className="r">DND</th><th className="r">Other failed</th><th className="r">Cost</th></tr></thead>
            <tbody>{s.byTemplate.length ? s.byTemplate.map((t) => {
              const settled = t.sent - t.pending;
              return (
                <tr key={t.key}><td><span className="brandcell"><i className="swatch" style={{ background: brandVar(t.brand || 'SB') }} />{t.name}</span></td>
                  <td className="r">{t.sent}</td><td className="r">{t.delivered}{settled ? <span className="muted"> ({Math.round((t.delivered / settled) * 100)}%)</span> : null}</td>
                  <td className="r">{t.dnd}</td><td className="r">{t.invalid + t.unreachable + t.other}</td><td className="r">{rupees(t.sent * RATE)}</td></tr>
              );
            }) : <tr><td colSpan={6} className="empty">No SMS in this period.</td></tr>}</tbody>
          </table></div>
        </section>
      </div>

      <div className="section">
        <section className="card">
          <h2>Numbers to stop texting</h2>
          <p className="sub">{fmt(stops.length)} numbers are on DND or not in use, so Telinfy charges for SMS that can never arrive. Newest first; the full list is in the SMS report download (sheet &ldquo;Stop texting&rdquo;).</p>
          <div className="tablewrap">{stops.length ? (
            <table className="stack"><thead><tr><th>Mobile</th><th>Template</th><th>Why</th><th>Last sent</th></tr></thead>
              <tbody>{stops.slice(0, 25).map((r) => (
                <tr key={r.phone}><td className="num">{pretty(r.phone)}</td><td>{tplName(r.template)}</td><td>{r.reason}</td><td className="num">{dayLabel(r.sentAt.slice(0, 10))}, {r.sentAt.slice(11, 16)}</td></tr>
              ))}</tbody></table>) : <p className="empty">None in this period.</p>}</div>
        </section>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>Source: Telinfy delivery reports (sender 099559), read-only. The OCR sheets are not changed. Times are India time. &ldquo;{label('pending')}&rdquo; means the operator has not sent its report yet.</p>
    </div>
  );
}

const SmsIcon = () => (
  <svg className="choice-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 18.5h4M9 7.5h6M9 10.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
