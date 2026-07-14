import { NextRequest, NextResponse } from 'next/server'
import { analyzeImage }              from '@/lib/inference/hf-analyze'
import { checkRateLimitDB } from '@/lib/ratelimit-db'
import { getCachedDetection, setCachedDetection, contentHash } from '@/lib/cache/detection-cache'
import { creditGuard, httpErrorResponse, HTTPError } from '@/lib/middleware/credit-guard'
import { fireScanCompleted }             from '@/lib/inngest/send-scan-event'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { getR2Buffer, r2Available }  from '@/lib/storage/r2'
import { logModelPredictions }       from '@/lib/accuracy/log-predictions'
import { queryDetectionRAG } from '@/lib/rag/detection-rag'
import { preprocessImage } from '@/lib/inference/preprocess-image'
import { analyzeImageWithBrain } from '@/lib/inference/image-detection-brain'
import { extractImageSignals, aggregateImageSignals, applyCalibration } from '@/lib/inference/signals/image-signals'
import { getCalibrationStats } from '@/lib/inference/calibration-client'

export const dynamic = 'force-dynamic'
// Vercel Hobby: 60s max. Pro/Enterprise: up to 300s.
// Image pipeline (HF ensemble + Gemini + brain) can take 25–45s.
// Without this, Vercel kills the function at the default 10s → "failed to fetch"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const rl = await checkRateLimitDB('image', ip)
  if (rl.limited) return NextResponse.json(
    { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Try again in a minute.' } },
    { status: 429, headers: { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': String(rl.reset) } }
  )

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
      // Save scan to DB even on cache hit (user still did a scan)
      let scanId: string | null = null
      if (userId && !userId.startsWith('anon_')) {
        try {
          const { data: sr } = await getSupabaseAdmin().from('scans').insert({
            user_id:          userId,
            media_type:       'image',
            file_name:        fileName,
            file_size:        fileSize,
            r2_key:           r2Key,
            verdict:          cached.verdict,
            confidence_score: cached.confidence,
            signals:          cached.signals,
            processing_time:  Date.now() - start,
            model_used:       cached.model_used,
            status:           'complete',
            metadata:         { format: mimeType, size_kb: Math.round(fileSize / 1024), cached: true },
          }).select('id').single()
          scanId = sr?.id ?? null
        } catch { /* non-fatal */ }
      }
      return NextResponse.json({
        success: true, scan_id: scanId, cached: true,
        result:  { ...cached, processing_time: Date.now() - start, file_name: fileName, file_size: fileSize },
      })
    }

    const preprocessed = await preprocessImage(buffer, mimeType)

    // ── Async path via Cloudflare Worker (fixes the Vercel Hobby 10s timeout) ──
    // Falls back to the original synchronous path below if IMAGE_WORKER_URL
    // isn't configured (e.g. local dev before the worker is deployed) — this
    // is a deliberate resilience choice, not a leftover: the route must keep
    // working even if the worker is down or not yet set up.
    const workerUrl    = process.env.IMAGE_WORKER_URL
    const workerSecret = process.env.IMAGE_WORKER_SECRET

    if (workerUrl && workerSecret) {
      try {
        // Brain + pixel signals stay on Vercel — they're fast, local, and Brain
        // needs `sharp`, which the Worker (Cloudflare's V8 isolate runtime) can't
        // run. Only the slow network fan-out (CV worker, Gemini, 6 HF models)
        // moves to the Worker, where fetch()-wait time doesn't count against
        // the execution limit.
        const brainResult = await analyzeImageWithBrain(buffer, buffer.length, mimeType)
        let imgSignals     = extractImageSignals(buffer, buffer.length)
        try {
          const cal = await getCalibrationStats()
          if (cal?.ai_sample_count >= 10) imgSignals = applyCalibration(imgSignals, cal)
        } catch { /* non-fatal — uncalibrated signals still usable */ }
        const imgSignalScore = aggregateImageSignals(imgSignals)

        let scanId: string | null = null
        if (userId && !userId.startsWith('anon_')) {
          const { data: sr } = await getSupabaseAdmin().from('scans').insert({
            user_id:    userId,
            media_type: 'image',
            file_name:  fileName,
            file_size:  fileSize,
            r2_key:     r2Key,
            status:     'processing',
            metadata:   { format: mimeType, size_kb: Math.round(fileSize / 1024), r2: !!r2Key },
          }).select('id').single()
          scanId = sr?.id ?? null
        }

        if (!scanId) {
          // Anonymous users have no scans row to poll against — the async
          // hand-off has nothing to report back to. Fall through to the
          // synchronous path below instead of returning a scan_id the client
          // can never resolve.
          throw new Error('ANON_NO_SCAN_ROW')
        }

        const workerRes = await fetch(`${workerUrl}/analyze`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Worker-Secret': workerSecret },
          body: JSON.stringify({
            scanId, userId,
            imageBase64: preprocessed.buffer.toString('base64'),
            mimeType:    preprocessed.mimeType,
            brainResult: {
              score: brainResult.score, verdict: brainResult.verdict,
              generatorHints: brainResult.generatorHints, findings: brainResult.findings,
              signals: brainResult.signals.map(s => ({ name: s.name, evidence: s.evidence, score: s.score, weight: s.weight })),
            },
            imgSignals: imgSignals.map(s => ({ name: s.name, description: s.description, score: s.score, weight: s.weight })),
            imgSignalScore,
          }),
          signal: AbortSignal.timeout(8000),   // just the ACK — worker responds in <1s via waitUntil
        })

        if (!workerRes.ok) throw new Error(`Worker returned ${workerRes.status}`)

        return NextResponse.json({ success: true, scan_id: scanId, status: 'processing' })
      } catch (workerErr) {
        // Worker unreachable/misconfigured — fall back to the synchronous path.
        // Not silent: logged so a persistently-failing worker is diagnosable
        // rather than invisibly degrading every request back to the slow path.
        console.error('[detect/image] Worker hand-off failed, falling back to sync path:', workerErr instanceof Error ? workerErr.message : workerErr)
      }
    }

    // ── Synchronous fallback path (original behavior — used when the worker
    //    isn't configured, or as a resilience fallback if it errors above) ───
    const result         = await analyzeImage(buffer, mimeType, fileName)
    const processingTime = Date.now() - start

    // ── RAG blending for images (uses filename as description) ────────────────
    // Note: For optimal results, pass actual image analysis text in request body.
    // For now we use fileName as a proxy description.
    let finalVerdict   = result.verdict
    let finalConfidence = result.confidence
    let ragResult: any = null
    
    if (process.env.DETECTION_RAG_ENABLED === 'true') {
      try {
        // Embed the model's signal description for meaningful pgvector similarity.
        // Using fileName was a placeholder — it produces random/useless neighbors.
        // Signal description contains artifact names, verdicts, and model findings
        // which are semantically meaningful for retrieval.
        const imageDescription =
          result.signals?.[0]?.description ??
          result.summary ??
          fileName ??
          'uploaded image'
        ragResult = await queryDetectionRAG(imageDescription, 'image', result.confidence)
        if (ragResult?.rag_applied) {
          finalConfidence = ragResult.blended_score
          // Re-determine verdict based on blended score
          if (finalConfidence >= 0.55)      finalVerdict = 'AI'
          else if (finalConfidence <= 0.40) finalVerdict = 'HUMAN'
          else                               finalVerdict = 'UNCERTAIN'
        }
      } catch (e) {
        console.warn('[detect/image] RAG query error (non-blocking):', e)
      }
    }

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
          verdict:          finalVerdict,
          confidence_score: finalConfidence,
          signals:          result.signals,
          processing_time:  processingTime,
          model_used:       result.model_used,
          model_version:    result.model_version,
          status:           'complete',
          metadata:         { 
            format: mimeType, 
            size_kb: Math.round(fileSize / 1024), 
            r2: !!r2Key,
            rag_applied: ragResult?.rag_applied ?? false,
          },
        }).select('id').single()
        scanId = sr?.id ?? null
      } catch { /* non-fatal */ }
    }

    // Fire Inngest background job (fire-and-forget, non-blocking)
    if (scanId) fireScanCompleted({ scan_id: scanId, user_id: userId, media_type: 'image', verdict: finalVerdict, confidence: finalConfidence, model_used: result.model_used })

    // Accuracy monitoring — fire-and-forget (uses final verdict from RAG blending)
    if (scanId && result.model_breakdown?.length) {
      void logModelPredictions(scanId, 'image', result.model_breakdown, finalVerdict)
    }

    // ── Fire forensic cascade (non-blocking, parallel to response) ────────────
    // Runs the 6-layer pipeline in the background. User gets instant result now,
    // forensic deep-analysis is ready ~10s later at /forensic/[forensicScanId].
    // MODULE 5 — Failure Visibility / Dead-Button Fix.
    // Previously, if r2Key was null (R2 not configured or upload path
    // skipped), the forensic cascade was silently never created and the
    // frontend had no way to know why — it would render the "Deep Forensic
    // Analysis" button anyway, which then 404s when clicked. We now always
    // report forensic availability with a reason code so the frontend can
    // hide/disable the button instead.
    let forensicScanId: string | null = null
    let forensicAvailable = false
    let forensicUnavailableReason: 'R2_NOT_CONFIGURED' | 'UPLOAD_SKIPPED' | 'CASCADE_FIRE_FAILED' | null = null

    if (!r2Key) {
      forensicUnavailableReason = r2Available() ? 'UPLOAD_SKIPPED' : 'R2_NOT_CONFIGURED'
    }

    if (r2Key) {
      try {
        const { inngest }    = await import('@/lib/inngest/client')
        const { getR2PublicUrl } = await import('@/lib/storage/r2')
        forensicScanId = crypto.randomUUID()
        const imageUrl = getR2PublicUrl(r2Key)

        // Insert forensic_scans pending row so the UI can poll immediately
        // IMPORTANT: Supabase .insert() returns {data,error} — it does NOT throw.
        // Must check error explicitly or the row is silently missing and the user
        // gets "Scan not found" when they click the Deep Forensic Analysis button.
        const { error: insertErr } = await getSupabaseAdmin().from('forensic_scans').insert({
          id:                       forensicScanId,
          image_url:                imageUrl,
          r2_key:                   r2Key,
          user_id:                  userId && !userId.startsWith('anon_') ? userId : null,
          status:                   'pending',
          layers:                   [],
          semantic_agents:          [],
          provenance:               null,
          final_verdict:            null,
          existing_ensemble_result: {
            confidence: finalConfidence,   // already 0-1 from analyzeImage — do NOT divide by 100
            label:      finalVerdict === 'AI' ? 'ai' : finalVerdict === 'HUMAN' ? 'human' : 'uncertain',
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        if (insertErr) {
          console.error('[detect/image] forensic_scans insert failed:', insertErr.message, insertErr.code)
          throw new Error('forensic_scans insert failed: ' + insertErr.message)
        }

        // Extract brain telemetry from model_breakdown for L4 LayerReport
        const brainBreakdown = result.model_breakdown?.find((m: { model_id: string }) => m.model_id === 'image-brain-v2')
        const brainSig       = result.signals?.find((s: { name: string }) => s.name === 'Image Detection Brain')
        const genHintMatch   = brainSig?.description?.match(/Generator: ([^.]+)/)
        const brainTelemetry = brainBreakdown
          ? {
              score:          brainBreakdown.raw_score as number,
              verdict:        brainBreakdown.verdict   as string,
              generatorHints: genHintMatch ? genHintMatch[1].split('; ').filter(Boolean) : [] as string[],
              description:    brainSig?.description ?? '',
            }
          : null

        // Fire Inngest cascade — runs in background, never blocks this response
        await inngest.send({
          name: 'scan/image.forensic-cascade' as any,
          data: {
            scanId:   forensicScanId,
            imageUrl,
            r2Key,
            existingEnsembleResult: {
              confidence: finalConfidence,   // already 0-1 — do NOT divide by 100
              label:      finalVerdict === 'AI' ? 'ai' : finalVerdict === 'HUMAN' ? 'human' : 'uncertain',
            },
            brainTelemetry,
          },
        })
        forensicAvailable = true
      } catch (e) {
        // Never block the response — forensic cascade is best-effort
        console.warn('[detect/image] forensic cascade fire failed:', e)
        forensicScanId = null
        forensicAvailable = false
        forensicUnavailableReason = 'CASCADE_FIRE_FAILED'
      }
    }

    // MODULE 5 — degraded_signals surfaced from the ensemble (hf-analyze.ts)
    // plus the forensic-cascade availability computed above, merged into one
    // honest picture of "which signal sources actually contributed" so the
    // UI/ARIA never presents a partial result as if it were the full one.
    const degradedSignals = [
      ...(result.degraded_signals ?? []),
      ...(!forensicAvailable && forensicUnavailableReason ? [`forensic-cascade-${forensicUnavailableReason.toLowerCase().replace(/_/g, '-')}`] : []),
    ]

    return NextResponse.json({
      success: true, scan_id: scanId,
      forensic_scan_id: forensicScanId,
      forensic_available: forensicAvailable,
      forensic_unavailable_reason: forensicUnavailableReason,
      result:  {
        ...result,
        verdict: finalVerdict,
        confidence: finalConfidence,
        processing_time: processingTime,
        file_name: fileName,
        file_size: fileSize,
        degraded_signals: degradedSignals,
        rag_stats: ragResult ? {
          rag_applied: ragResult.rag_applied,
          retrieval_confidence: ragResult.retrieval_confidence,
          neighbour_count: ragResult.neighbour_count,
          ai_ratio: ragResult.ai_ratio,
        } : undefined,
      },
    })
  } catch (err) {
    console.error('[detect/image]', err)
    return NextResponse.json(
      { success: false, error: { code: 'ANALYSIS_FAILED', message: err instanceof Error ? err.message : 'Analysis failed' } },
      { status: 500 }
    )
  }
}
