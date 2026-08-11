import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'errors:read')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const db = getAdminDb()
  const { data, error } = await db.from('error_logs').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await requireAdmin(req, 'errors:write')
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const body = await req.json()
  const db = getAdminDb()

  const { data, error } = await db
    .from('error_logs')
    .update({
      resolved: body.resolved,
      resolved_by: auth.adminId,
      resolved_at: new Date().toISOString(),
      resolution_note: body.note || '',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAdminAction('error_resolved', id, auth.ip, body, auth.adminId)
  return NextResponse.json(data)
}
