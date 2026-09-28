import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const db = getAdminDb()
  const { data, error } = await db.from('webhooks').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const db = getAdminDb()

  const secret = `whsec_${Array.from({length:32},()=>'0123456789abcdef'[Math.floor(Math.random()*16)]).join('')}`

  const { error } = await db.from('webhooks').insert({
    ...body,
    secret,
    created_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_audit_log').insert({
    action: 'webhook_created',
    admin_id: auth.adminId,
    admin_ip: auth.ip,
    metadata: { url: body.url, events: body.events },
  })

  return NextResponse.json({ ok: true, secret })
}
