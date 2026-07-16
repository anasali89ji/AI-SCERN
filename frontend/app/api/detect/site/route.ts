// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Full Website Scanner
// POST /api/detect/site
//
// Crawls an entire site (sitemap-first, same-domain link-crawl fallback),
// detects WordPress, and runs the SAME text + image detection engines used
// by the single-page /api/detect/web and /api/detect/image routes across
// every page found — no paid vision LLM required (see site-scanner.ts header).
//
// Request:  POST {
//   url: string
//   maxPages?: number          (default 25, hard cap 60)
//   includeImages?: boolean    (default true)
//   maxImagesTotal?: number    (default 15, hard cap 40)
// }
// Response: SiteScanResult (see lib/site-crawler/site-scanner.ts)
// ════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse }         from 'next/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { fireScanCompleted }                 from '@/lib/inngest/send-scan-event'
import { getSupabaseAdmin }                  from '@/lib/supabase/admin'
import { scanSite }                          from '@/lib/site-crawler/site-scanner'

export const dynamic     = 'force-dynamic'
export const maxDuration = 300 // full-site crawls take longer than a single-page scan

const HARD_MAX_PAGES  = 60
const HARD_MAX_IMAGES = 40

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('scraper', ip) // reuse scraper bucket (5/min) — full-site scans are heavier, so this also protects the crawler from abuse
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  let userId: string
  try {
    const guard = await creditGuard(req, 'site') // costs more credits than a single-page scan
    userId      = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Auth failed' } }, { status: 500 })
  }

  let body: { url?: unknown; maxPages?: unknown; includeImages?: unknown; maxImagesTotal?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON' } }, { status: 400 }) }

  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) return NextResponse.json({ success: false, error: { code: 'NO_URL', message: '"url" field required' } }, { status: 400 })

  let parsedUrl: URL
  try { parsedUrl = new URL(url) } catch { return NextResponse.json({ success: false, error: { code: 'INVALID_URL', message: 'Invalid URL' } }, { status: 400 }) }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return NextResponse.json({ success: false, error: { code: 'INVALID_PROTOCOL', message: 'Only http/https URLs allowed' } }, { status: 400 })

  const maxPages       = typeof body.maxPages === 'number' ? Math.min(Math.max(1, body.maxPages), HARD_MAX_PAGES) : 25
  const includeImages  = body.includeImages !== false
  const maxImagesTotal = typeof body.maxImagesTotal === 'number' ? Math.min(Math.max(0, body.maxImagesTotal), HARD_MAX_IMAGES) : 15

  try {
    const result = await scanSite(url, { maxPages, includeImages, maxImagesTotal })

    let scanId: string | null = null
    if (userId && !userId.startsWith('anon_')) {
      try {
        const { data: sr } = await getSupabaseAdmin().from('scans').insert({
          user_id:          userId,
          media_type:       'text',
          file_name:        result.origin,
          verdict:          result.aiContentPercent > 65 ? 'AI' : result.aiContentPercent < 35 ? 'HUMAN' : 'UNCERTAIN',
          confidence_score: result.aiContentPercent / 100,
          signals:          { pages: result.pagesScanned, images: result.totalImagesScanned },
          processing_time:  result.processingTimeMs,
          model_used:       'SiteScanner-v1',
          status:           'complete',
          metadata: {
            url,
            origin:             result.origin,
            is_wordpress:       result.isWordPress,
            discovery_method:   result.discoveryMethod,
            ai_content_percent: result.aiContentPercent,
            ai_image_percent:   result.aiImagePercent,
            content_originality_score: result.contentOriginalityScore,
            voice_diversity_index:     result.voiceDiversityIndex,
            transparency_score:        result.transparencyScore,
            link_trust_score:          result.linkTrustScore,
            integrity_hash:            result.integritySeal.hash,
          },
        }).select('id').single()
        scanId = sr?.id ?? null
      } catch { /* non-fatal */ }
    }

    if (scanId) fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'text', verdict: result.aiContentPercent > 65 ? 'AI' : 'UNCERTAIN', confidence: result.aiContentPercent / 100, model_used: 'SiteScanner-v1' })

    return NextResponse.json({ success: true, scan_id: scanId, ...result })
  } catch (err) {
    console.error('[detect/site]', err)
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Site scan failed' } },
      { status: 500 }
    )
  }
}
