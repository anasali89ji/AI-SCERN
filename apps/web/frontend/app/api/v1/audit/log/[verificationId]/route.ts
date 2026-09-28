/**
 * GET /api/v1/audit/log/:verificationId
 *
 * Returns the immutable, hash-chained audit trail for a given verification.
 * Used for explainability and compliance — anyone holding a verification_id
 * can prove what happened and when via the hash chain.
 *
 * Requires: X-API-Key header (or Clerk session for dashboard use)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  extractApiKey, resolveApiKey,
  missingKeyResponse, invalidOrExhaustedKeyResponse,
} from '@/lib/api-v1/auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { verifyAuditChain } from '@/lib/trust/audit'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ verificationId: string }> }
) {
  const { verificationId } = await params

  if (!verificationId || !/^[0-9a-f-]{36}$/i.test(verificationId)) {
    return NextResponse.json({ error: 'Invalid verification ID.' }, { status: 400 })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const apiKey = extractApiKey(req)
  if (!apiKey) return missingKeyResponse()

  const resolved = await resolveApiKey(apiKey)
  if (!resolved.valid) return invalidOrExhaustedKeyResponse(apiKey)

  const sb = getSupabaseAdmin()

  // ── Fetch the verification (ownership check) ──────────────────────────────
  const { data: verification, error: verErr } = await sb
    .from('verifications')
    .select('id, user_id, module, status, created_at, completed_at')
    .eq('id', verificationId)
    .maybeSingle()

  if (verErr || !verification) {
    return NextResponse.json({ error: 'Verification not found.' }, { status: 404 })
  }

  if (resolved.owner !== 'master' && verification.user_id !== resolved.owner) {
    return NextResponse.json({ error: 'Not authorized to view this audit log.' }, { status: 403 })
  }

  // ── Fetch related audit events ────────────────────────────────────────────
  const { data: events } = await sb
    .from('audit_log')
    .select('event_id, actor_id, event_type, event_category, resource_type, resource_id, after_state, event_hash, chain_sequence, occurred_at, recorded_at')
    .eq('resource_id', verificationId)
    .order('chain_sequence', { ascending: true })

  // ── Verify chain integrity for these events ───────────────────────────────
  let chainIntegrity: { valid: boolean; checkedCount: number } | null = null
  if (events && events.length > 0) {
    const sequences = events.map(e => e.chain_sequence)
    chainIntegrity = await verifyAuditChain({
      fromSequence: Math.min(...sequences),
      toSequence:   Math.max(...sequences),
    })
  }

  // ── Fetch trust score for context ─────────────────────────────────────────
  const { data: trustScore } = await sb
    .from('trust_scores')
    .select('trust_overall, risk_overall, confidence_overall, algorithm_version, created_at')
    .eq('verification_id', verificationId)
    .maybeSingle()

  return NextResponse.json({
    verification_id: verificationId,
    module:           verification.module,
    status:           verification.status,
    created_at:       verification.created_at,
    completed_at:     verification.completed_at,
    trust_score:      trustScore,
    audit_trail: (events ?? []).map(e => ({
      event_id:       e.event_id,
      event_type:     e.event_type,
      event_category: e.event_category,
      occurred_at:    e.occurred_at,
      recorded_at:    e.recorded_at,
      chain_sequence: e.chain_sequence,
      event_hash:     e.event_hash,
      summary:        e.after_state,
    })),
    chain_integrity:  chainIntegrity,
    api_version:      'v1',
  })
}
