import { NextRequest, NextResponse } from 'next/server'
import { analyzeImage, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'


export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })
  }

  // Require authentication + deduct credit before inference
  let userId: string
  try {
    const guard = await creditGuard(req, 'image')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication failed' } }, { status: 401 })
  }

  const start = Date.now()
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file)
      return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    if (!file.type.startsWith('image/'))
      return NextResponse.json({ success: false, error: { code: 'INVALID_TYPE', message: 'File must be an image' } }, { status: 400 })
    if (file.size > 10 * 1024 * 1024)
      return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Image must be under 10MB' } }, { status: 400 })

    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const result = await analyzeImage(buffer, file.type, file.name)
    const processingTime = Date.now() - start

    if (userId) {
      await getSupabaseAdmin().from('scans').insert({
        user_id:          userId,
        media_type:       'image',
        file_name:        file.name,
        file_size:        file.size,
        verdict:          result.verdict,
        confidence_score: result.confidence,
        signals:          result.signals,
        processing_time:  processingTime,
        model_used:       result.model_used,
        model_version:    result.model_version,
        status:           'complete',
        metadata:         { format: file.type, size_kb: Math.round(file.size / 1024) },
      })
    }

    return NextResponse.json({ success: true, data: { ...result, processing_time: processingTime, file_name: file.name, file_size: file.size } })
  } catch (err) {
    return NextResponse.json({ success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } }, { status: 500 })
  }
}
