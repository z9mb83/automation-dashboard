import { NextResponse } from 'next/server';
import { COOKIE, sessionToken, safeEqual } from '../../../lib/auth';

export async function POST(req) {
  const form = await req.formData();
  const ok = safeEqual(form.get('password'), process.env.DASHBOARD_PASSWORD);
  const url = new URL(ok ? '/' : '/login?error=1', req.url);
  const res = NextResponse.redirect(url, 303);
  if (ok) {
    res.cookies.set(COOKIE, await sessionToken(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  } else {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
  }
  return res;
}
