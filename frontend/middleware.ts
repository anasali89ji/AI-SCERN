import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtected = createRouteMatcher([
  '/dashboard(.*)',
  '/detect(.*)',
  '/scraper(.*)',
  '/batch(.*)',
  '/history(.*)',
  '/profile(.*)',
  '/settings(.*)',
  '/pipeline(.*)',
  '/chat(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (isProtected(req)) {
    // In Clerk 5: auth is a function, call auth() to get the auth object
    auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
