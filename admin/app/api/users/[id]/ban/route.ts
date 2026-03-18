import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { ban, reason } = await req.json()
  const db = getAdminDb()
  const { error } = await db.from('profiles').update({ is_banned: !!ban }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction(ban ? 'user_ban' : 'user_unban', id, auth.ip, { reason })
  return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
