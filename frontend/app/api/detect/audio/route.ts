import { NextRequest, NextResponse } from 'next/server'
import { analyzeAudio, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })

  // Require authentication + deduct credit before inference
  let userId: string
  try {
    const guard = await creditGuard(req, 'audio')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication failed' } }, { status: 401 })
  }


  const start = Date.now()
  try {
    const form   = await req.formData()
    const file   = form.get('file') as File | null

    if (!file) return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Audio must be under 25MB' } }, { status: 400 })

    const ext    = file.name.split('.').pop()?.toLowerCase() || 'mp3'
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const result = await analyzeAudio(file.name, file.size, ext, buffer)
    const processingTime = Date.now() - start

    if (userId) {
      await getSupabaseAdmin().from('scans').insert({
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
