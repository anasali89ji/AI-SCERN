import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Uses SERVICE ROLE key — bypasses RLS entirely
// Firebase users have no Supabase auth.uid() so client-side upsert always fails

export async function POST(req: NextRequest) {
  // This route is called server-side after Firebase auth — verify session or internal secret
  const session = req.cookies.get('__session')?.value
  const internalSecret = req.headers.get('x-internal-secret')
  const validInternal = internalSecret === (process.env.INTERNAL_API_SECRET || 'detectai-internal-2026')
  if (!session && !validInternal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { uid, email, display_name } = await req.json()

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('profiles')
      .upsert({
        id:               uid,
        email:            email || '',
        display_name:     display_name || email?.split('@')[0] || 'User',
        plan:             'free',
        plan_id:          'free',
        credits_remaining: 9999,
        scan_count:       0,
        monthly_scans:    0,
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      }, {
        onConflict: 'id',
        ignoreDuplicates: false,  // update if exists (handles Google re-login)
      })

    if (error) {
      console.error('[profiles/create] Supabase error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[profiles/create] Error:', err?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
