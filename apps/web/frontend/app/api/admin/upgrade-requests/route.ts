/**
 * /api/admin/upgrade-requests
 *
 * GET  — list upgrade requests (default: pending)
 * PATCH — approve or reject a request (triggers grant_pro on approve)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { verifyAdmin, isAdminError } from '@/lib/auth/verify-admin'

export const dynamic = 'force-dynamic'

// ── GET: list requests ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  try {
    const db     = getSupabaseAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'pending'
    const page   = parseInt(searchParams.get('page') || '1')
    const limit  = 20
    const offset = (page - 1) * limit

    const validStatuses = ['pending', 'approved', 'rejected', 'all']
    if (!validStatuses.includes(status))
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })

    let query = db
      .from('upgrade_requests')
      .select('*', { count: 'exact' })

    if (status !== 'all') query = query.eq('status', status)

    const { data, count, error } = await query
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return NextResponse.json({ requests: data, total: count, page, limit })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── PATCH: approve or reject ──────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin()
  if (isAdminError(admin)) return admin

  try {
    const { requestId, action, adminNote, expiresInDays } = await req.json()

    if (!requestId || !action)
      return NextResponse.json({ error: 'Missing requestId or action' }, { status: 400 })

    if (!['approve', 'reject'].includes(action))
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 })

    const db = getSupabaseAdmin()

    // Fetch the request
    const { data: reqRow, error: fetchErr } = await db
      .from('upgrade_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchErr || !reqRow)
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    if (reqRow.status !== 'pending')
      return NextResponse.json({ error: `Request is already ${reqRow.status}` }, { status: 409 })

    const now = new Date().toISOString()

    // ── Approve ───────────────────────────────────────────────────────────────
    if (action === 'approve') {
      const expiresAt = expiresInDays && parseInt(expiresInDays) > 0
        ? new Date(Date.now() + parseInt(expiresInDays) * 86400000).toISOString()
        : null

      // Upgrade the profile
      const { error: upgradeErr } = await db
        .from('profiles')
        .update({
          plan:              'pro',
          plan_id:           'pro',
          credits_remaining: 99999,
          plan_granted_by:   admin.userId,
          plan_granted_at:   now,
          plan_expires_at:   expiresAt,
        })
        .eq('id', reqRow.user_id)

      if (upgradeErr) throw upgradeErr

      // Mark request approved
      await db
        .from('upgrade_requests')
        .update({
          status:      'approved',
          admin_note:  adminNote || null,
          reviewed_by: admin.userId,
          reviewed_at: now,
        })
        .eq('id', requestId)

      // Notify the user
      try {
        await db.from('user_notifications').insert({
          user_id: reqRow.user_id,
          type:    'plan_upgrade',
          title:   '🎉 Your upgrade request was approved!',
          message: `Your account has been upgraded to Aiscern Pro by an admin. You now have 100 scans/day across all 4 detection modalities.${expiresAt ? ` Your Pro access expires on ${new Date(expiresAt).toLocaleDateString()}.` : ''}${adminNote ? ` Note from admin: ${adminNote}` : ''}`,
          data:    { plan: 'pro', expires_at: expiresAt, request_id: requestId },
          read:    false,
        })
      } catch { /* non-fatal */ }

      // Audit log
      try {
        await db.from('admin_activity_logs').insert({
          admin_id:   admin.userId,
          action:     'upgrade_request_approved',
          target_id:  reqRow.user_id,
          details:    { request_id: requestId, admin_note: adminNote, expires_at: expiresAt },
          created_at: now,
        })
      } catch { /* non-fatal */ }

      return NextResponse.json({ success: true, action: 'approved', userId: reqRow.user_id })
    }

    // ── Reject ────────────────────────────────────────────────────────────────
    await db
      .from('upgrade_requests')
      .update({
        status:      'rejected',
        admin_note:  adminNote || null,
        reviewed_by: admin.userId,
        reviewed_at: now,
      })
      .eq('id', requestId)

    // Notify the user of rejection
    try {
      await db.from('user_notifications').insert({
        user_id: reqRow.user_id,
        type:    'plan_upgrade_rejected',
        title:   'Upgrade request update',
        message: `Your Pro upgrade request was reviewed by our team.${adminNote ? ` Admin note: ${adminNote}` : ' Unfortunately, we are unable to approve it at this time. You can reapply later.'}`,
        data:    { request_id: requestId },
        read:    false,
      })
    } catch { /* non-fatal */ }

    // Audit log
    try {
      await db.from('admin_activity_logs').insert({
        admin_id:   admin.userId,
        action:     'upgrade_request_rejected',
        target_id:  reqRow.user_id,
        details:    { request_id: requestId, admin_note: adminNote },
        created_at: now,
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true, action: 'rejected' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
