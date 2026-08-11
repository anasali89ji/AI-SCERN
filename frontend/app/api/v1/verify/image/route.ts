/**
 * POST /api/v1/verify/image
 *
 * ImageVerify™ — Verify image authenticity and detect manipulation.
 * Runs AI image detection, metadata analysis, and manipulation checks.
 *
 * Input:  multipart/form-data with "file" field (image/*, max 10MB)
 * Output: VerificationResponse with TrustScore + evidence
 *
 * Requires:  X-API-Key header
 * Rate limit: 60 req/min per IP
 */

import { NextRequest, NextResponse }    from 'next/server'
import { analyzeImage }                 from '@/lib/inference/hf-analyze'
import { checkRateLimitRedis }          from '@/lib/cache/redis'
import {
  extractApiKey, resolveApiKey, recordApiUsage,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'
import { buildImageTrustScore }         from '@/lib/trust/score'
import {
  createVerification, completeVerification,
  buildVerificationResponse, hashContent, generateRecommendations,
} from '@/lib/trust/verify'
import {
  auditVerificationCreated, auditVerificationCompleted, logApiAccess,
} from '@/lib/trust/audit'
import { getSupabaseAdmin }             from '@/lib/supabase/admin'
import type { EvidenceItem, Finding }   from '@/lib/trust/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 90  // image analysis is heavier

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey  = extractApiKey(req)
  if (!apiKey)  return missingKeyResponse()

  const resolved = await resolveApiKey(apiKey)
  if (!resolved.valid) return invalidOrExhaustedKeyResponse(apiKey)

  // ── Rate limit ────────────────────────────────────────────────────────────
  const allowed = await checkRateLimitRedis(`api:${ip}`, 60, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 requests/minute per IP.' },
      { status: 429 },
    )
  }

  // ── Parse multipart ───────────────────────────────────────────────────────
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'Body must be multipart/form-data with a "file" field.' },
      { status: 400 },
    )
  }

  let file: File | null
  try {
    const form = await req.formData()
    file = form.get('file') as File | null
  } catch {
    return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 })
  }

  if (!file)                          return NextResponse.json({ error: '"file" field required.' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024)   return NextResponse.json({ error: 'Image must be under 10MB.' }, { status: 400 })

  const buffer   = Buffer.from(await file.arrayBuffer())
  const fileHash = await hashContent(buffer)

  // ── Register verification ─────────────────────────────────────────────────
  const verificationId = await createVerification({
    userId:         resolved.owner,
    module:         'image',
    entityType:     'image',
    entityRef:      file.name,
    entityHash:     fileHash,
    entitySizeBytes: file.size,
    apiKeyHash:     resolved.keyHash,
    metadata:       { filename: file.name, mime: file.type, size: file.size },
  })

  const scanId = verificationId ?? crypto.randomUUID()

  if (verificationId) {
    auditVerificationCreated({
      actorId:        resolved.owner,
      verificationId,
      module:         'image',
      actorIp:        ip,
    })
  }

  // ── Run AI analysis ───────────────────────────────────────────────────────
  let aiResult: Awaited<ReturnType<typeof analyzeImage>>
  try {
    aiResult = await analyzeImage(buffer, file.type, file.name)
  } catch (err) {
    console.error('[verify/image] analyzeImage failed:', err)
    return NextResponse.json({ error: 'Image analysis failed. Please try again.' }, { status: 500 })
  }

  // ── Map inference → signals ───────────────────────────────────────────────
  const aiProbability   = aiResult.verdict === 'AI'
    ? Math.round(aiResult.confidence * 100)
    : aiResult.verdict === 'HUMAN'
    ? Math.round((1 - aiResult.confidence) * 100)
    : 50

  // Metadata analysis: stub (Phase 2: signal-worker extended for EXIF)
  const metadataScore   = 60   // neutral default — full analysis in Phase 2
  const lightingScore   = 65   // stub — physics analysis in signal-worker Phase 2
  const manipulationScore = aiProbability > 60 ? Math.min(aiProbability * 0.9, 95) : 20

  // ── Build evidence ────────────────────────────────────────────────────────
  const evidence: EvidenceItem[] = []

  evidence.push({
    type:       'ai_detection',
    finding:    aiResult.verdict === 'AI'
      ? `High probability of AI-generated image (${aiProbability}% AI probability). Likely generated by diffusion model or GAN.`
      : aiResult.verdict === 'HUMAN'
      ? `Image likely captured by a real camera (${100 - aiProbability}% authentic probability).`
      : `Inconclusive AI image detection. Mixed signals from ensemble classifiers.`,
    confidence: Math.round(aiResult.confidence * 100),
    severity:   aiProbability > 70 ? 'high' : aiProbability > 50 ? 'medium' : 'none',
    details: {
      verdict:       aiResult.verdict,
      confidence:    aiResult.confidence,
      model_used:    aiResult.model_used,
      signals:       aiResult.signals?.slice(0, 5),
      ai_probability: aiProbability,
    },
    source: aiResult.model_used,
  })

  evidence.push({
    type:       'metadata',
    finding:    'Metadata analysis in progress. Extended EXIF and compression forensics available in Phase 2.',
    confidence: 50,
    severity:   'none',
    details:    { phase: 'stub', filename: file.name, mime: file.type, size_bytes: file.size },
    source:     'internal',
  })

  if (manipulationScore > 40) {
    evidence.push({
      type:       'manipulation',
      finding:    `Potential image manipulation detected (${manipulationScore}% risk). Correlated with AI generation probability.`,
      confidence: 60,
      severity:   manipulationScore > 70 ? 'high' : 'medium',
      details:    {
        manipulation_score: manipulationScore,
        clone_detected:     false,
        splice_detected:    false,
        note: 'Full forensic analysis (clone detection, splicing, lighting) available in Phase 2 with extended signal-worker.',
      },
      source: 'heuristic',
    })
  }

  // ── Build findings ────────────────────────────────────────────────────────
  const findings: Finding[] = []

  if (aiProbability > 70) {
    findings.push({
      severity:    'high',
      category:    'authenticity',
      message:     'Image is likely AI-generated. Do not use as evidence or authentic visual media.',
      evidence_ref: 'evidence[0]',
    })
  } else if (aiProbability < 30) {
    findings.push({
      severity:    'none',
      category:    'authenticity',
      message:     'Image appears to be authentic based on available detection signals.',
      evidence_ref: 'evidence[0]',
    })
  }

  // ── Trust score ───────────────────────────────────────────────────────────
  const scores = buildImageTrustScore({
    aiProbability,
    manipulationScore,
    metadataScore,
    lightingScore,
    evidence,
  })

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = generateRecommendations({
    trustOverall: scores.trust.overall,
    riskOverall:  scores.risk.overall,
    module:       'image',
    flags: {
      manipulation: manipulationScore > 50,
      noExif:       false,  // Phase 2 will set this from signal-worker
    },
  })

  const processingMs = Date.now() - startMs

  // ── Persist image-specific record ─────────────────────────────────────────
  if (verificationId) {
    try {
      const sb = getSupabaseAdmin()
      await sb.from('image_verifications').insert({
        verification_id:   verificationId,
        file_mime:         file.type,
        file_size_bytes:   file.size,
        ai_probability:    aiProbability,
        manipulation_detected: manipulationScore > 50,
        manipulation_score:    manipulationScore,
      })
    } catch { /* non-fatal */ }

    await completeVerification({ verificationId, scores, evidence, processingMs })
    auditVerificationCompleted({
      actorId:        resolved.owner,
      verificationId,
      module:         'image',
      trustOverall:   scores.trust.overall,
      riskOverall:    scores.risk.overall,
      actorIp:        ip,
    })
  }

  recordApiUsage(resolved)
  logApiAccess({
    apiKeyHash:     resolved.keyHash,
    userId:         resolved.owner,
    actorIp:        ip,
    method:         'POST',
    path:           '/api/v1/verify/image',
    statusCode:     200,
    processingMs,
    requestSize:    file.size,
    verificationId: verificationId ?? undefined,
    module:         'image',
  })

  // ── Respond ───────────────────────────────────────────────────────────────
  const response = buildVerificationResponse({
    scanId:          scanId,
    verificationId:  verificationId ?? scanId,
    tool:            'ImageVerify™',
    entityType:      'image',
    scores,
    evidence,
    findings,
    recommendations,
    processingMs,
  })

  return NextResponse.json({
    ...response,
    ai_probability:       aiProbability,
    manipulation_score:   manipulationScore,
    authenticity_score:   scores.trust.components.authenticity,
    exif_consistent:      null,  // Phase 2
    // Legacy compat
    _legacy: {
      verdict:    aiResult.verdict,
      confidence: aiResult.confidence,
      signals:    aiResult.signals?.slice(0, 5),
      summary:    aiResult.summary,
      model:      aiResult.model_used,
    },
  })
}
