/**
 * GET /api/v2/forensic-scan/[scanId]
 *
 * Returns the full ForensicScanRecord from Supabase.
 * Returns status + partial layer data while the cascade is still running.
 * Frontend should poll this every 2s until status === 'completed' | 'failed'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import type { ForensicScanRecord }   from '@/types/forensic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
): Promise<NextResponse> {
  const { scanId } = await params

  if (!scanId || !/^[0-9a-f-]{36}$/.test(scanId)) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ID', message: 'Invalid scan ID' } },
      { status: 400 }
    )
  }

  try {
    const sb = getSupabaseAdmin()
    const { data, error } = await sb
      .from('forensic_scans')
      .select('*')
      .eq('id', scanId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Scan not found' } },
        { status: 404 }
      )
    }

    // Map snake_case DB columns → camelCase TypeScript record
    const record: ForensicScanRecord = {
      id:                    data.id,
      createdAt:             data.created_at,
      imageUrl:              data.image_url,
      r2Key:                 data.r2_key,
      status:                data.status,
      layers:                data.layers           ?? [],
      semanticAgents:        data.semantic_agents  ?? [],
      provenance:            data.provenance       ?? null,
      finalVerdict:          data.final_verdict    ?? null,
      existingEnsembleResult: data.existing_ensemble_result ?? undefined,
      processingTimeMs:      data.processing_time_ms ?? undefined,
    }

    return NextResponse.json({ success: true, scan: record })

  } catch (err) {
    console.error('[v2/forensic-scan GET]', err)
    return NextResponse.json(
      {
        success: false,
        error:   {
          code:    'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Unexpected error',
        },
      },
      { status: 500 }
    )
  }
}
