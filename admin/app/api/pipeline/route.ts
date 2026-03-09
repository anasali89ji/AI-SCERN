/**
 * Admin Pipeline API — proxies to Supabase pipeline-status edge function
 * Supports: GET (status), POST (trigger job)
 */
import { NextRequest, NextResponse } from 'next/server'

const EF_BASE  = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function callEdge(path: string, init: RequestInit = {}) {
  const res = await fetch(`${EF_BASE}/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      ...(init.headers || {}),
    },
  })
  return res
}

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action') || 'status'
    const res    = await callEdge(`pipeline-status?action=${action}`)
    const data   = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.trigger === 'run') {
      // Trigger full orchestrator run immediately
      const [statusRes, orchRes] = await Promise.all([
        callEdge('pipeline-status?action=trigger'),
        callEdge('pipeline-orchestrator', { method: 'POST', body: JSON.stringify({ manual: true }) }),
      ])
      const statusData = await statusRes.json().catch(() => ({}))
      const orchData   = await orchRes.json().catch(() => ({}))
      return NextResponse.json({ triggered: true, queue: statusData, run: orchData })
    }

    // Queue a specific job type
    const res  = await callEdge('pipeline-status?action=trigger')
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
