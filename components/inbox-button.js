'use client';
import { useEffect, useState } from 'react';
import { chatFacts } from '../lib/inbox';

/** Top-right inbox icon with the number of unread WhatsApp replies (same "seen" memory as the inbox page). */
export function InboxButton() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch('/api/inbox', { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (d.error || !Array.isArray(d.chats)) return;
        let seen = null;
        try { seen = JSON.parse(localStorage.getItem('inbox-seen') || 'null'); } catch (e) { seen = null; }
        if (!seen) return;   // inbox never opened in this browser: nothing counts as unread yet
        if (!stop) setUnread(d.chats.reduce((s, c) => s + chatFacts(c, d.messages, seen).unread, 0));
      } catch (e) { /* the button still works without a count */ }
    };
    check();
    const t = setInterval(check, 60000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  return (
    <a className="inbox-btn" href="/inbox" aria-label={unread ? `WhatsApp inbox, ${unread} unread` : 'WhatsApp inbox'} title="WhatsApp inbox">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M8 10.5h8M8 13.8h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="inbox-btn-label">Inbox</span>
      {unread ? <span className="inbox-btn-badge">{unread > 99 ? '99+' : unread}</span> : null}
    </a>
  );
}
