import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getAdminDb } from '@/lib/admin-middleware'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Only accept from valid admin sessions
  const auth = await requireAdmin(req)
  if (auth instanceof NextResponse) return auth

  try {
    const { message, stack, tab } = await req.json() as Record<string, string>
    if (!message) return NextResponse.json({ ok: true })

    const db = getAdminDb()
    await db.from('admin_client_errors').insert({
      message: String(message).slice(0, 1000),
      stack:   stack ? String(stack).slice(0, 4000) : null,
      tab:     tab ?? null,
      ip:      auth.ip,
    }).select()
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true })
}
