import { NextResponse } from 'next/server'

// Cache the result in-memory so we don't hammer HF on every request
let cached: { rows: number; ts: number } | null = null
const TTL_MS = 60 * 60 * 1000 // 1 hour

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET() {
  try {
    if (cached && Date.now() - cached.ts < TTL_MS) {
      return NextResponse.json({ rows: cached.rows, source: 'cache' })
    }

    const res = await fetch(
      'https://datasets-server.huggingface.co/size?dataset=saghi776%2Fdetectai-dataset',
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) }
    )

    if (!res.ok) throw new Error(`HF API ${res.status}`)

    const data = await res.json()
    const rows: number = data?.size?.dataset?.num_rows ?? 0
    cached = { rows, ts: Date.now() }
    return NextResponse.json({ rows, source: 'live' })
  } catch (err: any) {
    // Return last cached value or fallback
    if (cached) return NextResponse.json({ rows: cached.rows, source: 'stale' })
    return NextResponse.json({ rows: null, error: err?.message }, { status: 500 })
  }
}
