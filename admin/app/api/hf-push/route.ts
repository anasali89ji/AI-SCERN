import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
export const dynamic = 'force-dynamic'

const HF_TOKEN        = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
const HF_DATASET_REPO = process.env.HF_DATASET_REPO || 'saghi776/detectai-dataset'

export async function POST(req: NextRequest) {
  try {
    const { media_type } = await req.json().catch(() => ({}))
    let query: any = db.from('dataset_items').select('*').eq('is_deduplicated', true)
    if (media_type) query = query.eq('media_type', media_type)
    const { data: items, error } = await query.limit(5000)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!items?.length) return NextResponse.json({ error: 'No deduplicated items. Run scrape → clean jobs first.' }, { status: 400 })

    const stats = items.reduce((a: any, i: any) => { const k = `${i.media_type}_${i.label}`; a[k] = (a[k] || 0) + 1; return a }, {})
    if (!HF_TOKEN) return NextResponse.json({ simulated: true, total: items.length, stats, repo: HF_DATASET_REPO, message: 'Set HUGGINGFACE_API_TOKEN env var for real push' })

    const jsonl = items.map((item: any) => JSON.stringify({ id: item.id, media_type: item.media_type, label: item.label, source: item.source_name, split: item.split || 'train' })).join('\n')
    const filename = media_type ? `data/${media_type}.jsonl` : 'data/all.jsonl'

    const commitRes = await fetch(`https://huggingface.co/api/datasets/${HF_DATASET_REPO}/commit/main`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: `Update ${media_type || 'all'} dataset - ${items.length} items`, files: [{ path: filename, content: Buffer.from(jsonl).toString('base64') }] })
    })

    if (!commitRes.ok) {
      const txt = await commitRes.text()
      if (commitRes.status === 404) return NextResponse.json({ simulated: true, total: items.length, stats, message: `Repo "${HF_DATASET_REPO}" not found on HuggingFace. Create it first.` })
      return NextResponse.json({ error: `HF push failed (${commitRes.status}): ${txt}` }, { status: 500 })
    }

    const commitData = await commitRes.json()
    await db.from('dataset_items').update({ hf_dataset_id: HF_DATASET_REPO }).eq('is_deduplicated', true).is('hf_dataset_id', null)
    return NextResponse.json({ ok: true, total: items.length, stats, commit: commitData })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
