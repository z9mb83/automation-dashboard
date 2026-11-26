import { NextResponse } from 'next/server';
import { COOKIE, roleForPassword, tokenFor } from '../../../lib/auth';

// Sign-in form: a password (owner or admin) or the "Continue as viewer" button (mode=viewer, no password).
export async function POST(req) {
  const form = await req.formData();
  const role = form.get('mode') === 'viewer' ? 'viewer' : roleForPassword(form.get('password'));
  const token = role ? await tokenFor(role) : '';
  const res = NextResponse.redirect(new URL(token ? '/' : '/login?error=1', req.url), 303);
  if (token) {
    res.cookies.set(COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  } else {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
  }
  return res;
}
