/**
 * /api/chat/history/[id] — delete a single ARIA chat session (or "all")
 * for the signed-in user. Scoped by user_id so one account can never
 * touch another account's chats.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }                     from '@clerk/nextjs/server'
import { getSupabaseAdmin }         from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getSupabaseAdmin()

  const query = db.from('chat_sessions').delete().eq('user_id', userId)
  const { error } = id === 'all' ? await query : await query.eq('id', id)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
