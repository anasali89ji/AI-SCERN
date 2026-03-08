import { NextRequest, NextResponse } from 'next/server'
import { analyzeAudio, checkRateLimit } from '@/lib/inference/hf-analyze'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co', (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? 'placeholder-anon-key')

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })

  const start = Date.now()
  try {
    const form   = await req.formData()
    const file   = form.get('file') as File | null
    const userId = form.get('user_id') as string | null

    if (!file) return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Audio must be under 25MB' } }, { status: 400 })

    const ext    = file.name.split('.').pop()?.toLowerCase() || 'mp3'
    const result = await analyzeAudio(file.name, file.size, ext)
    const processingTime = Date.now() - start

    if (userId) {
      await supabase.from('scans').insert({
        user_id: userId, media_type: 'audio', file_name: file.name, file_size: file.size,
        verdict: result.verdict, confidence_score: result.confidence, signals: result.signals,
        processing_time: processingTime, model_used: result.model_used, status: 'complete',
        metadata: { format: ext, estimated_duration_sec: Math.round(file.size / (128 * 1024 / 8)) },
      })
    }
    return NextResponse.json({ success: true, data: { ...result, processing_time: processingTime, file_name: file.name } })
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } }, { status: 500 })
  }
}
