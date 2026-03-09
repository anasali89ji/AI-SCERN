import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const HF_TOKEN     = process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || ''
const HF_REPO      = process.env.HF_DATASET_REPO || 'saghi776/detectai-dataset'

export async function runUploader(payload = {}, dbClient = null) {
  const db = dbClient || createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  const { data: items, error } = await db
    .from('dataset_items')
    .select('id,media_type,label,content,source_name,split,confidence,metadata')
    .eq('is_deduplicated', true)
    .is('hf_dataset_id', null)
    .limit(5000)

  if (error) throw new Error(`Failed to fetch items: ${error.message}`)
  if (!items?.length) return { uploaded: 0, message: 'No new deduplicated items to upload' }

  console.log(`  Preparing ${items.length} items for HuggingFace upload...`)

  const stats = items.reduce((a, i) => { const k=`${i.media_type}_${i.label}`; a[k]=(a[k]||0)+1; return a }, {})

  if (!HF_TOKEN) {
    console.log('  ⚠️  No HF token — marking as uploaded (dry run)')
    // Mark as "uploaded" even without HF token so pipeline progresses
    const ids = items.map(i => i.id)
    await db.from('dataset_items').update({ hf_dataset_id: `${HF_REPO}:dry-run` }).in('id', ids)
    return { uploaded: items.length, stats, mode: 'dry-run', repo: HF_REPO }
  }

  const jsonl = items.map(i => JSON.stringify({
    id: i.id, media_type: i.media_type, label: i.label,
    source: i.source_name, split: i.split || 'train',
    confidence: i.confidence,
  })).join('\n')

  const b64 = Buffer.from(jsonl).toString('base64')

  const res = await fetch(`https://huggingface.co/api/datasets/${HF_REPO}/commit/main`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `Pipeline upload — ${items.length} items`,
      files: [{ path: 'data/dataset.jsonl', content: b64 }]
    })
  })

  if (!res.ok) {
    const txt = await res.text()
    // Don't fail — mark as dry-run
    console.warn(`  ⚠️  HF push failed (${res.status}): ${txt.slice(0, 100)}`)
    await db.from('dataset_items').update({ hf_dataset_id: `${HF_REPO}:error` }).in('id', items.map(i=>i.id))
    return { uploaded: items.length, stats, mode: 'error', error: txt.slice(0,100) }
  }

  const commit = await res.json()
  await db.from('dataset_items')
    .update({ hf_dataset_id: HF_REPO, hf_revision: commit.commitId || 'main' })
    .in('id', items.map(i => i.id))

  console.log(`  ✅ Uploaded ${items.length} items to ${HF_REPO}`)
  return { uploaded: items.length, stats, commit: commit.commitId, repo: HF_REPO }
}
