import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json() as Record<string, unknown>
  const { data, error } = await getAdminDb()
    .from('error_logs')
    .update({ ...body, resolved_at: body.resolved ? new Date().toISOString() : null })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('error_resolved', params.id, auth.ip)
  return NextResponse.json(data)
}
