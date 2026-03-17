import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Everything is public — open source, no auth walls
// Only admin API routes are protected server-side
export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname
  // Only block admin API routes from unauthenticated requests
  if (path.startsWith('/api/admin')) {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
