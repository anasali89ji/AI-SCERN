/**
 * Supabase Browser Client — DATA ONLY, no auth.
 * Auth is handled entirely by Clerk. Supabase is only used for
 * storing scan history, profiles, and reviews.
 */
import { createClient as supabaseCreateClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient<any, any, any> | null = null

export function createClient(): SupabaseClient<any, any, any> {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  _client = supabaseCreateClient<any, any, any>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return _client
}
