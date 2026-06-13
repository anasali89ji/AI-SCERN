import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse }            from 'next/server'

// ── Route matchers ────────────────────────────────────────────────────────────
const isProtected = createRouteMatcher([
  '/dashboard(.*)', '/detect(.*)', '/batch(.*)', '/history(.*)',
  '/profile(.*)',   '/settings(.*)', '/chat(.*)',  '/scraper(.*)',
  '/pipeline(.*)',  '/forensic(.*)',
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)', '/api/admin(.*)',
])

// ── CORS — restrict to known trusted origins ──────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://aiscern.com',
  'https://www.aiscern.com',
  'https://clerk.aiscern.com',
  'https://accounts.aiscern.com',
  'https://admin.aiscern.com',
])

function applyCors(req: NextRequest, res: NextResponse): NextResponse {
  const origin = req.headers.get('origin') ?? ''

  // Same-origin requests have no Origin header — allow freely
  if (!origin) return res

  if (ALLOWED_ORIGINS.has(origin)) {
    res.headers.set('Access-Control-Allow-Origin',  origin)
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Secret')
    res.headers.set('Vary', 'Origin')
  } else {
    // Unknown origin — block CORS (do NOT send wildcard *)
    res.headers.delete('Access-Control-Allow-Origin')
  }

  return res
}

// ── Handle OPTIONS preflight ──────────────────────────────────────────────────
function handlePreflight(req: NextRequest): NextResponse | null {
  if (req.method !== 'OPTIONS') return null
  const origin = req.headers.get('origin') ?? ''
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Internal-Secret',
      'Access-Control-Max-Age':       '86400',
      'Vary': 'Origin',
    },
  })
}

// ── Admin role helpers ────────────────────────────────────────────────────────
const ADMIN_ROLES = new Set([
  'ADMIN', 'OWNER', 'EXECUTIVE', 'MANAGER',
  'ANALYST', 'MARKETING', 'SUPPORT',
])

const ALLOWED_ADMIN_IDS = (process.env.ALLOWED_ADMIN_IDS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean)

function isAdminUser(userId: string, metadata: Record<string, unknown>): boolean {
  if (ALLOWED_ADMIN_IDS.includes(userId)) return true
  const role = (metadata?.role as string | undefined)?.toUpperCase() ?? ''
  return ADMIN_ROLES.has(role)
}

// ── Main middleware ───────────────────────────────────────────────────────────
export default clerkMiddleware(async (auth, req: NextRequest) => {
  // OPTIONS preflight — handle before auth
  const preflight = handlePreflight(req)
  if (preflight) return applyCors(req, preflight)

  // Admin route guard — requires auth + admin role (server-side, not client-side)
  if (isAdminRoute(req)) {
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      const url = new URL('/login', req.url)
      url.searchParams.set('redirect_url', req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
    const metadata = (sessionClaims?.publicMetadata as Record<string, unknown>) ?? {}
    if (!isAdminUser(userId, metadata)) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
    return applyCors(req, NextResponse.next())
  }

  // Standard auth guard
  if (isProtected(req)) {
    const { userId } = await auth()
    if (!userId) {
      const url = new URL('/login', req.url)
      url.searchParams.set('redirect_url', req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  return applyCors(req, NextResponse.next())
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)',
  ],
}
