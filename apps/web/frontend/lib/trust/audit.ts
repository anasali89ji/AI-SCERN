/**
 * Aiscern Trust Platform — Audit Logger
 *
 * Wraps the Supabase audit_log table (v21 migration).
 * All API routes and background workers must call this for every
 * verification lifecycle event.
 *
 * Design: fire-and-forget in API routes (non-blocking), awaited in
 * Inngest workers where we need the chain sequence for correlation.
 */

import type { AuditEventInput, AuditEventResult } from './types'

// ── Append an audit event (async, non-fatal in production) ───────────────────

export async function appendAuditEvent(
  input: AuditEventInput
): Promise<AuditEventResult | null> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const sb = getSupabaseAdmin()

    const { data, error } = await sb.rpc('append_audit_event', {
      p_actor_id:       input.actorId,
      p_event_type:     input.eventType,
      p_event_category: input.eventCategory,
      p_resource_type:  input.resourceType ?? null,
      p_resource_id:    input.resourceId   ?? null,
      p_before_state:   input.beforeState  ?? null,
      p_after_state:    input.afterState   ?? null,
      p_metadata:       input.metadata     ?? {},
      p_occurred_at:    new Date().toISOString(),
      p_actor_ip:       input.actorIp      ?? null,
      p_chain_id:       input.chainId      ?? 'global',
    })

    if (error) {
      console.warn('[audit] append_audit_event failed:', error.message)
      return null
    }

    // RPC returns setof — unwrap first row
    const row = Array.isArray(data) ? data[0] : data
    return row as AuditEventResult
  } catch (err) {
    console.warn('[audit] unexpected error:', err instanceof Error ? err.message : err)
    return null
  }
}

// ── Fire-and-forget wrapper (for API routes — don't block response) ───────────

export function auditAsync(input: AuditEventInput): void {
  void appendAuditEvent(input).catch(() => { /* non-fatal */ })
}

// ── Standard event builders ───────────────────────────────────────────────────

export function auditVerificationCreated(params: {
  actorId:        string
  verificationId: string
  module:         string
  actorIp?:       string
}): void {
  auditAsync({
    actorId:       params.actorId,
    eventType:     'verification.created',
    eventCategory: 'verification',
    resourceType:  'verification',
    resourceId:    params.verificationId,
    afterState:    { module: params.module },
    actorIp:       params.actorIp,
  })
}

export function auditVerificationCompleted(params: {
  actorId:        string
  verificationId: string
  module:         string
  trustOverall:   number
  riskOverall:    number
  actorIp?:       string
}): void {
  auditAsync({
    actorId:       params.actorId,
    eventType:     'verification.completed',
    eventCategory: 'verification',
    resourceType:  'verification',
    resourceId:    params.verificationId,
    afterState:    {
      module:       params.module,
      trust_overall: params.trustOverall,
      risk_overall:  params.riskOverall,
    },
    actorIp:       params.actorIp,
  })
}

export function auditApiCall(params: {
  actorId:        string
  path:           string
  statusCode:     number
  processingMs:   number
  module?:        string
  verificationId?: string
  actorIp?:       string
  apiKeyHash?:    string
}): void {
  auditAsync({
    actorId:       params.actorId,
    eventType:     'api.call',
    eventCategory: 'api',
    resourceType:  params.module ? 'verification' : undefined,
    resourceId:    params.verificationId,
    afterState:    {
      path:           params.path,
      status_code:    params.statusCode,
      processing_ms:  params.processingMs,
      module:         params.module,
      api_key_hash:   params.apiKeyHash,
    },
    actorIp:       params.actorIp,
  })
}

export function auditReportGenerated(params: {
  actorId:        string
  verificationId: string
  reportId:       string
  format:         string
}): void {
  auditAsync({
    actorId:       params.actorId,
    eventType:     'report.generated',
    eventCategory: 'verification',
    resourceType:  'report',
    resourceId:    params.reportId,
    afterState:    {
      verification_id: params.verificationId,
      format:          params.format,
    },
  })
}

export function auditReportDownloaded(params: {
  actorId:  string
  reportId: string
  actorIp?: string
}): void {
  auditAsync({
    actorId:       params.actorId,
    eventType:     'report.downloaded',
    eventCategory: 'verification',
    resourceType:  'report',
    resourceId:    params.reportId,
    actorIp:       params.actorIp,
  })
}

// ── Chain verification (for integrity checks) ─────────────────────────────────

export async function verifyAuditChain(params: {
  chainId?:      string
  fromSequence?: number
  toSequence?:   number
}): Promise<{
  valid:        boolean
  checkedCount: number
  firstBrokenSequence?: number
  error?:       string
}> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const sb = getSupabaseAdmin()

    const { data, error } = await sb.rpc('verify_audit_chain', {
      p_chain_id:      params.chainId      ?? 'global',
      p_from_sequence: params.fromSequence ?? 1,
      p_to_sequence:   params.toSequence   ?? null,
    })

    if (error) return { valid: false, checkedCount: 0, error: error.message }

    const result = data as {
      valid: boolean
      checked_count: number
      first_broken_sequence?: number
    }

    return {
      valid:                  result.valid,
      checkedCount:           result.checked_count,
      firstBrokenSequence:    result.first_broken_sequence,
    }
  } catch (err) {
    return {
      valid:        false,
      checkedCount: 0,
      error:        err instanceof Error ? err.message : 'unknown',
    }
  }
}

// ── Log API access (non-blocking) ─────────────────────────────────────────────

export function logApiAccess(params: {
  apiKeyHash?:    string
  userId?:        string
  actorIp?:       string
  method:         string
  path:           string
  statusCode:     number
  processingMs:   number
  requestSize?:   number
  responseSize?:  number
  verificationId?: string
  module?:        string
}): void {
  void (async () => {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()

      await sb.from('api_access_log').insert({
        api_key_hash:    params.apiKeyHash,
        user_id:         params.userId,
        actor_ip:        params.actorIp,
        method:          params.method,
        path:            params.path,
        status_code:     params.statusCode,
        processing_ms:   params.processingMs,
        request_size:    params.requestSize,
        response_size:   params.responseSize,
        verification_id: params.verificationId,
        module:          params.module,
        api_version:     'v1',
      })
    } catch { /* non-fatal */ }
  })()
}
