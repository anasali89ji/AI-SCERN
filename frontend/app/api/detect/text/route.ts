import { NextRequest, NextResponse } from 'next/server'
import { analyzeText, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  // Rate limit by IP (fast check before DB)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please wait and try again.' } },
      { status: 429 }
    )
  }

  // Internal server-to-server bypass (chat route calls this without a user session)
  const internalSecret = req.headers.get('X-Internal-Secret')
  const isInternal = internalSecret && internalSecret === process.env.INTERNAL_API_SECRET

  // BUG-009 fix: require authentication + deduct credit before inference
  let userId: string
  if (isInternal) {
    userId = 'internal'
  } else {
    try {
      const guard = await creditGuard(req, 'text')
      userId = guard.userId
    } catch (err) {
      if (err instanceof HTTPError) return httpErrorResponse(err)
      return NextResponse.json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication failed' } }, { status: 401 })
    }
  }

  const start = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const { text } = body

    if (!text || typeof text !== 'string')
      return NextResponse.json({ success: false, error: { code: 'NO_TEXT', message: 'No text provided' } }, { status: 400 })
    if (text.length < 50)
      return NextResponse.json({ success: false, error: { code: 'TOO_SHORT', message: 'Text must be at least 50 characters' } }, { status: 400 })
    if (text.length > 10000)
      return NextResponse.json({ success: false, error: { code: 'TOO_LONG', message: 'Text must be under 10,000 characters' } }, { status: 400 })

    const result = await analyzeText(text)
    const processingTime = Date.now() - start

    // Save scan to Supabase (skip for internal chat calls)
    if (userId !== 'internal') {
      await getSupabaseAdmin().from('scans').insert({
        user_id:          userId,
        media_type:       'text',
        content_preview:  text.substring(0, 500),
        verdict:          result.verdict,
        confidence_score: result.confidence,
        signals:          result.signals,
        processing_time:  processingTime,
        model_used:       result.model_used,
        model_version:    result.model_version,
        status:           'complete',
        metadata:         { char_count: text.length, word_count: text.split(/\s+/).length },
      })
    }

    return NextResponse.json({ success: true, data: { ...result, processing_time: processingTime } })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } },
      { status: 500 }
    )
  }
}
