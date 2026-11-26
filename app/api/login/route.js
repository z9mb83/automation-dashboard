import { NextResponse } from 'next/server';
import { COOKIE, loginRole, tokenFor } from '../../../lib/auth';

// Sign-in page: the person picks Owner / Admin / Viewer (as=...), owner and admin type their own password.
// The cookie has no expiry date, so it ends when the browser is closed and the choice is shown again next time.
export async function POST(req) {
  const form = await req.formData();
  const as = String(form.get('as') || (form.get('mode') === 'viewer' ? 'viewer' : ''));
  const role = loginRole(as, form.get('password'));
  const token = role ? await tokenFor(role) : '';
  const back = ['owner', 'admin'].includes(as) ? `/login?error=${as}` : '/login?error=1';
  const res = NextResponse.redirect(new URL(token ? '/' : back, req.url), 303);
  if (token) {
    res.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  } else {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
  }
  return res;
}
