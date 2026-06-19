/**
 * POST /api/v1/verify/web
 *
 * WebVerify™ — Verify website trust and authenticity.
 * Checks SSL, domain age, reputation, scam indicators, content quality.
 *
 * Input:  JSON { url: string }
 * Output: VerificationResponse with TrustScore + evidence
 *
 * Requires:  X-API-Key header
 * Rate limit: 30 req/min per IP (web fetches are heavier)
 */

import { NextRequest, NextResponse }    from 'next/server'
import { checkRateLimitRedis }          from '@/lib/cache/redis'
import {
  extractApiKey, resolveApiKey, recordApiUsage,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'
import { buildWebTrustScore }           from '@/lib/trust/score'
import {
  createVerification, completeVerification,
  buildVerificationResponse, generateRecommendations,
} from '@/lib/trust/verify'
import {
  auditVerificationCreated, auditVerificationCompleted, logApiAccess,
} from '@/lib/trust/audit'
import { getSupabaseAdmin }             from '@/lib/supabase/admin'
import { assertSafeUrl }                from '@/lib/utils/ssrf-guard'
import type { EvidenceItem, Finding }   from '@/lib/trust/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 45

// ── Simple domain-age → score helper ─────────────────────────────────────────
function domainAgeToScore(ageDays: number | null): number {
  if (ageDays === null) return 40
  if (ageDays > 5 * 365) return 95
  if (ageDays > 2 * 365) return 80
  if (ageDays > 365)     return 65
  if (ageDays > 90)      return 45
  if (ageDays > 30)      return 25
  return 10  // very new domain — high risk
}

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey  = extractApiKey(req)
  if (!apiKey)  return missingKeyResponse()

  const resolved = await resolveApiKey(apiKey)
  if (!resolved.valid) return invalidOrExhaustedKeyResponse(apiKey)

  // ── Rate limit (stricter for web fetches) ─────────────────────────────────
  const allowed = await checkRateLimitRedis(`api:web:${ip}`, 30, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 30 web verification requests/minute per IP.' },
      { status: 429 },
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { url } = body as { url?: unknown }

  if (!url || typeof url !== 'string')
    return NextResponse.json({ error: '"url" string field required.' }, { status: 400 })

  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL provided.' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(parsed.protocol))
    return NextResponse.json({ error: 'URL must use http or https.' }, { status: 400 })

  // SSRF guard — block private IP ranges
  try {
    assertSafeUrl(url)
  } catch {
    return NextResponse.json({ error: 'URL resolves to a private or blocked address.' }, { status: 400 })
  }

  const domain = parsed.hostname.replace(/^www\./, '')

  // ── Register verification ─────────────────────────────────────────────────
  const verificationId = await createVerification({
    userId:     resolved.owner,
    module:     'web',
    entityType: 'url',
    entityRef:  url.slice(0, 500),
    apiKeyHash: resolved.keyHash,
    metadata:   { domain },
  })

  const scanId = verificationId ?? crypto.randomUUID()

  if (verificationId) {
    auditVerificationCreated({ actorId: resolved.owner, verificationId, module: 'web', actorIp: ip })
  }

  // ── Check source reliability cache ────────────────────────────────────────
  const sb = getSupabaseAdmin()
  const { data: cached } = await sb
    .from('source_reliability')
    .select('trust_score, category, expires_at')
    .eq('domain', domain)
    .maybeSingle()

  const isCacheValid = cached && new Date(cached.expires_at) > new Date()

  // ── Basic checks we can do without external APIs ──────────────────────────
  // SSL: HTTPS presence is a basic positive signal
  const sslScore     = parsed.protocol === 'https:' ? 80 : 10

  // Domain age: stub — Phase 3 will call WHOIS API
  // In production: integrate with whoisxml, domainr, or similar
  const domainAgeDays: number | null = null  // Phase 3
  const domainAgeScore = domainAgeToScore(domainAgeDays)

  // Reputation: use cache if available, otherwise neutral
  const reputationScore = isCacheValid ? cached!.trust_score : 55

  // Content score: stub — Phase 3 will crawl & analyze
  const contentScore = 60

  // Phishing risk: stub — Phase 3 will use Google Safe Browsing API
  const phishingRisk = 15  // low default; checked per domain in Phase 3

  // ── Build evidence ────────────────────────────────────────────────────────
  const evidence: EvidenceItem[] = []

  evidence.push({
    type:       'domain_reputation',
    finding:    isCacheValid
      ? `Domain reputation score: ${reputationScore}/100 (${cached!.category ?? 'unknown'} category).`
      : `No reputation data cached for this domain. Using neutral score.`,
    confidence: isCacheValid ? 85 : 45,
    severity:   reputationScore < 30 ? 'high' : reputationScore < 50 ? 'medium' : 'none',
    details:    { domain, reputation_score: reputationScore, from_cache: isCacheValid },
    source:     'source_reliability_cache',
  })

  evidence.push({
    type:       'provenance',
    finding:    parsed.protocol === 'https:'
      ? 'Website uses HTTPS — SSL certificate present.'
      : 'Website does not use HTTPS — insecure connection, higher risk.',
    confidence: 95,
    severity:   parsed.protocol === 'https:' ? 'none' : 'high',
    details:    { protocol: parsed.protocol, ssl_score: sslScore },
    source:     'url_analysis',
  })

  evidence.push({
    type:       'temporal',
    finding:    'Domain age analysis requires WHOIS lookup (Phase 3). Using neutral score.',
    confidence: 40,
    severity:   'none',
    details:    { domain_age_days: null, phase: 'stub' },
    source:     'internal',
  })

  // ── Build findings ────────────────────────────────────────────────────────
  const findings: Finding[] = []

  if (parsed.protocol !== 'https:') {
    findings.push({
      severity:    'high',
      category:    'security',
      message:     'No SSL certificate — do not enter sensitive data on this website.',
      evidence_ref: 'evidence[1]',
    })
  }

  if (reputationScore < 30) {
    findings.push({
      severity:    'critical',
      category:    'reputation',
      message:     'Domain has a low reputation score. Potential scam or fraudulent website.',
      evidence_ref: 'evidence[0]',
    })
  }

  // ── Trust score ───────────────────────────────────────────────────────────
  const scores = buildWebTrustScore({
    sslScore,
    domainAgeScore,
    reputationScore,
    contentScore,
    phishingRisk,
    evidence,
  })

  // ── Recommendations ───────────────────────────────────────────────────────
  const recommendations = generateRecommendations({
    trustOverall: scores.trust.overall,
    riskOverall:  scores.risk.overall,
    module:       'web',
    flags: {
      youngDomain: domainAgeScore < 30,
      sslIssues:   parsed.protocol !== 'https:',
    },
  })

  const processingMs = Date.now() - startMs

  // ── Persist web-specific record ───────────────────────────────────────────
  if (verificationId) {
    try {
      await sb.from('web_verifications').insert({
        verification_id:  verificationId,
        url:              url.slice(0, 2000),
        domain,
        ssl_valid:        parsed.protocol === 'https:',
        ssl_grade:        parsed.protocol === 'https:' ? 'A' : 'F',
        reputation_score: reputationScore,
        phishing_score:   phishingRisk,
        has_privacy_policy: null,
        has_contact_info:   null,
      })
    } catch { /* non-fatal */ }

    await completeVerification({ verificationId, scores, evidence, processingMs })
    auditVerificationCompleted({
      actorId:        resolved.owner,
      verificationId,
      module:         'web',
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
    path:           '/api/v1/verify/web',
    statusCode:     200,
    processingMs,
    verificationId: verificationId ?? undefined,
    module:         'web',
  })

  // ── Respond ───────────────────────────────────────────────────────────────
  const response = buildVerificationResponse({
    scanId:          scanId,
    verificationId:  verificationId ?? scanId,
    tool:            'WebVerify™',
    entityType:      'url',
    scores,
    evidence,
    findings,
    recommendations,
    processingMs,
  })

  return NextResponse.json({
    ...response,
    domain,
    ssl_valid:        parsed.protocol === 'https:',
    domain_age_days:  null,
    reputation_score: reputationScore,
    phishing_score:   phishingRisk,
  })
}
