'use client';
import { useEffect, useRef, useState } from 'react';
import { BRANDS, brandVar } from '../lib/brands';
import { monthName, rupees } from '../lib/costs';

let shared = null;   // one request per page view, used by the button and the section
function loadCosts(fresh) {
  if (!shared || fresh) {
    shared = fetch('/api/costs' + (fresh ? '?fresh=1' : ''), { cache: 'no-store' }).then(async (res) => {
      if (res.status === 401) { window.location.href = '/login'; return null; }
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      return j;
    });
    shared.catch(() => { shared = null; });
  }
  return shared;
}

export function useCosts() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const reload = (fresh) => loadCosts(fresh).then((d) => { if (d) { setData(d); setError(''); } }).catch((e) => setError(String(e.message || e)));
  useEffect(() => { reload(false); }, []);
  return { data, error, reload };
}

const name = (code) => (BRANDS.find((b) => b.code === code) || { name: code }).name;

/** Header button: total spent so far; hover (or tap) shows the breakdown. */
export function CostButton() {
  const { data, error } = useCosts();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const label = data ? rupees(data.total, 0) : error ? '₹ –' : '₹ …';
  return (
    <div className={'cost-wrap' + (open ? ' open' : '')} ref={ref}>
      <button className="cost-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}
        aria-label={data ? `Sending cost so far ${rupees(data.total)}` : 'Sending cost so far'}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4h10M7 8.5h10M7 4c4.5 0 6.5 2 6.5 4.5S11.5 13 7 13l8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="cost-btn-label">{label}<span className="cost-btn-sub"> spent</span></span>
      </button>
      <div className="cost-pop" role="dialog" aria-label="Sending costs">
        {!data ? <p className="muted">{error ? 'Could not load costs: ' + error : 'Adding up costs…'}</p> : <>
          <div className="cost-pop-head"><span>Spent on sending so far</span><b>{rupees(data.total)}</b></div>
          <div className="cost-line"><span>WhatsApp <small>{data.whatsapp.charged} delivered templates × {rupees(data.rates.waMarketing, 4)} + 18% GST</small></span><b>{rupees(data.whatsapp.total)}</b></div>
          <div className="cost-line"><span>SMS <small>{data.sms.count} SMS × {rupees(data.rates.sms)} (DND included)</small></span><b>{rupees(data.sms.total)}</b></div>
          <div className="cost-line"><span>Email <small>Gmail, no per-email cost</small></span><b>{rupees(0)}</b></div>
          <div className="cost-line month"><span>This month ({monthName(data.thisMonth.month)})</span><b>{rupees(data.thisMonth.total)}</b></div>
          {data.whatsapp.unknown ? <p className="cost-note">+ up to {rupees(data.whatsapp.unknownMax)} for {data.whatsapp.unknown} older WhatsApp messages without a delivery report.</p> : null}
          <p className="cost-note">Free: {data.whatsapp.free} typed replies / confirmations, {data.whatsapp.failed} failed WhatsApp.</p>
          <a className="cost-more" href="/#costs" onClick={() => setOpen(false)}>Breakdown by brand and month →</a>
        </>}
      </div>
    </div>
  );
}

/** Home page section. */
export function CostSection() {
  const { data, error, reload } = useCosts();
  if (!data) return error ? <div className="banner err" id="costs">Costs: {error}</div> : null;
  return (
    <section className="card section" id="costs">
      <div className="mr-head">
        <div><h2>Sending costs</h2>
          <p className="sub">What WhatsApp and SMS have cost so far (email is free). WhatsApp: Meta charges each delivered marketing template
            {' '}{rupees(data.rates.waMarketing, 4)} + 18% GST; typed replies within 24 hours are free. SMS: Telinfy deducts {rupees(data.rates.sms)} per SMS, also for DND numbers.</p></div>
        <button className="linkbtn" onClick={() => reload(true)}>Refresh</button>
      </div>
      {data.sample ? <div className="banner">Part of this is <b>sample data</b>: a feed or the Telinfy key is not connected.</div> : null}
      {data.errors && data.errors.length ? <div className="banner err">Partly missing: {data.errors.join(' · ')}</div> : null}
      <div className="grid kpis mr-kpis">
        <div className="card tile hero"><div className="label">Total so far</div><div className="value">{rupees(data.total, 0)}</div><div className="note">WhatsApp + SMS</div></div>
        <div className="card tile"><div className="label">WhatsApp</div><div className="value">{rupees(data.whatsapp.total, 0)}</div><div className="note">{data.whatsapp.charged} delivered · incl. {rupees(data.whatsapp.gst, 0)} GST</div></div>
        <div className="card tile"><div className="label">SMS</div><div className="value">{rupees(data.sms.total, 0)}</div><div className="note">{data.sms.count} SMS since Oct</div></div>
        <div className="card tile"><div className="label">This month</div><div className="value">{rupees(data.thisMonth.total, 0)}</div><div className="note">{monthName(data.thisMonth.month)}</div></div>
        <div className="card tile"><div className="label">Per WhatsApp</div><div className="value">{rupees(data.rates.waMarketing * 1.18)}</div><div className="note">incl. GST</div></div>
        <div className="card tile"><div className="label">Email</div><div className="value">{rupees(0, 0)}</div><div className="note">Gmail, free</div></div>
      </div>
      <div className="grid two">
        <div className="tablewrap"><table className="stack">
          <thead><tr><th>Brand</th><th className="r">WhatsApp</th><th className="r">Cost</th><th className="r">SMS</th><th className="r">Cost</th><th className="r">Total</th></tr></thead>
          <tbody>{data.brands.map((b) => (
            <tr key={b.code}><td><span className="brandcell"><i className="swatch" style={{ background: brandVar(b.code) }} />{name(b.code)}</span></td>
              <td className="r">{b.wa.charged}</td><td className="r">{rupees(b.wa.total)}</td><td className="r">{b.sms.count}</td><td className="r">{rupees(b.sms.total)}</td>
              <td className="r"><b>{rupees(b.total)}</b></td></tr>))}</tbody>
        </table></div>
        <div className="tablewrap"><table className="stack">
          <thead><tr><th>Month</th><th className="r">WhatsApp</th><th className="r">SMS</th><th className="r">Total</th></tr></thead>
          <tbody>{data.months.map((m) => (
            <tr key={m.month}><td>{monthName(m.month)}</td><td className="r">{rupees(m.wa)} <span className="muted">({m.waCharged})</span></td>
              <td className="r">{rupees(m.smsTotal)} <span className="muted">({m.sms})</span></td><td className="r"><b>{rupees(m.total)}</b></td></tr>))}</tbody>
        </table></div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Estimate from our own logs (WhatsApp Log delivery reports, Telinfy reports), updated {data.generatedAt.slice(11)} India time.
        {data.whatsapp.unknown ? ` ${data.whatsapp.unknown} older WhatsApp messages have no delivery report: up to ${rupees(data.whatsapp.unknownMax)} more.` : ''} Meta&apos;s invoice is the final figure. Rates checked {data.rates.checked}.</p>
    </section>
  );
}
