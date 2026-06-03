import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, createAdminSession, verifyAdminPassword, validateAdminConfig, getClientIp } from '@/lib/auth'

// Rate limiting via Upstash (optional — gracefully skipped if env vars missing)
async function checkRateLimit(ip: string): Promise<{ limited: boolean; retryAfter?: number }> {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { limited: false } // skip if not configured

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis }     = await import('@upstash/redis')
    const redis         = new Redis({ url, token })
    const ratelimit     = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix:  'admin_login',
    })
    const result = await ratelimit.limit(ip)
    if (!result.success) {
      return { limited: true, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) }
    }
  } catch (e) {
    console.warn('[auth] Rate limit check failed (non-fatal):', e)
  }
  return { limited: false }
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 1. Validate env config first
    const cfg = validateAdminConfig()
    if (!cfg.ok) {
      console.error('[auth] Admin config invalid:', cfg.errors)
      return NextResponse.json(
        { error: 'Admin panel misconfigured', missing: cfg.errors },
        { status: 503 }
      )
    }

    // 2. Rate limiting
    const ip = getClientIp(req)
    const rl = await checkRateLimit(ip)
    if (rl.limited) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfter ?? 900) },
        }
      )
    }

    // 3. Parse body
    const { password } = await req.json()
    if (!password) return NextResponse.json({ error: 'Missing password' }, { status: 400 })

    // 4. Verify password
    const valid = await verifyAdminPassword(password)
    if (!valid) {
      // Log failed attempt
      try {
        const { getAdminDb } = await import('@/lib/admin-middleware')
        await getAdminDb().from('admin_audit_log').insert({
          action: 'login_failed', admin_ip: ip, metadata: {},
        })
      } catch {}
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // 5. Create session
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const token     = await createAdminSession(ip, userAgent)

    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   60 * 60 * 2, // 2 hours
      path:     '/',
    })
    return res
  } catch (e) {
    console.error('[auth] POST error:', e)
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_session')?.value
  const { verifyAdminSession } = await import('@/lib/auth')
  const valid = await verifyAdminSession(token)
  if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
