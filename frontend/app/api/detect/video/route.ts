import { NextRequest, NextResponse } from 'next/server'
import { analyzeVideo, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })

  // Require authentication + deduct credit before inference
  let userId: string
  try {
    const guard = await creditGuard(req, 'video')
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
    if (file.size > 100 * 1024 * 1024) return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Video must be under 100MB' } }, { status: 400 })

    const ext    = file.name.split('.').pop()?.toLowerCase() || 'mp4'
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const result = await analyzeVideo(file.name, file.size, ext, buffer)
    const processingTime = Date.now() - start

    if (userId) {
      await supabase.from('scans').insert({
        user_id: userId, media_type: 'video', file_name: file.name, file_size: file.size,
        verdict: result.verdict, confidence_score: result.confidence, signals: result.signals,
        processing_time: processingTime, model_used: result.model_used, status: 'complete',
        metadata: { format: ext },
      })
    }
    return NextResponse.json({ success: true, data: { ...result, processing_time: processingTime, file_name: file.name } })
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } }, { status: 500 })
  }
}
