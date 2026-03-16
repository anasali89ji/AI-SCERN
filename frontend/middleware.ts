import { authMiddleware } from '@clerk/nextjs/server'

export default authMiddleware({
  publicRoutes: [
    '/',
    '/login(.*)',
    '/signup(.*)',
    '/pricing(.*)',
    '/about(.*)',
    '/contact(.*)',
    '/privacy(.*)',
    '/terms(.*)',
    '/docs(.*)',
    '/api/auth(.*)',
    '/api/webhook(.*)',
    '/api/billing/webhook(.*)',
  ],
  afterAuth(auth, req) {
    // Redirect signed-in users away from auth pages
    if (auth.userId && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup')) {
      return Response.redirect(new URL('/dashboard', req.url))
    }
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
