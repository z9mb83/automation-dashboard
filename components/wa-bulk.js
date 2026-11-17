'use client';
import { useCallback, useEffect, useState } from 'react';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const STORE = (b) => 'wa-upload:' + b;

export async function waPost(body) {
  const res = await fetch('/api/whatsapp', body instanceof FormData
    ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 401) { window.location.href = '/login'; return { ok: false, message: 'Signed out.' }; }
  return res.json().catch(() => ({ ok: false, message: 'HTTP ' + res.status }));
}

export function loadUpload(brand) {
  try { return JSON.parse(localStorage.getItem(STORE(brand)) || 'null'); } catch { return null; }
}
function saveUpload(brand, u) {
  try { localStorage.setItem(STORE(brand), JSON.stringify(u)); } catch { /* too big or private mode: table still shows this visit */ }
}

/** Upload a phone list for one brand, then "Send next 30". */
export function WhatsAppBulk({ brand, onUploaded }) {
  const [file, setFile] = useState(null);
  const [queue, setQueue] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const loadQueue = useCallback(async () => {
    setQueue(null);
    try { const q = await waPost({ action: 'queue', brand }); setQueue(q.ok ? q : { error: q.message }); }
    catch (e) { setQueue({ error: String(e.message || e) }); }
  }, [brand]);
  useEffect(() => { setMsg(''); loadQueue(); }, [loadQueue]);

  const upload = async () => {
    if (!file) return;
    setBusy('upload'); setMsg('Reading the file and adding the numbers…');
    try {
      const fd = new FormData(); fd.append('brand', brand); fd.append('file', file);
      const r = await waPost(fd);
      setMsg(r.ok ? `${file.name}: ${fmt(r.file?.rows)} rows (phone column: ${r.file?.column}). ${r.message}` : 'Not added: ' + r.message);
      if (r.ok) {
        const u = { file: file.name, at: new Date().toISOString(), counts: r.counts, results: (r.results || []).slice(0, 20000) };
        saveUpload(brand, u); if (onUploaded) onUploaded(u);
        setFile(null); const el = document.getElementById('wa-bulk-file'); if (el) el.value = '';
        loadQueue();
      }
    } catch (e) { setMsg('Not added: ' + String(e.message || e)); }
    finally { setBusy(''); }
  };

  const sendNext = async () => {
    const left = queue && queue.perDay ? queue.perDay - queue.sentToday : 30;
    if (!window.confirm(`Send the WhatsApp template now to the next ${Math.min(30, left)} ${brand} numbers waiting?`)) return;
    setBusy('send'); setMsg('Sending… (about 30-45 seconds)');
    try {
      const r = await waPost({ action: 'sendnext', brand });
      setMsg(r.ok ? r.message : 'Not sent: ' + r.message);
      if (onUploaded) onUploaded(null);                  // results table refreshes its WhatsApp column
    } catch (e) {
      setMsg('The page lost the connection while sending. Messages that went out are marked Sent; wait a minute, then check the count below.');
    } finally { setBusy(''); loadQueue(); }
  };

  const capLeft = queue && queue.perDay ? Math.max(0, queue.perDay - queue.sentToday) : null;
  return (
    <section className="card section report-card">
      <h2>Upload list &amp; send</h2>
      <p className="sub">CSV or Excel (.xlsx) with a phone column; other columns are ignored (a Name column is used if there).
        Everyone in the file is added with WhatsApp consent = Yes. <b>Send next 30</b> sends the template to the next 30 numbers waiting
        (oldest first), up to the daily limit.</p>
      <div className="report-grid">
        <label className="field"><span className="field-label">Phone list (.csv or .xlsx)</span>
          <input id="wa-bulk-file" className="input" type="file" accept=".csv,.txt,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)} disabled={!!busy} /></label>
      </div>
      <div className="report-actions">
        <button className="btn-primary" onClick={upload} disabled={!file || !!busy}>{busy === 'upload' ? 'Adding…' : 'Add numbers'}</button>
        <button className="btn-primary" onClick={sendNext} disabled={!!busy || !queue || queue.error || !queue.waiting || capLeft === 0}>
          {busy === 'send' ? 'Sending…' : 'Send next 30'}</button>
        <span className="muted">{queue === null ? 'Checking…' : queue.error ? queue.error
          : `${fmt(queue.waiting)} waiting · ${fmt(queue.sentToday)} sent today${queue.perDay ? ` of ${fmt(queue.perDay)} allowed` : ''}${queue.live ? '' : ' · test mode (Settings)'}`}</span>
      </div>
      {msg ? <p className="muted" role="status" aria-live="polite" style={{ marginTop: 10 }}>{msg}</p> : null}
    </section>
  );
}

const GROUPS = [
  ['all', 'All', () => true],
  ['added', 'Added', (r) => r[2] === 'Added' || r[2] === 'Consent set to Yes'],
  ['there', 'Already there', (r) => r[2] === 'Already there'],
  ['skipped', 'Skipped', (r) => !r[3]],
];
const csvCell = (v) => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);

/** The last uploaded file for this brand: every number, what happened to it, and its WhatsApp status now. */
export function UploadResults({ brand, version }) {
  const [up, setUp] = useState(null);
  const [status, setStatus] = useState({});
  const [group, setGroup] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setUp(loadUpload(brand)); setStatus({}); setGroup('all'); setPage(1); }, [brand, version]);

  const refresh = useCallback(async () => {
    const u = loadUpload(brand);
    const rows = u ? [...new Set(u.results.map((r) => r[3]).filter(Boolean))] : [];
    if (!rows.length) return;
    setLoading(true);
    try { const r = await waPost({ action: 'rowstatus', brand, rows }); if (r.ok) setStatus(r.status || {}); }
    finally { setLoading(false); }
  }, [brand]);
  useEffect(() => { refresh(); }, [refresh, version]);

  if (!up) return null;
  const pick = (GROUPS.find((g) => g[0] === group) || GROUPS[0])[2];
  const list = up.results.filter(pick), PER = 100, shown = list.slice(0, page * PER);
  const wa = (r) => {
    const s = status[r[3]];
    if (!s) return r[4] || (r[3] ? 'Waiting' : '–');
    return s[0] ? s[0] + (s[2] ? ' · ' + s[2] : '') : 'Waiting';
  };
  const download = () => {
    const lines = [['Number', 'Name', 'Result', 'Row in ' + brand + ' tab', 'WhatsApp'].join(',')]
      .concat(up.results.map((r) => [r[0], r[1], r[2], r[3] || '', wa(r)].map(csvCell).join(',')));
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `${brand} upload - ${up.file.replace(/\.\w+$/, '')}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const c = up.counts || {};
  return (
    <section className="card section">
      <div className="card-head">
        <div><h2>Last upload: {up.file}</h2>
          <p className="sub">{new Date(up.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} ·
            {' '}{fmt(c.added)} added · {fmt(c.updated)} set to consent Yes · {fmt(c.already)} already there · {fmt((c.dnc || 0) + (c.bad || 0) + (c.repeated || 0))} skipped</p></div>
        <div className="reply-actions" style={{ marginTop: 0 }}>
          <button className="btn-act" onClick={refresh} disabled={loading}>{loading ? 'Updating…' : 'Refresh status'}</button>
          <button className="btn-act" onClick={download}>Download (Excel CSV)</button>
        </div>
      </div>
      <div className="seg" role="group" aria-label="Show" style={{ marginBottom: 10 }}>
        {GROUPS.map(([k, label, f]) => <button key={k} aria-pressed={group === k} onClick={() => { setGroup(k); setPage(1); }}>{label} ({fmt(up.results.filter(f).length)})</button>)}
      </div>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th>Number</th><th>Name</th><th>Result</th><th>WhatsApp</th></tr></thead>
        <tbody>{shown.map((r, i) => (
          <tr key={i}><td className="num">{r[0]}</td><td>{r[1] || '–'}</td>
            <td>{r[2]}{r[3] ? <div className="muted" style={{ fontSize: 12 }}>row {r[3]}</div> : null}</td><td>{wa(r)}</td></tr>
        ))}</tbody></table></div>
      {list.length > shown.length ? <button className="linkbtn" style={{ marginTop: 10 }} onClick={() => setPage(page + 1)}>Show more ({fmt(list.length - shown.length)} left)</button> : null}
    </section>
  );
}
