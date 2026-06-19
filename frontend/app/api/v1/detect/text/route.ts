import { NextRequest, NextResponse } from 'next/server'
import { analyzeText }               from '@/lib/inference/hf-analyze'
import { checkRateLimitRedis }       from '@/lib/cache/redis'
import {
  extractApiKey, resolveApiKey, recordApiUsage,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'

export const dynamic = 'force-dynamic'

// ── handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = extractApiKey(req)
  if (!apiKey) return missingKeyResponse()

  const resolved = await resolveApiKey(apiKey)
  if (!resolved.valid) return invalidOrExhaustedKeyResponse(apiKey)

  // Per-IP secondary rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const allowed = await checkRateLimitRedis(`api:${ip}`, 60, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 requests/minute per IP.' },
      { status: 429 },
    )
  }

  // Parse & validate body
  const body = await req.json().catch(() => ({}))
  const { text } = body as { text?: unknown }

  if (!text || typeof text !== 'string')
    return NextResponse.json({ error: 'Body must be JSON with a "text" string field.' }, { status: 400 })
  if (text.length < 50)
    return NextResponse.json({ error: 'text must be at least 50 characters.' }, { status: 400 })
  if (text.length > 10_000)
    return NextResponse.json({ error: 'text must be under 10,000 characters.' }, { status: 400 })

  try {
    const start  = Date.now()
    const result = await analyzeText(text)

    recordApiUsage(resolved)

    return NextResponse.json({
      verdict:         result.verdict,
      confidence:      result.confidence,
      signals:         result.signals.slice(0, 5),
      summary:         result.summary,
      processing_time: Date.now() - start,
      model:           result.model_used,
      api_version:     'v1',
    }, {
      headers: {
        'Deprecation': 'true',
        'Link': '</api/v1/verify/content>; rel="successor-version"',
      },
    })
  } catch (err: unknown) {
    console.error('[v1/detect/text]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
