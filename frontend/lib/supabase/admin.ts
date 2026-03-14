import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Returns a lazily-initialised Supabase admin client (service-role key).
 * Calling this inside a handler (not at module level) prevents build-time
 * crashes when env vars are not yet injected.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var')
    }
    _client = createClient(url, key, { auth: { persistSession: false } })
  }
  return _client
}
