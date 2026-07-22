import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'all'
  const verdict = searchParams.get('verdict') || 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20

  const db = getAdminDb()
  let query = db.from('scans').select('*, profiles(email, display_name)').order('created_at', { ascending: false })

  if (type !== 'all') query = query.eq('media_type', type)
  if (verdict !== 'all') query = query.eq('verdict', verdict)

  const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scans = (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    media_type: row.media_type,
    verdict: row.verdict,
    confidence_score: row.confidence_score,
    created_at: row.created_at,
    profiles: row.profiles,
  }))

  return NextResponse.json({
    scans,
    total: count || 0,
    pages: Math.ceil((count || 0) / limit),
  })
}
