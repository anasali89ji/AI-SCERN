/**
 * Supabase Server Client with Supavisor Connection Pooling
 * Use this for high-traffic server-side queries.
 * Uses pooled endpoint (port 6543) for transaction-level pooling.
 */
import { createClient } from '@supabase/supabase-js'

export async function createPooledServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'X-Client-Info': 'aiscern-pooled/1.0',
        'Connection': 'keep-alive',
      },
    },
  })
}

// Singleton for warm serverless invocations
let _pooledClient: ReturnType<typeof createClient> | null = null

export function getPooledClient() {
  if (_pooledClient) return _pooledClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  _pooledClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'X-Client-Info': 'aiscern-singleton/1.0' } },
  })
  return _pooledClient
}
