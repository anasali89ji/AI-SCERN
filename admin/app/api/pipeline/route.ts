/**
 * Admin Pipeline API
 * GET  → pipeline status (jobs, runs, dataset stats)
 * POST → trigger run or scrape
 */
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const EF_BASE      = `${SUPABASE_URL}/functions/v1`
const AUTH_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
                  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function callEdge(slug: string, init: RequestInit = {}) {
  const res = await fetch(`${EF_BASE}/${slug}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_KEY}`,
      ...((init.headers as Record<string, string>) || {}),
    },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`${slug} → ${res.status}: ${txt.slice(0, 300)}`)
  }
  return res.json()
}

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action') || 'status'
    const data   = await callEdge(`pipeline-status?action=${action}`)
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[GET /api/pipeline]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    // Step 1: queue a new run
    const queue = await callEdge('pipeline-status?action=trigger').catch((e: Error) => ({ error: e.message }))

    // Step 2: immediately call orchestrator to process jobs
    const run = await callEdge('pipeline-orchestrator', {
      method: 'POST',
      body: JSON.stringify({ source: 'admin-manual', job_type: body.job_type || 'all' }),
    }).catch((e: Error) => ({ error: e.message }))

    return NextResponse.json({ triggered: true, queue, run })
  } catch (err: any) {
    console.error('[POST /api/pipeline]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
