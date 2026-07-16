// ════════════════════════════════════════════════════════════════════════════
// AISCERN — Integrity Seal Verification
// GET /api/verify/[hash]
//
// Looks up a site scan by its integrity-seal hash (stored on the `scans` row
// as metadata.integrity_hash — see the insert in app/api/detect/site/route.ts)
// and confirms whether it matches a scan on record. This is what a "Verified
// Human Content" badge on a site owner's page would link to.
// ════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { hash: string } }) {
  const hash = params.hash?.trim()
  if (!hash || !/^[0-9a-f]{16}$/i.test(hash)) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_HASH', message: 'Expected a 16-char hex integrity seal hash' } }, { status: 400 })
  }

  try {
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('scans')
      .select('id, file_name, verdict, confidence_score, created_at, metadata')
      .eq('metadata->>integrity_hash', hash)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ success: true, verified: false, message: 'No scan found matching this integrity seal.' })
    }

    return NextResponse.json({
      success: true,
      verified: true,
      origin:  data.file_name,
      verdict: data.verdict,
      aiContentPercent: Math.round((data.confidence_score ?? 0) * 1000) / 10,
      scannedAt: data.created_at,
      metadata: data.metadata,
    })
  } catch (err) {
    console.error('[verify/hash]', err)
    return NextResponse.json({ success: false, error: { code: 'LOOKUP_FAILED', message: 'Verification lookup failed' } }, { status: 500 })
  }
}
