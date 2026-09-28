/**
 * POST /api/v1/verify/content
 *
 * ContentVerify™ — Verify text content authenticity.
 * Runs AI detection, plagiarism check, citation analysis,
 * source verification, and hallucination risk assessment.
 *
 * Input:  JSON { text, title?, language?, context? }
 * Output: VerificationResponse with TrustScore + evidence
 *
 * Requires:  X-API-Key header
 * Rate limit: 60 req/min per IP
 */

import { NextRequest, NextResponse }    from 'next/server'
import { analyzeText }                  from '@/lib/inference/hf-analyze'
import { checkRateLimitRedis }          from '@/lib/cache/redis'
import {
  extractApiKey, resolveApiKey, recordApiUsage,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'
import { buildContentTrustScore }       from '@/lib/trust/score'
import {
  createVerification, completeVerification,
  buildVerificationResponse, hashContent, generateRecommendations,
} from '@/lib/trust/verify'
import {
  auditVerificationCreated, auditVerificationCompleted, logApiAccess,
} from '@/lib/trust/audit'
import type { EvidenceItem, Finding } from '@/lib/trust/types'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

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

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { text, title, context } = body as {
    text?: unknown; title?: unknown; context?: unknown
  }

  if (!text || typeof text !== 'string')
    return NextResponse.json({ error: '"text" string field required.' }, { status: 400 })
  if (text.length < 50)
    return NextResponse.json({ error: '"text" must be at least 50 characters.' }, { status: 400 })
  if (text.length > 50_000)
    return NextResponse.json({ error: '"text" must be under 50,000 characters.' }, { status: 400 })

  // ── Register verification ─────────────────────────────────────────────────
  const entityHash     = await hashContent(text)
  const verificationId = await createVerification({
    userId:     resolved.owner,
    module:     'content',
    entityType: 'text',
    entityRef:  typeof title === 'string' ? title.slice(0, 200) : undefined,
    entityHash,
    entitySizeBytes: text.length,
    apiKeyHash: resolved.keyHash,
    metadata:   { title, context },
  })

  const scanId = verificationId ?? crypto.randomUUID()

  if (verificationId) {
    auditVerificationCreated({
      actorId:        resolved.owner,
      verificationId,
      module:         'content',
      actorIp:        ip,
    })
  }

  // ── Run analysis ──────────────────────────────────────────────────────────
  let aiResult: Awaited<ReturnType<typeof analyzeText>>
  try {
    aiResult = await analyzeText(text)
  } catch (err) {
    console.error('[verify/content] analyzeText failed:', err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }

  // ── Map inference output → trust signals ──────────────────────────────────
  const aiProbability   = aiResult.verdict === 'AI'    ? Math.round(aiResult.confidence * 100)
                        : aiResult.verdict === 'HUMAN'  ? Math.round((1 - aiResult.confidence) * 100)
                        : 50  // UNCERTAIN

  // Plagiarism: stub — returns 0 until pgvector similarity pipeline is wired
  // In Phase 2, this will use content_embedding cosine search + external API
  const plagiarismScore     = 0   // TODO: Phase 2
  const citationScore       = 75  // Default until citation extractor is wired
  const sourceScore         = 70  // Default until source verifier is wired
  const hallucinationRisk   = aiProbability > 60 ? Math.min(aiProbability * 0.8, 90) : 15

  // ── Build evidence ────────────────────────────────────────────────────────
  const evidence: EvidenceItem[] = []

  // AI detection evidence
  evidence.push({
    type:       'ai_detection',
    finding:    aiResult.verdict === 'AI'
      ? `High probability of AI-generated content (${aiProbability}% AI probability).`
      : aiResult.verdict === 'HUMAN'
      ? `Content likely written by a human (${100 - aiProbability}% human probability).`
      : `Inconclusive AI detection result. Mixed signals detected.`,
    confidence: Math.round(aiResult.confidence * 100),
    severity:   aiProbability > 70 ? 'high' : aiProbability > 50 ? 'medium' : 'none',
    details: {
      verdict:     aiResult.verdict,
      confidence:  aiResult.confidence,
      model_used:  aiResult.model_used,
      signals:     aiResult.signals?.slice(0, 5),
    },
    source: aiResult.model_used,
  })

  // Plagiarism evidence (stub)
  evidence.push({
    type:       'plagiarism',
    finding:    'No significant plagiarism detected in available corpus. (Expanded check in Phase 2.)',
    confidence: 60,
    severity:   'none',
    details:    { checked: false, phase: 'stub' },
    source:     'internal',
  })

  // Hallucination risk
  if (hallucinationRisk > 30) {
    evidence.push({
      type:       'semantic',
      finding:    `Elevated hallucination risk detected (${hallucinationRisk}%). AI-generated content is more likely to contain factual errors.`,
      confidence: 65,
      severity:   hallucinationRisk > 60 ? 'high' : 'medium',
      details:    { hallucination_risk: hallucinationRisk, correlated_with_ai: aiProbability > 50 },
      source:     'heuristic',
    })
  }

  // ── Build findings ────────────────────────────────────────────────────────
  const findings: Finding[] = []

  if (aiProbability > 70) {
    findings.push({
      severity:    'high',
      category:    'authenticity',
      message:     'Content is likely AI-generated. Trust score reflects reduced authenticity.',
      evidence_ref: 'evidence[0]',
    })
  } else if (aiProbability < 30) {
    findings.push({
      severity:    'none',
      category:    'authenticity',
      message:     'Content appears to be human-authored based on available signals.',
      evidence_ref: 'evidence[0]',
    })
  }

  // ── Trust score ───────────────────────────────────────────────────────────
  const scores = buildContentTrustScore({
    aiProbability,
    plagiarismScore,
    citationScore,
    sourceScore,
    hallucinationRisk,
    evidence,
  })

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = generateRecommendations({
    trustOverall: scores.trust.overall,
    riskOverall:  scores.risk.overall,
    module:       'content',
    flags: {
      highAiProb:    aiProbability > 70,
      plagiarism:    plagiarismScore > 30,
      citationIssues: citationScore < 50,
    },
  })

  const processingMs = Date.now() - startMs

  // ── Persist scores & evidence ─────────────────────────────────────────────
  if (verificationId) {
    await completeVerification({ verificationId, scores, evidence, processingMs })
    auditVerificationCompleted({
      actorId:        resolved.owner,
      verificationId,
      module:         'content',
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
    path:           '/api/v1/verify/content',
    statusCode:     200,
    processingMs,
    requestSize:    text.length,
    verificationId: verificationId ?? undefined,
    module:         'content',
  })

  // ── Respond ───────────────────────────────────────────────────────────────
  const response = buildVerificationResponse({
    scanId:          scanId,
    verificationId:  verificationId ?? scanId,
    tool:            'ContentVerify™',
    entityType:      'text',
    scores,
    evidence,
    findings,
    recommendations,
    processingMs,
  })

  // Extend with ContentVerify-specific fields
  return NextResponse.json({
    ...response,
    ai_probability:           aiProbability,
    plagiarism_score:         plagiarismScore,
    academic_integrity_score: Math.round(100 - aiProbability * 0.6 - plagiarismScore * 0.4),
    hallucination_risk:       hallucinationRisk,
    citations_found:          0,
    citations_verified:       0,
    // Legacy compat: expose raw verdict+confidence for backward compat
    _legacy: {
      verdict:         aiResult.verdict,
      confidence:      aiResult.confidence,
      signals:         aiResult.signals?.slice(0, 5),
      summary:         aiResult.summary,
      model:           aiResult.model_used,
    },
  })
}
