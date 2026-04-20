/**
 * POST /api/detect/video
 *
 * Accepts EITHER:
 *   a) JSON: { frames, fileName, fileSize, format } — browser-extracted frames (preferred)
 *   b) JSON: { r2Key, fileName, fileSize, format } — file in R2, metadata analysis only
 *   c) FormData: file field — legacy / dev mode
 *
 * Detection: NVIDIA NIM per-frame (primary) → temporal analysis.
 * Video files are NOT stored in Supabase. R2 handles storage.
 * Vercel never buffers large video into memory when r2Key path is used.
 */

import { checkRateLimitRedis } from '@/lib/cache/redis'
import { NextRequest, NextResponse } from 'next/server'
import { analyzeVideoWithFrames, analyzeVideo } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { fireScanCompleted }             from '@/lib/inngest/send-scan-event'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic    = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (!await checkRateLimitRedis(ip, 10, 60)) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please wait.' } },
      { status: 429 }
    )
  }

  let userId: string
  try {
    const guard = await creditGuard(req, 'video')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Request failed' } }, { status: 500 })
  }

  const start       = Date.now()
  const contentType = req.headers.get('content-type') ?? ''

  try {
    // ── JSON path: frames from browser canvas OR r2Key for metadata-only ─────
    if (contentType.includes('application/json')) {
      const body = await req.json() as {
        frames?:  { base64: string; index: number; timeSec: number }[]
        r2Key?:   string
        fileName: string
        fileSize: number
        format:   string
      }

      const { frames, r2Key, fileName, fileSize, format } = body

      // Validate
      if (!fileName) return NextResponse.json({ success: false, error: { code: 'NO_FILENAME', message: 'fileName required' } }, { status: 400 })
      if (!fileSize) return NextResponse.json({ success: false, error: { code: 'NO_FILESIZE', message: 'fileSize required' } }, { status: 400 })

      // Frame path — NVIDIA NIM analysis
      if (frames?.length) {
        if (frames.length > 12)
          return NextResponse.json({ success: false, error: { code: 'TOO_MANY_FRAMES', message: 'Max 12 frames per request' } }, { status: 400 })

        const result         = await analyzeVideoWithFrames(fileName, fileSize, format || 'mp4', frames)
        const processingTime = Date.now() - start

        let scanId: string | null = null
        if (userId && !userId.startsWith('anon_')) {
          try {
            const { data: sr } = await getSupabaseAdmin().from('scans').insert({
              user_id:          userId,
              media_type:       'video',
              file_name:        fileName,
              file_size:        fileSize,
              r2_key:           r2Key ?? null,
              verdict:          result.verdict,
              confidence_score: result.confidence,
              signals:          result.signals,
              processing_time:  processingTime,
              model_used:       result.model_used,
              model_version:    result.model_version,
              status:           'complete',
              metadata:         { format: format || 'mp4', frame_count: frames.length, engine: 'nvidia-nim', r2: !!r2Key },
            }).select('id').single()
            scanId = sr?.id ?? null
          } catch { /* non-fatal */ }
        }


        // Delete file from R2 after analysis — non-fatal if it fails
        if (r2Key) {
          try {
            const { deleteR2Object } = await import('@/lib/storage/r2')
            await deleteR2Object(r2Key)
          } catch { /* cleanup failure is non-fatal */ }
        }

        if (scanId) fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'video', verdict: result.verdict, confidence: result.confidence, model_used: result.model_used })
        return NextResponse.json({
          success: true,
          scan_id: scanId,
          result:  { ...result, processing_time: processingTime, file_name: fileName },
        })
      }

      // R2 key path — metadata-only analysis (no frame bytes on Vercel)
      if (r2Key) {
        const result         = await analyzeVideo(fileName, fileSize, format || 'mp4')

        // Return 422 when NVIDIA NIM unavailable and frame extraction required
        if (result.model_used.includes('FrameExtractionRequired')) {
          return NextResponse.json(
            { success: false, error: { code: 'FRAME_EXTRACTION_REQUIRED', message: result.summary } },
            { status: 422 }
          )
        }
        const processingTime = Date.now() - start

        let scanId: string | null = null
        if (userId && !userId.startsWith('anon_')) {
          try {
            const { data: sr } = await getSupabaseAdmin().from('scans').insert({
              user_id:          userId,
              media_type:       'video',
              file_name:        fileName,
              file_size:        fileSize,
              r2_key:           r2Key,
              verdict:          result.verdict,
              confidence_score: result.confidence,
              signals:          result.signals,
              processing_time:  processingTime,
              model_used:       result.model_used,
              status:           'complete',
              metadata:         { format: format || 'mp4', engine: 'metadata-heuristic', r2: true },
            }).select('id').single()
            scanId = sr?.id ?? null
          } catch { /* non-fatal */ }
        }

        if (scanId) fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'video', verdict: result.verdict, confidence: result.confidence, model_used: result.model_used })
        return NextResponse.json({
          success: true,
          scan_id: scanId,
          note:    'Upload frames via the video detection page for NVIDIA NIM deepfake analysis.',
          result:  { ...result, processing_time: processingTime, file_name: fileName },
        })
      }

      return NextResponse.json(
        { success: false, error: { code: 'NO_INPUT', message: 'Provide frames[] or r2Key' } },
        { status: 400 }
      )
    }

    // ── FormData path: legacy direct upload (small files / dev mode) ─────────
    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file)
      return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    if (file.size > 50 * 1024 * 1024)
      return NextResponse.json(
        { success: false, error: { code: 'TOO_LARGE', message: 'Direct video upload max 50MB. Use R2 presigned upload for larger files.' } },
        { status: 400 }
      )

    const ext    = file.name.split('.').pop()?.toLowerCase() || 'mp4'
    const result = await analyzeVideo(file.name, file.size, ext)

        // Return 422 when NVIDIA NIM unavailable and frame extraction required
        if (result.model_used.includes('FrameExtractionRequired')) {
          return NextResponse.json(
            { success: false, error: { code: 'FRAME_EXTRACTION_REQUIRED', message: result.summary } },
            { status: 422 }
          )
        }
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

    if (scanId) fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'video', verdict: result.verdict, confidence: result.confidence, model_used: result.model_used })
    return NextResponse.json({
      success: true,
      scan_id: scanId,
      result:  { ...result, processing_time: processingTime, file_name: file.name },
    })
  } catch (err) {
    console.error('[detect/video]', err)
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } },
      { status: 500 }
    )
  }
}
