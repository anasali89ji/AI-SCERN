/**
 * Aiscern Trust Platform — Verification Registry Helper
 *
 * Shared functions for creating and completing verification records.
 * Called by every /api/v1/verify/* route handler.
 */

import type {
  VerificationModule,
  TrustScoreResult,
  EvidenceItem,
  Finding,
  VerificationResponse,
} from './types'

// ── Create a verification record ──────────────────────────────────────────────

export async function createVerification(params: {
  userId:     string
  module:     VerificationModule
  entityType: string
  entityRef?: string
  entityHash?: string
  entitySizeBytes?: number
  apiKeyHash?: string
  scanId?: string
  metadata?: Record<string, unknown>
}): Promise<string | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const sb = getSupabaseAdmin()

    const { data, error } = await sb
      .from('verifications')
      .insert({
        user_id:          params.userId,
        module:           params.module,
        entity_type:      params.entityType,
        entity_ref:       params.entityRef,
        entity_hash:      params.entityHash,
        entity_size_bytes: params.entitySizeBytes,
        api_key_hash:     params.apiKeyHash,
        scan_id:          params.scanId,
        metadata:         params.metadata ?? {},
        status:           'processing',
      })
      .select('id')
      .single()

    if (error) {
      console.error('[verify] createVerification error:', error.message)
      return null
    }
    return (data as { id: string }).id
  } catch (err) {
    console.error('[verify] createVerification unexpected:', err)
    return null
  }
}

// ── Complete a verification with scores and evidence ──────────────────────────

export async function completeVerification(params: {
  verificationId: string
  scores:         TrustScoreResult
  evidence:       EvidenceItem[]
  processingMs:   number
  status?:        'completed' | 'partial' | 'failed'
}): Promise<void> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const sb = getSupabaseAdmin()

    // 1. Update verification status + timing
    await sb
      .from('verifications')
      .update({
        status:       params.status ?? 'completed',
        processing_ms: params.processingMs,
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.verificationId)

    // 2. Upsert trust scores via RPC
    await sb.rpc('upsert_trust_score', {
      p_verification_id:    params.verificationId,
      p_trust_overall:      params.scores.trust.overall,
      p_risk_overall:       params.scores.risk.overall,
      p_confidence_overall: params.scores.confidence.overall,
      p_components: {
        authenticity:       params.scores.trust.components.authenticity,
        consistency:        params.scores.trust.components.consistency,
        source_reliability: params.scores.trust.components.source_reliability,
        verification_sigs:  params.scores.trust.components.verification_sigs,
        metadata_quality:   params.scores.trust.components.metadata_quality,
        historical_rep:     params.scores.trust.components.historical_rep,
      },
      p_risk_factors:       params.scores.risk.factors,
      p_algorithm_version:  'v1.0',
    })

    // 3. Insert evidence items (batch)
    if (params.evidence.length > 0) {
      await sb.from('evidence_items').insert(
        params.evidence.map(ev => ({
          verification_id: params.verificationId,
          evidence_type:   ev.type,
          severity:        ev.severity,
          finding:         ev.finding,
          confidence:      ev.confidence,
          details:         ev.details,
          source:          ev.source,
        }))
      )
    }
  } catch (err) {
    console.error('[verify] completeVerification error:', err)
  }
}

// ── Assemble universal API response ──────────────────────────────────────────

export function buildVerificationResponse(params: {
  scanId:         string
  verificationId: string
  tool:           string
  entityType:     string
  scores:         TrustScoreResult
  evidence:       EvidenceItem[]
  findings:       Finding[]
  recommendations: string[]
  processingMs:   number
  reportUrl?:     string
}): VerificationResponse {
  return {
    scan_id:         params.scanId,
    verification_id: params.verificationId,
    timestamp:       new Date().toISOString(),
    tool:            params.tool,
    entity_type:     params.entityType,
    status:          'completed',
    scores:          params.scores,
    evidence:        params.evidence,
    findings:        params.findings,
    recommendations: params.recommendations,
    report_url:      params.reportUrl,
    audit_log_url:   `/api/v1/audit/log/${params.verificationId}`,
    processing_ms:   params.processingMs,
    api_version:     'v1',
  }
}

// ── SHA-256 hash of input content (for dedup) ─────────────────────────────────

export async function hashContent(content: string | Buffer): Promise<string> {
  const data: BufferSource = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : new Uint8Array(content)
  const hashBuf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Generate standard recommendations ─────────────────────────────────────────

export function generateRecommendations(params: {
  trustOverall: number
  riskOverall:  number
  module:       VerificationModule
  flags?: Record<string, boolean>
}): string[] {
  const recs: string[] = []
  const { trustOverall, riskOverall, module, flags = {} } = params

  if (trustOverall >= 80) {
    recs.push('Content shows strong authenticity signals and is suitable for use.')
  } else if (trustOverall >= 60) {
    recs.push('Moderate trust level detected. Additional manual review is recommended.')
  } else {
    recs.push('Low trust level detected. Exercise significant caution before using or distributing.')
  }

  if (module === 'content') {
    if (flags.highAiProb)     recs.push('High AI generation probability — verify with additional tools before academic submission.')
    if (flags.plagiarism)     recs.push('Plagiarism indicators found — review matched sources before publishing.')
    if (flags.citationIssues) recs.push('Citation issues detected — manually verify all references.')
  }

  if (module === 'image') {
    if (flags.manipulation)   recs.push('Image manipulation indicators detected — request original file from source.')
    if (flags.noExif)         recs.push('No EXIF metadata found — original provenance cannot be verified.')
  }

  if (module === 'web') {
    if (flags.youngDomain)    recs.push('Domain is relatively new — exercise caution with personal information.')
    if (flags.sslIssues)      recs.push('SSL certificate issues detected — avoid entering sensitive data.')
  }

  if (module === 'identity') {
    if (flags.disposableEmail) recs.push('Disposable email address detected — higher fraud risk.')
    if (flags.noSocial)        recs.push('No social media presence found — identity could not be independently verified.')
  }

  if (riskOverall >= 70) {
    recs.push('Critical risk level — do not share, publish, or act on this content without expert review.')
  }

  return recs
}
