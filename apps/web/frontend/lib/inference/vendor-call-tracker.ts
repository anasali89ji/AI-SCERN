/**
 * MODULE 6 — Cost & Call-Volume Instrumentation.
 *
 * Lightweight, fire-and-forget counters for paid-vendor API calls
 * (Gemini, NVIDIA NIM, HF Inference API), broken down by modality. Feeds
 * vendor_call_log via the increment_vendor_call() Supabase RPC
 * (supabase/migrations/v22_vendor_call_instrumentation.sql).
 *
 * This exists so the cost/call-volume reduction from Modules 1-4
 * (self-hosted-first) is provable with a real number — "what % of
 * detections this week used zero paid API calls" — instead of assumed.
 *
 * CRITICAL: this must never block or fail a detection request. Every call
 * site is `.catch()`-swallowed and fired without awaiting the result.
 */
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type VendorCallVendor   = 'gemini' | 'nvidia_nim' | 'huggingface'
export type VendorCallModality = 'text' | 'image' | 'audio' | 'video'

/**
 * Fire-and-forget increment. Call this at the point a paid-vendor network
 * call is actually attempted (not merely considered) — i.e. right where
 * the fetch/SDK call fires, regardless of whether it later succeeds or
 * fails. A failed call still cost a request against the vendor's quota in
 * most cases, and that's the thing Module 6 is trying to measure.
 *
 * Intentionally NOT awaited by callers — this must add zero latency to the
 * detection path. Any Supabase error here is logged, never thrown.
 */
export function trackVendorCall(vendor: VendorCallVendor, modality: VendorCallModality, count = 1): void {
  try {
    getSupabaseAdmin()
      .rpc('increment_vendor_call', { p_vendor: vendor, p_modality: modality, p_by: count })
      .then(
        ({ error }: { error: unknown }) => {
          if (error) {
            // Loud, not silent — same rationale as the CV-worker/Gemini
            // failure logging elsewhere in hf-analyze.ts. This is
            // instrumentation, not user-facing, so it never throws — but a
            // silently-broken counter is exactly the kind of thing Module 6
            // exists to prevent happening to OTHER signals.
            console.error('[vendor-call-tracker] increment_vendor_call failed:', error)
          }
        },
        (err: unknown) => {
          console.error('[vendor-call-tracker] increment_vendor_call threw:', err instanceof Error ? err.message : err)
        },
      )
  } catch (err) {
    // getSupabaseAdmin() itself throws if env vars are missing — catch that
    // too, since a missing-credentials misconfiguration must never take
    // down a detection request.
    console.error('[vendor-call-tracker] tracker unavailable:', err instanceof Error ? err.message : err)
  }
}
