/**
 * Supabase Server Client — DATA ONLY, no auth.
 * Auth is handled entirely by Clerk.
 */
import { createClient } from '@supabase/supabase-js'

export async function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
