import { NextRequest, NextResponse } from 'next/server'
import { auth }               from '@clerk/nextjs/server'
import { getSupabaseAdmin }   from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { userId, email, event, page, sessionId } = await req.json()
    if (!userId || !event) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Users can only log events for themselves
    if (userId !== clerkId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const ip        = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const userAgent = req.headers.get('user-agent') || ''

    await getSupabaseAdmin().from('user_sessions').insert({
      user_id: userId, email, event, ip,
      user_agent: userAgent.substring(0, 200), page, session_id: sessionId,
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
