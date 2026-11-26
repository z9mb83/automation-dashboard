'use client';
import { useEffect, useState } from 'react';
import { BRANDS } from '../lib/brands';
import { driveId, fillTemplate, waHtml } from '../lib/templates';

// One request per page visit for all brands' templates (the sheet caches Meta's answer for 10 minutes).
let loading = null;
function loadTemplates() {
  if (!loading) {
    loading = fetch('/api/whatsapp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'templates' }) })
      .then((r) => r.json()).then((j) => { if (!j.ok) throw new Error(j.message || 'Could not load the templates'); return j.templates || []; })
      .catch((e) => { loading = null; throw e; });
  }
  return loading;
}

/** Template name that opens the preview when clicked (owner: Templates in use; admin: status panel, Send WhatsApp). */
export function TemplateLink({ code, name, logo }) {
  const [open, setOpen] = useState(false);
  if (!name) return <span className="muted">none</span>;
  return (
    <>
      <button type="button" className="linkbtn tpl-link" onClick={() => setOpen(true)} title="See how this message looks">{name} <span aria-hidden="true">👁</span></button>
      {open ? <TemplatePreview code={code} logo={logo} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** WhatsApp-style bubble: image header (the brand logo from WhatsApp Setup), text with sample values, footer, buttons. */
export function TemplatePreview({ code, logo, onClose }) {
  const [tpl, setTpl] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let on = true;
    loadTemplates().then((list) => { if (on) { const t = list.find((x) => x.code === code); t ? setTpl(t) : setError('No template for this brand.'); } })
      .catch((e) => on && setError(String(e.message || e)));
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { on = false; window.removeEventListener('keydown', key); };
  }, [code, onClose]);

  const brand = (BRANDS.find((b) => b.code === code) || {}).name || code;
  const imgId = tpl ? driveId(tpl.headerUrl) || (logo && logo.logoId) : '';
  const imgSrc = imgId ? `/api/logo?id=${encodeURIComponent(imgId)}` : tpl && /^https:\/\//.test(tpl.headerUrl || '') ? tpl.headerUrl : (logo && logo.logoUrl) || '';

  return (
    <div className="wa-modal-bg" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wa-modal tpl-modal" role="dialog" aria-label={`${brand} WhatsApp template`}>
        <div className="tpl-modal-head">
          <div><h2>{brand}</h2>
            <div className="muted">{tpl && !tpl.error ? `${tpl.name} · ${tpl.language}${tpl.category ? ' · ' + tpl.category.toLowerCase() : ''}${tpl.status ? ' · ' + tpl.status.toLowerCase() : ''}` : 'WhatsApp template'}</div></div>
          <button type="button" className="linkbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="tpl-chat">
          {!tpl && !error ? <p className="muted">Loading the template from Meta…</p> : null}
          {error || (tpl && tpl.error) ? <p className="err">{error || tpl.error}</p> : null}
          {tpl && !tpl.error ? (
            <div className="tpl-bubble">
              {tpl.header && tpl.header.format === 'IMAGE' ? (imgSrc ? <img src={imgSrc} alt={`${brand} header image`} /> : <div className="tpl-media">Image</div>) : null}
              {tpl.header && ['VIDEO', 'DOCUMENT'].includes(tpl.header.format) ? <div className="tpl-media">{tpl.header.format.toLowerCase()}</div> : null}
              {tpl.header && tpl.header.format === 'TEXT' && tpl.header.text ? <div className="tpl-title" dangerouslySetInnerHTML={{ __html: waHtml(tpl.header.text) }} /> : null}
              <div className="tpl-body" dangerouslySetInnerHTML={{ __html: waHtml(fillTemplate(tpl.body, tpl.examples)) }} />
              {tpl.footer ? <div className="tpl-footer">{tpl.footer}</div> : null}
              <div className="tpl-time">10:30</div>
              {tpl.buttons.length ? <div className="tpl-buttons">{tpl.buttons.map((b, i) => <div key={i} className="tpl-btn">{b.type === 'URL' ? '↗ ' : b.type === 'PHONE_NUMBER' ? '✆ ' : '↩ '}{b.text}</div>)}</div> : null}
            </div>
          ) : null}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>The name is a sample; each customer sees their own name. Text from Meta, as approved.</p>
      </div>
    </div>
  );
}
