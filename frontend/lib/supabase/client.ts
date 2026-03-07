import { createBrowserClient } from '@supabase/ssr'

// Fallback placeholders prevent build-time throws during static prerendering.
// Real values are injected at runtime via Netlify env vars.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key'
  )
}
