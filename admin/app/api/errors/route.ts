import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const url     = new URL(req.url)
  const service  = url.searchParams.get('service')
  const resolved = url.searchParams.get('resolved')
  let q = getAdminDb().from('error_logs').select('*').order('created_at', { ascending: false }).limit(100)
  if (service)          q = (q as any).eq('service', service)
  if (resolved !== null) q = (q as any).eq('resolved', resolved === 'true')
  const { data } = await q
  return NextResponse.json({ ok: true, errors: data ?? [] })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { id } = await req.json()
  await getAdminDb().from('error_logs').update({ resolved: true }).eq('id', id)
  return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
