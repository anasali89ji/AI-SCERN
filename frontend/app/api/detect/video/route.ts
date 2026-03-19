import { NextRequest, NextResponse } from 'next/server'
import { analyzeVideoWithFrames, analyzeVideo, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })
  }

  let userId: string
  try {
    const guard = await creditGuard(req, 'video')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Request failed' } }, { status: 500 })
  }

  const start = Date.now()
  try {
    const contentType = req.headers.get('content-type') ?? ''

    // ── JSON path: frames sent from browser canvas extraction ────────────
    if (contentType.includes('application/json')) {
      const body = await req.json() as {
        frames:   { base64: string; index: number; timeSec: number }[]
        fileName: string
        fileSize: number
        format:   string
      }

      if (!body.frames?.length)
        return NextResponse.json({ success: false, error: { code: 'NO_FRAMES', message: 'No frames provided' } }, { status: 400 })
      if (body.frames.length > 10)
        return NextResponse.json({ success: false, error: { code: 'TOO_MANY_FRAMES', message: 'Max 10 frames per request' } }, { status: 400 })

      const result = await analyzeVideoWithFrames(body.fileName, body.fileSize, body.format, body.frames)
      const processingTime = Date.now() - start

      let scanId: string | null = null
      if (userId && !userId.startsWith('anon_')) {
        try {
          const { data: sr } = await getSupabaseAdmin().from('scans').insert({
            user_id:          userId,
            media_type:       'video',
            file_name:        body.fileName,
            file_size:        body.fileSize,
            verdict:          result.verdict,
            confidence_score: result.confidence,
            signals:          result.signals,
            processing_time:  processingTime,
            model_used:       result.model_used,
            status:           'complete',
            metadata:         { format: body.format, frame_count: body.frames.length, engine: 'nvidia-nim' },
          }).select('id').single()
          scanId = sr?.id ?? null
        } catch { /* non-fatal */ }
      }

      return NextResponse.json({
        success: true,
        scan_id: scanId,
        result:  { ...result, processing_time: processingTime, file_name: body.fileName },
      })
    }

    // ── FormData path: legacy direct upload ──────────────────────────────
    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file)
      return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    if (file.size > 100 * 1024 * 1024)
      return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Video must be under 100MB' } }, { status: 400 })

    const ext    = file.name.split('.').pop()?.toLowerCase() || 'mp4'
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const result = await analyzeVideo(file.name, file.size, ext, buffer)
    const processingTime = Date.now() - start

    let scanId: string | null = null
    if (userId && !userId.startsWith('anon_')) {
      try {
        const { data: sr } = await getSupabaseAdmin().from('scans').insert({
          user_id:          userId,
          media_type:       'video',
          file_name:        file.name,
          file_size:        file.size,
          verdict:          result.verdict,
          confidence_score: result.confidence,
          signals:          result.signals,
          processing_time:  processingTime,
          model_used:       result.model_used,
          status:           'complete',
          metadata:         { format: ext },
        }).select('id').single()
        scanId = sr?.id ?? null
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      scan_id: scanId,
      result:  { ...result, processing_time: processingTime, file_name: file.name },
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' },
    }, { status: 500 })
  }
}
