/**
 * Aiscern — Shared Public API (v1) Key Authentication
 *
 * Used by every `/api/v1/detect/*` route. Extracted from the original
 * `/api/v1/detect/text` implementation so image/audio (and future modality)
 * wrappers share identical, security-reviewed key-resolution logic instead
 * of re-implementing it (and potentially drifting/regressing the SHA-256
 * migration + timing-safe comparison fixes).
 */
import { NextRequest, NextResponse } from 'next/server'

// ── Secure SHA-256 hash for API key lookup (replaces insecure djb2) ──────────
export async function hashApiKey(key: string): Promise<string> {
  const encoder    = new TextEncoder()
  const data       = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray  = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Constant-time string comparison to prevent timing side-channel attacks ────
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  if (aBytes.length !== bBytes.length) return false
  let diff = 0
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i]
  return diff === 0
}

// ── Legacy djb2 hash — used ONLY for migration fallback lookup ────────────────
export function djb2Hash(key: string): string {
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h) ^ key.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, '0')
}

export type ResolvedApiKey =
  | { valid: false }
  | { valid: true; owner: string; keyHash: string }

// ── resolve & validate the incoming API key ───────────────────────────────────
// Dual-lookup strategy for zero-downtime migration from djb2 → SHA-256.
//  1. Try SHA-256 lookup first (newly created keys / already migrated rows)
//  2. Fall back to djb2 lookup (old rows not yet migrated)
//  3. On successful djb2 hit → asynchronously write sha256_hash + hash_version='sha256'
export async function resolveApiKey(apiKey: string): Promise<ResolvedApiKey> {
  const masterKey = process.env.API_MASTER_KEY
  if (masterKey && timingSafeEqual(apiKey, masterKey)) {
    return { valid: true, owner: 'master', keyHash: '' }
  }

  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const db      = getSupabaseAdmin()
    const sha256  = await hashApiKey(apiKey)
    const legacy  = djb2Hash(apiKey)

    // ── Pass 1: SHA-256 lookup (new keys and migrated rows) ──────────────────
    const { data: sha256Row } = await db
      .from('api_keys')
      .select('id, user_id, is_active, calls_today, daily_limit')
      .eq('sha256_hash', sha256)
      .eq('is_active', true)
      .maybeSingle()

    if (sha256Row) {
      if (sha256Row.daily_limit != null && sha256Row.calls_today >= sha256Row.daily_limit) {
        return { valid: false }
      }
      return { valid: true, owner: sha256Row.user_id, keyHash: sha256 }
    }

    // ── Pass 2: Legacy djb2 lookup (unmigrated rows) ─────────────────────────
    const { data: djb2Row } = await db
      .from('api_keys')
      .select('id, user_id, is_active, calls_today, daily_limit')
      .eq('key_hash', legacy)
      .eq('is_active', true)
      .maybeSingle()

    if (!djb2Row) return { valid: false }
    if (djb2Row.daily_limit != null && djb2Row.calls_today >= djb2Row.daily_limit) {
      return { valid: false }
    }

    // Auto-migrate: write SHA-256 hash asynchronously (fire-and-forget)
    void Promise.resolve(
      db.from('api_keys')
        .update({ sha256_hash: sha256, hash_version: 'sha256' })
        .eq('id', djb2Row.id)
    ).catch(() => { /* non-fatal — will retry on next call */ })

    return { valid: true, owner: djb2Row.user_id, keyHash: legacy }
  } catch {
    return { valid: false }
  }
}

// ── Extract API key from request headers (X-API-Key or Bearer) ────────────────
export function extractApiKey(req: NextRequest): string {
  return (
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  )
}

// ── Standard "missing key" / "invalid key" responses ──────────────────────────
export function missingKeyResponse(): NextResponse {
  return NextResponse.json(
    { error: 'X-API-Key header required. Get your key at aiscern.com/docs/api', docs: '/docs/api' },
    { status: 401 },
  )
}

export async function invalidOrExhaustedKeyResponse(apiKey: string): Promise<NextResponse> {
  // Distinguish quota-exceeded from invalid key by re-checking quota
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const { data } = await getSupabaseAdmin()
      .from('api_keys')
      .select('calls_today, daily_limit')
      .eq('key_hash', await hashApiKey(apiKey))
      .eq('is_active', true)
      .single()
    if (data && data.daily_limit != null && data.calls_today >= data.daily_limit) {
      return NextResponse.json(
        { error: `Daily API limit reached (${data.daily_limit} calls/day). Resets at midnight UTC.` },
        { status: 429 },
      )
    }
  } catch { /* table may not exist */ }

  return NextResponse.json(
    { error: 'Invalid or inactive API key. Get your key at aiscern.com/docs/api', docs: '/docs/api' },
    { status: 401 },
  )
}

// ── Record usage (fire-and-forget, non-fatal, skipped for master key) ─────────
export function recordApiUsage(resolved: { owner: string; keyHash: string }): void {
  if (resolved.owner === 'master' || !resolved.keyHash) return
  void (async () => {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const sb = getSupabaseAdmin()
      await sb
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', resolved.keyHash)
      const { error: rpcErr } = await sb.rpc('increment_api_calls', { key_hash_input: resolved.keyHash })
      if (rpcErr) {
        // RPC not yet created — safe fallback via select + update
        const { data: kd } = await sb.from('api_keys').select('calls_today').eq('key_hash', resolved.keyHash).single()
        if (kd) await sb.from('api_keys').update({ calls_today: (kd.calls_today ?? 0) + 1 }).eq('key_hash', resolved.keyHash)
      }
    } catch { /* non-fatal */ }
  })()
}
