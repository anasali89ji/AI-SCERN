import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getAdminDb(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Admin panel requires service role key. ' +
      'Set this in Vercel environment variables.'
    )
  }
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

// Proxy for backward compatibility
export const db = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getAdminDb() as any)[prop] }
})
