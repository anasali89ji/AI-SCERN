import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function getAdminDb(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin credentials')

  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        'X-Client-Info': 'aiscern-admin/2.0',
        'apikey': key,
      },
    },
    db: { schema: 'public' },
  })
  return _admin
}

export const db = new Proxy({} as SupabaseClient, {
  get(_, prop) { return (getAdminDb() as any)[prop] }
})
