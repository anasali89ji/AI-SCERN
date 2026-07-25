/**
 * /api/chat/history — server-side ARIA chat sync
 *
 * FIX: chats used to live only in browser localStorage, so the same Clerk
 * account showed different ARIA history on mobile vs. web. This endpoint is
 * the single source of truth, keyed by Clerk userId, so every device sees
 * the same history.
 *
 * GET  -> list all chats (with messages) for the signed-in user
 * POST -> upsert one chat (session + its messages) for the signed-in user
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }                     from '@clerk/nextjs/server'
import { getSupabaseAdmin }         from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseAdmin()

  const { data: sessions, error: sErr } = await db
    .from('chat_sessions')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (sErr) return NextResponse.json({ success: false, error: sErr.message }, { status: 500 })
  if (!sessions?.length) return NextResponse.json({ success: true, chats: [] })

  const { data: messages, error: mErr } = await db
    .from('chat_messages')
    .select('id, session_id, role, content, attachments, tool_events, created_at')
    .in('session_id', sessions.map(s => s.id))
    .order('seq', { ascending: true })

  if (mErr) return NextResponse.json({ success: false, error: mErr.message }, { status: 500 })

  const byId: Record<string, any[]> = {}
  for (const m of messages || []) {
    (byId[m.session_id] ||= []).push({
      id:          m.id,
      role:        m.role,
      content:     m.content,
      timestamp:   m.created_at,
      attachments: m.attachments || undefined,
      toolEvents:  m.tool_events || undefined,
    })
  }

  const chats = sessions.map(s => ({
    id:        s.id,
    title:     s.title,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    messages:  byId[s.id] || [],
  }))

  return NextResponse.json({ success: true, chats })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const chat = body?.chat
  if (!chat?.id || !Array.isArray(chat.messages)) {
    return NextResponse.json({ success: false, error: 'Invalid chat payload' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  const { error: upsertErr } = await db.from('chat_sessions').upsert({
    id:         chat.id,
    user_id:    userId,
    title:      chat.title || 'New chat',
    created_at: chat.createdAt || new Date().toISOString(),
    updated_at: chat.updatedAt || new Date().toISOString(),
  })
  if (upsertErr) return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 })

  // Messages are appended client-side only, so a full replace per-session is
  // cheap (chat page already caps each chat at its last 30 messages) and
  // avoids diffing logic.
  await db.from('chat_messages').delete().eq('session_id', chat.id)

  const rows = chat.messages.map((m: any, i: number) => ({
    id:          m.id,
    session_id:  chat.id,
    user_id:     userId,
    role:        m.role,
    content:     m.content ?? '',
    attachments: m.attachments || null,
    tool_events: m.toolEvents || null,
    created_at:  m.timestamp || new Date().toISOString(),
    seq:         i,
  }))

  if (rows.length) {
    const { error: msgErr } = await db.from('chat_messages').insert(rows)
    if (msgErr) return NextResponse.json({ success: false, error: msgErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
