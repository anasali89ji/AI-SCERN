import { NextRequest, NextResponse } from 'next/server'
import { auth }               from '@clerk/nextjs/server'
import { getSupabaseAdmin }   from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Always use the Clerk session — never trust uid from request body
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { email, display_name } = await req.json()
    const db = getSupabaseAdmin()

    // ── Check if profile already exists ──────────────────────────────────
    // CRITICAL: never overwrite plan/credits on an existing profile.
    // Admin upgrades set plan='pro' etc — a blind upsert on every login
    // would roll them back to 'free'. Only insert if the row is truly new.
    const { data: existing } = await db
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (existing) {
      // Profile already exists — only update safe, non-plan fields
      const { error } = await db
        .from('profiles')
        .update({
          email:       email || '',
          updated_at:  new Date().toISOString(),
        })
        .eq('id', userId)

      if (error) {
        console.error('[profiles/create] update error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, created: false })
    }

    // ── New user — insert with free defaults ──────────────────────────────
    const { error } = await db.from('profiles').insert({
      id:                userId,
      email:             email || '',
      display_name:      display_name || email?.split('@')[0] || 'User',
      plan:              'free',
      plan_id:           'free',
      credits_remaining: 9999,
      scan_count:        0,
      monthly_scans:     0,
      created_at:        new Date().toISOString(),
      updated_at:        new Date().toISOString(),
    })

    if (error) {
      // Ignore unique-violation (race condition: two tabs creating simultaneously)
      if (error.code === '23505') return NextResponse.json({ ok: true, created: false })
      console.error('[profiles/create] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, created: true })
  } catch (err: any) {
    console.error('[profiles/create] Error:', err?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
