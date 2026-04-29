import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['display_name','username','bio','avatar_url','preferred_modalities','onboarding_completed','onboarding_step']
  const update: Record<string,any> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (update.username) {
    const db = getSupabaseAdmin()
    const { data: existing } = await db.from('profiles').select('id').ilike('username', update.username).neq('id', userId).maybeSingle()
    if (existing) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const db = getSupabaseAdmin()
  const { error } = await db.from('profiles').update(update).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
