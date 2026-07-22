import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimitDB } from '@/lib/ratelimit-db'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createPresignedUpload, r2Available } from '@/lib/storage/r2'
import { nanoid } from 'nanoid'

export const dynamic = 'force-dynamic'
// Extraction + parallel image/text detection on a multi-page document can
// take a while — same rationale as the image route's 60s allowance.
export const maxDuration = 60

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || ''
const MAX_DOC_SIZE = 25 * 1024 * 1024 // 25MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])
const ALLOWED_EXT = ['.pdf', '.docx', '.pptx']

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimitDB('document', ip)
  if (rl.limited) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again in a minute.' } },
      { status: 429, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(rl.reset) } }
    )
  }

  let userId: string
  try {
    const guard = await creditGuard(req, 'document')
    userId = guard.userId
  } catch (err) {
    if (err instanceof HTTPError) return httpErrorResponse(err)
    return NextResponse.json({ success: false, error: { code: 'AUTH_ERROR', message: 'Authentication required' } }, { status: 401 })
  }

  if (!PYTHON_WORKER_URL) {
    return NextResponse.json({
      success: false,
      error: { code: 'WORKER_UNAVAILABLE', message: 'Document verification worker is not configured. Set PYTHON_WORKER_URL.' },
    }, { status: 503 })
  }

  const start = Date.now()
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file provided' } }, { status: 400 })
    }

    const nameLower = file.name.toLowerCase()
    const hasAllowedExt = ALLOWED_EXT.some(ext => nameLower.endsWith(ext))
    if (!ALLOWED_MIMES.has(file.type) && !hasAllowedExt) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_TYPE', message: 'Only PDF, DOCX, and PPTX files are supported' },
      }, { status: 400 })
    }
    if (file.size > MAX_DOC_SIZE) {
      return NextResponse.json({ success: false, error: { code: 'TOO_LARGE', message: 'Document must be under 25MB' } }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const bodyBytes = new Uint8Array(buffer)

    // Upload the original document to R2 for the user's scan history / re-download,
    // in parallel with kicking off the worker call — neither blocks the other.
    let r2Key: string | null = null
    const uploadPromise = (async () => {
      if (!r2Available()) return null
      try {
        const ext = nameLower.split('.').pop() || 'pdf'
        const presigned = await createPresignedUpload('document', file.name, file.type || 'application/octet-stream', userId, file.size)
        await fetch(presigned.uploadUrl, { method: 'PUT', body: bodyBytes, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
        return presigned.key
      } catch (e) {
        console.warn('[detect/document] R2 upload failed (non-fatal):', e)
        return null
      }
    })()

    const workerForm = new FormData()
    workerForm.append('file', new Blob([bodyBytes], { type: file.type || 'application/octet-stream' }), file.name)

    const workerRes = await fetch(`${PYTHON_WORKER_URL}/analyze/document`, {
      method: 'POST',
      body: workerForm,
      signal: AbortSignal.timeout(55000),
    })

    r2Key = await uploadPromise

    if (!workerRes.ok) {
      let detail = 'Document analysis failed'
      try { detail = (await workerRes.json())?.detail || detail } catch {}
      return NextResponse.json({
        success: false,
        error: { code: 'ANALYSIS_FAILED', message: detail },
      }, { status: workerRes.status === 415 ? 415 : 502 })
    }

    const result = await workerRes.json()
    const processingTime = Date.now() - start

    try {
      await getSupabaseAdmin().from('scans').insert({
        user_id: userId,
        media_type: 'document',
        file_name: file.name,
        file_size: file.size,
        r2_key: r2Key,
        verdict: result.composite_verdict,
        confidence_score: null,
        processing_time: processingTime,
        status: 'complete',
        metadata: {
          document_type: result.document_type,
          units_analyzed: result.units_analyzed,
          image_count: result.image_count,
          has_text: result.has_text,
          plagiarism_risk: result.plagiarism_analysis?.risk_level ?? null,
          fingerprint: result.document_fingerprint,
        },
      })
    } catch (e) {
      console.warn('[detect/document] scan log failed (non-fatal):', e)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        processing_time_total_ms: processingTime,
        r2_key: r2Key,
        scan_id: nanoid(10),
      },
    })
  } catch (err: any) {
    console.error('[detect/document]', err)
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    return NextResponse.json({
      success: false,
      error: {
        code: isTimeout ? 'TIMEOUT' : 'ANALYSIS_FAILED',
        message: isTimeout ? 'Analysis took too long — try a smaller document.' : (err?.message || 'Analysis failed'),
      },
    }, { status: isTimeout ? 504 : 500 })
  }
}
