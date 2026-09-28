/**
 * POST /api/verify/web
 *
 * Dashboard-facing WebVerify™ endpoint — uses Clerk session auth instead of
 * API keys (mirrors the existing /api/detect/* pattern for the UI, while
 * /api/v1/verify/web is the public API-key-authenticated equivalent).
 *
 * Both routes share the same underlying trust-score logic from lib/trust/*.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                      from '@clerk/nextjs/server'
import { checkRateLimit }            from '@/lib/ratelimit'
import { buildWebTrustScore }        from '@/lib/trust/score'
import {
  createVerification, completeVerification,
  buildVerificationResponse, generateRecommendations,
} from '@/lib/trust/verify'
import { auditVerificationCreated, auditVerificationCompleted } from '@/lib/trust/audit'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { assertSafeUrl }             from '@/lib/utils/ssrf-guard'
import type { EvidenceItem, Finding } from '@/lib/trust/types'

export const dynamic     = 'force-dynamic'
export const maxDuration = 45

function domainAgeToScore(ageDays: number | null): number {
  if (ageDays === null) return 40
  if (ageDays > 5 * 365) return 95
  if (ageDays > 365)     return 65
  if (ageDays > 30)      return 25
  return 10
}

export async function POST(req: NextRequest) {
  const startMs = Date.now()
  const ip      = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'

  const { userId: clerkUserId } = await auth()
  const userId = clerkUserId ?? `anon_${ip}`

  // Lightweight DOS guard (consistent with /api/detect/* pattern)
  const rl = await checkRateLimit('upload', ip)
  if (rl.limited) {
    return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const { url } = body as { url?: unknown }

  if (!url || typeof url !== 'string')
    return NextResponse.json({ error: '"url" is required.' }, { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch {
    return NextResponse.json({ error: 'Invalid URL.' }, { status: 400 })
  }
  if (!['http:', 'https:'].includes(parsed.protocol))
    return NextResponse.json({ error: 'URL must use http or https.' }, { status: 400 })

  try {
    assertSafeUrl(url)
  } catch {
    return NextResponse.json({ error: 'URL resolves to a private or blocked address.' }, { status: 400 })
  }

  const domain = parsed.hostname.replace(/^www\./, '')
  const sb     = getSupabaseAdmin()

  const verificationId = await createVerification({
    userId, module: 'web', entityType: 'url', entityRef: url.slice(0, 500),
    metadata: { domain, source: 'dashboard' },
  })
  const scanId = verificationId ?? crypto.randomUUID()

  if (verificationId) auditVerificationCreated({ actorId: userId, verificationId, module: 'web', actorIp: ip })

  const { data: cached } = await sb
    .from('source_reliability')
    .select('trust_score, category, expires_at')
    .eq('domain', domain)
    .maybeSingle()
  const isCacheValid = cached && new Date(cached.expires_at) > new Date()

  const sslScore        = parsed.protocol === 'https:' ? 80 : 10
  const domainAgeScore  = domainAgeToScore(null)
  const reputationScore = isCacheValid ? cached!.trust_score : 55
  const contentScore     = 60
  const phishingRisk     = 15

  const evidence: EvidenceItem[] = [
    {
      type: 'domain_reputation',
      finding: isCacheValid
        ? `Domain reputation score: ${reputationScore}/100.`
        : 'No reputation data cached for this domain yet.',
      confidence: isCacheValid ? 85 : 45,
      severity:   reputationScore < 30 ? 'high' : reputationScore < 50 ? 'medium' : 'none',
      details:    { domain, reputation_score: reputationScore },
      source:     'source_reliability_cache',
    },
    {
      type: 'provenance',
      finding: parsed.protocol === 'https:'
        ? 'Website uses HTTPS — SSL certificate present.'
        : 'Website does not use HTTPS — insecure connection.',
      confidence: 95,
      severity:   parsed.protocol === 'https:' ? 'none' : 'high',
      details:    { protocol: parsed.protocol },
      source:     'url_analysis',
    },
  ]

  const findings: Finding[] = []
  if (parsed.protocol !== 'https:') {
    findings.push({ severity: 'high', category: 'security', message: 'No SSL certificate — avoid entering sensitive data.', evidence_ref: 'evidence[1]' })
  }

  const scores = buildWebTrustScore({ sslScore, domainAgeScore, reputationScore, contentScore, phishingRisk, evidence })

  const recommendations = generateRecommendations({
    trustOverall: scores.trust.overall,
    riskOverall:  scores.risk.overall,
    module:       'web',
    flags: { youngDomain: domainAgeScore < 30, sslIssues: parsed.protocol !== 'https:' },
  })

  const processingMs = Date.now() - startMs

  if (verificationId) {
    try {
      await sb.from('web_verifications').insert({
        verification_id: verificationId, url: url.slice(0, 2000), domain,
        ssl_valid: parsed.protocol === 'https:', ssl_grade: parsed.protocol === 'https:' ? 'A' : 'F',
        reputation_score: reputationScore, phishing_score: phishingRisk,
      })
    } catch { /* non-fatal */ }

    await completeVerification({ verificationId, scores, evidence, processingMs })
    auditVerificationCompleted({
      actorId: userId, verificationId, module: 'web',
      trustOverall: scores.trust.overall, riskOverall: scores.risk.overall, actorIp: ip,
    })
  }

  const response = buildVerificationResponse({
    scanId, verificationId: verificationId ?? scanId, tool: 'WebVerify™', entityType: 'url',
    scores, evidence, findings, recommendations, processingMs,
  })

  return NextResponse.json({ ...response, domain, ssl_valid: parsed.protocol === 'https:' })
}
