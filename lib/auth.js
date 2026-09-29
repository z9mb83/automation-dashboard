// Session = HMAC-SHA256(SHEET_API_KEY, "dash:" + DASHBOARD_PASSWORD). Works in Edge (middleware) and Node.
// Changing either value logs everyone out. No secrets are ever sent to the browser.
export const COOKIE = 'dash_session';

export async function sessionToken() {
  const pass = process.env.DASHBOARD_PASSWORD || '';
  const secret = process.env.SHEET_API_KEY || process.env.DASHBOARD_PASSWORD || '';
  if (!pass) return '';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('dash:' + pass));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
