'use client';
import { useEffect, useState } from 'react';
import { BRANDS, brandVar } from '../lib/brands';
import { WhatsAppBulk, UploadResults, waPost } from './wa-bulk';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');

function Logo({ b, size = 56 }) {
  const [bad, setBad] = useState(false);
  const src = b && b.logoId ? `/api/logo?id=${encodeURIComponent(b.logoId)}` : b && b.logoUrl ? b.logoUrl : '';
  const meta = BRANDS.find((x) => x.code === (b && b.code));
  if (!src || bad) {
    return <span className="brand-logo fallback" style={{ width: size, height: size, background: brandVar(b.code) }}>{b.code}</span>;
  }
  return <img className="brand-logo" src={src} alt={(meta ? meta.name : b.code) + ' logo'} width={size} height={size} onError={() => setBad(true)} />;
}

/** Send WhatsApp: one card per brand (logo, template, waiting, sent today). */
export function SendLanding({ open }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let on = true;
    waPost({ action: 'brands' }).then((r) => { if (on) setInfo(r.ok ? r : { error: r.message }); })
      .catch((e) => { if (on) setInfo({ error: String(e.message || e) }); });
    return () => { on = false; };
  }, []);
  const list = info && info.brands ? info.brands : BRANDS.map((b) => ({ code: b.code, name: b.name }));
  return (
    <div>
      <h2 className="page-title">Choose a brand</h2>
      {info && info.error ? <div className="banner err">Could not load the brands: {info.error}</div> : null}
      <div className="grid three">
        {list.map((b) => (
          <button key={b.code} className="card choice brand-card" onClick={() => open(b.code)} aria-label={'Open ' + (b.name || b.code)}>
            <div className="choice-head"><Logo b={b} /><div><h2>{b.name || b.code}</h2>
              <div className="muted" style={{ fontSize: 12 }}>{b.template ? 'Template: ' + b.template : info ? '' : 'Loading…'}</div></div>
              <span className="chev" aria-hidden="true">&rarr;</span></div>
            {info && info.brands ? (
              <div className="choice-stats">
                <div><div className="value">{fmt(b.waiting)}</div><div className="label">waiting</div></div>
                <div><div className="value">{fmt(b.sentToday)}</div><div className="label">sent today</div></div>
                <div><div className="value">{b.perDay ? fmt(Math.max(0, b.perDay - b.sentToday)) : '∞'}</div><div className="label">left today</div></div>
              </div>) : null}
          </button>
        ))}
      </div>
      {info && info.brands && !info.live ? <div className="banner" style={{ marginTop: 14 }}>Live sending is off (Settings tab): only the test numbers get WhatsApp.</div> : null}
    </div>
  );
}

/** One brand: logo, today, upload + Send next 30, last upload, link to its analytics. */
export function SendBrand({ code, data, back, analytics }) {
  const [version, setVersion] = useState(0);
  const [b, setB] = useState({ code });
  useEffect(() => {
    let on = true;
    waPost({ action: 'brands' }).then((r) => { if (on && r.ok) setB(r.brands.find((x) => x.code === code) || { code }); }).catch(() => {});
    return () => { on = false; };
  }, [code]);
  const meta = BRANDS.find((x) => x.code === code) || { name: code };
  const day = data && data.daily && data.daily.length ? data.daily[data.daily.length - 1] : {};
  const tot = (data && data.brands || []).find((x) => x.code === code) || {};
  return (
    <div>
      <button className="linkbtn back" onClick={back}>&larr; All brands</button>
      <div className="brand-head">
        <Logo b={b} size={72} />
        <div><h2 style={{ margin: 0, fontSize: 22 }}>{meta.name}</h2>
          <div className="muted">{b.template ? 'WhatsApp template: ' + b.template : ''}</div></div>
        <button className="btn-act" style={{ marginLeft: 'auto' }} onClick={() => analytics(code)}>View analytics &rarr;</button>
      </div>
      <div className="grid kpis">
        <div className="card tile hero"><div className="label">Sent today</div><div className="value">{fmt((day.whatsapp || {})[code])}</div>
          <div className="note">{b.perDay ? `daily limit ${fmt(b.perDay)}` : ''}</div></div>
        <div className="card tile"><div className="label">Replies today</div><div className="value">{fmt((day.waReplies || {})[code])}</div><div className="note">answer in the Inbox</div></div>
        <div className="card tile"><div className="label">Sent so far</div><div className="value">{fmt(tot.waSent)}</div><div className="note">{fmt(tot.waRead)} read · {fmt(tot.waReplied)} replied</div></div>
        <div className="card tile"><div className="label">Not delivered</div><div className="value">{fmt(tot.waUndelivered)}</div><div className="note">reasons in Analytics</div></div>
      </div>
      <WhatsAppBulk brand={code} onUploaded={() => setVersion((v) => v + 1)} />
      <UploadResults brand={code} version={version} />
    </div>
  );
}
