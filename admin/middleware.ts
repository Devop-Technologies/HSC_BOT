import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

const PUBLIC_API_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
]);

function isPublicApi(pathname: string) {
  return PUBLIC_API_ROUTES.has(pathname) || pathname.startsWith('/api/rate/');
}

function isAdminRole(role: unknown) {
  return typeof role === 'string' && ['admin', 'super_admin', 'superadmin'].includes(role.toLowerCase());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage  = pathname === '/' || pathname === '/login';
  const isApiRoute  = pathname.startsWith('/api');
  const isStatic    = pathname.startsWith('/_next');
  const isPublic    = pathname.startsWith('/rate') || pathname === '/manifest.json' || pathname.startsWith('/icons/');
  const isProtected = !isAuthPage && !isApiRoute && !isStatic && !isPublic;

  const token = request.cookies.get('admin_token')?.value;
  const payload = token ? await verifyToken(token) : null;
  const isLoggedIn = !!payload;

  if (isApiRoute && !isPublicApi(pathname)) {
    if (request.method === 'OPTIONS') {
      return NextResponse.next();
    }

    if (!isLoggedIn) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isAdminRole(payload.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.next();
  }

  if (!isLoggedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
