import { NextRequest, NextResponse } from 'next/server'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/batch',
  '/history', 
  '/profile',
  '/settings',
  '/api/admin',
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Lazily-built Clerk handler — only created once keys are confirmed present
let _clerkHandler: ((req: NextRequest, evt: any) => Promise<NextResponse>) | null = null

async function getClerkHandler() {
  if (_clerkHandler) return _clerkHandler
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server')
  const isProtected = createRouteMatcher(PROTECTED_PREFIXES.map(p => `${p}(.*)`))
  _clerkHandler = clerkMiddleware(async (auth, req) => {
    if (isProtected(req)) {
      const { userId } = await auth()
      if (!userId) {
        const url = new URL('/login', req.url)
        url.searchParams.set('redirect_url', req.nextUrl.pathname)
        return NextResponse.redirect(url)
      }
    }
  }) as any
  return _clerkHandler!
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const pubKey    = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const secretKey = process.env.CLERK_SECRET_KEY
  const hasKeys   = !!(pubKey && pubKey.startsWith('pk_') && secretKey && secretKey.startsWith('sk_'))

  if (!hasKeys) {
    // Keys not set — redirect protected routes to login, let everything else through
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  // Keys are valid — use Clerk
  try {
    const handler = await getClerkHandler()
    const result  = await handler(req, {})
    return result ?? NextResponse.next()
  } catch (err) {
    console.error('[Middleware] Clerk error:', (err as any)?.message)
    // On Clerk error: protect sensitive routes, pass through the rest
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)',
  ],
}
