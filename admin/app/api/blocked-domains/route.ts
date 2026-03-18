import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb, logAdminAction } from '@/lib/admin-middleware'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { data } = await getAdminDb().from('blocked_domains').select('*').order('created_at', { ascending: false })
  return NextResponse.json({ ok: true, domains: data ?? [] })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { domain, reason } = await req.json()
  if (!domain) return NextResponse.json({ error: 'domain required' }, { status: 400 })
  const clean = domain.replace(/https?:\/\//,'').replace(/\/.*/,'').toLowerCase().trim()
  await getAdminDb().from('blocked_domains').upsert({ domain: clean, reason })
  await logAdminAction('domain_blocked', null, (auth as {ip:string}).ip, { domain: clean, reason })
  return NextResponse.json({ ok: true, domain: clean })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth
  const { domain } = await req.json()
  await getAdminDb().from('blocked_domains').delete().eq('domain', domain)
  await logAdminAction('domain_unblocked', null, (auth as {ip:string}).ip, { domain })
  return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("[Admin API]", err?.message)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
