import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isProtected = createRouteMatcher([
  '/dashboard(.*)',
  '/detect(.*)',
  '/batch(.*)',
  '/history(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/chat(.*)',
  '/scraper(.*)',
  '/pipeline(.*)',
  '/api/admin(.*)',
])

// Routes that Clerk needs to finish OAuth flows — must never redirect
const isPublicClerkRoute = createRouteMatcher([
  '/sso-callback(.*)',
  '/login(.*)',
  '/signup(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // ── Skip Clerk's own OAuth callback routes ─────────────────────────────────
  if (isPublicClerkRoute(req)) return NextResponse.next()

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (isProtected(req)) {
    const { userId } = await auth()
    if (!userId) {
      const url = new URL('/login', req.url)
      url.searchParams.set('redirect_url', req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)',
  ],
}
