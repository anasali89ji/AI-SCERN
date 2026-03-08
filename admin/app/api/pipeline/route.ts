import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [jobs, items, scans, profiles] = await Promise.allSettled([
      db.from('pipeline_jobs').select('*').order('created_at', { ascending: false }).limit(50),
      db.from('dataset_items').select('id,media_type,label,split,is_deduplicated,source_name,created_at').order('created_at', { ascending: false }).limit(200),
      db.from('scans').select('id,media_type,verdict,confidence_score,created_at,user_id').order('created_at', { ascending: false }).limit(100),
      db.from('profiles').select('id,email,display_name,plan,scan_count,created_at').order('created_at', { ascending: false }).limit(100),
    ])
    return NextResponse.json({
      jobs:     jobs.status     === 'fulfilled' ? (jobs.value.data     ?? []) : [],
      dataset:  items.status    === 'fulfilled' ? (items.value.data    ?? []) : [],
      scans:    scans.status    === 'fulfilled' ? (scans.value.data    ?? []) : [],
      profiles: profiles.status === 'fulfilled' ? (profiles.value.data ?? []) : [],
    })
  } catch (err) {
    return NextResponse.json({ jobs: [], dataset: [], scans: [], profiles: [], error: String(err) })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, job_type, payload } = await req.json()
    if (action === 'trigger') {
      const { error } = await db.from('pipeline_jobs').insert({ job_type, status: 'pending', priority: 1, payload: payload || {} })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
