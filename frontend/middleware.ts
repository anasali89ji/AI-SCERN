import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

const MAINTENANCE_EXEMPT = [
  '/maintenance',
  '/api/maintenance',
  '/api/auth',
  '/login',
  '/signup',
  '/_next',
  '/favicon',
  '/api/webhook',
]

function isExempt(pathname: string): boolean {
  return MAINTENANCE_EXEMPT.some(p => pathname.startsWith(p))
}

async function checkMaintenanceMode(req: Request): Promise<{
  enabled: boolean
  message: string
  duration: string
  allowed_ips: string[]
} | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      console.error('[MAINTENANCE] Missing Supabase credentials')
      return null
    }

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await db
      .from('site_settings')
      .select('key, value')
      .in('key', ['maintenance_enabled', 'maintenance_message', 'maintenance_duration', 'maintenance_allowed_ips'])

    if (error) {
      console.error('[MAINTENANCE] DB error:', error.message)
      return null
    }

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value
    }

    const allowed_ips: string[] = []
    try {
      allowed_ips.push(...JSON.parse(settings.maintenance_allowed_ips || '[]'))
    } catch { /* ignore */ }

    return {
      enabled: settings.maintenance_enabled === 'true',
      message: settings.maintenance_message || 'We are currently performing scheduled maintenance. Please check back soon.',
      duration: settings.maintenance_duration || '',
      allowed_ips,
    }
  } catch (err) {
    console.error('[MAINTENANCE] Unexpected error:', err)
    return null
  }
}

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl

  // OPTIONS preflight — handle before auth
  const preflight = handlePreflight(req)
  if (preflight) return applyCors(req, preflight)

  // ── Maintenance Mode Check ────────────────────────────────────────────────
  if (!isExempt(pathname)) {
    const maintenance = await checkMaintenanceMode(req)
    
    if (maintenance?.enabled) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'unknown'

      // FIXED: Only allow IPs explicitly in the list + localhost
      // Empty list = NO ONE gets through (except localhost)
      const isAllowed = maintenance.allowed_ips.includes(clientIp)
        || clientIp === '127.0.0.1'
        || clientIp === '::1'

      console.log(`[MAINTENANCE] IP: ${clientIp}, Allowed: ${isAllowed}, List: ${JSON.stringify(maintenance.allowed_ips)}`)

      if (!isAllowed) {
        const url = new URL('/maintenance', req.url)
        if (maintenance.message) url.searchParams.set('msg', encodeURIComponent(maintenance.message))
        if (maintenance.duration) url.searchParams.set('dur', encodeURIComponent(maintenance.duration))
        return NextResponse.redirect(url)
      }
    }
  }

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

  // ── Auth guard ────────────────────────────────────────────────────────────
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
