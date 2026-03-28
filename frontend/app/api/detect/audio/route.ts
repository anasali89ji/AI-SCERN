/**
 * POST /api/detect/audio
 *
 * Accepts EITHER:
 *   a) JSON: { r2Key, fileName, fileSize, format } — file already in R2 (preferred)
 *   b) FormData: file field — direct upload (small files / dev mode)
 *
 * Detection: Gemini 2.0 Flash (primary) + wav2vec2 (if warm) + 5 acoustic signals.
 * Files are NOT stored in Supabase. R2 handles storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { analyzeAudio, checkRateLimit } from '@/lib/inference/hf-analyze'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getR2Buffer, r2Available } from '@/lib/storage/r2'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (!checkRateLimit(ip, 15)) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please wait.' } },
      { status: 429 }
    )
  }

  let userId: string
  try {
    const guard = await creditGuard(req, 'audio')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'ERROR', message: 'Request failed' } }, { status: 500 })
  }

  const start       = Date.now()
  const contentType = req.headers.get('content-type') ?? ''

  try {
    let buffer:   Buffer | undefined
    let fileName: string
    let fileSize: number
    let format:   string
    let r2Key:    string | null = null

    // ── Path A: R2 key provided (browser pre-uploaded the file) ──────────────
    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { r2Key: key, fileName: fn, fileSize: fs, format: fmt } = body

      if (!key || typeof key !== 'string')
        return NextResponse.json({ success: false, error: { code: 'NO_KEY', message: 'r2Key required' } }, { status: 400 })
      if (!r2Available())
        return NextResponse.json({ success: false, error: { code: 'R2_UNAVAILABLE', message: 'Storage not configured' } }, { status: 503 })

      const r2 = await getR2Buffer(key)
      buffer   = r2.buffer
      fileName = fn || key.split('/').pop() || 'audio'
      fileSize = fs || buffer.length
      format   = fmt || fileName.split('.').pop()?.toLowerCase() || 'mp3'
      r2Key    = key

    // ── Path B: Direct FormData upload (dev / small files) ───────────────────
    } else {
      const form = await req.formData()
      const file = form.get('file') as File | null

      if (!file)
        return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
      if (file.size > 25 * 1024 * 1024)
        return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Audio must be under 25MB' } }, { status: 400 })

      const bytes = await file.arrayBuffer()
      buffer   = Buffer.from(bytes)
      fileName = file.name
      fileSize = file.size
      format   = file.name.split('.').pop()?.toLowerCase() || 'mp3'
    }

    const result         = await analyzeAudio(fileName, fileSize, format, buffer)
    const processingTime = Date.now() - start

    // Metadata only in Supabase
    let scanId: string | null = null
    if (userId && !userId.startsWith('anon_')) {
      try {
        const { data: sr } = await getSupabaseAdmin().from('scans').insert({
          user_id:          userId,
          media_type:       'audio',
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
          metadata: {
            format,
            estimated_duration_sec: Math.round(fileSize / (128 * 1024 / 8)),
            r2: !!r2Key,
          },
        }).select('id').single()
        scanId = sr?.id ?? null
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      scan_id: scanId,
      result:  { ...result, processing_time: processingTime, file_name: fileName },
    })
  } catch (err) {
    console.error('[detect/audio]', err)
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } },
      { status: 500 }
    )
  }
}
