/**
 * Admin Pipeline API v5 — Cloudflare D1 REST API (no Edge Functions)
 * GET  → real D1 stats: scraped, pushed, sources, workers
 * POST → trigger manual scrape on all 20 workers simultaneously
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '34400e6e147e83e95c942135f54aeba7'
const D1_DB_ID      = '50f5e26a-c794-4cfa-b2b7-2bbd1d7c045c'

async function queryD1(sql: string): Promise<any[]> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN missing from Vercel env vars')
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DB_ID}/query`,
    {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sql }),
      signal:  AbortSignal.timeout(15000),
    }
  )
  if (!res.ok) throw new Error(`CF D1 ${res.status}: ${(await res.text()).slice(0,200)}`)
  const d = await res.json() as any
  if (!d.success) throw new Error(d.errors?.[0]?.message ?? 'D1 query failed')
  return d.result?.[0]?.results ?? []
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const [stateRows, countRows, sourceRows, pushRows, workerRows] = await Promise.all([
      queryD1('SELECT * FROM pipeline_state WHERE id=1'),
      queryD1(`SELECT COUNT(*) as total,
        SUM(CASE WHEN media_type='text'  THEN 1 ELSE 0 END) as text_count,
        SUM(CASE WHEN media_type='image' THEN 1 ELSE 0 END) as image_count,
        SUM(CASE WHEN media_type='audio' THEN 1 ELSE 0 END) as audio_count,
        SUM(CASE WHEN media_type='video' THEN 1 ELSE 0 END) as video_count,
        SUM(CASE WHEN label='ai'    THEN 1 ELSE 0 END) as ai_count,
        SUM(CASE WHEN label='human' THEN 1 ELSE 0 END) as human_count,
        SUM(CASE WHEN hf_pushed_at IS NULL THEN 1 ELSE 0 END) as pending,
        ROUND(AVG(quality_score),3) as avg_quality
        FROM dataset_items`),
      queryD1(`SELECT source_name, media_type, label, COUNT(*) as count
        FROM dataset_items GROUP BY source_name, media_type, label
        ORDER BY count DESC LIMIT 30`),
      queryD1(`SELECT item_count, commit_id, status, error, created_at
        FROM hf_push_log ORDER BY created_at DESC LIMIT 15`),
      queryD1(`SELECT worker_id, COUNT(*) as items, ROUND(AVG(quality_score),3) as avg_q,
        MAX(created_at) as last_active
        FROM dataset_items WHERE worker_id IS NOT NULL
        GROUP BY worker_id ORDER BY items DESC`),
    ])

    const state  = stateRows[0]  ?? {}
    const counts = countRows[0]  ?? {}

    return NextResponse.json({
      ok: true,
      pipeline: {
        version:       'v5.0 — 20 Workers',
        total_scraped: state.total_scraped ?? 0,
        total_pushed:  state.total_pushed  ?? 0,
        last_scrape:   state.last_scrape_at ?? null,
        last_push:     state.last_push_at   ?? null,
      },
      d1_buffer: {
        total:       counts.total       ?? 0,
        pending:     counts.pending     ?? 0,
        text:        counts.text_count  ?? 0,
        image:       counts.image_count ?? 0,
        audio:       counts.audio_count ?? 0,
        video:       counts.video_count ?? 0,
        ai_items:    counts.ai_count    ?? 0,
        human_items: counts.human_count ?? 0,
        avg_quality: counts.avg_quality ?? 0,
      },
      top_sources:   sourceRows,
      recent_pushes: pushRows,
      worker_stats:  workerRows,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok:    false,
      error: err.message,
      hint:  !process.env.CLOUDFLARE_API_TOKEN
        ? 'Add CLOUDFLARE_API_TOKEN to Vercel env vars (admin78 project settings)'
        : 'Check CF token has D1:read permission',
    }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const workerNames = [
    'detectai-pipeline',
    ...Array.from({ length: 19 }, (_,i) => `detectai-pipeline-w${i+2}`),
  ]

  const results = await Promise.allSettled(
    workerNames.map(name =>
      fetch(`https://${name}.workers.dev/trigger/scrape`, {
        method: 'POST', signal: AbortSignal.timeout(8000),
      }).then(r => r.json()).then(d => ({ worker: name, ok: true, result: d }))
        .catch(e => ({ worker: name, ok: false, error: e.message }))
    )
  )

  const out = results.map(r => r.status === 'fulfilled' ? r.value : { ok: false })
  return NextResponse.json({
    triggered: true,
    success: out.filter(r => r.ok).length,
    failed:  out.filter(r => !r.ok).length,
    workers: out,
  })
}
