import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin }          from '@/lib/supabase/admin'
import { auth }                      from '@clerk/nextjs/server'

export const dynamic = 'force-dynamic'

async function getUserId(): Promise<string | null> {
  try {
    const { userId } = await auth()
    return userId ?? null
  } catch {
    return null
  }
}

// ── DELETE — soft-revoke a key (sets is_active = false) ──────────────────────
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'Missing key id' }, { status: 400 })

  const sb = getSupabaseAdmin()

  // Verify the key belongs to this user before revoking
  const { data: key } = await sb
    .from('api_keys')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 })

  const { error } = await sb
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
