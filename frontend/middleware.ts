import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/pricing',
  '/blog(.*)',
  '/login(.*)',
  '/about',
  '/contact',
  '/solutions(.*)',
  '/compare',
  '/api/health',
]);

const isAuthRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/login(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Redirect authenticated users away from auth pages
  if (isAuthRoute(req) && userId) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Protect all non-public routes
  if (!isPublicRoute(req)) {
    if (!userId) {
      const url = new URL('/sign-in', req.url);
      url.searchParams.set('redirect_url', req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }

  // Add auth status header to API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    res.headers.set('x-clerk-auth-status', userId ? 'authenticated' : 'unauthenticated');
    return res;
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|.*\..*|favicon.ico).*)'],
};
