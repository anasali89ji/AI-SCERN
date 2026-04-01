import { NextRequest, NextResponse } from 'next/server'
import { analyzeText }               from '@/lib/inference/hf-analyze'
import { checkRateLimitRedis }       from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'

// ── simple deterministic hash for API key lookup ─────────────────────────────
function hashApiKey(key: string): string {
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h) ^ key.charCodeAt(i)
  return (h >>> 0).toString(16).padStart(8, '0')
}

// ── resolve & validate the incoming API key ───────────────────────────────────
async function resolveKey(
  apiKey: string,
): Promise<{ valid: false } | { valid: true; owner: string; keyHash: string }> {

  // 1. Master key (env — for internal/testing use)
  const masterKey = process.env.API_MASTER_KEY
  if (masterKey && apiKey === masterKey) {
    return { valid: true, owner: 'master', keyHash: '' }
  }

  // 2. User-issued key stored in Supabase
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
    const keyHash = hashApiKey(apiKey)
    const { data } = await getSupabaseAdmin()
      .from('api_keys')
      .select('user_id, is_active, calls_today, daily_limit')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single()

    if (!data) return { valid: false }

    // Daily quota check
    if (data.daily_limit != null && data.calls_today >= data.daily_limit) {
      return { valid: false }   // caller receives 429 with specific message
    }

    return { valid: true, owner: data.user_id, keyHash }
  } catch {
    // api_keys table not yet created — reject all non-master keys
    return { valid: false }
  }
}

// ── handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Extract key from header (support both styles)
  const apiKey =
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''

  if (!apiKey) {
    return NextResponse.json(
      { error: 'X-API-Key header required. Get your key at aiscern.com/docs/api', docs: '/docs/api' },
      { status: 401 },
    )
  }

  const resolved = await resolveKey(apiKey)

  if (!resolved.valid) {
    // Distinguish quota-exceeded from invalid key by re-checking quota
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
      const { data } = await getSupabaseAdmin()
        .from('api_keys')
        .select('calls_today, daily_limit')
        .eq('key_hash', hashApiKey(apiKey))
        .eq('is_active', true)
        .single()
      if (data && data.daily_limit != null && data.calls_today >= data.daily_limit) {
        return NextResponse.json(
          { error: `Daily API limit reached (${data.daily_limit} calls/day). Resets at midnight UTC.` },
          { status: 429 },
        )
      }
    } catch { /* table may not exist */ }

    return NextResponse.json(
      { error: 'Invalid or inactive API key. Get your key at aiscern.com/docs/api', docs: '/docs/api' },
      { status: 401 },
    )
  }

  // Per-IP secondary rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const allowed = await checkRateLimitRedis(`api:${ip}`, 60, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 requests/minute per IP.' },
      { status: 429 },
    )
  }

  // Parse & validate body
  const body = await req.json().catch(() => ({}))
  const { text } = body as { text?: unknown }

  if (!text || typeof text !== 'string')
    return NextResponse.json({ error: 'Body must be JSON with a "text" string field.' }, { status: 400 })
  if (text.length < 50)
    return NextResponse.json({ error: 'text must be at least 50 characters.' }, { status: 400 })
  if (text.length > 10_000)
    return NextResponse.json({ error: 'text must be under 10,000 characters.' }, { status: 400 })

  try {
    const start  = Date.now()
    const result = await analyzeText(text)

    // Increment usage counter fire-and-forget (non-fatal, skip for master key)
    if (resolved.owner !== 'master' && resolved.keyHash) {
      void (async () => {
        try {
          const { getSupabaseAdmin } = await import('@/lib/supabase/admin')
          const sb = getSupabaseAdmin()
          // Atomic increment via SQL expression through update
          await sb
            .from('api_keys')
            .update({ last_used_at: new Date().toISOString() })
            .eq('key_hash', resolved.keyHash)
          // Separate RPC for atomic counter increment (function created in Appendix B SQL)
          await sb.rpc('increment_api_calls', { key_hash_input: resolved.keyHash })
        } catch { /* non-fatal */ }
      })()
    }

    return NextResponse.json({
      verdict:         result.verdict,
      confidence:      result.confidence,
      signals:         result.signals.slice(0, 5),
      summary:         result.summary,
      processing_time: Date.now() - start,
      model:           result.model_used,
      api_version:     'v1',
    })
  } catch (err: unknown) {
    console.error('[v1/detect/text]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
