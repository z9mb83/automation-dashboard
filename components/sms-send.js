'use client';
import { useCallback, useEffect, useState } from 'react';
import { BRANDS } from '../lib/brands';
import { Logo } from './wa-send';
import { waPost } from './wa-bulk';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

async function smsPost(body) {
  const res = await fetch('/api/sms-send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (res.status === 401) { window.location.href = '/login'; return { ok: false, message: 'Signed out.' }; }
  return res.json().catch(() => ({ ok: false, message: 'HTTP ' + res.status + ' (the send may still be running: refresh in a minute)' }));
}

/** Send SMS page: Shaadi Bells and Property Experts (the two OCR sheets), each with "Send next 100". */
export function SmsSend() {
  const [info, setInfo] = useState(null);
  const [logos, setLogos] = useState({});
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState({});

  const load = useCallback(() => {
    smsPost({ action: 'status' }).then((r) => setInfo(r.ok ? r : { error: r.message })).catch((e) => setInfo({ error: String(e.message || e) }));
  }, []);
  useEffect(() => {
    load();
    waPost({ action: 'brands' }).then((r) => {
      if (r.ok) setLogos(Object.fromEntries(r.brands.map((b) => [b.code, b])));
    }).catch(() => {});
  }, [load]);

  const send = async (b) => {
    const name = (BRANDS.find((x) => x.code === b.code) || { name: b.code }).name;
    if (!window.confirm(`Send SMS now to the next ${Math.min(b.limit || 100, b.waiting || 100)} ${name} numbers waiting?\n\n` +
      `Template: ${b.template}\nNumbers already texted, DND and not-in-use numbers are skipped automatically.`)) return;
    setBusy(b.code);
    setResult((x) => ({ ...x, [b.code]: null }));
    const r = await smsPost({ action: 'sendnext', brand: b.code });
    setBusy('');
    setResult((x) => ({ ...x, [b.code]: r }));
    load();
  };

  return (
    <div>
      <h2 className="page-title">Send SMS</h2>
      <p className="muted" style={{ marginTop: 0 }}>Numbers come from the newspaper-ad sheets (Shaadi OCR and Property). <b>Send next 100</b> texts the next 100
        numbers not texted yet, with the brand&apos;s DLT template through Telinfy. Numbers already texted, DND and not-in-use numbers are skipped.
        Promotional SMS go out only between 9 AM and 9 PM.</p>
      {info && info.error ? <div className="banner err">Could not load: {info.error}</div> : null}
      <div className="grid three">
        {(info && info.brands ? info.brands : [{ code: 'SB' }, { code: 'PE' }]).map((b) => {
          const meta = BRANDS.find((x) => x.code === b.code) || { name: b.code };
          const r = result[b.code];
          const blocked = !info || b.error || !b.live || !b.window || !b.waiting;
          return (
            <div key={b.code} className="card brand-card">
              <div className="choice-head"><Logo b={{ ...(logos[b.code] || {}), code: b.code }} /><div><h2>{meta.name}</h2>
                <div className="muted" style={{ fontSize: 12 }}>{b.template ? 'Template: ' + b.template : b.sheet || ''}</div></div></div>
              {b.error ? <div className="banner err" style={{ marginTop: 10 }}>{b.error}</div> : info ? (
                <div className="choice-stats">
                  <div><div className="value">{fmt(b.waiting)}</div><div className="label">not texted yet</div></div>
                  <div><div className="value">{fmt(b.sentToday)}</div><div className="label">sent today</div></div>
                  <div><div className="value">{fmt(b.sent)}</div><div className="label">sent so far</div></div>
                </div>) : <p className="muted" style={{ margin: 0 }}>Loading…</p>}
              {info && !b.error && !b.live ? <div className="banner" style={{ marginTop: 10 }}>Dry run mode: switch to Live in the sheet (SMS → Mode) to send.</div> : null}
              {info && !b.error && b.live && !b.window ? <div className="banner" style={{ marginTop: 10 }}>Outside sending hours (9 AM – 9 PM).</div> : null}
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={() => send(b)} disabled={!!busy || blocked}>
                  {busy === b.code ? 'Sending… (up to a minute)' : 'Send next 100'}</button>
              </div>
              {r ? (r.ok
                ? <div className="banner" style={{ marginTop: 10 }}>Done: {fmt(r.sent)} accepted by Telinfy{r.failed ? `, ${fmt(r.failed)} failed` : ''}{r.skipped ? `, ${fmt(r.skipped)} skipped (duplicate / DND / not in use)` : ''}
                  {r.firstRow ? ` · sheet rows ${r.firstRow}–${r.lastRow}` : ''}. Delivery reports follow in Analytics → SMS.</div>
                : <div className="banner err" style={{ marginTop: 10 }}>{r.message || 'Not sent.'}</div>) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
