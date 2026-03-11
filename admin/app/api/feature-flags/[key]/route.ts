import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { key: string } }) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const { enabled, rollout_pct } = await req.json()
  const db = getAdminDb()
  const { error } = await db.from('feature_flags').upsert({
    key: params.key, enabled, rollout_pct: rollout_pct ?? 100, updated_at: new Date().toISOString()
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAdminAction('flag_toggle', null, auth.ip, { key: params.key, enabled })
  return NextResponse.json({ ok: true })
}
