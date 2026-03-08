import { NextRequest, NextResponse } from 'next/server'
import { analyzeText, checkRateLimit } from '@/lib/inference/hf-analyze'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? 'placeholder-anon-key'
)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Try again in 10 minutes.' } }, { status: 429 })
  }

  const start = Date.now()
  try {
    const body = await req.json()
    const { text, user_id } = body

    if (!text || typeof text !== 'string')
      return NextResponse.json({ success: false, error: { code: 'NO_TEXT', message: 'No text provided' } }, { status: 400 })
    if (text.length < 50)
      return NextResponse.json({ success: false, error: { code: 'TOO_SHORT', message: 'Text must be at least 50 characters' } }, { status: 400 })
    if (text.length > 10000)
      return NextResponse.json({ success: false, error: { code: 'TOO_LONG', message: 'Text must be under 10,000 characters' } }, { status: 400 })

    const result = await analyzeText(text)
    const processingTime = Date.now() - start

    // Save to Supabase if user is logged in
    if (user_id) {
      await supabase.from('scans').insert({
        user_id,
        media_type:      'text',
        content_preview: text.substring(0, 500),
        verdict:         result.verdict,
        confidence_score: result.confidence,
        signals:         result.signals,
        processing_time: processingTime,
        model_used:      result.model_used,
        model_version:   result.model_version,
        status:          'complete',
        metadata:        { char_count: text.length, word_count: text.split(/\s+/).length },
      })
    }

    return NextResponse.json({ success: true, data: { ...result, processing_time: processingTime } })
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } }, { status: 500 })
  }
}
