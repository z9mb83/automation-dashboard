'use client';
import { useEffect, useState } from 'react';
import { BRANDS } from '../lib/brands';

const indiaToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const TYPES = [['combined', 'Mail + WhatsApp'], ['mail', 'Mail'], ['whatsapp', 'WhatsApp'], ['sms', 'SMS']];

/** "Download report" panel: type, brand, and Today or a date range -> Excel file from /api/report. */
export function ReportCard({ defaultType = 'combined', defaultBrand = 'ALL' }) {
  const [type, setType] = useState(defaultType);
  const [brand, setBrand] = useState(defaultBrand);
  const [when, setWhen] = useState('today');
  const today = indiaToday();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => setType(defaultType), [defaultType]);
  useEffect(() => setBrand(defaultBrand), [defaultBrand]);

  const range = when === 'today' ? { from: today, to: today } : { from, to };
  const bad = when === 'range' && (!from || !to || from > to);

  const download = async () => {
    setBusy(true); setMsg('');
    try {
      const qs = new URLSearchParams({ type, brand, ...range });
      // the report can take 20+ s while the sheet is busy; a dropped connection ("Failed to fetch") is retried once
      let res;
      try { res = await fetch('/api/report?' + qs, { cache: 'no-store' }); }
      catch (e) { setMsg('The sheet is slow right now, trying again...'); res = await fetch('/api/report?' + qs, { cache: 'no-store' }); }
      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'HTTP ' + res.status); }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = /filename\*=UTF-8''([^;]+)/.exec(cd);
      const name = m ? decodeURIComponent(m[1]) : 'report.xlsx';
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg('Downloaded ' + name);
    } catch (e) {
      const m = String(e.message || e);
      setMsg('Could not make the report: ' + (/failed to fetch|network/i.test(m)
        ? 'the sheet took too long to answer (it may be busy sending). Try again in a minute.' : m));
    } finally { setBusy(false); }
  };

  return (
    <section className="card section report-card">
      <h2>Download report</h2>
      <p className="sub">{type === 'sms'
        ? 'Excel file from the Telinfy delivery reports: a summary per template, SMS per day, every SMS with its result, and the numbers to stop texting (DND, not in use).'
        : 'Excel file with a summary per brand and one row per lead. Includes everyone sent a message in the period, plus anyone who replied in it.'}</p>
      <div className="report-grid">
        <div className="field"><span className="field-label">Report</span>
          <div className="seg" role="group" aria-label="Report type">
            {TYPES.map(([k, label]) => <button key={k} aria-pressed={type === k} onClick={() => setType(k)}>{label}</button>)}
          </div></div>
        <label className="field"><span className="field-label">Brand</span>
          <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="ALL">{type === 'sms' ? 'All templates' : 'All brands'}</option>
            {BRANDS.map((b) => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
          </select></label>
        <div className="field"><span className="field-label">Period</span>
          <div className="seg" role="group" aria-label="Period">
            <button aria-pressed={when === 'today'} onClick={() => setWhen('today')}>Today</button>
            <button aria-pressed={when === 'range'} onClick={() => setWhen('range')}>Date range</button>
          </div></div>
        {when === 'range' ? (
          <div className="field"><span className="field-label">From – to</span>
            <div className="dates">
              <input className="input" type="date" aria-label="From" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
              <span className="muted">to</span>
              <input className="input" type="date" aria-label="To" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
            </div></div>
        ) : null}
      </div>
      <div className="report-actions">
        <button className="btn-primary" onClick={download} disabled={busy || bad}>{busy ? 'Preparing…' : 'Download Excel'}</button>
        <span className="muted" role="status" aria-live="polite">{bad ? 'The start date must be on or before the end date.' : msg}</span>
      </div>
    </section>
  );
}
