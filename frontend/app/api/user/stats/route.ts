/**
 * /api/user/stats — real-time scan statistics for the dashboard.
 * Uses Clerk auth + admin client to bypass Supabase RLS.
 */
import { NextResponse }     from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseAdmin()

    // Try the RPC first (may or may not exist)
    const { data: rpcData, error: rpcErr } = await db.rpc('get_user_stats', { p_user_id: userId })

    if (!rpcErr && rpcData) {
      return NextResponse.json(rpcData)
    }

    // Fallback: compute stats directly from scans table
    const { data: scans } = await db
      .from('scans')
      .select('verdict, media_type, confidence_score')
      .eq('user_id', userId)
      .eq('status', 'complete')

    const rows = scans ?? []
    return NextResponse.json({
      total_scans:    rows.length,
      ai_detected:    rows.filter(r => r.verdict === 'AI').length,
      human_detected: rows.filter(r => r.verdict === 'HUMAN').length,
      uncertain:      rows.filter(r => r.verdict === 'UNCERTAIN').length,
      // Flat field names — consumed by dashboard/page.tsx and profile/page.tsx
      text_scans:  rows.filter(r => r.media_type === 'text').length,
      image_scans: rows.filter(r => r.media_type === 'image').length,
      audio_scans: rows.filter(r => r.media_type === 'audio').length,
      video_scans: rows.filter(r => r.media_type === 'video').length,
      avg_confidence: rows.length
        ? Math.round(rows.reduce((s, r) => s + (r.confidence_score ?? 0), 0) / rows.length * 100)
        : 0,
    })
  } catch (err) {
    console.error('[user/stats]', err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
