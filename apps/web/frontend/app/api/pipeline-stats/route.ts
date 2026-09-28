import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const WORKER_URLS = [
  { name: 'Text/Image Scraper',   url: process.env.WORKER_A_URL || '', num: 1  },
  { name: 'Image Deepfake',       url: process.env.WORKER_B_URL || '', num: 2  },
  { name: 'Audio Scraper',        url: process.env.WORKER_C_URL || '', num: 3  },
  { name: 'Video Scraper',        url: process.env.WORKER_D_URL || '', num: 4  },
  { name: 'HF Push + Cleanup',    url: process.env.WORKER_E_URL || '', num: 20 },
]

const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || ''
const D1_DB      = process.env.CLOUDFLARE_D1_DATABASE_ID || ''
const CF_BASE    = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`

async function d1(sql: string, token: string) {
  if (!CF_ACCOUNT || !D1_DB || !token) return []
  try {
    const r = await fetch(CF_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(8000),
    })
    const d = await r.json() as any
    return d.result?.[0]?.results || []
  } catch { return [] }
}

async function checkWorker(url: string): Promise<{ ok: boolean; status?: any; error?: string }> {
  if (!url) return { ok: false, error: 'URL not configured' }
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const data = await r.json() as any
    return { ok: true, status: data }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unreachable' }
  }
}

export async function GET() {
  const token = process.env.CLOUDFLARE_API_TOKEN ?? ''

  // Get D1 stats
  const [overview, byType, recentPushes] = await Promise.all([
    d1('SELECT total_scraped, total_pushed, last_scrape_at, last_push_at FROM pipeline_state WHERE id=1', token),
    d1('SELECT media_type, COUNT(*) as count, COUNT(hf_pushed_at) as pushed FROM dataset_items GROUP BY media_type', token),
    d1('SELECT item_count, commit_id, status, media_type, created_at FROM hf_push_log ORDER BY created_at DESC LIMIT 10', token),
  ])

  // Check worker health in parallel
  const workerHealthChecks = await Promise.all(
    WORKER_URLS.map(async (w) => ({
      ...w,
      health: await checkWorker(w.url),
    }))
  )

  const s = overview[0] || {}
  const totalScraped = s.total_scraped ?? 0
  const totalPushed  = s.total_pushed  ?? 0
  const pending      = Math.max(0, totalScraped - totalPushed)

  return NextResponse.json({
    ok: true,
    stats: {
      total_scraped:   totalScraped,
      total_pushed:    totalPushed,
      pending_push:    pending,
      last_scrape_at:  s.last_scrape_at,
      last_push_at:    s.last_push_at,
      push_rate:       totalScraped > 0 ? Math.round((totalPushed / totalScraped) * 100) : 0,
    },
    by_type:       byType,
    recent_pushes: recentPushes,
    workers:       workerHealthChecks.map(w => ({
      name:    w.name,
      num:     w.num,
      online:  w.health.ok,
      error:   w.health.error,
      version: w.health.status?.version,
      role:    w.health.status?.role,
    })),
    sources_total: 87,
    hf_repo:       'saghi776/detectai-dataset',
  })
}

// Manual trigger: POST /api/pipeline-stats?action=push
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'push') {
    const workerEUrl = process.env.WORKER_E_URL
    if (!workerEUrl) return NextResponse.json({ error: 'WORKER_E_URL not configured' }, { status: 400 })

    try {
      const r = await fetch(`${workerEUrl}/trigger/push`, {
        method: 'POST',
        signal: AbortSignal.timeout(30000),
      })
      const data = await r.json()
      return NextResponse.json({ ok: true, result: data })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Push trigger failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action. Use ?action=push' }, { status: 400 })
}
