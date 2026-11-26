// Session cookie = HMAC-SHA256(SHEET_API_KEY, text) where text depends on the login (works in Edge middleware and Node):
//   owner  "dash:" + DASHBOARD_PASSWORD          (unchanged since before roles, so owner sessions stay signed in)
//   admin  "dash:admin:" + ADMIN_PASSWORD        (no ADMIN_PASSWORD on Vercel = no admin login)
//   viewer "dash:viewer"                         (no password)
// Changing a password logs out only that login. No secrets are ever sent to the browser.
export const COOKIE = 'dash_session';

async function hmac(text) {
  const secret = process.env.SHEET_API_KEY || process.env.DASHBOARD_PASSWORD || '';
  if (!secret) return '';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cookie value for a login, or '' when that login is not set up. */
export async function tokenFor(role, env = process.env) {
  const owner = env.DASHBOARD_PASSWORD || '';
  if (!owner) return '';                                   // nothing works until the owner password exists
  if (role === 'owner') return hmac('dash:' + owner);
  if (role === 'admin') return env.ADMIN_PASSWORD ? hmac('dash:admin:' + env.ADMIN_PASSWORD) : '';
  if (role === 'viewer') return hmac('dash:viewer');
  return '';
}

/** Kept for older imports: the owner's cookie value. */
export const sessionToken = () => tokenFor('owner');

/** Which login a cookie belongs to: 'owner' | 'admin' | 'viewer' | ''. */
export async function roleOf(cookie) {
  if (!cookie) return '';
  for (const role of ['owner', 'admin', 'viewer']) {
    const t = await tokenFor(role);
    if (t && safeEqual(cookie, t)) return role;
  }
  return '';
}

/** Password typed on the sign-in page -> 'owner' | 'admin' | '' (the owner password wins if both are the same). */
export function roleForPassword(password, env = process.env) {
  if (safeEqual(password, env.DASHBOARD_PASSWORD)) return 'owner';
  if (env.ADMIN_PASSWORD && safeEqual(password, env.ADMIN_PASSWORD)) return 'admin';
  return '';
}

export function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
