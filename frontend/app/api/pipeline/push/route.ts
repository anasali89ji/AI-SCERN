/**
 * Direct HuggingFace Push — triggers from admin dashboard
 * Reads unpushed items from Cloudflare D1, commits to HF dataset
 * No worker/terminal needed — runs server-side from Next.js
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export const dynamic    = 'force-dynamic'

const HF_TOKEN   = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
const HF_REPO    = process.env.HF_DATASET_REPO       || 'saghi776/detectai-dataset'
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID     || ''
const D1_DB      = process.env.CLOUDFLARE_D1_DATABASE_ID || ''
const CF_TOKEN   = process.env.CLOUDFLARE_API_TOKEN      || ''
const CF_BASE    = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_DB}/query`

async function d1(sql: string, params: any[] = []) {
  const r = await fetch(CF_BASE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CF_TOKEN}` },
    body:    JSON.stringify({ sql, params }),
    signal:  AbortSignal.timeout(25000),
  })
  if (!r.ok) throw new Error(`D1 ${r.status}: ${await r.text()}`)
  const d = await r.json() as any
  return d.result?.[0]?.results || []
}

// GET — check status
export async function GET() {
  try {
    if (!CF_ACCOUNT || !D1_DB || !CF_TOKEN) {
      return NextResponse.json({
        ok: false,
        error: 'Cloudflare D1 not configured',
        missing: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_API_TOKEN'].filter(k => !process.env[k]),
        hf_token_set: !!HF_TOKEN,
        hf_repo: HF_REPO,
      })
    }
    const [pending, state, recent] = await Promise.all([
      d1('SELECT media_type, COUNT(*) as count FROM dataset_items WHERE hf_pushed_at IS NULL GROUP BY media_type'),
      d1('SELECT total_scraped, total_pushed, last_push_at FROM pipeline_state WHERE id=1'),
      d1('SELECT item_count, commit_id, media_type, created_at FROM hf_push_log ORDER BY created_at DESC LIMIT 5'),
    ])
    const total = pending.reduce((s: number, r: any) => s + (r.count || 0), 0)
    return NextResponse.json({
      ok: true, hf_repo: HF_REPO, hf_token_set: !!HF_TOKEN,
      pending_total: total, pending_by_type: pending,
      pipeline_state: state[0] || {}, recent_pushes: recent,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// POST — trigger push
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!HF_TOKEN) return NextResponse.json({ error: 'Set HUGGINGFACE_API_TOKEN in Vercel env vars' }, { status: 400 })
  if (!CF_ACCOUNT || !D1_DB || !CF_TOKEN) return NextResponse.json({ error: 'Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN in Vercel env vars' }, { status: 400 })

  const { media_type, limit = 5000 } = await req.json().catch(() => ({}))

  try {
    const sql = media_type
      ? `SELECT id,media_type,label,content_text,content_url,content_preview,source_name,quality_score,split,language,created_at FROM dataset_items WHERE hf_pushed_at IS NULL AND media_type=? ORDER BY quality_score DESC LIMIT ?`
      : `SELECT id,media_type,label,content_text,content_url,content_preview,source_name,quality_score,split,language,created_at FROM dataset_items WHERE hf_pushed_at IS NULL ORDER BY quality_score DESC LIMIT ?`
    const items = await d1(sql, media_type ? [media_type, limit] : [limit])

    if (!items.length) return NextResponse.json({ ok: true, pushed: 0, message: 'Nothing pending — all data already on HuggingFace!' })

    // Group by media_type
    const groups: Record<string, any[]> = {}
    for (const item of items) {
      const t = item.media_type || 'text'
      if (!groups[t]) groups[t] = []
      groups[t].push(item)
    }

    // Build files for HF commit
    const files: any[] = []
    const summary: Record<string, number> = {}
    for (const [type, rows] of Object.entries(groups)) {
      const jsonl = rows.map((r: any) => JSON.stringify({
        id: r.id, media_type: r.media_type, label: r.label,
        text: r.content_text || null, url: r.content_url || null,
        preview: r.content_preview || null, source: r.source_name,
        quality: r.quality_score, split: r.split || 'train',
        language: r.language || 'en', scraped_at: r.created_at,
      })).join('\n')
      files.push({ path: `data/${type}/part-${Date.now()}.jsonl`, encoding: 'base64', content: Buffer.from(jsonl).toString('base64') })
      summary[type] = rows.length
    }

    // Commit to HuggingFace
    const hfRes = await fetch(`https://huggingface.co/api/datasets/${HF_REPO}/commit/main`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `Add ${items.length} samples — ${Object.entries(summary).map(([t,n]) => `${n} ${t}`).join(', ')}`,
        files,
      }),
      signal: AbortSignal.timeout(55000),
    })

    if (!hfRes.ok) {
      const txt = await hfRes.text()
      return NextResponse.json({ error: `HuggingFace rejected commit (${hfRes.status}): ${txt.slice(0, 400)}` }, { status: 500 })
    }

    const commit = await hfRes.json() as any
    const now    = new Date().toISOString()
    const ids    = items.map((i: any) => `'${i.id}'`).join(',')

    await Promise.all([
      d1(`UPDATE dataset_items SET hf_pushed_at=? WHERE id IN (${ids})`, [now]),
      d1(`UPDATE pipeline_state SET total_pushed=total_pushed+?, last_push_at=? WHERE id=1`, [items.length, now]),
      d1(`INSERT INTO hf_push_log (item_count, commit_id, repo, status, created_at) VALUES (?,?,?,'success',?)`,
         [items.length, commit.id || 'ok', HF_REPO, now]),
    ])

    return NextResponse.json({
      ok: true, pushed: items.length, by_type: summary,
      commit_id: commit.id, hf_url: `https://huggingface.co/datasets/${HF_REPO}`,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
