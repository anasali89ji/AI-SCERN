import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
  const { key } = await params
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const body = await req.json()
  await getAdminDb().from('feature_flags').upsert({ key, ...body, updated_at: new Date().toISOString() })
  await logAdminAction(`flag_update:${key}`, null, (auth as any).ip, body)
  return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
  const { key } = await params
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  await getAdminDb().from('feature_flags').delete().eq('key', key)
  await logAdminAction(`flag_delete:${key}`, null, (auth as any).ip, {})
  return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
