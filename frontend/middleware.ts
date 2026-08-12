import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

const MAINTENANCE_EXEMPT = [
  '/maintenance',
  '/api/maintenance',
  '/api/auth',
  '/login',
  '/signup',
  '/_next',
  '/favicon',
  '/api/webhook',
  // Without these, enabling maintenance mode locks the admin out of the
  // one panel that can turn it back off again -- the only way back in
  // would be being on an allowed IP or localhost. Admin auth is already
  // enforced separately below (isProtected), so exempting these from the
  // maintenance gate doesn't open anything up.
  '/admin',
  '/api/admin',
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

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

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
        const res = NextResponse.redirect(url)
        // Without this, the redirect response itself (and the RSC payload
        // Next.js fetches for client-side <Link> navigation) was cacheable
        // by the client Router Cache. A hard reload always hit middleware
        // and correctly bounced to /maintenance, but a prefetched or
        // already-visited dashboard route could still be served straight
        // from the client cache on soft navigation, skipping middleware
        // entirely — "site still reloads [to maintenance] and shows
        // separate maintenance page" but other pages stayed reachable.
        // Forcing no-store on every gated response stops that route from
        // ever being cached client-side while maintenance mode is on.
        res.headers.set('Cache-Control', 'no-store, must-revalidate')
        return res
      }
    }
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

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)',
  ],
}
