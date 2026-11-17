'use client';
import { useCallback, useEffect, useState } from 'react';
import { BRANDS } from '../lib/brands';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

async function post(body) {
  const res = await fetch('/api/whatsapp', body instanceof FormData
    ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 401) { window.location.href = '/login'; return { ok: false, message: 'Signed out.' }; }
  return res.json().catch(() => ({ ok: false, message: 'HTTP ' + res.status }));
}

/** WhatsApp page: upload a phone list for a brand, then "Send next 30". */
export function WhatsAppBulk({ defaultBrand }) {
  const first = BRANDS.some((b) => b.code === defaultBrand) ? defaultBrand : BRANDS[0].code;
  const [brand, setBrand] = useState(first);
  const [file, setFile] = useState(null);
  const [queue, setQueue] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { if (BRANDS.some((b) => b.code === defaultBrand)) setBrand(defaultBrand); }, [defaultBrand]);

  const loadQueue = useCallback(async (b) => {
    setQueue(null);
    try { const q = await post({ action: 'queue', brand: b }); setQueue(q.ok ? q : { error: q.message }); }
    catch (e) { setQueue({ error: String(e.message || e) }); }
  }, []);
  useEffect(() => { loadQueue(brand); }, [brand, loadQueue]);

  const upload = async () => {
    if (!file) return;
    setBusy('upload'); setMsg('Reading the file and adding the numbers…');
    try {
      const fd = new FormData(); fd.append('brand', brand); fd.append('file', file);
      const r = await post(fd);
      setMsg(r.ok ? `${file.name}: ${fmt(r.file?.rows)} rows (phone column: ${r.file?.column}). ${r.message}` : 'Not added: ' + r.message);
      if (r.ok) { setFile(null); const el = document.getElementById('wa-bulk-file'); if (el) el.value = ''; loadQueue(brand); }
    } catch (e) { setMsg('Not added: ' + String(e.message || e)); }
    finally { setBusy(''); }
  };

  const sendNext = async () => {
    const left = queue && queue.perDay ? queue.perDay - queue.sentToday : 30;
    if (!window.confirm(`Send the WhatsApp template now to the next ${Math.min(30, left)} ${brand} numbers waiting?`)) return;
    setBusy('send'); setMsg('Sending… (about 30-45 seconds)');
    try {
      const r = await post({ action: 'sendnext', brand });
      setMsg(r.ok ? r.message : 'Not sent: ' + r.message);
    } catch (e) {
      setMsg('The page lost the connection while sending. Messages that went out are marked Sent; wait a minute, then check the count below.');
    } finally { setBusy(''); loadQueue(brand); }
  };

  const capLeft = queue && queue.perDay ? Math.max(0, queue.perDay - queue.sentToday) : null;
  return (
    <section className="card section report-card">
      <h2>Upload numbers & send</h2>
      <p className="sub">Upload a CSV or Excel (.xlsx) file with a column of phone numbers. They are added to the brand with WhatsApp consent = Yes.
        Numbers already there, in Do Not Contact or repeated in the file are skipped. Then <b>Send next 30</b> sends the template to the next 30 numbers waiting
        (oldest first), up to the brand&apos;s daily limit in the Limits tab.</p>
      <div className="report-grid">
        <label className="field"><span className="field-label">Brand</span>
          <select className="input" value={brand} onChange={(e) => { setBrand(e.target.value); setMsg(''); }} disabled={!!busy}>
            {BRANDS.map((b) => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
          </select></label>
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
