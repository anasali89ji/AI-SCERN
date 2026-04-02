import { NextRequest, NextResponse } from 'next/server'
import { analyzeImage }              from '@/lib/inference/hf-analyze'
import { checkRateLimit, rateLimitResponse } from '@/lib/ratelimit'
import { getCachedDetection, setCachedDetection, contentHash } from '@/lib/cache/detection-cache'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { fireScanCompleted }             from '@/lib/inngest/send-scan-event'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { getR2Buffer, r2Available }  from '@/lib/storage/r2'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimit('image', ip)
  if (rl.limited) return NextResponse.json(rateLimitResponse(), { status: 429 })

  let userId: string
  try {
    const guard = await creditGuard(req, 'image')
    userId      = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Request failed' } }, { status: 500 })
  }

  const start       = Date.now()
  const contentType = req.headers.get('content-type') ?? ''

  try {
    let buffer:   Buffer
    let mimeType: string
    let fileName: string
    let fileSize: number
    let r2Key:    string | null = null

    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { r2Key: key, fileName: fn, fileSize: fs, mimeType: mt } = body

      if (!key || typeof key !== 'string')
        return NextResponse.json({ success: false, error: { code: 'NO_KEY', message: 'r2Key required' } }, { status: 400 })
      if (!r2Available())
        return NextResponse.json({ success: false, error: { code: 'R2_UNAVAILABLE', message: 'Storage not configured' } }, { status: 503 })

      const r2 = await getR2Buffer(key)
      buffer   = r2.buffer
      mimeType = mt || r2.contentType
      fileName = fn || key.split('/').pop() || 'image'
      fileSize = fs || buffer.length
      r2Key    = key
    } else {
      const form = await req.formData()
      const file = form.get('file') as File | null
      if (!file)
        return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
      if (!file.type.startsWith('image/'))
        return NextResponse.json({ success: false, error: { code: 'INVALID_TYPE', message: 'File must be an image' } }, { status: 400 })
      if (file.size > 10 * 1024 * 1024)
        return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Image must be under 10MB' } }, { status: 400 })

      const bytes = await file.arrayBuffer()
      buffer   = Buffer.from(bytes)
      mimeType = file.type
      fileName = file.name
      fileSize = file.size
    }

    if (!mimeType.startsWith('image/'))
      return NextResponse.json({ success: false, error: { code: 'INVALID_TYPE', message: 'File must be an image' } }, { status: 400 })
    if (fileSize > 10 * 1024 * 1024)
      return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Image must be under 10MB' } }, { status: 400 })

    const hash   = contentHash(buffer.subarray(0, 65536))
    const cached = await getCachedDetection('image', hash)
    if (cached) {

        // Delete file from R2 after analysis — non-fatal if it fails
        if (r2Key) {
          try {
            const { deleteR2Object } = await import('@/lib/storage/r2')
            await deleteR2Object(r2Key)
          } catch { /* cleanup failure is non-fatal */ }
        }

      return NextResponse.json({
        success: true, scan_id: null, cached: true,
        result:  { ...cached, processing_time: Date.now() - start, file_name: fileName, file_size: fileSize },
      })
    }

    const result         = await analyzeImage(buffer, mimeType, fileName)
    const processingTime = Date.now() - start

    await setCachedDetection('image', hash, result)

    let scanId: string | null = null
    if (userId && !userId.startsWith('anon_')) {
      try {
        const { data: sr } = await getSupabaseAdmin().from('scans').insert({
          user_id:          userId,
          media_type:       'image',
          file_name:        fileName,
          file_size:        fileSize,
          r2_key:           r2Key,
          verdict:          result.verdict,
          confidence_score: result.confidence,
          signals:          result.signals,
          processing_time:  processingTime,
          model_used:       result.model_used,
          model_version:    result.model_version,
          status:           'complete',
          metadata:         { format: mimeType, size_kb: Math.round(fileSize / 1024), r2: !!r2Key },
        }).select('id').single()
        scanId = sr?.id ?? null
      } catch { /* non-fatal */ }
    }

    // Fire Inngest background job (fire-and-forget, non-blocking)
    if (scanId) fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'image', verdict: result.verdict, confidence: result.confidence, model_used: result.model_used })

    return NextResponse.json({
      success: true, scan_id: scanId,
      result:  { ...result, processing_time: processingTime, file_name: fileName, file_size: fileSize },
    })
  } catch (err) {
    console.error('[detect/image]', err)
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } },
      { status: 500 }
    )
  }
}
