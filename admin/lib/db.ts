import { createClient } from '@supabase/supabase-js'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xtdrwspsbranhunvlbfa.supabase.co'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
export const db = createClient(url, key, { auth: { persistSession: false } })
