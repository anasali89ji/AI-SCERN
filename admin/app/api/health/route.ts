import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
  try {
    const db = getDB()
    const [runsRes, beatsRes, alertsRes, overviewRes] = await Promise.all([
      db.from('pipeline_runs').select('*').order('started_at', { ascending: false }).limit(30),
      db.from('pipeline_heartbeat').select('*').order('beat_at', { ascending: false }).limit(50),
      db.from('pipeline_alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      db.from('pipeline_overview').select('*').single(),
    ])
    return NextResponse.json({
      runs:     runsRes.data     || [],
      beats:    beatsRes.data    || [],
      alerts:   alertsRes.data   || [],
      overview: overviewRes.data || {},
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
