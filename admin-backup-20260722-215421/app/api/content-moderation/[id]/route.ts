import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'content_moderation:write')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db
    .from('content_flags')
    .update({
      status: body.status,
      resolution: body.resolution,
      resolved_by: auth.adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If approved for removal, take action
  if (body.status === 'removed' && data?.content_type && data?.user_id) {
    await db.from('profiles').update({ is_banned: true }).eq('id', data.user_id)
  }

  await logAdminAction('content_moderated', id, auth.ip, body, auth.adminId)
  return NextResponse.json(data)
}
