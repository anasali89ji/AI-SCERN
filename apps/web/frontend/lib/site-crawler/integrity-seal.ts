// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Content Integrity Seal
// Generates a SHA-256 hash of a scan report + timestamp so a site owner can
// embed a "Verified Human Content — 92%" badge that links to a live
// verification page. The report itself is persisted (Supabase, best-effort)
// keyed by hash so /api/verify/site/[hash] can recompute + confirm it later.
// ════════════════════════════════════════════════════════════════════════════

import { createHash } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export interface IntegritySeal {
  hash:            string
  verificationUrl: string
  issuedAt:        string
}

function canonicalize(obj: unknown): string {
  // Stable stringify: sorts object keys recursively so the hash is
  // deterministic regardless of property insertion order.
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort)
    if (v && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>).sort().reduce((acc, k) => {
        acc[k] = sort((v as Record<string, unknown>)[k])
        return acc
      }, {} as Record<string, unknown>)
    }
    return v
  }
  return JSON.stringify(sort(obj))
}

export async function issueIntegritySeal(
  origin: string,
  reportSummary: Record<string, unknown>,
  baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aiscern.com',
): Promise<IntegritySeal> {
  const issuedAt = new Date().toISOString()
  const payload  = canonicalize({ origin, issuedAt, ...reportSummary })
  const hash     = createHash('sha256').update(payload).digest('hex')

  // Best-effort persistence — verification still works even if this table
  // doesn't exist yet in a given environment (e.g. before a migration ships);
  // the route degrades to "hash format is valid but no stored report found".
  try {
    await getSupabaseAdmin().from('site_scan_seals').upsert({
      hash,
      origin,
      issued_at: issuedAt,
      report_summary: reportSummary,
    }, { onConflict: 'hash' })
  } catch { /* table may not exist yet — non-fatal, seal is still returned */ }

  return { hash, verificationUrl: `${baseUrl}/verify/site/${hash}`, issuedAt }
}

export async function lookupIntegritySeal(hash: string) {
  try {
    const { data, error } = await getSupabaseAdmin().from('site_scan_seals').select('*').eq('hash', hash).single()
    if (error || !data) return null
    return data
  } catch {
    return null
  }
}
