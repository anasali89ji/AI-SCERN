import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { userId, email, event, page, sessionId } = await req.json()
    if (!userId || !event) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const userAgent = req.headers.get('user-agent') || ''

    const db = getSupabaseAdmin()
    await db.from('user_sessions').insert({
      user_id: userId,
      email,
      event,
      ip,
      user_agent: userAgent.substring(0, 200),
      page,
      session_id: sessionId,
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
