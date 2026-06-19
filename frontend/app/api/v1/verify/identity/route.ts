/**
 * POST /api/v1/verify/identity
 *
 * HumanVerify™ — Verify human identity authenticity signals.
 * Checks email validity/deliverability, social presence, and
 * synthetic identity risk. Privacy-first: emails are hashed at rest.
 *
 * Input:  JSON { email?: string, username?: string }
 * Output: VerificationResponse with TrustScore + evidence
 *
 * Requires:  X-API-Key header
 * Rate limit: 30 req/min per IP
 */

import { NextRequest, NextResponse }    from 'next/server'
import { checkRateLimitRedis }          from '@/lib/cache/redis'
import {
  extractApiKey, resolveApiKey, recordApiUsage,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'
import { buildIdentityTrustScore }      from '@/lib/trust/score'
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
export const maxDuration = 30

// Common disposable email domains (basic stub list — Phase 3 will use a full API)
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com',
  'throwawaymail.com', 'yopmail.com', 'temp-mail.org', 'fakeinbox.com',
])

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey  = extractApiKey(req)
  if (!apiKey)  return missingKeyResponse()

  const resolved = await resolveApiKey(apiKey)
  if (!resolved.valid) return invalidOrExhaustedKeyResponse(apiKey)

  // ── Rate limit ────────────────────────────────────────────────────────────
  const allowed = await checkRateLimitRedis(`api:identity:${ip}`, 30, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 30 identity verification requests/minute per IP.' },
      { status: 429 },
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { email, username } = body as { email?: unknown; username?: unknown }

  if ((!email || typeof email !== 'string') && (!username || typeof username !== 'string'))
    return NextResponse.json({ error: 'At least one of "email" or "username" is required.' }, { status: 400 })

  if (email && typeof email === 'string' && !isValidEmailFormat(email))
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })

  // ── Register verification (hash email for privacy) ───────────────────────
  const emailHash = email && typeof email === 'string' ? await hashContent(email.toLowerCase()) : undefined

  const verificationId = await createVerification({
    userId:     resolved.owner,
    module:     'identity',
    entityType: email ? 'email' : 'username',
    entityRef:  typeof username === 'string' ? username : undefined,
    entityHash: emailHash,
    apiKeyHash: resolved.keyHash,
    metadata:   { has_email: !!email, has_username: !!username },
  })

  const scanId = verificationId ?? crypto.randomUUID()

  if (verificationId) {
    auditVerificationCreated({ actorId: resolved.owner, verificationId, module: 'identity', actorIp: ip })
  }

  // ── Email signals ─────────────────────────────────────────────────────────
  let emailValid        = false
  let emailDisposable    = false
  let emailDomain        = ''
  let emailDomainAgeDays: number | null = null

  if (email && typeof email === 'string') {
    emailValid = isValidEmailFormat(email)
    emailDomain = email.split('@')[1]?.toLowerCase() ?? ''
    emailDisposable = DISPOSABLE_DOMAINS.has(emailDomain)
  }

  // Deliverability check: stub — Phase 3 will use MX record lookup / verification API
  const emailDeliverable: boolean | null = emailValid ? null : false  // null = unknown, needs Phase 3

  const emailScore = emailDisposable ? 15 : emailValid ? 70 : 20

  // ── Social presence ───────────────────────────────────────────────────────
  // Stub — Phase 3 will query social platform APIs for username existence
  const socialProfilesFound = 0
  const socialScore = 50  // neutral until Phase 3

  // ── Digital footprint ─────────────────────────────────────────────────────
  const footprintScore = 50  // neutral until Phase 3

  // ── Synthetic identity risk ───────────────────────────────────────────────
  let syntheticIdRisk = 30  // baseline
  if (emailDisposable) syntheticIdRisk += 35
  if (!emailValid && email) syntheticIdRisk += 20
  syntheticIdRisk = Math.min(syntheticIdRisk, 95)

  // ── Build evidence ────────────────────────────────────────────────────────
  const evidence: EvidenceItem[] = []

  if (email && typeof email === 'string') {
    evidence.push({
      type:       'identity_signal',
      finding:    emailDisposable
        ? `Email uses a known disposable/temporary email domain (${emailDomain}). High fraud risk.`
        : emailValid
        ? `Email format is valid. Domain: ${emailDomain}.`
        : `Email format is invalid.`,
      confidence: 90,
      severity:   emailDisposable ? 'high' : emailValid ? 'none' : 'medium',
      details:    { email_domain: emailDomain, disposable: emailDisposable, format_valid: emailValid },
      source:     'email_analysis',
    })
  }

  evidence.push({
    type:       'identity_signal',
    finding:    'Social presence and digital footprint analysis require external API integration (Phase 3).',
    confidence: 35,
    severity:   'none',
    details:    { phase: 'stub', social_profiles_found: socialProfilesFound },
    source:     'internal',
  })

  // ── Build findings ────────────────────────────────────────────────────────
  const findings: Finding[] = []

  if (emailDisposable) {
    findings.push({
      severity:     'high',
      category:     'identity',
      message:      'Disposable email detected — high probability of synthetic or low-trust identity.',
      evidence_ref: 'evidence[0]',
    })
  }

  // ── Trust score ───────────────────────────────────────────────────────────
  const scores = buildIdentityTrustScore({
    emailScore,
    socialScore,
    footprintScore,
    syntheticIdRisk,
    evidence,
  })

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = generateRecommendations({
    trustOverall: scores.trust.overall,
    riskOverall:  scores.risk.overall,
    module:       'identity',
    flags: {
      disposableEmail: emailDisposable,
      noSocial:        socialProfilesFound === 0,
    },
  })

  const processingMs = Date.now() - startMs

  // ── Persist identity-specific record ──────────────────────────────────────
  if (verificationId) {
    try {
      const sb = getSupabaseAdmin()
      await sb.from('identity_verifications').insert({
        verification_id:   verificationId,
        email_hash:         emailHash,
        username_checked:   typeof username === 'string' ? username : null,
        email_valid:        email ? emailValid : null,
        email_deliverable:  emailDeliverable,
        email_disposable:   email ? emailDisposable : null,
        social_profiles_found: [],
        synthetic_id_risk:  syntheticIdRisk,
      })
    } catch { /* non-fatal */ }

    await completeVerification({ verificationId, scores, evidence, processingMs })
    auditVerificationCompleted({
      actorId:        resolved.owner,
      verificationId,
      module:         'identity',
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
    path:           '/api/v1/verify/identity',
    statusCode:     200,
    processingMs,
    verificationId: verificationId ?? undefined,
    module:         'identity',
  })

  // ── Respond ───────────────────────────────────────────────────────────────
  const response = buildVerificationResponse({
    scanId:          scanId,
    verificationId:  verificationId ?? scanId,
    tool:            'HumanVerify™',
    entityType:      email ? 'email' : 'username',
    scores,
    evidence,
    findings,
    recommendations,
    processingMs,
  })

  return NextResponse.json({
    ...response,
    email_valid:        email ? emailValid : null,
    email_deliverable:  emailDeliverable,
    social_profiles:    socialProfilesFound,
    synthetic_id_risk:  syntheticIdRisk,
  })
}
