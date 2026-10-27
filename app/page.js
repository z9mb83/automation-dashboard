'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BRANDS, brandVar } from '../lib/brands';
import { ChartCard, Donut, HBars, Legend, StackedColumns, dayLabel, fmt } from '../components/charts';
import { brandSummary, deliverySummary, perDaySummary, pipelineSummary } from '../lib/summary';
import { ReportCard } from '../components/report';
import { InboxButton } from '../components/inbox-button';

const RANGES = [{ days: 7, label: '7 days' }, { days: 14, label: '14 days' }, { days: 30, label: '30 days' }];
// Donut colours read without a legend: green = good outcome, red = problem, grey = waiting
const PIPE_SLICES = [
  { key: 'replied', label: 'Replied', color: 'var(--good)' },
  { key: 'sentOnly', label: 'Emailed, no reply yet', color: 'var(--series-1)' },
  { key: 'approved', label: 'Approved, waiting to send', color: 'var(--stage-1)' },
  { key: 'drafts', label: 'Draft to review', color: 'var(--warning)' },
  { key: 'toDraft', label: 'New (no draft yet)', color: 'var(--axis)' },
];
const REFRESH_MS = 60000;
const WA_STAGES = [
  { key: 'read', label: 'Read', color: 'var(--good)' },
  { key: 'delivered', label: 'Delivered, not read yet', color: 'var(--series-1)' },
  { key: 'pending', label: 'No delivery report yet', color: 'var(--axis)' },
  { key: 'failed', label: 'Not delivered', color: 'var(--critical)' },
];
const sum0 = (days, kind, codes) => days.reduce((s, d) => s + codes.reduce((t, c) => t + ((d[kind] || {})[c] || 0), 0), 0);
const when = (t) => (t ? dayLabel(t.slice(0, 10)) + ', ' + t.slice(11, 16) : '–');
const explainFailure = (reason) => /^131049/.test(reason) ? 'Meta limited marketing messages to this person (not a system error; try later)'
  : /^131026/.test(reason) ? 'Number cannot receive WhatsApp (not on WhatsApp or old app)'
  : /^131047/.test(reason) ? 'More than 24 hours since their last message: only templates allowed'
  : /^131051/.test(reason) ? 'Message type not supported' : '';

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
  const [page, setPage] = useState('home');
  const [manual, setManual] = useState(false);  // dim the page only for a refresh the viewer asked for
  const [theme, setTheme] = useState('light');
  useEffect(() => { setTheme(document.documentElement.getAttribute('data-theme') || 'light'); }, []);
  const pickTheme = (t) => {
    setTheme(t); document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) { /* private mode: still works for this visit */ }
  };

  useEffect(() => {
    const read = () => { const h = window.location.hash.replace('#', ''); setPage(h === 'mail' || h === 'whatsapp' ? h : 'home'); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const go = (p) => { window.location.hash = p === 'home' ? '' : p; setPage(p); window.scrollTo(0, 0); };

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
    } finally { setLoading(false); setManual(false); }
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
    const sum = (kind) => days.reduce((s, d) => s + codes.reduce((t, c) => t + ((d[kind] || {})[c] || 0), 0), 0);
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
      waDays: days.map((d) => ({ date: d.date, values: d.whatsapp || {} })),
      waReplyDays: days.map((d) => ({ date: d.date, values: d.waReplies || {} })),
      waReplies: sum('waReplies'),
      waReplyList: (data.recentWaReplies || []).filter((r) => (r.brand ? codes.includes(r.brand) : brand === 'ALL')),
      waFailList: (data.waFailures || []).filter((r) => codes.includes(r.brand)),
      waReadList: (data.waReadNoReply || []).filter((r) => codes.includes(r.brand)),
      waDelivered: total('waDelivered'), waRead: total('waRead'), waUndelivered: total('waUndelivered'),
      waRepliedLeads: total('waReplied'), waSentAll: total('waSent'),
      waTodayMsgs: sum0(data.daily.slice(-1), 'whatsapp', codes), waTodayReplies: sum0(data.daily.slice(-1), 'waReplies', codes),
      mailToday7Replies: sum0(data.daily.slice(-7), 'replies', codes),
      pipe: { toDraft: total('toDraft'), drafts: total('drafts'), approved: total('approved'),
        sentOnly: brands.reduce((s, b) => s + Math.max(0, (b.sent || 0) - (b.replied || 0)), 0), replied: total('replied') },
      waStages: { read: total('waRead'), delivered: Math.max(0, total('waDelivered') - total('waRead')), failed: total('waUndelivered'),
        pending: brands.reduce((s, b) => s + Math.max(0, (b.waSent || 0) - (b.waDelivered || 0) - (b.waUndelivered || 0)), 0) },
    };
  }, [data, range, brand]);

  // phone layout: list tables become cards; each cell gets its column heading as a label
  useEffect(() => {
    document.querySelectorAll('table.stack').forEach((t) => {
      const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
      t.querySelectorAll('tbody tr').forEach((tr) => [...tr.children].forEach((td, i) => td.setAttribute('data-label', heads[i] || '')));
    });
  });

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
            <button className="linkbtn" onClick={() => { setManual(true); load(); }}>{loading ? 'Updating…' : 'Refresh now'}</button>
            <span className="theme-switch" role="group" aria-label="Colour theme">
              <button aria-pressed={theme === 'light'} onClick={() => pickTheme('light')}>Light</button>
              <button aria-pressed={theme === 'dark'} onClick={() => pickTheme('dark')}>Dark</button>
            </span>
            <form method="post" action="/api/logout" style={{ display: 'inline' }}><button className="linkbtn" type="submit">Sign out</button></form>
          </div>
        </div>
        <InboxButton />
      </header>

      {data?.sample ? <div className="banner">Showing <b>sample data</b>: the sheet feed is not connected yet (set SHEET_API_URL and SHEET_API_KEY on Vercel).</div> : null}
      {error ? <div className="banner err">Could not refresh: {error}{data ? ' Showing the last good data.' : ''}</div> : null}

      {page !== 'home' ? (
        <nav className="tabs" aria-label="Sections">
          <button className="linkbtn back" onClick={() => go('home')}>&larr; Home</button>
          <div className="seg">
            <button aria-pressed={page === 'mail'} onClick={() => go('mail')}>Mail</button>
            <button aria-pressed={page === 'whatsapp'} onClick={() => go('whatsapp')}>WhatsApp</button>
          </div>
        </nav>
      ) : null}

      {page !== 'home' ? (
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
      ) : null}

      {view && page === 'home' ? <Home view={view} data={data} go={go} /> : null}
      {view && page === 'whatsapp' ? <WhatsAppView view={view} data={data} range={range} loading={loading && manual} /> : null}
      {view && page === 'mail' ? (
        <div className={loading && manual ? 'stale' : ''}>
          <div className="grid kpis">
            <div className="card tile hero"><div className="label">Emails sent today</div><div className="value">{fmt(view.today)}</div>
              <div className="note">{view.failedToday ? `${view.failedToday} failed today` : 'No failures today'}</div></div>
            <div className="card tile"><div className="label">Emails sent</div><div className="value">{fmt(view.sent)}</div><div className="note">last {range} days</div></div>
            <div className="card tile"><div className="label">Replies</div><div className="value">{fmt(view.replies)}</div><div className="note">last {range} days</div></div>
            <div className="card tile"><div className="label">Reply rate</div><div className="value">{view.rate.toFixed(1)}%</div><div className="note">replies ÷ emails sent</div></div>
            <div className="card tile"><div className="label">Bounced</div><div className="value">{fmt(view.brands.reduce((s, b) => s + (b.bounced || 0), 0))}</div><div className="note">all time · added to Do Not Contact</div></div>
            <div className="card tile"><div className="label">Approved, waiting</div><div className="value">{fmt(view.approved)}</div><div className="note">{fmt(view.drafts)} drafts to review</div></div>
          </div>

          <div className="section">
            <ChartCard title="Emails sent per day" sub={`Last ${range} days, by brand · hover a day for details`}
              summary={perDaySummary(view.mailDays, view.series, { one: 'email', many: 'emails', verb: 'sent' })}
              legend={view.series.length > 1 ? <Legend items={view.series} /> : null}
              chart={<StackedColumns days={view.mailDays} series={view.series} unit="emails sent" height={240} />}
              table={<DayTable days={view.mailDays} series={view.series} />} />
          </div>

          <div className="grid two section">
            <ChartCard title="Replies per day" sub={`Last ${range} days · from the 10 AM / 6 PM reply check`}
              summary={perDaySummary(view.replyDays, view.series, { one: 'reply', many: 'replies', verb: 'received' })}
              legend={view.series.length > 1 ? <Legend items={view.series} /> : null}
              chart={<StackedColumns days={view.replyDays} series={view.series} unit="replies" height={200} />}
              table={<DayTable days={view.replyDays} series={view.series} />} />
            <ChartCard title="Emails sent by brand" sub={`Last ${range} days · reply rate in brackets`}
              summary={brandSummary(view.series.map((s) => ({ label: s.label,
                sent: view.mailDays.reduce((t, d) => t + (d.values[s.key] || 0), 0), replies: view.replyDays.reduce((t, d) => t + (d.values[s.key] || 0), 0) })))}
              chart={<HBars valueLabel="Emails sent" rows={view.series.map((s) => {
                const sent = view.mailDays.reduce((t, d) => t + (d.values[s.key] || 0), 0);
                const rep = view.replyDays.reduce((t, d) => t + (d.values[s.key] || 0), 0);
                return { key: s.key, label: s.label, color: s.color, value: sent, note: sent ? `(${((rep / sent) * 100).toFixed(1)}%)` : '' };
              })} />}
              table={<BrandTable view={view} />} />
          </div>

          <div className="grid two section">
            <ChartCard title="Lead pipeline" sub={view.brands.length > 1 ? 'Where all leads stand now · per-brand numbers under Show table' : 'Where all leads stand now'}
              summary={pipelineSummary(view.pipe)}
              chart={<Donut slices={PIPE_SLICES.map((x) => ({ ...x, value: view.pipe[x.key] || 0 }))} centerLabel="leads" />}
              table={<PipelineTable brands={view.brands} />} />
            <section className="card">
              <h2>Mailboxes today</h2><p className="sub">Sent today against each Gmail account&apos;s daily limit</p>
              <div className="tablewrap"><table className="stack">
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
              <h2>Latest replies</h2><p className="sub">Leads who replied to our emails (newest first). Reply from the mailbox that sent the email, so the conversation stays in one thread.</p>
              <div className="tablewrap">{view.replyList.length ? (
                <div>{view.replyList.map((r) => (
                  <div className="reply" key={r.brand + r.email + r.time}>
                    <div className="reply-meta"><BrandCell code={r.brand} /><span>{r.name || 'No name'}</span>
                      <span className="muted">{r.email}</span>{r.phone ? <span className="muted num">{r.phone}</span> : null}
                      <span className="muted num">{r.time ? dayLabel(r.time.slice(0, 10)) + ', ' + r.time.slice(11) : '–'}</span></div>
                    <div className="sent-from">{r.from
                      ? <>Sent from <b>{r.from}</b>{r.subject ? <> · &ldquo;{r.subject}&rdquo;</> : null}</>
                      : <span className="muted">Sending mailbox not recorded</span>}</div>
                    {r.from ? <div className="reply-actions">
                      <a className="btn-act" target="_blank" rel="noopener noreferrer"
                        href={`https://mail.google.com/mail/u/${encodeURIComponent(r.from)}/#search/${encodeURIComponent('from:' + r.email)}`}>Open in Gmail</a>
                    </div> : null}
                  </div>
                ))}</div>) : <p className="empty">No replies yet.</p>}</div>
            </section>
            <section className="card">
              <h2>Latest emails</h2><p className="sub">Most recent send attempts</p>
              <div className="tablewrap">{view.sendList.length ? (
                <table className="stack"><thead><tr><th>Time</th><th>Brand</th><th>To</th><th>Result</th></tr></thead>
                  <tbody>{view.sendList.map((r, i) => (
                    <tr key={i}><td className="num">{dayLabel(r.time.slice(0, 10))}, {r.time.slice(11)}</td><td>{r.brand}</td>
                      <td>{r.to}<div className="muted" style={{ fontSize: 12 }}>from {r.from.replace('@gmail.com', '')}</div></td>
                      <td>{r.result === 'Sent' ? <span className="pill ok"><Icon kind="ok" />Sent</span>
                        : <span className="pill bad" title={r.error}><Icon kind="bad" />{r.result || 'Failed'}</span>}</td></tr>
                  ))}</tbody></table>) : <p className="empty">No emails in this period.</p>}</div>
            </section>
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>Source: Automation Control Center sheet (read-only). Times are India time.</p>
        </div>
      ) : null}
      {view ? <ReportCard defaultType={page === 'home' ? 'combined' : page} defaultBrand={page === 'home' ? 'ALL' : brand} /> : null}
      {!view && !error ? <p className="muted">Loading…</p> : null}
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

function Home({ view, data, go }) {
  const attention = [];
  const reconnect = view.mailboxes.filter((m) => mailboxStatus(m).kind === 'bad').length;
  if (reconnect) attention.push(`${reconnect} mailbox${reconnect > 1 ? 'es' : ''} need attention`);
  if (view.failedToday) attention.push(`${view.failedToday} email${view.failedToday > 1 ? 's' : ''} failed today`);
  if (view.waUndelivered) attention.push(`${view.waUndelivered} WhatsApp not delivered`);
  return (
    <div>
      <p className="secondary" style={{ margin: '0 0 14px' }}>Choose a channel. Numbers are for all brands.</p>
      <div className="grid two">
        <button className="card choice" onClick={() => go('mail')} aria-label="Open Mail">
          <div className="choice-head"><MailIcon /><h2>Mail</h2><span className="chev" aria-hidden="true">&rarr;</span></div>
          <div className="choice-stats">
            <div><div className="value">{fmt(view.today)}</div><div className="label">sent today</div></div>
            <div><div className="value">{fmt(view.mailToday7Replies)}</div><div className="label">replies, last 7 days</div></div>
            <div><div className="value">{fmt(view.approved)}</div><div className="label">approved, waiting</div></div>
          </div>
          <p className="sub">Sends per day, replies, lead pipeline, mailboxes and limits</p>
        </button>
        <button className="card choice" onClick={() => go('whatsapp')} aria-label="Open WhatsApp">
          <div className="choice-head"><ChatIcon /><h2>WhatsApp</h2><span className="chev" aria-hidden="true">&rarr;</span></div>
          <div className="choice-stats">
            <div><div className="value">{fmt(view.waTodayMsgs)}</div><div className="label">sent today</div></div>
            <div><div className="value">{fmt(view.waRead)}</div><div className="label">read</div></div>
            <div><div className="value">{fmt(view.waTodayReplies)}</div><div className="label">replies today</div></div>
          </div>
          <p className="sub">Replies with their messages, delivery and read status, failures with reasons</p>
        </button>
      </div>
      <div className="grid two" style={{ marginTop: 14 }}>
        <a className="card choice" href="/inbox" aria-label="Open the WhatsApp inbox" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="choice-head"><ChatIcon /><h2>WhatsApp inbox</h2><span className="chev" aria-hidden="true">&rarr;</span></div>
          <p className="sub">Every conversation like in WhatsApp: the message we sent, each reply as it arrives, Call and Open in WhatsApp, add a new contact and send.</p>
        </a>
      </div>
      {attention.length ? <div className="banner" style={{ marginTop: 14 }}>Needs attention: {attention.join(' · ')}</div> : null}
      {view.waReplyList.length ? (
        <section className="card section">
          <h2>Latest WhatsApp reply</h2>
          <ReplyItem r={view.waReplyList[0]} />
        </section>
      ) : null}
    </div>
  );
}

// 10-digit numbers in the sheet are Indian numbers without the country code
const digits = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };
// full numbers only arrive for WhatsApp replies; masked ones ("9198****233") cannot be dialled
const canDial = (p) => !String(p || '').includes('*') && digits(p).length >= 10;
function prettyPhone(p) {
  const d = digits(p);
  if (!canDial(p)) return p || '';
  return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`;
}

function ReplyItem({ r }) {
  return (
    <div className="reply">
      <div className="reply-meta">{r.brand ? <BrandCell code={r.brand} /> : <span className="muted">Unknown number</span>}
        <span>{r.name || 'No name'}</span><span className="num">{prettyPhone(r.phone)}</span><span className="muted num">{when(r.time)}</span></div>
      <blockquote className="msg">{r.message || <span className="muted">[{r.type || 'message'}]</span>}</blockquote>
      {canDial(r.phone) && (
        <div className="reply-actions">
          <a className="btn-act" href={`tel:+${digits(r.phone)}`}>Call</a>
          <a className="btn-act wa" href={`https://wa.me/${digits(r.phone)}`} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a>
        </div>
      )}
    </div>
  );
}

function WhatsAppView({ view, data, range, loading }) {
  const confirmed = view.waDelivered + view.waUndelivered;
  const deliveredPct = confirmed ? Math.round((view.waDelivered / confirmed) * 100) : 0;
  return (
    <div className={loading ? 'stale' : ''}>
      <div className="grid kpis">
        <div className="card tile hero"><div className="label">WhatsApp replies</div><div className="value">{fmt(view.waReplies)}</div>
          <div className="note">last {range} days · {fmt(view.waRepliedLeads)} leads have replied</div></div>
        <div className="card tile"><div className="label">Messages sent</div><div className="value">{fmt(view.whatsapp)}</div><div className="note">last {range} days</div></div>
        <div className="card tile"><div className="label">Delivered</div><div className="value">{fmt(view.waDelivered)}</div><div className="note">{confirmed ? `${deliveredPct}% of confirmed` : 'reports since 29 Sep'}</div></div>
        <div className="card tile"><div className="label">Read</div><div className="value">{fmt(view.waRead)}</div><div className="note">blue ticks</div></div>
        <div className="card tile"><div className="label">Not delivered</div><div className="value">{fmt(view.waUndelivered)}</div><div className="note">reasons below</div></div>
        <div className="card tile"><div className="label">Sending</div><div className="value" style={{ fontSize: 18 }}>{data.settings.whatsappLive ? 'Live' : 'Test mode'}</div>
          <div className="note">automatic sending {String(data.settings.whatsappAuto || 'Off').toLowerCase()}</div></div>
      </div>

      <div className="section">
        <section className="card">
          <h2>Latest replies</h2><p className="sub">Messages customers sent to the WhatsApp number (newest first)</p>
          {view.waReplyList.length ? view.waReplyList.slice(0, 12).map((r, i) => <ReplyItem key={i} r={r} />) : <p className="empty">No WhatsApp replies in this selection yet.</p>}
        </section>
      </div>

      <div className="section">
        <section className="card">
          <h2>Read, no reply yet: worth a follow-up call</h2>
          <p className="sub">They opened your WhatsApp message (blue ticks) but have not answered. Oldest first. People who reply or opt out leave this list.</p>
          <div className="tablewrap">{view.waReadList.length ? (
            <table className="stack"><thead><tr><th>Sent</th><th>Brand</th><th>Name</th><th>Number</th><th></th></tr></thead>
              <tbody>{view.waReadList.map((r, i) => (
                <tr key={i}><td className="num">{when(r.time)}</td><td><BrandCell code={r.brand} /></td><td>{r.name || '–'}</td>
                  <td className="num">{prettyPhone(r.phone)}</td>
                  <td>{canDial(r.phone) && <div className="reply-actions" style={{ marginTop: 0 }}>
                    <a className="btn-act" href={`tel:+${digits(r.phone)}`}>Call</a>
                    <a className="btn-act wa" href={`https://wa.me/${digits(r.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a></div>}</td></tr>
              ))}</tbody></table>) : <p className="empty">Nobody is waiting: everyone who read a message has replied, or no one has read one yet.</p>}</div>
        </section>
      </div>

      <div className="grid two section">
        <ChartCard title="WhatsApp sent per day" sub={`Last ${range} days, by brand`}
          summary={perDaySummary(view.waDays, view.series, { one: 'message', many: 'messages', verb: 'sent' })}
          legend={view.series.length > 1 ? <Legend items={view.series} /> : null}
          chart={<StackedColumns days={view.waDays} series={view.series} unit="messages sent" height={200} />}
          table={<DayTable days={view.waDays} series={view.series} />} />
        <ChartCard title="WhatsApp replies per day" sub={`Last ${range} days, by brand`}
          summary={perDaySummary(view.waReplyDays, view.series, { one: 'reply', many: 'replies', verb: 'received' })}
          legend={view.series.length > 1 ? <Legend items={view.series} /> : null}
          chart={<StackedColumns days={view.waReplyDays} series={view.series} unit="replies" height={200} />}
          table={<DayTable days={view.waReplyDays} series={view.series} />} />
      </div>

      <div className="grid two section">
        <ChartCard title="What happened to the messages" sub={view.brands.length > 1 ? 'All messages sent from the sheet so far · per-brand numbers under Show table' : 'All messages sent from the sheet so far'}
          summary={deliverySummary(view.waStages)}
          chart={<Donut slices={WA_STAGES.map((x) => ({ ...x, value: view.waStages[x.key] || 0 }))} centerLabel="messages" />}
          table={<table><thead><tr><th>Brand</th><th className="r">Sent</th><th className="r">Delivered</th><th className="r">Read</th><th className="r">Not delivered</th><th className="r">Replied</th></tr></thead>
            <tbody>{view.brands.map((b) => <tr key={b.code}><td><BrandCell code={b.code} /></td><td className="r">{b.waSent || 0}</td><td className="r">{b.waDelivered || 0}</td>
              <td className="r">{b.waRead || 0}</td><td className="r">{b.waUndelivered || 0}</td><td className="r">{b.waReplied || 0}</td></tr>)}</tbody></table>} />
        <section className="card">
          <h2>Not delivered</h2><p className="sub">Messages Meta accepted but could not deliver, with the reason</p>
          <div className="tablewrap">{view.waFailList.length ? (
            <table className="stack"><thead><tr><th>Sent</th><th>Brand</th><th>To</th><th>Reason</th></tr></thead>
              <tbody>{view.waFailList.map((r, i) => (
                <tr key={i}><td className="num">{when(r.time)}</td><td>{r.brand}</td><td>{r.name || '–'}<div className="num" style={{ fontSize: 12 }}>{prettyPhone(r.phone)}</div>
                  {canDial(r.phone) && <a className="btn-act" style={{ marginTop: 6 }} href={`tel:+${digits(r.phone)}`}>Call</a>}</td>
                  <td>{explainFailure(r.reason) || r.reason}<div className="muted" style={{ fontSize: 12 }}>code {r.reason.split(' ')[0]}</div></td></tr>
              ))}</tbody></table>) : <p className="empty">Nothing failed.</p>}</div>
        </section>
      </div>

      <div className="section">
        <section className="card">
          <h2>Latest messages sent</h2><p className="sub">Template messages sent from the sheet · &ldquo;Sent&rdquo; means Meta accepted it; see Delivery above</p>
          <div className="tablewrap">{view.waList.length ? (
            <table className="stack"><thead><tr><th>Time</th><th>Brand</th><th>Phone</th><th>Template</th><th>Result</th></tr></thead>
              <tbody>{view.waList.map((r, i) => (
                <tr key={i}><td className="num">{when(r.time)}</td><td>{r.brand}</td><td className="num">{r.phone}</td><td>{r.template}</td>
                  <td>{r.result === 'Sent' ? <span className="pill ok"><Icon kind="ok" />Sent</span> : <span className="pill bad"><Icon kind="bad" />{r.result}</span>}</td></tr>
              ))}</tbody></table>) : <p className="empty">No WhatsApp messages yet.</p>}</div>
        </section>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>Source: Automation Control Center sheet (WhatsApp Log, WhatsApp Replies, brand tabs). Full numbers are shown only for people who replied, read without replying, or whose message did not arrive. Times are India time.</p>
    </div>
  );
}

const MailIcon = () => (
  <svg className="choice-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
);
const ChatIcon = () => (
  <svg className="choice-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18.5l1.3-3.6A7.5 7.5 0 1 1 8.8 18l-4.8.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 10.5h6M9 13.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
);
