import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isValidSealFormat, verifySealChecksum } from '@/lib/seal/issue'

export const dynamic = 'force-dynamic'

/**
 * GET /api/verify/seal/[sealNumber]
 *
 * Module 5.4: Real seal verification (replaces the stub that returned
 * valid:true for ANY string ≥8 chars).
 *
 * Flow:
 *   1. Validate format (regex)
 *   2. Verify checksum (HMAC — catches typos without hitting DB)
 *   3. Look up in scan_seals (text/image/audio/video/pdf scans)
 *   4. Look up in site_scan_seals (web scanner scans)
 *   5. Return verified/not_found/revoked/expired
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sealNumber: string }> }
) {
  const { sealNumber } = await params

  // 1. Validate format
  if (!sealNumber || !isValidSealFormat(sealNumber)) {
    return NextResponse.json({
      verified: false,
      error: 'INVALID_FORMAT',
      message: 'Seal number must be in format ASC-XXXXXXXX-XX (e.g. ASC-7K3X9P2Q-4F)',
    }, { status: 400 })
  }

  // 2. Verify checksum (catches typos without hitting DB)
  if (!verifySealChecksum(sealNumber)) {
    return NextResponse.json({
      verified: false,
      error: 'INVALID_CHECKSUM',
      message: 'Seal number checksum mismatch — possible typo or tampering attempt',
    }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // 3. Look up in scan_seals (text/image/audio/video/pdf scans)
  const { data: scanSeal, error: scanSealError } = await supabase
    .from('scan_seals')
    .select(`
      seal_number,
      issued_at,
      expires_at,
      revoked_at,
      revoke_reason,
      signature,
      payload_hash,
      scan_id
    `)
    .eq('seal_number', sealNumber)
    .maybeSingle()

  if (scanSeal && !scanSealError) {
    // Check revocation
    if (scanSeal.revoked_at) {
      return NextResponse.json({
        verified: false,
        seal_number: sealNumber,
        revoked: true,
        revoked_at: scanSeal.revoked_at,
        revoke_reason: scanSeal.revoke_reason,
      })
    }
    // Check expiry
    if (scanSeal.expires_at && new Date(scanSeal.expires_at) < new Date()) {
      return NextResponse.json({
        verified: false,
        seal_number: sealNumber,
        expired: true,
        expired_at: scanSeal.expires_at,
      })
    }

    // Fetch the scan details
    const { data: scan } = await supabase
      .from('scans')
      .select('id, verdict, confidence_score, media_type, content_preview, file_name, created_at')
      .eq('id', scanSeal.scan_id)
      .maybeSingle()

    return NextResponse.json({
      verified: true,
      seal_number: sealNumber,
      issued_at: scanSeal.issued_at,
      scan: scan ? {
        id: scan.id,
        verdict: scan.verdict,
        confidence: scan.confidence_score,
        media_type: scan.media_type,
        content_preview: scan.content_preview?.slice(0, 200),
        file_name: scan.file_name,
        scanned_at: scan.created_at,
      } : null,
      signature: scanSeal.signature,
      payload_hash: scanSeal.payload_hash,
    })
  }

  // 4. Look up in site_scan_seals (web scanner scans)
  const { data: siteSeal, error: siteSealError } = await supabase
    .from('site_scan_seals')
    .select(`
      hash,
      seal_number,
      signature,
      payload_hash,
      issued_at,
      origin,
      report_summary
    `)
    .eq('seal_number', sealNumber)
    .maybeSingle()

  if (siteSeal && !siteSealError) {
    return NextResponse.json({
      verified: true,
      seal_number: sealNumber,
      issued_at: siteSeal.issued_at,
      site_scan: {
        origin: siteSeal.origin,
        report_summary: siteSeal.report_summary,
      },
      signature: siteSeal.signature,
      payload_hash: siteSeal.payload_hash,
    })
  }

  // 5. Not found anywhere
  return NextResponse.json({
    verified: false,
    seal_number: sealNumber,
    error: 'NOT_FOUND',
    message: 'No scan found with this seal number. It may have been revoked or never issued.',
  }, { status: 404 })
}
