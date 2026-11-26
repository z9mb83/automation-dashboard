'use client';
import { useEffect, useState } from 'react';
import { BRANDS, brandVar } from '../lib/brands';

/**
 * Admin (Home page): what is switched on right now. The owner gets TemplatesInUse instead.
 *   WhatsApp: live sending, automatic sending, per brand On/Off + template + daily max (sheet: Settings, Limits, WhatsApp Setup)
 *   Email: per brand On/Off (Limits) and every Gmail sender with its limit and state (Mailboxes)
 *   SMS: per OCR sheet Live / Dry run, automatic 30-minute sending + last run, DLT template (SmsApi.gs status)
 * Read-only. The server only answers the brand-card and SMS-status calls for the owner where they hold anything private.
 */
const onOff = (on, onText = 'On', offText = 'Off') => <span className={'pill ' + (on ? 'ok' : 'bad')}>{on ? onText : offText}</span>;
const brandCell = (code) => <span className="brandcell"><i className="swatch" style={{ background: brandVar(code) }} />{code}</span>;

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: false, message: 'HTTP ' + res.status }));
}

/** WhatsApp brand cards + SMS sheet status (templates, live / automatic), loaded once. */
function useStatus() {
  const [wa, setWa] = useState(null);
  const [sms, setSms] = useState(null);
  useEffect(() => {
    post('/api/whatsapp', { action: 'brands' }).then((r) => setWa(r.ok ? r : { error: r.message })).catch((e) => setWa({ error: String(e.message || e) }));
    post('/api/sms-send', { action: 'status' }).then((r) => setSms(r.ok ? r : { error: r.message })).catch((e) => setSms({ error: String(e.message || e) }));
  }, []);
  return { wa, sms };
}

/** Owner (read-only): which WhatsApp and SMS templates are being used, per brand. */
export function TemplatesInUse({ data }) {
  const { wa, sms } = useStatus();
  const waCards = Object.fromEntries(((wa && wa.brands) || []).map((b) => [b.code, b]));
  return (
    <section className="card section status-panel" id="templates">
      <h2>Templates in use</h2>
      <p className="sub">The messages customers receive. Sending is run by the admin.</p>
      <h3>WhatsApp</h3>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th>Brand</th><th>WhatsApp</th><th>Template</th><th className="r">Sent today</th></tr></thead>
        <tbody>{BRANDS.map((b) => {
          const row = data.brands.find((x) => x.code === b.code) || {}, c = waCards[b.code] || {};
          return <tr key={b.code}><td>{brandCell(b.code)}</td><td>{onOff(c.on !== undefined ? c.on : row.waOn)}</td>
            <td>{wa ? (c.template || <span className="muted">none</span>) : '…'}</td><td className="r">{c.sentToday ?? '–'}</td></tr>;
        })}</tbody></table></div>
      {wa && wa.error ? <p className="err">{wa.error}</p> : null}
      <h3>SMS</h3>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th>Brand</th><th>Template (DLT)</th><th className="r">Sent today</th></tr></thead>
        <tbody>{sms && sms.brands ? sms.brands.map((b) => (
          <tr key={b.code}><td>{brandCell(b.code)}</td>
            {b.error ? <td colSpan={2} className="err">{b.error}</td> : <>
              <td><b>{b.template || '–'}</b>{b.templateId ? <span className="muted"> · ID {b.templateId}</span> : null}
                {b.templateText ? <div className="tpl-text">{b.templateText}</div> : null}</td>
              <td className="r">{b.sentToday ?? '–'}</td></>}
          </tr>)) : <tr><td colSpan={3} className="empty">{sms && sms.error ? sms.error : 'Loading…'}</td></tr>}</tbody></table></div>
    </section>
  );
}

export function SendingStatus({ data, mailboxStatus }) {
  const { wa, sms } = useStatus();
  const s = data.settings || {};
  const auto = String(s.whatsappAuto || 'Off');
  const waCards = Object.fromEntries(((wa && wa.brands) || []).map((b) => [b.code, b]));

  return (
    <section className="card section status-panel" id="status">
      <h2>What is switched on</h2>
      <p className="sub">Live settings from the sheets (admin only). Change them in the sheets: Limits, Settings, Mailboxes, and the SMS menu of each OCR sheet.</p>

      <h3>WhatsApp</h3>
      <p className="status-line">Live sending {onOff(s.whatsappLive, 'On', 'Off (test numbers only)')} · Automatic sending {onOff(!/^off/i.test(auto), auto.replace(/^On\s*/i, 'On ').trim(), 'Off')}</p>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th>Brand</th><th>WhatsApp</th><th>Template</th><th className="r">Sent today</th><th className="r">Daily max</th><th className="r">Waiting</th></tr></thead>
        <tbody>{BRANDS.map((b) => {
          const row = data.brands.find((x) => x.code === b.code) || {}, c = waCards[b.code] || {};
          return <tr key={b.code}><td>{brandCell(b.code)}</td><td>{onOff(c.on !== undefined ? c.on : row.waOn)}</td>
            <td>{wa ? (c.template || <span className="muted">none</span>) : '…'}</td>
            <td className="r">{c.sentToday ?? '–'}</td><td className="r">{c.perDay || '–'}</td><td className="r">{c.waiting ?? '–'}</td></tr>;
        })}</tbody></table></div>
      {wa && wa.error ? <p className="err">Templates: {wa.error}</p> : null}

      <h3>SMS</h3>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th>Brand</th><th>Mode</th><th>Automatic</th><th>Last automatic run</th><th>Template (DLT)</th></tr></thead>
        <tbody>{sms && sms.brands ? sms.brands.map((b) => (
          <tr key={b.code}><td>{brandCell(b.code)}</td>
            {b.error ? <td colSpan={4} className="err">{b.error}</td> : <>
              <td>{onOff(b.live, 'Live', 'Dry run')}</td>
              <td>{b.auto === undefined ? <span className="muted">update the sheet web app</span> : onOff(b.auto, `On · ${b.autoHours ? b.autoHours.replace('-', ':00–') + ':00' : ''}`, 'Off')}</td>
              <td className="muted">{b.autoLast || '–'}</td>
              <td><b>{b.template || '–'}</b>{b.templateId ? <span className="muted"> · ID {b.templateId}{b.sender ? ` · sender ${b.sender}` : ''}</span> : null}
                {b.templateText ? <div className="tpl-text">{b.templateText}</div> : null}</td></>}
          </tr>)) : <tr><td colSpan={5} className="empty">{sms && sms.error ? sms.error : 'Loading…'}</td></tr>}</tbody></table></div>

      <h3>Email</h3>
      <p className="status-line">{BRANDS.map((b) => { const row = data.brands.find((x) => x.code === b.code) || {};
        return <span key={b.code} className="status-chip">{brandCell(b.code)} {onOff(row.mailOn)}</span>; })}</p>
      <div className="tablewrap"><table className="stack">
        <thead><tr><th>Brand</th><th>Gmail sender</th><th>State</th><th className="r">Sent today</th><th className="r">Daily limit</th><th>Last result</th></tr></thead>
        <tbody>{(data.mailboxes || []).length ? data.mailboxes.map((m) => {
          const st = mailboxStatus(m);
          return <tr key={m.brand + m.email}><td>{brandCell(m.brand)}</td><td>{m.email}</td>
            <td><span className={'pill ' + st.kind}>{st.label}</span></td><td className="r">{m.sentToday}</td><td className="r">{m.dailyLimit}</td>
            <td className="muted">{m.lastResult}</td></tr>;
        }) : <tr><td colSpan={6} className="empty">No mailboxes.</td></tr>}</tbody></table></div>
    </section>
  );
}
