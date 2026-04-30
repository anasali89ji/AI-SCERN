/**
 * /api/user/scans — server-side scan history for authenticated users.
 *
 * Uses Clerk auth() + Supabase admin client (service role) to bypass RLS.
 * The anon client can't read scans because RLS checks auth.uid() which is
 * null when Clerk is used for auth instead of Supabase auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ data: [], total: 0 }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const limit    = Math.min(parseInt(searchParams.get('limit')    ?? '200'), 500)
    const offset   = parseInt(searchParams.get('offset')  ?? '0')
    const media    = searchParams.get('media')   ?? 'all'   // image|text|audio|video|all
    const verdict  = searchParams.get('verdict') ?? 'all'   // AI|HUMAN|UNCERTAIN|all
    const sort     = searchParams.get('sort')    ?? 'newest' // newest|oldest|confidence

    const db = getSupabaseAdmin()

    let query = db
      .from('scans')
      .select('id,media_type,verdict,confidence_score,created_at,file_name,file_size,content_preview,model_used,processing_time,signals', { count: 'exact' })
      .eq('user_id', userId)
      .eq('status', 'complete')

    if (media   !== 'all') query = query.eq('media_type', media)
    if (verdict !== 'all') query = query.eq('verdict',    verdict)

    if      (sort === 'oldest')     query = query.order('created_at',      { ascending: true  })
    else if (sort === 'confidence') query = query.order('confidence_score', { ascending: false })
    else                            query = query.order('created_at',       { ascending: false })

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [], total: count ?? 0 })
  } catch (err) {
    console.error('[user/scans]', err)
    return NextResponse.json({ data: [], total: 0, error: 'Failed to fetch scans' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = req.nextUrl
    const scanId = searchParams.get('id')

    const db = getSupabaseAdmin()

    if (scanId) {
      // Delete a single scan — verify ownership first
      const { error } = await db
        .from('scans')
        .delete()
        .eq('id', scanId)
        .eq('user_id', userId) // ownership enforced server-side
      if (error) throw error
      return NextResponse.json({ success: true })
    } else {
      // Delete ALL scans for this user
      const { error } = await db
        .from('scans')
        .delete()
        .eq('user_id', userId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }
  } catch (err) {
    console.error('[user/scans DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
