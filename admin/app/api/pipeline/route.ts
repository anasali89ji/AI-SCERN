import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

export async function GET() {
  const [jobs, items, scans, profiles] = await Promise.all([
    db.from('pipeline_jobs').select('*').order('created_at', { ascending: false }).limit(50),
    db.from('dataset_items').select('media_type,label,split,is_deduplicated,hf_dataset_id,created_at').order('created_at', { ascending: false }).limit(200),
    db.from('scans').select('id,media_type,verdict,confidence_score,created_at,user_id').order('created_at', { ascending: false }).limit(100),
    db.from('profiles').select('id,email,display_name,plan,scan_count,created_at').order('created_at', { ascending: false }).limit(100),
  ])
  const jobStats = (jobs.data ?? []).reduce((a: any, j: any) => { a[j.status] = (a[j.status]||0)+1; return a }, {})
  const datasetStats = (items.data ?? []).reduce((a: any, i: any) => {
    const k = `${i.media_type}_${i.label}`; a[k] = (a[k]||0)+1; return a
  }, {})
  return NextResponse.json({
    jobs: jobs.data ?? [],
    jobStats,
    dataset: items.data ?? [],
    datasetStats,
    scans: scans.data ?? [],
    profiles: profiles.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const { action, job_type, payload } = await req.json()
  if (action === 'trigger') {
    const { error } = await db.from('pipeline_jobs').insert({
      job_type, status: 'pending',
      priority: job_type === 'scrape' ? 1 : job_type === 'clean' ? 2 : job_type === 'augment' ? 3 : 4,
      payload: payload || {},
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'cancel') {
    const { id } = await req.json().catch(() => ({}))
    await db.from('pipeline_jobs').update({ status: 'failed' }).eq('id', payload?.id).eq('status', 'pending')
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
