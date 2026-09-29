import { NextResponse } from 'next/server';
import { COOKIE, sessionToken, safeEqual } from './lib/auth';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) return NextResponse.next();
  const expected = await sessionToken();
  if (!expected) return new NextResponse('Dashboard password is not configured (DASHBOARD_PASSWORD).', { status: 503 });
  if (safeEqual(req.cookies.get(COOKIE)?.value, expected)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'login required' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };
