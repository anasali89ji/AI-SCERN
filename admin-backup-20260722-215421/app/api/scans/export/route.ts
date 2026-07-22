import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'scans:export')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'json'
  const since = searchParams.get('since')
  const mediaType = searchParams.get('type')

  const db = getAdminDb()
  let query = db.from('scans').select('*, profiles(email)').order('created_at', { ascending: false }).limit(5000)

  if (since) query = query.gte('created_at', since)
  if (mediaType) query = query.eq('media_type', mediaType)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scans = data ?? []

  if (format === 'csv') {
    const headers = ['ID', 'User ID', 'Email', 'Media Type', 'Verdict', 'Confidence', 'Created At']
    const rows = scans.map((s: any) => [
      s.id, s.user_id, s.profiles?.email || '', s.media_type, s.verdict,
      s.confidence_score, s.created_at
    ].map(v => `"${String(v).replace(/"/g, '\"')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="scans_${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ scans, count: scans.length })
}
