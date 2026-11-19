/**
 * /api/image-proxy — stream a third-party image through our own origin.
 *
 * FIX: the scanner gallery rendered <img src={originalUrl}> directly.
 * Many sites (Cloudflare, WP hosts, CDNs) reject hotlinked image requests
 * that don't come from their own domain, so the same image that the
 * server-side forensics engine successfully fetched (with proper Referer
 * headers) would still fail to render in the browser and get silently
 * hidden by onError — looking like "sometimes the images show, sometimes
 * they don't". Proxying through our server, which sends the right
 * Referer/UA, fixes that inconsistency.
 */
import { NextRequest, NextResponse } from 'next/server'
import { assertSafeUrlResolved, safeFetch } from '@/lib/utils/ssrf-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // IMGPROXY-RL-1 (audit 2026-11): this route is unauthenticated (scanner
  // result galleries can render while a session is expiring) and forwards
  // to third-party origins — without a limiter it could be used as an open
  // bandwidth relay. 30 req/min/IP matches the heaviest gallery usage.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  try {
    const { checkRateLimit, rateLimitResponse } = await import('@/lib/ratelimit')
    const rl = await checkRateLimit('image-proxy', ip)
    if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })
  } catch { /* limiter unavailable — proceed: SSRF + content-type guards remain */ }

  const target = req.nextUrl.searchParams.get('url')
  if (!target) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  try {
    // SCANNER-SEC-1: resolved variant + safeFetch below — this route also
    // streamed redirects blindly before.
    await assertSafeUrlResolved(target)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Blocked URL' }, { status: 400 })
  }

  let origin = ''
  try { origin = new URL(target).origin } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const upstream = await safeFetch(target, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept':          'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer':         `${origin}/`,
      },
      signal: AbortSignal.timeout(12000),
    })

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Upstream returned ${upstream.status}` }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image' }, { status: 415 })
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type':  contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Fetch failed' }, { status: 502 })
  }
}
