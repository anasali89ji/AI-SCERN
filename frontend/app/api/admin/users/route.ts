import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { auth } from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const db = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const filter = searchParams.get('filter') || 'all'
    const limit = 25
    const offset = (page - 1) * limit

    let query = db.from('profiles')
      .select('id,email,display_name,plan,created_at,is_banned,dashboard_access,access_revoked_at,scan_count,credits_remaining', { count: 'exact' })

    if (search) query = query.ilike('email', `%${search}%`)
    if (filter === 'banned') query = query.eq('is_banned', true)
    if (filter === 'revoked') query = query.eq('dashboard_access', false)
    if (filter === 'active') query = query.eq('is_banned', false).neq('dashboard_access', false)

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (error) throw error

    return NextResponse.json({ users: data, total: count, page, limit })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId: targetId, action, reason } = await req.json()
    if (!targetId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const db = getSupabaseAdmin()
    const validActions = ['ban', 'unban', 'revoke', 'restore']
    if (!validActions.includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    let update: Record<string, any> = {}
    if (action === 'ban')     update = { is_banned: true }
    if (action === 'unban')   update = { is_banned: false }
    if (action === 'revoke')  update = { dashboard_access: false, access_revoked_at: new Date().toISOString(), access_revoked_reason: reason || 'Admin action' }
    if (action === 'restore') update = { dashboard_access: true, access_revoked_at: null, access_revoked_reason: null }

    const { error } = await db.from('profiles').update(update).eq('id', targetId)
    if (error) throw error

    // Log the admin action
    await db.from('admin_activity_logs').insert({
      admin_id: userId,
      action: `user_${action}`,
      target_id: targetId,
      details: { reason },
      created_at: new Date().toISOString(),
    }).catch(() => {}) // non-fatal

    return NextResponse.json({ success: true, action })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
