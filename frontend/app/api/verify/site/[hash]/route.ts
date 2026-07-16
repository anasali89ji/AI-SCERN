// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Content Integrity Seal Verification
// GET /api/verify/site/[hash]
// Public, unauthenticated, read-only lookup so a "Verified Content" badge
// embedded on a third-party site can be checked by anyone (like a TLS
// certificate transparency check). No credit guard / rate-limit needed for
// reads this cheap, but a light limiter is applied to deter scraping abuse.
// ════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { lookupIntegritySeal } from '@/lib/site-crawler/integrity-seal'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('anon_scan', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_HASH', message: 'Expected a 64-char SHA-256 hex hash' } }, { status: 400 })
  }

  const seal = await lookupIntegritySeal(hash)
  if (!seal) {
    return NextResponse.json({ success: false, verified: false, error: { code: 'NOT_FOUND', message: 'No scan report found for this seal — either it was never issued here, or it predates the site_scan_seals migration.' } }, { status: 404 })
  }

  return NextResponse.json({
    success:  true,
    verified: true,
    hash,
    origin:   seal.origin,
    issuedAt: seal.issued_at,
    report:   seal.report_summary,
  })
}
