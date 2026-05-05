/**
 * /api/user/upgrade-request
 *
 * GET  — check if the current user has a pending upgrade request
 * POST — submit a new upgrade request (free → pro)
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }             from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ── GET: check request status ─────────────────────────────────────────────────
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseAdmin()

    // Get most recent request for this user
    const { data, error } = await db
      .from('upgrade_requests')
      .select('id, status, requested_at, reviewed_at, admin_note, requested_plan')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ request: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST: submit upgrade request ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = getSupabaseAdmin()

    // Fetch the user's current profile
    const { data: profile, error: profileErr } = await db
      .from('profiles')
      .select('plan, email, display_name, is_banned, dashboard_access')
      .eq('id', userId)
      .single()

    if (profileErr || !profile)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (profile.is_banned)
      return NextResponse.json({ error: 'Account is banned' }, { status: 403 })

    if (!profile.dashboard_access)
      return NextResponse.json({ error: 'Dashboard access revoked' }, { status: 403 })

    // Already on pro or higher — no need to request
    if (['pro', 'team', 'enterprise'].includes(profile.plan))
      return NextResponse.json({ error: 'Your account is already on a paid plan' }, { status: 409 })

    // Check for existing pending request
    const { data: existing } = await db
      .from('upgrade_requests')
      .select('id, status, requested_at')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing)
      return NextResponse.json({
        error: 'You already have a pending upgrade request. Please wait for admin review.',
        existing,
      }, { status: 409 })

    const body = await req.json().catch(() => ({}))
    const userMessage = typeof body.message === 'string' ? body.message.slice(0, 500) : null

    const { data: newRequest, error: insertErr } = await db
      .from('upgrade_requests')
      .insert({
        user_id:          userId,
        user_email:       profile.email,
        user_display_name: profile.display_name,
        current_plan:     profile.plan || 'free',
        requested_plan:   'pro',
        status:           'pending',
        user_message:     userMessage,
      })
      .select()
      .single()

    if (insertErr) throw insertErr

    return NextResponse.json({ success: true, request: newRequest })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
