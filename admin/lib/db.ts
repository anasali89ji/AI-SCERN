import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL    || 'https://xtdrwspsbranhunvlbfa.supabase.co'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
           || 'placeholder-key'
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

export const db = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getClient() as any)[prop] }
})
