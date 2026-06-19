import { NextRequest, NextResponse } from 'next/server'
import { analyzeImage }              from '@/lib/inference/hf-analyze'
import { checkRateLimitRedis }       from '@/lib/cache/redis'
import {
  extractApiKey, resolveApiKey, recordApiUsage,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

// ── handler ───────────────────────────────────────────────────────────────────
// POST /api/v1/detect/image
// Body: multipart/form-data with a "file" field (image/*, max 10MB)
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

  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Body must be multipart/form-data with a "file" field containing the image.' },
      { status: 400 },
    )
  }

  let file: File | null
  try {
    const form = await req.formData()
    file = form.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: '"file" field required (multipart/form-data).' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 10MB.' }, { status: 400 })

  try {
    const start  = Date.now()
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await analyzeImage(buffer, file.type, file.name)

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
        'Link': '</api/v1/verify/image>; rel="successor-version"',
      },
    })
  } catch (err: unknown) {
    console.error('[v1/detect/image]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
