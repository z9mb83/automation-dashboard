'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BRANDS, brandVar } from '../lib/brands';
import { MAIL_FILTERS, durationText, gmailThreadLink, mailQueue, mailSummary, replyState, syncStatus, waitInfo } from '../lib/mailreplies';
import { fmt, dayLabel } from './charts';

const REFRESH_MS = 60000;
const STATE_LABEL = { waiting: 'Needs reply', answered: 'Answered', handled: 'Marked handled', auto: 'Auto-reply', bounce: 'Bounced' };
const when = (t) => (t ? `${dayLabel(t.slice(0, 10))}, ${t.slice(11, 16)}` : '–');
const pretty = (p) => { const d = String(p || '').replace(/\D/g, ''); const n = d.length === 10 ? '91' + d : d;
  return n.length === 12 && n.startsWith('91') ? `+91 ${n.slice(2, 7)} ${n.slice(7)}` : p; };
const dial = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };

/** /api/mail loader, shared by the Mail page and the Home card. */
export function useMailThreads() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/mail', { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      setData(j); setError('');
    } catch (e) { setError(String(e.message || e)); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);
  return { data, error, load, setData };
}

export function MailReplies({ brand, fallback }) {
  const { data, error, load, setData } = useMailThreads();
  const [filter, setFilter] = useState('waiting');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const threads = data ? data.threads : [];
  const s = useMemo(() => mailSummary(threads, now, brand), [threads, now, brand]);
  const list = useMemo(() => mailQueue(threads, { brand, filter, q }), [threads, brand, filter, q]);
  const sync = syncStatus(data && data.sync);

  const handle = async (t, handled) => {
    setBusy(t.threadId); setMsg('');
    try {
      const res = await fetch('/api/mail', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mailbox: t.mailbox, threadId: t.threadId, handled }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.message || 'Not saved');
      setData((d) => ({ ...d, threads: d.threads.map((x) => (x.mailbox === t.mailbox && x.threadId === t.threadId
        ? { ...x, handledAt: handled ? j.handledAt : '', handledBy: handled ? 'Dashboard' : '' } : x)) }));
      setMsg(handled ? `Marked handled: ${t.name || t.email}` : `Back in Needs reply: ${t.name || t.email}`);
    } catch (e) { setMsg('Could not save: ' + String(e.message || e)); } finally { setBusy(''); }
  };

  if (!data) return error ? <div className="banner err">Email replies: {error}</div> : <p className="muted">Loading email replies…</p>;
  if (!sync.running && !data.sample) {
    // tracker not deployed yet: keep the old list
    return (<>
      <div className="banner">Live email-reply tracking starts after the sender update is deployed. Until then, replies are found at 10 AM and 6 PM.</div>
      {fallback}
    </>);
  }
  return (
    <section className="card section mail-replies">
      <div className="mr-head">
        <div><h2>Email replies</h2>
          <p className="sub">Checked every 15 minutes while the sender runs (10:00–18:00, Mon–Sat){sync.lastCheck ? ` · last check ${when(sync.lastCheck)}` : ''}.
            &ldquo;Answered&rdquo; means someone replied from the sending Gmail; use &ldquo;Mark handled&rdquo; when you answered another way (call, other inbox).</p></div>
        <button className="linkbtn" onClick={load}>Refresh</button>
      </div>
      {data.sample ? <div className="banner">Showing <b>sample</b> email replies: the sheet feed is not connected.</div> : null}
      {sync.failing.length ? <div className="banner err">Reply check failing for {sync.failing.map((f) => f.mailbox).join(', ')} ({sync.failing[0].result.replace(/^Error: /, '')}). Replies from these mailboxes still show in the 10 AM / 6 PM reports.</div> : null}
      <div className="grid kpis mr-kpis">
        <div className={'card tile hero' + (s.late ? ' alert' : '')}><div className="label">Needs reply</div><div className="value">{fmt(s.waiting)}</div>
          <div className="note">{s.waiting ? `longest waiting ${s.oldestWait.text}${s.late ? ` · ${s.late} over a day` : ''}` : 'nobody is waiting'}</div></div>
        <div className="card tile"><div className="label">Answered</div><div className="value">{fmt(s.answered)}</div><div className="note">from the sending Gmail</div></div>
        <div className="card tile"><div className="label">Typical answer time</div><div className="value">{durationText(s.medianAnswerMs)}</div><div className="note">their reply → our answer</div></div>
        <div className="card tile"><div className="label">Marked handled</div><div className="value">{fmt(s.handled)}</div><div className="note">answered another way</div></div>
        <div className="card tile"><div className="label">Auto-replies</div><div className="value">{fmt(s.auto)}</div><div className="note">out of office etc.</div></div>
        <div className="card tile"><div className="label">Bounced</div><div className="value">{fmt(s.bounce)}</div><div className="note">address does not work</div></div>
      </div>
      <div className="filters mr-filters" role="toolbar" aria-label="Email reply filters">
        <div className="seg" aria-label="Show">
          {MAIL_FILTERS.map((f) => <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}
            {f.key === 'waiting' && s.waiting ? <span className="mr-count">{s.waiting}</span> : null}</button>)}
        </div>
        <input className="input mr-search" type="search" placeholder="Search name, email, phone, subject" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search email replies" />
      </div>
      <p className="muted" role="status" aria-live="polite" style={{ minHeight: 18, margin: '0 0 6px', fontSize: 13 }}>{msg}</p>
      {list.length ? list.slice(0, 60).map((t) => {
        const st = replyState(t), w = waitInfo(t, now), b = BRANDS.find((x) => x.code === t.brand);
        return (
          <div className="reply mr-item" key={t.mailbox + t.threadId}>
            <div className="reply-meta">
              <span className="brandcell"><i className="swatch" style={{ background: brandVar(t.brand) }} />{b ? b.name : t.brand}</span>
              <b>{t.name || t.email}</b>{t.name ? <span className="muted">{t.email}</span> : null}
              {t.phone ? <span className="muted num">{pretty(t.phone)}</span> : null}
              {st === 'waiting' ? <span className={'waitb ' + w.level} title="How long they have waited for an answer">waiting {w.text}</span>
                : <span className={'pill ' + (st === 'bounce' ? 'bad' : st === 'answered' || st === 'handled' ? 'ok' : 'warn')}>{STATE_LABEL[st]}</span>}
            </div>
            <div className="sent-from">&ldquo;{t.subject || '(no subject)'}&rdquo; · we emailed {when(t.emailedAt)} from <b>{t.mailbox.replace('@gmail.com', '')}</b>
              {' · '}{st === 'auto' || st === 'bounce' ? `${STATE_LABEL[st].toLowerCase()} ${when(t.lastReplyAt)}` : `replied ${when(t.lastReplyAt)}${t.replies > 1 ? ` (${t.replies} messages)` : ''}`}
              {st === 'answered' ? ` · we answered ${when(t.lastFromUsAt)}` : ''}{st === 'handled' ? ` · handled ${when(t.handledAt)}` : ''}</div>
            <div className="reply-actions">
              <a className="btn-act" target="_blank" rel="noopener noreferrer" href={gmailThreadLink(t)}>Open in Gmail</a>
              {t.phone ? <a className="btn-act" href={`tel:+${dial(t.phone)}`}>Call</a> : null}
              {st === 'waiting' ? <button className="btn-act" disabled={busy === t.threadId} onClick={() => handle(t, true)}>Mark handled</button> : null}
              {st === 'handled' ? <button className="btn-act" disabled={busy === t.threadId} onClick={() => handle(t, false)}>Undo</button> : null}
            </div>
          </div>
        );
      }) : <p className="empty">{filter === 'waiting' ? 'Nobody is waiting for an email answer.' : 'Nothing here.'}</p>}
      {list.length > 60 ? <p className="muted" style={{ fontSize: 12 }}>Showing the first 60 of {list.length}; use search to find others.</p> : null}
    </section>
  );
}

/** Home card number: replies waiting for us. */
export function useMailWaiting() {
  const { data } = useMailThreads();
  if (!data || !syncStatus(data.sync).running && !data.sample) return null;
  return mailSummary(data.threads, Date.now()).waiting;
}
