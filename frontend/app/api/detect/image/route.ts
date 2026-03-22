import { NextRequest, NextResponse } from 'next/server'
import { analyzeImage, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60   // 60s — HF model warm-up can take 20-30s

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } }, { status: 429 })
  }

  let userId: string
  try {
    const guard = await creditGuard(req, 'image')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Request failed' } }, { status: 500 })
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

    // Validate file magic bytes match declared MIME type
    // Prevents spoofing (e.g. disguising a non-image as image/jpeg)
    const magic = new Uint8Array(bytes.slice(0, 4))
    const isJPEG = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF
    const isPNG  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47
    const isWEBP = magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46
    const isGIF  = magic[0] === 0x47 && magic[1] === 0x49 && magic[2] === 0x46
    const isBMP  = magic[0] === 0x42 && magic[1] === 0x4D

    const validImage = isJPEG || isPNG || isWEBP || isGIF || isBMP
    if (!validImage) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_FORMAT', message: 'File does not appear to be a valid image. Supported: JPEG, PNG, WebP, GIF, BMP.' }
      }, { status: 400 })
    }

    // Pass detected format so image signals can apply JPEG-specific tuning
    const detectedFormat = isJPEG ? 'jpeg' : isPNG ? 'png' : isWEBP ? 'webp' : 'other'

    // Hard 9s timeout wrapper — ensures we always return JSON (not Vercel's 504 HTML page)
    // On Vercel Hobby the function limit is 10s; on Pro it's 60s.
    // If HF models are cold, pixel-signal-only results are returned instead of timing out.
    const timeoutMs = 9000
    let result
    try {
      result = await Promise.race([
        analyzeImage(buffer, file.type, file.name, detectedFormat),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
        ),
      ])
    } catch (e: unknown) {
      const isTimeout = e instanceof Error && e.message === 'TIMEOUT'
      if (isTimeout) {
        // Return pixel-signal-only result with a note — better than a 504 error
        return NextResponse.json({
          success: false,
          error: {
            code:    'MODEL_WARMING',
            message: 'AI models are warming up — please try again in 10 seconds. (Pixel analysis is still running.)',
          }
        }, { status: 503 })
      }
      throw e
    }
    const processingTime = Date.now() - start

    let scanId: string | null = null
    if (userId && !userId.startsWith('anon_')) {
      try {
        const { data: sr } = await getSupabaseAdmin().from('scans').insert({
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
        }).select('id').single()
        scanId = sr?.id ?? null
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      scan_id: scanId,
      result:  { ...result, processing_time: processingTime, file_name: file.name, file_size: file.size },
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' },
    }, { status: 500 })
  }
}
