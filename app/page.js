'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BRANDS, brandVar } from '../lib/brands';
import { ChartCard, HBars, Legend, StackedColumns, StageBars, dayLabel, fmt } from '../components/charts';

const RANGES = [{ days: 7, label: '7 days' }, { days: 14, label: '14 days' }, { days: 30, label: '30 days' }];
const STAGES = [
  { key: 'toDraft', label: 'New (no draft yet)', color: 'var(--stage-1)' },
  { key: 'drafts', label: 'Draft to review', color: 'var(--stage-2)' },
  { key: 'approved', label: 'Approved, waiting', color: 'var(--stage-3)' },
  { key: 'sentOnly', label: 'Sent', color: 'var(--stage-4)' },
  { key: 'replied', label: 'Replied', color: 'var(--stage-5)' },
];
const REFRESH_MS = 60000;

function BrandCell({ code }) {
  const b = BRANDS.find((x) => x.code === code);
  return <span className="brandcell"><i className="swatch" style={{ background: brandVar(code) }} />{b ? b.name : code}</span>;
}

const Icon = ({ kind }) => (
  <svg className="ic" viewBox="0 0 16 16" aria-hidden="true">
    {kind === 'ok' ? <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      : kind === 'warn' ? <path d="M8 2l6.5 12h-13zM8 6.5v3.5M8 12v.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      : <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="8" cy="8" r="6.2" /><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" /></g>}
  </svg>
);

function mailboxStatus(m) {
  if (/invalid_grant|authentication repair/i.test(m.lastResult)) return { kind: 'bad', label: 'Needs reconnect' };
  if (m.paused) return { kind: 'bad', label: 'Paused' };
  if (!m.enabled) return { kind: 'warn', label: 'Off' };
  if (m.dailyLimit && m.sentToday >= m.dailyLimit) return { kind: 'warn', label: 'Limit reached today' };
  return { kind: 'ok', label: 'OK' };
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(7);
  const [brand, setBrand] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json); setError('');
    } catch (e) {
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    const vis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [load]);

  const view = useMemo(() => {
    if (!data) return null;
    const codes = brand === 'ALL' ? BRANDS.map((b) => b.code) : [brand];
    const series = BRANDS.filter((b) => codes.includes(b.code)).map((b) => ({ key: b.code, label: b.name, color: brandVar(b.code) }));
    const days = data.daily.slice(-range);
    const sum = (kind) => days.reduce((s, d) => s + codes.reduce((t, c) => t + (d[kind][c] || 0), 0), 0);
    const brands = data.brands.filter((b) => codes.includes(b.code));
    const total = (k) => brands.reduce((s, b) => s + (b[k] || 0), 0);
    const sent = sum('mail'), replies = sum('replies');
    return {
      codes, series, brands,
      mailDays: days.map((d) => ({ date: d.date, values: d.mail })),
      replyDays: days.map((d) => ({ date: d.date, values: d.replies })),
      today: brands.reduce((s, b) => s + (b.sentToday || 0), 0),
      failedToday: brands.reduce((s, b) => s + (b.failedToday || 0), 0),
      sent, replies, whatsapp: sum('whatsapp'), failed: sum('failed'),
      rate: sent ? (replies / sent) * 100 : 0,
      approved: total('approved'), drafts: total('drafts'),
      mailboxes: data.mailboxes.filter((m) => codes.includes(m.brand)),
      replyList: data.recentReplies.filter((r) => codes.includes(r.brand)),
      sendList: data.recentSends.filter((r) => codes.includes(r.brand)),
      waList: data.recentWhatsApp.filter((r) => codes.includes(r.brand)),
    };
  }, [data, range, brand]);

  const updated = data ? data.generatedAt : '';
  const ageMin = useMemo(() => {
    if (!updated) return 0;
    const t = Date.parse(updated.replace(' ', 'T') + ':00+05:30');
    return Math.round((Date.now() - t) / 60000);
  }, [updated, loading]);

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>Automation Dashboard</h1>
          <div className="status-line" aria-live="polite">
            <span><i className={'dot-live' + (error || ageMin > 10 ? ' dot-stale' : '')} /> {data ? `Updated ${updated.slice(11)} India time` : 'Loading…'}</span>
            <span>Refreshes every minute</span>
            <button className="linkbtn" onClick={load}>Refresh now</button>
            <form method="post" action="/api/logout" style={{ display: 'inline' }}><button className="linkbtn" type="submit">Sign out</button></form>
          </div>
        </div>
      </header>

      {data?.sample ? <div className="banner">Showing <b>sample data</b>: the sheet feed is not connected yet (set SHEET_API_URL and SHEET_API_KEY on Vercel).</div> : null}
      {error ? <div className="banner err">Could not refresh: {error}{data ? ' Showing the last good data.' : ''}</div> : null}

      <div className="filters" role="toolbar" aria-label="Filters">
        <div className="seg" aria-label="Date range">
          {RANGES.map((r) => <button key={r.days} aria-pressed={range === r.days} onClick={() => setRange(r.days)}>Last {r.label}</button>)}
        </div>
        <div className="seg" aria-label="Brand">
          <button aria-pressed={brand === 'ALL'} onClick={() => setBrand('ALL')}>All brands</button>
          {BRANDS.map((b) => (
            <button key={b.code} aria-pressed={brand === b.code} onClick={() => setBrand(b.code)} title={b.name}>
              <i className="swatch" style={{ background: brandVar(b.code) }} />{b.code}
            </button>
          ))}
        </div>
      </div>

      {view ? (
        <div className={loading && data ? 'stale' : ''}>
          <div className="grid kpis">
            <div className="card tile hero"><div className="label">Emails sent today</div><div className="value">{fmt(view.today)}</div>
              <div className="note">{view.failedToday ? `${view.failedToday} failed today` : 'No failures today'}</div></div>
            <div className="card tile"><div className="label">Emails sent</div><div className="value">{fmt(view.sent)}</div><div className="note">last {range} days</div></div>
            <div className="card tile"><div className="label">Replies</div><div className="value">{fmt(view.replies)}</div><div className="note">last {range} days</div></div>
            <div className="card tile"><div className="label">Reply rate</div><div className="value">{view.rate.toFixed(1)}%</div><div className="note">replies ÷ emails sent</div></div>
            <div className="card tile"><div className="label">WhatsApp sent</div><div className="value">{fmt(view.whatsapp)}</div>
              <div className="note">last {range} days · {data.settings.whatsappLive ? 'live' : 'test mode'}</div></div>
            <div className="card tile"><div className="label">Approved, waiting</div><div className="value">{fmt(view.approved)}</div><div className="note">{fmt(view.drafts)} drafts to review</div></div>
          </div>

          <div className="section">
            <ChartCard title="Emails sent per day" sub={`Last ${range} days, by brand · hover a day for details`}
              legend={view.series.length > 1 ? <Legend items={view.series} /> : null}
              chart={<StackedColumns days={view.mailDays} series={view.series} unit="emails sent" height={240} />}
              table={<DayTable days={view.mailDays} series={view.series} />} />
          </div>

          <div className="grid two section">
            <ChartCard title="Replies per day" sub={`Last ${range} days · from the 10 AM / 6 PM reply check`}
              legend={view.series.length > 1 ? <Legend items={view.series} /> : null}
              chart={<StackedColumns days={view.replyDays} series={view.series} unit="replies" height={200} />}
              table={<DayTable days={view.replyDays} series={view.series} />} />
            <ChartCard title="Emails sent by brand" sub={`Last ${range} days · reply rate in brackets`}
              chart={<HBars valueLabel="Emails sent" rows={view.series.map((s) => {
                const sent = view.mailDays.reduce((t, d) => t + (d.values[s.key] || 0), 0);
                const rep = view.replyDays.reduce((t, d) => t + (d.values[s.key] || 0), 0);
                return { key: s.key, label: s.label, color: s.color, value: sent, note: sent ? `(${((rep / sent) * 100).toFixed(1)}%)` : '' };
              })} />}
              table={<BrandTable view={view} />} />
          </div>

          <div className="grid two section">
            <ChartCard title="Lead pipeline" sub="All leads in each brand tab, by stage"
              legend={<Legend items={STAGES} />}
              chart={<StageBars stages={STAGES} rows={view.brands.map((b) => ({ key: b.code, label: BRANDS.find((x) => x.code === b.code)?.name || b.code,
                values: { toDraft: b.toDraft, drafts: b.drafts, approved: b.approved, sentOnly: Math.max(0, b.sent - b.replied), replied: b.replied } }))} />}
              table={<PipelineTable brands={view.brands} />} />
            <section className="card">
              <h2>Mailboxes today</h2><p className="sub">Sent today against each Gmail account&apos;s daily limit</p>
              <div className="tablewrap"><table>
                <thead><tr><th>Mailbox</th><th>Brand</th><th style={{ width: '28%' }}>Today</th><th>Status</th></tr></thead>
                <tbody>{view.mailboxes.map((m) => {
                  const st = mailboxStatus(m), pct = m.dailyLimit ? Math.min(100, (m.sentToday / m.dailyLimit) * 100) : 0;
                  return (
                    <tr key={m.brand + m.email}>
                      <td>{m.email.replace('@gmail.com', '')}<div className="muted" style={{ fontSize: 12 }}>{m.stage}</div></td>
                      <td>{m.brand}</td>
                      <td><div className="num" style={{ fontSize: 12, marginBottom: 3 }}>{m.sentToday} / {m.dailyLimit || '–'}</div>
                        <div className={'meter' + (pct >= 100 ? ' full' : '')} role="meter" aria-valuenow={m.sentToday} aria-valuemax={m.dailyLimit} aria-label="sent today"><i style={{ width: pct + '%' }} /></div></td>
                      <td><span className={'pill ' + st.kind}><Icon kind={st.kind} />{st.label}</span></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            </section>
          </div>

          <div className="grid two section">
            <section className="card">
              <h2>Latest replies</h2><p className="sub">Leads who replied to our emails (newest first)</p>
              <div className="tablewrap">{view.replyList.length ? (
                <table><thead><tr><th>Brand</th><th>Name / email</th><th>Phone</th><th>Replied</th></tr></thead>
                  <tbody>{view.replyList.map((r) => (
                    <tr key={r.brand + r.email + r.time}><td><BrandCell code={r.brand} /></td>
                      <td>{r.name}<div className="muted">{r.email}</div></td><td>{r.phone || '–'}</td><td className="num">{r.time ? dayLabel(r.time.slice(0, 10)) + ', ' + r.time.slice(11) : '–'}</td></tr>
                  ))}</tbody></table>) : <p className="empty">No replies yet.</p>}</div>
            </section>
            <section className="card">
              <h2>Latest emails</h2><p className="sub">Most recent send attempts</p>
              <div className="tablewrap">{view.sendList.length ? (
                <table><thead><tr><th>Time</th><th>Brand</th><th>To</th><th>Result</th></tr></thead>
                  <tbody>{view.sendList.map((r, i) => (
                    <tr key={i}><td className="num">{dayLabel(r.time.slice(0, 10))}, {r.time.slice(11)}</td><td>{r.brand}</td>
                      <td>{r.to}<div className="muted" style={{ fontSize: 12 }}>from {r.from.replace('@gmail.com', '')}</div></td>
                      <td>{r.result === 'Sent' ? <span className="pill ok"><Icon kind="ok" />Sent</span>
                        : <span className="pill bad" title={r.error}><Icon kind="bad" />{r.result || 'Failed'}</span>}</td></tr>
                  ))}</tbody></table>) : <p className="empty">No emails in this period.</p>}</div>
            </section>
          </div>

          <div className="section">
            <section className="card">
              <h2>WhatsApp</h2>
              <p className="sub">Latest messages · {data.settings.whatsappLive ? 'live sending on' : 'test mode (only test numbers)'} · automatic sending {String(data.settings.whatsappAuto || 'Off').toLowerCase()}. &ldquo;Sent&rdquo; means Meta accepted it; delivery status needs the reply listener.</p>
              <div className="tablewrap">{view.waList.length ? (
                <table><thead><tr><th>Time</th><th>Brand</th><th>Phone</th><th>Template</th><th>Result</th></tr></thead>
                  <tbody>{view.waList.map((r, i) => (
                    <tr key={i}><td className="num">{dayLabel(r.time.slice(0, 10))}, {r.time.slice(11)}</td><td>{r.brand}</td><td className="num">{r.phone}</td><td>{r.template}</td>
                      <td>{r.result === 'Sent' ? <span className="pill ok"><Icon kind="ok" />Sent</span> : <span className="pill bad"><Icon kind="bad" />{r.result}</span>}</td></tr>
                  ))}</tbody></table>) : <p className="empty">No WhatsApp messages yet.</p>}</div>
            </section>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>Source: Automation Control Center sheet (read-only). Times are India time.</p>
        </div>
      ) : !error ? <p className="muted">Loading…</p> : null}
    </div>
  );
}

function DayTable({ days, series }) {
  return (
    <table><thead><tr><th>Day</th>{series.map((s) => <th key={s.key} className="r">{s.key}</th>)}<th className="r">Total</th></tr></thead>
      <tbody>{[...days].reverse().map((d) => (
        <tr key={d.date}><td>{dayLabel(d.date)}</td>{series.map((s) => <td key={s.key} className="r">{d.values[s.key] || 0}</td>)}
          <td className="r"><b>{series.reduce((t, s) => t + (d.values[s.key] || 0), 0)}</b></td></tr>
      ))}</tbody></table>
  );
}

function BrandTable({ view }) {
  return (
    <table><thead><tr><th>Brand</th><th className="r">Sent</th><th className="r">Replies</th><th className="r">Reply rate</th><th className="r">Sent today</th></tr></thead>
      <tbody>{view.series.map((s) => {
        const sent = view.mailDays.reduce((t, d) => t + (d.values[s.key] || 0), 0), rep = view.replyDays.reduce((t, d) => t + (d.values[s.key] || 0), 0);
        const b = view.brands.find((x) => x.code === s.key) || {};
        return <tr key={s.key}><td><BrandCell code={s.key} /></td><td className="r">{sent}</td><td className="r">{rep}</td><td className="r">{sent ? ((rep / sent) * 100).toFixed(1) + '%' : '–'}</td><td className="r">{b.sentToday || 0}</td></tr>;
      })}</tbody></table>
  );
}

function PipelineTable({ brands }) {
  return (
    <table><thead><tr><th>Brand</th><th className="r">Leads</th><th className="r">No draft</th><th className="r">To review</th><th className="r">Approved</th><th className="r">Sent</th><th className="r">Replied</th><th className="r">Bounced</th></tr></thead>
      <tbody>{brands.map((b) => (
        <tr key={b.code}><td><BrandCell code={b.code} /></td><td className="r">{b.leads}</td><td className="r">{b.toDraft}</td><td className="r">{b.drafts}</td>
          <td className="r">{b.approved}</td><td className="r">{b.sent}</td><td className="r">{b.replied}</td><td className="r">{b.bounced}</td></tr>
      ))}</tbody></table>
  );
}
