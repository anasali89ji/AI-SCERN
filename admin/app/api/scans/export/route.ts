import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'scans:read')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'all'
  const verdict = searchParams.get('verdict') || 'all'

  const db = getAdminDb()
  let query = db.from('scans').select('id, user_id, media_type, verdict, confidence_score, created_at').order('created_at', { ascending: false })

  if (type !== 'all') query = query.eq('media_type', type)
  if (verdict !== 'all') query = query.eq('verdict', verdict)

  const { data, error } = await query.limit(10000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const headers = ['ID', 'User ID', 'Type', 'Verdict', 'Confidence', 'Created']
  const rows = (data || []).map(s => [
    s.id, s.user_id, s.media_type, s.verdict, Math.round((s.confidence_score || 0) * 100) + '%', s.created_at
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="scans_export_${new Date().toISOString().slice(0,10)}.csv"`
    }
  })
}
