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

// Edge-compatible nonce generator (Web Crypto API — no Node.js crypto)
function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
}

export default clerkMiddleware(async (auth, req) => {
  // ── Auth guard ────────────────────────────────────────────────────────────
  if (isProtected(req)) {
    const { userId } = await auth()
    if (!userId) {
      const url = new URL('/login', req.url)
      url.searchParams.set('redirect_url', req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  // ── CSP nonce ─────────────────────────────────────────────────────────────
  const nonce = generateNonce()

  const csp = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com https://accounts.google.com https://*.clerk.accounts.dev https://*.clerk.com https://js.clerk.dev https://cdn.jsdelivr.net https://clerk.aiscern.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.aiscern.com https://accounts.aiscern.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: img.clerk.com *.supabase.co images.unsplash.com *.clerk.accounts.dev *.aiscern.com *.r2.cloudflarestorage.com *.r2.dev",
    "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com https://api-inference.huggingface.co https://integrate.api.nvidia.com https://api.cloudflare.com https://*.r2.cloudflarestorage.com https://*.r2.dev https://*.clerk.com https://*.clerk.accounts.dev https://api.clerk.com https://clerk.aiscern.com https://aiscern.com https://inn.gs https://*.inngest.com wss://*.clerk.accounts.dev wss://*.clerk.com wss://clerk.aiscern.com https://challenges.cloudflare.com",
    "frame-src https://accounts.google.com https://*.google.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.aiscern.com https://accounts.aiscern.com https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
  ].join('; ')

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('x-nonce', nonce)
  return response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)',
  ],
}
