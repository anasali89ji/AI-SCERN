import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? 'placeholder'
)

const EDGE_FN_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pipeline-worker`
const ANON_KEY    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export async function GET() {
  const [jobs, items, scans] = await Promise.all([
    supabase.from('pipeline_jobs').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('dataset_items').select('*', { count: 'exact', head: true }),
    supabase.from('scans').select('*', { count: 'exact', head: true }),
  ])

  const statusCounts = (jobs.data ?? []).reduce((acc: any, j: any) => {
    acc[j.status] = (acc[j.status] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    success: true,
    data: {
      jobs:          jobs.data ?? [],
      status_counts: statusCounts,
      dataset_items: items.count ?? 0,
      total_scans:   scans.count ?? 0,
    }
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { action, job_type } = body

  if (action === 'trigger') {
    // Insert new jobs if requested
    if (job_type) {
      await supabase.from('pipeline_jobs').insert({
        job_type,
        status:   'pending',
        priority: job_type === 'scrape' ? 1 : job_type === 'clean' ? 2 : 3,
        payload:  {},
      })
    }

    // Call the Supabase Edge Function
    try {
      const res = await fetch(EDGE_FN_URL, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey':        ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ job_type: job_type ?? null }),
      })

      const result = await res.json()
      return NextResponse.json({ success: true, data: result })
    } catch (err) {
      return NextResponse.json({ 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to trigger pipeline'
      }, { status: 500 })
    }
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
}
