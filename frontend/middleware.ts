import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
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

const _clerkHandler = clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname

  if (isProtectedRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('redirect_url', path)
      return NextResponse.redirect(loginUrl)
    }
  }
  return NextResponse.next()
})

export default async function middleware(req: NextRequest, event: any) {
  const pubKey    = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const secretKey = process.env.CLERK_SECRET_KEY

  if (!pubKey || !secretKey) {
    console.warn('[Middleware] Clerk keys missing — bypassing auth.')
    return NextResponse.next()
  }

  try {
    return await _clerkHandler(req, event)
  } catch (err) {
    console.error('[Middleware] Clerk error:', err)
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
