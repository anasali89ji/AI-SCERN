import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const BATCH_SIZE = 200

function contentHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex')
}

export async function runCleaner(payload = {}, dbClient = null) {
  const db = dbClient || createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Fetch all non-deduplicated items
  const { data: items, error } = await db
    .from('dataset_items')
    .select('id, content, media_type, label')
    .eq('is_deduplicated', false)
    .limit(5000)

  if (error) throw new Error(`Failed to fetch items: ${error.message}`)
  if (!items?.length) return { deduplicated: 0, removed: 0, message: 'No items to clean' }

  console.log(`  Processing ${items.length} items for deduplication...`)

  const seen = new Set()
  const toKeep = []
  const toRemove = []

  for (const item of items) {
    const hash = contentHash(item.content)
    if (seen.has(hash)) {
      toRemove.push(item.id)
    } else {
      seen.add(hash)
      toKeep.push(item.id)
    }
  }

  // Mark kept items as deduplicated
  let kept = 0
  for (let i = 0; i < toKeep.length; i += BATCH_SIZE) {
    const chunk = toKeep.slice(i, i + BATCH_SIZE)
    const { error: e } = await db.from('dataset_items')
      .update({ is_deduplicated: true })
      .in('id', chunk)
    if (!e) kept += chunk.length
  }

  // Remove true duplicates
  let removed = 0
  for (let i = 0; i < toRemove.length; i += BATCH_SIZE) {
    const chunk = toRemove.slice(i, i + BATCH_SIZE)
    const { error: e } = await db.from('dataset_items').delete().in('id', chunk)
    if (!e) removed += chunk.length
  }

  console.log(`  ✅ Kept ${kept} unique items, removed ${removed} duplicates`)
  return { deduplicated: kept, removed, total_processed: items.length }
}
