'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRANDS, brandVar } from '../../lib/brands';
import { FILTERS, chatFacts, dayLabel, filterChats, listTime, newContactBody, prettyPhone, telLink, threadItems, waLink } from '../../lib/inbox';

const POLL_VISIBLE_MS = 5000, POLL_HIDDEN_MS = 30000;
const SEEN_KEY = 'inbox-seen';
const brandName = (code) => (BRANDS.find((b) => b.code === code) || {}).name || 'Unknown brand';
const indiaToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const explainFailure = (e) => /131049/.test(e) ? 'Meta limited marketing messages to this person (try again later)'
  : /131026/.test(e) ? 'This number cannot receive WhatsApp' : /131047/.test(e) ? 'Over 24 hours since their last message: only templates allowed' : '';
const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); } catch (e) { return null; } };
const saveSeen = (m) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) { /* private mode */ } };
const initials = (c) => (c.name || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '#';

export default function Inbox() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('ALL');
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState('');
  const [seen, setSeen] = useState({});
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const version = useRef('');
  const today = indiaToday();

  const loadAll = useCallback(async () => {
    const res = await fetch('/api/inbox', { cache: 'no-store' });
    if (res.status === 401) { window.location.href = '/login'; return; }
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    version.current = json.version;
    setData(json); setError('');
    setSeen((s) => {
      if (Object.keys(s).length) return s;
      const stored = loadSeen();
      if (stored) return stored;
      // first visit in this browser: everything so far counts as read, only new replies get a badge
      const init = {}; json.chats.forEach((c) => { init[c.id] = c.lastTime; }); saveSeen(init); return init;
    });
  }, []);

  // poll a tiny "anything changed?" stamp; reload everything only when it changes
  useEffect(() => {
    let stop = false, timer = null;
    const tick = async () => {
      try {
        if (!version.current) await loadAll();
        else {
          const res = await fetch('/api/inbox?ver=1', { cache: 'no-store' });
          if (res.status === 401) { window.location.href = '/login'; return; }
          const v = await res.json();
          if (v.error) throw new Error(v.error);
          if (v.version !== version.current) await loadAll();
        }
      } catch (e) { setError(String(e.message || e)); }
      if (!stop) timer = setTimeout(tick, document.visibilityState === 'visible' ? POLL_VISIBLE_MS : POLL_HIDDEN_MS);
    };
    tick();
    const vis = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); tick(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); };
  }, [loadAll]);

  const chats = data ? data.chats : [], messages = data ? data.messages : [];
  const list = useMemo(() => filterChats(chats, messages, { q, brand, filter, lastSeen: seen }), [chats, messages, q, brand, filter, seen]);
  const open = chats.find((c) => c.id === openId) || null;
  const unreadTotal = useMemo(() => chats.reduce((s, c) => s + chatFacts(c, messages, seen).unread, 0), [chats, messages, seen]);

  useEffect(() => { document.title = (unreadTotal ? `(${unreadTotal}) ` : '') + 'Inbox · Automation Dashboard'; }, [unreadTotal]);

  // opening a chat (or new messages arriving in the open chat) marks it read
  useEffect(() => {
    if (!open) return;
    if ((seen[open.id] || '') < open.lastTime) { const next = { ...seen, [open.id]: open.lastTime }; setSeen(next); saveSeen(next); }
  }, [open, seen]);

  const act = async (body) => {
    const res = await fetch('/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401) { window.location.href = '/login'; return { ok: false, message: 'Login required' }; }
    const out = await res.json().catch(() => ({ ok: false, message: 'HTTP ' + res.status }));
    await loadAll().catch(() => {});
    return out;
  };
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 6000); };

  const warnings = (data?.quality || []).filter((x) => x.quality === 'YELLOW' || x.quality === 'RED');

  return (
    <div className={'wa-app' + (open ? ' has-open' : '')}>
      <aside className="wa-side" aria-label="Chats">
        <div className="wa-side-head">
          <a href="/" className="wa-back-home" aria-label="Back to dashboard">&larr;</a>
          <h1>Inbox</h1>
          <button className="wa-new" onClick={() => setAdding(true)}>+ New contact</button>
        </div>
        <div className="wa-search">
          <input type="search" placeholder="Search number or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search chats" />
        </div>
        <div className="wa-filters" role="group" aria-label="Filter chats">
          {FILTERS.map((f) => <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}{f.key === 'unread' && unreadTotal ? ` ${unreadTotal}` : ''}</button>)}
          <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand">
            <option value="ALL">All brands</option>
            {BRANDS.map((b) => <option key={b.code} value={b.code}>{b.code}</option>)}
          </select>
        </div>
        {data && !data.live ? <div className="wa-note">Test mode: only the WhatsApp test numbers receive messages.</div> : null}
        {warnings.map((w) => <div key={w.brand} className={'wa-note ' + (w.quality === 'RED' ? 'bad' : 'warn')}>
          {w.brand} number quality is <b>{w.quality === 'RED' ? 'low (red)' : 'medium (yellow)'}</b>: send fewer cold messages until it is green again.</div>)}
        {data?.sample ? <div className="wa-note">Sample data: the sheet feed is not connected.</div> : null}
        {error ? <div className="wa-note bad">Could not refresh: {error}</div> : null}
        <ul className="wa-list">
          {!data && !error ? <li className="wa-empty">Loading…</li> : null}
          {data && !list.length ? <li className="wa-empty">{q ? 'No chat matches “' + q + '”.' : 'No chats here.'}</li> : null}
          {list.map((c) => {
            const f = chatFacts(c, messages, seen);
            return (
              <li key={c.id}>
                <button className={'wa-row' + (c.id === openId ? ' active' : '')} onClick={() => setOpenId(c.id)}>
                  <span className="wa-avatar" style={{ background: brandVar(c.brand) }}>{initials(c)}</span>
                  <span className="wa-row-main">
                    <span className="wa-row-top">
                      <span className="wa-row-name">{c.name || prettyPhone(c.phone)}</span>
                      <span className={'wa-row-time' + (f.unread ? ' new' : '')}>{listTime(c.lastTime, today)}</span>
                    </span>
                    <span className="wa-row-bottom">
                      <span className="wa-row-text">
                        {c.lastDir === 'out' ? <Ticks status={f.lastOutStatus} /> : null}
                        {c.lastText}
                      </span>
                      {f.unread ? <span className="wa-badge">{f.unread}</span> : null}
                    </span>
                    <span className="wa-row-tags">
                      <span className="wa-tag" style={{ borderColor: brandVar(c.brand) }}>{c.brand || '?'}</span>
                      {c.name ? <span className="wa-row-num">{prettyPhone(c.phone)}</span> : null}
                      {c.flag ? <span className={'wa-flag ' + (c.flag === 'Opted out' ? 'bad' : 'warn')}>{c.flag}</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="wa-chat" aria-label="Conversation">
        {open ? <Thread chat={open} messages={messages} today={today} onBack={() => setOpenId('')} act={act} say={say} live={data?.live} />
          : <div className="wa-placeholder"><div><h2>WhatsApp inbox</h2><p>Select a chat to see the message we sent and every reply.<br />New replies appear here within a few seconds.</p></div></div>}
      </main>

      {adding ? <NewContact data={data} onClose={() => setAdding(false)} act={act}
        onDone={(out) => { setAdding(false); say(out.message); if (out.chat) { setOpenId(out.chat); setBrand('ALL'); setFilter('all'); setQ(''); } }} /> : null}
      {toast ? <div className="wa-toast" role="status">{toast}</div> : null}
    </div>
  );
}

function Ticks({ status }) {
  if (status === 'failed') return <span className="wa-ticks failed" title="Not delivered" aria-label="Not delivered">!</span>;
  const double = status === 'delivered' || status === 'read';
  const label = status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : 'Sent';
  return (
    <span className={'wa-ticks' + (status === 'read' ? ' read' : '')} title={label} aria-label={label}>
      <svg viewBox="0 0 18 12" width="16" height="11" aria-hidden="true">
        <path d="M1 6.5l3.2 3.2L11 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {double ? <path d="M6.5 9.4l.6.6L14.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" /> : null}
      </svg>
    </span>
  );
}

function Thread({ chat, messages, today, onBack, act, say, live }) {
  const items = useMemo(() => threadItems(messages, chat.id), [messages, chat.id]);
  const end = useRef(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [items.length, chat.id]);
  const sentOk = items.some((m) => m.dir === 'out' && !m.auto && m.status !== 'failed');
  const canSend = !chat.optedOut && chat.flag !== 'Opted out' && chat.row && !sentOk;

  const optOut = async () => {
    if (!window.confirm(`Stop all messages to ${prettyPhone(chat.phone)}?\n\nTheir number (and email, if the sheet has one) goes to Do Not Contact for every brand.`)) return;
    setBusy(true); const out = await act({ action: 'optout', phone: chat.phone, brand: chat.brand }); setBusy(false); say(out.message);
  };
  const send = async () => {
    if (!window.confirm(`Send the ${brandName(chat.brand)} WhatsApp template to ${prettyPhone(chat.phone)} now?`)) return;
    setBusy(true); const out = await act({ action: 'send', brand: chat.brand, row: chat.row }); setBusy(false); say(out.message);
  };

  return (
    <>
      <header className="wa-chat-head">
        <button className="wa-back" onClick={onBack} aria-label="Back to chats">&larr;</button>
        <span className="wa-avatar" style={{ background: brandVar(chat.brand) }}>{initials(chat)}</span>
        <div className="wa-chat-who">
          <div className="wa-chat-name">{chat.name || prettyPhone(chat.phone)}</div>
          <div className="wa-chat-sub">{prettyPhone(chat.phone)} · {brandName(chat.brand)}{chat.row ? ` · row ${chat.row}` : ''}{chat.email ? ` · ${chat.email}` : ''}</div>
        </div>
        <div className="wa-chat-actions">
          <a className="wa-btn" href={telLink(chat.phone)}>Call</a>
          <a className="wa-btn green" href={waLink(chat.phone)} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a>
        </div>
      </header>
      {chat.flag ? <div className={'wa-banner ' + (chat.flag === 'Opted out' ? 'bad' : 'warn')}>
        {chat.flag === 'Opted out' ? 'Opted out: this person is in Do Not Contact and will not be messaged again.'
          : <>They may not want messages (“possible opt-out”). <button className="linkbtn" disabled={busy} onClick={optOut}>Stop messaging them</button></>}
      </div> : null}
      <div className="wa-thread" role="log" aria-live="polite">
        {items.map((m) => m.day ? <div key={'d' + m.day} className="wa-day"><span>{dayLabel(m.day, today)}</span></div> : (
          <div key={m.id} className={'wa-msg ' + m.dir + (m.status === 'failed' ? ' failed' : '')}>
            {m.dir === 'out' && (m.template || m.auto) ? <div className="wa-msg-label">{m.auto ? 'Automatic reply' : 'Template · ' + m.template}</div> : null}
            <div className="wa-msg-text">{m.text}</div>
            <div className="wa-msg-meta">
              {m.flag ? <span className={'wa-flag ' + (m.flag === 'Opted out' ? 'bad' : 'warn')}>{m.flag}</span> : null}
              <span>{m.time.slice(11, 16)}</span>
              {m.dir === 'out' ? <Ticks status={m.status} /> : null}
            </div>
            {m.status === 'failed' && m.error ? <div className="wa-msg-error">{explainFailure(m.error) || m.error}</div> : null}
          </div>
        ))}
        <div ref={end} />
      </div>
      <footer className="wa-foot">
        {canSend ? <button className="wa-btn green" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send template now'}</button> : null}
        <span>Type replies in WhatsApp: <a href={waLink(chat.phone)} target="_blank" rel="noopener noreferrer">open this chat</a>.</span>
        {!chat.optedOut && !chat.flag ? <button className="linkbtn" disabled={busy} onClick={optOut}>Mark as opted out</button> : null}
        {!live ? <span className="muted">Test mode is on.</span> : null}
      </footer>
    </>
  );
}

function NewContact({ data, onClose, onDone, act }) {
  const [f, setF] = useState({ brand: '', phone: '', name: '', email: '', details: '', source: 'Cold', send: true });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const waOff = f.brand && data?.waOn && data.waOn[f.brand] === false;
  const capLeft = data ? Math.max(0, (data.dailyCap || 0) - (data.sentToday || 0)) : 0;

  const submit = async (e) => {
    e.preventDefault();
    const body = newContactBody(f);
    if (body.error) { setErr(body.error); return; }
    if (body.send && !window.confirm(`Add ${prettyPhone(body.phone)} to ${body.brand} and send the ${brandName(body.brand)} WhatsApp template now?`)) return;
    setBusy(true); setErr('');
    const out = await act({ action: 'add', ...body });
    setBusy(false);
    if (out.exists) { setDup(out); setErr(out.message); return; }
    if (!out.ok) { setErr(out.message || 'Could not add.'); return; }
    onDone(out);
  };

  return (
    <div className="wa-modal-bg" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="wa-modal" onSubmit={submit} aria-label="New contact">
        <h2>New contact</h2>
        <p className="sub">Added after the last row of the brand&apos;s tab (existing rows are never changed).</p>
        <label>Brand
          <select value={f.brand} onChange={set('brand')} required>
            <option value="">Choose…</option>
            {BRANDS.map((b) => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
          </select></label>
        <label>Mobile number<input inputMode="tel" placeholder="98111 22233 or +91…" value={f.phone} onChange={set('phone')} required /></label>
        <label>Name<input value={f.name} onChange={set('name')} placeholder="Used in the template greeting" /></label>
        <label>Email (optional)<input type="email" value={f.email} onChange={set('email')} /></label>
        <label>Details (optional)<input value={f.details} onChange={set('details')} placeholder="Notes about this lead" /></label>
        <label>Source
          <select value={f.source} onChange={set('source')}>{['Cold', 'Enquiry', 'Referral', 'Existing client'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="check"><input type="checkbox" checked={f.send} onChange={set('send')} /> Send the brand&apos;s WhatsApp template now</label>
        {f.send ? <p className="sub">{waOff ? `WhatsApp is switched off for ${f.brand} in the Limits tab, so only the contact will be added.`
          : `${capLeft} dashboard send${capLeft === 1 ? '' : 's'} left today.${data && !data.live ? ' Test mode: only test numbers receive it.' : ''}`}</p> : null}
        {err ? <p className="wa-err" role="alert">{err}{dup ? <> <button type="button" className="linkbtn" onClick={() => onDone({ message: dup.message, chat: dup.chat })}>Open that chat</button></> : null}</p> : null}
        <div className="wa-modal-actions">
          <button type="button" className="wa-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="wa-btn green" disabled={busy}>{busy ? 'Working…' : f.send ? 'Add and send' : 'Add contact'}</button>
        </div>
      </form>
    </div>
  );
}
