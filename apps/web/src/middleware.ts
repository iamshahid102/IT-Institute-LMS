import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/admin', '/front-desk', '/student'];
const SESSION_COOKIE = 'lms_session';

/**
 * Presence-only guard for navigation UX. Cryptographic session validation and
 * every permission decision happen in the Express API.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/front-desk/:path*', '/student/:path*', '/login'],
};
