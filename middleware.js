import { NextResponse } from 'next/server';
import { COOKIE, roleOf, tokenFor } from './lib/auth';
import { pathAllowed } from './lib/roles';

// Every request: who is signed in (owner / admin / viewer), may that login open this page or API route?
// The role is passed to the API routes in the x-dash-role header (set here, so a browser cannot fake it).
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login')) return NextResponse.next();
  if (!(await tokenFor('owner'))) return new NextResponse('Dashboard password is not configured (DASHBOARD_PASSWORD).', { status: 503 });
  const role = await roleOf(req.cookies.get(COOKIE)?.value);
  if (!role) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'login required' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (!pathAllowed(role, req.method, pathname)) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ ok: false, error: 'Not available for this login.', message: 'Not available for this login.' }, { status: 403 });
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  const headers = new Headers(req.headers);
  headers.set('x-dash-role', role);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'] };
