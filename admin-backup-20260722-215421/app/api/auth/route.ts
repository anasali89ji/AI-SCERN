import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME, createAdminSession, verifyAdminPassword, validateAdminConfig, getClientIp } from '@/lib/auth'

async function checkRateLimit(ip: string): Promise<{ limited: boolean; retryAfter?: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { limited: false }

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis } = await import('@upstash/redis')
    const redis = new Redis({ url, token })
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'admin_login',
    })
    const result = await ratelimit.limit(ip)
    if (!result.success) {
      return { limited: true, retryAfter: Math.ceil((result.reset - Date.now()) / 1000) }
    }
  } catch (e) {
    console.warn('[auth] Rate limit check failed:', e)
  }
  return { limited: false }
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const cfg = validateAdminConfig()
    if (!cfg.ok) {
      console.error('[auth] Admin config invalid:', cfg.errors)
      return NextResponse.json(
        { error: 'Admin panel misconfigured', missing: cfg.errors },
        { status: 503 }
      )
    }

    const ip = getClientIp(req)
    const rl = await checkRateLimit(ip)
    if (rl.limited) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 900) } }
      )
    }

    const { password, email } = await req.json()
    if (!password) return NextResponse.json({ error: 'Missing password' }, { status: 400 })

    const result = await verifyAdminPassword(password)
    if (!result.valid) {
      try {
        const { getAdminDb } = await import('@/lib/admin-middleware')
        await getAdminDb().from('admin_audit_log').insert({
          action: 'login_failed',
          admin_ip: ip,
          metadata: { email: email || null },
        })
      } catch {}
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const userAgent = req.headers.get('user-agent') || 'unknown'
    const token = await createAdminSession(ip, userAgent, result.adminId, result.email)

    const res = NextResponse.json({
      ok: true,
      admin: {
        id: result.adminId,
        email: result.email,
        role: result.role,
      },
    })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 2,
      path: '/',
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
  const token = req.cookies.get(COOKIE_NAME)?.value
  const { verifyAdminSession } = await import('@/lib/auth')
  const valid = await verifyAdminSession(token)
  if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
