import { NextRequest, NextResponse } from 'next/server'
import { analyzeText, checkRateLimit } from '@/lib/inference/hf-analyze'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey) {
      return NextResponse.json({ error: 'X-API-Key header required', docs: '/docs/api' }, { status: 401 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    if (!checkRateLimit(ip, 60)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Max 60 requests/minute.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const { text } = body

    if (!text || typeof text !== 'string' || text.length < 50)
      return NextResponse.json({ error: 'text must be at least 50 characters' }, { status: 400 })
    if (text.length > 10000)
      return NextResponse.json({ error: 'text must be under 10,000 characters' }, { status: 400 })

    const start  = Date.now()
    const result = await analyzeText(text)

    return NextResponse.json({
      verdict:         result.verdict,
      confidence:      result.confidence,
      signals:         result.signals,
      summary:         result.summary,
      processing_time: Date.now() - start,
      model:           result.model_used,
    })
  } catch (err: any) {
    console.error('[v1/detect/text]', err?.message)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
