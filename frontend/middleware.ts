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
    if (!url || !key) return null

    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data } = await db
      .from('site_settings')
      .select('key, value')
      .in('key', ['maintenance_enabled', 'maintenance_message', 'maintenance_duration', 'maintenance_allowed_ips'])

    if (!data) return null

    const settings: Record<string, string> = {}
    for (const row of data) {
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
  } catch {
    return null
  }
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  if (!isExempt(pathname)) {
    const maintenance = await checkMaintenanceMode(req)
    if (maintenance?.enabled) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'unknown'

      const isAllowed = maintenance.allowed_ips.length === 0
        || maintenance.allowed_ips.includes(clientIp)
        || clientIp === '127.0.0.1'
        || clientIp === '::1'

      if (!isAllowed) {
        const url = new URL('/maintenance', req.url)
        if (maintenance.message) url.searchParams.set('msg', encodeURIComponent(maintenance.message))
        if (maintenance.duration) url.searchParams.set('dur', encodeURIComponent(maintenance.duration))
        return NextResponse.redirect(url)
      }
    }
  }

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
    '/((?!_next/static|_next/image|favicon|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|map)).*)',
  ],
}
