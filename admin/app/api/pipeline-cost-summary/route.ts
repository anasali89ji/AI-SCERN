import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

/**
 * MODULE 6 — Cost & Call-Volume Instrumentation.
 * Reads vendor_call_log (written via increment_vendor_call() RPC, fired
 * from frontend/lib/inference/hf-analyze.ts and vendor-call-tracker.ts at
 * each paid-vendor call site) and rolls it up into:
 *   - per-vendor-per-modality totals for the requested window
 *   - a daily time series for charting
 *   - a per-modality "zero-paid-call rate" using scans/verifications
 *     counts as the denominator, so Module 6's own acceptance criterion —
 *     "what % of detections this week used zero paid API calls" — is
 *     answerable directly from this endpoint.
 */

const MODALITIES = ['text', 'image', 'audio', 'video'] as const
const VENDORS     = ['gemini', 'nvidia_nim', 'huggingface'] as const

interface VendorCallRow {
  day: string
  vendor: string
  modality: string
  call_count: number
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 7))
  const db = getAdminDb()

  const sinceDate = new Date()
  sinceDate.setUTCDate(sinceDate.getUTCDate() - days)
  const sinceStr = sinceDate.toISOString().slice(0, 10)

  const { data: rows, error } = await db
    .from('vendor_call_log')
    .select('day, vendor, modality, call_count')
    .gte('day', sinceStr)
    .order('day', { ascending: true })

  if (error) {
    return NextResponse.json({ error: `Failed to read vendor_call_log: ${error.message}` }, { status: 500 })
  }

  const typedRows = (rows ?? []) as VendorCallRow[]

  // Totals per vendor x modality over the window
  const totals: Record<string, Record<string, number>> = {}
  for (const v of VENDORS) totals[v] = Object.fromEntries(MODALITIES.map(m => [m, 0]))
  for (const row of typedRows) {
    if (!totals[row.vendor]) continue
    totals[row.vendor][row.modality] = (totals[row.vendor][row.modality] ?? 0) + row.call_count
  }

  // Daily time series, one point per day per vendor (summed across modalities)
  const byDay: Record<string, Record<string, number>> = {}
  for (const row of typedRows) {
    byDay[row.day] ??= Object.fromEntries(VENDORS.map(v => [v, 0]))
    byDay[row.day][row.vendor] = (byDay[row.day][row.vendor] ?? 0) + row.call_count
  }
  const daily = Object.entries(byDay)
    .map(([day, counts]) => ({ day, ...counts }))
    .sort((a, b) => a.day.localeCompare(b.day))

  // Detection volume per modality over the same window, for the
  // zero-paid-call-rate denominator (task 6 acceptance criterion).
  // scans.media_type is the modality column (verified against live schema —
  // NOT "type", which doesn't exist on this table).
  let scanCountsByModality: Record<string, number> = {}
  try {
    const { data: scanRows } = await db
      .from('scans')
      .select('media_type')
      .gte('created_at', sinceDate.toISOString())
    scanCountsByModality = (scanRows ?? []).reduce((acc: Record<string, number>, r: { media_type: string }) => {
      acc[r.media_type] = (acc[r.media_type] ?? 0) + 1
      return acc
    }, {})
  } catch {
    // RLS or shape mismatch — degrade gracefully, zero-call-rate just
    // won't be computable, totals/daily still are.
  }

  // MODULE 6 task 3: weekly checkpoint — flag any modality where the paid
  // fallback rate (vendor calls / total detections, approximated since one
  // detection can trigger multiple vendor calls) exceeds 40%. This is a
  // signal to revisit calibration (Module 4 pattern), not a hard alert.
  const fallbackFlags = MODALITIES.map(modality => {
    const paidCalls = VENDORS.reduce((sum, v) => sum + (totals[v][modality] ?? 0), 0)
    const detections = scanCountsByModality[modality] ?? 0
    const rate = detections > 0 ? paidCalls / detections : null
    return {
      modality,
      paid_calls: paidCalls,
      detections,
      paid_call_rate: rate,
      flagged: rate !== null && rate > 0.40,
    }
  })

  return NextResponse.json({
    window_days: days,
    since: sinceStr,
    totals,
    daily,
    fallback_flags: fallbackFlags,
    generated_at: new Date().toISOString(),
  })
}
