import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ notifications: [] })
  const db = getSupabaseAdmin()
  const { data } = await db
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(10)
  return NextResponse.json({ notifications: data || [] })
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  const db = getSupabaseAdmin()
  if (id === 'all') {
    await db.from('user_notifications').update({ read: true }).eq('user_id', userId)
  } else {
    await db.from('user_notifications').update({ read: true }).eq('id', id).eq('user_id', userId)
  }
  return NextResponse.json({ success: true })
}
