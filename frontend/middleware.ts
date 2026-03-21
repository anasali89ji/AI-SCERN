import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes that require authentication
const isProtected = createRouteMatcher([
  '/dashboard(.*)',
  '/batch(.*)',
  '/history(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/chat(.*)',
  '/scraper(.*)',
  '/pipeline(.*)',
  '/api/admin(.*)',
])

// Auth pages — never protect, never redirect away from
const isAuthPage = createRouteMatcher(['/login(.*)', '/signup(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Never interfere with auth pages — let Clerk components handle them
  if (isAuthPage(req)) return NextResponse.next()

  // Protect dashboard routes
  if (isProtected(req)) {
    const { userId } = await auth()
    if (!userId) {
      const url = new URL('/login', req.url)
      url.searchParams.set('redirect_url', req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files (images, fonts, etc)
     */
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)',
    '/',
  ],
}
